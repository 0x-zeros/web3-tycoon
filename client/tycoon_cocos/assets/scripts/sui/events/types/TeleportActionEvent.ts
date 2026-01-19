/**
 * TeleportActionEvent 客户端类型定义
 * 对应 Move 端的 events.move 中的 TeleportActionEvent 结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

import type { StopEffect, CashDelta } from './RollAndStepEvent';

/**
 * 瞬移动作事件
 */
export interface TeleportActionEvent {
    /** 游戏ID */
    game: string;
    /** 使用卡牌的玩家地址 */
    player: string;
    /** 轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 被瞬移的玩家地址 */
    target_player: string;
    /** 原位置 */
    from_pos: number;
    /** 目标位置 */
    to_pos: number;
    /** 停留效果（如购买/租金/奖金等） */
    stop_effect: StopEffect | null;
    /** 现金变动列表 */
    cash_changes: CashDelta[];
}
