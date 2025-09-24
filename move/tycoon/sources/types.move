module tycoon::types;

// ===== TileKind 地块类型 =====
const TILE_EMPTY: u8 = 0;
const TILE_PROPERTY: u8 = 1;
const TILE_HOSPITAL: u8 = 2;
const TILE_PRISON: u8 = 3;
const TILE_CHANCE: u8 = 4;
const TILE_BONUS: u8 = 5;
const TILE_FEE: u8 = 6;
const TILE_CARD: u8 = 7;
const TILE_NEWS: u8 = 8;
const TILE_LOTTERY: u8 = 9;
const TILE_SHOP: u8 = 10;

// Getter functions for backward compatibility
public fun tile_empty(): u8 { TILE_EMPTY }
public fun tile_property(): u8 { TILE_PROPERTY }
public fun tile_hospital(): u8 { TILE_HOSPITAL }
public fun tile_prison(): u8 { TILE_PRISON }
public fun tile_chance(): u8 { TILE_CHANCE }
public fun tile_bonus(): u8 { TILE_BONUS }
public fun tile_fee(): u8 { TILE_FEE }
public fun tile_card(): u8 { TILE_CARD }
public fun tile_news(): u8 { TILE_NEWS }
public fun tile_lottery(): u8 { TILE_LOTTERY }
public fun tile_shop(): u8 { TILE_SHOP }

// ===== Size 地块大小 =====
const SIZE_1X1: u8 = 1;
const SIZE_2X2: u8 = 2;

public fun size_1x1(): u8 { SIZE_1X1 }
public fun size_2x2(): u8 { SIZE_2X2 }

// ===== Level 地产等级 =====
const LEVEL_0: u8 = 0;
const LEVEL_1: u8 = 1;
const LEVEL_2: u8 = 2;
const LEVEL_3: u8 = 3;
const LEVEL_4: u8 = 4;

public fun level_0(): u8 { LEVEL_0 }
public fun level_1(): u8 { LEVEL_1 }
public fun level_2(): u8 { LEVEL_2 }
public fun level_3(): u8 { LEVEL_3 }
public fun level_4(): u8 { LEVEL_4 }

// ===== NpcKind NPC类型 =====
const NPC_BARRIER: u8 = 20;
const NPC_BOMB: u8 = 21;
const NPC_DOG: u8 = 22;

public fun npc_barrier(): u8 { NPC_BARRIER }
public fun npc_bomb(): u8 { NPC_BOMB }
public fun npc_dog(): u8 { NPC_DOG }

// ===== CardKind 卡牌类型 =====
const CARD_MOVE_CTRL: u8 = 1;
const CARD_BARRIER: u8 = 2;
const CARD_BOMB: u8 = 10;
const CARD_DOG: u8 = 11;
const CARD_RENT_FREE: u8 = 20;
const CARD_FREEZE: u8 = 30;
const CARD_CLEANSE: u8 = 41;
const CARD_TURN: u8 = 50;  // 转向卡

public fun card_move_ctrl(): u8 { CARD_MOVE_CTRL }
public fun card_barrier(): u8 { CARD_BARRIER }
public fun card_bomb(): u8 { CARD_BOMB }
public fun card_dog(): u8 { CARD_DOG }
public fun card_rent_free(): u8 { CARD_RENT_FREE }
public fun card_freeze(): u8 { CARD_FREEZE }
public fun card_cleanse(): u8 { CARD_CLEANSE }
public fun card_turn(): u8 { CARD_TURN }

// ===== BuffKind Buff类型 =====
const BUFF_MOVE_CTRL: u8 = 1;
const BUFF_FROZEN: u8 = 2;
const BUFF_RENT_FREE: u8 = 3;

public fun buff_move_ctrl(): u8 { BUFF_MOVE_CTRL }
public fun buff_frozen(): u8 { BUFF_FROZEN }
public fun buff_rent_free(): u8 { BUFF_RENT_FREE }

// ===== Phase 游戏阶段 =====
const PHASE_ROLL: u8 = 1;
const PHASE_MOVE: u8 = 2;
const PHASE_SETTLE: u8 = 3;
const PHASE_MANAGE: u8 = 4;
const PHASE_EVENTS: u8 = 5;
const PHASE_END: u8 = 6;

public fun phase_roll(): u8 { PHASE_ROLL }
public fun phase_move(): u8 { PHASE_MOVE }
public fun phase_settle(): u8 { PHASE_SETTLE }
public fun phase_manage(): u8 { PHASE_MANAGE }
public fun phase_events(): u8 { PHASE_EVENTS }
public fun phase_end(): u8 { PHASE_END }

// ===== DirMode 移动方向模式 =====
const DIR_CW: u8 = 0;   // 顺时针
const DIR_CCW: u8 = 1;  // 逆时针

public fun dir_cw(): u8 { DIR_CW }
public fun dir_ccw(): u8 { DIR_CCW }

// ===== GameStatus 游戏状态 =====
const STATUS_READY: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_ENDED: u8 = 2;

public fun status_ready(): u8 { STATUS_READY }
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_ended(): u8 { STATUS_ENDED }

// ===== PendingDecision 待决策类型 =====
const DECISION_NONE: u8 = 0;
const DECISION_BUY_PROPERTY: u8 = 1;      // 可以购买地产
const DECISION_UPGRADE_PROPERTY: u8 = 2;   // 可以升级地产
const DECISION_PAY_RENT: u8 = 3;          // 需要决定如何支付租金（有免租卡时）

public fun decision_none(): u8 { DECISION_NONE }
public fun decision_buy_property(): u8 { DECISION_BUY_PROPERTY }
public fun decision_upgrade_property(): u8 { DECISION_UPGRADE_PROPERTY }
public fun decision_pay_rent(): u8 { DECISION_PAY_RENT }

// ===== SkipReason 跳过回合原因 =====
const SKIP_PRISON: u8 = 1;
const SKIP_HOSPITAL: u8 = 2;

public fun skip_prison(): u8 { SKIP_PRISON }
public fun skip_hospital(): u8 { SKIP_HOSPITAL }

//   命名：
//   - round：轮次（所有玩家各行动一次）
//   - turn：轮内回合（0到player_count-1）
//   - max_rounds：最大轮数限制
// ===== Default Configs 默认配置 =====
const DEFAULT_MAX_PLAYERS: u8 = 4;
const DEFAULT_MAX_ROUNDS: u16 = 100;
const DEFAULT_STARTING_CASH: u64 = 10000;
const DEFAULT_HOSPITAL_TURNS: u8 = 2;
const DEFAULT_PRISON_TURNS: u8 = 2;

public fun default_max_players(): u8 { DEFAULT_MAX_PLAYERS }
public fun default_max_rounds(): u16 { DEFAULT_MAX_ROUNDS }
public fun default_starting_cash(): u64 { DEFAULT_STARTING_CASH }
public fun default_hospital_turns(): u8 { DEFAULT_HOSPITAL_TURNS }
public fun default_prison_turns(): u8 { DEFAULT_PRISON_TURNS }
