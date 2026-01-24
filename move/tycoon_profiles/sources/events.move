/// 事件定义，用于客户端索引 profile 对象
module tycoon_profiles::events;

use sui::event;

/// PlayerProfile 创建事件
public struct PlayerProfileCreatedEvent has copy, drop {
    profile_id: ID,
    owner: address,
}

/// PlayerProfile 更新事件
public struct PlayerProfileUpdatedEvent has copy, drop {
    profile_id: ID,
    owner: address,
}

/// GameProfile 创建事件
public struct GameProfileCreatedEvent has copy, drop {
    profile_id: ID,
    game_id: ID,
    creator: address,
}

/// GameProfile 更新事件
public struct GameProfileUpdatedEvent has copy, drop {
    profile_id: ID,
    game_id: ID,
}

/// MapProfile 创建事件
public struct MapProfileCreatedEvent has copy, drop {
    profile_id: ID,
    map_id: ID,
    creator: address,
}

/// MapProfile 更新事件
public struct MapProfileUpdatedEvent has copy, drop {
    profile_id: ID,
    map_id: ID,
}

// ============ Emit Functions ============

public fun emit_player_profile_created(profile_id: ID, owner: address) {
    event::emit(PlayerProfileCreatedEvent { profile_id, owner });
}

public fun emit_player_profile_updated(profile_id: ID, owner: address) {
    event::emit(PlayerProfileUpdatedEvent { profile_id, owner });
}

public fun emit_game_profile_created(profile_id: ID, game_id: ID, creator: address) {
    event::emit(GameProfileCreatedEvent { profile_id, game_id, creator });
}

public fun emit_game_profile_updated(profile_id: ID, game_id: ID) {
    event::emit(GameProfileUpdatedEvent { profile_id, game_id });
}

public fun emit_map_profile_created(profile_id: ID, map_id: ID, creator: address) {
    event::emit(MapProfileCreatedEvent { profile_id, map_id, creator });
}

public fun emit_map_profile_updated(profile_id: ID, map_id: ID) {
    event::emit(MapProfileUpdatedEvent { profile_id, map_id });
}
