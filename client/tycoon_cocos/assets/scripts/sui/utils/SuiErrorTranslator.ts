/**
 * Sui Move 错误翻译器
 * 将 Move 合约的错误码翻译成用户友好的中文消息
 */

/**
 * Move 错误码到中文消息的映射表
 * 基于 move/tycoon/sources/*.move 中的错误码定义
 */
const ERROR_MESSAGES: Record<number, string> = {
    // ========== 玩家相关错误 (1xxx) ==========
    1001: "不是当前活跃玩家",
    1002: "本回合已经掷过骰子",
    1003: "游戏不匹配",
    1004: "游戏未开始",
    1005: "还未掷骰子",
    1006: "找不到玩家",

    // ========== 地块/NPC 错误 (2xxx) ==========
    2001: "地块被 NPC 占据",
    2002: "NPC 不存在",
    2003: "位置不匹配",
    2004: "不是建筑地块",
    2005: "建筑已被拥有",
    2006: "建筑未被拥有",
    2007: "不是建筑拥有者",
    2008: "无效的价格",
    2009: "已达到最大等级",
    2010: "现金不足",

    // ========== 地图错误 (3xxx) ==========
    3003: "地块已存在",
    3010: "地块 ID 超过最大值",
    3011: "地块 ID 必须连续",
    3012: "无效的下一个地块 ID",
    3013: "目标地块不存在",
    3021: "不支持的 schema 版本",

    // ========== 移动错误 (4xxx) ==========
    4001: "无效的移动",
    4002: "路径长度不足骰子值",
    4003: "非法路径：包含非邻居关系或回头路",

    // ========== 卡牌错误 (5xxx) ==========
    5001: "不拥有此卡牌",
    5002: "手牌已满",
    5003: "无效的卡牌目标",
    5004: "卡牌不存在",
    5005: "参数无效",
    5006: "无法使用转向卡（可能在初始位置）",

    // ========== 游戏状态错误 (6xxx) ==========
    6001: "游戏已满员",
    6002: "游戏已开始",
    6003: "游戏已结束",
    6004: "玩家数量不足",
    6005: "已经加入游戏",
    6006: "无效的决策",
    6007: "存在待决策",
    6008: "当前状态不应跳过回合",

    // ========== 经济/建筑错误 (7xxx) ==========
    7001: "资金不足",
    7002: "建筑已被拥有",
    7003: "不是建筑拥有者",
    7004: "已达到最大等级",
    7010: "不是 2x2 建筑",
    7011: "建筑类型已设置",
    7012: "无效的建筑类型",
    7013: "建筑已升级，无法选择类型",
    7014: "建筑不存在",

    // ========== NPC 系统错误 (8xxx) ==========
    8001: "NPC 生成池索引越界",
    8002: "地块索引越界",

    // ========== 地图相关错误 (9xxx) ==========
    9001: "地图不匹配",
};

/**
 * 错误信息接口
 */
export interface ErrorInfo {
    /** 原始错误码 */
    code: number | null;
    /** 中文错误消息 */
    message: string;
    /** 是否是 Move 错误 */
    isMoveError: boolean;
    /** 原始错误对象 */
    originalError: any;
}

/**
 * Sui 错误翻译器类
 */
export class SuiErrorTranslator {
    /**
     * 从错误对象中提取 Move 错误码
     * 支持多种错误格式：
     * - MoveAbort(MoveLocation { ... }, 4003)
     * - Error: ... MoveAbort(..., 4003) ...
     */
    private static extractMoveErrorCode(error: any): number | null {
        const errorStr = String(error);

        // 正则匹配 MoveAbort(..., 错误码)
        // 使用 .* 匹配任意内容（包括嵌套括号），s 标志让 . 匹配换行符
        const match = errorStr.match(/MoveAbort\(.*,\s*(\d+)\)/s);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }

        return null;
    }

    /**
     * 翻译错误码到中文消息
     */
    private static translateErrorCode(code: number): string {
        return ERROR_MESSAGES[code] || `未知错误 (错误码: ${code})`;
    }

    /**
     * 解析并翻译 Sui 错误
     * @param error 原始错误对象
     * @returns 错误信息
     */
    public static translate(error: any): ErrorInfo {
        // 提取错误码
        const code = this.extractMoveErrorCode(error);

        if (code !== null) {
            // Move 错误
            return {
                code,
                message: this.translateErrorCode(code),
                isMoveError: true,
                originalError: error
            };
        }

        // 非 Move 错误，返回原始消息
        const message = error instanceof Error ? error.message : String(error);
        return {
            code: null,
            message: this.formatGenericError(message),
            isMoveError: false,
            originalError: error
        };
    }

    /**
     * 格式化通用错误消息
     * 提取关键信息，去掉技术细节
     */
    private static formatGenericError(message: string): string {
        // 去掉 "Error: " 前缀
        message = message.replace(/^Error:\s*/i, '');

        // 常见错误类型处理
        if (message.includes('Dry run failed')) {
            return '交易模拟失败，请检查参数和余额';
        }

        if (message.includes('Insufficient gas')) {
            return 'Gas 不足，请充值 SUI';
        }

        if (message.includes('Transaction failed')) {
            return '交易失败';
        }

        if (message.includes('签名')) {
            return '用户取消签名';
        }

        if (message.includes('Not connected') || message.includes('No signer')) {
            return '钱包未连接';
        }

        // 截取前 100 个字符，避免过长
        if (message.length > 100) {
            return message.substring(0, 100) + '...';
        }

        return message;
    }

    /**
     * 获取完整的错误描述（用于 console 调试）
     */
    public static getDetailedError(error: any): string {
        const info = this.translate(error);

        if (info.isMoveError && info.code !== null) {
            return `Move 错误 [${info.code}]: ${info.message}`;
        }

        return `错误: ${info.message}`;
    }

    /**
     * 判断是否是特定错误码
     */
    public static isErrorCode(error: any, code: number): boolean {
        const extracted = this.extractMoveErrorCode(error);
        return extracted === code;
    }

    /**
     * 判断是否是 Move 错误
     */
    public static isMoveError(error: any): boolean {
        return this.extractMoveErrorCode(error) !== null;
    }
}
