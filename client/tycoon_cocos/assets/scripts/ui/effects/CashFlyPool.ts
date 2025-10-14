/**
 * CashFlyPool - Cash 组件对象池
 *
 * 职责：
 * - 缓存和复用 FairyGUI Cash 组件实例
 * - 管理对象的获取和回收
 * - 限制最大活跃对象数量
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import * as fgui from 'fairygui-cc';

/**
 * 对象池配置
 */
export interface PoolConfig {
    /** 包名 */
    packageName: string;
    /** 组件名 */
    componentName: string;
    /** 初始大小 */
    initialSize: number;
    /** 最大活跃数 */
    maxActive: number;
}

/**
 * CashFlyPool 类
 */
export class CashFlyPool {
    /** 空闲对象池 */
    private _pool: fgui.GComponent[] = [];

    /** 活跃对象集合 */
    private _activeObjects: Set<fgui.GComponent> = new Set();

    /** 配置 */
    private _config: PoolConfig | null = null;

    /** 是否已初始化 */
    private _initialized: boolean = false;

    /**
     * 初始化对象池
     *
     * @param config 配置
     */
    public initialize(config: PoolConfig): void {
        if (this._initialized) {
            console.warn('[CashFlyPool] Already initialized');
            return;
        }

        this._config = config;

        console.log('[CashFlyPool] 初始化对象池', {
            packageName: config.packageName,
            componentName: config.componentName,
            initialSize: config.initialSize
        });

        // 预创建初始对象
        for (let i = 0; i < config.initialSize; i++) {
            const obj = this._createObject();
            if (obj) {
                this._pool.push(obj);
            }
        }

        this._initialized = true;
        console.log(`[CashFlyPool] 对象池初始化完成，预创建 ${this._pool.length} 个对象`);
    }

    /**
     * 从池中获取对象
     *
     * @returns Cash 组件实例，如果池已满返回 null
     */
    public get(): fgui.GComponent | null {
        if (!this._initialized) {
            console.error('[CashFlyPool] Pool not initialized');
            return null;
        }

        // 检查活跃数量限制
        if (this._activeObjects.size >= this._config!.maxActive) {
            console.warn('[CashFlyPool] 达到最大活跃数量限制', {
                active: this._activeObjects.size,
                max: this._config!.maxActive
            });
            return null;
        }

        // 从池中取出对象
        let obj = this._pool.pop();

        // 如果池为空，创建新对象
        if (!obj) {
            obj = this._createObject();
            if (!obj) {
                console.error('[CashFlyPool] 创建对象失败');
                return null;
            }
        }

        // 重置对象状态
        this._resetObject(obj);

        // 添加到活跃集合
        this._activeObjects.add(obj);

        console.log(`[CashFlyPool] 获取对象，活跃数: ${this._activeObjects.size}`);
        return obj;
    }

    /**
     * 回收对象到池中
     *
     * @param obj 要回收的对象
     */
    public recycle(obj: fgui.GComponent): void {
        if (!obj) {
            return;
        }

        // 从活跃集合移除
        if (!this._activeObjects.has(obj)) {
            console.warn('[CashFlyPool] 尝试回收不在活跃集合中的对象');
            return;
        }

        this._activeObjects.delete(obj);

        // 重置对象状态
        this._resetObject(obj);

        // 从父节点移除
        if (obj.parent) {
            obj.removeFromParent();
        }

        // 放回池中
        this._pool.push(obj);

        console.log(`[CashFlyPool] 回收对象，活跃数: ${this._activeObjects.size}, 池大小: ${this._pool.length}`);
    }

    /**
     * 创建新对象
     */
    private _createObject(): fgui.GComponent | null {
        try {
            const obj = fgui.UIPackage.createObject(
                this._config!.packageName,
                this._config!.componentName
            );

            if (!obj) {
                console.error('[CashFlyPool] UIPackage.createObject 返回 null');
                return null;
            }

            return obj.asCom;
        } catch (error) {
            console.error('[CashFlyPool] 创建对象失败', error);
            return null;
        }
    }

    /**
     * 重置对象状态
     *
     * @param obj 要重置的对象
     */
    private _resetObject(obj: fgui.GComponent): void {
        // 重置位置
        obj.setXY(0, 0);

        // 重置透明度
        obj.alpha = 1.0;

        // 重置可见性
        obj.visible = true;

        // 重置文本内容
        const titleText = obj.getChild('title') as fgui.GTextField;
        if (titleText) {
            titleText.text = '';
            titleText.color = 0xFFFFFF; // 默认白色
        }
    }

    /**
     * 清空对象池（销毁所有对象）
     */
    public clear(): void {
        console.log('[CashFlyPool] 清空对象池');

        // 销毁活跃对象
        for (const obj of this._activeObjects) {
            if (obj.parent) {
                obj.removeFromParent();
            }
            obj.dispose();
        }
        this._activeObjects.clear();

        // 销毁池中对象
        for (const obj of this._pool) {
            obj.dispose();
        }
        this._pool = [];

        this._initialized = false;
        this._config = null;

        console.log('[CashFlyPool] 对象池已清空');
    }

    /**
     * 获取统计信息
     */
    public getStats(): { active: number; idle: number; total: number; max: number } {
        return {
            active: this._activeObjects.size,
            idle: this._pool.length,
            total: this._activeObjects.size + this._pool.length,
            max: this._config?.maxActive || 0
        };
    }
}
