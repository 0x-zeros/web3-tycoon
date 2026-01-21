/**
 * TeleportActionEvent 客户端类型定义
 * 对应 Move 端的 events.move 中的 TeleportActionEvent 结构
 *
 * Move源文件: move/tycoon/sources/events.move
 */

/**
 * 瞬移动作事件
 * 注意：瞬移卡不触发任何停留效果（购买/租金/NPC等）
 */
export interface TeleportActionEvent {
    /** 游戏ID */
    game: string;
    /** 使用卡牌的玩家索引 */
    player: number;
    /** 轮次 */
    round: number;
    /** 轮内回合 */
    turn_in_round: number;
    /** 被瞬移的玩家索引 */
    target_player: number;
    /** 使用卡牌的玩家索引 */
    source_player: number;
    /** 原位置 */
    from_pos: number;
    /** 目标位置 */
    to_pos: number;
}
