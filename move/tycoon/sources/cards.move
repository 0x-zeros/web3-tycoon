module tycoon::cards;

use std::option;
use sui::table::{Self, Table};
use tycoon::types;

// ===== Card Definition 卡牌定义 =====
public struct Card has store, copy, drop {
    kind: u16,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,  // 0=无目标, 1=玩家, 2=地块, 3=玩家或地块
    value: u64        // 卡牌相关的数值（如遥控骰的点数）
}

// ===== Card Catalog 卡牌目录 =====
public struct CardCatalog has store {
    cards: Table<u16, Card>
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

// 创建卡牌目录
public fun create_catalog(ctx: &mut TxContext): CardCatalog {
    let mut catalog = CardCatalog {
        cards: table::new(ctx)
    };

    // 初始化基础卡牌
    init_basic_cards(&mut catalog);

    catalog
}

// 初始化基础卡牌
fun init_basic_cards(catalog: &mut CardCatalog) {
    // 遥控骰子卡
    add_card(catalog,
        types::card_move_ctrl(),
        b"Move Control",
        b"Control your next dice roll",
        target_none(),
        3  // 默认设置为3点
    );

    // 路障卡
    add_card(catalog,
        types::card_barrier(),
        b"Barrier",
        b"Place a barrier on a tile",
        target_tile(),
        0
    );

    // 炸弹卡
    add_card(catalog,
        types::card_bomb(),
        b"Bomb",
        b"Place a bomb on a tile",
        target_tile(),
        0
    );

    // 免租卡
    add_card(catalog,
        types::card_rent_free(),
        b"Rent Free",
        b"Avoid paying rent this turn",
        target_none(),
        1  // 持续1回合
    );

    // 冻结卡
    add_card(catalog,
        types::card_freeze(),
        b"Freeze",
        b"Freeze a player for one turn",
        target_player(),
        1  // 冻结1回合
    );
}

// 向目录添加卡牌
public fun add_card(
    catalog: &mut CardCatalog,
    kind: u16,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64
) {
    let card = Card {
        kind,
        name,
        description,
        target_type,
        value
    };

    if (table::contains(&catalog.cards, kind)) {
        *table::borrow_mut(&mut catalog.cards, kind) = card;
    } else {
        table::add(&mut catalog.cards, kind, card);
    };
}

// 获取卡牌信息
public fun get_card(catalog: &CardCatalog, kind: u16): &Card {
    assert!(table::contains(&catalog.cards, kind), types::err_card_not_owned());
    table::borrow(&catalog.cards, kind)
}

// 检查卡牌是否存在
public fun has_card(catalog: &CardCatalog, kind: u16): bool {
    table::contains(&catalog.cards, kind)
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
        types::card_freeze()
    ];

    let index = ((seed % 100) / 20) as u64;  // 0-4
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
public fun card_needs_target(kind: u16, catalog: &CardCatalog): bool {
    if (has_card(catalog, kind)) {
        let card = get_card(catalog, kind);
        card.target_type != target_none()
    } else {
        false
    }
}

// ===== Helper Functions 辅助函数 =====

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
        types::card_freeze()
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
public fun create_test_card(
    kind: u16,
    name: vector<u8>,
    description: vector<u8>,
    target_type: u8,
    value: u64
): Card {
    Card {
        kind,
        name,
        description,
        target_type,
        value
    }
}

// 创建空的卡牌表
public fun create_empty_card_table(ctx: &mut TxContext): Table<u16, u64> {
    table::new(ctx)
}