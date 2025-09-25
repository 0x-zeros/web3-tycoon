module tycoon::cards;

use std::option::Option;
use sui::table::{Self, Table};
use sui::transfer;
use sui::object::{Self, UID, ID};
use sui::tx_context::{Self, TxContext};
use tycoon::types;
use tycoon::admin;

// ===== Errors =====
const ECardNotOwned: u64 = 5001;
const EHandLimit: u64 = 5002;
const EInvalidCardTarget: u64 = 5003;

// ===== CardEntry 卡牌条目 =====
//
// 功能说明：
// 表示玩家手牌中的一种卡牌及其数量
// 使用vector存储替代Table以优化小集合性能
//
// 字段说明：
// - kind: 卡牌类型（使用types模块的CARD_*常量）
// - count: 持有数量（0表示无此卡，保留条目避免动态添加/删除）
public struct CardEntry has store, copy, drop {
    kind: u8,   // 卡牌类型
    count: u8   // 数量（0-255）
}

// CardEntry accessor functions
public fun card_entry_kind(entry: &CardEntry): u8 { entry.kind }
public fun card_entry_count(entry: &CardEntry): u8 { entry.count }
public fun new_card_entry(kind: u8, count: u8): CardEntry { CardEntry { kind, count } }

// ===== Card Definition 卡牌元数据 =====
// 这是卡牌的元数据定义，不是玩家拥有的卡牌实例
// 玩家拥有的卡牌用vector<CardEntry>记录
public struct Card has store, copy, drop {
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,  // 0=无目标, 1=玩家, 2=地块, 3=玩家或地块
    value: u64,       // 卡牌相关的数值（如遥控骰的点数）
    rarity: u8        // 稀有度: 0=common, 1=rare, 2=epic, 3=legendary
}

// ===== CardRegistry 全局卡牌注册表 =====
public struct CardRegistry has key, store {
    id: UID,
    cards: Table<u8, Card>,         // 卡牌定义
    card_count: u64                   // 卡牌总数
}

// ===== DropConfig 掉落配置表 =====
public struct DropConfig has key, store {
    id: UID,
    tile_drops: Table<u8, DropRule>,    // 不同地块的掉落规则
    pass_drop_rate: u64,                // 经过时掉落概率 (basis points, 10000 = 100%)
    stop_drop_rate: u64,                // 停留时掉落概率
    default_pool: vector<u8>,          // 默认卡牌池
    default_weights: vector<u64>        // 默认权重分布
}

// ===== DropRule 掉落规则 =====
public struct DropRule has store, drop {
    card_pool: vector<u8>,    // 可掉落的卡牌ID列表
    weights: vector<u64>,       // 对应的权重
    quantity: u64               // 掉落数量
}

// ===== Card Effects Context 卡牌效果上下文 =====
public struct CardEffectContext {
    game_id: ID,
    player: address,
    turn: u64,
    target_player: Option<address>,
    target_tile: Option<u64>
}

// ===== Card Target Types 目标类型常量 =====
public fun target_none(): u8 { 0 }
public fun target_player(): u8 { 1 }
public fun target_tile(): u8 { 2 }
public fun target_player_or_tile(): u8 { 3 }

// ===== Card Catalog Functions 卡牌目录函数 =====

// ===== Registry Creation 注册表创建 =====

// 创建卡牌注册表（返回对象，供内部使用）
public(package) fun create_card_registry_internal(ctx: &mut TxContext): CardRegistry {
    let mut registry = CardRegistry {
        id: object::new(ctx),
        cards: table::new(ctx),
        card_count: 0
    };

    // 初始化基础卡牌
    init_basic_cards(&mut registry);

    registry
}

// 创建卡牌注册表（保留兼容性）
public(package) fun create_card_registry(ctx: &mut TxContext): ID {
    let registry = create_card_registry_internal(ctx);
    let registry_id = object::id(&registry);
    transfer::share_object(registry);
    registry_id
}

// 创建掉落配置表（返回对象，供内部使用）
public(package) fun create_drop_config_internal(ctx: &mut TxContext): DropConfig {
    let mut config = DropConfig {
        id: object::new(ctx),
        tile_drops: table::new(ctx),
        pass_drop_rate: 1000,  // 10% 概率
        stop_drop_rate: 5000,  // 50% 概率
        default_pool: vector[],
        default_weights: vector[]
    };

    // 初始化默认掉落规则
    init_default_drop_rules(&mut config);

    config
}

// 创建掉落配置表（保留兼容性）
public(package) fun create_drop_config(ctx: &mut TxContext): ID {
    let config = create_drop_config_internal(ctx);
    let config_id = object::id(&config);
    transfer::share_object(config);
    config_id
}

// 初始化基础卡牌
fun init_basic_cards(registry: &mut CardRegistry) {
    // 遥控骰子卡
    register_card_internal(registry,
        types::card_move_ctrl(),
        b"Move Control",
        b"Control your next dice roll",
        target_none(), //todo player?
        3,  // 默认设置为3点
        0   // common rarity
    );

    // 路障卡
    register_card_internal(registry,
        types::card_barrier(),
        b"Barrier",
        b"Place a barrier on a tile",
        target_tile(),
        0,
        0  // common
    );

    // 炸弹卡
    register_card_internal(registry,
        types::card_bomb(),
        b"Bomb",
        b"Place a bomb on a tile",
        target_tile(),
        0,
        1  // rare
    );

    // 免租卡
    register_card_internal(registry,
        types::card_rent_free(),
        b"Rent Free",
        b"Avoid paying rent this turn",
        target_none(),
        1,  // 持续1回合
        1   // rare
    );

    // 冻结卡
    register_card_internal(registry,
        types::card_freeze(),
        b"Freeze",
        b"Freeze a player for one turn",
        target_player(),
        1,  // 冻结1回合
        2   // epic
    );

    // 狗狗卡
    register_card_internal(registry,
        types::card_dog(),
        b"Dog",
        b"Place a dog NPC on a tile",
        target_tile(),
        0,
        1  // rare
    );

    // 清除卡
    register_card_internal(registry,
        types::card_cleanse(),
        b"Cleanse",
        b"Remove an NPC from a tile",
        target_tile(),
        0,
        0  // common
    );

    // 转向卡
    register_card_internal(registry,
        types::card_turn(),
        b"Turn Card",
        b"Reverse your movement direction",
        target_none(),  // 即时效果，不需要目标
        0,
        0  // common rarity
    );
}

// 初始化默认掉落规则
fun init_default_drop_rules(config: &mut DropConfig) {
    // 设置默认卡牌池
    config.default_pool = vector[
        types::card_move_ctrl(),
        types::card_barrier(),
        types::card_bomb(),
        types::card_rent_free(),
        types::card_freeze(),
        types::card_dog(),
        types::card_cleanse(),
        types::card_turn()
    ];

    // 设置默认权重（common=40, rare=30, epic=10）
    config.default_weights = vector[
        40,  // move_ctrl (common)
        40,  // barrier (common)
        30,  // bomb (rare)
        30,  // rent_free (rare)
        10,  // freeze (epic)
        30,  // dog (rare)
        40,  // cleanse (common)
        40   // turn (common)
    ];

    // 设置卡牌格的掉落规则
    let card_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: config.default_weights,
        quantity: 2  // 停留时抽2张
    };
    config.tile_drops.add(types::tile_card(), card_tile_rule);

    // 设置奖励格的掉落规则（更高概率稀有卡）
    let bonus_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: vector[20, 20, 40, 40, 30, 40, 20, 20],  // 提高稀有卡权重，包含转向卡
        quantity: 3  // 奖励格抽3张
    };
    config.tile_drops.add(types::tile_bonus(), bonus_tile_rule);
}

// 内部函数：注册卡牌到注册表
fun register_card_internal(
    registry: &mut CardRegistry,
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64,
    rarity: u8
) {
    let card = Card {
        kind,
        name,
        description,
        target_type,
        value,
        rarity
    };

    if (registry.cards.contains(kind)) {
        *registry.cards.borrow_mut(kind) = card;
    } else {
        registry.cards.add(kind, card);
        registry.card_count = registry.card_count + 1;
    };
}

// ===== Admin Functions 管理函数 =====

// 注册新卡牌（需要AdminCap）
public fun register_card(
    _cap: &admin::AdminCap,
    registry: &mut CardRegistry,
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64,
    rarity: u8,
    _ctx: &mut TxContext
) {
    register_card_internal(registry, kind, name, description, target_type, value, rarity);
}

// 更新掉落配置（需要AdminCap）
public fun update_drop_config(
    _cap: &admin::AdminCap,
    config: &mut DropConfig,
    tile_type: u8,
    rule: DropRule,
    _ctx: &mut TxContext
) {
    if (config.tile_drops.contains(tile_type)) {
        *config.tile_drops.borrow_mut(tile_type) = rule;
    } else {
        config.tile_drops.add(tile_type, rule);
    };
}

// ===== Query Functions 查询函数 =====

// 获取卡牌信息
public fun get_card(registry: &CardRegistry, kind: u8): &Card {
    assert!(registry.cards.contains(kind), ECardNotOwned);
    registry.cards[kind]
}

// 检查卡牌是否存在
public fun has_card(registry: &CardRegistry, kind: u8): bool {
    registry.cards.contains(kind)
}

// ===== Card Management Functions 卡牌管理函数 =====

// 给玩家发卡
public fun give_card_to_player(
    player_cards: &mut vector<CardEntry>,
    kind: u8,
    count: u8
) {
    let mut i = 0;
    let len = player_cards.length();

    // 查找是否已有该类型卡牌
    while (i < len) {
        let entry = &mut player_cards[i];
        if (entry.kind == kind) {
            // 更新数量，注意防止溢出
            let new_count = (entry.count as u64) + (count as u64);
            entry.count = if (new_count > 255) { 255 } else { (new_count as u8) };
            return
        };
        i = i + 1;
    };

    // 如果没有找到，添加新条目
    player_cards.push_back(CardEntry { kind, count });
}

// 检查玩家是否有卡
public fun player_has_card(
    player_cards: &vector<CardEntry>,
    kind: u8
): bool {
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = player_cards.borrow(i);
        if (entry.kind == kind && entry.count > 0) {
            return true
        };
        i = i + 1;
    };
    false
}

// 获取玩家卡牌数量
public fun get_player_card_count(
    player_cards: &vector<CardEntry>,
    kind: u8
): u8 {
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = player_cards.borrow(i);
        if (entry.kind == kind) {
            return entry.count
        };
        i = i + 1;
    };
    0
}

// 使用玩家的卡牌
public fun use_player_card(
    player_cards: &mut vector<CardEntry>,
    kind: u8
): bool {
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = &mut player_cards[i];
        if (entry.kind == kind && entry.count > 0) {
            entry.count = entry.count - 1;
            return true
        };
        i = i + 1;
    };
    false
}

// ===== Card Effect Functions 卡牌效果函数 =====
//todo 没有用到？
// 应用遥控骰效果
public fun apply_move_control(dice_value: u8): u8 {
    // 返回指定的骰子值
    dice_value
}

// 检查是否可以放置NPC
public fun can_place_npc(
    npc_on_tile: bool
): bool {
    // 仅限制同一地块不可重复放置
    !npc_on_tile
}

// 验证卡牌使用目标
public fun validate_card_target(
    card: &Card,
    target_player: Option<address>,
    target_tile: Option<u64>
): bool {
    let target_type = card.target_type;

    if (target_type == target_none()) {
        target_player.is_none() && target_tile.is_none()
    } else if (target_type == target_player()) {
        target_player.is_some() && target_tile.is_none()
    } else if (target_type == target_tile()) {
        target_player.is_none() && target_tile.is_some()
    } else if (target_type == target_player_or_tile()) {
        target_player.is_some() || target_tile.is_some()
    } else {
        false
    }
}

// ===== Card Drawing Functions 抽卡函数 =====

// 计算应该抽取的卡牌种类（使用预生成的随机值）
public fun determine_card_draw(random_value: u8): u8 {
    // 简单的随机卡牌选择
    let card_types = vector[
        types::card_move_ctrl(),
        types::card_barrier(),
        types::card_bomb(),
        types::card_rent_free(),
        types::card_freeze(),
        types::card_dog(),
        types::card_cleanse()
    ];

    let index = ((random_value as u64) % card_types.length());
    card_types[index]
}

// 经过卡牌格时抽卡
public fun draw_card_on_pass(random_value: u8): (u8, u8) {
    let card_kind = determine_card_draw(random_value);
    (card_kind, 1)  // 经过时抽1张
}

// 停留卡牌格时抽卡
public fun draw_card_on_stop(random_value: u8): (u8, u8) {
    let card_kind = determine_card_draw(random_value);
    (card_kind, 2)  // 停留时抽2张
}

// ===== Card Effect Application 卡牌效果应用 =====

// 创建卡牌效果上下文
public fun create_effect_context(
    game_id: ID,
    player: address,
    turn: u64,
    target_player: Option<address>,
    target_tile: Option<u64>
): CardEffectContext {
    CardEffectContext {
        game_id,
        player,
        turn,
        target_player,
        target_tile
    }
}

// 获取卡牌效果持续时间
public fun get_card_duration(card: &Card, current_turn: u64): Option<u64> {
    if (card.kind == types::card_rent_free() || card.kind == types::card_freeze()) {
        some(current_turn + card.value)
    } else {
        none()
    }
}

// 检查卡牌是否需要目标
public fun card_needs_target(kind: u8, registry: &CardRegistry): bool {
    if (has_card(registry, kind)) {
        let card = get_card(registry, kind);
        card.target_type != target_none()
    } else {
        false
    }
}

// ===== Helper Functions 辅助函数 =====

//todo 利用函数导出struct数据
// #[test_only]
// public use fun game_board as Game.board;

// #[test_only]
// public fun game_board(game: &Game): vector<u8> {
//     game.board
// }

// 获取卡牌名称
public fun get_card_name(card: &Card): &vector<u8> {
    &card.name
}

// 获取卡牌描述
public fun get_card_description(card: &Card): &vector<u8> {
    &card.description
}

// 获取卡牌种类
public fun get_card_kind(card: &Card): u8 {
    card.kind
}

// 获取卡牌值
public fun get_card_value(card: &Card): u64 {
    card.value
}

// 获取卡牌目标类型
public fun get_card_target_type(card: &Card): u8 {
    card.target_type
}

// 计算手牌总数
public fun count_total_cards(player_cards: &vector<CardEntry>): u64 {
    let mut total = 0;
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = player_cards.borrow(i);
        total = total + (entry.count as u64);
        i = i + 1;
    };

    total
}

// 检查手牌是否达到上限
public fun is_hand_full(player_cards: &vector<CardEntry>, max_cards: u64): bool {
    count_total_cards(player_cards) >= max_cards
}

// ===== Test Helper Functions 测试辅助函数 =====

// 创建测试用卡牌
#[test_only]
public fun create_test_card(
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64,
    rarity: u8
): Card {
    Card {
        kind,
        name,
        description,
        target_type,
        value,
        rarity
    }
}

// 创建空的卡牌表
#[test_only]
public fun create_empty_card_vector(): vector<CardEntry> {
    vector[]
}

// [已移除] init_for_testing - CardRegistry 和 DropConfig 现在在 admin::init 中创建

// ===== Module Initialization =====
// 注：CardRegistry 和 DropConfig 现在在 admin 模块的 init 中创建，确保全局唯一
