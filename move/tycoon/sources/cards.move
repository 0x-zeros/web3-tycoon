module tycoon::cards;

use std::option::{Self, Option};
use sui::table::{Self, Table};
use sui::transfer;
use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};
use tycoon::types;
use tycoon::admin;

// ===== Errors =====
const ECardNotOwned: u64 = 5001;
const EHandLimit: u64 = 5002;
const EInvalidCardTarget: u64 = 5003;

// ===== Card Definition 卡牌元数据 =====
// 这是卡牌的元数据定义，不是玩家拥有的卡牌实例
// 玩家拥有的卡牌仅用Table<u16, u64>记录数量
public struct Card has store, copy, drop {
    kind: u16,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,  // 0=无目标, 1=玩家, 2=地块, 3=玩家或地块
    value: u64,       // 卡牌相关的数值（如遥控骰的点数）
    rarity: u8        // 稀有度: 0=common, 1=rare, 2=epic, 3=legendary
}

// ===== CardRegistry 全局卡牌注册表 =====
public struct CardRegistry has key {
    id: UID,
    cards: Table<u16, Card>,         // 卡牌定义
    card_count: u64                   // 卡牌总数
}

// ===== DropConfig 掉落配置表 =====
public struct DropConfig has key {
    id: UID,
    tile_drops: Table<u8, DropRule>,    // 不同地块的掉落规则
    pass_drop_rate: u64,                // 经过时掉落概率 (basis points, 10000 = 100%)
    stop_drop_rate: u64,                // 停留时掉落概率
    default_pool: vector<u16>,          // 默认卡牌池
    default_weights: vector<u64>        // 默认权重分布
}

// ===== DropRule 掉落规则 =====
public struct DropRule has store, drop {
    card_pool: vector<u16>,    // 可掉落的卡牌ID列表
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

// 创建卡牌注册表（在模块初始化时调用）
public fun create_card_registry(ctx: &mut TxContext) {
    let mut registry = CardRegistry {
        id: object::new(ctx),
        cards: table::new(ctx),
        card_count: 0
    };

    // 初始化基础卡牌
    init_basic_cards(&mut registry);

    transfer::share_object(registry);
}

// 创建掉落配置表
public fun create_drop_config(ctx: &mut TxContext) {
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

    transfer::share_object(config);
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
        types::card_cleanse()
    ];

    // 设置默认权重（common=40, rare=30, epic=10）
    config.default_weights = vector[
        40,  // move_ctrl (common)
        40,  // barrier (common)
        30,  // bomb (rare)
        30,  // rent_free (rare)
        10,  // freeze (epic)
        30,  // dog (rare)
        40   // cleanse (common)
    ];

    // 设置卡牌格的掉落规则
    let card_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: config.default_weights,
        quantity: 2  // 停留时抽2张
    };
    table::add(&mut config.tile_drops, types::tile_card(), card_tile_rule);

    // 设置奖励格的掉落规则（更高概率稀有卡）
    let bonus_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: vector[20, 20, 40, 40, 30, 40, 20],  // 提高稀有卡权重
        quantity: 3  // 奖励格抽3张
    };
    table::add(&mut config.tile_drops, types::tile_bonus(), bonus_tile_rule);
}

// 内部函数：注册卡牌到注册表
fun register_card_internal(
    registry: &mut CardRegistry,
    kind: u16,
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

    if (table::contains(&registry.cards, kind)) {
        *table::borrow_mut(&mut registry.cards, kind) = card;
    } else {
        table::add(&mut registry.cards, kind, card);
        registry.card_count = registry.card_count + 1;
    };
}

// ===== Admin Functions 管理函数 =====

// 注册新卡牌（需要AdminCap）
public fun register_card(
    _cap: &admin::AdminCap,
    registry: &mut CardRegistry,
    kind: u16,
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
    if (table::contains(&config.tile_drops, tile_type)) {
        *table::borrow_mut(&mut config.tile_drops, tile_type) = rule;
    } else {
        table::add(&mut config.tile_drops, tile_type, rule);
    };
}

// ===== Query Functions 查询函数 =====

// 获取卡牌信息
public fun get_card(registry: &CardRegistry, kind: u16): &Card {
    assert!(table::contains(&registry.cards, kind), ECardNotOwned);
    table::borrow(&registry.cards, kind)
}

// 检查卡牌是否存在
public fun has_card(registry: &CardRegistry, kind: u16): bool {
    table::contains(&registry.cards, kind)
}

// ===== Card Management Functions 卡牌管理函数 =====

// 给玩家发卡
public fun give_card_to_player(
    player_cards: &mut Table<u16, u64>,
    kind: u16,
    count: u64
) {
    if (table::contains(player_cards, kind)) {
        let current = *table::borrow(player_cards, kind);
        *table::borrow_mut(player_cards, kind) = current + count;
    } else {
        table::add(player_cards, kind, count);
    };
}

// 检查玩家是否有卡
public fun player_has_card(
    player_cards: &Table<u16, u64>,
    kind: u16
): bool {
    table::contains(player_cards, kind) && *table::borrow(player_cards, kind) > 0
}

// 获取玩家卡牌数量
public fun get_player_card_count(
    player_cards: &Table<u16, u64>,
    kind: u16
): u64 {
    if (table::contains(player_cards, kind)) {
        *table::borrow(player_cards, kind)
    } else {
        0
    }
}

// 使用玩家的卡牌
public fun use_player_card(
    player_cards: &mut Table<u16, u64>,
    kind: u16
): bool {
    if (!player_has_card(player_cards, kind)) {
        return false
    };

    let current = *table::borrow(player_cards, kind);
    if (current > 1) {
        *table::borrow_mut(player_cards, kind) = current - 1;
    } else {
        table::remove(player_cards, kind);
    };

    true
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
    npc_on_tile: bool,
    current_npc_count: u16,
    npc_cap: u16
): bool {
    !npc_on_tile && current_npc_count < npc_cap
}

// 验证卡牌使用目标
public fun validate_card_target(
    card: &Card,
    target_player: Option<address>,
    target_tile: Option<u64>
): bool {
    let target_type = card.target_type;

    if (target_type == target_none()) {
        option::is_none(&target_player) && option::is_none(&target_tile)
    } else if (target_type == target_player()) {
        option::is_some(&target_player) && option::is_none(&target_tile)
    } else if (target_type == target_tile()) {
        option::is_none(&target_player) && option::is_some(&target_tile)
    } else if (target_type == target_player_or_tile()) {
        option::is_some(&target_player) || option::is_some(&target_tile)
    } else {
        false
    }
}

// ===== Card Drawing Functions 抽卡函数 =====

// 计算应该抽取的卡牌种类（简单随机）
public fun determine_card_draw(seed: u64): u16 {
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

    let index = (seed % 7) as u64;  // 0-6 //todo 7 -> card_types.length()
    *card_types.borrow(index)
}

// 经过卡牌格时抽卡
public fun draw_card_on_pass(seed: u64): (u16, u64) {
    let card_kind = determine_card_draw(seed);
    (card_kind, 1)  // 经过时抽1张
}

// 停留卡牌格时抽卡
public fun draw_card_on_stop(seed: u64): (u16, u64) {
    let card_kind = determine_card_draw(seed);
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
        option::some(current_turn + card.value)
    } else {
        option::none()
    }
}

// 检查卡牌是否需要目标
public fun card_needs_target(kind: u16, registry: &CardRegistry): bool {
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
public fun get_card_kind(card: &Card): u16 {
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
public fun count_total_cards(player_cards: &Table<u16, u64>): u64 {
    let mut total = 0;
    let mut i = 0;

    // 遍历所有卡牌类型
    let card_types = vector[
        types::card_move_ctrl(),
        types::card_barrier(),
        types::card_bomb(),
        types::card_rent_free(),
        types::card_freeze(),
        types::card_dog(),
        types::card_cleanse()
    ];

    while (i < card_types.length()) {
        let kind = *card_types.borrow(i);
        if (table::contains(player_cards, kind)) {
            total = total + *table::borrow(player_cards, kind);
        };
        i = i + 1;
    };

    total
}

// 检查手牌是否达到上限
public fun is_hand_full(player_cards: &Table<u16, u64>, max_cards: u64): bool {
    count_total_cards(player_cards) >= max_cards
}

// ===== Test Helper Functions 测试辅助函数 =====

// 创建测试用卡牌
#[test_only]
public fun create_test_card(
    kind: u16,
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
public fun create_empty_card_table(ctx: &mut TxContext): Table<u16, u64> {
    table::new(ctx)
}

// 测试用初始化函数
#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

// ===== Module Initialization =====

// 模块初始化函数
fun init(ctx: &mut TxContext) {
    // 创建卡牌注册表
    create_card_registry(ctx);

    // 创建掉落配置表
    create_drop_config(ctx);
}