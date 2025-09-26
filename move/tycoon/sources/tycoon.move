/// 包的顶层模块，负责初始化所有共享资源
module tycoon::tycoon;

use sui::transfer;
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use sui::event;

use tycoon::admin::{Self, AdminCap};
use tycoon::map;
use tycoon::cards;

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
    upgrade_multipliers: vector<u64>,  // 升级费用倍率
    toll_multipliers: vector<u64>,     // 租金倍率
}

// ===== Events 事件 =====

/// GameData 创建事件
public struct GameDataCreated has copy, drop {
    data_id: ID
}


// ===== Package Init 包初始化 =====

/// 包发布时的初始化函数
/// 创建所有全局唯一的共享对象
fun init(ctx: &mut TxContext) {
    // 1. 创建管理员权限并转移给部署者
    admin::create_admin_cap(ctx);

    // 2. 创建统一的游戏数据容器
    let game_data = GameData {
        id: object::new(ctx),
        // 创建并存储各个注册表
        map_registry: map::create_registry_internal(ctx),
        card_registry: cards::create_card_registry_internal(ctx),
        drop_config: cards::create_drop_config_internal(ctx),

        // 全局游戏数值配置
        starting_cash: 10000,
        upgrade_multipliers: vector[150, 200, 300, 500],  // 1.5x, 2x, 3x, 5x
        toll_multipliers: vector[100, 150, 200, 300, 500], // 1x, 1.5x, 2x, 3x, 5x
    };

    let game_data_id = object::id(&game_data);
    transfer::share_object(game_data);
    event::emit(GameDataCreated { data_id: game_data_id });
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
public fun DEFAULT_STARTING_CASH(): u64 { DEFAULT_STARTING_CASH }

/// 获取默认物价提升天数
public fun DEFAULT_PRICE_RISE_DAYS(): u8 { DEFAULT_PRICE_RISE_DAYS }

/// 获取默认最大回合数
public fun DEFAULT_MAX_ROUNDS(): u8 { DEFAULT_MAX_ROUNDS }

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
    _admin: &admin::AdminCap
) {
    game_data.starting_cash = new_cash;
}

/// 更新升级倍率（需要AdminCap）
entry fun update_upgrade_multipliers(
    game_data: &mut GameData,
    new_multipliers: vector<u64>,
    _admin: &admin::AdminCap
) {
    assert!(!new_multipliers.is_empty(), 0); // 确保不为空
    game_data.upgrade_multipliers = new_multipliers;
}

/// 更新租金倍率（需要AdminCap）
entry fun update_toll_multipliers(
    game_data: &mut GameData,
    new_multipliers: vector<u64>,
    _admin: &admin::AdminCap
) {
    assert!(!new_multipliers.is_empty(), 0); // 确保不为空
    game_data.toll_multipliers = new_multipliers;
}

// ===== Test Helper 测试辅助 =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}