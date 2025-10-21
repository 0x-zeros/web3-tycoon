module tycoon::cards;

use sui::table::{Self, Table};
use sui::transfer;
use sui::object::{Self, UID};
use sui::tx_context::TxContext;
use tycoon::types;

// ===== Errors =====
const EHandLimit: u64 = 5002;

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
public(package) fun new_card_entry(kind: u8, count: u8): CardEntry { CardEntry { kind, count } }

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
    cards: vector<Card>  // 卡牌定义（索引即为kind，0-based连续）
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

// ===== Card Target Types 目标类型常量 =====
fun target_none(): u8 { 0 }
fun target_player(): u8 { 1 }
fun target_tile(): u8 { 2 }

// ===== Card Catalog Functions 卡牌目录函数 =====

// ===== Registry Creation 注册表创建 =====

// 创建卡牌注册表（返回对象，供内部使用）
public(package) fun create_card_registry_internal(ctx: &mut TxContext): CardRegistry {
    let mut registry = CardRegistry {
        id: object::new(ctx),
        cards: vector[]
    };

    // 初始化基础卡牌
    init_basic_cards(&mut registry);

    registry
}

// 创建并共享卡牌注册表
public(package) fun create_and_share_card_registry(ctx: &mut TxContext) {
    let registry = create_card_registry_internal(ctx);
    transfer::share_object(registry);
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

// 创建并共享掉落配置表
public(package) fun create_and_share_drop_config(ctx: &mut TxContext) {
    let config = create_drop_config_internal(ctx);
    transfer::share_object(config);
}

// 初始化基础卡牌
fun init_basic_cards(registry: &mut CardRegistry) {
    // 遥控骰子卡
    register_card_internal(registry,
        types::CARD_MOVE_CTRL(),
        b"Move Control",
        b"Control your next dice roll",
        target_none(), //todo player?
        3,  // 默认设置为3点
        0   // common rarity
    );

    // 路障卡
    register_card_internal(registry,
        types::CARD_BARRIER(),
        b"Barrier",
        b"Place a barrier on a tile",
        target_tile(),
        0,
        0  // common
    );

    // 炸弹卡
    register_card_internal(registry,
        types::CARD_BOMB(),
        b"Bomb",
        b"Place a bomb on a tile",
        target_tile(),
        0,
        1  // rare
    );

    // 免租卡
    register_card_internal(registry,
        types::CARD_RENT_FREE(),
        b"Rent Free",
        b"Avoid paying rent this turn",
        target_none(),
        1,  // 持续1回合
        1   // rare
    );

    // 冻结卡
    register_card_internal(registry,
        types::CARD_FREEZE(),
        b"Freeze",
        b"Freeze a player for one turn",
        target_player(),
        1,  // 冻结1回合
        2   // epic
    );

    // 狗狗卡
    register_card_internal(registry,
        types::CARD_DOG(),
        b"Dog",
        b"Place a dog NPC on a tile",
        target_tile(),
        0,
        1  // rare
    );

    // 清除卡
    register_card_internal(registry,
        types::CARD_CLEANSE(),
        b"Cleanse",
        b"Remove an NPC from a tile",
        target_tile(),
        0,
        0  // common
    );

    // 转向卡
    register_card_internal(registry,
        types::CARD_TURN(),
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
        types::CARD_MOVE_CTRL(),
        types::CARD_BARRIER(),
        types::CARD_BOMB(),
        types::CARD_RENT_FREE(),
        types::CARD_FREEZE(),
        types::CARD_DOG(),
        types::CARD_CLEANSE(),
        types::CARD_TURN()
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
    table::add(&mut config.tile_drops, types::TILE_CARD(), card_tile_rule);

    // 设置奖励格的掉落规则（更高概率稀有卡）
    let bonus_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: vector[20, 20, 40, 40, 30, 40, 20, 20],  // 提高稀有卡权重，包含转向卡
        quantity: 3  // 奖励格抽3张
    };
    table::add(&mut config.tile_drops, types::TILE_BONUS(), bonus_tile_rule);
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

    // vector索引对齐：cards[kind] = card
    // 假设按顺序注册（kind = 0, 1, 2, ...）
    let expected_idx = registry.cards.length();
    assert!(kind as u64 == expected_idx, 0);  // 必须按顺序

    registry.cards.push_back(card);
}

// ===== Admin Functions 管理函数 =====
// Package内部函数，供tycoon模块封装后对外提供

// 注册新卡牌（package内部，由tycoon模块的admin函数调用）
public(package) fun register_card_for_admin(
    registry: &mut CardRegistry,
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64,
    rarity: u8
) {
    register_card_internal(registry, kind, name, description, target_type, value, rarity);
}

// 更新掉落配置（package内部，由tycoon模块的admin函数调用）
public(package) fun update_drop_config_for_admin(
    config: &mut DropConfig,
    tile_type: u8,
    rule: DropRule
) {
    if (table::contains(&config.tile_drops, tile_type)) {
        *table::borrow_mut(&mut config.tile_drops, tile_type) = rule;
    } else {
        table::add(&mut config.tile_drops, tile_type, rule);
    };
}

// ===== Card Management Functions 卡牌管理函数 =====

// 给玩家发卡
public(package) fun give_card_to_player(
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
public(package) fun player_has_card(
    player_cards: &vector<CardEntry>,
    kind: u8
): bool {
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = &player_cards[i];
        if (entry.kind == kind && entry.count > 0) {
            return true
        };
        i = i + 1;
    };
    false
}

// 获取玩家卡牌数量
public(package) fun get_player_card_count(
    player_cards: &vector<CardEntry>,
    kind: u8
): u8 {
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = &player_cards[i];
        if (entry.kind == kind) {
            return entry.count
        };
        i = i + 1;
    };
    0
}

// 使用玩家的卡牌
public(package) fun use_player_card(
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

// ===== Card Drawing Functions 抽卡函数 =====

// 计算应该抽取的卡牌种类（使用预生成的随机值）
fun determine_card_draw(random_value: u8): u8 {
    // 简单的随机卡牌选择
    let card_types = vector[
        types::CARD_MOVE_CTRL(),
        types::CARD_BARRIER(),
        types::CARD_BOMB(),
        types::CARD_RENT_FREE(),
        types::CARD_FREEZE(),
        types::CARD_DOG(),
        types::CARD_CLEANSE()
    ];

    let index = ((random_value as u64) % card_types.length());
    card_types[index]
}

// 经过卡牌格时抽卡
public(package) fun draw_card_on_pass(random_value: u8): (u8, u8) {
    let card_kind = determine_card_draw(random_value);
    (card_kind, 1)  // 经过时抽1张
}

// 停留卡牌格时抽卡
public(package) fun draw_card_on_stop(random_value: u8): (u8, u8) {
    let card_kind = determine_card_draw(random_value);
    (card_kind, 2)  // 停留时抽2张
}
