module tycoon::map;

use std::option::{Self, Option};
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
    digest: vector<u8>,           // 模板摘要哈希
    use_adj_traversal: bool       // 是否需要邻接寻路（复杂地图用）
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
        digest: vector::empty(),
        use_adj_traversal: false  // 默认不使用邻接寻路
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

// 设置是否使用邻接寻路
public fun set_use_adj_traversal(template: &mut MapTemplate, use_adj: bool) {
    template.use_adj_traversal = use_adj;
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

// 获取是否使用邻接寻路
public fun get_use_adj_traversal(template: &MapTemplate): bool {
    template.use_adj_traversal
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

    // 如果不使用邻接寻路，使用环路计算
    if (!template.use_adj_traversal) {
        return can_reach_via_ring(template, from, to, k)
    };

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

// 获取朝目标移动的下一步
public fun next_step_toward(
    template: &MapTemplate,
    from: u64,
    to: u64,
    k: u8
): Option<u64> {
    if (from == to) return option::none();

    // 如果不使用邻接寻路，使用环路导航
    if (!template.use_adj_traversal) {
        return next_step_via_ring(template, from, to)
    };

    // 使用BFS寻找路径
    // 使用并行数组代替结构体
    let mut visited = vector::empty<u64>();
    let mut queue_tiles = vector::empty<u64>();
    let mut queue_depths = vector::empty<u8>();
    let mut queue_parents = vector::empty<Option<u64>>();

    queue_tiles.push_back(from);
    queue_depths.push_back(0);
    queue_parents.push_back(option::none());
    visited.push_back(from);

    while (!queue_tiles.is_empty()) {
        let tile_id = queue_tiles.remove(0);
        let depth = queue_depths.remove(0);
        let parent = queue_parents.remove(0);

        if (tile_id == to) {
            // 回溯找到第一步
            if (option::is_some(&parent) && *option::borrow(&parent) == from) {
                // 直接相邻
                return option::some(tile_id)
            };
            // 需要继续寻找第一步（简化处理）
            return option::none()
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

                    // 如果是第一层，记录可以作为第一步
                    if (depth == 0) {
                        queue_parents.push_back(option::some(neighbor));
                    } else {
                        // 传递第一步信息
                        queue_parents.push_back(parent);
                    }
                };
                i = i + 1;
            };
        };
    };

    option::none()
}

// 通过环路判断可达性
fun can_reach_via_ring(
    template: &MapTemplate,
    from: u64,
    to: u64,
    k: u8
): bool {
    // 检查是否在同一环路
    if (!table::contains(&template.ring_id, from) ||
        !table::contains(&template.ring_id, to)) {
        return false
    };

    let from_ring = *table::borrow(&template.ring_id, from);
    let to_ring = *table::borrow(&template.ring_id, to);

    if (from_ring != to_ring) {
        // 不同环路，需要通过邻接判断
        return false
    };

    // 同一环路，计算距离
    let from_idx = *table::borrow(&template.ring_idx, from);
    let to_idx = *table::borrow(&template.ring_idx, to);

    // 计算顺时针和逆时针距离
    let ring_size = get_ring_size(template, from_ring);
    let cw_dist = if (to_idx >= from_idx) {
        to_idx - from_idx
    } else {
        ring_size - from_idx + to_idx
    };

    let ccw_dist = if (from_idx >= to_idx) {
        from_idx - to_idx
    } else {
        ring_size - to_idx + from_idx
    };

    // 返回最短距离是否在k步内
    (cw_dist as u8) <= k || (ccw_dist as u8) <= k
}

// 通过环路获取下一步
fun next_step_via_ring(
    template: &MapTemplate,
    from: u64,
    to: u64
): Option<u64> {
    // 检查是否在同一环路
    if (!table::contains(&template.ring_id, from) ||
        !table::contains(&template.ring_id, to)) {
        return option::none()
    };

    let from_ring = *table::borrow(&template.ring_id, from);
    let to_ring = *table::borrow(&template.ring_id, to);

    if (from_ring != to_ring) {
        return option::none()
    };

    // 同一环路，计算最短方向
    let from_idx = *table::borrow(&template.ring_idx, from);
    let to_idx = *table::borrow(&template.ring_idx, to);

    let ring_size = get_ring_size(template, from_ring);
    let cw_dist = if (to_idx >= from_idx) {
        to_idx - from_idx
    } else {
        ring_size - from_idx + to_idx
    };

    let ccw_dist = if (from_idx >= to_idx) {
        from_idx - to_idx
    } else {
        ring_size - to_idx + from_idx
    };

    // 选择较短的方向
    if (cw_dist <= ccw_dist) {
        option::some(*table::borrow(&template.cw_next, from))
    } else {
        option::some(*table::borrow(&template.ccw_next, from))
    }
}

// 获取环路大小（辅助函数）
fun get_ring_size(template: &MapTemplate, ring_id: u16): u32 {
    // 简化实现：遍历计算环路中的地块数
    let mut count = 0u32;
    let mut i = 0u64;
    while (i < template.tile_count) {
        if (table::contains(&template.ring_id, i) &&
            *table::borrow(&template.ring_id, i) == ring_id) {
            count = count + 1;
        };
        i = i + 1;
    };
    count
}

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