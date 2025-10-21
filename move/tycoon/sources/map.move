module tycoon::map;

use sui::table::{Self, Table};
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::transfer;
use sui::bcs;

use tycoon::types;

// ===== Errors =====
const ETileOccupiedByNpc: u64 = 2001;
const ENoSuchTile: u64 = 2002;
const ETileAlreadyExists: u64 = 3003;
const ETileIdTooLarge: u64 = 3010;
const ETileIdNotSequential: u64 = 3011;
const EInvalidNextTileId: u64 = 3012;
const ETargetTileNotExist: u64 = 3013;
const EInvalidSchemaVersion: u64 = 3021;

// ===== Constants =====
const INVALID_TILE_ID: u16 = 65535;    // u16::MAX 作为无效/未设置的tile_id
const MAX_TILE_ID: u16 = 65534;        // 实际可用的最大tile_id
const NO_BUILDING: u16 = 65535;        // u16::MAX 表示tile不属于任何building

// ===== BuildingStatic 静态建筑信息 =====
public struct BuildingStatic has store, copy, drop {
    x: u8,
    y: u8,
    size: u8,
    price: u64,
    chain_prev_id: u16,
    chain_next_id: u16
}

// ===== TileStatic 静态地块信息 =====
public struct TileStatic has store, copy, drop {
    x: u8,
    y: u8,
    kind: u8,
    building_id: u16,
    special: u64,
    w: u16,
    n: u16,
    e: u16,
    s: u16
}

// ===== MapTemplate 地图模板（静态，不随对局变化） =====
/// 定义完整的地图布局和连接关系
public struct MapTemplate has key, store {
    id: UID,
    schema_version: u8,
    tiles_static: vector<TileStatic>,
    buildings_static: vector<BuildingStatic>,
    hospital_ids: vector<u16>
}

// ===== MapRegistry 地图注册表 =====
public struct MapRegistry has key, store {
    id: UID,
    templates: vector<ID>
}

// ===== Entry Functions 入口函数 =====

public(package) fun create_registry_internal(ctx: &mut TxContext): MapRegistry {
    MapRegistry {
        id: object::new(ctx),
        templates: vector[]
    }
}

// ===== Template Creation Functions 模板创建函数 =====

fun new_building_static(
    x: u8,
    y: u8,
    size: u8,
    price: u64,
    chain_prev_id: u16,
    chain_next_id: u16
): BuildingStatic {
    BuildingStatic {
        x,
        y,
        size,
        price,
        chain_prev_id,
        chain_next_id
    }
}

fun new_tile_static_with_nav(
    x: u8,
    y: u8,
    kind: u8,
    building_id: u16,
    special: u64,
    w: u16,
    n: u16,
    e: u16,
    s: u16
): TileStatic {
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


public(package) fun publish_map_from_bcs(
    schema_version: u8,
    tiles_bcs: vector<u8>,
    buildings_bcs: vector<u8>,
    ctx: &mut TxContext
): (ID, u64, u64) {

    let mut bcs_reader = bcs::new(buildings_bcs);
    let building_count = bcs_reader.peel_vec_length();

    let mut buildings: vector<BuildingStatic> = vector[];

    let mut i = 0;
    while (i < building_count) {
        let x = bcs_reader.peel_u8();
        let y = bcs_reader.peel_u8();
        let size = bcs_reader.peel_u8();
        let price = bcs_reader.peel_u64();
        let chain_prev_id = bcs_reader.peel_u16();
        let chain_next_id = bcs_reader.peel_u16();

        let building = new_building_static(x, y, size, price, chain_prev_id, chain_next_id);
        buildings.push_back(building);
        i = i + 1;
    };

    bcs_reader = bcs::new(tiles_bcs);
    let tile_count = bcs_reader.peel_vec_length();

    let mut tiles: vector<TileStatic> = vector[];
    let mut hospital_ids: vector<u16> = vector[];

    i = 0;
    while (i < tile_count) {
        let x = bcs_reader.peel_u8();
        let y = bcs_reader.peel_u8();
        let kind = bcs_reader.peel_u8();
        let building_id = bcs_reader.peel_u16();
        let special = bcs_reader.peel_u64();
        let w = bcs_reader.peel_u16();
        let n = bcs_reader.peel_u16();
        let e = bcs_reader.peel_u16();
        let s = bcs_reader.peel_u16();

        let tile = new_tile_static_with_nav(
            x, y, kind, building_id, special,
            w, n, e, s
        );
        tiles.push_back(tile);
        if (kind == types::TILE_HOSPITAL()) {
            hospital_ids.push_back(i as u16);
        };

        i = i + 1;
    };


    let template = MapTemplate {
        id: object::new(ctx),
        schema_version,
        tiles_static: tiles,
        buildings_static: buildings,
        hospital_ids: hospital_ids
    };
    let map_id = object::uid_to_inner(&template.id);

    transfer::share_object(template);

    (map_id, tile_count, building_count)
}

// ===== Template Query Functions 模板查询函数 =====

public(package) fun get_tile(template: &MapTemplate, tile_id: u16): &TileStatic {
    assert!((tile_id as u64) < template.tiles_static.length(), ENoSuchTile);
    &template.tiles_static[tile_id as u64]
}

public(package) fun get_valid_neighbors(template: &MapTemplate, tile_id: u16): vector<u16> {
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

public(package) fun get_hospital_ids(template: &MapTemplate): vector<u16> {
    template.hospital_ids
}

public(package) fun can_place_npc_on_tile(tile_kind: u8): bool {
    tile_kind == types::TILE_EMPTY()
}

public(package) fun get_tile_count(template: &MapTemplate): u64 {
    template.tiles_static.length()
}

public(package) fun get_building_count(template: &MapTemplate): u64 {
    template.buildings_static.length()
}

public(package) fun get_map_id(template: &MapTemplate): ID {
    object::uid_to_inner(&template.id)
}

// ===== TileStatic Accessors 地块访问器 =====
public(package) fun tile_kind(tile: &TileStatic): u8 { tile.kind }
public(package) fun tile_building_id(tile: &TileStatic): u16 { tile.building_id }
public(package) fun tile_special(tile: &TileStatic): u64 { tile.special }
public(package) fun tile_w(tile: &TileStatic): u16 { tile.w }
public(package) fun tile_n(tile: &TileStatic): u16 { tile.n }
public(package) fun tile_e(tile: &TileStatic): u16 { tile.e }
public(package) fun tile_s(tile: &TileStatic): u16 { tile.s }

public(package) fun building_size(building: &BuildingStatic): u8 { building.size }
public(package) fun building_price(building: &BuildingStatic): u64 { building.price }
public(package) fun building_chain_prev_id(building: &BuildingStatic): u16 { building.chain_prev_id }
public(package) fun building_chain_next_id(building: &BuildingStatic): u16 { building.chain_next_id }

public(package) fun get_building(template: &MapTemplate, building_id: u16): &BuildingStatic {
    assert!((building_id as u64) < template.buildings_static.length(), 0);
    &template.buildings_static[building_id as u64]
}

public(package) fun no_building(): u16 { NO_BUILDING }



