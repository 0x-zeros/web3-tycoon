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

// 创建简化的测试地图（演示新的 property 系统）
public fun create_simple_test_map(ctx: &mut TxContext): MapTemplate {
    let mut template = map::new_map_template(100, 4, 4, ctx);

    // 创建地产
    // 小地产0: tile 0
    let property_0 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 1000, 100));

    // 小地产1: tile 1
    let property_1 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 1200, 120));

    // 大地产（土地庙）: tile 3,4,7,8 四个格子共享
    let temple_property = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_TEMPLE(), types::SIZE_2X2(), 5000, 500));

    // 创建 tiles
    // tile 0: 小地产
    map::add_tile_to_template(&mut template, 0,
        map::new_tile_static(0, 0, types::TILE_PROPERTY(), property_0, 0));

    // tile 1: 小地产
    map::add_tile_to_template(&mut template, 1,
        map::new_tile_static(1, 0, types::TILE_PROPERTY(), property_1, 0));

    // tile 2: 卡牌格（无地产）
    map::add_tile_to_template(&mut template, 2,
        map::new_tile_static(2, 0, types::TILE_CARD(), map::no_property(), 0));

    // tile 3,4,7,8: 土地庙（2x2大地产）
    map::add_tile_to_template(&mut template, 3,
        map::new_tile_static(3, 0, types::TILE_TEMPLE(), temple_property, 0));
    map::add_tile_to_template(&mut template, 4,
        map::new_tile_static(0, 1, types::TILE_TEMPLE(), temple_property, 0));
    map::add_tile_to_template(&mut template, 7,
        map::new_tile_static(3, 1, types::TILE_TEMPLE(), temple_property, 0));
    map::add_tile_to_template(&mut template, 8,
        map::new_tile_static(0, 2, types::TILE_TEMPLE(), temple_property, 0));

    // tile 5: 医院（无地产）
    map::add_tile_to_template(&mut template, 5,
        map::new_tile_static(1, 1, types::TILE_HOSPITAL(), map::no_property(), 2));

    // tile 6: 监狱（无地产）
    map::add_tile_to_template(&mut template, 6,
        map::new_tile_static(2, 1, types::TILE_PRISON(), map::no_property(), 2));

    // 设置导航路径（简化的环形）
    map::set_cw_next(&mut template, 0, 1);
    map::set_cw_next(&mut template, 1, 2);
    map::set_cw_next(&mut template, 2, 3);
    map::set_cw_next(&mut template, 3, 5);
    map::set_cw_next(&mut template, 5, 6);
    map::set_cw_next(&mut template, 6, 8);
    map::set_cw_next(&mut template, 8, 0);

    map::set_ccw_next(&mut template, 0, 8);
    map::set_ccw_next(&mut template, 8, 6);
    map::set_ccw_next(&mut template, 6, 5);
    map::set_ccw_next(&mut template, 5, 3);
    map::set_ccw_next(&mut template, 3, 2);
    map::set_ccw_next(&mut template, 2, 1);
    map::set_ccw_next(&mut template, 1, 0);

    template
}

// 创建并配置一个标准的大富翁地图（40格）
public fun create_standard_monopoly_map(ctx: &mut TxContext): MapTemplate {
    let mut template = map::new_map_template(2, 11, 11, ctx);

    // 先创建所有地产
    // 起点
    let property_start = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 0, 0));

    // 第一边小地产
    let property_1 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 1200, 120));
    let property_2 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 1400, 140));
    // 土地庙（2x2大地产）- tiles 3,4会共享
    let property_temple = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_TEMPLE(), types::SIZE_2X2(), 2000, 200));
    // tile 5是卡牌格，无地产
    let property_6 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 2200, 220));
    // 研究所（2x2大地产）- tiles 7,8会共享
    let property_research = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_RESEARCH(), types::SIZE_2X2(), 2000, 200));
    let property_9 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 2800, 280));

    // 第二边小地产
    let property_11 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 2200, 220));
    let property_12 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 2400, 240));
    // 石油公司（2x2大地产）- tiles 13,14会共享
    let property_oil = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_OIL(), types::SIZE_2X2(), 3000, 300));
    // tile 15是医院，无地产
    let property_16 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 3200, 320));
    let property_17 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 3400, 340));
    let property_18 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 3600, 360));
    let property_19 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 3800, 380));

    // 第三边小地产
    let property_21 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 3200, 320));
    let property_22 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 3400, 340));
    // 商业中心（2x2大地产）- tiles 23,24会共享
    let property_commercial = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_COMMERCIAL(), types::SIZE_2X2(), 4000, 400));
    // tile 25是机会格，无地产
    let property_26 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 4200, 420));
    // 大饭店（2x2大地产）- tiles 27,28会共享
    let property_hotel = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_HOTEL(), types::SIZE_2X2(), 5000, 500));
    let property_29 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 5600, 560));

    // 第四边小地产
    let property_31 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 4200, 420));
    let property_32 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 4400, 440));
    let property_33 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 4600, 460));
    let property_34 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 4800, 480));
    // tile 35是新闻格，无地产
    let property_36 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 5200, 520));
    let property_37 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 5400, 540));
    let property_38 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 5600, 560));
    let property_39 = map::add_property_to_template(&mut template,
        map::new_property_static(types::TILE_PROPERTY(), types::SIZE_1X1(), 5800, 580));

    // 现在创建所有tiles，引用相应的property
    // 起点
    map::add_tile_to_template(&mut template, 0,
        map::new_tile_static(0, 0, types::TILE_PROPERTY(), property_start, 0));

    // 第一边（南边）
    map::add_tile_to_template(&mut template, 1,
        map::new_tile_static(1, 0, types::TILE_PROPERTY(), property_1, 0));
    map::add_tile_to_template(&mut template, 2,
        map::new_tile_static(2, 0, types::TILE_PROPERTY(), property_2, 0));
    // 土地庙占用tiles 3,4（都指向同一个property）
    map::add_tile_to_template(&mut template, 3,
        map::new_tile_static(3, 0, types::TILE_TEMPLE(), property_temple, 0));
    map::add_tile_to_template(&mut template, 4,
        map::new_tile_static(4, 0, types::TILE_TEMPLE(), property_temple, 0));
    map::add_tile_to_template(&mut template, 5,
        map::new_tile_static(5, 0, types::TILE_CARD(), map::no_property(), 0));
    map::add_tile_to_template(&mut template, 6,
        map::new_tile_static(6, 0, types::TILE_PROPERTY(), property_6, 0));
    // 研究所占用tiles 7,8
    map::add_tile_to_template(&mut template, 7,
        map::new_tile_static(7, 0, types::TILE_RESEARCH(), property_research, 0));
    map::add_tile_to_template(&mut template, 8,
        map::new_tile_static(8, 0, types::TILE_RESEARCH(), property_research, 0));
    map::add_tile_to_template(&mut template, 9,
        map::new_tile_static(9, 0, types::TILE_PROPERTY(), property_9, 0));

    // 监狱角
    map::add_tile_to_template(&mut template, 10,
        map::new_tile_static(10, 0, types::TILE_PRISON(), map::no_property(), 2));

    // 第二边（东边）
    map::add_tile_to_template(&mut template, 11,
        map::new_tile_static(10, 1, types::TILE_PROPERTY(), property_11, 0));
    map::add_tile_to_template(&mut template, 12,
        map::new_tile_static(10, 2, types::TILE_PROPERTY(), property_12, 0));
    // 石油公司占用tiles 13,14
    map::add_tile_to_template(&mut template, 13,
        map::new_tile_static(10, 3, types::TILE_OIL(), property_oil, 0));
    map::add_tile_to_template(&mut template, 14,
        map::new_tile_static(10, 4, types::TILE_OIL(), property_oil, 0));
    map::add_tile_to_template(&mut template, 15,
        map::new_tile_static(10, 5, types::TILE_HOSPITAL(), map::no_property(), 2));
    map::add_tile_to_template(&mut template, 16,
        map::new_tile_static(10, 6, types::TILE_PROPERTY(), property_16, 0));
    map::add_tile_to_template(&mut template, 17,
        map::new_tile_static(10, 7, types::TILE_PROPERTY(), property_17, 0));
    map::add_tile_to_template(&mut template, 18,
        map::new_tile_static(10, 8, types::TILE_PROPERTY(), property_18, 0));
    map::add_tile_to_template(&mut template, 19,
        map::new_tile_static(10, 9, types::TILE_PROPERTY(), property_19, 0));

    // 免费停车角
    map::add_tile_to_template(&mut template, 20,
        map::new_tile_static(10, 10, types::TILE_BONUS(), map::no_property(), 5000));

    // 第三边（北边）
    map::add_tile_to_template(&mut template, 21,
        map::new_tile_static(9, 10, types::TILE_PROPERTY(), property_21, 0));
    map::add_tile_to_template(&mut template, 22,
        map::new_tile_static(8, 10, types::TILE_PROPERTY(), property_22, 0));
    // 商业中心占用tiles 23,24
    map::add_tile_to_template(&mut template, 23,
        map::new_tile_static(7, 10, types::TILE_COMMERCIAL(), property_commercial, 0));
    map::add_tile_to_template(&mut template, 24,
        map::new_tile_static(6, 10, types::TILE_COMMERCIAL(), property_commercial, 0));
    map::add_tile_to_template(&mut template, 25,
        map::new_tile_static(5, 10, types::TILE_CHANCE(), map::no_property(), 0));
    map::add_tile_to_template(&mut template, 26,
        map::new_tile_static(4, 10, types::TILE_PROPERTY(), property_26, 0));
    // 大饭店占用tiles 27,28
    map::add_tile_to_template(&mut template, 27,
        map::new_tile_static(3, 10, types::TILE_HOTEL(), property_hotel, 0));
    map::add_tile_to_template(&mut template, 28,
        map::new_tile_static(2, 10, types::TILE_HOTEL(), property_hotel, 0));
    map::add_tile_to_template(&mut template, 29,
        map::new_tile_static(1, 10, types::TILE_PROPERTY(), property_29, 0));

    // 前往监狱角
    map::add_tile_to_template(&mut template, 30,
        map::new_tile_static(0, 10, types::TILE_PRISON(), map::no_property(), 3));

    // 第四边（西边）
    map::add_tile_to_template(&mut template, 31,
        map::new_tile_static(0, 9, types::TILE_PROPERTY(), property_31, 0));
    map::add_tile_to_template(&mut template, 32,
        map::new_tile_static(0, 8, types::TILE_PROPERTY(), property_32, 0));
    map::add_tile_to_template(&mut template, 33,
        map::new_tile_static(0, 7, types::TILE_PROPERTY(), property_33, 0));
    map::add_tile_to_template(&mut template, 34,
        map::new_tile_static(0, 6, types::TILE_PROPERTY(), property_34, 0));
    map::add_tile_to_template(&mut template, 35,
        map::new_tile_static(0, 5, types::TILE_NEWS(), map::no_property(), 0));
    map::add_tile_to_template(&mut template, 36,
        map::new_tile_static(0, 4, types::TILE_PROPERTY(), property_36, 0));
    map::add_tile_to_template(&mut template, 37,
        map::new_tile_static(0, 3, types::TILE_PROPERTY(), property_37, 0));
    map::add_tile_to_template(&mut template, 38,
        map::new_tile_static(0, 2, types::TILE_PROPERTY(), property_38, 0));
    map::add_tile_to_template(&mut template, 39,
        map::new_tile_static(0, 1, types::TILE_PROPERTY(), property_39, 0));

    // 设置顺时针和逆时针路径
    let mut i = 0;
    while (i < 40) {
        map::set_cw_next(&mut template, (i as u16), ((i + 1) % 40) as u16);
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

// ===== GameData Configuration Functions 配置更新函数 =====
// 注意：这些函数已移至 tycoon 模块以避免循环依赖

// ===== Query Functions 查询函数 =====

// 验证是否有管理员权限
public fun verify_admin_cap(_admin: &AdminCap): bool {
    true
}