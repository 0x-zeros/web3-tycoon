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
    rarity: u8,
    price: u64,    // 卡片价格
    gm: bool       // 是否需要 GMPass
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
fun target_player_or_tile(): u8 { 3 }

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
    // ===== 普通卡片 (kind 0-7, gm=false) =====

    // kind=0 遥控骰子：控制移动步数，价格3000
    register_card_internal(registry,
        types::CARD_MOVE_CTRL(),
        b"Move Control",
        b"Control your next dice roll",
        target_tile(),
        3,
        0,
        3000,   // price
        false   // gm
    );

    // kind=1 路障卡：放置路障阻挡，价格1000
    register_card_internal(registry,
        types::CARD_BARRIER(),
        b"Barrier",
        b"Place a barrier on a tile",
        target_tile(),
        0,
        0,
        1000,
        false
    );

    // kind=2 炸弹卡：送人去医院，价格2000
    register_card_internal(registry,
        types::CARD_BOMB(),
        b"Bomb",
        b"Place a bomb on a tile",
        target_tile(),
        0,
        1,
        2000,
        false
    );

    // kind=3 免租卡：免交一次租金，价格2000
    register_card_internal(registry,
        types::CARD_RENT_FREE(),
        b"Rent Free",
        b"Avoid paying rent this turn",
        target_none(),
        1,
        1,
        2000,
        false
    );

    // kind=4 冰冻卡：冻结对手一回合，价格2000
    register_card_internal(registry,
        types::CARD_FREEZE(),
        b"Freeze",
        b"Freeze a player for one turn",
        target_player(),
        1,
        2,
        2000,
        false
    );

    // kind=5 狗狗卡：放置狗改变方向，价格1000
    register_card_internal(registry,
        types::CARD_DOG(),
        b"Dog",
        b"Place a dog NPC on a tile",
        target_tile(),
        0,
        1,
        1000,
        false
    );

    // kind=6 净化卡：清除负面效果，价格1000
    register_card_internal(registry,
        types::CARD_CLEANSE(),
        b"Cleanse",
        b"Remove an NPC from a tile",
        target_tile(),
        0,
        0,
        1000,
        false
    );

    // kind=7 转向卡：改变方向，价格1000
    register_card_internal(registry,
        types::CARD_TURN(),
        b"Turn Card",
        b"Reverse your movement direction",
        target_none(),
        0,
        0,
        1000,
        false
    );

    // ===== GM卡片 (kind 8-16, gm=true) =====

    // kind=8 瞬移卡：传送到任意位置，价格6000
    register_card_internal(registry,
        types::CARD_TELEPORT(),
        b"Teleport",
        b"Teleport to any tile",
        target_player_or_tile(),
        0,
        3,
        6000,
        true
    );

    // kind=9 奖励卡(小)：获得1万金币，价格2000
    register_card_internal(registry,
        types::CARD_BONUS_S(),
        b"Small Bonus",
        b"Gain 10000 coins",
        target_player(),
        10000,
        3,
        2000,
        true
    );

    // kind=10 奖励卡(大)：获得10万金币，价格5000
    register_card_internal(registry,
        types::CARD_BONUS_L(),
        b"Large Bonus",
        b"Gain 100000 coins",
        target_player(),
        100000,
        3,
        5000,
        true
    );

    // kind=11 费用卡(小)：对手扣1万，价格2000
    register_card_internal(registry,
        types::CARD_FEE_S(),
        b"Small Fee",
        b"Deduct 10000 coins from a player",
        target_player(),
        10000,
        3,
        2000,
        true
    );

    // kind=12 费用卡(大)：对手扣10万，价格5000
    register_card_internal(registry,
        types::CARD_FEE_L(),
        b"Large Fee",
        b"Deduct 100000 coins from a player",
        target_player(),
        100000,
        3,
        5000,
        true
    );

    // kind=13 建造卡：升级建筑，价格4000
    register_card_internal(registry,
        types::CARD_CONSTRUCTION(),
        b"Construction",
        b"Upgrade a building",
        target_tile(),
        0,
        3,
        4000,
        true
    );

    // kind=14 改建卡：更换建筑类型，价格4000
    register_card_internal(registry,
        types::CARD_RENOVATION(),
        b"Renovation",
        b"Change building type",
        target_tile(),
        0,
        3,
        4000,
        true
    );

    // kind=15 召唤卡：放置NPC，价格3000
    register_card_internal(registry,
        types::CARD_SUMMON(),
        b"Summon",
        b"Place an NPC on a tile",
        target_tile(),
        0,
        3,
        3000,
        true
    );

    // kind=16 驱逐卡：移除NPC，价格3000
    register_card_internal(registry,
        types::CARD_BANISH(),
        b"Banish",
        b"Remove an NPC from a tile",
        target_tile(),
        0,
        3,
        3000,
        true
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
    rarity: u8,
    price: u64,
    gm: bool
) {
    let card = Card {
        kind,
        name,
        description,
        target_type,
        value,
        rarity,
        price,
        gm
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
    rarity: u8,
    price: u64,
    gm: bool
) {
    register_card_internal(registry, kind, name, description, target_type, value, rarity, price, gm);
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

// ===== Card Query Functions 卡牌查询函数 =====

/// 获取卡片价格
public(package) fun get_card_price(registry: &CardRegistry, kind: u8): u64 {
    let idx = kind as u64;
    if (idx < registry.cards.length()) {
        registry.cards[idx].price
    } else {
        0
    }
}

/// 检查卡片是否需要 GMPass
public(package) fun is_gm_card(registry: &CardRegistry, kind: u8): bool {
    let idx = kind as u64;
    if (idx < registry.cards.length()) {
        registry.cards[idx].gm
    } else {
        false
    }
}

/// 校验 kind 是否有效
public(package) fun is_valid_kind(registry: &CardRegistry, kind: u8): bool {
    (kind as u64) < registry.cards.length()
}
