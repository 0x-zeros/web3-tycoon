module tycoon::types;

// ===== TileKind 地块类型 =====
public(package) fun TILE_EMPTY(): u8 { 0 }
public(package) fun TILE_LOTTERY(): u8 { 1 }
public(package) fun TILE_HOSPITAL(): u8 { 2 }
public(package) fun TILE_CHANCE(): u8 { 3 }
public(package) fun TILE_BONUS(): u8 { 4 }
public(package) fun TILE_FEE(): u8 { 5 }
public(package) fun TILE_CARD(): u8 { 6 }
public(package) fun TILE_NEWS(): u8 { 7 }

// ===== BuildingType 建筑类型 =====
// 无类型（1x1建筑 或 2x2未选择类型时使用）
public(package) fun BUILDING_NONE(): u8 { 0 }
// 土地庙（影响周围地块租金，2x2专属）
public(package) fun BUILDING_TEMPLE(): u8 { 20 }
// 研究所（2x2专属）
public(package) fun BUILDING_RESEARCH(): u8 { 21 }
// 石油公司（2x2专属）
public(package) fun BUILDING_OIL(): u8 { 22 }
// 商业中心（2x2专属）
public(package) fun BUILDING_COMMERCIAL(): u8 { 23 }
// 大饭店（2x2专属）
public(package) fun BUILDING_HOTEL(): u8 { 24 }

// ===== Size 地块大小 =====
public(package) fun SIZE_1X1(): u8 { 1 }
public(package) fun SIZE_2X2(): u8 { 2 }

// ===== Level 地产等级 =====
public(package) fun LEVEL_0(): u8 { 0 }
public(package) fun LEVEL_1(): u8 { 1 }
public(package) fun LEVEL_2(): u8 { 2 }
public(package) fun LEVEL_3(): u8 { 3 }
public(package) fun LEVEL_4(): u8 { 4 }

// ===== NpcKind NPC类型 =====
public(package) fun NPC_BARRIER(): u8 { 20 }
public(package) fun NPC_BOMB(): u8 { 21 }
public(package) fun NPC_DOG(): u8 { 22 }

// 增益型NPC
public(package) fun NPC_LAND_GOD(): u8 { 23 }      // 土地神
public(package) fun NPC_WEALTH_GOD(): u8 { 24 }    // 财神
public(package) fun NPC_FORTUNE_GOD(): u8 { 25 }   // 福神

// 干扰型NPC
public(package) fun NPC_POOR_GOD(): u8 { 26 }      // 穷神

// ===== CardKind 卡牌类型 =====
public(package) fun CARD_MOVE_CTRL(): u8 { 0 }
public(package) fun CARD_BARRIER(): u8 { 1 }
public(package) fun CARD_BOMB(): u8 { 2 }
public(package) fun CARD_RENT_FREE(): u8 { 3 }
public(package) fun CARD_FREEZE(): u8 { 4 }
public(package) fun CARD_DOG(): u8 { 5 }
public(package) fun CARD_CLEANSE(): u8 { 6 }
public(package) fun CARD_TURN(): u8 { 7 }  // 转向卡

// ===== BuffKind Buff类型 =====
public(package) fun BUFF_MOVE_CTRL(): u8 { 1 }
public(package) fun BUFF_FROZEN(): u8 { 2 }
public(package) fun BUFF_RENT_FREE(): u8 { 3 }
public(package) fun BUFF_LAND_BLESSING(): u8 { 4 }  // 土地神祝福
public(package) fun BUFF_FORTUNE(): u8 { 5 }         // 福神幸运

// ===== GameStatus 游戏状态 =====
public(package) fun STATUS_READY(): u8 { 0 }
public(package) fun STATUS_ACTIVE(): u8 { 1 }
public(package) fun STATUS_ENDED(): u8 { 2 }

// ===== PendingDecision 待决策类型 =====
public(package) fun DECISION_NONE(): u8 { 0 }
public(package) fun DECISION_BUY_PROPERTY(): u8 { 1 }      // 可以购买地产
public(package) fun DECISION_UPGRADE_PROPERTY(): u8 { 2 }   // 可以升级地产
public(package) fun DECISION_PAY_RENT(): u8 { 3 }          // 需要决定如何支付租金（有免租卡时）

// ===== SkipReason 跳过回合原因 =====
public(package) fun SKIP_HOSPITAL(): u8 { 2 }

//   命名：
//   - round：轮次（所有玩家各行动一次）
//   - turn：轮内回合（0到player_count-1）
//   - max_rounds：最大轮数限制

// ===== BuildingType判断辅助函数 =====
// 判断是否为2x2专属建筑类型（TEMPLE/RESEARCH等）
public(package) fun is_large_building_type(building_type: u8): bool {
    building_type >= BUILDING_TEMPLE() && building_type <= BUILDING_HOTEL()
}

// ===== Default Configs 默认配置 =====
public(package) fun DEFAULT_MAX_PLAYERS(): u8 { 4 }
public(package) fun DEFAULT_HOSPITAL_TURNS(): u8 { 2 }

