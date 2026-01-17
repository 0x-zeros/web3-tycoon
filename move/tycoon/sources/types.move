module tycoon::types;

// ===== TileKind =====
public(package) fun TILE_EMPTY(): u8 { 0 }
public(package) fun TILE_LOTTERY(): u8 { 1 }
public(package) fun TILE_HOSPITAL(): u8 { 2 }
public(package) fun TILE_CHANCE(): u8 { 3 }
public(package) fun TILE_BONUS(): u8 { 4 }
public(package) fun TILE_FEE(): u8 { 5 }
public(package) fun TILE_CARD(): u8 { 6 }
public(package) fun TILE_NEWS(): u8 { 7 }
public(package) fun TILE_CARD_SHOP(): u8 { 8 }

// ===== BuildingType =====
public(package) fun BUILDING_NONE(): u8 { 0 }
public(package) fun BUILDING_TEMPLE(): u8 { 20 }
public(package) fun BUILDING_RESEARCH(): u8 { 21 }
public(package) fun BUILDING_OIL(): u8 { 22 }
public(package) fun BUILDING_COMMERCIAL(): u8 { 23 }
public(package) fun BUILDING_HOTEL(): u8 { 24 }

// ===== Size =====
public(package) fun SIZE_1X1(): u8 { 1 }
public(package) fun SIZE_2X2(): u8 { 2 }

// ===== Level =====
public(package) fun LEVEL_0(): u8 { 0 }
public(package) fun LEVEL_1(): u8 { 1 }
public(package) fun LEVEL_2(): u8 { 2 }
public(package) fun LEVEL_3(): u8 { 3 }
public(package) fun LEVEL_4(): u8 { 4 }

// ===== NpcKind =====
public(package) fun NPC_BARRIER(): u8 { 20 }
public(package) fun NPC_BOMB(): u8 { 21 }
public(package) fun NPC_DOG(): u8 { 22 }
public(package) fun NPC_LAND_GOD(): u8 { 23 }
public(package) fun NPC_WEALTH_GOD(): u8 { 24 }
public(package) fun NPC_FORTUNE_GOD(): u8 { 25 }
public(package) fun NPC_POOR_GOD(): u8 { 26 }

// ===== CardKind =====
public(package) fun CARD_MOVE_CTRL(): u8 { 0 }
public(package) fun CARD_BARRIER(): u8 { 1 }
public(package) fun CARD_BOMB(): u8 { 2 }
public(package) fun CARD_RENT_FREE(): u8 { 3 }
public(package) fun CARD_FREEZE(): u8 { 4 }
public(package) fun CARD_DOG(): u8 { 5 }
public(package) fun CARD_CLEANSE(): u8 { 6 }
public(package) fun CARD_TURN(): u8 { 7 }

// ===== GM卡牌（需要GMPass购买） =====
public(package) fun CARD_TELEPORT(): u8 { 8 }       // 瞬移卡
public(package) fun CARD_BONUS_S(): u8 { 9 }        // 奖励卡（小）- 1万
public(package) fun CARD_BONUS_L(): u8 { 10 }       // 奖励卡（大）- 10万
public(package) fun CARD_FEE_S(): u8 { 11 }         // 费用卡（小）- 1万
public(package) fun CARD_FEE_L(): u8 { 12 }         // 费用卡（大）- 10万
public(package) fun CARD_CONSTRUCTION(): u8 { 13 }  // 建造卡（升级建筑）
public(package) fun CARD_RENOVATION(): u8 { 14 }    // 改建卡（更换大建筑类型）
public(package) fun CARD_SUMMON(): u8 { 15 }        // 召唤卡（放置NPC）
public(package) fun CARD_BANISH(): u8 { 16 }        // 驱逐卡（移除NPC）

// ===== GM卡牌判断辅助函数 =====
public(package) fun is_gm_card(kind: u8): bool {
    kind >= CARD_TELEPORT() && kind <= CARD_BANISH()
}

// ===== BuffKind =====
public(package) fun BUFF_MOVE_CTRL(): u8 { 1 }
public(package) fun BUFF_FROZEN(): u8 { 2 }
public(package) fun BUFF_RENT_FREE(): u8 { 3 }
public(package) fun BUFF_LAND_BLESSING(): u8 { 4 }
public(package) fun BUFF_FORTUNE(): u8 { 5 }
public(package) fun BUFF_LOCOMOTIVE(): u8 { 6 }  // 机车卡：允许多骰子

// 7-199: 预留给card及其他

// ===== GameStatus =====
public(package) fun STATUS_READY(): u8 { 0 }
public(package) fun STATUS_ACTIVE(): u8 { 1 }
public(package) fun STATUS_ENDED(): u8 { 2 }

// ===== PendingDecision =====
public(package) fun DECISION_NONE(): u8 { 0 }
public(package) fun DECISION_BUY_PROPERTY(): u8 { 1 }
public(package) fun DECISION_UPGRADE_PROPERTY(): u8 { 2 }
public(package) fun DECISION_PAY_RENT(): u8 { 3 }
public(package) fun DECISION_CARD_SHOP(): u8 { 4 }

// ===== SkipReason =====
public(package) fun SKIP_HOSPITAL(): u8 { 2 }

// ===== BuildingType Helpers =====
public(package) fun is_large_building_type(building_type: u8): bool {
    building_type >= BUILDING_TEMPLE() && building_type <= BUILDING_HOTEL()
}

// ===== Default Configs =====
public(package) fun DEFAULT_MAX_PLAYERS(): u8 { 4 }
public(package) fun DEFAULT_HOSPITAL_TURNS(): u8 { 2 }

// ===== GameSettings 位标志 =====
public(package) fun SETTING_GM_MODE(): u8 { 0x01 }  // bit 0: GM模式
// bit 1-7: 预留
