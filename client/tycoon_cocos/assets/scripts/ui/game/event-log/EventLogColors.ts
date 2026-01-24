/**
 * EventLogColors - 事件日志颜色常量
 *
 * 定义玩家颜色和事件类型颜色，用于富文本格式化
 *
 * @author Web3 Tycoon Team
 */
import { GameInitializer } from "../../../core/GameInitializer";
import { PlayerColors } from "../../../utils/PlayerColors";
import { PlayerDisplayHelper, NameSource } from "../../utils/PlayerDisplayHelper";

// 向后兼容：重新导出 PlayerColors
export { PlayerColors };

/**
 * 事件类型颜色
 */
export const EVENT_COLORS = {
    /** 正面事件 - 获得金币、卡牌等 */
    positive: '#4CAF50',
    /** 负面事件 - 支付、扣款等 */
    negative: '#F44336',
    /** 中性事件 - 普通信息 */
    neutral: '#9E9E9E',
    /** 高亮信息 - 关键数值 */
    highlight: '#2196F3',
    /** 警告事件 - 破产、住院等 */
    warning: '#FF9800',
    /** 系统事件 - 游戏开始、结束等 */
    system: '#FFFFFF',
    /** 时间戳 */
    timestamp: '#888888',
};

/**
 * 获取玩家颜色（向后兼容别名）
 * @param playerIndex 玩家索引 (0-3)
 * @returns hex颜色字符串
 */
export const getPlayerColor = PlayerColors.getHex;

/**
 * 生成带颜色的玩家名称UBB标签
 * @param playerIndex 玩家索引
 * @returns 带颜色的玩家名称
 */
export function coloredPlayerName(playerIndex: number): string {
    const color = getPlayerColor(playerIndex);
    const session = GameInitializer.getInstance()?.getGameSession();
    let playerName = `玩家${playerIndex + 1}`;

    if (session) {
        const player = session.getPlayerByIndex(playerIndex);
        if (player) {
            const result = PlayerDisplayHelper.getDisplayNameSync(player.getOwner(), false);
            // 只有当获取到非地址来源的名字时才使用
            if (result.source !== NameSource.ADDRESS) {
                playerName = result.name;
            }
        }
    }

    return `[color=${color}]${playerName}[/color]`;
}

/**
 * 生成带颜色的文本UBB标签
 * @param text 文本内容
 * @param color 颜色（hex或EVENT_COLORS的key）
 */
export function colored(text: string, color: string): string {
    // 如果是EVENT_COLORS的key，转换为实际颜色
    const actualColor = (EVENT_COLORS as any)[color] || color;
    return `[color=${actualColor}][b]${text}[/b][/color]`;
}

/**
 * 生成金额文本（正数绿色，负数红色）
 * @param amount 金额
 * @param showSign 是否显示正负号
 */
export function coloredAmount(amount: number | bigint, showSign: boolean = true): string {
    const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
    const isPositive = numAmount >= 0;
    const color = isPositive ? EVENT_COLORS.positive : EVENT_COLORS.negative;
    const sign = showSign ? (isPositive ? '+' : '') : '';
    return `[color=${color}]${sign}¥${Math.abs(numAmount)}[/color]`;
}
