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
    private eventHandlers: Map<EventType, EventCallback[]> = new Map();
    private globalHandlers: EventCallback[] = [];

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
        this.pollEvents();
        console.log('Event indexer started');
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
            // 查询新事件
            const result = await this.client.queryEvents({
                query: {
                    MoveModule: {
                        package: this.packageId,
                        module: 'events'
                    }
                },
                limit: this.batchSize,
                order: 'ascending'
            });

            // 处理新事件
            for (const event of result.data) {
                const metadata = this.parseEvent(event);
                if (metadata && metadata.sequence > this.lastEventSeq) {
                    this.lastEventSeq = metadata.sequence;
                    await this.handleEvent(metadata);
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
     * 解析事件
     */
    private parseEvent(event: any): EventMetadata | null {
        try {
            const typeName = event.type.split('::').pop();
            const eventType = this.getEventType(typeName);

            if (!eventType) {
                return null;
            }

            return {
                type: eventType,
                data: event.parsedJson,
                timestamp: event.timestampMs || Date.now(),
                sequence: event.id.eventSeq || 0,
                txHash: event.id.txDigest || '',
                blockHeight: 0 // TODO: 从event中获取
            };
        } catch (error) {
            console.error('Failed to parse event:', error);
            return null;
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