module tycoon::types;

// ===== TileKind 地块类型 =====
public fun TILE_EMPTY(): u8 { 0 }
public fun TILE_LOTTERY(): u8 { 1 }
public fun TILE_HOSPITAL(): u8 { 2 }
public fun TILE_PRISON(): u8 { 3 }
public fun TILE_CHANCE(): u8 { 4 }
public fun TILE_BONUS(): u8 { 5 }
public fun TILE_FEE(): u8 { 6 }
public fun TILE_CARD(): u8 { 7 }
public fun TILE_NEWS(): u8 { 8 }
public fun TILE_SHOP(): u8 { 10 }

// ===== BuildingType 建筑类型 =====
// 无类型（1x1建筑 或 2x2未选择类型时使用）
public fun BUILDING_NONE(): u8 { 0 }
// 土地庙（影响周围地块租金，2x2专属）
public fun BUILDING_TEMPLE(): u8 { 20 }
// 研究所（2x2专属）
public fun BUILDING_RESEARCH(): u8 { 21 }
// 石油公司（2x2专属）
public fun BUILDING_OIL(): u8 { 22 }
// 商业中心（2x2专属）
public fun BUILDING_COMMERCIAL(): u8 { 23 }
// 大饭店（2x2专属）
public fun BUILDING_HOTEL(): u8 { 24 }

// ===== Size 地块大小 =====
public fun SIZE_1X1(): u8 { 1 }
public fun SIZE_2X2(): u8 { 2 }

// ===== Level 地产等级 =====
public fun LEVEL_0(): u8 { 0 }
public fun LEVEL_1(): u8 { 1 }
public fun LEVEL_2(): u8 { 2 }
public fun LEVEL_3(): u8 { 3 }
public fun LEVEL_4(): u8 { 4 }

// ===== NpcKind NPC类型 =====
public fun NPC_BARRIER(): u8 { 20 }
public fun NPC_BOMB(): u8 { 21 }
public fun NPC_DOG(): u8 { 22 }

// 增益型NPC
public fun NPC_LAND_GOD(): u8 { 23 }      // 土地神
public fun NPC_WEALTH_GOD(): u8 { 24 }    // 财神
public fun NPC_FORTUNE_GOD(): u8 { 25 }   // 福神

// 干扰型NPC
public fun NPC_POOR_GOD(): u8 { 26 }      // 穷神

// ===== CardKind 卡牌类型 =====
public fun CARD_MOVE_CTRL(): u8 { 1 }
public fun CARD_BARRIER(): u8 { 2 }
public fun CARD_BOMB(): u8 { 10 }
public fun CARD_DOG(): u8 { 11 }
public fun CARD_RENT_FREE(): u8 { 20 }
public fun CARD_FREEZE(): u8 { 30 }
public fun CARD_CLEANSE(): u8 { 41 }
public fun CARD_TURN(): u8 { 50 }  // 转向卡

// ===== BuffKind Buff类型 =====
public fun BUFF_MOVE_CTRL(): u8 { 1 }
public fun BUFF_FROZEN(): u8 { 2 }
public fun BUFF_RENT_FREE(): u8 { 3 }
public fun BUFF_LAND_BLESSING(): u8 { 4 }  // 土地神祝福
public fun BUFF_FORTUNE(): u8 { 5 }         // 福神幸运

// ===== Phase 游戏阶段 =====
public fun PHASE_ROLL(): u8 { 1 }
public fun PHASE_MOVE(): u8 { 2 }
public fun PHASE_SETTLE(): u8 { 3 }
public fun PHASE_MANAGE(): u8 { 4 }
public fun PHASE_EVENTS(): u8 { 5 }
public fun PHASE_END(): u8 { 6 }

// ===== GameStatus 游戏状态 =====
public fun STATUS_READY(): u8 { 0 }
public fun STATUS_ACTIVE(): u8 { 1 }
public fun STATUS_ENDED(): u8 { 2 }

// ===== PendingDecision 待决策类型 =====
public fun DECISION_NONE(): u8 { 0 }
public fun DECISION_BUY_PROPERTY(): u8 { 1 }      // 可以购买地产
public fun DECISION_UPGRADE_PROPERTY(): u8 { 2 }   // 可以升级地产
public fun DECISION_PAY_RENT(): u8 { 3 }          // 需要决定如何支付租金（有免租卡时）

// ===== SkipReason 跳过回合原因 =====
public fun SKIP_PRISON(): u8 { 1 }
public fun SKIP_HOSPITAL(): u8 { 2 }

//   命名：
//   - round：轮次（所有玩家各行动一次）
//   - turn：轮内回合（0到player_count-1）
//   - max_rounds：最大轮数限制

// ===== BuildingType判断辅助函数 =====
// 判断building_type是否有效
public fun is_valid_building_type(building_type: u8): bool {
    building_type == BUILDING_NONE() ||
    (building_type >= BUILDING_TEMPLE() && building_type <= BUILDING_HOTEL())
}

// 判断是否为2x2专属建筑类型（TEMPLE/RESEARCH等）
public fun is_large_building_type(building_type: u8): bool {
    building_type >= BUILDING_TEMPLE() && building_type <= BUILDING_HOTEL()
}

// ===== Default Configs 默认配置 =====
public fun DEFAULT_MAX_PLAYERS(): u8 { 4 }
public fun DEFAULT_MAX_ROUNDS(): u16 { 100 }
public fun DEFAULT_HOSPITAL_TURNS(): u8 { 2 }
public fun DEFAULT_PRISON_TURNS(): u8 { 2 }

