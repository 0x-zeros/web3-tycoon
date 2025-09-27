import { EventTarget } from "cc";
import { EventListener, EventListenerConfig, EventTypes } from "./EventTypes";

/**
 * 事件总线类 - 全局事件通信机制
 * 基于Cocos Creator的EventTarget实现，提供跨模块通信能力
 * 使用组合模式，内部持有EventTarget实例而不是继承
 */
class EventBusClass {
    private static _instance: EventBusClass | null = null;
    
    /** 内部EventTarget实例 */
    private _eventTarget: EventTarget;
    
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
        this._eventTarget = new EventTarget();
    }

    /**
     * 设置调试模式
     */
    public setDebug(debug: boolean): void {
        this._debug = debug;
    }

    // ========================= 核心EventTarget方法封装 =========================

    /**
     * 监听事件
     */
    public on<T>(event: string, callback: EventListener<T>, target?: any): void {
        this._eventTarget.on(event, callback as any, target);
        this._addToListenerMap(event, {
            listener: callback,
            target: target,
            once: false
        });

        if (this._debug) {
            console.log(`[EventBus] On event: ${event}`);
        }
    }

    /**
     * 监听事件（只监听一次）
     */
    public once<T>(event: string, callback: EventListener<T>, target?: any): void {
        this._eventTarget.once(event, callback as any, target);
        this._addToListenerMap(event, {
            listener: callback,
            target: target,
            once: true
        });

        if (this._debug) {
            console.log(`[EventBus] Once event: ${event}`);
        }
    }

    /**
     * 取消监听事件
     */
    public off<T>(event: string, callback?: EventListener<T>, target?: any): void {
        this._eventTarget.off(event, callback as any, target);
        this._removeFromListenerMap(event, callback, target);

        if (this._debug) {
            console.log(`[EventBus] Off event: ${event}`);
        }
    }

    /**
     * 发送事件
     */
    public emit<T>(event: string, data?: T): void {
        try {
            //if (this._debug && (!event.startsWith('input3d_') || event.startsWith(EventTypes.Input3D.RaycastHit))) {
            //if (this._debug) {
            if (this._debug && !event.startsWith('input3d_')) {
                const listenerCount = this.getEventListenerCount(event);
                console.log(`[EventBus] Emit event: ${event}, listeners: ${listenerCount}`, data);
            }

            this._eventTarget.emit(event, data);

        } catch (e) {
            console.error(`[EventBus] Error emitting event [${event}]:`, e);
        }
    }

    // ========================= 扩展功能方法 =========================

    /**
     * 取消目标对象的所有事件监听
     */
    public offTarget(target: any): void {
        if (!target) return;

        this._eventTarget.targetOff(target);
        this._removeTargetFromListenerMap(target);

        if (this._debug) {
            console.log(`[EventBus] Off target:`, target);
        }
    }

    /**
     * 获取事件监听器数量
     */
    public getEventListenerCount(event: string): number {
        const listeners = this._listenerMap.get(event);
        return listeners ? listeners.length : 0;
    }

    /**
     * 检查是否有事件监听器
     */
    public hasEventListener(event: string, callback?: EventListener, target?: any): boolean {
        return this._eventTarget.hasEventListener(event, callback as any, target);
    }

    /**
     * 清除所有事件监听器
     */
    public clear(): void {
        // EventTarget没有clear方法，需要手动清除所有监听器
        this._listenerMap.forEach((listeners, event) => {
            listeners.forEach(listener => {
                this._eventTarget.off(event, listener.listener, listener.target);
            });
        });
        this._listenerMap.clear();

        if (this._debug) {
            console.log('[EventBus] Cleared all listeners');
        }
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): any {
        const info = {
            totalEvents: this._listenerMap.size,
            debugMode: this._debug,
            events: {} as any
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

    // ========================= 私有辅助方法 =========================

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
    private _removeFromListenerMap(event: string, callback?: EventListener, target?: any): void {
        const listeners = this._listenerMap.get(event);
        if (!listeners) return;

        if (callback) {
            // 移除特定回调
            for (let i = listeners.length - 1; i >= 0; i--) {
                if (listeners[i].listener === callback && listeners[i].target === target) {
                    listeners.splice(i, 1);
                }
            }
        } else {
            // 移除所有匹配target的回调
            for (let i = listeners.length - 1; i >= 0; i--) {
                if (!target || listeners[i].target === target) {
                    listeners.splice(i, 1);
                }
            }
        }

        if (listeners.length === 0) {
            this._listenerMap.delete(event);
        }
    }

    /**
     * 从监听器注册表中移除指定目标的所有监听器
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