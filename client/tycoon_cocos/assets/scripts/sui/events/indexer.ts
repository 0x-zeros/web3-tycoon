/**
 * 事件索引器
 * 用于监听和索引Sui链上的游戏事件
 */

import { SuiClient } from '@mysten/sui/client';
import { EventType, EventMetadata, EventFilter, GameEvent } from './types';
import { UseCardActionEvent, RollAndStepActionEvent } from './aggregated';

/**
 * 事件索引器配置
 */
export interface IndexerConfig {
    /** Sui客户端 */
    client: SuiClient;
    /** 包ID */
    packageId: string;
    /** 轮询间隔（毫秒） */
    pollInterval?: number;
    /** 批量大小 */
    batchSize?: number;
    /** 是否自动启动 */
    autoStart?: boolean;
}

/**
 * 事件回调函数
 */
export type EventCallback<T = any> = (event: EventMetadata<T>) => void | Promise<void>;

/**
 * Tycoon事件索引器
 * 负责监听和处理链上事件
 */
export class TycoonEventIndexer {
    private client: SuiClient;
    private packageId: string;
    private pollInterval: number;
    private batchSize: number;
    private isRunning: boolean = false;
    private pollTimer?: NodeJS.Timeout;
    private lastEventSeq: number = 0;
    // 跟踪最新游标，以便从上次位置继续拉取
    private lastCursor: { txDigest: string; eventSeq: string } | null = null;
    private bootstrapped: boolean = false;
    private eventHandlers: Map<EventType, EventCallback[]> = new Map();
    private globalHandlers: EventCallback[] = [];
    private emptyPolls: number = 0;

    constructor(config: IndexerConfig) {
        this.client = config.client;
        this.packageId = config.packageId;
        this.pollInterval = config.pollInterval || 3000;
        this.batchSize = config.batchSize || 100;

        if (config.autoStart) {
            this.start();
        }
    }

    /**
     * 开始监听事件
     */
    start(): void {
        if (this.isRunning) {
            console.warn('Event indexer is already running');
            return;
        }

        this.isRunning = true;
        // 先进行游标引导，确保只消费启动后的新事件
        this.bootstrap()
            .catch((e) => console.warn('Event indexer bootstrap failed (will still poll):', e))
            .finally(() => {
                this.pollEvents();
                console.log('Event indexer started');
            });
    }

    /**
     * 停止监听事件
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        console.log('Event indexer stopped');
    }

    /**
     * 订阅特定类型的事件
     */
    on<T extends GameEvent>(eventType: EventType, callback: EventCallback<T>): void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType)!.push(callback as EventCallback);
    }

    /**
     * 订阅所有事件
     */
    onAny(callback: EventCallback): void {
        this.globalHandlers.push(callback);
    }

    /**
     * 取消订阅
     */
    off(eventType: EventType, callback: EventCallback): void {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(callback);
            if (index >= 0) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * 查询历史事件
     */
    async queryEvents(filter: EventFilter): Promise<EventMetadata[]> {
        const events: EventMetadata[] = [];

        try {
            // 构建查询过滤器
            const suiFilter: any = {
                MoveModule: {
                    package: this.packageId,
                    module: 'events'
                }
            };

            // 查询事件
            const result = await this.client.queryEvents({
                query: suiFilter,
                limit: this.batchSize,
                order: 'descending'
            });

            // 处理结果
            for (const event of result.data) {
                const metadata = this.parseEvent(event);
                if (metadata && this.matchesFilter(metadata, filter)) {
                    events.push(metadata);
                }
            }
        } catch (error) {
            console.error('Failed to query events:', error);
        }

        return events;
    }

    /**
     * 获取游戏的所有事件
     */
    async getGameEvents(gameId: string): Promise<EventMetadata[]> {
        return this.queryEvents({ gameId });
    }

    /**
     * 获取玩家的所有事件
     */
    async getPlayerEvents(playerAddress: string): Promise<EventMetadata[]> {
        return this.queryEvents({ player: playerAddress });
    }

    // ===== 私有方法 =====

    /**
     * 轮询事件
     */
    private async pollEvents(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            // 查询新事件：基于游标增量拉取
            const result = await this.client.queryEvents({
                query: {
                    MoveModule: {
                        package: this.packageId,
                        module: 'events',
                    },
                },
                // 按升序返回，以便按时间顺序处理
                order: 'ascending',
                limit: this.batchSize,
                // 从上次的游标之后开始
                cursor: this.lastCursor ?? undefined,
            });

            // 处理新事件
            const count = (result.data?.length ?? 0);
            if (count > 0) {
                this.emptyPolls = 0;
                console.log(`[EventIndexer] Polled ${count} events (from cursor=${this.lastCursor ? `${this.lastCursor.txDigest}:${this.lastCursor.eventSeq}` : 'NONE'})`);
                for (const event of result.data) {
                    const metadata = this.parseEvent(event);
                    if (metadata) {
                        // 确保sequence为数字比较
                        if (Number(metadata.sequence) > Number(this.lastEventSeq)) {
                            this.lastEventSeq = Number(metadata.sequence);
                            await this.handleEvent(metadata);
                        }
                    }
                }

                // 将游标前移到本批最后一个事件
                const last = result.data[result.data.length - 1];
                this.lastCursor = last?.id ?? this.lastCursor;
            } else {
                // 偶尔打印空轮询，便于定位包ID或过滤器问题
                this.emptyPolls += 1;
                if (!this.bootstrapped || this.emptyPolls % 10 === 0) {
                    console.log('[EventIndexer] No new events. packageId=', this.packageId);
                }
            }
        } catch (error) {
            console.error('Failed to poll events:', error);
        }

        // 继续轮询
        if (this.isRunning) {
            this.pollTimer = setTimeout(() => this.pollEvents(), this.pollInterval);
        }
    }

    /**
     * 启动时引导游标至当前最新事件
     * 这样可以避免启动后重复消费历史事件
     */
    private async bootstrap(): Promise<void> {
        try {
            const res = await this.client.queryEvents({
                query: {
                    MoveModule: {
                        package: this.packageId,
                        module: 'events',
                    },
                },
                order: 'descending',
                limit: 1,
            });

            if (res.data && res.data.length > 0) {
                const latest = res.data[0];
                // 将游标设置为最新事件，后续按升序只消费其后的新事件
                this.lastCursor = latest.id;
                this.lastEventSeq = Number(latest.id?.eventSeq ?? 0);
            }
            this.bootstrapped = true;
            console.log('[EventIndexer] Bootstrap complete. lastCursor:', this.lastCursor);
        } catch (e) {
            // 失败不影响后续轮询，只是会从历史开始消费
            console.warn('[EventIndexer] Bootstrap failed:', e);
        }
    }

    /**
     * 解析事件
     */
    private parseEvent(event: any): EventMetadata | null {
        try {
            const typeName = event.type.split('::').pop();
            const eventType = this.getEventType(typeName);

            if (!eventType) {
                return null;
            }

            const data = this.normalizeEventData(event.parsedJson);

            return {
                type: eventType,
                data,
                timestamp: Number(event.timestampMs || Date.now()),
                sequence: Number(event.id?.eventSeq ?? 0),
                txHash: event.id.txDigest || '',
                blockHeight: 0 // TODO: 从event中获取
            };
        } catch (error) {
            console.error('Failed to parse event:', error);
            return null;
        }
    }

    /**
     * 规整事件数据字段，避免 ID 对象/字符串不一致导致匹配失败
     */
    private normalizeEventData(raw: any): any {
        try {
            const data: any = { ...raw };
            // 将 game 字段统一为字符串
            if (data && data.game && typeof data.game === 'object') {
                if (typeof data.game.id === 'string') {
                    data.game = data.game.id;
                } else if (typeof data.game.bytes === 'string') {
                    data.game = data.game.bytes; // 某些节点表示为 bytes
                }
            }
            // 将 player 字段统一为字符串（address 一般已是字符串）
            if (data && data.player && typeof data.player === 'object') {
                if (typeof data.player.id === 'string') {
                    data.player = data.player.id;
                } else if (typeof data.player.bytes === 'string') {
                    data.player = data.player.bytes;
                }
            }
            return data;
        } catch (_) {
            return raw;
        }
    }

    /**
     * 获取事件类型
     */
    private getEventType(typeName: string): EventType | null {
        const typeMap: { [key: string]: EventType } = {
            'GameCreatedEvent': EventType.GAME_CREATED,
            'PlayerJoinedEvent': EventType.PLAYER_JOINED,
            'GameStartedEvent': EventType.GAME_STARTED,
            'GameEndedEvent': EventType.GAME_ENDED,
            'TurnStartEvent': EventType.TURN_START,
            'SkipTurnEvent': EventType.SKIP_TURN,
            'EndTurnEvent': EventType.END_TURN,
            'RoundEndedEvent': EventType.ROUND_ENDED,
            'BankruptEvent': EventType.BANKRUPT,
            'UseCardActionEvent': EventType.USE_CARD_ACTION,
            'RollAndStepActionEvent': EventType.ROLL_AND_STEP_ACTION
        };

        return typeMap[typeName] || null;
    }

    /**
     * 处理事件
     */
    private async handleEvent(metadata: EventMetadata): Promise<void> {
        // 调用特定类型的处理器
        const handlers = this.eventHandlers.get(metadata.type) || [];
        for (const handler of handlers) {
            try {
                await handler(metadata);
            } catch (error) {
                console.error(`Error handling event ${metadata.type}:`, error);
            }
        }

        // 调用全局处理器
        for (const handler of this.globalHandlers) {
            try {
                await handler(metadata);
            } catch (error) {
                console.error('Error in global event handler:', error);
            }
        }
    }

    /**
     * 检查事件是否匹配过滤器
     */
    private matchesFilter(metadata: EventMetadata, filter: EventFilter): boolean {
        if (filter.types && !filter.types.includes(metadata.type)) {
            return false;
        }

        if (filter.gameId) {
            const gameId = (metadata.data as any).game;
            if (gameId !== filter.gameId) {
                return false;
            }
        }

        if (filter.player) {
            const player = (metadata.data as any).player;
            if (player !== filter.player) {
                return false;
            }
        }

        if (filter.fromTimestamp && metadata.timestamp < filter.fromTimestamp) {
            return false;
        }

        if (filter.toTimestamp && metadata.timestamp > filter.toTimestamp) {
            return false;
        }

        return true;
    }
}

/**
 * 创建默认索引器实例
 */
export function createEventIndexer(config: {
    network: string;
    packageId: string;
    autoStart?: boolean;
}): TycoonEventIndexer {
    const rpcUrl = typeof config.network === 'string' && config.network.startsWith('http')
        ? config.network
        : `https://fullnode.${config.network}.sui.io`;

    const client = new SuiClient({ url: rpcUrl });

    return new TycoonEventIndexer({
        client,
        packageId: config.packageId,
        autoStart: config.autoStart
    });
}
