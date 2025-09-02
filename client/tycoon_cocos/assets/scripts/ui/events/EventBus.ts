import { EventTarget, warn, error } from "cc";
import { EventListener, EventListenerConfig } from "./EventTypes";

/**
 * 事件总线类 - 全局事件通信机制
 * 基于Cocos Creator的EventTarget实现，提供跨模块通信能力
 */
class EventBusClass extends EventTarget {
    private static _instance: EventBusClass | null = null;

    /** 事件监听器注册表 */
    private _listenerMap: Map<string, EventListenerConfig[]> = new Map();
    /** 是否启用调试模式 */
    private _debug: boolean = false;

    /**
     * 获取单例实例
     */
    public static get instance(): EventBusClass {
        if (!this._instance) {
            this._instance = new EventBusClass();
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
     * 发送事件
     */
    public emitEvent<T>(event: string, data?: T): void {
        try {
            if (this._debug) {
                console.log(`[EventBus] Emit: ${event}`, data);
            }

            // 使用Cocos Creator的EventTarget发送事件
            this.emit(event, data);

        } catch (e) {
            error(`[EventBus] Error emitting event [${event}]:`, e);
        }
    }

    /**
     * 监听事件
     */
    public onEvent<T>(event: string, callback: EventListener<T>, target?: any): void {
        this.addEventListenerWithConfig(event, {
            listener: callback,
            target: target,
            once: false
        });
    }

    /**
     * 监听事件（只监听一次）
     */
    public onEventOnce<T>(event: string, callback: EventListener<T>, target?: any): void {
        this.addEventListenerWithConfig(event, {
            listener: callback,
            target: target,
            once: true
        });
    }

    /**
     * 取消监听事件
     */
    public offEvent<T>(event: string, callback?: EventListener<T>, target?: any): void {
        if (callback) {
            // 取消特定回调
            this.off(event, callback as any, target);
            this._removeFromListenerMap(event, callback, target);
        } else if (target) {
            // 取消目标对象的所有监听
            this.targetOff(target);
            this._removeTargetFromListenerMap(target);
        } else {
            // 取消事件的所有监听
            this.off(event);
            this._listenerMap.delete(event);
        }

        if (this._debug) {
            console.log(`[EventBus] Off event: ${event}`, { callback: !!callback, target: !!target });
        }
    }

    /**
     * 取消目标对象的所有事件监听
     */
    public offTarget(target: any): void {
        if (!target) return;

        this.targetOff(target);
        this._removeTargetFromListenerMap(target);

        if (this._debug) {
            console.log(`[EventBus] Off target:`, target);
        }
    }

    /**
     * 添加带配置的事件监听器
     */
    public addEventListenerWithConfig(event: string, config: EventListenerConfig): void {
        // 添加到Cocos EventTarget
        if (config.once) {
            this.once(event, config.listener as any, config.target);
        } else {
            this.on(event, config.listener as any, config.target);
        }

        // 添加到内部注册表
        this._addToListenerMap(event, config);

        if (this._debug) {
            console.log(`[EventBus] On event: ${event}`, config);
        }
    }

    /**
     * 检查是否有事件监听器
     */
    public hasEventListener(event: string): boolean {
        const listeners = this._listenerMap.get(event);
        return listeners ? listeners.length > 0 : false;
    }

    /**
     * 获取事件监听器数量
     */
    public getEventListenerCount(event: string): number {
        const listeners = this._listenerMap.get(event);
        return listeners ? listeners.length : 0;
    }

    /**
     * 获取所有已注册的事件名称
     */
    public getRegisteredEvents(): string[] {
        return Array.from(this._listenerMap.keys());
    }

    /**
     * 清理所有事件监听器
     */
    public clear(): void {
        // 依赖内部注册表逐事件清理
        for (const event of this._listenerMap.keys()) {
            this.off(event);
        }
        this._listenerMap.clear();
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): any {
        const info: any = {
            totalEvents: this._listenerMap.size,
            events: {}
        };

        for (const [event, listeners] of this._listenerMap) {
            info.events[event] = {
                listenerCount: listeners.length,
                listeners: listeners.map(config => ({
                    hasTarget: !!config.target,
                    once: config.once,
                    priority: config.priority
                }))
            };
        }

        return info;
    }

    /**
     * 销毁事件总线
     */
    public destroy(): void {
        this.clear();
        EventBusClass._instance = null;
    }

    /**
     * 添加到监听器注册表
     */
    private _addToListenerMap(event: string, config: EventListenerConfig): void {
        let listeners = this._listenerMap.get(event);
        if (!listeners) {
            listeners = [];
            this._listenerMap.set(event, listeners);
        }

        // 按优先级排序插入
        const priority = config.priority || 0;
        let insertIndex = listeners.length;
        
        for (let i = 0; i < listeners.length; i++) {
            if ((listeners[i].priority || 0) < priority) {
                insertIndex = i;
                break;
            }
        }

        listeners.splice(insertIndex, 0, config);
    }

    /**
     * 从监听器注册表中移除
     */
    private _removeFromListenerMap(event: string, callback: EventListener, target?: any): void {
        const listeners = this._listenerMap.get(event);
        if (!listeners) return;

        for (let i = listeners.length - 1; i >= 0; i--) {
            const config = listeners[i];
            if (config.listener === callback && config.target === target) {
                listeners.splice(i, 1);
                break;
            }
        }

        if (listeners.length === 0) {
            this._listenerMap.delete(event);
        }
    }

    /**
     * 从监听器注册表中移除目标对象
     */
    private _removeTargetFromListenerMap(target: any): void {
        for (const [event, listeners] of this._listenerMap) {
            for (let i = listeners.length - 1; i >= 0; i--) {
                if (listeners[i].target === target) {
                    listeners.splice(i, 1);
                }
            }

            if (listeners.length === 0) {
                this._listenerMap.delete(event);
            }
        }
    }
}

/**
 * 导出全局事件总线单例
 */
export const EventBus = EventBusClass.instance;

/**
 * 事件总线便捷方法
 */
// 已移除 EventBusHelpers 以避免与 EventTypes 命名规则混淆