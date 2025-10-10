import { EventTarget, warn, error } from "cc";

/**
 * 数据变化监听器类型
 */
export type DataWatcher<T = any> = (newValue: T, oldValue: T, key: string) => void;

/**
 * 数据监听器配置
 */
export interface DataWatcherConfig<T = any> {
    /** 监听器函数 */
    watcher: DataWatcher<T>;
    /** 监听目标(用于自动解绑) */
    target?: any;
    /** 是否立即触发(如果数据已存在) */
    immediate?: boolean;
    /** 深度监听(对象/数组内部变化) */
    deep?: boolean;
}

/**
 * 黑板数据项
 */
interface BlackboardItem {
    /** 数据值 */
    value: any;
    /** 监听器列表 */
    watchers: DataWatcherConfig[];
    /** 数据类型标记 */
    type?: string;
}

/**
 * 黑板系统 - 全局数据共享和响应式数据绑定
 * 基于EventTarget实现数据变化通知机制
 */
export class Blackboard extends EventTarget {
    private static _instance: Blackboard | null = null;

    /** 数据存储 */
    private _data: Map<string, BlackboardItem> = new Map();
    /** 是否启用调试模式 */
    private _debug: boolean = false;

    /**
     * 获取单例实例
     */
    public static get instance(): Blackboard {
        if (!this._instance) {
            this._instance = new Blackboard();
        }
        return this._instance;
    }

    /**
     * 私有构造函数
     */
    private constructor() {
        super();
    }

    /**
     * 设置调试模式
     */
    public setDebug(debug: boolean): void {
        this._debug = debug;
    }

    /**
     * 设置数据
     */
    public set<T>(key: string, value: T): void {
        const oldItem = this._data.get(key);
        const oldValue = oldItem ? oldItem.value : undefined;

        // 检查值是否真的发生了变化
        if (this._isEqual(oldValue, value)) {
            return;
        }

        // 创建或更新数据项
        const item: BlackboardItem = {
            value: value,
            watchers: oldItem ? oldItem.watchers : [],
            type: typeof value
        };

        this._data.set(key, item);

        // 触发监听器
        this._notifyWatchers(key, value, oldValue);

        // 发送事件
        this.emit(key, value, oldValue);

        if (this._debug) {
            console.log(`[Blackboard] Set: ${key} = ${JSON.stringify(value)} (was: ${JSON.stringify(oldValue)})`);
        }
    }

    /**
     * 获取数据
     */
    public get<T>(key: string, defaultValue?: T): T {
        const item = this._data.get(key);
        return item ? item.value : defaultValue;
    }

    /**
     * 检查数据是否存在
     */
    public has(key: string): boolean {
        return this._data.has(key);
    }

    /**
     * 删除数据
     */
    public delete(key: string): boolean {
        const item = this._data.get(key);
        if (!item) {
            return false;
        }

        const oldValue = item.value;

        // 清理监听器
        item.watchers.forEach(config => {
            if (config.target) {
                this.targetOff(config.target);
            }
        });

        // 从存储中删除
        this._data.delete(key);

        // 触发删除事件
        this.emit(`${key}_deleted`, oldValue);

        if (this._debug) {
            console.log(`[Blackboard] Deleted: ${key}`);
        }

        return true;
    }

    /**
     * 监听数据变化
     */
    public watch<T>(key: string, watcher: DataWatcher<T>, target?: any): void {
        this.addWatcher(key, {
            watcher: watcher,
            target: target,
            immediate: false,
            deep: false
        });
    }

    /**
     * 监听数据变化(立即触发)
     */
    public watchImmediate<T>(key: string, watcher: DataWatcher<T>, target?: any): void {
        this.addWatcher(key, {
            watcher: watcher,
            target: target,
            immediate: true,
            deep: false
        });
    }

    /**
     * 深度监听数据变化
     */
    public watchDeep<T>(key: string, watcher: DataWatcher<T>, target?: any): void {
        this.addWatcher(key, {
            watcher: watcher,
            target: target,
            immediate: false,
            deep: true
        });
    }

    /**
     * 添加数据监听器
     */
    public addWatcher<T>(key: string, config: DataWatcherConfig<T>): void {
        let item = this._data.get(key);
        if (!item) {
            // 如果数据不存在，创建空项
            item = {
                value: undefined,
                watchers: [],
                type: "undefined"
            };
            this._data.set(key, item);
        }

        // 添加监听器
        item.watchers.push(config);

        // 同时添加到EventTarget
        this.on(key, config.watcher as any, config.target);

        // 如果立即触发且数据已存在
        if (config.immediate && item.value !== undefined) {
            try {
                config.watcher(item.value, undefined, key);
            } catch (e) {
                error(`[Blackboard] Error in immediate watcher for ${key}:`, e);
            }
        }

        if (this._debug) {
            console.log(`[Blackboard] Added watcher for: ${key}`, { hasTarget: !!config.target, immediate: config.immediate });
        }
    }

    /**
     * 取消监听数据变化
     */
    public unwatch<T>(key: string, watcher?: DataWatcher<T>, target?: any): void {
        const item = this._data.get(key);
        if (!item) {
            return;
        }

        if (watcher) {
            // 移除特定监听器
            item.watchers = item.watchers.filter(config => 
                config.watcher !== watcher || config.target !== target
            );
            this.off(key, watcher as any, target);
        } else if (target) {
            // 移除目标的所有监听器
            item.watchers = item.watchers.filter(config => config.target !== target);
            this.targetOff(target);
        } else {
            // 移除所有监听器
            item.watchers = [];
            this.off(key);
        }

        if (this._debug) {
            console.log(`[Blackboard] Removed watcher for: ${key}`, { hasWatcher: !!watcher, hasTarget: !!target });
        }
    }

    /**
     * 取消目标对象的所有监听
     */
    public unwatchTarget(target: any): void {
        for (const [key, item] of this._data) {
            item.watchers = item.watchers.filter(config => config.target !== target);
        }
        this.targetOff(target);

        if (this._debug) {
            console.log(`[Blackboard] Removed all watchers for target:`, target);
        }
    }

    /**
     * 获取所有数据的key
     */
    public keys(): string[] {
        return Array.from(this._data.keys());
    }

    /**
     * 获取所有数据
     */
    public getAll(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, item] of this._data) {
            result[key] = item.value;
        }
        return result;
    }

    /**
     * 批量设置数据
     */
    public setBatch(data: Record<string, any>): void {
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                this.set(key, data[key]);
            }
        }
    }

    /**
     * 清理所有数据
     */
    public clear(): void {
        const keys = Array.from(this._data.keys());

        for (const key of keys) {
            this.delete(key);
        }

        if (this._debug) {
            console.log(`[Blackboard] Cleared all data`);
        }
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): any {
        const info: any = {
            totalKeys: this._data.size,
            data: {},
            watchers: {}
        };

        for (const [key, item] of this._data) {
            info.data[key] = {
                value: item.value,
                type: item.type
            };
            info.watchers[key] = item.watchers.length;
        }

        return info;
    }

    /**
     * 销毁黑板
     */
    public destroy(): void {
        // 清理所有数据和监听器
        this.clear();

        // 清理EventTarget
        this.removeAll();

        Blackboard._instance = null;

        if (this._debug) {
            console.log(`[Blackboard] Destroyed`);
        }
    }

    /**
     * 通知监听器
     */
    private _notifyWatchers<T>(key: string, newValue: T, oldValue: T): void {
        const item = this._data.get(key);
        if (!item) return;

        for (const config of item.watchers) {
            try {
                config.watcher(newValue, oldValue, key);
            } catch (e) {
                error(`[Blackboard] Error in watcher for ${key}:`, e);
            }
        }
    }

    /**
     * 检查两个值是否相等
     */
    private _isEqual(a: any, b: any): boolean {
        if (a === b) return true;
        if (a == null || b == null) return a === b;
        if (typeof a !== typeof b) return false;
        
        // 简单的深度比较（仅支持基础类型和简单对象）
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!this._isEqual(a[key], b[key])) return false;
            }
            return true;
        }
        
        return false;
    }
}