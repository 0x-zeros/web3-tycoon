/**
 * 事件索引器
 * 用于监听和索引Sui链上的游戏事件
 */

// 使用 import type 避免打包（SuiClient 由调用者提供）
import type { SuiClient } from '@mysten/sui/client';
import { EventType, EventMetadata, GameEvent } from './types';
import { loadSuiClient } from '../loader';
import { RpcConfigManager } from '../config/RpcConfigManager';
import { EventLogService } from '../../ui/game/event-log/EventLogService';

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
        'SkipTurnEvent': EventType.SKIP_TURN,
        'RoundEndedEvent': EventType.ROUND_ENDED,
        'BankruptEvent': EventType.BANKRUPT,
        'BuildingDecisionEvent': EventType.BUILDING_DECISION,
        'RentDecisionEvent': EventType.RENT_DECISION,
        'CardShopDecisionEvent': EventType.CARD_SHOP_DECISION,
        'DecisionSkippedEvent': EventType.DECISION_SKIPPED,
        'UseCardActionEvent': EventType.USE_CARD_ACTION,
        'RollAndStepActionEvent': EventType.ROLL_AND_STEP_ACTION,
        'TeleportActionEvent': EventType.TELEPORT_ACTION,
    };

    // 每个事件类型单独维护游标（MoveEventType 过滤下必须分开维护）
    private perTypeCursor: Map<string, { txDigest: string; eventSeq: string } | null> = new Map();
    private bootstrapped: boolean = false;
    private eventHandlers: Map<EventType, EventCallback[]> = new Map();
    private globalHandlers: EventCallback[] = [];

    // 当前游戏 ID（用于测试链上过滤）
    private currentGameId: string | null = null;

    // 需要按 game ID 过滤的事件类型
    private readonly gameFlowEventTypes: string[] = [
        'RollAndStepActionEvent',
        'TeleportActionEvent',
        'BuildingDecisionEvent',
        'RentDecisionEvent',
        'DecisionSkippedEvent',
        'SkipTurnEvent',
        'BankruptEvent',
        'GameEndedEvent',
    ];

    // 测试：链上过滤统计
    private filterTestStats = {
        enabled: false,  // 是否启用测试
        totalQueries: 0,
        originalCount: 0,
        filteredCount: 0,
        matchedCount: 0,
        mismatchedCount: 0
    };
    

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

    /**
     * 设置当前游戏 ID（用于链上过滤测试）
     */
    public setCurrentGameId(gameId: string | null): void {
        this.currentGameId = gameId;
        console.log('[EventIndexer] Test: Current game ID set:', gameId);
    }

    /**
     * 启用/禁用链上过滤测试
     */
    public enableFilterTest(enabled: boolean): void {
        this.filterTestStats.enabled = enabled;
        console.log('[EventIndexer] Test: Filter test', enabled ? 'enabled' : 'disabled');

        if (enabled) {
            // 重置统计
            this.filterTestStats = {
                enabled: true,
                totalQueries: 0,
                originalCount: 0,
                filteredCount: 0,
                matchedCount: 0,
                mismatchedCount: 0
            };
        }
    }

    /**
     * 获取链上过滤测试统计
     */
    public getFilterTestStats() {
        return { ...this.filterTestStats };
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
                    // ✅ 新增：并行测试链上过滤（不影响现有逻辑）
                    if (this.filterTestStats.enabled &&
                        this.currentGameId &&
                        this.gameFlowEventTypes.includes(typeName)) {
                        await this.testChainFilter(typeName, fullType, result.data, cursor);
                    }

                    // ✅ 现有处理逻辑（保持不变）
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

        // 继续轮询（每次读取最新配置的间隔时间）
        if (this.isRunning) {
            const interval = RpcConfigManager.getEventIndexerInterval();
            this.pollTimer = setTimeout(() => this.pollEvents(), interval);
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
     * 展开嵌套的 fields 结构
     */
    private normalizeEventData(raw: any): any {
        try {
            const data: any = { ...raw };

            // 将 game 字段统一为字符串
            if (data && data.game && typeof data.game === 'object') {
                if (typeof data.game.id === 'string') {
                    data.game = data.game.id;
                } else if (typeof data.game.bytes === 'string') {
                    data.game = data.game.bytes;
                }
            }

            // 将 player 字段统一为字符串
            if (data && data.player && typeof data.player === 'object') {
                if (typeof data.player.id === 'string') {
                    data.player = data.player.id;
                } else if (typeof data.player.bytes === 'string') {
                    data.player = data.player.bytes;
                }
            }

            // 递归展开 steps 中的 stop_effect.fields
            if (data.steps && Array.isArray(data.steps)) {
                data.steps = data.steps.map((step: any) => {
                    const normalizedStep = { ...step };

                    // 展开 stop_effect.fields
                    if (normalizedStep.stop_effect && typeof normalizedStep.stop_effect === 'object') {
                        if (normalizedStep.stop_effect.fields) {
                            normalizedStep.stop_effect = { ...normalizedStep.stop_effect.fields };
                        }

                        // 递归展开 building_decision.fields
                        if (normalizedStep.stop_effect.building_decision &&
                            typeof normalizedStep.stop_effect.building_decision === 'object' &&
                            normalizedStep.stop_effect.building_decision.fields) {
                            normalizedStep.stop_effect.building_decision = {
                                ...normalizedStep.stop_effect.building_decision.fields
                            };
                        }

                        // 递归展开 rent_decision.fields
                        if (normalizedStep.stop_effect.rent_decision &&
                            typeof normalizedStep.stop_effect.rent_decision === 'object' &&
                            normalizedStep.stop_effect.rent_decision.fields) {
                            normalizedStep.stop_effect.rent_decision = {
                                ...normalizedStep.stop_effect.rent_decision.fields
                            };
                        }

                        // 递归展开 npc_buff.fields
                        if (normalizedStep.stop_effect.npc_buff &&
                            typeof normalizedStep.stop_effect.npc_buff === 'object' &&
                            normalizedStep.stop_effect.npc_buff.fields) {
                            normalizedStep.stop_effect.npc_buff = {
                                ...normalizedStep.stop_effect.npc_buff.fields
                            };
                        }
                    }

                    // 展开 npc_event.fields
                    if (normalizedStep.npc_event && typeof normalizedStep.npc_event === 'object') {
                        if (normalizedStep.npc_event.fields) {
                            normalizedStep.npc_event = { ...normalizedStep.npc_event.fields };
                        }
                    }

                    return normalizedStep;
                });
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
        // 记录到事件日志服务（如果session已设置）
        try {
            EventLogService.getInstance().addEvent(metadata);
        } catch (e) {
            // 忽略日志记录错误，不影响主流程
        }

        // 调用特定类型的处理器
        const handlers = this.eventHandlers.get(metadata.type) || [];

        // ✅ 没有注册的事件类型，输出 warn
        if (handlers.length === 0) {
            console.warn(`[EventIndexer] No handler registered for event type: ${metadata.type}`);
            return;
        }

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
     * 测试链上过滤效果（并行查询，不影响现有逻辑）
     */
    private async testChainFilter(
        typeName: string,
        fullType: string,
        originalEvents: any[],
        cursor: any
    ): Promise<void> {
        try {
            this.filterTestStats.totalQueries++;
            this.filterTestStats.originalCount += originalEvents.length;

            console.log(`\n========== [FilterTest] ${typeName} ==========`);
            console.log(`[FilterTest] Original query returned: ${originalEvents.length} events`);
            console.log(`[FilterTest] Current game ID: ${this.currentGameId}`);

            // 方案 A: 尝试使用 MoveEventField 过滤
            let filteredEvents: any[] = [];
            let filterMethod = '';

            try {
                // 尝试 MoveEventField 单独过滤
                const result = await this.client.queryEvents({
                    query: {
                        MoveEventField: {
                            path: "/game",
                            value: this.currentGameId!
                        }
                    },
                    order: 'ascending',
                    limit: this.batchSize,
                    cursor,
                });

                filteredEvents = result.data || [];
                filterMethod = 'MoveEventField';
                console.log(`[FilterTest] ✅ MoveEventField query succeeded: ${filteredEvents.length} events`);

            } catch (error: any) {
                console.log(`[FilterTest] ❌ MoveEventField query failed:`, error.message);

                // 方案 B: 如果 MoveEventField 不支持，用客户端过滤模拟
                filteredEvents = originalEvents.filter(ev => {
                    const gameId = ev.parsedJson?.game;
                    return gameId === this.currentGameId;
                });
                filterMethod = 'Client-side filter';
                console.log(`[FilterTest] Using client-side filter: ${filteredEvents.length} events`);
            }

            this.filterTestStats.filteredCount += filteredEvents.length;

            // 对比分析
            console.log(`[FilterTest] Method: ${filterMethod}`);
            if (originalEvents.length > 0) {
                const reduction = ((1 - filteredEvents.length / originalEvents.length) * 100).toFixed(1);
                console.log(`[FilterTest] Reduction: ${originalEvents.length} -> ${filteredEvents.length} (${reduction}% filtered out)`);
            }

            // 详细对比
            const originalGameIds = new Set(
                originalEvents
                    .map(ev => ev.parsedJson?.game)
                    .filter(id => id)
            );

            const filteredGameIds = new Set(
                filteredEvents
                    .map(ev => ev.parsedJson?.game)
                    .filter(id => id)
            );

            console.log(`[FilterTest] Original events cover ${originalGameIds.size} game(s):`, Array.from(originalGameIds));
            console.log(`[FilterTest] Filtered events cover ${filteredGameIds.size} game(s):`, Array.from(filteredGameIds));

            // 检查是否有遗漏或多余
            const shouldInclude = originalEvents.filter(ev => ev.parsedJson?.game === this.currentGameId);
            const shouldExclude = originalEvents.filter(ev => ev.parsedJson?.game !== this.currentGameId);

            console.log(`[FilterTest] Should include: ${shouldInclude.length} events (game=${this.currentGameId})`);
            console.log(`[FilterTest] Should exclude: ${shouldExclude.length} events (other games)`);

            // 统计匹配/不匹配
            this.filterTestStats.matchedCount += shouldInclude.length;
            this.filterTestStats.mismatchedCount += shouldExclude.length;

            // 验证结果
            if (filteredEvents.length === shouldInclude.length) {
                console.log(`[FilterTest] ✅ Result verified: Filter is working correctly`);
            } else {
                console.warn(`[FilterTest] ⚠️ Result mismatch: Expected ${shouldInclude.length}, got ${filteredEvents.length}`);
            }

            console.log(`========== [FilterTest] End ==========\n`);

        } catch (error) {
            console.error(`[FilterTest] Test failed for ${typeName}:`, error);
        }
    }

    /**
     * 打印链上过滤测试总结
     */
    public printFilterTestSummary(): void {
        if (!this.filterTestStats.enabled) {
            console.log('[FilterTest] Test is not enabled');
            return;
        }

        const stats = this.filterTestStats;
        const reductionRate = stats.originalCount > 0
            ? ((1 - stats.filteredCount / stats.originalCount) * 100).toFixed(1)
            : '0';

        console.log('\n========== [FilterTest] Summary ==========');
        console.log(`Total queries: ${stats.totalQueries}`);
        console.log(`Original events: ${stats.originalCount}`);
        console.log(`Filtered events: ${stats.filteredCount}`);
        console.log(`Reduction rate: ${reductionRate}%`);
        console.log(`Events matched (current game): ${stats.matchedCount}`);
        console.log(`Events filtered out (other games): ${stats.mismatchedCount}`);
        console.log('==========================================\n');
    }


}

/**
 * 创建默认索引器实例
 */
export async function createEventIndexer(config: {
    network: string;
    packageId: string;
    autoStart?: boolean;
}): Promise<TycoonEventIndexer> {
    const rpcUrl = typeof config.network === 'string' && config.network.startsWith('http')
        ? config.network
        : `https://fullnode.${config.network}.sui.io`;

    // 动态加载并创建 SuiClient
    const { SuiClient } = await loadSuiClient();
    const client = new SuiClient({ url: rpcUrl });

    return new TycoonEventIndexer({
        client,
        packageId: config.packageId,
        autoStart: config.autoStart
    });
}
