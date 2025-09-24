/**
 * Tycoon游戏事件常量定义
 * 对应Move端的常量定义
 *
 * Move源文件:
 * - move/tycoon/sources/events.move
 * - move/tycoon/sources/types.move
 */

// ===== NPC操作常量 =====

/**
 * NPC操作类型
 */
export const NPC_ACTION = {
    /** 生成NPC */
    SPAWN: 1,
    /** 移除NPC */
    REMOVE: 2,
    /** NPC触发（击中） */
    HIT: 3
} as const;

export type NpcAction = typeof NPC_ACTION[keyof typeof NPC_ACTION];

// ===== NPC结果常量 =====

/**
 * NPC步骤结果类型
 */
export const NPC_RESULT = {
    /** 无效果 */
    NONE: 0,
    /** 送往医院 */
    SEND_HOSPITAL: 1,
    /** 路障阻挡 */
    BARRIER_STOP: 2
} as const;

export type NpcResult = typeof NPC_RESULT[keyof typeof NPC_RESULT];

// ===== 停留类型常量 =====

/**
 * 地块停留类型
 */
export const STOP_TYPE = {
    /** 无停留效果 */
    NONE: 0,
    /** 地产过路费 */
    PROPERTY_TOLL: 1,
    /** 地产免租 */
    PROPERTY_NO_RENT: 2,
    /** 医院 */
    HOSPITAL: 3,
    /** 监狱 */
    PRISON: 4,
    /** 奖金 */
    BONUS: 5,
    /** 罚款 */
    FEE: 6,
    /** 卡牌停留 */
    CARD_STOP: 7,
    /** 无主地产（可购买） */
    PROPERTY_UNOWNED: 8
} as const;

export type StopType = typeof STOP_TYPE[keyof typeof STOP_TYPE];

// ===== 地块类型常量 (来自types.move) =====

/**
 * 地块类型
 */
export const TILE_KIND = {
    /** 空地块 */
    EMPTY: 0,
    /** 地产 */
    PROPERTY: 1,
    /** 医院 */
    HOSPITAL: 2,
    /** 监狱 */
    PRISON: 3,
    /** 机会 */
    CHANCE: 4,
    /** 奖金 */
    BONUS: 5,
    /** 罚款 */
    FEE: 6,
    /** 卡牌 */
    CARD: 7,
    /** 新闻 */
    NEWS: 8,
    /** 彩票 */
    LOTTERY: 9,
    /** 商店 */
    SHOP: 10
} as const;

export type TileKind = typeof TILE_KIND[keyof typeof TILE_KIND];

// ===== NPC类型常量 (来自types.move) =====

/**
 * NPC种类
 */
export const NPC_KIND = {
    /** 路障 */
    BARRIER: 20,
    /** 炸弹 */
    BOMB: 21,
    /** 狗 */
    DOG: 22
} as const;

export type NpcKind = typeof NPC_KIND[keyof typeof NPC_KIND];

// ===== 卡牌类型常量 (来自types.move) =====

/**
 * 卡牌种类
 */
export const CARD_KIND = {
    /** 遥控骰子 */
    MOVE_CTRL: 1,
    /** 路障卡 */
    BARRIER: 2,
    /** 炸弹卡 */
    BOMB: 10,
    /** 狗卡 */
    DOG: 11,
    /** 免租卡 */
    RENT_FREE: 20,
    /** 冻结卡 */
    FREEZE: 30,
    /** 清除卡 */
    CLEANSE: 41,
    /** 转向卡 */
    TURN: 50
} as const;

export type CardKind = typeof CARD_KIND[keyof typeof CARD_KIND];

// ===== Buff类型常量 (来自types.move) =====

/**
 * Buff种类
 */
export const BUFF_KIND = {
    /** 移动控制 */
    MOVE_CTRL: 1,
    /** 冻结 */
    FROZEN: 2,
    /** 免租 */
    RENT_FREE: 3
} as const;

export type BuffKind = typeof BUFF_KIND[keyof typeof BUFF_KIND];

// ===== 游戏阶段常量 (来自types.move) =====

/**
 * 游戏阶段
 */
export const PHASE = {
    /** 掷骰阶段 */
    ROLL: 1,
    /** 移动阶段 */
    MOVE: 2,
    /** 结算阶段 */
    SETTLE: 3,
    /** 管理阶段 */
    MANAGE: 4,
    /** 事件阶段 */
    EVENTS: 5,
    /** 结束阶段 */
    END: 6
} as const;

export type Phase = typeof PHASE[keyof typeof PHASE];

// ===== 移动方向模式常量 (来自types.move) =====

/**
 * 移动方向模式
 */
export const DIR_MODE = {
    /** 自动选择 */
    AUTO: 0,
    /** 顺时针 */
    CW: 1,
    /** 逆时针 */
    CCW: 2,
    /** 强制顺时针 */
    FORCED_CW: 3,
    /** 强制逆时针 */
    FORCED_CCW: 4
} as const;

export type DirMode = typeof DIR_MODE[keyof typeof DIR_MODE];

// ===== 游戏状态常量 (来自types.move) =====

/**
 * 游戏状态
 */
export const GAME_STATUS = {
    /** 准备中 */
    READY: 0,
    /** 进行中 */
    ACTIVE: 1,
    /** 已结束 */
    ENDED: 2
} as const;

export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

// ===== 地块大小常量 (来自types.move) =====

/**
 * 地块大小
 */
export const TILE_SIZE = {
    /** 1x1标准地块 */
    SIZE_1X1: 1,
    /** 2x2大型地块 */
    SIZE_2X2: 2
} as const;

export type TileSize = typeof TILE_SIZE[keyof typeof TILE_SIZE];

// ===== 地产等级常量 (来自types.move) =====

/**
 * 地产等级
 */
export const PROPERTY_LEVEL = {
    /** 空地 */
    LEVEL_0: 0,
    /** 一级建筑 */
    LEVEL_1: 1,
    /** 二级建筑 */
    LEVEL_2: 2,
    /** 三级建筑 */
    LEVEL_3: 3,
    /** 四级建筑（最高级） */
    LEVEL_4: 4
} as const;

export type PropertyLevel = typeof PROPERTY_LEVEL[keyof typeof PROPERTY_LEVEL];

// ===== 默认配置常量 (来自types.move) =====

/**
 * 默认游戏配置
 */
export const DEFAULT_CONFIG = {
    /** 最大玩家数 */
    MAX_PLAYERS: 4,
    /** 最大回合数 */
    MAX_TURNS: 100n,  // bigint
    /** NPC数量上限 */
    NPC_CAP: 10,
    /** 起始现金 */
    STARTING_CASH: 10000n,  // bigint
    /** 医院停留回合数 */
    HOSPITAL_TURNS: 2,
    /** 监狱停留回合数 */
    PRISON_TURNS: 2
} as const;

// ===== 辅助函数 =====

/**
 * 获取地块类型名称
 */
export function getTileKindName(kind: TileKind): string {
    const names: Record<TileKind, string> = {
        [TILE_KIND.EMPTY]: '空地',
        [TILE_KIND.PROPERTY]: '地产',
        [TILE_KIND.HOSPITAL]: '医院',
        [TILE_KIND.PRISON]: '监狱',
        [TILE_KIND.CHANCE]: '机会',
        [TILE_KIND.BONUS]: '奖金',
        [TILE_KIND.FEE]: '罚款',
        [TILE_KIND.CARD]: '卡牌',
        [TILE_KIND.NEWS]: '新闻',
        [TILE_KIND.LOTTERY]: '彩票',
        [TILE_KIND.SHOP]: '商店'
    };
    return names[kind] || '未知';
}

/**
 * 获取NPC类型名称
 */
export function getNpcKindName(kind: NpcKind): string {
    const names: Record<NpcKind, string> = {
        [NPC_KIND.BARRIER]: '路障',
        [NPC_KIND.BOMB]: '炸弹',
        [NPC_KIND.DOG]: '狗'
    };
    return names[kind] || '未知';
}

/**
 * 获取卡牌类型名称
 */
export function getCardKindName(kind: CardKind): string {
    const names: Record<CardKind, string> = {
        [CARD_KIND.MOVE_CTRL]: '遥控骰子',
        [CARD_KIND.BARRIER]: '路障卡',
        [CARD_KIND.BOMB]: '炸弹卡',
        [CARD_KIND.DOG]: '狗卡',
        [CARD_KIND.RENT_FREE]: '免租卡',
        [CARD_KIND.FREEZE]: '冻结卡',
        [CARD_KIND.CLEANSE]: '清除卡',
        [CARD_KIND.TURN]: '转向卡'
    };
    return names[kind] || '未知';
}

/**
 * 获取Buff类型名称
 */
export function getBuffKindName(kind: BuffKind): string {
    const names: Record<BuffKind, string> = {
        [BUFF_KIND.MOVE_CTRL]: '移动控制',
        [BUFF_KIND.FROZEN]: '冻结',
        [BUFF_KIND.RENT_FREE]: '免租'
    };
    return names[kind] || '未知';
}

/**
 * 获取游戏阶段名称
 */
export function getPhaseName(phase: Phase): string {
    const names: Record<Phase, string> = {
        [PHASE.ROLL]: '掷骰',
        [PHASE.MOVE]: '移动',
        [PHASE.SETTLE]: '结算',
        [PHASE.MANAGE]: '管理',
        [PHASE.EVENTS]: '事件',
        [PHASE.END]: '结束'
    };
    return names[phase] || '未知';
}

/**
 * 获取停留类型描述
 */
export function getStopTypeDescription(type: StopType): string {
    const descriptions: Record<StopType, string> = {
        [STOP_TYPE.NONE]: '无效果',
        [STOP_TYPE.PROPERTY_TOLL]: '支付过路费',
        [STOP_TYPE.PROPERTY_NO_RENT]: '免租通过',
        [STOP_TYPE.HOSPITAL]: '进入医院',
        [STOP_TYPE.PRISON]: '进入监狱',
        [STOP_TYPE.BONUS]: '获得奖金',
        [STOP_TYPE.FEE]: '支付罚款',
        [STOP_TYPE.CARD_STOP]: '抽取卡牌',
        [STOP_TYPE.PROPERTY_UNOWNED]: '可购买地产'
    };
    return descriptions[type] || '未知效果';
}

/**
 * 判断地块是否可停留
 */
export function isStoppableTile(kind: TileKind): boolean {
    return kind === TILE_KIND.PROPERTY ||
           kind === TILE_KIND.HOSPITAL ||
           kind === TILE_KIND.PRISON ||
           kind === TILE_KIND.CHANCE ||
           kind === TILE_KIND.BONUS ||
           kind === TILE_KIND.FEE ||
           kind === TILE_KIND.CARD ||
           kind === TILE_KIND.LOTTERY ||
           kind === TILE_KIND.SHOP;
}

/**
 * 判断地块是否可购买
 */
export function isPurchasableTile(kind: TileKind): boolean {
    return kind === TILE_KIND.PROPERTY;
}

/**
 * 判断是否为特殊地块（非地产）
 */
export function isSpecialTile(kind: TileKind): boolean {
    return kind !== TILE_KIND.PROPERTY && kind !== TILE_KIND.EMPTY;
}