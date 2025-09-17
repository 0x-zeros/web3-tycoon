import { SuiClient, SuiEvent, SuiEventFilter, EventId } from '@mysten/sui/client';
import { EventBus } from '../events/EventBus';
import { SuiEventCursor } from './SuiEventCursor';

/**
 * 事件配置接口
 */
export interface EventConfig {
    /** 包ID */
    packageId: string;
    /** 模块名称 */
    moduleName: string;
    /** 事件类型 */
    eventType: string;
    /** 事件解析器 */
    parser?: (event: SuiEvent) => any;
    /** EventBus 事件键名 */
    eventBusKey?: string;
}

/**
 * 事件追踪器内部结构
 */
interface EventTracker {
    id: string;
    config: EventConfig;
    filter: SuiEventFilter;
}

/**
 * 索引器配置
 */
export interface IndexerConfig {
    /** 网络类型或自定义 RPC URL */
    network?: 'mainnet' | 'testnet' | 'devnet' | string;
    /** 轮询间隔（毫秒） */
    pollingInterval?: number;
    /** 批量获取事件的最大数量 */
    batchSize?: number;
    /** 是否启用调试日志 */
    debug?: boolean;
}

/**
 * 索引状态
 */
export interface IndexingStatus {
    /** 是否正在索引 */
    isIndexing: boolean;
    /** 已处理事件数量 */
    eventsProcessed: number;
    /** 最后索引时间 */
    lastIndexTime?: Date;
    /** 当前 cursor */
    currentCursor?: EventId | null;
    /** 注册的事件类型数量 */
    trackedEventTypes: number;
    /** 错误计数 */
    errorCount: number;
}

/**
 * Sui 事件索引器
 * 负责从 Sui 链上轮询事件并通过 EventBus 分发
 */
export class SuiEventIndexer {
    private static _instance: SuiEventIndexer | null = null;

    private _client: SuiClient | null = null;
    private _trackers: Map<string, EventTracker> = new Map();
    private _isIndexing: boolean = false;
    private _shouldStop: boolean = false;
    private _pollingInterval: number = 2000; // 默认2秒
    private _batchSize: number = 100; // 默认批量100个事件
    private _debug: boolean = false;
    private _cursorManager: SuiEventCursor;

    // 统计信息
    private _eventsProcessed: number = 0;
    private _lastIndexTime?: Date;
    private _errorCount: number = 0;

    /**
     * 获取单例实例
     */
    public static getInstance(): SuiEventIndexer {
        if (!this._instance) {
            this._instance = new SuiEventIndexer();
        }
        return this._instance;
    }

    private constructor() {
        this._cursorManager = new SuiEventCursor();
    }

    /**
     * 配置索引器
     */
    public configure(config: IndexerConfig): void {
        // 配置网络
        if (config.network) {
            const rpcUrl = this._getNetworkUrl(config.network);
            this._client = new SuiClient({ url: rpcUrl });

            if (this._debug) {
                console.log(`[SuiEventIndexer] 配置网络: ${rpcUrl}`);
            }
        }

        // 配置参数
        if (config.pollingInterval !== undefined) {
            this._pollingInterval = config.pollingInterval;
        }

        if (config.batchSize !== undefined) {
            this._batchSize = config.batchSize;
        }

        if (config.debug !== undefined) {
            this._debug = config.debug;
        }
    }

    /**
     * 注册事件类型
     * @returns 追踪器ID
     */
    public registerEventType(config: EventConfig): string {
        const trackerId = this._generateTrackerId(config);

        // 创建事件过滤器
        const filter: SuiEventFilter = {
            MoveEventType: `${config.packageId}::${config.moduleName}::${config.eventType}`
        };

        const tracker: EventTracker = {
            id: trackerId,
            config,
            filter
        };

        this._trackers.set(trackerId, tracker);

        if (this._debug) {
            console.log(`[SuiEventIndexer] 注册事件: ${trackerId}`);
        }

        return trackerId;
    }

    /**
     * 取消注册事件类型
     */
    public unregisterEventType(trackerId: string): void {
        if (this._trackers.delete(trackerId)) {
            if (this._debug) {
                console.log(`[SuiEventIndexer] 取消注册事件: ${trackerId}`);
            }
        }
    }

    /**
     * 开始索引
     */
    public async startIndexing(): Promise<void> {
        if (!this._client) {
            throw new Error('SuiEventIndexer 未配置，请先调用 configure()');
        }

        if (this._isIndexing) {
            console.warn('[SuiEventIndexer] 索引器已在运行');
            return;
        }

        this._isIndexing = true;
        this._shouldStop = false;

        // 加载上次的 cursor
        const savedCursor = this._cursorManager.loadCursor();

        if (this._debug) {
            console.log('[SuiEventIndexer] 开始索引', {
                cursor: savedCursor,
                trackers: this._trackers.size
            });
        }

        // 开始轮询循环
        await this._indexingLoop(savedCursor);
    }

    /**
     * 停止索引
     */
    public stopIndexing(): void {
        this._shouldStop = true;
        this._isIndexing = false;

        if (this._debug) {
            console.log('[SuiEventIndexer] 停止索引');
        }
    }

    /**
     * 设置轮询间隔
     */
    public setPollingInterval(ms: number): void {
        this._pollingInterval = Math.max(100, ms); // 最少100ms
    }

    /**
     * 获取索引状态
     */
    public getIndexingStatus(): IndexingStatus {
        return {
            isIndexing: this._isIndexing,
            eventsProcessed: this._eventsProcessed,
            lastIndexTime: this._lastIndexTime,
            currentCursor: this._cursorManager.loadCursor(),
            trackedEventTypes: this._trackers.size,
            errorCount: this._errorCount
        };
    }

    /**
     * 清除所有数据
     */
    public clear(): void {
        this.stopIndexing();
        this._trackers.clear();
        this._cursorManager.clearCursor();
        this._eventsProcessed = 0;
        this._errorCount = 0;
    }

    /**
     * 主索引循环
     */
    private async _indexingLoop(cursor: EventId | null): Promise<void> {
        let currentCursor = cursor;

        while (!this._shouldStop && this._isIndexing) {
            try {
                // 获取所有追踪器的事件
                const hasNewEvents = await this._fetchAndProcessEvents(currentCursor);

                if (hasNewEvents) {
                    // 有新事件，立即继续
                    currentCursor = this._cursorManager.loadCursor();
                } else {
                    // 没有新事件，等待一段时间
                    await this._sleep(this._pollingInterval);
                }

                this._lastIndexTime = new Date();

            } catch (error) {
                this._errorCount++;
                console.error('[SuiEventIndexer] 索引错误:', error);

                // 错误后等待更长时间
                await this._sleep(this._pollingInterval * 2);
            }
        }

        if (this._debug) {
            console.log('[SuiEventIndexer] 索引循环结束');
        }
    }

    /**
     * 获取并处理事件
     * @returns 是否有新事件
     */
    private async _fetchAndProcessEvents(cursor: EventId | null): Promise<boolean> {
        if (!this._client || this._trackers.size === 0) {
            return false;
        }

        let hasEvents = false;

        // 对每个追踪器获取事件
        for (const tracker of this._trackers.values()) {
            try {
                const events = await this._client.queryEvents({
                    query: tracker.filter,
                    cursor,
                    limit: this._batchSize,
                    order: 'ascending'
                });

                if (events.data && events.data.length > 0) {
                    hasEvents = true;

                    // 处理事件
                    for (const event of events.data) {
                        this._processEvent(event, tracker);
                    }

                    // 更新 cursor
                    if (events.nextCursor) {
                        this._cursorManager.saveCursor(events.nextCursor);
                    }

                    if (this._debug) {
                        console.log(`[SuiEventIndexer] 处理了 ${events.data.length} 个事件 (${tracker.id})`);
                    }
                }

            } catch (error) {
                console.error(`[SuiEventIndexer] 获取事件失败 (${tracker.id}):`, error);
            }
        }

        return hasEvents;
    }

    /**
     * 处理单个事件
     */
    private _processEvent(event: SuiEvent, tracker: EventTracker): void {
        try {
            // 解析事件数据
            let eventData = event;
            if (tracker.config.parser) {
                eventData = tracker.config.parser(event);
            }

            // 通过 EventBus 发送事件
            const eventBusKey = tracker.config.eventBusKey ||
                `sui_event_${tracker.config.moduleName}_${tracker.config.eventType}`;

            EventBus.emit(eventBusKey, eventData);

            this._eventsProcessed++;

            if (this._debug) {
                console.log(`[SuiEventIndexer] 发送事件: ${eventBusKey}`, eventData);
            }

        } catch (error) {
            console.error('[SuiEventIndexer] 处理事件失败:', error);
        }
    }

    /**
     * 获取网络 URL
     */
    private _getNetworkUrl(network: string): string {
        switch (network) {
            case 'mainnet':
                return 'https://fullnode.mainnet.sui.io:443';
            case 'testnet':
                return 'https://fullnode.testnet.sui.io:443';
            case 'devnet':
                return 'https://fullnode.devnet.sui.io:443';
            default:
                // 假设是自定义 RPC URL
                return network;
        }
    }

    /**
     * 生成追踪器ID
     */
    private _generateTrackerId(config: EventConfig): string {
        return `${config.packageId}_${config.moduleName}_${config.eventType}`;
    }

    /**
     * 睡眠工具函数
     */
    private _sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 导出单例
export const suiEventIndexer = SuiEventIndexer.getInstance();