module tycoon::admin;

use sui::event;
use sui::transfer;
use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};

use tycoon::map::{Self, MapTemplate, MapRegistry};
use tycoon::types;

// ===== Admin Cap 管理员权限 =====
public struct AdminCap has key, store { //todo
    id: UID
}

// ===== Admin Events 管理事件 =====
public struct MapTemplatePublishedEvent has copy, drop {
    template_id: u16,
    publisher: address,
    tile_count: u64
}

public struct RegistryCreatedEvent has copy, drop {
    registry_id: ID,
    creator: address
}

// ===== Admin Cap Creation 管理员权限创建 =====

/// 创建管理员权限并转移给部署者
/// 由 tycoon 模块的 init 函数调用
public(package) fun create_admin_cap(ctx: &mut TxContext) {
    let admin_cap = AdminCap {
        id: object::new(ctx)
    };
    transfer::transfer(admin_cap, ctx.sender());
}

// ===== Entry Functions 入口函数 =====

// 发布自定义地图模板（通过客户端PTB调用）
entry fun publish_custom_map_template(
    registry: &mut MapRegistry,
    template_id: u16,
    width: u8,
    height: u8,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    let template = map::new_map_template(template_id, width, height, ctx);

    // 这里应该有更多的地图配置逻辑
    // 由于是示例，我们创建一个简单的模板

    let tile_count = map::get_tile_count(&template);

    map::publish_template(registry, template, ctx);

    event::emit(MapTemplatePublishedEvent {
        template_id,
        publisher: ctx.sender(),
        tile_count
    });
}

// ===== Helper Functions 辅助函数 =====
// 地图创建已移至客户端，通过PTB调用map模块函数

// // 转移管理员权限
// entry fun transfer_admin_cap(
//     admin_cap: AdminCap,
//     recipient: address
// ) {
//     transfer::transfer(admin_cap, recipient);
// }

// ===== GameData Configuration Functions 配置更新函数 =====
// 注意：这些函数已移至 tycoon 模块以避免循环依赖

// ===== Query Functions 查询函数 =====

// 验证是否有管理员权限
public fun verify_admin_cap(_admin: &AdminCap): bool {
    true
}