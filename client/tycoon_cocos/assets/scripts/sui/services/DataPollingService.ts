/**
 * 数据轮询服务
 * 定时获取链上数据并通过 Blackboard 通知 UI
 *
 * 类似于事件监听器，但用于主动轮询数据
 */

import { Blackboard } from '../../events/Blackboard';

/**
 * 轮询任务配置
 */
export interface PollingTask {
    /** 任务标识 */
    key: string;
    /** 数据获取函数 */
    fetcher: () => Promise<any>;
    /** 轮询间隔（毫秒） */
    interval: number;
    /** Blackboard 键名（可选，用于自动更新 UI） */
    blackboardKey?: string;
    /** 错误回调（可选） */
    onError?: (error: any) => void;
}

/**
 * 数据轮询服务类
 */
export class DataPollingService {
    private _timers: Map<string, any> = new Map();
    private _running: boolean = false;

    /**
     * 注册轮询任务
     * @param task 轮询任务配置
     */
    public register(task: PollingTask): void {
        console.log(`[DataPolling] Registering task: ${task.key}, interval: ${task.interval}ms`);

        // 停止已有的定时器
        this.unregister(task.key);

        // 启动新定时器
        const timer = setInterval(async () => {
            if (!this._running) return;

            try {
                const data = await task.fetcher();

                // 更新到 Blackboard
                if (task.blackboardKey) {
                    Blackboard.instance.set(task.blackboardKey, data, true);
                }

            } catch (error) {
                console.error(`[DataPolling] Error in task ${task.key}:`, error);

                // 调用错误回调
                if (task.onError) {
                    task.onError(error);
                }
            }
        }, task.interval);

        this._timers.set(task.key, timer);
        console.log(`[DataPolling] Task registered: ${task.key}`);
    }

    /**
     * 便捷注册方法
     */
    public registerSimple(
        key: string,
        fetcher: () => Promise<any>,
        interval: number,
        blackboardKey?: string
    ): void {
        this.register({ key, fetcher, interval, blackboardKey });
    }

    /**
     * 取消注册轮询任务
     * @param key 任务标识
     */
    public unregister(key: string): void {
        const timer = this._timers.get(key);
        if (timer) {
            clearInterval(timer);
            this._timers.delete(key);
            console.log(`[DataPolling] Task unregistered: ${key}`);
        }
    }

    /**
     * 启动所有轮询
     */
    public start(): void {
        if (this._running) {
            console.warn('[DataPolling] Already running');
            return;
        }

        this._running = true;
        console.log(`[DataPolling] Started (${this._timers.size} tasks)`);
    }

    /**
     * 停止所有轮询
     */
    public stop(): void {
        if (!this._running) return;

        this._running = false;
        console.log('[DataPolling] Stopped');
    }

    /**
     * 停止并清除所有轮询任务
     */
    public clear(): void {
        this._running = false;
        this._timers.forEach(timer => clearInterval(timer));
        this._timers.clear();
        console.log('[DataPolling] Cleared all tasks');
    }

    /**
     * 获取运行状态
     */
    public get isRunning(): boolean {
        return this._running;
    }

    /**
     * 获取任务数量
     */
    public get taskCount(): number {
        return this._timers.size;
    }
}
