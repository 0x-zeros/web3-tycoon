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
    template_id: u64,
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

// [已废弃] 地图注册表现在在 init 中创建
// entry fun create_map_registry(ctx: &mut TxContext) {
//     map::create_registry(ctx);
// }

// 发布测试地图
entry fun publish_test_map(
    registry: &mut MapRegistry,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    let template = map::create_test_map_8(ctx);
    let template_id = map::get_template_id(&template);
    let tile_count = map::get_tile_count(&template);

    map::publish_template(registry, template, ctx);

    event::emit(MapTemplatePublishedEvent {
        template_id,
        publisher: ctx.sender(),
        tile_count
    });
}

// 发布自定义地图模板
entry fun publish_custom_map_template(
    registry: &mut MapRegistry,
    template_id: u64,
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

// 创建并配置一个标准的大富翁地图（40格）
public fun create_standard_monopoly_map(ctx: &mut TxContext): MapTemplate {
    let mut template = map::new_map_template(2, 11, 11, ctx);

    // 添加40个地块（标准大富翁布局）
    // 这里简化处理，实际应该有详细的地块配置

    // 起点
    map::add_tile_to_template(&mut template, 0,
        map::new_tile_static(0, 0, types::tile_property(), types::size_1x1(), 0, 0, 0));

    // 第一边（南边）
    let mut i = 1;
    while (i < 10) {
        let kind = if (i == 5) { types::tile_card() } else { types::tile_property() };
        let price = 1000 + i * 200;
        let toll = 100 + i * 20;
        map::add_tile_to_template(&mut template, (i as u16),
            map::new_tile_static((i as u8), 0, kind, types::size_1x1(), price, toll, 0));
        i = i + 1;
    };

    // 监狱角
    map::add_tile_to_template(&mut template, 10,
        map::new_tile_static(10, 0, types::tile_prison(), types::size_1x1(), 0, 0, 2));

    // 第二边（东边）
    i = 11;
    while (i < 20) {
        let y = ((i - 10) as u8);
        let kind = if (i == 15) { types::tile_hospital() } else { types::tile_property() };
        let price = 2000 + (i - 10) * 200;
        let toll = 200 + (i - 10) * 20;
        map::add_tile_to_template(&mut template, (i as u16),
            map::new_tile_static(10, y, kind, types::size_1x1(), price, toll, 0));
        i = i + 1;
    };

    // 免费停车角
    map::add_tile_to_template(&mut template, 20,
        map::new_tile_static(10, 10, types::tile_bonus(), types::size_1x1(), 0, 0, 5000));

    // 第三边（北边）
    i = 21;
    while (i < 30) {
        let x = (10 - (i - 20)) as u8;
        let kind = if (i == 25) { types::tile_chance() } else { types::tile_property() };
        let price = 3000 + (i - 20) * 200;
        let toll = 300 + (i - 20) * 20;
        map::add_tile_to_template(&mut template, (i as u16),
            map::new_tile_static(x, 10, kind, types::size_1x1(), price, toll, 0));
        i = i + 1;
    };

    // 前往监狱角
    map::add_tile_to_template(&mut template, 30,
        map::new_tile_static(0, 10, types::tile_prison(), types::size_1x1(), 0, 0, 3));

    // 第四边（西边）
    i = 31;
    while (i < 40) {
        let y = ((10 - (i - 30)) as u8);
        let kind = if (i == 35) { types::tile_news() } else { types::tile_property() };
        let price = 4000 + (i - 30) * 200;
        let toll = 400 + (i - 30) * 20;
        map::add_tile_to_template(&mut template, (i as u16),
            map::new_tile_static(0, y, kind, types::size_1x1(), price, toll, 0));
        i = i + 1;
    };

    // 设置顺时针和逆时针路径
    i = 0;
    while (i < 40) {
        map::set_cw_next(&mut template, (i as u16), ((i + 1) % 40) as u16);//cw,ccw 反了？todo
        map::set_ccw_next(&mut template, (i as u16), ((i + 39) % 40) as u16);
        map::set_ring_info(&mut template, (i as u16), 0, (i as u16));
        i = i + 1;
    };

    template
}

// // 转移管理员权限
// entry fun transfer_admin_cap(
//     admin_cap: AdminCap,
//     recipient: address
// ) {
//     transfer::transfer(admin_cap, recipient);
// }

// ===== Test Helper Functions 测试辅助函数 =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    // 直接调用 create_admin_cap
    create_admin_cap(ctx);
}

// ===== Query Functions 查询函数 =====

// 验证是否有管理员权限
public fun verify_admin_cap(_admin: &AdminCap): bool {
    true
}