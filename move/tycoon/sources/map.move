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
const NO_BUILDING: u16 = 65535;        // u16::MAX 表示tile不属于任何building

// ===== BuildingStatic 静态建筑信息 =====
//
// 功能说明：
// 定义建筑的静态属性（价格、租金等）
// 建筑分为1x1和2x2两种尺寸
// 建筑类型（temple/research等）是动态属性，存储在Building.building_type
//
// 字段说明：
// - size: 建筑大小（SIZE_1X1/SIZE_2X2）
// - price: 购买价格
// - chain_prev_id: 前一个连街建筑ID（NO_BUILDING表示无效）
// - chain_next_id: 后一个连街建筑ID（NO_BUILDING表示无效）
public struct BuildingStatic has store, copy, drop {
    size: u8,       // 建筑大小（1x1 或 2x2）
    price: u64,     // 购买价格
    chain_prev_id: u16,  // 前一个连街建筑（只对1x1有效）
    chain_next_id: u16   // 后一个连街建筑（只对1x1有效）
}

// ===== TileStatic 静态地块信息 =====
//
// 功能说明：
// 定义地图上每个地块的静态属性
// 这些属性在游戏过程中不会改变，作为地图模板的一部分
//
// 字段说明：
// - x, y: 地块在地图上的坐标位置
// - kind: 地块类型（EMPTY/LOTTERY/HOSPITAL等功能型）
// - building_id: 关联的建筑ID（NO_BUILDING表示无建筑）
// - special: 额外参数位，用于功能地块的特殊配置
//   * 医院/监狱：停留回合数
//   * 罚金/奖励：金额
//   * 其他特殊效果
// - w/n/e/s: 西/北/东/南四个方向的邻居地块ID
public struct TileStatic has store, copy, drop {
    x: u8,
    y: u8,
    kind: u8,           // TileKind (功能型：EMPTY/LOTTERY/HOSPITAL等)
    building_id: u16,   // 关联的建筑ID（NO_BUILDING表示无建筑）
    special: u64,       // 额外参数（功能地块使用）
    w: u16,             // west邻居 (x-1方向)
    n: u16,             // north邻居 (z-1方向)
    e: u16,             // east邻居 (x+1方向)
    s: u16              // south邻居 (z+1方向)
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
//
// 地块数据：
// - tiles_static: 所有地块的静态信息
// - buildings_static: 所有建筑的静态信息
//
// 导航系统：
// - 每个tile通过w/n/e/s字段存储4方向邻居，无需额外邻接表
//
// 特殊地块索引：
// - hospital_ids: 所有医院地块（用于送医院功能）
//
public struct MapTemplate has store {
    id: u16,
    tiles_static: vector<TileStatic>,  // 使用 vector，tile_id 即为索引
    buildings_static: vector<BuildingStatic>, // 建筑静态信息，building_id 即为索引
    // 导航信息已集成到 TileStatic.w/n/e/s 中，不再需要额外的邻接表
    hospital_ids: vector<u16>
}

//meta data， 描述，截图等可以放到warus里？或者随便啥网站上，和move无关（？）


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
    building_id: u16,  // NO_BUILDING 表示无建筑
    special: u64
): TileStatic {
    TileStatic {
        x,
        y,
        kind,
        building_id,
        special,
        w: INVALID_TILE_ID,           // 使用无效值表示无邻居
        n: INVALID_TILE_ID,
        e: INVALID_TILE_ID,
        s: INVALID_TILE_ID
    }
}

// 创建建筑静态信息
public fun new_building_static(
    size: u8,
    price: u64,
    chain_prev_id: u16,
    chain_next_id: u16
): BuildingStatic {
    BuildingStatic {
        size,
        price,
        chain_prev_id,
        chain_next_id
    }
}

// 创建地块静态信息（带完整导航信息）
public fun new_tile_static_with_nav(
    x: u8,
    y: u8,
    kind: u8,
    building_id: u16,  // NO_BUILDING 表示无建筑
    special: u64,
    w: u16,
    n: u16,
    e: u16,
    s: u16
): TileStatic {
    // 验证导航字段的有效性
    // 允许 INVALID_TILE_ID 表示无邻居
    // 但如果不是 INVALID_TILE_ID，必须是有效范围内
    if (w != INVALID_TILE_ID) {
        assert!(w <= MAX_TILE_ID, ETileIdTooLarge);
    };
    if (n != INVALID_TILE_ID) {
        assert!(n <= MAX_TILE_ID, ETileIdTooLarge);
    };
    if (e != INVALID_TILE_ID) {
        assert!(e <= MAX_TILE_ID, ETileIdTooLarge);
    };
    if (s != INVALID_TILE_ID) {
        assert!(s <= MAX_TILE_ID, ETileIdTooLarge);
    };

    TileStatic {
        x,
        y,
        kind,
        building_id,
        special,
        w,
        n,
        e,
        s
    }
}

// 创建地图模板
public fun new_map_template(
    id: u16,
    _ctx: &mut TxContext
): MapTemplate {
    MapTemplate {
        id,
        tiles_static: vector[],  // 初始化为空 vector
        buildings_static: vector[],  // 初始化为空 vector
        hospital_ids: vector[]
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

    // w/n/e/s默认为INVALID_TILE_ID，表示无邻居
    // 后续通过set_w/n/e/s建立连接

    template.tiles_static.push_back(tile);

    // 根据地块类型添加到对应的ID列表
    if (tile.kind == types::TILE_HOSPITAL()) {
        template.hospital_ids.push_back(tile_id);
    };
}

// 设置west方向邻居
public fun set_w(template: &mut MapTemplate, tile_id: u16, neighbor_id: u16) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    if (neighbor_id != INVALID_TILE_ID) {
        assert!(neighbor_id <= MAX_TILE_ID, ETileIdTooLarge);
        assert!((neighbor_id as u64) < template.tiles_static.length(), ETargetTileNotExist);
    };
    let tile = &mut template.tiles_static[tile_id as u64];
    tile.w = neighbor_id;
}

// 设置north方向邻居
public fun set_n(template: &mut MapTemplate, tile_id: u16, neighbor_id: u16) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    if (neighbor_id != INVALID_TILE_ID) {
        assert!(neighbor_id <= MAX_TILE_ID, ETileIdTooLarge);
        assert!((neighbor_id as u64) < template.tiles_static.length(), ETargetTileNotExist);
    };
    let tile = &mut template.tiles_static[tile_id as u64];
    tile.n = neighbor_id;
}

// 设置east方向邻居
public fun set_e(template: &mut MapTemplate, tile_id: u16, neighbor_id: u16) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    if (neighbor_id != INVALID_TILE_ID) {
        assert!(neighbor_id <= MAX_TILE_ID, ETileIdTooLarge);
        assert!((neighbor_id as u64) < template.tiles_static.length(), ETargetTileNotExist);
    };
    let tile = &mut template.tiles_static[tile_id as u64];
    tile.e = neighbor_id;
}

// 设置south方向邻居
public fun set_s(template: &mut MapTemplate, tile_id: u16, neighbor_id: u16) {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    if (neighbor_id != INVALID_TILE_ID) {
        assert!(neighbor_id <= MAX_TILE_ID, ETileIdTooLarge);
        assert!((neighbor_id as u64) < template.tiles_static.length(), ETargetTileNotExist);
    };
    let tile = &mut template.tiles_static[tile_id as u64];
    tile.s = neighbor_id;
}

// ===== Template Query Functions 模板查询函数 =====

// 获取地块信息
public fun get_tile(template: &MapTemplate, tile_id: u16): &TileStatic {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    &template.tiles_static[tile_id as u64]
}

// 获取所有有效邻居（!=INVALID_TILE_ID）
public fun get_valid_neighbors(template: &MapTemplate, tile_id: u16): vector<u16> {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    let tile = &template.tiles_static[tile_id as u64];
    let mut neighbors = vector[];

    if (tile.w != INVALID_TILE_ID) {
        neighbors.push_back(tile.w);
    };
    if (tile.n != INVALID_TILE_ID) {
        neighbors.push_back(tile.n);
    };
    if (tile.e != INVALID_TILE_ID) {
        neighbors.push_back(tile.e);
    };
    if (tile.s != INVALID_TILE_ID) {
        neighbors.push_back(tile.s);
    };

    neighbors
}

// 检查地块是否存在
public fun has_tile(template: &MapTemplate, tile_id: u16): bool {
    (tile_id as u64) < template.tiles_static.length()
}

// 获取医院地块ID列表
public fun get_hospital_ids(template: &MapTemplate): vector<u16> {
    template.hospital_ids
}

// 检查地块是否可以放置NPC
public fun can_place_npc_on_tile(tile_kind: u8): bool {
    tile_kind == types::TILE_EMPTY()
}

// 获取地块总数
public fun get_tile_count(template: &MapTemplate): u64 {
    template.tiles_static.length()
}

// 获取建筑总数
public fun get_building_count(template: &MapTemplate): u64 {
    template.buildings_static.length()
}

// 获取模板ID
public fun get_template_id(template: &MapTemplate): u16 {
    template.id
}

// ===== TileStatic Accessors 地块访问器 =====
public fun tile_x(tile: &TileStatic): u8 { tile.x }
public fun tile_y(tile: &TileStatic): u8 { tile.y }
public fun tile_kind(tile: &TileStatic): u8 { tile.kind }
public fun tile_building_id(tile: &TileStatic): u16 { tile.building_id }
public fun tile_special(tile: &TileStatic): u64 { tile.special }
public fun tile_w(tile: &TileStatic): u16 { tile.w }
public fun tile_n(tile: &TileStatic): u16 { tile.n }
public fun tile_e(tile: &TileStatic): u16 { tile.e }
public fun tile_s(tile: &TileStatic): u16 { tile.s }

// BuildingStatic 访问器函数
public fun building_size(building: &BuildingStatic): u8 { building.size }
public fun building_price(building: &BuildingStatic): u64 { building.price }
public fun building_chain_prev_id(building: &BuildingStatic): u16 { building.chain_prev_id }
public fun building_chain_next_id(building: &BuildingStatic): u16 { building.chain_next_id }

// 添加建筑到模板
public fun add_building_to_template(
    template: &mut MapTemplate,
    building: BuildingStatic
): u16 {
    let building_id = template.buildings_static.length() as u16;
    template.buildings_static.push_back(building);
    building_id
}

// 获取建筑信息
public fun get_building(template: &MapTemplate, building_id: u16): &BuildingStatic {
    assert!((building_id as u64) < template.buildings_static.length(), 0);
    &template.buildings_static[building_id as u64]
}

// 检查tile是否有关联的building
public fun tile_has_building(tile: &TileStatic): bool {
    tile.building_id != NO_BUILDING
}

// 导出常量供其他模块使用
public fun no_building(): u16 { NO_BUILDING }

// 手动设置 hospital_ids（供 BCS 反序列化使用）
public(package) fun set_hospital_ids(
    template: &mut MapTemplate,
    hospital_ids: vector<u16>
) {
    template.hospital_ids = hospital_ids;
}

// get_chain_buildings 移至 game.move 以避免循环依赖
