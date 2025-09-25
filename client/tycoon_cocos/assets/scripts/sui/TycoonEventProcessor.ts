/**
 * Tycoon事件处理器
 * 负责处理聚合事件并更新游戏状态
 */

import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import {
    RollAndStepActionEvent,
    UseCardActionEvent,
    GameCreatedEvent,
    GameStartedEvent,
    GameEndedEvent,
    PlayerJoinedEvent,
    BankruptEvent,
    TurnStartEvent,
    EndTurnEvent,
    SkipTurnEvent,
    StepEffect,
    StopEffect,
    CashDelta,
    CardDrawItem,
    NpcChangeItem,
    BuffChangeItem,
    NpcStepEvent
} from './TycoonEventTypes';

import {
    STOP_TYPE,
    NPC_ACTION,
    NPC_RESULT,
    TILE_KIND,
    NPC_KIND,
    CARD_KIND,
    BUFF_KIND,
    CashDeltaReason,
    getStopTypeDescription,
    getTileKindName,
    getNpcKindName,
    getCardKindName
} from './TycoonEventConstants';

/**
 * 游戏效果类型
 */
export enum GameEffectType {
    // 移动效果
    PlayerMove = 'player_move',
    PlayerStop = 'player_stop',

    // 金钱效果
    PayRent = 'pay_rent',
    BuyProperty = 'buy_property',
    ReceiveBonus = 'receive_bonus',
    PayFee = 'pay_fee',

    // 卡牌效果
    DrawCard = 'draw_card',
    UseCard = 'use_card',

    // NPC效果
    PlaceNpc = 'place_npc',
    TriggerNpc = 'trigger_npc',
    RemoveNpc = 'remove_npc',

    // Buff效果
    ApplyBuff = 'apply_buff',
    RemoveBuff = 'remove_buff',

    // 特殊效果
    EnterHospital = 'enter_hospital',
    EnterPrison = 'enter_prison',
    Teleport = 'teleport'
}

/**
 * 游戏效果数据
 */
export interface GameEffect {
    type: GameEffectType;
    data: any;
    playerId: string;
    tileId?: bigint;
    amount?: bigint;
    description?: string;
}

/**
 * 处理器配置
 */
export interface ProcessorConfig {
    /** 是否启用动画 */
    enableAnimations?: boolean;
    /** 动画速度倍率 */
    animationSpeed?: number;
    /** 是否启用调试 */
    debug?: boolean;
}

/**
 * Tycoon事件处理器
 */
export class TycoonEventProcessor {
    private static _instance: TycoonEventProcessor | null = null;

    private _config: ProcessorConfig = {
        enableAnimations: true,
        animationSpeed: 1.0,
        debug: false
    };

    // 游戏状态缓存
    private _currentGameId?: string;
    private _currentPlayerId?: string;
    private _gameState: Map<string, any> = new Map();

    /**
     * 获取单例实例
     */
    public static getInstance(): TycoonEventProcessor {
        if (!this._instance) {
            this._instance = new TycoonEventProcessor();
        }
        return this._instance;
    }

    private constructor() {}

    /**
     * 配置处理器
     */
    public configure(config: ProcessorConfig): void {
        this._config = { ...this._config, ...config };
    }

    /**
     * 设置当前游戏ID
     */
    public setCurrentGame(gameId: string, playerId: string): void {
        this._currentGameId = gameId;
        this._currentPlayerId = playerId;
    }

    // ===== 基础事件处理 =====

    /**
     * 处理游戏创建事件
     */
    public async processGameCreated(event: GameCreatedEvent): Promise<void> {
        if (this._config.debug) {
            console.log('[TycoonProcessor] 游戏创建:', event);
        }

        // 初始化游戏状态
        this._gameState.set(event.game, {
            id: event.game,
            creator: event.creator,
            templateId: event.template_id,  // 现在是 number (u16)
            maxPlayers: event.max_players,
            createdAt: event.created_at_ms,
            players: [],
            currentTurn: 0n,
            status: 'waiting'
        });

        // 发送UI事件
        EventBus.emit(EventTypes.Game.Created, {
            gameId: event.game,
            creator: event.creator,
            maxPlayers: event.max_players
        });
    }

    /**
     * 处理玩家加入事件
     */
    public async processPlayerJoined(event: PlayerJoinedEvent): Promise<void> {
        const gameState = this._gameState.get(event.game);
        if (!gameState) return;

        // 更新游戏状态
        gameState.players.push({
            address: event.player,
            index: event.player_index,
            position: 0n,
            cash: 10000n  // 默认起始资金
        });

        // 发送UI事件
        EventBus.emit(EventTypes.Player.Joined, {
            gameId: event.game,
            player: event.player,
            playerIndex: event.player_index
        });
    }

    /**
     * 处理游戏开始事件
     */
    public async processGameStarted(event: GameStartedEvent): Promise<void> {
        const gameState = this._gameState.get(event.game);
        if (!gameState) return;

        gameState.status = 'active';
        gameState.currentPlayer = event.starting_player;

        // 发送UI事件
        EventBus.emit(EventTypes.Game.Started, {
            gameId: event.game,
            playerCount: event.player_count,
            startingPlayer: event.starting_player
        });
    }

    /**
     * 处理游戏结束事件
     */
    public async processGameEnded(event: GameEndedEvent): Promise<void> {
        const gameState = this._gameState.get(event.game);
        if (!gameState) return;

        gameState.status = 'ended';
        gameState.winner = event.winner;

        // 发送UI事件
        EventBus.emit(EventTypes.Game.Ended, {
            gameId: event.game,
            winner: event.winner,
            turn: event.turn,
            reason: event.reason
        });
    }

    // ===== 聚合事件处理 =====

    /**
     * 处理掷骰移动聚合事件
     */
    public async processRollAndStepAction(event: RollAndStepActionEvent): Promise<void> {
        if (this._config.debug) {
            console.log('[TycoonProcessor] 处理移动事件:', event);
        }

        const effects: GameEffect[] = [];

        // 1. 处理掷骰
        EventBus.emit(EventTypes.Player.DiceRolled, {
            player: event.player,
            dice: event.dice,
            direction: event.dir
        });

        // 2. 处理每个移动步骤
        for (const step of event.steps) {
            await this._processStepEffect(step, event.player, effects);
        }

        // 3. 处理现金变动
        await this._processCashChanges(event.cash_changes, effects);

        // 4. 更新最终位置
        EventBus.emit(EventTypes.Player.Moved, {
            player: event.player,
            from: event.from,
            to: event.end_pos,
            effects: effects
        });

        // 5. 播放所有效果
        if (this._config.enableAnimations) {
            await this._playEffects(effects);
        }
    }

    /**
     * 处理使用卡牌聚合事件
     */
    public async processUseCardAction(event: UseCardActionEvent): Promise<void> {
        if (this._config.debug) {
            console.log('[TycoonProcessor] 处理卡牌事件:', event);
        }

        const effects: GameEffect[] = [];

        // 1. 创建卡牌使用效果
        effects.push({
            type: GameEffectType.UseCard,
            playerId: event.player,
            data: {
                cardKind: event.kind,
                cardName: getCardKindName(event.kind as any),
                targetPlayer: event.target_addr,
                targetTile: event.target_tile
            }
        });

        // 2. 处理NPC变更
        for (const npcChange of event.npc_changes) {
            await this._processNpcChange(npcChange, effects);
        }

        // 3. 处理Buff变更
        for (const buffChange of event.buff_changes) {
            await this._processBuffChange(buffChange, effects);
        }

        // 4. 处理现金变动
        await this._processCashChanges(event.cash_changes, effects);

        // 5. 发送UI事件
        EventBus.emit(EventTypes.Card.Used, {
            player: event.player,
            cardKind: event.kind,
            effects: effects
        });

        // 6. 播放效果
        if (this._config.enableAnimations) {
            await this._playEffects(effects);
        }
    }

    // ===== 效果处理辅助方法 =====

    /**
     * 处理步骤效果
     */
    private async _processStepEffect(
        step: StepEffect,
        player: string,
        effects: GameEffect[]
    ): Promise<void> {
        // 1. 移动效果
        effects.push({
            type: GameEffectType.PlayerMove,
            playerId: player,
            data: {
                from: step.from_tile,
                to: step.to_tile,
                remainingSteps: step.remaining_steps
            },
            tileId: step.to_tile
        });

        // 2. 经过效果（抽卡）
        if (step.pass_draws.length > 0) {
            for (const draw of step.pass_draws) {
                effects.push({
                    type: GameEffectType.DrawCard,
                    playerId: player,
                    data: {
                        cardKind: draw.kind,
                        cardName: getCardKindName(draw.kind as any),
                        count: draw.count,
                        isPass: draw.is_pass
                    },
                    tileId: draw.tile_id
                });
            }
        }

        // 3. NPC事件
        if (step.npc_event) {
            await this._processNpcEvent(step.npc_event, player, effects);
        }

        // 4. 停留效果
        if (step.stop_effect) {
            await this._processStopEffect(step.stop_effect, player, effects);
        }
    }

    /**
     * 处理NPC事件
     */
    private async _processNpcEvent(
        npcEvent: NpcStepEvent,
        player: string,
        effects: GameEffect[]
    ): Promise<void> {
        const npcName = getNpcKindName(npcEvent.kind as any);

        effects.push({
            type: GameEffectType.TriggerNpc,
            playerId: player,
            data: {
                npcKind: npcEvent.kind,
                npcName: npcName,
                result: npcEvent.result,
                consumed: npcEvent.consumed
            },
            tileId: npcEvent.tile_id
        });

        // 处理NPC结果
        switch (npcEvent.result) {
            case NPC_RESULT.SEND_HOSPITAL:
                effects.push({
                    type: GameEffectType.EnterHospital,
                    playerId: player,
                    tileId: npcEvent.result_tile,
                    description: `被${npcName}送往医院`
                });
                break;

            case NPC_RESULT.BARRIER_STOP:
                effects.push({
                    type: GameEffectType.PlayerStop,
                    playerId: player,
                    tileId: npcEvent.tile_id,
                    description: `被路障阻挡`
                });
                break;
        }
    }

    /**
     * 处理停留效果
     */
    private async _processStopEffect(
        stopEffect: StopEffect,
        player: string,
        effects: GameEffect[]
    ): Promise<void> {
        const tileName = getTileKindName(stopEffect.tile_kind as any);
        const stopDesc = getStopTypeDescription(stopEffect.stop_type as any);

        // 基础停留效果
        effects.push({
            type: GameEffectType.PlayerStop,
            playerId: player,
            tileId: stopEffect.tile_id,
            description: `停留在${tileName}：${stopDesc}`
        });

        // 根据停留类型处理
        switch (stopEffect.stop_type) {
            case STOP_TYPE.PROPERTY_TOLL:
                effects.push({
                    type: GameEffectType.PayRent,
                    playerId: player,
                    data: {
                        owner: stopEffect.owner,
                        level: stopEffect.level
                    },
                    tileId: stopEffect.tile_id,
                    amount: stopEffect.amount,
                    description: `支付租金 ${stopEffect.amount}`
                });
                break;

            case STOP_TYPE.PROPERTY_UNOWNED:
                effects.push({
                    type: GameEffectType.BuyProperty,
                    playerId: player,
                    tileId: stopEffect.tile_id,
                    amount: stopEffect.amount,
                    description: `可购买地产`
                });
                break;

            case STOP_TYPE.HOSPITAL:
                effects.push({
                    type: GameEffectType.EnterHospital,
                    playerId: player,
                    tileId: stopEffect.tile_id,
                    data: { turns: stopEffect.turns },
                    description: `进入医院 ${stopEffect.turns} 回合`
                });
                break;

            case STOP_TYPE.PRISON:
                effects.push({
                    type: GameEffectType.EnterPrison,
                    playerId: player,
                    tileId: stopEffect.tile_id,
                    data: { turns: stopEffect.turns },
                    description: `进入监狱 ${stopEffect.turns} 回合`
                });
                break;

            case STOP_TYPE.BONUS:
                effects.push({
                    type: GameEffectType.ReceiveBonus,
                    playerId: player,
                    tileId: stopEffect.tile_id,
                    amount: stopEffect.amount,
                    description: `获得奖金 ${stopEffect.amount}`
                });
                break;

            case STOP_TYPE.FEE:
                effects.push({
                    type: GameEffectType.PayFee,
                    playerId: player,
                    tileId: stopEffect.tile_id,
                    amount: stopEffect.amount,
                    description: `支付罚款 ${stopEffect.amount}`
                });
                break;
        }

        // 处理停留时获得的卡牌
        if (stopEffect.card_gains.length > 0) {
            for (const gain of stopEffect.card_gains) {
                effects.push({
                    type: GameEffectType.DrawCard,
                    playerId: player,
                    data: {
                        cardKind: gain.kind,
                        cardName: getCardKindName(gain.kind as any),
                        count: gain.count,
                        isPass: false
                    },
                    tileId: gain.tile_id
                });
            }
        }
    }

    /**
     * 处理现金变动
     */
    private async _processCashChanges(
        cashChanges: CashDelta[],
        effects: GameEffect[]
    ): Promise<void> {
        for (const change of cashChanges) {
            const reasonText = this._getCashChangeReason(change.reason);

            EventBus.emit(EventTypes.Player.CashChanged, {
                player: change.player,
                amount: change.is_debit ? -Number(change.amount) : Number(change.amount),
                reason: reasonText,
                details: change.details
            });
        }
    }

    /**
     * 处理NPC变更
     */
    private async _processNpcChange(
        npcChange: NpcChangeItem,
        effects: GameEffect[]
    ): Promise<void> {
        const npcName = getNpcKindName(npcChange.kind as any);

        switch (npcChange.action) {
            case NPC_ACTION.SPAWN:
                effects.push({
                    type: GameEffectType.PlaceNpc,
                    playerId: this._currentPlayerId!,
                    data: {
                        npcKind: npcChange.kind,
                        npcName: npcName
                    },
                    tileId: npcChange.tile_id
                });
                break;

            case NPC_ACTION.REMOVE:
                effects.push({
                    type: GameEffectType.RemoveNpc,
                    playerId: this._currentPlayerId!,
                    data: {
                        npcKind: npcChange.kind,
                        npcName: npcName
                    },
                    tileId: npcChange.tile_id
                });
                break;

            case NPC_ACTION.HIT:
                effects.push({
                    type: GameEffectType.TriggerNpc,
                    playerId: this._currentPlayerId!,
                    data: {
                        npcKind: npcChange.kind,
                        npcName: npcName,
                        consumed: npcChange.consumed
                    },
                    tileId: npcChange.tile_id
                });
                break;
        }
    }

    /**
     * 处理Buff变更
     */
    private async _processBuffChange(
        buffChange: BuffChangeItem,
        effects: GameEffect[]
    ): Promise<void> {
        if (buffChange.first_inactive_turn !== undefined) {
            // 添加Buff
            effects.push({
                type: GameEffectType.ApplyBuff,
                playerId: buffChange.target,
                data: {
                    buffType: buffChange.buff_type,
                    expiresAt: buffChange.first_inactive_turn
                }
            });
        } else {
            // 移除Buff
            effects.push({
                type: GameEffectType.RemoveBuff,
                playerId: buffChange.target,
                data: {
                    buffType: buffChange.buff_type
                }
            });
        }
    }

    /**
     * 播放效果动画
     */
    private async _playEffects(effects: GameEffect[]): Promise<void> {
        for (const effect of effects) {
            // 发送效果到动画系统
            EventBus.emit(EventTypes.Animation.PlayEffect, effect);

            // 根据动画速度等待
            await this._wait(500 / this._config.animationSpeed);
        }
    }

    /**
     * 获取现金变动原因文本
     */
    private _getCashChangeReason(reason: number): string {
        const reasons: Record<number, string> = {
            [CashDeltaReason.Toll]: '过路费',
            [CashDeltaReason.Buy]: '购买地产',
            [CashDeltaReason.Upgrade]: '升级地产',
            [CashDeltaReason.Bonus]: '奖金',
            [CashDeltaReason.Fee]: '罚款',
            [CashDeltaReason.Card]: '卡牌效果'
        };
        return reasons[reason] || '其他';
    }

    /**
     * 等待工具函数
     */
    private _wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 导出单例
export const tycoonEventProcessor = TycoonEventProcessor.getInstance();