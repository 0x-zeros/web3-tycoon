/// 包的顶层模块，负责初始化所有共享资源
module tycoon::tycoon;

use sui::transfer;
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::bcs;

use tycoon::map;
use tycoon::cards;
use tycoon::types;
use tycoon::events;

// ===== Admin Cap 管理员权限 =====

/// 管理员权限凭证
public struct AdminCap has key, store {
    id: UID
}

// ===== GameData 统一的策划数据容器 =====

/// 游戏策划数据容器
/// 包含所有共享的游戏配置和注册表
public struct GameData has key, store {
    id: UID,
    // 策划数据注册表（直接字段存储，gas效率更高）
    map_registry: map::MapRegistry,
    card_registry: cards::CardRegistry,
    drop_config: cards::DropConfig,

    // 全局游戏数值配置
    starting_cash: u64,
    upgrade_multipliers: vector<u64>,  // 升级费用倍率（废弃，保留兼容）
    toll_multipliers: vector<u64>,     // 租金倍率（废弃，保留兼容）

    // ===== 新数值系统配置（×100存储避免浮点运算） =====
    // 小地产租金倍率：[L0空地, L1, L2, L3, L4, L5]
    // 对应倍率：[0.5, 1, 2.5, 5, 10, 15]
    rent_multipliers: vector<u64>,

    // 土地庙加成倍率：[1级, 2级, 3级, 4级, 5级]
    // 对应倍率：[1.3, 1.4, 1.5, 1.7, 2.0]
    temple_multipliers: vector<u64>,

    // 小建筑升级价格表：[L0, L1, L2, L3, L4, L5]
    // 基础价格加上这个值再乘以物价系数F
    building_upgrade_costs: vector<u64>,

    // 大建筑租金倍率：[L1, L2, L3, L4, L5]
    large_building_multipliers: vector<u64>,

    // 大建筑升级价格：[L1, L2, L3, L4, L5]
    large_building_costs: vector<u64>,

    // NPC生成配置（权重表）
    npc_spawn_weights: vector<u8>,     // NPC类型的权重列表
}

// ===== Package Init 包初始化 =====

/// 包发布时的初始化函数
/// 创建所有全局唯一的共享对象
fun init(ctx: &mut TxContext) {
    // 1. 创建管理员权限并转移给部署者
    create_admin_cap(ctx);

    // 2. 创建统一的游戏数据容器
    let game_data = GameData {
        id: object::new(ctx),
        // 创建并存储各个注册表
        map_registry: map::create_registry_internal(ctx),
        card_registry: cards::create_card_registry_internal(ctx),
        drop_config: cards::create_drop_config_internal(ctx),

        // 全局游戏数值配置
        starting_cash: 10000,
        upgrade_multipliers: vector[150, 200, 300, 500],  // 废弃，保留兼容
        toll_multipliers: vector[100, 150, 200, 300, 500], // 废弃，保留兼容

        // 新数值系统配置（×100存储）
        // 小地产租金倍率：L0-L5 对应 [0.5, 1, 2.5, 5, 10, 15]倍
        rent_multipliers: vector[50, 100, 250, 500, 1000, 1500],

        // 土地庙加成倍率：1-5级对应 [1.3, 1.4, 1.5, 1.7, 2.0]倍
        temple_multipliers: vector[130, 140, 150, 170, 200],

        // 小建筑升级加价表：L0-L5
        building_upgrade_costs: vector[0, 1000, 1500, 6000, 15000, 35000],

        // 大建筑租金倍率：L1-L5
        large_building_multipliers: vector[150, 200, 300, 500, 800],

        // 大建筑升级价格：L1-L5
        large_building_costs: vector[2000, 3000, 7000, 18000, 40000],

        // NPC生成权重配置
        // 格式：[NPC类型, 权重, NPC类型, 权重, ...]
        // 权重也是spawn npc在地图里同时存在的最大数量
        npc_spawn_weights: vector[
            // types::NPC_BARRIER(), 3,     // 路障 权重3 //路障只能通过玩家使用card放置
            types::NPC_BOMB(), 1,         // 炸弹 权重2
            types::NPC_DOG(), 2,          // 狗 权重2
            types::NPC_LAND_GOD(), 1,     // 土地神 权重1
            types::NPC_WEALTH_GOD(), 1,   // 财神 权重1
            types::NPC_FORTUNE_GOD(), 2,  // 福神 权重1
            types::NPC_POOR_GOD(), 1,     // 穷神 权重2
        ],
    };

    let game_data_id = object::id(&game_data);
    transfer::share_object(game_data);
    events::emit_game_data_created_event(game_data_id);
}

// ===== Admin Functions 管理函数 =====

/// 创建管理员权限并转移给部署者
fun create_admin_cap(ctx: &mut TxContext) {
    let admin_cap = AdminCap {
        id: object::new(ctx)
    };
    transfer::public_transfer(admin_cap, ctx.sender());
}

/// 发布自定义地图模板（通过客户端PTB调用）
entry fun publish_custom_map_template(
    game_data: &mut GameData,
    template_id: u16,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    let template = map::new_map_template(template_id, ctx);
    let tile_count = map::get_tile_count(&template);

    map::publish_template(&mut game_data.map_registry, template, ctx);

    events::emit_map_template_published_event(
        template_id,
        ctx.sender(),
        tile_count
    );
}

/// 验证管理员权限
public fun verify_admin_cap(_admin: &AdminCap): bool {
    true
}

/// 从 BCS 编码的数据创建并发布地图模板
/// 客户端使用 @mysten/sui/bcs 序列化数据，Move 端反序列化
entry fun create_map_from_bcs(
    game_data: &mut GameData,
    template_id: u16,
    tiles_bcs: vector<u8>,
    buildings_bcs: vector<u8>,
    hospital_ids_bcs: vector<u8>,
    _admin: &AdminCap,
    ctx: &mut TxContext
) {
    // 创建空模板
    let mut template = map::new_map_template(template_id, ctx);

    // 1. 反序列化 buildings
    let mut bcs_reader = bcs::new(buildings_bcs);
    let building_count = bcs_reader.peel_vec_length();

    let mut i = 0;
    while (i < building_count) {
        // 按 BuildingStatic 字段顺序 peel：size, price, base_toll
        let size = bcs_reader.peel_u8();
        let price = bcs_reader.peel_u64();
        let base_toll = bcs_reader.peel_u64();

        let building = map::new_building_static(size, price, base_toll);
        map::add_building_to_template(&mut template, building);
        i = i + 1;
    };

    // 2. 反序列化 tiles
    bcs_reader = bcs::new(tiles_bcs);
    let tile_count = bcs_reader.peel_vec_length();

    i = 0;
    while (i < tile_count) {
        // 按 TileStatic 字段顺序 peel：x, y, kind, building_id, special, w, n, e, s
        let x = bcs_reader.peel_u8();
        let y = bcs_reader.peel_u8();
        let kind = bcs_reader.peel_u8();
        let building_id = bcs_reader.peel_u16();
        let special = bcs_reader.peel_u64();
        let w = bcs_reader.peel_u16();
        let n = bcs_reader.peel_u16();
        let e = bcs_reader.peel_u16();
        let s = bcs_reader.peel_u16();

        let tile = map::new_tile_static_with_nav(
            x, y, kind, building_id, special,
            w, n, e, s
        );
        map::add_tile_to_template(&mut template, (i as u16), tile);
        i = i + 1;
    };

    // 3. 反序列化 hospital_ids
    bcs_reader = bcs::new(hospital_ids_bcs);
    let hospital_count = bcs_reader.peel_vec_length();

    let mut hospital_ids = vector[];
    i = 0;
    while (i < hospital_count) {
        hospital_ids.push_back(bcs_reader.peel_u16());
        i = i + 1;
    };

    // 手动设置 hospital_ids（覆盖自动填充的）
    map::set_hospital_ids(&mut template, hospital_ids);

    // 发布模板
    map::publish_template(&mut game_data.map_registry, template, ctx);

    // 发射事件
    events::emit_map_template_published_event(
        template_id,
        ctx.sender(),
        tile_count
    );
}

/// 注册卡牌（需要AdminCap）
entry fun admin_register_card(
    game_data: &mut GameData,
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64,
    rarity: u8,
    _admin: &AdminCap,
    _ctx: &mut TxContext
) {
    cards::register_card_for_admin(
        &mut game_data.card_registry,
        kind,
        name,
        description,
        target_type,
        value,
        rarity
    );
}

/// 更新掉落配置（需要AdminCap）
public fun admin_update_drop_config(
    game_data: &mut GameData,
    tile_type: u8,
    rule: cards::DropRule,
    _admin: &AdminCap
) {
    cards::update_drop_config_for_admin(
        &mut game_data.drop_config,
        tile_type,
        rule
    );
}

// ===== Game Configuration Constants 游戏配置常量 =====

// 起始现金配置
const DEFAULT_STARTING_CASH: u64 = 100000;
const MIN_STARTING_CASH: u64 = 10000;
const MAX_STARTING_CASH: u64 = 500000;

// 物价提升天数配置
const DEFAULT_PRICE_RISE_DAYS: u8 = 15;
const MIN_PRICE_RISE_DAYS: u8 = 1;
const MAX_PRICE_RISE_DAYS: u8 = 100;

// 最大回合数配置
const DEFAULT_MAX_ROUNDS: u8 = 50;
const MIN_MAX_ROUNDS: u8 = 10;
const MAX_MAX_ROUNDS: u8 = 200;

// ===== GameData Accessor Functions 访问器函数 =====

/// 获取地图注册表
public(package) fun get_map_registry(game_data: &GameData): &map::MapRegistry {
    &game_data.map_registry
}

/// 获取卡牌注册表
public(package) fun get_card_registry(game_data: &GameData): &cards::CardRegistry {
    &game_data.card_registry
}

/// 获取掉落配置
public(package) fun get_drop_config(game_data: &GameData): &cards::DropConfig {
    &game_data.drop_config
}

/// 获取起始资金
public(package) fun get_starting_cash(game_data: &GameData): u64 {
    game_data.starting_cash
}

/// 获取升级倍率
public(package) fun get_upgrade_multipliers(game_data: &GameData): &vector<u64> {
    &game_data.upgrade_multipliers
}

/// 获取租金倍率
public(package) fun get_toll_multipliers(game_data: &GameData): &vector<u64> {
    &game_data.toll_multipliers
}

/// 获取NPC生成权重配置
public(package) fun get_npc_spawn_weights(game_data: &GameData): &vector<u8> {
    &game_data.npc_spawn_weights
}

// ===== 新数值系统访问函数 =====

/// 获取小地产租金倍率
public(package) fun get_rent_multipliers(game_data: &GameData): &vector<u64> {
    &game_data.rent_multipliers
}

/// 获取土地庙加成倍率
public(package) fun get_temple_multipliers(game_data: &GameData): &vector<u64> {
    &game_data.temple_multipliers
}

/// 获取小建筑升级价格表
public(package) fun get_building_upgrade_costs(game_data: &GameData): &vector<u64> {
    &game_data.building_upgrade_costs
}

/// 获取大建筑租金倍率
public(package) fun get_large_building_multipliers(game_data: &GameData): &vector<u64> {
    &game_data.large_building_multipliers
}

/// 获取大建筑升级价格
public(package) fun get_large_building_costs(game_data: &GameData): &vector<u64> {
    &game_data.large_building_costs
}

// ===== Configuration Validation Functions 配置验证函数 =====

/// 验证并获取起始现金（带默认值）
public(package) fun validate_starting_cash(value: u64): u64 {
    if (value == 0) {
        DEFAULT_STARTING_CASH
    } else if (value < MIN_STARTING_CASH) {
        MIN_STARTING_CASH
    } else if (value > MAX_STARTING_CASH) {
        MAX_STARTING_CASH
    } else {
        value
    }
}

/// 验证并获取物价提升天数
public(package) fun validate_price_rise_days(value: u8): u8 {
    if (value == 0) {
        DEFAULT_PRICE_RISE_DAYS
    } else if (value < MIN_PRICE_RISE_DAYS) {
        MIN_PRICE_RISE_DAYS
    } else if (value > MAX_PRICE_RISE_DAYS) {
        MAX_PRICE_RISE_DAYS
    } else {
        value
    }
}

/// 验证并获取最大回合数（0表示无限期）
public(package) fun validate_max_rounds(value: u8): u8 {
    if (value == 0) {
        0  // 0表示无限期
    } else if (value < MIN_MAX_ROUNDS) {
        MIN_MAX_ROUNDS
    } else if (value > MAX_MAX_ROUNDS) {
        MAX_MAX_ROUNDS
    } else {
        value
    }
}

/// 获取默认起始现金
public fun get_default_starting_cash(): u64 { DEFAULT_STARTING_CASH }

/// 获取默认物价提升天数
public fun get_default_price_rise_days(): u8 { DEFAULT_PRICE_RISE_DAYS }

/// 获取默认最大回合数
public fun get_default_max_rounds(): u8 { DEFAULT_MAX_ROUNDS }

// ===== Mutable Accessor Functions 可变访问器函数 =====

/// 获取可变的地图注册表（用于测试）
public(package) fun borrow_map_registry_mut(game_data: &mut GameData): &mut map::MapRegistry {
    &mut game_data.map_registry
}


/// 获取可变的卡牌注册表
public(package) fun borrow_card_registry_mut(game_data: &mut GameData): &mut cards::CardRegistry {
    &mut game_data.card_registry
}

// ===== Admin Functions 管理员函数 =====

/// 更新起始资金（需要AdminCap）
entry fun update_starting_cash(
    game_data: &mut GameData,
    new_cash: u64,
    _admin: &AdminCap
) {
    game_data.starting_cash = new_cash;
}

/// 更新升级倍率（需要AdminCap）
entry fun update_upgrade_multipliers(
    game_data: &mut GameData,
    new_multipliers: vector<u64>,
    _admin: &AdminCap
) {
    assert!(!new_multipliers.is_empty(), 0); // 确保不为空
    game_data.upgrade_multipliers = new_multipliers;
}

/// 更新租金倍率（需要AdminCap）
entry fun update_toll_multipliers(
    game_data: &mut GameData,
    new_multipliers: vector<u64>,
    _admin: &AdminCap
) {
    assert!(!new_multipliers.is_empty(), 0); // 确保不为空
    game_data.toll_multipliers = new_multipliers;
}