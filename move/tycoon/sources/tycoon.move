/// 包的顶层模块，负责初始化所有共享资源
module tycoon::tycoon;

use sui::transfer;
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::event;

use tycoon::admin::{Self, AdminCap};
use tycoon::map;
use tycoon::cards;

// ===== Events 事件 =====

/// 地图注册表创建事件
public struct MapRegistryCreated has copy, drop {
    registry_id: ID
}

/// 卡牌注册表创建事件
public struct CardRegistryCreated has copy, drop {
    registry_id: ID
}

/// 掉落配置创建事件
public struct DropConfigCreated has copy, drop {
    config_id: ID
}

// ===== Package Init 包初始化 =====

/// 包发布时的初始化函数
/// 创建所有全局唯一的共享对象
fun init(ctx: &mut TxContext) {
    // 1. 创建管理员权限并转移给部署者
    admin::create_admin_cap(ctx);

    // 2. 创建全局唯一的地图注册表
    let map_registry_id = map::create_registry(ctx);
    event::emit(MapRegistryCreated { registry_id: map_registry_id });

    // 3. 创建全局唯一的卡牌注册表
    let card_registry_id = cards::create_card_registry(ctx);
    event::emit(CardRegistryCreated { registry_id: card_registry_id });

    // 4. 创建全局唯一的掉落配置
    let drop_config_id = cards::create_drop_config(ctx);
    event::emit(DropConfigCreated { config_id: drop_config_id });
}

// ===== Test Helper 测试辅助 =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}