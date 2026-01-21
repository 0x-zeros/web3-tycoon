/**
 * EventLogFormatter - 事件日志格式化器
 *
 * 将Sui链上事件转换为带颜色的富文本格式
 * 支持FairyGUI UBB标签语法
 *
 * @author Web3 Tycoon Team
 */

import { EventType, EventMetadata } from '../../../sui/events/types';
import type {
    GameStartedEvent,
    GameEndedEvent,
    SkipTurnEvent,
    BankruptEvent,
    RoundEndedEvent,
    PlayerJoinedEvent,
    BuildingDecisionEvent,
    RentDecisionEvent,
} from '../../../sui/events/types';
import type {
    RollAndStepActionEvent,
    UseCardActionEvent,
    StepEffect,
    CashDelta,
} from '../../../sui/events/aggregated';
import { getCardName } from '../../../sui/types/cards';
import { NpcKind } from '../../../sui/types/constants';
import type { GameSession } from '../../../core/GameSession';
import {
    EVENT_COLORS,
    coloredPlayerName,
    colored,
    coloredAmount,
    getPlayerColor,
} from './EventLogColors';

/**
 * 格式化后的日志条目
 */
export interface FormattedLog {
    /** UBB富文本内容 */
    text: string;
    /** 时间戳（用于排序） */
    timestamp: number;
    /** 相关玩家索引（-1表示系统事件） */
    playerIndex: number;
    /** 事件类型 */
    eventType: EventType;
}

/**
 * NPC类型名称映射
 */
const NPC_NAMES: { [key: number]: string } = {
    [NpcKind.BARRIER]: '路障',
    [NpcKind.BOMB]: '炸弹',
    [NpcKind.DOG]: '恶犬',
    [NpcKind.LAND_GOD]: '土地神',
    [NpcKind.WEALTH_GOD]: '财神',
    [NpcKind.FORTUNE_GOD]: '福神',
    [NpcKind.POOR_GOD]: '穷神',
};

/**
 * 获取NPC名称
 */
function getNpcName(kind: number): string {
    return NPC_NAMES[kind] || `NPC${kind}`;
}

/**
 * 获取卡牌类型（兼容 fields 嵌套）
 */
function getCardKind(raw: any): number | undefined {
    if (!raw) return undefined;
    const fields = (raw as any).fields || raw;
    return fields.kind ?? fields.card_kind ?? fields.card_type;
}

/**
 * 格式化时间戳为 HH:MM:SS
 */
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `[color=${EVENT_COLORS.timestamp}][${hours}:${minutes}:${seconds}][/color]`;
}

/**
 * 根据玩家地址获取玩家索引（兼容旧版事件）
 */
function getPlayerIndexByAddress(session: GameSession, address: string): number {
    const players = session.getAllPlayers();
    for (let i = 0; i < players.length; i++) {
        if (players[i].getOwner() === address) {
            return i;
        }
    }
    return -1;
}

/**
 * 获取玩家索引（新版事件直接返回索引，旧版通过地址查找）
 * player 可以是 number（新版索引）或 string（旧版地址）
 */
function resolvePlayerIndex(session: GameSession, player: number | string | undefined): number {
    if (player === undefined || player === null) return -1;
    if (typeof player === 'number') return player;
    return getPlayerIndexByAddress(session, player);
}

/**
 * EventLogFormatter 类
 * 将事件数据格式化为富文本日志
 */
export class EventLogFormatter {

    /**
     * 格式化事件为日志条目
     * @param event 事件元数据
     * @param session 游戏会话（用于获取玩家信息）
     * @returns 格式化后的日志，如果事件不需要记录则返回null
     */
    static format(event: EventMetadata<any>, session: GameSession): FormattedLog | null {
        const timestamp = event.timestamp;

        switch (event.type) {
            case EventType.GAME_STARTED:
                return this.formatGameStarted(event.data, timestamp, session);

            case EventType.GAME_ENDED:
                return this.formatGameEnded(event.data, timestamp, session);

            case EventType.PLAYER_JOINED:
                return this.formatPlayerJoined(event.data, timestamp, session);

            case EventType.SKIP_TURN:
                return this.formatSkipTurn(event.data, timestamp, session);

            case EventType.ROUND_ENDED:
                return this.formatRoundEnded(event.data, timestamp);

            case EventType.BANKRUPT:
                return this.formatBankrupt(event.data, timestamp, session);

            case EventType.ROLL_AND_STEP_ACTION:
                return this.formatRollAndStep(event.data, timestamp, session);

            case EventType.USE_CARD_ACTION:
                return this.formatUseCard(event.data, timestamp, session);

            case EventType.BUILDING_DECISION:
                return this.formatBuildingDecision(event.data, timestamp, session);

            case EventType.RENT_DECISION:
                return this.formatRentDecision(event.data, timestamp, session);

            default:
                // 其他事件暂不记录
                return null;
        }
    }

    /**
     * 格式化游戏开始事件
     */
    private static formatGameStarted(
        data: GameStartedEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog {
        const startingIdx = getPlayerIndexByAddress(session, data.starting_player);
        const playerName = startingIdx >= 0 ? coloredPlayerName(startingIdx) : '玩家';

        return {
            text: `${formatTime(timestamp)} ${colored('游戏开始', 'system')}，${playerName} 先手`,
            timestamp,
            playerIndex: -1,
            eventType: EventType.GAME_STARTED,
        };
    }

    /**
     * 格式化游戏结束事件
     */
    private static formatGameEnded(
        data: GameEndedEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog {
        let text = `${formatTime(timestamp)} ${colored('游戏结束', 'warning')}`;

        if (data.winner !== undefined && data.winner !== null) {
            const winnerIdx = resolvePlayerIndex(session, data.winner);
            const winnerName = winnerIdx >= 0 ? coloredPlayerName(winnerIdx) : '玩家';
            text += `，${winnerName} 获胜！`;
        } else {
            const reasonText = data.reason === 1 ? '（达到最大回合数）' : '';
            text += `，平局${reasonText}`;
        }

        return {
            text,
            timestamp,
            playerIndex: -1,
            eventType: EventType.GAME_ENDED,
        };
    }

    /**
     * 格式化玩家加入事件
     */
    private static formatPlayerJoined(
        data: PlayerJoinedEvent,
        timestamp: number,
        _session: GameSession
    ): FormattedLog {
        return {
            text: `${formatTime(timestamp)} ${coloredPlayerName(data.player_index)} 加入游戏`,
            timestamp,
            playerIndex: data.player_index,
            eventType: EventType.PLAYER_JOINED,
        };
    }

    /**
     * 格式化跳过回合事件
     */
    private static formatSkipTurn(
        data: SkipTurnEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog {
        const playerIdx = resolvePlayerIndex(session, data.player);
        const playerName = playerIdx >= 0 ? coloredPlayerName(playerIdx) : '玩家';

        const reasonText = data.reason === 2 ? '住院中' : '跳过';

        return {
            text: `${formatTime(timestamp)} ${playerName} ${colored(reasonText, 'warning')}，跳过回合 (剩余${data.remaining_turns}回合)`,
            timestamp,
            playerIndex: playerIdx,
            eventType: EventType.SKIP_TURN,
        };
    }

    /**
     * 格式化轮次结束事件
     */
    private static formatRoundEnded(
        data: RoundEndedEvent,
        timestamp: number
    ): FormattedLog {
        let text = `${formatTime(timestamp)} 第${data.round}轮结束`;

        if (data.npc_kind !== 0) {
            const npcName = getNpcName(data.npc_kind);
            text += `，生成 ${colored(npcName, 'highlight')} 于地块${data.tile_id}`;
        }

        return {
            text,
            timestamp,
            playerIndex: -1,
            eventType: EventType.ROUND_ENDED,
        };
    }

    /**
     * 格式化破产事件
     */
    private static formatBankrupt(
        data: BankruptEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog {
        const playerIdx = resolvePlayerIndex(session, data.player);
        const playerName = playerIdx >= 0 ? coloredPlayerName(playerIdx) : '玩家';

        let text = `${formatTime(timestamp)} ${playerName} ${colored('破产！', 'warning')}`;
        text += ` 负债 ${coloredAmount(-Number(data.debt), false)}`;

        if (data.creditor !== undefined && data.creditor !== null) {
            const creditorIdx = resolvePlayerIndex(session, data.creditor);
            const creditorName = creditorIdx >= 0 ? coloredPlayerName(creditorIdx) : '玩家';
            text += `，债权人: ${creditorName}`;
        }

        return {
            text,
            timestamp,
            playerIndex: playerIdx,
            eventType: EventType.BANKRUPT,
        };
    }

    /**
     * 格式化掷骰移动事件
     * 这是最复杂的事件，包含多个子事件
     */
    private static formatRollAndStep(
        data: RollAndStepActionEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog {
        const playerIdx = resolvePlayerIndex(session, data.player);
        const playerName = playerIdx >= 0 ? coloredPlayerName(playerIdx) : '玩家';

        const lines: string[] = [];

        // 1. 掷骰信息
        const diceTotal = data.dice_values?.reduce((a: number, b: number) => a + b, 0) ?? 0;
        lines.push(`${formatTime(timestamp)} ${playerName} 掷出 ${colored(diceTotal.toString(), 'highlight')} 点`);

        // 2. 处理每一步的效果
        if (data.steps && data.steps.length > 0) {
        for (const step of data.steps) {
            // NPC交互
            if (step.npc_event) {
                const npcName = getNpcName(step.npc_event.kind);
                if (step.npc_event.result === 1) {
                    lines.push(`  └ 触发 ${colored(npcName, 'warning')}，被送往医院`);
                } else if (step.npc_event.result === 2) {
                    lines.push(`  └ 遇到 ${colored(npcName, 'warning')}，停止移动`);
                }
            }

            // 路过获得卡牌
            if (step.pass_draws && step.pass_draws.length > 0) {
                const cardNames = step.pass_draws
                    .map(c => {
                        const kind = getCardKind(c);
                        return getCardName(typeof kind === 'number' ? kind : -1);
                    })
                    .join('、');
                lines.push(`  └ 路过获得 ${colored(cardNames, 'positive')}`);
            }

            // 停留效果
            if (step.stop_effect) {
                const stopLines = this.formatStopEffect(step.stop_effect, session, playerIdx);
                lines.push(...stopLines);
            }
        }
        }

        // 3. 现金变动汇总（如果有多个）
        const cashChanges = this.summarizeCashChanges(data.cash_changes, session);
        if (cashChanges.length > 0) {
            lines.push(...cashChanges);
        }

        return {
            text: lines.join('\n'),
            timestamp,
            playerIndex: playerIdx,
            eventType: EventType.ROLL_AND_STEP_ACTION,
        };
    }

    /**
     * 格式化停留效果
     */
    private static formatStopEffect(
        stop: any,
        session: GameSession,
        actorIdx: number
    ): string[] {
        const lines: string[] = [];

        if (!stop) return lines;

        // 获得卡牌
        if (stop.card_gains && stop.card_gains.length > 0) {
            const cardNames = stop.card_gains
                .map((c: any) => {
                    const kind = getCardKind(c);
                    return getCardName(typeof kind === 'number' ? kind : -1);
                })
                .join('、');
            lines.push(`  └ 获得 ${colored(cardNames, 'positive')}`);
        }

        // 停留类型处理
        switch (stop.stop_type) {
            case 1: // 支付过路费
                if (stop.owner !== undefined && stop.owner !== null) {
                    const ownerIdx = resolvePlayerIndex(session, stop.owner);
                    const ownerName = ownerIdx >= 0 ? coloredPlayerName(ownerIdx) : '地主';
                    lines.push(`  └ 支付过路费 ${coloredAmount(-Number(stop.amount), false)} 给 ${ownerName}`);
                }
                break;

            case 2: // 免租通过
                lines.push(`  └ ${colored('免租通过', 'positive')}`);
                break;

            case 3: // 送往医院
                lines.push(`  └ ${colored('被送往医院', 'warning')} (${stop.turns}回合)`);
                break;

            case 5: // 获得奖金
                lines.push(`  └ 获得奖金 ${coloredAmount(Number(stop.amount))}`);
                break;

            case 6: // 支付罚款
                lines.push(`  └ 支付罚款 ${coloredAmount(-Number(stop.amount), false)}`);
                break;

            case 8: // 可购买地产（不记录，由decision事件处理）
                break;

            case 9: // LAND_SEIZE - 土地神附身抢地
                lines.push(`  └ ${colored('土地神附身', 'warning')}，免费占有地产`);
                break;
        }

        return lines;
    }

    /**
     * 汇总现金变动
     */
    private static summarizeCashChanges(
        changes: CashDelta[],
        session: GameSession
    ): string[] {
        // 现金变动在stop_effect中已经记录，这里不重复
        // 但如果有跨玩家的转账，可以在这里补充
        return [];
    }

    /**
     * 格式化使用卡牌事件
     */
    private static formatUseCard(
        data: UseCardActionEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog {
        const playerIdx = resolvePlayerIndex(session, data.player);
        const playerName = playerIdx >= 0 ? coloredPlayerName(playerIdx) : '玩家';
        const cardName = colored(getCardName(data.kind), 'highlight');

        let text = `${formatTime(timestamp)} ${playerName} 使用 ${cardName}`;

        // 解析卡牌参数
        if (data.params && data.params.length > 0) {
            const targetParam = data.params[0];
            // 如果第一个参数是玩家索引
            if (targetParam >= 0 && targetParam < 4) {
                text += ` 对 ${coloredPlayerName(targetParam)}`;
            }
        }

        // Buff变更
        if (data.buff_changes && data.buff_changes.length > 0) {
            for (const buff of data.buff_changes) {
                const targetIdx = resolvePlayerIndex(session, buff.target);
                const targetName = targetIdx >= 0 ? coloredPlayerName(targetIdx) : '目标';
                text += `\n  └ ${targetName} 获得Buff效果`;
            }
        }

        // NPC变更
        if (data.npc_changes && data.npc_changes.length > 0) {
            for (const npc of data.npc_changes) {
                const npcName = getNpcName(npc.kind);
                if (npc.action === 1) {
                    text += `\n  └ 在地块${npc.tile_id}放置 ${colored(npcName, 'highlight')}`;
                } else if (npc.action === 2) {
                    text += `\n  └ 移除地块${npc.tile_id}的 ${npcName}`;
                }
            }
        }

        return {
            text,
            timestamp,
            playerIndex: playerIdx,
            eventType: EventType.USE_CARD_ACTION,
        };
    }

    /**
     * 格式化建筑决策事件
     */
    private static formatBuildingDecision(
        data: BuildingDecisionEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog | null {
        if (!data.decision) {
            return null; // 没有实际决策，不记录
        }

        const playerIdx = resolvePlayerIndex(session, data.player);
        const playerName = playerIdx >= 0 ? coloredPlayerName(playerIdx) : '玩家';

        const decision = data.decision;
        const amount = Number(decision.amount);

        let text: string;
        if (decision.decision_type === 1) {
            // 购买
            text = `${formatTime(timestamp)} ${playerName} 购买地产 ${coloredAmount(-amount, false)}`;
        } else {
            // 升级
            text = `${formatTime(timestamp)} ${playerName} 升级地产至 Lv.${decision.new_level} ${coloredAmount(-amount, false)}`;
        }

        return {
            text,
            timestamp,
            playerIndex: playerIdx,
            eventType: EventType.BUILDING_DECISION,
        };
    }

    /**
     * 格式化租金决策事件
     */
    private static formatRentDecision(
        data: RentDecisionEvent,
        timestamp: number,
        session: GameSession
    ): FormattedLog | null {
        if (!data.decision) {
            return null;
        }

        const decision = data.decision;
        const payerIdx = resolvePlayerIndex(session, decision.payer);
        const ownerIdx = resolvePlayerIndex(session, decision.owner);

        const payerName = payerIdx >= 0 ? coloredPlayerName(payerIdx) : '玩家';
        const ownerName = ownerIdx >= 0 ? coloredPlayerName(ownerIdx) : '地主';

        let text: string;
        if (decision.used_rent_free) {
            text = `${formatTime(timestamp)} ${payerName} 使用 ${colored('免租卡', 'positive')} 免除租金`;
        } else {
            const amount = Number(decision.rent_amount);
            text = `${formatTime(timestamp)} ${payerName} 支付租金 ${coloredAmount(-amount, false)} 给 ${ownerName}`;
        }

        return {
            text,
            timestamp,
            playerIndex: payerIdx,
            eventType: EventType.RENT_DECISION,
        };
    }
}
