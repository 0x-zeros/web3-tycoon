module tycoon::types;

// ===== TileKind 地块类型 =====
public fun tile_empty(): u8 { 0 }
public fun tile_property(): u8 { 1 }
public fun tile_hospital(): u8 { 2 }
public fun tile_prison(): u8 { 3 }
public fun tile_chance(): u8 { 4 }
public fun tile_bonus(): u8 { 5 }
public fun tile_fee(): u8 { 6 }
public fun tile_card(): u8 { 7 }
public fun tile_news(): u8 { 8 }
public fun tile_lottery(): u8 { 9 }
public fun tile_shop(): u8 { 10 }

// ===== Size 地块大小 =====
public fun size_1x1(): u8 { 1 }
public fun size_2x2(): u8 { 2 }

// ===== Level 地产等级 =====
public fun level_0(): u8 { 0 }
public fun level_1(): u8 { 1 }
public fun level_2(): u8 { 2 }
public fun level_3(): u8 { 3 }
public fun level_4(): u8 { 4 }

// ===== NpcKind NPC类型 =====
public fun npc_barrier(): u8 { 20 }
public fun npc_bomb(): u8 { 21 }
public fun npc_dog(): u8 { 22 }

// ===== CardKind 卡牌类型 =====
public fun card_move_ctrl(): u16 { 1 }
public fun card_barrier(): u16 { 2 }
public fun card_bomb(): u16 { 10 }
public fun card_rent_free(): u16 { 20 }
public fun card_freeze(): u16 { 30 }

// ===== Phase 游戏阶段 =====
public fun phase_roll(): u8 { 1 }
public fun phase_move(): u8 { 2 }
public fun phase_settle(): u8 { 3 }
public fun phase_manage(): u8 { 4 }
public fun phase_events(): u8 { 5 }
public fun phase_end(): u8 { 6 }

// ===== DirMode 移动方向模式 =====
public fun dir_auto(): u8 { 0 }
public fun dir_cw(): u8 { 1 }      // 顺时针
public fun dir_ccw(): u8 { 2 }     // 逆时针
public fun dir_forced_cw(): u8 { 3 }
public fun dir_forced_ccw(): u8 { 4 }

// ===== GameStatus 游戏状态 =====
public fun status_ready(): u8 { 0 }
public fun status_active(): u8 { 1 }
public fun status_ended(): u8 { 2 }

// ===== SkipReason 跳过回合原因 =====
public fun skip_prison(): u8 { 1 }
public fun skip_hospital(): u8 { 2 }

// ===== Error Codes 错误码 =====
// 玩家相关错误
public fun err_not_active_player(): u64 { 1001 }
public fun err_wrong_phase(): u64 { 1002 }
public fun err_no_turn_cap(): u64 { 1003 }
public fun err_cap_expired(): u64 { 1004 }

// 地块相关错误
public fun err_tile_occupied_by_npc(): u64 { 2001 }
public fun err_no_such_tile(): u64 { 2002 }
public fun err_pos_mismatch(): u64 { 2003 }
public fun err_unreachable(): u64 { 2004 }

// 地图模板相关错误
public fun err_template_not_found(): u64 { 3001 }
public fun err_template_already_exists(): u64 { 3002 }

// 移动相关错误
public fun err_invalid_move(): u64 { 4001 }

// 卡牌相关错误
public fun err_card_not_owned(): u64 { 5001 }
public fun err_hand_limit(): u64 { 5002 }
public fun err_invalid_card_target(): u64 { 5003 }

// 游戏状态相关错误
public fun err_join_full(): u64 { 6001 }
public fun err_already_started(): u64 { 6002 }
public fun err_game_ended(): u64 { 6003 }
public fun err_not_enough_players(): u64 { 6004 }
public fun err_already_joined(): u64 { 6005 }

// 经济相关错误
public fun err_insufficient_funds(): u64 { 7001 }
public fun err_property_already_owned(): u64 { 7002 }
public fun err_not_property_owner(): u64 { 7003 }
public fun err_max_level_reached(): u64 { 7004 }

// NPC相关错误
public fun err_npc_cap_reached(): u64 { 8001 }

// ===== Helper Functions 辅助函数 =====
// 获取等级倍率数组（用于计算过路费）
public fun get_level_multipliers(): vector<u64> {
    vector[1, 2, 4, 8, 16]  // M[0..4]
}

// 计算升级成本
public fun calculate_upgrade_cost(price: u64, level: u8): u64 {
    // cost(level) = price * (0.6 + 0.5 * level)
    let multiplier = 60 + 50 * (level as u64);  // 以百分比计算
    (price * multiplier) / 100
}

// 计算过路费
public fun calculate_toll(base_toll: u64, level: u8): u64 {
    let multipliers = get_level_multipliers();
    let idx = (level as u64);
    if (idx >= multipliers.length()) {
        base_toll  // 防御性编程
    } else {
        base_toll * *multipliers.borrow(idx)
    }
}

// 检查是否是可停留地块
public fun is_stoppable_tile(kind: u8): bool {
    kind == tile_property() ||
    kind == tile_hospital() ||
    kind == tile_prison() ||
    kind == tile_chance() ||
    kind == tile_bonus() ||
    kind == tile_fee() ||
    kind == tile_card() ||
    kind == tile_news() ||
    kind == tile_lottery() ||
    kind == tile_shop()
}

// 检查是否是可经过触发的地块
public fun is_passable_trigger(kind: u8): bool {
    kind == tile_card() || kind == tile_lottery()
}

// 检查是否是NPC类型
public fun is_npc(kind: u8): bool {
    kind == npc_barrier() || kind == npc_bomb() || kind == npc_dog()
}

// 检查是否是会送医院的NPC
public fun is_hospital_npc(kind: u8): bool {
    kind == npc_bomb() || kind == npc_dog()
}

// 获取默认配置
public fun default_max_players(): u8 { 4 }
public fun default_max_turns(): u64 { 100 }
public fun default_npc_cap(): u16 { 10 }
public fun default_starting_cash(): u64 { 10000 }
public fun default_hospital_turns(): u8 { 2 }
public fun default_prison_turns(): u8 { 2 }

// 验证地块类型
public fun is_valid_tile_kind(kind: u8): bool {
    kind <= tile_shop()
}

// 验证方向模式
public fun is_valid_dir_mode(mode: u8): bool {
    mode <= dir_forced_ccw()
}

// 验证游戏阶段
public fun is_valid_phase(phase: u8): bool {
    phase >= phase_roll() && phase <= phase_end()
}

// 验证等级
public fun is_valid_level(level: u8): bool {
    level <= level_4()
}