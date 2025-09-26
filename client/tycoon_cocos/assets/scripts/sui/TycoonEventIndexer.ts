/**
 * Tycoon游戏事件索引器
 * 专门用于索引和解析Tycoon游戏的链上事件
 */

import { SuiClient, SuiEvent, EventId } from '@mysten/sui/client';
import { suiEventIndexer } from './SuiEventIndexer';
import { EventBus } from '../events/EventBus';
import {
    TycoonEventType,
    GameCreatedEvent,
    PlayerJoinedEvent,
    GameStartedEvent,
    GameEndedEvent,
    RoundEndedEvent,
    BankruptEvent,
    RollAndStepActionEvent,
    UseCardActionEvent,
    TurnStartEvent,
    EndTurnEvent,
    SkipTurnEvent,
    SuiTycoonEvent,
    TycoonEventFilter
} from './TycoonEventTypes';

/**
 * 索引器配置
 */
export interface TycoonIndexerConfig {
    /** 游戏包ID */
    packageId: string;
    /** 网络类型 */
    network?: 'mainnet' | 'testnet' | 'devnet' | string;
    /** 是否启用调试 */
    debug?: boolean;
    /** 轮询间隔（毫秒） */
    pollingInterval?: number;
}

/**
 * 事件解析器类型
 */
type EventParser<T> = (event: SuiEvent) => T;

/**
 * Tycoon事件索引器
 * 负责注册、解析和分发游戏事件
 */
export class TycoonEventIndexer {
    private static _instance: TycoonEventIndexer | null = null;

    private _packageId: string = '';
    private _debug: boolean = false;
    private _isInitialized: boolean = false;
    private _trackerIds: Map<TycoonEventType, string> = new Map();
    private _eventFilters: Set<TycoonEventFilter> = new Set();

    // 事件统计
    private _eventStats: Map<TycoonEventType, number> = new Map();

    /**
     * 获取单例实例
     */
    public static getInstance(): TycoonEventIndexer {
        if (!this._instance) {
            this._instance = new TycoonEventIndexer();
        }
        return this._instance;
    }

    private constructor() {}

    /**
     * 初始化索引器
     */
    public initialize(config: TycoonIndexerConfig): void {
        if (this._isInitialized) {
            console.warn('[TycoonEventIndexer] 索引器已初始化');
            return;
        }

        this._packageId = config.packageId;
        this._debug = config.debug || false;

        // 配置基础索引器
        suiEventIndexer.configure({
            network: config.network,
            pollingInterval: config.pollingInterval || 2000,
            batchSize: 100,
            debug: this._debug
        });

        // 注册所有游戏事件
        this._registerAllEvents();

        this._isInitialized = true;

        if (this._debug) {
            console.log('[TycoonEventIndexer] 初始化完成', {
                packageId: this._packageId,
                eventCount: this._trackerIds.size
            });
        }
    }

    /**
     * 开始索引
     */
    public async startIndexing(): Promise<void> {
        if (!this._isInitialized) {
            throw new Error('TycoonEventIndexer 未初始化，请先调用 initialize()');
        }

        await suiEventIndexer.startIndexing();

        if (this._debug) {
            console.log('[TycoonEventIndexer] 开始索引游戏事件');
        }
    }

    /**
     * 停止索引
     */
    public stopIndexing(): void {
        suiEventIndexer.stopIndexing();

        if (this._debug) {
            console.log('[TycoonEventIndexer] 停止索引，事件统计:',
                       Object.fromEntries(this._eventStats));
        }
    }

    /**
     * 添加事件过滤器
     */
    public addEventFilter(filter: TycoonEventFilter): void {
        this._eventFilters.add(filter);
    }

    /**
     * 移除事件过滤器
     */
    public removeEventFilter(filter: TycoonEventFilter): void {
        this._eventFilters.delete(filter);
    }

    /**
     * 获取事件统计
     */
    public getEventStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        this._eventStats.forEach((count, type) => {
            stats[type] = count;
        });
        return stats;
    }

    /**
     * 重置统计
     */
    public resetStats(): void {
        this._eventStats.clear();
    }

    /**
     * 注册所有游戏事件
     */
    private _registerAllEvents(): void {
        // 基础事件
        this._registerEvent(TycoonEventType.GameCreated, this._parseGameCreatedEvent);
        this._registerEvent(TycoonEventType.PlayerJoined, this._parsePlayerJoinedEvent);
        this._registerEvent(TycoonEventType.GameStarted, this._parseGameStartedEvent);
        this._registerEvent(TycoonEventType.GameEnded, this._parseGameEndedEvent);
        this._registerEvent(TycoonEventType.RoundEnded, this._parseRoundEndedEvent);
        this._registerEvent(TycoonEventType.TurnStart, this._parseTurnStartEvent);
        this._registerEvent(TycoonEventType.SkipTurn, this._parseSkipTurnEvent);
        this._registerEvent(TycoonEventType.EndTurn, this._parseEndTurnEvent);
        this._registerEvent(TycoonEventType.Bankrupt, this._parseBankruptEvent);

        // 聚合事件
        this._registerEvent(TycoonEventType.RollAndStepAction, this._parseRollAndStepActionEvent);
        this._registerEvent(TycoonEventType.UseCardAction, this._parseUseCardActionEvent);
    }

    /**
     * 注册单个事件
     */
    private _registerEvent<T>(
        eventType: TycoonEventType,
        parser: EventParser<T>
    ): void {
        // 注册到基础索引器
        const trackerId = suiEventIndexer.registerEventType({
            packageId: this._packageId,
            moduleName: 'events',  // Move模块名
            eventType: eventType,
            parser: (event) => this._handleEvent(eventType, event, parser),
            eventBusKey: `tycoon:${eventType}`
        });

        this._trackerIds.set(eventType, trackerId);

        // 监听EventBus事件
        EventBus.on(`tycoon:${eventType}`, (data: T) => {
            this._distributeEvent(eventType, data);
        });
    }

    /**
     * 处理事件
     */
    private _handleEvent<T>(
        eventType: TycoonEventType,
        event: SuiEvent,
        parser: EventParser<T>
    ): T {
        // 解析事件数据
        const parsedData = parser(event);

        // 更新统计
        const currentCount = this._eventStats.get(eventType) || 0;
        this._eventStats.set(eventType, currentCount + 1);

        if (this._debug) {
            console.log(`[TycoonEventIndexer] 解析事件 ${eventType}:`, parsedData);
        }

        return parsedData;
    }

    /**
     * 分发事件
     */
    private _distributeEvent<T>(eventType: TycoonEventType, data: T): void {
        // 应用过滤器
        const eventData = data as any;
        let shouldDistribute = true;

        for (const filter of this._eventFilters) {
            if (filter.gameId && eventData.game !== filter.gameId) {
                shouldDistribute = false;
                break;
            }
            if (filter.player && eventData.player !== filter.player) {
                shouldDistribute = false;
                break;
            }
            if (filter.eventTypes && !filter.eventTypes.includes(eventType)) {
                shouldDistribute = false;
                break;
            }
        }

        if (shouldDistribute) {
            // 包装事件
            const wrappedEvent: SuiTycoonEvent<T> = {
                type: eventType,
                data: data,
                timestamp: Date.now()
            };

            // 发送到特定的游戏事件总线
            EventBus.emit('tycoon:event', wrappedEvent);
            EventBus.emit(`tycoon:event:${eventType}`, data);
        }
    }

    // ===== 事件解析器 =====

    private _parseGameCreatedEvent(event: SuiEvent): GameCreatedEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            creator: fields.creator,
            template_id: Number(fields.template_id),  // u16: 转换为 number
            max_players: Number(fields.max_players),
            created_at_ms: BigInt(fields.created_at_ms)
        };
    }

    private _parsePlayerJoinedEvent(event: SuiEvent): PlayerJoinedEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            player_index: Number(fields.player_index)
        };
    }

    private _parseGameStartedEvent(event: SuiEvent): GameStartedEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player_count: Number(fields.player_count),
            starting_player: fields.starting_player
        };
    }

    private _parseGameEndedEvent(event: SuiEvent): GameEndedEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            winner: fields.winner || undefined,
            turn: BigInt(fields.turn),
            reason: Number(fields.reason)
        };
    }

    private _parseRoundEndedEvent(event: SuiEvent): RoundEndedEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            round: Number(fields.round),
            npc_kind: Number(fields.npc_kind),
            tile_id: Number(fields.tile_id)
        };
    }

    private _parseTurnStartEvent(event: SuiEvent): TurnStartEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            turn: BigInt(fields.turn)
        };
    }

    private _parseSkipTurnEvent(event: SuiEvent): SkipTurnEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            reason: Number(fields.reason)
        };
    }

    private _parseEndTurnEvent(event: SuiEvent): EndTurnEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            turn: BigInt(fields.turn)
        };
    }

    private _parseBankruptEvent(event: SuiEvent): BankruptEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            debt: BigInt(fields.debt),
            creditor: fields.creditor || undefined
        };
    }

    private _parseRollAndStepActionEvent(event: SuiEvent): RollAndStepActionEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            turn: BigInt(fields.turn),
            dice: Number(fields.dice),
            dir: Number(fields.dir),
            from: BigInt(fields.from),
            steps: fields.steps.map((step: any) => ({
                step_index: Number(step.step_index),
                from_tile: BigInt(step.from_tile),
                to_tile: BigInt(step.to_tile),
                remaining_steps: Number(step.remaining_steps),
                pass_draws: step.pass_draws.map((draw: any) => ({
                    tile_id: BigInt(draw.tile_id),
                    kind: Number(draw.kind),
                    count: BigInt(draw.count),
                    is_pass: Boolean(draw.is_pass)
                })),
                npc_event: step.npc_event ? {
                    tile_id: BigInt(step.npc_event.tile_id),
                    kind: Number(step.npc_event.kind),
                    result: Number(step.npc_event.result),
                    consumed: Boolean(step.npc_event.consumed),
                    result_tile: step.npc_event.result_tile ?
                        BigInt(step.npc_event.result_tile) : undefined
                } : undefined,
                stop_effect: step.stop_effect ? {
                    tile_id: BigInt(step.stop_effect.tile_id),
                    tile_kind: Number(step.stop_effect.tile_kind),
                    stop_type: Number(step.stop_effect.stop_type),
                    amount: BigInt(step.stop_effect.amount),
                    owner: step.stop_effect.owner || undefined,
                    level: step.stop_effect.level !== undefined ?
                        Number(step.stop_effect.level) : undefined,
                    turns: step.stop_effect.turns !== undefined ?
                        Number(step.stop_effect.turns) : undefined,
                    card_gains: step.stop_effect.card_gains.map((gain: any) => ({
                        tile_id: BigInt(gain.tile_id),
                        kind: Number(gain.kind),
                        count: BigInt(gain.count),
                        is_pass: Boolean(gain.is_pass)
                    }))
                } : undefined
            })),
            cash_changes: fields.cash_changes.map((change: any) => ({
                player: change.player,
                is_debit: Boolean(change.is_debit),
                amount: BigInt(change.amount),
                reason: Number(change.reason),
                details: BigInt(change.details)
            })),
            end_pos: BigInt(fields.end_pos)
        };
    }

    private _parseUseCardActionEvent(event: SuiEvent): UseCardActionEvent {
        const fields = event.parsedJson as any;
        return {
            game: fields.game,
            player: fields.player,
            turn: BigInt(fields.turn),
            kind: Number(fields.kind),
            target_addr: fields.target_addr || undefined,
            target_tile: fields.target_tile ? BigInt(fields.target_tile) : undefined,
            npc_changes: fields.npc_changes.map((change: any) => ({
                tile_id: BigInt(change.tile_id),
                kind: Number(change.kind),
                action: Number(change.action),
                consumed: Boolean(change.consumed)
            })),
            buff_changes: fields.buff_changes.map((change: any) => ({
                buff_type: Number(change.buff_type),
                target: change.target,
                first_inactive_turn: change.first_inactive_turn ?
                    BigInt(change.first_inactive_turn) : undefined
            })),
            cash_changes: fields.cash_changes.map((change: any) => ({
                player: change.player,
                is_debit: Boolean(change.is_debit),
                amount: BigInt(change.amount),
                reason: Number(change.reason),
                details: BigInt(change.details)
            }))
        };
    }
}

// 导出单例
export const tycoonEventIndexer = TycoonEventIndexer.getInstance();