/**
 * 事件处理器
 * 处理和分析游戏事件，提取有用的信息
 */

import { EventType, EventMetadata } from './types';
import {
    RollAndStepActionEvent,
    UseCardActionEvent,
    CashDelta,
    StopEffect,
    analyzePath,
    calculateTotalCashChange,
    getAffectedPlayers
} from './aggregated';
import { NpcKind, BuffKind, CashReason, StopType, NpcAction } from '../types/constants';

/**
 * 游戏效果类型
 */
export enum GameEffectType {
    // 经济效果
    EARN_MONEY = 'earn_money',
    LOSE_MONEY = 'lose_money',
    PAY_RENT = 'pay_rent',
    COLLECT_RENT = 'collect_rent',
    BUY_BUILDING = 'buy_building',
    UPGRADE_BUILDING = 'upgrade_building',

    // 移动效果
    NORMAL_MOVE = 'normal_move',
    CONTROLLED_MOVE = 'controlled_move',
    BLOCKED_MOVE = 'blocked_move',
    SENT_TO_HOSPITAL = 'sent_to_hospital',

    // 卡牌效果
    USE_CARD = 'use_card',
    DRAW_CARD = 'draw_card',

    // NPC效果
    HIT_BOMB = 'hit_bomb',
    HIT_BARRIER = 'hit_barrier',
    HIT_DOG = 'hit_dog',
    PLACE_NPC = 'place_npc',

    // Buff效果
    GAIN_BUFF = 'gain_buff',
    LOSE_BUFF = 'lose_buff',

    // 状态效果
    BANKRUPT = 'bankrupt',
    FROZEN = 'frozen',
    IN_HOSPITAL = 'in_hospital'
}

/**
 * 游戏效果数据
 */
export interface GameEffect {
    /** 效果类型 */
    type: GameEffectType;
    /** 涉及的玩家（玩家索引或地址字符串，兼容旧版） */
    player: number | string;
    /** 目标（如果有） */
    target?: number | string;
    /** 金额（如果有） */
    amount?: bigint;
    /** 位置信息 */
    position?: {
        from?: number;
        to?: number;
        tile?: number;
    };
    /** 额外数据 */
    data?: any;
    /** 描述 */
    description: string;
}

/**
 * 游戏状态变化
 */
export interface GameStateChange {
    /** 事件类型 */
    eventType: EventType;
    /** 游戏ID */
    gameId: string;
    /** 时间戳 */
    timestamp: number;
    /** 产生的效果 */
    effects: GameEffect[];
    /** 现金流变化（key 为玩家索引） */
    cashFlows: Map<number, bigint>;
    /** 位置变化（key 为玩家索引） */
    positionChanges: Map<number, number>;
}

/**
 * 事件处理器
 */
export class TycoonEventProcessor {
    /**
     * 处理事件，提取游戏效果
     */
    processEvent(metadata: EventMetadata): GameStateChange | null {
        switch (metadata.type) {
            case EventType.ROLL_AND_STEP_ACTION:
                return this.processRollAndStep(metadata as EventMetadata<RollAndStepActionEvent>);
            case EventType.USE_CARD_ACTION:
                return this.processUseCard(metadata as EventMetadata<UseCardActionEvent>);
            case EventType.BANKRUPT:
                return this.processBankrupt(metadata);
            default:
                return this.processBasicEvent(metadata);
        }
    }

    /**
     * 处理掷骰移动事件
     */
    private processRollAndStep(metadata: EventMetadata<RollAndStepActionEvent>): GameStateChange {
        const event = metadata.data;
        const effects: GameEffect[] = [];
        const cashFlows = new Map<number, bigint>();
        const positionChanges = new Map<number, number>();

        // 记录位置变化
        positionChanges.set(event.player, event.end_pos);

        // 分析移动类型
        if (event.dice > 0) {
            effects.push({
                type: GameEffectType.NORMAL_MOVE,
                player: event.player,
                position: {
                    from: event.from,
                    to: event.end_pos
                },
                data: { dice: event.dice },
                description: `掷出${event.dice}点，移动到位置${event.end_pos}`
            });
        }

        // 分析路径上的事件
        const pathAnalysis = analyzePath(event);

        // 处理NPC交互
        for (const npcEvent of pathAnalysis.npcs) {
            if (npcEvent.kind === NpcKind.BOMB) {
                effects.push({
                    type: GameEffectType.HIT_BOMB,
                    player: event.player,
                    position: { tile: npcEvent.tile_id },
                    description: '踩到炸弹，送往医院'
                });
                if (npcEvent.result_tile) {
                    effects.push({
                        type: GameEffectType.SENT_TO_HOSPITAL,
                        player: event.player,
                        position: { to: npcEvent.result_tile },
                        description: '被送往医院'
                    });
                }
            } else if (npcEvent.kind === NpcKind.BARRIER) {
                effects.push({
                    type: GameEffectType.HIT_BARRIER,
                    player: event.player,
                    position: { tile: npcEvent.tile_id },
                    description: '遇到路障，停止移动'
                });
            }
        }

        // 处理卡牌获取
        for (const card of pathAnalysis.cards) {
            effects.push({
                type: GameEffectType.DRAW_CARD,
                player: event.player,
                data: { cardKind: card.kind, count: card.count },
                description: `获得卡牌×${card.count}`
            });
        }

        // 处理停留效果
        if (pathAnalysis.finalStop) {
            this.processStopEffect(pathAnalysis.finalStop, event.player, effects);
        }

        // 处理现金变动
        for (const cashDelta of event.cash_changes) {
            const change = cashDelta.is_debit ? -cashDelta.amount : cashDelta.amount;
            const current = cashFlows.get(cashDelta.player) || 0n;
            cashFlows.set(cashDelta.player, current + change);

            // 添加现金效果
            if (cashDelta.reason === CashReason.TOLL) {
                if (cashDelta.is_debit) {
                    effects.push({
                        type: GameEffectType.PAY_RENT,
                        player: cashDelta.player,
                        amount: cashDelta.amount,
                        position: { tile: cashDelta.details },
                        description: `支付过路费 ${cashDelta.amount}`
                    });
                } else {
                    effects.push({
                        type: GameEffectType.COLLECT_RENT,
                        player: cashDelta.player,
                        amount: cashDelta.amount,
                        position: { tile: cashDelta.details },
                        description: `收取过路费 ${cashDelta.amount}`
                    });
                }
            }
        }

        return {
            eventType: EventType.ROLL_AND_STEP_ACTION,
            gameId: event.game,
            timestamp: metadata.timestamp,
            effects,
            cashFlows,
            positionChanges
        };
    }

    /**
     * 处理使用卡牌事件
     */
    private processUseCard(metadata: EventMetadata<UseCardActionEvent>): GameStateChange {
        const event = metadata.data;
        const effects: GameEffect[] = [];
        const cashFlows = new Map<number, bigint>();

        // 记录卡牌使用
        effects.push({
            type: GameEffectType.USE_CARD,
            player: event.player,
            data: { cardKind: event.kind, params: event.params },
            description: `使用了卡牌`
        });

        // 处理NPC变更
        for (const npcChange of event.npc_changes) {
            if (npcChange.action === NpcAction.SPAWN) {
                effects.push({
                    type: GameEffectType.PLACE_NPC,
                    player: event.player,
                    position: { tile: npcChange.tile_id },
                    data: { npcKind: npcChange.kind },
                    description: `在位置${npcChange.tile_id}放置了NPC`
                });
            }
        }

        // 处理Buff变更
        for (const buffChange of event.buff_changes) {
            effects.push({
                type: GameEffectType.GAIN_BUFF,
                player: buffChange.target,
                data: {
                    buffType: buffChange.buff_type,
                    duration: buffChange.last_active_round
                },
                description: `获得了Buff效果`
            });

            // 特殊效果
            if (buffChange.buff_type === BuffKind.FROZEN) {
                effects.push({
                    type: GameEffectType.FROZEN,
                    player: buffChange.target,
                    description: '被冰冻了'
                });
            }
        }

        // 处理现金变动
        for (const cashDelta of event.cash_changes) {
            const change = cashDelta.is_debit ? -cashDelta.amount : cashDelta.amount;
            const current = cashFlows.get(cashDelta.player) || 0n;
            cashFlows.set(cashDelta.player, current + change);
        }

        return {
            eventType: EventType.USE_CARD_ACTION,
            gameId: event.game,
            timestamp: metadata.timestamp,
            effects,
            cashFlows,
            positionChanges: new Map()
        };
    }

    /**
     * 处理破产事件
     */
    private processBankrupt(metadata: EventMetadata): GameStateChange {
        const event = metadata.data as any;
        const effects: GameEffect[] = [];

        effects.push({
            type: GameEffectType.BANKRUPT,
            player: event.player,
            target: event.creditor,
            amount: event.debt,
            description: `玩家破产，欠债 ${event.debt}`
        });

        return {
            eventType: EventType.BANKRUPT,
            gameId: event.game,
            timestamp: metadata.timestamp,
            effects,
            cashFlows: new Map(),
            positionChanges: new Map()
        };
    }

    /**
     * 处理基础事件
     */
    private processBasicEvent(metadata: EventMetadata): GameStateChange {
        const event = metadata.data as any;
        const effects: GameEffect[] = [];

        // 根据事件类型添加基本效果
        switch (metadata.type) {
            case EventType.GAME_STARTED:
                effects.push({
                    type: GameEffectType.NORMAL_MOVE,
                    player: event.starting_player,
                    description: '游戏开始'
                });
                break;
        }

        return {
            eventType: metadata.type,
            gameId: event.game || '',
            timestamp: metadata.timestamp,
            effects,
            cashFlows: new Map(),
            positionChanges: new Map()
        };
    }

    /**
     * 处理停留效果
     */
    private processStopEffect(stop: StopEffect, player: number | string, effects: GameEffect[]): void {
        switch (stop.stop_type) {
            case StopType.BUILDING_TOLL:
                // 已在现金变动中处理
                break;
            case StopType.BUILDING_NO_RENT:
                effects.push({
                    type: GameEffectType.NORMAL_MOVE,
                    player,
                    position: { tile: stop.tile_id },
                    description: '免租通过'
                });
                break;
            case StopType.HOSPITAL:
                effects.push({
                    type: GameEffectType.IN_HOSPITAL,
                    player,
                    data: { turns: stop.turns },
                    description: `进入医院${stop.turns}回合`
                });
                break;
            case StopType.BONUS:
                effects.push({
                    type: GameEffectType.EARN_MONEY,
                    player,
                    amount: stop.amount,
                    description: `获得奖金 ${stop.amount}`
                });
                break;
            case StopType.FEE:
                effects.push({
                    type: GameEffectType.LOSE_MONEY,
                    player,
                    amount: stop.amount,
                    description: `支付罚款 ${stop.amount}`
                });
                break;
            case StopType.BUILDING_UNOWNED:
                effects.push({
                    type: GameEffectType.BUY_BUILDING,
                    player,
                    position: { tile: stop.tile_id },
                    description: '可以购买地产'
                });
                break;
            case StopType.LAND_SEIZE:
                // 土地神附身抢地 - 记录效果（建筑更新由 building_decision 处理）
                effects.push({
                    type: GameEffectType.BUY_BUILDING,  // 复用购买效果类型
                    player,
                    position: { tile: stop.tile_id },
                    description: '土地神附身，免费占有地产'
                });
                break;
        }
    }
}

/**
 * 创建默认处理器实例
 */
export const eventProcessor = new TycoonEventProcessor();
