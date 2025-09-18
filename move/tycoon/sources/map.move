module tycoon::map;

use sui::table::{Self, Table};
use tycoon::types;

// ===== TileStatic 静态地块信息 =====
public struct TileStatic has store, copy, drop {
    x: u16,
    y: u16,
    kind: u8,       // TileKind
    size: u8,       // 1x1 or 2x2
    price: u64,
    base_toll: u64,
    special: u64    // 额外参数位
}

// ===== MapTemplate 地图模板（静态，不随对局变化） =====
public struct MapTemplate has store {
    id: u64,
    version: u64,
    width: u16,
    height: u16,
    tile_count: u64,
    tiles_static: Table<u64 /* tile_id */, TileStatic>,
    adj: Table<u64 /* tile_id */, vector<u64> /* neighbors */>,
    cw_next: Table<u64, u64>,     // 顺时针下一格
    ccw_next: Table<u64, u64>,    // 逆时针下一格
    ring_id: Table<u64, u16>,     // 所属环路ID
    ring_idx: Table<u64, u32>,    // 在环路中的索引
    hospital_ids: vector<u64>,
    prison_ids: vector<u64>,
    shop_ids: vector<u64>,
    news_ids: vector<u64>,
    digest: vector<u8>            // 模板摘要哈希
}

// ===== MapRegistry 地图注册表 =====
public struct MapRegistry has key, store {
    id: UID,
    templates: Table<u64, MapTemplate>,
    template_count: u64
}

// ===== Entry Functions 入口函数 =====

// 创建地图注册表
public fun create_registry(ctx: &mut TxContext) {
    let registry = MapRegistry {
        id: object::new(ctx),
        templates: table::new(ctx),
        template_count: 0
    };
    transfer::share_object(registry);
}

// ===== Public Functions 公共函数 =====

// 发布地图模板（只能写入，不可修改）
public fun publish_template(
    registry: &mut MapRegistry,
    template: MapTemplate,
    _ctx: &mut TxContext
) {
    let template_id = template.id;

    // 检查模板是否已存在
    assert!(!table::contains(&registry.templates, template_id), types::err_template_already_exists());

    // 添加模板到注册表
    table::add(&mut registry.templates, template_id, template);
    registry.template_count = registry.template_count + 1;
}

// 获取地图模板（只读）
public fun get_template(registry: &MapRegistry, template_id: u64): &MapTemplate {
    assert!(table::contains(&registry.templates, template_id), types::err_template_not_found());
    table::borrow(&registry.templates, template_id)
}

// 检查模板是否存在
public fun has_template(registry: &MapRegistry, template_id: u64): bool {
    table::contains(&registry.templates, template_id)
}

// ===== Template Creation Functions 模板创建函数 =====

// 创建地块静态信息
public fun new_tile_static(
    x: u16,
    y: u16,
    kind: u8,
    size: u8,
    price: u64,
    base_toll: u64,
    special: u64
): TileStatic {
    TileStatic {
        x,
        y,
        kind,
        size,
        price,
        base_toll,
        special
    }
}

// 创建地图模板
public fun new_map_template(
    id: u64,
    version: u64,
    width: u16,
    height: u16,
    ctx: &mut TxContext
): MapTemplate {
    MapTemplate {
        id,
        version,
        width,
        height,
        tile_count: 0,
        tiles_static: table::new(ctx),
        adj: table::new(ctx),
        cw_next: table::new(ctx),
        ccw_next: table::new(ctx),
        ring_id: table::new(ctx),
        ring_idx: table::new(ctx),
        hospital_ids: vector::empty(),
        prison_ids: vector::empty(),
        shop_ids: vector::empty(),
        news_ids: vector::empty(),
        digest: vector::empty()
    }
}

// 向模板添加地块
public fun add_tile_to_template(
    template: &mut MapTemplate,
    tile_id: u64,
    tile: TileStatic
) {
    assert!(!table::contains(&template.tiles_static, tile_id), types::err_tile_occupied_by_npc());
    table::add(&mut template.tiles_static, tile_id, tile);
    template.tile_count = template.tile_count + 1;

    // 根据地块类型添加到对应的ID列表
    if (tile.kind == types::tile_hospital()) {
        template.hospital_ids.push_back(tile_id);
    } else if (tile.kind == types::tile_prison()) {
        template.prison_ids.push_back(tile_id);
    } else if (tile.kind == types::tile_shop()) {
        template.shop_ids.push_back(tile_id);
    } else if (tile.kind == types::tile_news()) {
        template.news_ids.push_back(tile_id);
    };
}

// 设置地块的邻接关系
public fun set_tile_adjacency(
    template: &mut MapTemplate,
    tile_id: u64,
    neighbors: vector<u64>
) {
    if (table::contains(&template.adj, tile_id)) {
        let adj_list = table::borrow_mut(&mut template.adj, tile_id);
        *adj_list = neighbors;
    } else {
        table::add(&mut template.adj, tile_id, neighbors);
    };
}

// 设置顺时针下一格
public fun set_cw_next(
    template: &mut MapTemplate,
    tile_id: u64,
    next_id: u64
) {
    if (table::contains(&template.cw_next, tile_id)) {
        *table::borrow_mut(&mut template.cw_next, tile_id) = next_id;
    } else {
        table::add(&mut template.cw_next, tile_id, next_id);
    };
}

// 设置逆时针下一格
public fun set_ccw_next(
    template: &mut MapTemplate,
    tile_id: u64,
    next_id: u64
) {
    if (table::contains(&template.ccw_next, tile_id)) {
        *table::borrow_mut(&mut template.ccw_next, tile_id) = next_id;
    } else {
        table::add(&mut template.ccw_next, tile_id, next_id);
    };
}

// 设置环路信息
public fun set_ring_info(
    template: &mut MapTemplate,
    tile_id: u64,
    ring_id: u16,
    ring_idx: u32
) {
    if (table::contains(&template.ring_id, tile_id)) {
        *table::borrow_mut(&mut template.ring_id, tile_id) = ring_id;
    } else {
        table::add(&mut template.ring_id, tile_id, ring_id);
    };

    if (table::contains(&template.ring_idx, tile_id)) {
        *table::borrow_mut(&mut template.ring_idx, tile_id) = ring_idx;
    } else {
        table::add(&mut template.ring_idx, tile_id, ring_idx);
    };
}

// 设置模板摘要
public fun set_template_digest(template: &mut MapTemplate, digest: vector<u8>) {
    template.digest = digest;
}

// ===== Template Query Functions 模板查询函数 =====

// 获取地块信息
public fun get_tile(template: &MapTemplate, tile_id: u64): &TileStatic {
    assert!(table::contains(&template.tiles_static, tile_id), types::err_no_such_tile());
    table::borrow(&template.tiles_static, tile_id)
}

// 获取顺时针下一格
public fun get_cw_next(template: &MapTemplate, tile_id: u64): u64 {
    assert!(table::contains(&template.cw_next, tile_id), types::err_no_such_tile());
    *table::borrow(&template.cw_next, tile_id)
}

// 获取逆时针下一格
public fun get_ccw_next(template: &MapTemplate, tile_id: u64): u64 {
    assert!(table::contains(&template.ccw_next, tile_id), types::err_no_such_tile());
    *table::borrow(&template.ccw_next, tile_id)
}

// 获取邻接地块
public fun get_neighbors(template: &MapTemplate, tile_id: u64): vector<u64> {
    if (table::contains(&template.adj, tile_id)) {
        *table::borrow(&template.adj, tile_id)
    } else {
        vector::empty()
    }
}

// 检查地块是否存在
public fun has_tile(template: &MapTemplate, tile_id: u64): bool {
    table::contains(&template.tiles_static, tile_id)
}

// 获取医院地块ID列表
public fun get_hospital_ids(template: &MapTemplate): vector<u64> {
    template.hospital_ids
}

// 获取监狱地块ID列表
public fun get_prison_ids(template: &MapTemplate): vector<u64> {
    template.prison_ids
}

// 获取商店地块ID列表
public fun get_shop_ids(template: &MapTemplate): vector<u64> {
    template.shop_ids
}

// 获取新闻地块ID列表
public fun get_news_ids(template: &MapTemplate): vector<u64> {
    template.news_ids
}

// 获取地图宽度
public fun get_width(template: &MapTemplate): u16 {
    template.width
}

// 获取地图高度
public fun get_height(template: &MapTemplate): u16 {
    template.height
}

// 获取地块总数
public fun get_tile_count(template: &MapTemplate): u64 {
    template.tile_count
}

// 获取模板ID
public fun get_template_id(template: &MapTemplate): u64 {
    template.id
}

// 获取模板版本
public fun get_template_version(template: &MapTemplate): u64 {
    template.version
}

// 获取模板摘要
public fun get_template_digest(template: &MapTemplate): vector<u8> {
    template.digest
}

// ===== TileStatic Accessors 地块访问器 =====
public fun tile_x(tile: &TileStatic): u16 { tile.x }
public fun tile_y(tile: &TileStatic): u16 { tile.y }
public fun tile_kind(tile: &TileStatic): u8 { tile.kind }
public fun tile_size(tile: &TileStatic): u8 { tile.size }
public fun tile_price(tile: &TileStatic): u64 { tile.price }
public fun tile_base_toll(tile: &TileStatic): u64 { tile.base_toll }
public fun tile_special(tile: &TileStatic): u64 { tile.special }

// ===== Test Helper Functions 测试辅助函数 =====

// 创建简单的8格测试地图
public fun create_test_map_8(ctx: &mut TxContext): MapTemplate {
    let mut template = new_map_template(1, 1, 3, 3, ctx);

    // 创建8个地块，形成环形
    // tile 0: 起点 (0,0) - PROPERTY
    add_tile_to_template(&mut template, 0,
        new_tile_static(0, 0, types::tile_property(), types::size_1x1(), 1000, 100, 0));

    // tile 1: (1,0) - PROPERTY
    add_tile_to_template(&mut template, 1,
        new_tile_static(1, 0, types::tile_property(), types::size_1x1(), 1200, 120, 0));

    // tile 2: (2,0) - CARD
    add_tile_to_template(&mut template, 2,
        new_tile_static(2, 0, types::tile_card(), types::size_1x1(), 0, 0, 0));

    // tile 3: (2,1) - PROPERTY
    add_tile_to_template(&mut template, 3,
        new_tile_static(2, 1, types::tile_property(), types::size_1x1(), 1500, 150, 0));

    // tile 4: (2,2) - PROPERTY
    add_tile_to_template(&mut template, 4,
        new_tile_static(2, 2, types::tile_property(), types::size_1x1(), 1800, 180, 0));

    // tile 5: (1,2) - HOSPITAL
    add_tile_to_template(&mut template, 5,
        new_tile_static(1, 2, types::tile_hospital(), types::size_1x1(), 0, 0, 2)); // special=2表示停留2回合

    // tile 6: (0,2) - PROPERTY
    add_tile_to_template(&mut template, 6,
        new_tile_static(0, 2, types::tile_property(), types::size_1x1(), 2000, 200, 0));

    // tile 7: (0,1) - PROPERTY
    add_tile_to_template(&mut template, 7,
        new_tile_static(0, 1, types::tile_property(), types::size_1x1(), 2200, 220, 0));

    // 设置顺时针路径
    let mut i = 0;
    while (i < 8) {
        set_cw_next(&mut template, i, (i + 1) % 8);
        i = i + 1;
    };

    // 设置逆时针路径
    i = 0;
    while (i < 8) {
        set_ccw_next(&mut template, i, (i + 7) % 8);
        i = i + 1;
    };

    // 设置所有地块为同一个环路
    i = 0;
    while (i < 8) {
        set_ring_info(&mut template, i, 0, (i as u32));
        i = i + 1;
    };

    // 设置摘要
    set_template_digest(&mut template, b"test_map_8_v1");

    template
}