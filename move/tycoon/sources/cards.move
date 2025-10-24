module tycoon::cards;

use sui::table::{Self, Table};
use sui::transfer;
use sui::object::{Self, UID};
use sui::tx_context::TxContext;
use tycoon::types;

// ===== Errors =====
const EHandLimit: u64 = 5002;

// ===== CardEntry 卡牌条目 =====
/// 使用vector存储替代Table以优化小集合性能
public struct CardEntry has store, copy, drop {
    kind: u8,
    count: u8
}

public(package) fun new_card_entry(kind: u8, count: u8): CardEntry { CardEntry { kind, count } }

// ===== Card Definition 卡牌元数据 =====
/// 卡牌元数据定义，不是玩家拥有的卡牌实例
public struct Card has store, copy, drop {
    kind: u8,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64,
    rarity: u8
}

// ===== CardRegistry 全局卡牌注册表 =====
public struct CardRegistry has key, store {
    id: UID,
    cards: vector<Card>
}

// ===== DropConfig 掉落配置表 =====
public struct DropConfig has key, store {
    id: UID,
    tile_drops: Table<u8, DropRule>,
    pass_drop_rate: u64,
    stop_drop_rate: u64,
    default_pool: vector<u8>,
    default_weights: vector<u64>
}

// ===== DropRule 掉落规则 =====
public struct DropRule has store, drop {
    card_pool: vector<u8>,
    weights: vector<u64>,
    quantity: u64
}

// ===== Card Target Types 目标类型常量 =====
fun target_none(): u8 { 0 }
fun target_player(): u8 { 1 }
fun target_tile(): u8 { 2 }

// ===== Registry Creation 注册表创建 =====

public(package) fun create_card_registry_internal(ctx: &mut TxContext): CardRegistry {
    let mut registry = CardRegistry {
        id: object::new(ctx),
        cards: vector[]
    };

    init_basic_cards(&mut registry);

    registry
}

public(package) fun create_and_share_card_registry(ctx: &mut TxContext) {
    let registry = create_card_registry_internal(ctx);
    transfer::share_object(registry);
}

public(package) fun create_drop_config_internal(ctx: &mut TxContext): DropConfig {
    let mut config = DropConfig {
        id: object::new(ctx),
        tile_drops: table::new(ctx),
        pass_drop_rate: 1000,
        stop_drop_rate: 5000,
        default_pool: vector[],
        default_weights: vector[]
    };

    init_default_drop_rules(&mut config);

    config
}

public(package) fun create_and_share_drop_config(ctx: &mut TxContext) {
    let config = create_drop_config_internal(ctx);
    transfer::share_object(config);
}

fun init_basic_cards(registry: &mut CardRegistry) {
    register_card_internal(registry,
        types::CARD_MOVE_CTRL(),
        b"Move Control",
        b"Control your next dice roll",
        target_tile(),
        3,
        0
    );

    register_card_internal(registry,
        types::CARD_BARRIER(),
        b"Barrier",
        b"Place a barrier on a tile",
        target_tile(),
        0,
        0
    );

    register_card_internal(registry,
        types::CARD_BOMB(),
        b"Bomb",
        b"Place a bomb on a tile",
        target_tile(),
        0,
        1
    );

    register_card_internal(registry,
        types::CARD_RENT_FREE(),
        b"Rent Free",
        b"Avoid paying rent this turn",
        target_none(),
        1,
        1
    );

    register_card_internal(registry,
        types::CARD_FREEZE(),
        b"Freeze",
        b"Freeze a player for one turn",
        target_player(),
        1,
        2
    );

    register_card_internal(registry,
        types::CARD_DOG(),
        b"Dog",
        b"Place a dog NPC on a tile",
        target_tile(),
        0,
        1
    );

    register_card_internal(registry,
        types::CARD_CLEANSE(),
        b"Cleanse",
        b"Remove an NPC from a tile",
        target_tile(),
        0,
        0
    );

    register_card_internal(registry,
        types::CARD_TURN(),
        b"Turn Card",
        b"Reverse your movement direction",
        target_none(),
        0,
        0
    );
}

fun init_default_drop_rules(config: &mut DropConfig) {
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

    config.default_weights = vector[
        40,
        40,
        30,
        30,
        10,
        30,
        40,
        40
    ];

    let card_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: config.default_weights,
        quantity: 2
    };
    table::add(&mut config.tile_drops, types::TILE_CARD(), card_tile_rule);

    let bonus_tile_rule = DropRule {
        card_pool: config.default_pool,
        weights: vector[20, 20, 40, 40, 30, 40, 20, 20],
        quantity: 3
    };
    table::add(&mut config.tile_drops, types::TILE_BONUS(), bonus_tile_rule);
}

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

    let expected_idx = registry.cards.length();
    assert!(kind as u64 == expected_idx, 0);

    registry.cards.push_back(card);
}

// ===== Admin Functions 管理函数 =====

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

// ===== Card Management Functions 卡牌管理函数 =====

public(package) fun give_card_to_player(
    player_cards: &mut vector<CardEntry>,
    kind: u8,
    count: u8
) {
    let mut i = 0;
    let len = player_cards.length();

    while (i < len) {
        let entry = &mut player_cards[i];
        if (entry.kind == kind) {
            let new_count = (entry.count as u64) + (count as u64);
            entry.count = if (new_count > 255) { 255 } else { (new_count as u8) };
            return
        };
        i = i + 1;
    };

    player_cards.push_back(CardEntry { kind, count });
}

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

fun determine_card_draw(random_value: u8): u8 {
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

public(package) fun draw_card_on_pass(random_value: u8): (u8, u8) {
    let card_kind = determine_card_draw(random_value);
    (card_kind, 1)
}

public(package) fun draw_card_on_stop(random_value: u8): (u8, u8) {
    let card_kind = determine_card_draw(random_value);
    (card_kind, 2)
}
