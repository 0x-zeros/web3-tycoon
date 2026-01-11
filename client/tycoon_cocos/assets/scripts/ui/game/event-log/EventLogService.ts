/**
 * EventLogService - 事件日志收集服务
 *
 * 收集、存储和过滤游戏事件日志
 * 使用lazy格式化模式：存储原始事件，用到时再格式化
 * 单例模式，供EventIndexer和UI组件使用
 *
 * @author Web3 Tycoon Team
 */

import { EventMetadata, EventType } from '../../../sui/events/types';
import { EventLogFormatter, FormattedLog } from './EventLogFormatter';
import type { GameSession } from '../../../core/GameSession';
import { EventBus } from '../../../events/EventBus';
import { EventTypes } from '../../../events/EventTypes';
import { EVENT_COLORS } from './EventLogColors';

/**
 * 事件日志过滤器
 */
export interface EventLogFilter {
    /** 过滤特定玩家索引（-1或undefined表示所有玩家） */
    playerIndex?: number;
    /** 仅本次会话的事件（默认true） */
    onlyCurrentSession?: boolean;
    /** 最大返回数量 */
    limit?: number;
}

/**
 * 存储的事件项（包含原始事件和缓存的格式化结果）
 */
interface StoredEvent {
    /** 原始事件元数据 */
    metadata: EventMetadata<any>;
    /** 缓存的格式化结果（lazy生成） */
    formattedCache?: FormattedLog;
    /** 相关玩家索引数组（用于过滤，支持多玩家关联如租金事件的payer和owner） */
    playerIndices: number[];
}

/**
 * 日期分隔符日志项
 */
interface DateSeparator {
    type: 'date-separator';
    dateString: string;
    timestamp: number;
}

/**
 * 显示日志项（可以是格式化日志或日期分隔符）
 */
export type DisplayLogItem = FormattedLog | DateSeparator;

/**
 * 判断是否为日期分隔符
 */
export function isDateSeparator(item: DisplayLogItem): item is DateSeparator {
    return (item as DateSeparator).type === 'date-separator';
}

/**
 * EventLogService 单例类
 */
export class EventLogService {
    private static _instance: EventLogService | null = null;

    /** 事件存储（原始事件） */
    private _events: StoredEvent[] = [];

    /** 本次会话开始时间 */
    private _sessionStartTime: number = 0;

    /** 当前游戏会话引用 */
    private _session: GameSession | null = null;

    /** 当前游戏ID */
    private _gameId: string = '';

    /** 最大存储事件数量 */
    private readonly MAX_EVENTS = 1000;

    /** 是否正在加载历史 */
    private _loadingHistory: boolean = false;

    /** 历史事件是否已加载 */
    private _historyLoaded: boolean = false;

    private constructor() {
        console.log('[EventLogService] 服务初始化');
    }

    /**
     * 获取单例实例
     */
    static getInstance(): EventLogService {
        if (!EventLogService._instance) {
            EventLogService._instance = new EventLogService();
        }
        return EventLogService._instance;
    }

    /**
     * 设置当前游戏会话
     * 应在游戏开始时调用
     */
    setSession(session: GameSession): void {
        const newGameId = session.getGameId();

        // 如果gameId变化，清空旧数据
        if (this._gameId && this._gameId !== newGameId) {
            console.log('[EventLogService] 游戏ID变化，重置服务', {
                oldGameId: this._gameId,
                newGameId
            });
            this.reset();
        } else if (this._events.length > 0) {
            // 同一局游戏重新设置session，只清除格式化缓存
            for (const e of this._events) {
                e.formattedCache = undefined;
            }
        }

        this._session = session;
        this._gameId = newGameId;
        this._sessionStartTime = Date.now();
        this._historyLoaded = false;

        console.log('[EventLogService] 会话已设置', {
            gameId: this._gameId,
            startTime: new Date(this._sessionStartTime).toLocaleTimeString()
        });
    }

    /**
     * 获取当前会话
     */
    getSession(): GameSession | null {
        return this._session;
    }

    /**
     * 获取当前游戏ID
     */
    getGameId(): string {
        return this._gameId;
    }

    /**
     * 是否正在加载历史
     */
    isLoadingHistory(): boolean {
        return this._loadingHistory;
    }

    /**
     * 历史是否已加载
     */
    isHistoryLoaded(): boolean {
        return this._historyLoaded;
    }

    /**
     * 添加事件到日志（存储原始事件，lazy格式化）
     * 由EventIndexer或Handler调用
     *
     * @param event 事件元数据
     * @param session 可选的游戏会话（如果不传则使用已设置的session）
     */
    addEvent(event: EventMetadata<any>, session?: GameSession): void {
        const useSession = session || this._session;
        if (!useSession) {
            // 会话未设置，记录警告（可能是indexer在GameInitializer之前收到事件）
            console.warn('[EventLogService] addEvent: 会话未设置，事件被丢弃', event.type);
            return;
        }

        // 计算相关玩家索引数组（用于过滤）
        const playerIndices = this._extractPlayerIndices(event, useSession);

        // 检查事件是否需要记录（某些事件类型不需要）
        if (!this._shouldRecordEvent(event.type)) {
            return;
        }

        // 存储事件
        const storedEvent: StoredEvent = {
            metadata: event,
            playerIndices,
        };

        this._events.push(storedEvent);

        // 限制事件数量
        if (this._events.length > this.MAX_EVENTS) {
            this._events.shift();
        }

        // 触发日志更新事件
        EventBus.emit(EventTypes.UI.EventLogUpdated, {
            eventType: event.type,
            totalCount: this._events.length
        });
    }

    /**
     * 检查事件类型是否需要记录
     */
    private _shouldRecordEvent(eventType: EventType): boolean {
        // 这些事件类型需要记录到日志
        const recordableTypes = [
            EventType.GAME_STARTED,
            EventType.GAME_ENDED,
            EventType.PLAYER_JOINED,
            EventType.TURN_START,
            EventType.SKIP_TURN,
            EventType.ROUND_ENDED,
            EventType.BANKRUPT,
            EventType.ROLL_AND_STEP_ACTION,
            EventType.USE_CARD_ACTION,
            EventType.BUILDING_DECISION,
            EventType.RENT_DECISION,
        ];
        return recordableTypes.includes(eventType);
    }

    /**
     * 从事件中提取相关玩家索引数组
     * 支持多玩家关联（如租金事件的payer和owner都可见）
     */
    private _extractPlayerIndices(event: EventMetadata<any>, session: GameSession): number[] {
        const data = event.data;
        if (!data) return [-1];

        const indices: number[] = [];
        const players = session.getAllPlayers();

        // 辅助函数：查找玩家索引
        const findIndex = (address: string | undefined): number => {
            if (!address) return -1;
            for (let i = 0; i < players.length; i++) {
                if (players[i].getOwner() === address) return i;
            }
            return -1;
        };

        // 顶层字段
        const topLevelAddr = data.player || data.starting_player || data.payer;
        const topIdx = findIndex(topLevelAddr);
        if (topIdx >= 0) indices.push(topIdx);

        // 嵌套在 decision 中的字段 (RentDecisionEvent, BuildingDecisionEvent)
        if (data.decision) {
            const payerIdx = findIndex(data.decision.payer);
            const ownerIdx = findIndex(data.decision.owner);
            if (payerIdx >= 0 && !indices.includes(payerIdx)) indices.push(payerIdx);
            if (ownerIdx >= 0 && !indices.includes(ownerIdx)) indices.push(ownerIdx);
        }

        // 如果没有找到任何玩家，标记为系统事件
        return indices.length > 0 ? indices : [-1];
    }

    /**
     * 获取格式化后的日志列表（lazy格式化）
     * 包含日期分隔符
     *
     * @param filter 过滤条件
     * @returns 显示日志项数组（按时间正序，包含日期分隔符）
     */
    getLogs(filter?: EventLogFilter): DisplayLogItem[] {
        if (!this._session) {
            return [];
        }

        // 过滤事件
        let filteredEvents = [...this._events];

        // 过滤本次会话
        if (filter?.onlyCurrentSession !== false && this._sessionStartTime > 0) {
            filteredEvents = filteredEvents.filter(e =>
                e.metadata.timestamp >= this._sessionStartTime
            );
        }

        // 过滤特定玩家
        if (filter?.playerIndex !== undefined && filter.playerIndex >= 0) {
            filteredEvents = filteredEvents.filter(e =>
                e.playerIndices.includes(filter.playerIndex!) ||
                e.playerIndices.includes(-1)  // 系统事件对所有玩家可见
            );
        }

        // 限制数量（在格式化之前）
        if (filter?.limit && filter.limit > 0) {
            filteredEvents = filteredEvents.slice(-filter.limit);
        }

        // Lazy格式化并添加日期分隔符
        const result: DisplayLogItem[] = [];
        let lastDateString = '';

        for (const storedEvent of filteredEvents) {
            // 检查是否需要添加日期分隔符
            const eventDate = new Date(storedEvent.metadata.timestamp);
            const dateString = this._formatDateString(eventDate);

            if (dateString !== lastDateString) {
                // 添加日期分隔符
                result.push({
                    type: 'date-separator',
                    dateString,
                    timestamp: storedEvent.metadata.timestamp,
                });
                lastDateString = dateString;
            }

            // Lazy格式化：如果没有缓存则生成
            if (!storedEvent.formattedCache) {
                storedEvent.formattedCache = EventLogFormatter.format(
                    storedEvent.metadata,
                    this._session
                ) || undefined;
            }

            if (storedEvent.formattedCache) {
                result.push(storedEvent.formattedCache);
            }
        }

        return result;
    }

    /**
     * 格式化日期字符串
     */
    private _formatDateString(date: Date): string {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[date.getDay()];
        return `${year}年${month}月${day}日 ${weekday}`;
    }

    /**
     * 生成日期分隔符的显示文本
     */
    static formatDateSeparatorText(dateString: string): string {
        return `[color=${EVENT_COLORS.timestamp}]━━━━━━━━ ${dateString} ━━━━━━━━[/color]`;
    }

    /**
     * 获取所有事件数量
     */
    getEventCount(): number {
        return this._events.length;
    }

    /**
     * 清空日志
     */
    clear(): void {
        this._events = [];
        this._sessionStartTime = Date.now();
        this._historyLoaded = false;
        console.log('[EventLogService] 日志已清空');
    }

    /**
     * 重置服务（切换游戏时调用）
     */
    reset(): void {
        this._events = [];
        this._session = null;
        this._gameId = '';
        this._sessionStartTime = 0;
        this._historyLoaded = false;
        this._loadingHistory = false;
        console.log('[EventLogService] 服务已重置');
    }

    // ===== 链上历史查询 =====

    /**
     * 从链上加载历史事件
     * 用于查看完整游戏历史
     *
     * @param gameId 游戏ID（可选，默认使用当前游戏）
     */
    async loadHistoryFromChain(gameId?: string): Promise<void> {
        const targetGameId = gameId || this._gameId;
        if (!targetGameId) {
            console.warn('[EventLogService] 无法加载历史：游戏ID未设置');
            return;
        }

        if (this._loadingHistory) {
            console.log('[EventLogService] 历史加载中，请等待...');
            return;
        }

        this._loadingHistory = true;
        console.log('[EventLogService] 开始从链上加载历史事件', { gameId: targetGameId });

        try {
            // 动态导入避免循环依赖
            const { SuiManager } = await import('../../../sui/managers/SuiManager');
            const suiManager = SuiManager.instance;

            if (!suiManager) {
                throw new Error('SuiManager未初始化');
            }

            const client = suiManager.client;
            const packageId = suiManager.config.packageId;

            if (!client || !packageId) {
                throw new Error('Sui客户端或包ID未设置');
            }

            // 查询该游戏的所有事件类型
            const eventTypes = [
                'GameStartedEvent',
                'PlayerJoinedEvent',
                'TurnStartEvent',
                'SkipTurnEvent',
                'RoundEndedEvent',
                'BankruptEvent',
                'RollAndStepActionEvent',
                'UseCardActionEvent',
                'BuildingDecisionEvent',
                'RentDecisionEvent',
                'GameEndedEvent',
            ];

            const allEvents: StoredEvent[] = [];

            for (const typeName of eventTypes) {
                const fullType = `${packageId}::events::${typeName}`;

                try {
                    let cursor: any = null;
                    let hasMore = true;

                    while (hasMore) {
                        const result = await client.queryEvents({
                            query: { MoveEventType: fullType },
                            cursor,
                            limit: 50,
                            order: 'ascending',
                        });

                        for (const ev of result.data) {
                            // 解析事件数据
                            const parsedContent = (ev as any).parsedJson || ev;
                            const eventData = this._normalizeEventData(parsedContent);

                            // 检查是否属于当前游戏
                            // 处理game字段可能是对象的情况（如 { id: "xxx" }）
                            let eventGameId = eventData.game;
                            if (typeof eventGameId === 'object' && eventGameId !== null) {
                                eventGameId = eventGameId.id || eventGameId.objectId || String(eventGameId);
                            }
                            if (eventGameId && eventGameId !== targetGameId) {
                                continue;
                            }

                            const eventType = this._getEventType(typeName);
                            if (!eventType) continue;

                            const metadata: EventMetadata<any> = {
                                type: eventType,
                                data: eventData,
                                timestamp: Number((ev as any).timestampMs || Date.now()),
                                sequence: Number((ev as any).id?.eventSeq ?? 0),  // 从eventSeq填充，用于精确去重
                                txHash: (ev as any).id?.txDigest || '',
                                blockHeight: 0,
                            };

                            // 计算玩家索引数组
                            const playerIndices = this._session
                                ? this._extractPlayerIndices(metadata, this._session)
                                : [-1];

                            allEvents.push({
                                metadata,
                                playerIndices,
                            });
                        }

                        hasMore = result.hasNextPage;
                        cursor = result.nextCursor;
                    }
                } catch (error) {
                    console.warn(`[EventLogService] 查询 ${typeName} 失败:`, error);
                }
            }

            // 按时间排序
            allEvents.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

            // 合并到现有事件（使用txHash+eventSeq去重，同一交易多个事件都保留）
            const getEventKey = (e: StoredEvent) => `${e.metadata.txHash}:${e.metadata.sequence}`;
            const existingKeys = new Set(this._events.map(getEventKey));
            const newEvents = allEvents.filter(e => !existingKeys.has(getEventKey(e)));

            // 将历史事件插入到开头
            this._events = [...newEvents, ...this._events];

            // 限制总数
            if (this._events.length > this.MAX_EVENTS) {
                this._events = this._events.slice(-this.MAX_EVENTS);
            }

            this._historyLoaded = true;
            console.log('[EventLogService] 历史事件加载完成', {
                newEvents: newEvents.length,
                totalEvents: this._events.length
            });

            // 触发更新
            EventBus.emit(EventTypes.UI.EventLogUpdated, {
                eventType: 'history-loaded',
                totalCount: this._events.length
            });

        } catch (error) {
            console.error('[EventLogService] 加载历史事件失败:', error);
        } finally {
            this._loadingHistory = false;
        }
    }

    /**
     * 规范化事件数据（处理嵌套的fields结构）
     */
    private _normalizeEventData(data: any): any {
        if (!data) return data;

        // 处理 { fields: { ... } } 结构
        if (data.fields && typeof data.fields === 'object') {
            return this._normalizeEventData(data.fields);
        }

        // 递归处理对象
        if (typeof data === 'object' && !Array.isArray(data)) {
            const result: any = {};
            for (const key of Object.keys(data)) {
                result[key] = this._normalizeEventData(data[key]);
            }
            return result;
        }

        // 递归处理数组
        if (Array.isArray(data)) {
            return data.map(item => this._normalizeEventData(item));
        }

        return data;
    }

    /**
     * 获取事件类型枚举
     */
    private _getEventType(typeName: string): EventType | null {
        const typeMap: { [key: string]: EventType } = {
            'GameCreatedEvent': EventType.GAME_CREATED,
            'PlayerJoinedEvent': EventType.PLAYER_JOINED,
            'GameStartedEvent': EventType.GAME_STARTED,
            'GameEndedEvent': EventType.GAME_ENDED,
            'TurnStartEvent': EventType.TURN_START,
            'SkipTurnEvent': EventType.SKIP_TURN,
            'RoundEndedEvent': EventType.ROUND_ENDED,
            'BankruptEvent': EventType.BANKRUPT,
            'BuildingDecisionEvent': EventType.BUILDING_DECISION,
            'RentDecisionEvent': EventType.RENT_DECISION,
            'UseCardActionEvent': EventType.USE_CARD_ACTION,
            'RollAndStepActionEvent': EventType.ROLL_AND_STEP_ACTION,
        };
        return typeMap[typeName] || null;
    }
}
