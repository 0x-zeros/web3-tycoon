/**
 * 事件索引器
 * 用于监听和索引Sui链上的游戏事件
 */

import { SuiClient } from '@mysten/sui/client';
import { EventType, EventMetadata, GameEvent } from './types';

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
    private pollTimer?: ReturnType<typeof setTimeout>;
    // 事件类型映射与监听列表
    private readonly typeMap: { [key: string]: EventType } = {
        'GameCreatedEvent': EventType.GAME_CREATED,
        'PlayerJoinedEvent': EventType.PLAYER_JOINED,
        'GameStartedEvent': EventType.GAME_STARTED,
        'GameEndedEvent': EventType.GAME_ENDED,
        'MapTemplatePublishedEvent': EventType.MAP_TEMPLATE_PUBLISHED,
        'TurnStartEvent': EventType.TURN_START,
        'SkipTurnEvent': EventType.SKIP_TURN,
        'EndTurnEvent': EventType.END_TURN,
        'RoundEndedEvent': EventType.ROUND_ENDED,
        'BankruptEvent': EventType.BANKRUPT,
        'UseCardActionEvent': EventType.USE_CARD_ACTION,
        'RollAndStepActionEvent': EventType.ROLL_AND_STEP_ACTION,
    };

    // 每个事件类型单独维护游标（MoveEventType 过滤下必须分开维护）
    private perTypeCursor: Map<string, { txDigest: string; eventSeq: string } | null> = new Map();
    private bootstrapped: boolean = false;
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
        if (this.isRunning) return;

        this.isRunning = true;
        // 先进行游标引导，确保只消费启动后的新事件
        this.bootstrap().finally(() => {
            this.pollEvents();
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
        
    }

    /**
     * 订阅特定类型的事件
     * 泛型 T 为具体的事件类型（如 GameCreatedEvent, RollAndStepActionEvent 等）
     */
    on<T = any>(eventType: EventType, callback: EventCallback<T>): void {
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

    // ===== 私有方法 =====

    /**
     * 轮询事件
     */
    private async pollEvents(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            // 使用 MoveEventType 分类型查询，规避 MoveModule 兼容性问题
            const typeNames = this.getAllTypeNames();
            for (const typeName of typeNames) {
                const cursor = this.perTypeCursor.get(typeName) ?? undefined;
                const fullType = `${this.packageId}::events::${typeName}`;
                const result = await this.client.queryEvents({
                    query: { MoveEventType: fullType },
                    order: 'ascending',
                    limit: this.batchSize,
                    cursor,
                });

                const count = (result.data?.length ?? 0);
                if (count > 0) {
                    for (const ev of result.data) {
                        const metadata = this.parseEvent(ev);
                        if (metadata) {
                            await this.handleEvent(metadata);
                        }
                    }
                    const last = result.data[result.data.length - 1];
                    this.perTypeCursor.set(typeName, last?.id ?? cursor ?? null);
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
     */
    private async bootstrap(): Promise<void> {
        try {
            // 对每个事件类型分别设置到最新游标，避免回放历史
            const typeNames = this.getAllTypeNames();
            for (const typeName of typeNames) {
                const fullType = `${this.packageId}::events::${typeName}`;
                const res = await this.client.queryEvents({
                    query: { MoveEventType: fullType },
                    order: 'descending',
                    limit: 1,
                });
                if (res.data && res.data.length > 0) {
                    const latest = res.data[0];
                    this.perTypeCursor.set(typeName, latest.id);
                } else {
                    this.perTypeCursor.set(typeName, null);
                }
            }
            this.bootstrapped = true;
        } catch (e) {
            // 失败不影响后续轮询，只是会从历史开始消费
            // 静默失败
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
        return this.typeMap[typeName] || null;
    }

    private getAllTypeNames(): string[] {
        return Object.keys(this.typeMap);
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
