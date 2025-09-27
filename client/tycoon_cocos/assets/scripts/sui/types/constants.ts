/**
 * 游戏常量定义
 * 完全对应Move端的types.move文件
 *
 * Move源文件: move/tycoon/sources/types.move
 */

// ===== TileKind 地块类型 =====
export enum TileKind {
    EMPTY = 0,
    PROPERTY = 1,
    HOSPITAL = 2,
    PRISON = 3,
    CHANCE = 4,
    BONUS = 5,
    FEE = 6,
    CARD = 7,
    NEWS = 8,
    LOTTERY = 9,
    SHOP = 10,

    // 大地产类型（2x2）
    TEMPLE = 20,        // 土地庙（影响周围地块租金）
    RESEARCH = 21,      // 研究所
    OIL = 22,          // 石油公司
    COMMERCIAL = 23,    // 商业中心
    HOTEL = 24         // 大饭店
}

// ===== Size 地块大小 =====
export enum PropertySize {
    SIZE_1X1 = 1,
    SIZE_2X2 = 2
}

// ===== Level 地产等级 =====
export enum PropertyLevel {
    LEVEL_0 = 0,
    LEVEL_1 = 1,
    LEVEL_2 = 2,
    LEVEL_3 = 3,
    LEVEL_4 = 4,
    LEVEL_5 = 5    // 新增，对应Move端的等级系统
}

// ===== NpcKind NPC类型 =====
export enum NpcKind {
    NONE = 0,           // 无NPC

    // 障碍型NPC
    BARRIER = 20,       // 路障
    BOMB = 21,         // 炸弹
    DOG = 22,          // 狗

    // 增益型NPC
    LAND_GOD = 23,     // 土地神
    WEALTH_GOD = 24,   // 财神
    FORTUNE_GOD = 25,  // 福神

    // 干扰型NPC
    POOR_GOD = 26      // 穷神
}

// ===== CardKind 卡牌类型 =====
export enum CardKind {
    MOVE_CTRL = 1,      // 遥控骰子
    BARRIER = 2,        // 路障卡
    BOMB = 10,         // 炸弹卡
    DOG = 11,          // 恶犬卡
    RENT_FREE = 20,    // 免租卡
    FREEZE = 30,       // 冰冻卡
    CLEANSE = 41,      // 净化卡
    TURN = 50          // 转向卡
}

// ===== BuffKind Buff类型 =====
export enum BuffKind {
    MOVE_CTRL = 1,          // 遥控骰子buff
    FROZEN = 2,             // 冰冻状态
    RENT_FREE = 3,          // 免租状态
    LAND_BLESSING = 4,      // 土地神祝福
    FORTUNE = 5             // 福神幸运
}

// ===== Phase 游戏阶段 =====
export enum GamePhase {
    ROLL = 1,      // 掷骰阶段
    MOVE = 2,      // 移动阶段
    SETTLE = 3,    // 结算阶段
    MANAGE = 4,    // 管理阶段
    EVENTS = 5,    // 事件阶段
    END = 6        // 结束阶段
}

// ===== DirMode 移动方向模式 =====
export enum DirMode {
    CW = 0,        // 顺时针
    CCW = 1        // 逆时针
}

// ===== GameStatus 游戏状态 =====
export enum GameStatus {
    READY = 0,     // 准备中
    ACTIVE = 1,    // 进行中
    ENDED = 2      // 已结束
}

// ===== PendingDecision 待决策类型 =====
export enum PendingDecision {
    NONE = 0,                   // 无待决策
    BUY_PROPERTY = 1,          // 可以购买地产
    UPGRADE_PROPERTY = 2,      // 可以升级地产
    PAY_RENT = 3               // 需要决定如何支付租金（有免租卡时）
}

// ===== SkipReason 跳过回合原因 =====
export enum SkipReason {
    PRISON = 1,    // 监狱
    HOSPITAL = 2   // 医院
}

// ===== 特殊常量 =====
export const NO_OWNER = 255;        // 无所有者（u8 max）
export const NO_PROPERTY = 65535;   // 非地产地块（u16 max）

// ===== 默认配置 =====
export const DEFAULT_MAX_PLAYERS = 4;
export const DEFAULT_MAX_ROUNDS = 100;
export const DEFAULT_HOSPITAL_TURNS = 2;
export const DEFAULT_PRISON_TURNS = 2;

// ===== 辅助函数（对应Move端的判断函数） =====

/**
 * 判断是否为地产（包括小地产和大地产）
 */
export function isProperty(kind: number): boolean {
    return kind === TileKind.PROPERTY ||
           (kind >= TileKind.TEMPLE && kind <= TileKind.HOTEL);
}

/**
 * 判断是否为小地产
 */
export function isSmallProperty(size: number, kind: number): boolean {
    return size === PropertySize.SIZE_1X1 && isProperty(kind);
}

/**
 * 判断是否为大地产
 */
export function isLargeProperty(size: number, kind: number): boolean {
    return size === PropertySize.SIZE_2X2 && isProperty(kind);
}

// ===== NPC操作常量（对应events.move） =====
export enum NpcAction {
    SPAWN = 1,     // 生成NPC
    REMOVE = 2,    // 移除NPC
    HIT = 3        // NPC触发
}

// ===== NPC结果常量 =====
export enum NpcResult {
    NONE = 0,              // 无效果
    SEND_HOSPITAL = 1,     // 送往医院
    BARRIER_STOP = 2       // 路障阻挡
}

// ===== 停留类型常量 =====
export enum StopType {
    NONE = 0,                  // 无停留效果
    PROPERTY_TOLL = 1,         // 地产过路费
    PROPERTY_NO_RENT = 2,      // 地产免租
    HOSPITAL = 3,              // 医院
    PRISON = 4,                // 监狱
    BONUS = 5,                 // 奖金
    FEE = 6,                   // 罚款
    CARD_STOP = 7,             // 卡片停留
    PROPERTY_UNOWNED = 8       // 无主地产（可购买）
}

// ===== 现金变动原因 =====
export enum CashReason {
    TOLL = 1,      // 过路费
    BUY = 2,       // 购买
    UPGRADE = 3,   // 升级
    BONUS = 4,     // 奖金
    FEE = 5,       // 罚款
    CARD = 6       // 卡牌效果
}

// ===== 游戏结束原因 =====
export enum GameEndReason {
    NORMAL = 0,           // 正常结束
    MAX_ROUNDS = 1,       // 达到最大回合数
    ONE_PLAYER_LEFT = 2   // 只剩一个玩家
}