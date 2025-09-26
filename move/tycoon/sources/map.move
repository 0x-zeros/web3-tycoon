module tycoon::map;

use sui::table::{Self, Table};
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::transfer;
use tycoon::types;

// ===== Errors =====
const ETileOccupiedByNpc: u64 = 2001;
const ENoSuchTile: u64 = 2002;
const ETemplateNotFound: u64 = 3001;
const ETemplateAlreadyExists: u64 = 3002;
const ETileAlreadyExists: u64 = 3003;  // 地块已存在
const ETileIdTooLarge: u64 = 3010;     // tile_id超过最大允许值
const ETileIdNotSequential: u64 = 3011; // tile_id必须连续
const EInvalidNextTileId: u64 = 3012;  // 无效的下一个地块ID
const ETargetTileNotExist: u64 = 3013; // 目标地块不存在

// ===== Constants =====
const INVALID_TILE_ID: u16 = 65535;    // u16::MAX 作为无效/未设置的tile_id
const MAX_TILE_ID: u16 = 65534;        // 实际可用的最大tile_id

// ===== TileStatic 静态地块信息 =====
//
// 功能说明：
// 定义地图上每个地块的静态属性
// 这些属性在游戏过程中不会改变，作为地图模板的一部分
//
// 字段说明：
// - x, y: 地块在地图上的坐标位置
// - kind: 地块类型（PROPERTY/HOSPITAL/PRISON/CHANCE等）
// - size: 地块大小
//   * 1: 1x1标准地块
//   * 2: 2x2大型地块（如起点、重要建筑）
// - price: 购买价格（仅对PROPERTY类型有效）
// - base_toll: 基础过路费（等级升级后按倍数增加）
// - special: 额外参数位，用于特殊功能扩展
//   * 可用于存储地块颜色、组别、特殊效果等
// - cw_next: 顺时针下一个地块ID
// - ccw_next: 逆时针下一个地块ID
// - ring_id: 所属环路ID（支持多环路）
// - ring_idx: 在环路中的位置索引
public struct TileStatic has store, copy, drop {
    x: u8,
    y: u8,
    kind: u8,       // TileKind
    size: u8,       // 1x1 or 2x2
    price: u64,
    base_toll: u64,
    special: u64,   // 额外参数位
    cw_next: u16,   // 顺时针下一个地块ID (最多65535个地块)
    ccw_next: u16,  // 逆时针下一个地块ID
    ring_id: u8,    // 所属环路ID (最多256个环路)
    ring_idx: u16   // 在环路中的索引
}

// ===== MapTemplate 地图模板（静态，不随对局变化） =====
//
// 功能说明：
// 定义完整的地图布局和连接关系
// 作为游戏的基础模板，所有对局共享同一模板
// 支持环形地图和复杂邻接地图两种模式
//
// 地图结构：
// - 环形模式：传统大富翁方形路径，使用cw_next/ccw_next导航
// - 邻接模式：复杂地图布局，使用adj表和BFS寻路
//
// 字段说明：
// 基本信息：
// - id: 模板唯一标识符
// - status: 模板状态（0=draft, 1=active, 2=deprecated, 3=blocked, 4=archived）
// - width, height: 地图尺寸
// - tile_count: 地块总数
//
// 地块数据：
// - tiles_static: 所有地块的静态信息
//
// 导航系统：
// - adj: 邻接表，记录每个地块的相邻地块
// - cw_next: 顺时针走向的下一个地块
// - ccw_next: 逆时针走向的下一个地块
// - ring_id: 地块所属环路ID（支持多环路）
// - ring_idx: 地块在环路中的位置索引
//
// 特殊地块索引：
// - hospital_ids: 所有医院地块
// - prison_ids: 所有监狱地块
// - shop_ids: 所有商店地块
// - news_ids: 所有新闻地块
//
// 模板状态说明（仅供客户端/服务端使用，链上逻辑不做校验/限制）：
// - 0 = draft（草稿，不对外）
// - 1 = active（可用，前端可见、可创建对局）
// - 2 = deprecated（废弃，不可新建，对局仍可读取）
// - 3 = blocked（封禁，前端隐藏，不可新建；旧局仍可读）
// - 4 = archived（归档，完全隐藏，仅链上存证）
public struct MapTemplate has store {
    id: u16,
    status: u8,                    // 模板状态
    width: u8,
    height: u8,
    tile_count: u64,
    tiles_static: vector<TileStatic>,  // 使用 vector，tile_id 即为索引
    adj: Table<u16 /* tile_id */, vector<u16> /* neighbors */>,
    // 导航信息已集成到 TileStatic 中，不再需要独立的 Table
    hospital_ids: vector<u16>,
    prison_ids: vector<u16>,
    shop_ids: vector<u16>,
    news_ids: vector<u16>
}

// ===== MapRegistry 地图注册表 =====
//
// 功能说明：
// 全局地图模板注册中心
// 存储所有可用的地图模板，供创建游戏时选择
//
// 字段说明：
// - id: 唯一对象ID
// - templates: 模板ID到模板对象的映射
// - template_count: 已注册的模板总数
public struct MapRegistry has key, store {
    id: UID,
    templates: Table<u16, MapTemplate>,
    template_count: u64
}

// ===== Entry Functions 入口函数 =====

// 创建地图注册表（返回对象，供内部使用）
public(package) fun create_registry_internal(ctx: &mut TxContext): MapRegistry {
    MapRegistry {
        id: object::new(ctx),
        templates: table::new(ctx),
        template_count: 0
    }
}

// 创建并共享地图注册表
public(package) fun create_and_share_registry(ctx: &mut TxContext) {
    let registry = create_registry_internal(ctx);
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
    assert!(!table::contains(&registry.templates, template_id), ETemplateAlreadyExists);

    // 添加模板到注册表
    table::add(&mut registry.templates, template_id, template);
    registry.template_count = registry.template_count + 1;
}

// 获取地图模板（只读）
public fun get_template(registry: &MapRegistry, template_id: u16): &MapTemplate {
    assert!(table::contains(&registry.templates, template_id), ETemplateNotFound);
    table::borrow(&registry.templates, template_id)
}

// 检查模板是否存在
public fun has_template(registry: &MapRegistry, template_id: u16): bool {
    table::contains(&registry.templates, template_id)
}

// ===== Template Creation Functions 模板创建函数 =====

// 创建地块静态信息（使用默认导航值）
public fun new_tile_static(
    x: u8,
    y: u8,
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
        special,
        cw_next: INVALID_TILE_ID,     // 使用无效值作为未设置标记
        ccw_next: INVALID_TILE_ID,    // 使用无效值作为未设置标记
        ring_id: 0,     // 默认值，后续通过set_ring_info设置
        ring_idx: 0     // 默认值，后续通过set_ring_info设置
    }
}

// 创建地块静态信息（带完整导航信息）
public fun new_tile_static_with_nav(
    x: u8,
    y: u8,
    kind: u8,
    size: u8,
    price: u64,
    base_toll: u64,
    special: u64,
    cw_next: u16,
    ccw_next: u16,
    ring_id: u8,
    ring_idx: u16
): TileStatic {
    // 验证导航字段的有效性
    // 允许 INVALID_TILE_ID 表示未设置（将在add_tile_to_template中处理）
    // 但如果不是 INVALID_TILE_ID，必须是有效范围内
    if (cw_next != INVALID_TILE_ID) {
        assert!(cw_next <= MAX_TILE_ID, ETileIdTooLarge);
    };
    if (ccw_next != INVALID_TILE_ID) {
        assert!(ccw_next <= MAX_TILE_ID, ETileIdTooLarge);
    };

    TileStatic {
        x,
        y,
        kind,
        size,
        price,
        base_toll,
        special,
        cw_next,
        ccw_next,
        ring_id,
        ring_idx
    }
}

// 创建地图模板
public fun new_map_template(
    id: u16,
    width: u8,
    height: u8,
    ctx: &mut TxContext
): MapTemplate {
    MapTemplate {
        id,
        status: 1,  // 默认为 active 状态
        width,
        height,
        tile_count: 0,
        tiles_static: vector[],  // 初始化为空 vector
        adj: table::new(ctx),
        hospital_ids: vector[],
        prison_ids: vector[],
        shop_ids: vector[],
        news_ids: vector[]
    }
}

//注意， 关于 tile_id
// 现有代码依赖顺序 ID
// 很多地方假设 tile_id 是连续的
//   cw_next: Table<u64, u64>   // 下一格是 id+1 或回到 0

// 向模板添加地块
public fun add_tile_to_template(
    template: &mut MapTemplate,
    tile_id: u16,
    mut tile: TileStatic
) {
    // 添加tile_id边界检查
    assert!(tile_id <= MAX_TILE_ID, ETileIdTooLarge);

    // 确保 tile_id 是连续的（必须等于当前 vector 长度）
    let current_count = template.tiles_static.length() as u16;
    assert!(tile_id == current_count, ETileIdNotSequential);

    // 如果导航字段未设置（等于INVALID_TILE_ID），初始化为自环
    // 这样新创建的地块默认是"孤岛"，后续通过set_cw_next/set_ccw_next建立连接
    if (tile.cw_next == INVALID_TILE_ID) {
        tile.cw_next = tile_id;
    };
    if (tile.ccw_next == INVALID_TILE_ID) {
        tile.ccw_next = tile_id;
    };

    template.tiles_static.push_back(tile);
    template.tile_count = template.tile_count + 1;

    // 根据地块类型添加到对应的ID列表
    if (tile.kind == types::TILE_HOSPITAL()) {
        template.hospital_ids.push_back(tile_id);
    } else if (tile.kind == types::TILE_PRISON()) {
        template.prison_ids.push_back(tile_id);
    } else if (tile.kind == types::TILE_SHOP()) {
        template.shop_ids.push_back(tile_id);
    } else if (tile.kind == types::TILE_NEWS()) {
        template.news_ids.push_back(tile_id);
    };
}

// 设置地块的邻接关系
public fun set_tile_adjacency(
    template: &mut MapTemplate,
    tile_id: u16,
    neighbors: vector<u16>
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
    tile_id: u16,
    next_id: u16
) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);

    // 验证next_id的有效性
    // 允许自环（next_id == tile_id）用于表示端点
    // 但禁止设置为INVALID_TILE_ID（除非是真正的未设置状态）
    assert!(next_id != INVALID_TILE_ID, EInvalidNextTileId);
    assert!(next_id <= MAX_TILE_ID, ETileIdTooLarge);

    // 如果不是自环，验证目标地块存在
    if (next_id != tile_id) {
        assert!((next_id as u64) < template.tiles_static.length(), ETargetTileNotExist);
    };

    let tile = &mut template.tiles_static[tile_id as u64];
    tile.cw_next = next_id;
}

// 设置逆时针下一格
public fun set_ccw_next(
    template: &mut MapTemplate,
    tile_id: u16,
    next_id: u16
) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);

    // 验证next_id的有效性
    // 允许自环（next_id == tile_id）用于表示端点
    // 但禁止设置为INVALID_TILE_ID（除非是真正的未设置状态）
    assert!(next_id != INVALID_TILE_ID, EInvalidNextTileId);
    assert!(next_id <= MAX_TILE_ID, ETileIdTooLarge);

    // 如果不是自环，验证目标地块存在
    if (next_id != tile_id) {
        assert!((next_id as u64) < template.tiles_static.length(), ETargetTileNotExist);
    };

    let tile = &mut template.tiles_static[tile_id as u64];
    tile.ccw_next = next_id;
}

// 设置环路信息
public fun set_ring_info(
    template: &mut MapTemplate,
    tile_id: u16,
    ring_id: u8,
    ring_idx: u16
) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    let tile = &mut template.tiles_static[tile_id as u64];
    tile.ring_id = ring_id;
    tile.ring_idx = ring_idx;
}


// ===== Template Query Functions 模板查询函数 =====

// 获取地块信息
public fun get_tile(template: &MapTemplate, tile_id: u16): &TileStatic {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    &template.tiles_static[tile_id as u64]
}

// 获取顺时针下一格
public fun get_cw_next(template: &MapTemplate, tile_id: u16): u16 {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    let tile = &template.tiles_static[tile_id as u64];
    tile.cw_next
}

// 获取逆时针下一格
public fun get_ccw_next(template: &MapTemplate, tile_id: u16): u16 {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    let tile = &template.tiles_static[tile_id as u64];
    tile.ccw_next
}

// 获取地块所属环路ID
public fun get_ring_id(template: &MapTemplate, tile_id: u16): u8 {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    let tile = &template.tiles_static[tile_id as u64];
    tile.ring_id
}

// 获取地块在环路中的索引
public fun get_ring_idx(template: &MapTemplate, tile_id: u16): u16 {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    let tile = &template.tiles_static[tile_id as u64];
    tile.ring_idx
}

// 获取邻接地块
public fun get_neighbors(template: &MapTemplate, tile_id: u16): vector<u16> {
    if (table::contains(&template.adj, tile_id)) {
        *table::borrow(&template.adj, tile_id)
    } else {
        vector[]
    }
}

// 检查地块是否存在
public fun has_tile(template: &MapTemplate, tile_id: u16): bool {
    (tile_id as u64) < template.tiles_static.length()
}

// 获取医院地块ID列表
public fun get_hospital_ids(template: &MapTemplate): vector<u16> {
    template.hospital_ids
}

// 获取监狱地块ID列表
public fun get_prison_ids(template: &MapTemplate): vector<u16> {
    template.prison_ids
}

// 获取商店地块ID列表
public fun get_shop_ids(template: &MapTemplate): vector<u16> {
    template.shop_ids
}

// 获取新闻地块ID列表
public fun get_news_ids(template: &MapTemplate): vector<u16> {
    template.news_ids
}

// 获取地图宽度
public fun get_width(template: &MapTemplate): u8 {
    template.width
}

// 获取地图高度
public fun get_height(template: &MapTemplate): u8 {
    template.height
}

// 检查地块是否有邻接表（分叉）
public fun tile_has_adj(template: &MapTemplate, tile_id: u16): bool {
    table::contains(&template.adj, tile_id) &&
    !(table::borrow(&template.adj, tile_id)).is_empty()
}

// 获取地块的邻接列表
public fun get_adj_tiles(template: &MapTemplate, tile_id: u16): &vector<u16> {
    table::borrow(&template.adj, tile_id)
}

// 检查地块是否可以放置NPC
public fun can_place_npc_on_tile(tile_kind: u8): bool {
    tile_kind == types::TILE_PROPERTY() ||
    tile_kind == types::TILE_EMPTY()
}

// 获取地块总数
public fun get_tile_count(template: &MapTemplate): u64 {
    template.tile_count
}

// 获取模板ID
public fun get_template_id(template: &MapTemplate): u16 {
    template.id
}


// 设置模板状态（允许更新，不加权限控制）
public fun set_template_status(registry: &mut MapRegistry, template_id: u16, status: u8) {
    let template = table::borrow_mut(&mut registry.templates, template_id);
    template.status = status;
}

// 获取模板状态
public fun get_template_status(registry: &MapRegistry, template_id: u16): u8 {
    let template = table::borrow(&registry.templates, template_id);
    template.status
}

// ===== TileStatic Accessors 地块访问器 =====
public fun tile_x(tile: &TileStatic): u8 { tile.x }
public fun tile_y(tile: &TileStatic): u8 { tile.y }
public fun tile_kind(tile: &TileStatic): u8 { tile.kind }
public fun tile_size(tile: &TileStatic): u8 { tile.size }
public fun tile_price(tile: &TileStatic): u64 { tile.price }
public fun tile_base_toll(tile: &TileStatic): u64 { tile.base_toll }
public fun tile_special(tile: &TileStatic): u64 { tile.special }
public fun tile_cw_next(tile: &TileStatic): u16 { tile.cw_next }
public fun tile_ccw_next(tile: &TileStatic): u16 { tile.ccw_next }
public fun tile_ring_id(tile: &TileStatic): u8 { tile.ring_id }
public fun tile_ring_idx(tile: &TileStatic): u16 { tile.ring_idx }

// ===== Test Helper Functions 测试辅助函数 =====

// 创建简单的8格测试地图
public fun create_test_map_8(ctx: &mut TxContext): MapTemplate {
    let mut template = new_map_template(1, 3, 3, ctx);

    // 创建8个地块，形成环形
    // tile 0: 起点 (0,0) - PROPERTY
    add_tile_to_template(&mut template, 0,
        new_tile_static(0, 0, types::TILE_PROPERTY(), types::SIZE_1X1(), 1000, 100, 0));

    // tile 1: (1,0) - PROPERTY
    add_tile_to_template(&mut template, 1,
        new_tile_static(1, 0, types::TILE_PROPERTY(), types::SIZE_1X1(), 1200, 120, 0));

    // tile 2: (2,0) - CARD
    add_tile_to_template(&mut template, 2,
        new_tile_static(2, 0, types::TILE_CARD(), types::SIZE_1X1(), 0, 0, 0));

    // tile 3: (2,1) - PROPERTY
    add_tile_to_template(&mut template, 3,
        new_tile_static(2, 1, types::TILE_PROPERTY(), types::SIZE_1X1(), 1500, 150, 0));

    // tile 4: (2,2) - PROPERTY
    add_tile_to_template(&mut template, 4,
        new_tile_static(2, 2, types::TILE_PROPERTY(), types::SIZE_1X1(), 1800, 180, 0));

    // tile 5: (1,2) - HOSPITAL
    add_tile_to_template(&mut template, 5,
        new_tile_static(1, 2, types::TILE_HOSPITAL(), types::SIZE_1X1(), 0, 0, 2)); // special=2表示停留2回合

    // tile 6: (0,2) - PROPERTY
    add_tile_to_template(&mut template, 6,
        new_tile_static(0, 2, types::TILE_PROPERTY(), types::SIZE_1X1(), 2000, 200, 0));

    // tile 7: (0,1) - PROPERTY
    add_tile_to_template(&mut template, 7,
        new_tile_static(0, 1, types::TILE_PROPERTY(), types::SIZE_1X1(), 2200, 220, 0));

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
        set_ring_info(&mut template, i, 0, (i as u16));
        i = i + 1;
    };

    template
}

// ===== Test Helper Functions 测试辅助函数 =====

#[test_only]
public fun create_template(
    name: vector<u8>,
    description: vector<u8>,
    width: u8,
    height: u8,
    ctx: &mut TxContext
): MapTemplate {
    let template = new_map_template(1, width, height, ctx);
    // name和description仅用于创建，不存储在模板中
    template
}

#[test_only]
public fun add_tile(
    template: &mut MapTemplate,
    x: u8,
    y: u8,
    kind: u8,
    name: vector<u8>,
    price: u64,
    toll: u64
) {
    let tile_id = ((y as u16) * (template.width as u16) + (x as u16));
    add_tile_to_template(
        template,
        tile_id,
        new_tile_static(x, y, kind, types::SIZE_1X1(), price, toll, 0)
    );
}

#[test_only]
public fun add_connection(
    template: &mut MapTemplate,
    from: u16,
    to: u16
) {
    set_cw_next(template, from, to);
    if (from > 0) {
        set_ccw_next(template, to, from);
    };
}

#[test_only]
public fun finalize_template(template: &mut MapTemplate) {
    // 模板已准备就绪
}

#[test_only]
public fun register_template<T>(
    _admin_cap: &T,
    registry: &mut MapRegistry,
    template: MapTemplate,
    ctx: &mut TxContext
): u16 {
    let tid = template.id;
    publish_template(registry, template, ctx);
    tid
}

// 注意：MapTemplate没有name和description字段，这些是在创建时通过参数传入的
// 如果需要修改，应该在MapRegistry中存储相关信息
