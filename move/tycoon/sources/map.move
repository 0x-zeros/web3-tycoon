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
    id: u64,
    status: u8,                    // 模板状态
    width: u16,
    height: u16,
    tile_count: u64,
    tiles_static: Table<u64 /* tile_id */, TileStatic>,
    adj: Table<u64 /* tile_id */, vector<u64> /* neighbors */>,
    cw_next: Table<u64, u64>,     // 顺时针下一格                   //todo cw_next 这样的指针，一个u64就直接放tile里最好呀
    ccw_next: Table<u64, u64>,    // 逆时针下一格
    ring_id: Table<u64, u16>,     // 所属环路ID
    ring_idx: Table<u64, u32>,    // 在环路中的索引
    hospital_ids: vector<u64>,
    prison_ids: vector<u64>,
    shop_ids: vector<u64>,
    news_ids: vector<u64>
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
    templates: Table<u64, MapTemplate>,
    template_count: u64
}

// ===== Entry Functions 入口函数 =====

// 创建地图注册表
public(package) fun create_registry(ctx: &mut TxContext): ID {
    let registry = MapRegistry {
        id: object::new(ctx),
        templates: table::new(ctx),
        template_count: 0
    };
    let registry_id = object::id(&registry);
    transfer::share_object(registry);
    registry_id
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
public fun get_template(registry: &MapRegistry, template_id: u64): &MapTemplate {
    assert!(table::contains(&registry.templates, template_id), ETemplateNotFound);
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
    width: u16,
    height: u16,
    ctx: &mut TxContext
): MapTemplate {
    MapTemplate {
        id,
        status: 1,  // 默认为 active 状态
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
        news_ids: vector::empty()
    }
}

//注意， 关于 tile_id
// 现有代码依赖顺序 ID
// 很多地方假设 tile_id 是连续的
//   cw_next: Table<u64, u64>   // 下一格是 id+1 或回到 0

// 向模板添加地块
public fun add_tile_to_template(
    template: &mut MapTemplate,
    tile_id: u64,
    tile: TileStatic
) {
    assert!(!table::contains(&template.tiles_static, tile_id), ETileAlreadyExists);
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


// ===== Template Query Functions 模板查询函数 =====

// 获取地块信息
public fun get_tile(template: &MapTemplate, tile_id: u64): &TileStatic {
    assert!(table::contains(&template.tiles_static, tile_id), ENoSuchTile);
    table::borrow(&template.tiles_static, tile_id)
}

// 获取顺时针下一格
public fun get_cw_next(template: &MapTemplate, tile_id: u64): u64 {
    assert!(table::contains(&template.cw_next, tile_id), ENoSuchTile);
    *table::borrow(&template.cw_next, tile_id)
}

// 获取逆时针下一格
public fun get_ccw_next(template: &MapTemplate, tile_id: u64): u64 {
    assert!(table::contains(&template.ccw_next, tile_id), ENoSuchTile);
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

// 检查地块是否有邻接表（分叉）
public fun tile_has_adj(template: &MapTemplate, tile_id: u64): bool {
    table::contains(&template.adj, tile_id) &&
    !table::borrow(&template.adj, tile_id).is_empty()
}

// 获取地块的邻接列表
public fun get_adj_tiles(template: &MapTemplate, tile_id: u64): &vector<u64> {
    table::borrow(&template.adj, tile_id)
}

// 获取地块总数
public fun get_tile_count(template: &MapTemplate): u64 {
    template.tile_count
}

// 获取模板ID
public fun get_template_id(template: &MapTemplate): u64 {
    template.id
}


// 设置模板状态（允许更新，不加权限控制）
public fun set_template_status(registry: &mut MapRegistry, template_id: u64, status: u8) {
    let template = table::borrow_mut(&mut registry.templates, template_id);
    template.status = status;
}

// 获取模板状态
public fun get_template_status(registry: &MapRegistry, template_id: u64): u8 {
    let template = table::borrow(&registry.templates, template_id);
    template.status
}

// ===== TileStatic Accessors 地块访问器 =====
public fun tile_x(tile: &TileStatic): u16 { tile.x }
public fun tile_y(tile: &TileStatic): u16 { tile.y }
public fun tile_kind(tile: &TileStatic): u8 { tile.kind }
public fun tile_size(tile: &TileStatic): u8 { tile.size }
public fun tile_price(tile: &TileStatic): u64 { tile.price }
public fun tile_base_toll(tile: &TileStatic): u64 { tile.base_toll }
public fun tile_special(tile: &TileStatic): u64 { tile.special }

// ===== Adjacency Pathfinding Functions 邻接寻路函数 =====

// 判断是否可以在k步内到达
public fun can_reach_in_k_steps(
    template: &MapTemplate,
    from: u64,
    to: u64,
    k: u8
): bool {
    if (from == to) return true;
    if (k == 0) return false;

    // 使用BFS进行邻接寻路
    // 使用三个并行数组模拟BFSNode
    let mut visited = vector::empty<u64>();
    let mut queue_tiles = vector::empty<u64>();
    let mut queue_depths = vector::empty<u8>();

    // 初始化队列
    queue_tiles.push_back(from);
    queue_depths.push_back(0);
    visited.push_back(from);

    // BFS搜索
    while (!queue_tiles.is_empty()) {
        let tile_id = queue_tiles.remove(0);
        let depth = queue_depths.remove(0);

        if (tile_id == to) {
            return true
        };

        if (depth >= k) {
            continue
        };

        // 获取邻居
        if (table::contains(&template.adj, tile_id)) {
            let neighbors = table::borrow(&template.adj, tile_id);
            let mut i = 0;
            while (i < neighbors.length()) {
                let neighbor = *neighbors.borrow(i);
                if (!vector::contains(&visited, &neighbor)) {
                    visited.push_back(neighbor);
                    queue_tiles.push_back(neighbor);
                    queue_depths.push_back(depth + 1);
                };
                i = i + 1;
            };
        };
    };

    false
}

// ===== BFS寻路算法：计算从起点到终点的下一步移动位置 =====
//
// 功能说明：
// 使用广度优先搜索(BFS)算法找出从当前位置(from)到目标位置(to)的最短路径，
// 并返回路径上的第一步（下一个应该移动到的地块）
//
// 参数：
// - template: 地图模板，包含地块连接关系
// - from: 起始地块ID
// - to: 目标地块ID
// - k: 最大搜索深度限制（防止在大地图上无限搜索）
//
// 返回值：
// - Some(tile_id): 下一步应该移动到的地块ID
// - None: 无法找到路径或已到达目标
// ===== Test Helper Functions 测试辅助函数 =====

// 创建简单的8格测试地图
public fun create_test_map_8(ctx: &mut TxContext): MapTemplate {
    let mut template = new_map_template(1, 3, 3, ctx);

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

    template
}

// ===== Test Helper Functions 测试辅助函数 =====

#[test_only]
public fun create_template(
    name: vector<u8>,
    description: vector<u8>,
    width: u16,
    height: u16,
    ctx: &mut TxContext
): MapTemplate {
    let template = new_map_template(1, width, height, ctx);
    // name和description仅用于创建，不存储在模板中
    template
}

#[test_only]
public fun add_tile(
    template: &mut MapTemplate,
    x: u16,
    y: u16,
    kind: u8,
    name: vector<u8>,
    price: u64,
    toll: u64
) {
    let tile_id = ((y as u64) * (template.width as u64) + (x as u64));
    add_tile_to_template(
        template,
        tile_id,
        new_tile_static(x, y, kind, types::size_1x1(), price, toll, 0)
    );
}

#[test_only]
public fun add_connection(
    template: &mut MapTemplate,
    from: u64,
    to: u64
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
): u64 {
    let tid = template.id;
    publish_template(registry, template, ctx);
    tid
}

// 注意：MapTemplate没有name和description字段，这些是在创建时通过参数传入的
// 如果需要修改，应该在MapRegistry中存储相关信息
