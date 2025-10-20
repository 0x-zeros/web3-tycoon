/**
 * 游戏常量定义
 * 完全对应Move端的types.move文件
 *
 * Move源文件: move/tycoon/sources/types.move
 */

// ===== TileKind 地块类型 =====
export enum TileKind {
    EMPTY = 0,
    LOTTERY = 1,
    HOSPITAL = 2,
    CHANCE = 3,
    BONUS = 4,
    FEE = 5,
    CARD = 6,
    NEWS = 7
}

// ===== BuildingType 建筑类型 =====
export enum BuildingType {
    NONE = 0,           // 无类型（1x1建筑或2x2未选择）
    TEMPLE = 20,        // 土地庙（2x2专属）
    RESEARCH = 21,      // 研究所
    OIL = 22,          // 石油公司
    COMMERCIAL = 23,    // 商业中心
    HOTEL = 24         // 大饭店
}

// ===== Size 建筑大小 =====
export enum BuildingSize {
    SIZE_1X1 = 1,
    SIZE_2X2 = 2
}

// ===== Level 建筑等级 =====
export enum BuildingLevel {
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

//使用连续编号，作为move端vector的索引
// ===== CardKind 卡牌类型 =====
export enum CardKind {
    MOVE_CTRL = 0,      // 遥控骰子
    BARRIER = 1,        // 路障卡
    BOMB = 2,          // 炸弹卡
    RENT_FREE = 3,     // 免租卡
    FREEZE = 4,        // 冰冻卡
    DOG = 5,           // 恶犬卡
    CLEANSE = 6,       // 净化卡
    TURN = 7           // 转向卡
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

/**
 * 决策类型（用于事件）
 * 对应Move: types.move 中的 DECISION_* 常量
 */
export enum DecisionType {
    NONE = 0,
    BUY_PROPERTY = 1,
    UPGRADE_PROPERTY = 2,
    PAY_RENT = 3
}

// ===== SkipReason 跳过回合原因 =====
export enum SkipReason {
    PRISON = 1,    // 监狱
    HOSPITAL = 2   // 医院
}

// ===== 特殊常量 =====
export const NO_OWNER = 255;          // 无所有者（u8 max）
export const NO_BUILDING = 65535;     // 无建筑（u16 max）
export const INVALID_TILE_ID = 65535; // 无效tile_id（u16 max）

// ===== 默认配置 =====
export const DEFAULT_MAX_PLAYERS = 4;
export const DEFAULT_MAX_ROUNDS = 100;
export const DEFAULT_HOSPITAL_TURNS = 2;
export const DEFAULT_PRISON_TURNS = 2;

// ===== 默认数值配置（编辑器初始值，可微调） =====

/**
 * 建筑默认价格
 * 注：编辑器可为每个建筑单独设置，这些是默认值
 */
export const DEFAULT_BUILDING_PRICE_1X1 = 2000n;  // 1x1建筑基础价格
export const DEFAULT_BUILDING_PRICE_2X2 = 5000n;  // 2x2建筑基础价格

/**
 * Tile特殊数值默认值
 * 注：编辑器可为每个tile单独设置，这些是默认值
 */
export const DEFAULT_TILE_BONUS_AMOUNT = 2000n;   // 奖励金额
export const DEFAULT_TILE_FEE_AMOUNT = 2000n;     // 罚款金额

// ===== 辅助函数（对应Move端的判断函数） =====

/**
 * 判断building_type是否为有效的2x2建筑类型
 */
export function isLargeBuildingType(buildingType: number): boolean {
    return buildingType >= BuildingType.TEMPLE && buildingType <= BuildingType.HOTEL;
}

/**
 * 判断是否为小建筑
 */
export function isSmallBuilding(size: number): boolean {
    return size === BuildingSize.SIZE_1X1;
}

/**
 * 判断是否为大建筑
 */
export function isLargeBuilding(size: number): boolean {
    return size === BuildingSize.SIZE_2X2;
}

/**
 * 获取游戏状态的中文文本
 */
export function getGameStatusText(status: number): string {
    switch (status) {
        case GameStatus.READY: return '准备中';
        case GameStatus.ACTIVE: return '进行中';
        case GameStatus.ENDED: return '已结束';
        default: return '未知';
    }
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
    BUILDING_TOLL = 1,         // 建筑过路费
    BUILDING_NO_RENT = 2,      // 建筑免租
    HOSPITAL = 3,              // 医院
    PRISON = 4,                // 监狱
    BONUS = 5,                 // 奖金
    FEE = 6,                   // 罚款
    CARD_STOP = 7,             // 卡片停留
    BUILDING_UNOWNED = 8       // 无主建筑（可购买）
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