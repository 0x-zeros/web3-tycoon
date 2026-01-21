module tycoon::game;

use std::option::{Self, Option};

use sui::clock::{Self, Clock};
use sui::coin;
use sui::random::{Self, Random, RandomGenerator};

use tycoon::types;
use tycoon::map::{Self, MapTemplate, MapRegistry};
use tycoon::cards::{Self, CardEntry};
use tycoon::events;
use tycoon::tycoon::{Self, GameData};

// ===== Errors =====
const ENotActivePlayer: u64 = 1001;
const EAlreadyRolled: u64 = 1002;
const ENotRolledYet: u64 = 1005;
const EWrongGame: u64 = 1003;
const EGameNotActive: u64 = 1004;
const EPlayerNotFound: u64 = 1006;

const EJoinFull: u64 = 6001;
const EAlreadyStarted: u64 = 6002;
const EGameEnded: u64 = 6003;
const ENotEnoughPlayers: u64 = 6004;
const EAlreadyJoined: u64 = 6005;
const EInvalidDecision: u64 = 6006;
const EPendingDecision: u64 = 6007;
const EShouldSkipTurn: u64 = 6008;
const ECannotRollDuringHospital: u64 = 6009;  // 住院期间不能掷骰子

const EInsufficientFunds: u64 = 7001;
const EBuildingAlreadyOwned: u64 = 7002;
const ENotBuildingOwner: u64 = 7003;
const EMaxLevelReached: u64 = 7004;
const ENotLargeBuilding: u64 = 7010;
const EBuildingTypeAlreadySet: u64 = 7011;
const EInvalidBuildingType: u64 = 7012;
const EBuildingAlreadyUpgraded: u64 = 7013;
const EBuildingNotFound: u64 = 7014;

const EPosMismatch: u64 = 2003;
const ENotBuilding: u64 = 2004;
const EBuildingOwned: u64 = 2005;
const EBuildingNotOwned: u64 = 2006;
const ENotOwner: u64 = 2007;
const EInvalidPrice: u64 = 2008;
const EMaxLevel: u64 = 2009;
const EInsufficientCash: u64 = 2010;

const ECardNotOwned: u64 = 5001;
const EInvalidCardTarget: u64 = 5003;
const ECardNotFound: u64 = 5004;
const EInvalidParams: u64 = 5005;
const ECannotTurn: u64 = 5006;

const EInvalidMove: u64 = 4001;
const EPathTooShort: u64 = 4002;
const EInvalidPath: u64 = 4003;
const ESkipMovementRequiresZeroDice: u64 = 4004;  // 跳过移动时 dice_count 必须为 0

const E_NPC_SPAWN_POOL_INDEX_OUT_OF_BOUNDS: u64 = 8001;
const E_TILE_INDEX_OUT_OF_BOUNDS: u64 = 8002;

const EMapMismatch: u64 = 9001;
const ETileOccupiedByNpc: u64 = 2001;
const ENpcNotFound: u64 = 2002;
const ENoSuchTile: u64 = 2002;

const EGMPassRequired: u64 = 5009;
const EGMPassGameMismatch: u64 = 5010;
const ENotAtCardShop: u64 = 5008;


// Buff激活逻辑（包含语义）：current_round <= last_active_round时激活
public struct BuffEntry has store, copy, drop {
    kind: u8,
    last_active_round: u16,
    value: u64,
    spawn_index: u16
}

public struct Player has store {
    owner: address,
    pos: u16,
    cash: u64,
    in_hospital_turns: u8,
    bankrupt: bool,
    cards: vector<CardEntry>,
    last_tile_id: u16,
    next_tile_id: u16,
    temple_levels: vector<u8>,
    buffs: vector<BuffEntry>
}

public struct NpcInst has store, copy, drop {
    tile_id: u16,
    kind: u8,
    consumable: bool,
    spawn_index: u16
}

public struct NpcSpawnEntry has store, copy, drop {
    npc_kind: u8,
    next_active_round: u16
}

public struct Seat has key {
    id: UID,
    game_id: ID,
    player: address,
    player_index: u8
}

/// GMPass - GM模式权限凭证
/// 持有者可以在卡片商店购买高级卡片
/// game_id绑定防止跨游戏使用
public struct GMPass has key {
    id: UID,
    game_id: ID,
    player: address
}


public struct Building has store, copy, drop {
    owner: u8,
    level: u8,
    building_type: u8
}

public struct Tile has store, copy, drop {
    npc_on: u16
}

// 瞬移卡效果信息（用于返回给 use_card 发射事件）
public struct TeleportInfo has drop {
    target_player: u8,   // 被瞬移的玩家索引
    source_player: u8,   // 使用卡牌的玩家索引
    from_pos: u16,
    to_pos: u16,
}

const NO_OWNER: u8 = 255;
const NO_NPC: u16 = 65535;

// 核心游戏状态对象
// 状态管理：status字段控制生命周期 0=READY, 1=ACTIVE, 2=ENDED
// 回合系统：round轮次 + turn轮内回合 + has_rolled标记
public struct Game has key, store {
    id: UID,
    status: u8,
    template_map_id: ID,
    players: vector<Player>,
    round: u16,
    turn: u8,
    active_idx: u8,
    has_rolled: bool,
    tiles: vector<Tile>,
    buildings: vector<Building>,
    npc_on: vector<NpcInst>,
    npc_spawn_pool: vector<NpcSpawnEntry>,
    starting_cash: u64,
    max_rounds: u8,
    price_rise_days: u8,
    winner: Option<u8>,
    pending_decision: u8,
    decision_tile: u16,
    decision_amount: u64,
    settings: u8   // 游戏设置位字段（bit0=GM模式）
}

fun parse_game_params(params: &vector<u64>): (u64, u8, u8, u8) {
    let starting_cash = if (params.length() > 0) {
        tycoon::validate_starting_cash(params[0])
    } else {
        tycoon::get_default_starting_cash()
    };

    let price_rise_days = if (params.length() > 1) {
        tycoon::validate_price_rise_days((params[1] as u8))
    } else {
        tycoon::get_default_price_rise_days()
    };

    let max_rounds = if (params.length() > 2) {
        tycoon::validate_max_rounds((params[2] as u8))
    } else {
        0
    };

    // params[3] = settings位字段（bit0=GM模式）
    let settings = if (params.length() > 3) {
        (params[3] as u8)
    } else {
        0
    };

    (starting_cash, price_rise_days, max_rounds, settings)
}

entry fun create_game(
    game_data: &GameData,
    map: &map::MapTemplate,
    params: vector<u64>,
    ctx: &mut TxContext
) {
    let (starting_cash, price_rise_days, max_rounds, settings) = parse_game_params(&params);

    let game_id = object::new(ctx);
    let game_id_copy = game_id.to_inner();

    let tile_count = map::get_tile_count(map);
    let mut tiles = vector[];
    let mut i = 0;
    while (i < tile_count) {
        tiles.push_back(Tile {
            npc_on: NO_NPC
        });
        i = i + 1;
    };

    let building_count = map::get_building_count(map);
    let mut buildings = vector[];
    let mut j = 0;
    while (j < building_count) {
        buildings.push_back(Building {
            owner: NO_OWNER,
            level: 0,
            building_type: types::BUILDING_NONE()
        });
        j = j + 1;
    };

    let mut game = Game {
        id: game_id,
        status: types::STATUS_READY(),
        template_map_id: map::get_map_id(map),
        players: vector[],
        round: 0,
        turn: 0,
        active_idx: 0,
        has_rolled: false,
        tiles,
        buildings,
        npc_on: vector[],
        npc_spawn_pool: init_npc_spawn_pool(tycoon::get_npc_spawn_weights(game_data)),
        starting_cash,
        max_rounds,
        price_rise_days,
        winner: option::none(),
        pending_decision: types::DECISION_NONE(),
        decision_tile: 0,
        decision_amount: 0,
        settings
    };

    let creator = ctx.sender();
    let player = create_player_with_cash(creator, starting_cash, ctx);
    game.players.push_back(player);

    let template_map_id = map::get_map_id(map);
    events::emit_game_created_event(
        game_id_copy,
        creator,
        template_map_id
    );

    let seat = Seat {
        id: object::new(ctx),
        game_id: game_id_copy,
        player: creator,
        player_index: 0
    };

    transfer::share_object(game);
    transfer::transfer(seat, creator);

    // 如果启用GM模式，为创建者发放GMPass
    if ((settings & types::SETTING_GM_MODE()) != 0) {
        let gm_pass = GMPass {
            id: object::new(ctx),
            game_id: game_id_copy,
            player: creator
        };
        transfer::transfer(gm_pass, creator);
    };
}

entry fun join(
    game: &mut Game,
    game_data: &GameData,
    ctx: &mut TxContext
) {
    let player_addr = ctx.sender();

    assert!(game.status == types::STATUS_READY(), EAlreadyStarted);
    assert!(game.players.length() < types::DEFAULT_MAX_PLAYERS() as u64, EJoinFull);


    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];
        assert!(player.owner != player_addr, EAlreadyJoined);
        i = i + 1;
    };

    // 使用游戏创建时配置的starting_cash（持久化字段，确保所有玩家一致）
    let player = create_player_with_cash(player_addr, game.starting_cash, ctx);
    let player_index = (game.players.length() as u8);
    game.players.push_back(player);

    let game_id_copy = game.id.to_inner();

    events::emit_player_joined_event(
        game_id_copy,
        player_addr,
        player_index
    );

    let seat = Seat {
        id: object::new(ctx),
        game_id: game_id_copy,
        player: player_addr,
        player_index
    };

    transfer::transfer(seat, player_addr);

    // 如果是GM模式游戏，为加入者发放GMPass
    if ((game.settings & types::SETTING_GM_MODE()) != 0) {
        let gm_pass = GMPass {
            id: object::new(ctx),
            game_id: game_id_copy,
            player: player_addr
        };
        transfer::transfer(gm_pass, player_addr);
    };
}

entry fun start(
    game: &mut Game,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    clock: &Clock,
    ctx: &mut TxContext
) {
    validate_map(game, map);

    assert!(game.status == types::STATUS_READY(), EAlreadyStarted);
    assert!(game.players.length() >= 2, ENotEnoughPlayers);

    game.status = types::STATUS_ACTIVE();
    game.active_idx = 0;
    game.has_rolled = false;

    let mut generator = random::new_generator(r, ctx);

    // 为每个玩家随机分配不同的初始位置
    let player_count = game.players.length();
    let mut occupied_tiles = vector[];
    let mut player_positions = vector[];

    let mut i = 0;
    while (i < player_count) {
        let mut attempts = 0;
        let mut assigned_pos = 0u16;

        while (attempts < 10) {
            let mut tile_opt = random_spawn_tile(game, map, &mut generator);
            if (tile_opt.is_some()) {
                let tile_id = tile_opt.extract();
                if (!occupied_tiles.contains(&tile_id)) {
                    assigned_pos = tile_id;
                    occupied_tiles.push_back(tile_id);
                    break
                }
            };
            attempts = attempts + 1;
        };

        player_positions.push_back(assigned_pos);
        i = i + 1;
    };

    // 分配位置给玩家，并初始化last_tile_id
    let mut i = 0;
    while (i < player_count) {
        let spawn_pos = player_positions[i];
        let player = &mut game.players[i];
        player.pos = spawn_pos;

        // 随机选择spawn位置的一个有效邻居作为last_tile_id
        let neighbors = map::get_valid_neighbors(map, spawn_pos);
        if (!neighbors.is_empty()) {
            let random_idx = (generator.generate_u8() as u64) % neighbors.length();
            player.last_tile_id = neighbors[random_idx];
        } else {
            player.last_tile_id = spawn_pos;
        };

        i = i + 1;
    };

    let starting_player = (&game.players[0]).owner;

    // 生成初始NPC（尝试生成3个）
    let mut i = 0;
    while (i < 3) {
        let (_npc_kind, _tile_id) = spawn_random_npc(game, map, &mut generator);
        i = i + 1;
    };

    let mut players_addresses = vector[];
    let mut i = 0;
    while (i < game.players.length()) {
        players_addresses.push_back((&game.players[i]).owner);
        i = i + 1;
    };

    events::emit_game_started_event(
        game.id.to_inner(),
        game.template_map_id,
        players_addresses,
        starting_player
    );
}

entry fun use_card(
    game: &mut Game,
    seat: &Seat,
    kind: u8,
    params: vector<u16>,
    game_data: &GameData,
    map: &map::MapTemplate,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);
    assert!(!game.has_rolled, EAlreadyRolled);

    let player_addr = seat.player;

    {
        let player = &mut game.players[seat.player_index as u64];
        assert!(cards::use_player_card(&mut player.cards, kind), ECardNotOwned);
    };

    let mut npc_changes = vector[];
    let mut buff_changes = vector[];
    let mut cash_changes = vector[];

    let teleport_info = apply_card_effect_with_collectors(
        game,
        seat.player_index,
        kind,
        &params,
        &mut npc_changes,
        &mut buff_changes,
        &mut cash_changes,
        game_data,
        map
    );

    events::emit_use_card_action_event(
        game.id.to_inner(),
        seat.player_index,
        (game.round as u16),
        (game.turn as u8),
        kind,
        params,
        npc_changes,
        buff_changes,
        cash_changes,
        game.players[seat.player_index as u64].next_tile_id
    );

    // 如果是瞬移卡，额外发射 TeleportActionEvent
    if (teleport_info.is_some()) {
        let info = teleport_info.destroy_some();
        events::emit_teleport_action_event(
            game.id.to_inner(),
            seat.player_index,
            game.round,
            game.turn,
            info.target_player,
            info.source_player,
            info.from_pos,
            info.to_pos
        );
    };
}

/// 购买卡片的内部实现
/// 注意：状态/回合/位置校验由入口函数完成，此处只处理扣款和发卡
fun buy_card_internal(
    game: &mut Game,
    player_index: u8,
    kind: u8,
    price_per_card: u64,
) {
    let player = &game.players[player_index as u64];
    assert!(player.cash >= price_per_card, EInsufficientFunds);

    let player = &mut game.players[player_index as u64];
    player.cash = player.cash - price_per_card;

    cards::give_card_to_player(&mut player.cards, kind, 1);
}

/// 批量购买普通卡片（不需要GMPass）
/// purchases: 要购买的卡片 kind 列表，每个元素表示一张卡（可重复）
/// 例如 [0, 2, 5] 表示购买 kind=0, kind=2, kind=5 各一张
/// 卡片价格由 CardRegistry 定义
entry fun buy_cards(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    purchases: vector<u8>,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);
    assert!(game.pending_decision == types::DECISION_CARD_SHOP(), EInvalidDecision);
    assert!(purchases.length() > 0 && purchases.length() <= 60, EInvalidParams);

    let card_registry = tycoon::get_card_registry(game_data);

    // 收集购买信息
    let mut purchased_cards = vector::empty<events::CardDrawItem>();
    let mut total_cost = 0u64;
    let tile_id = game.decision_tile;

    // 逐张购买，使用 CardRegistry 查询价格
    let mut i = 0u64;
    while (i < purchases.length()) {
        let kind = purchases[i];
        // 校验 kind 有效
        assert!(cards::is_valid_kind(card_registry, kind), EInvalidParams);
        // 校验不是 GM 卡
        assert!(!cards::is_gm_card(card_registry, kind), EGMPassRequired);
        // 获取卡片价格并购买
        let price = cards::get_card_price(card_registry, kind);
        buy_card_internal(game, seat.player_index, kind, price);

        // 记录购买
        purchased_cards.push_back(events::make_card_draw_item(tile_id, kind, 1, false));
        total_cost = total_cost + price;
        i = i + 1;
    };

    // 发出卡片商店决策事件
    events::emit_card_shop_decision_event(
        game.id.to_inner(),
        game.active_idx,
        game.round,
        game.turn,
        tile_id,
        purchased_cards,
        total_cost
    );

    clear_decision_state(game);
    advance_turn(game, game_data, map, r, ctx);
}

/// 批量购买卡片（需要GMPass），可购买所有卡片（普通卡+GM卡）
/// GMPass 是"全通行证"，持有者可以一次交易购买所有选中卡片
/// purchases: 要购买的卡片 kind 列表，每个元素表示一张卡（可重复）
/// 卡片价格由 CardRegistry 定义
entry fun buy_gm_cards(
    game: &mut Game,
    seat: &Seat,
    gm_pass: &GMPass,
    game_data: &GameData,
    purchases: vector<u8>,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);
    assert!(game.pending_decision == types::DECISION_CARD_SHOP(), EInvalidDecision);
    assert!(purchases.length() > 0 && purchases.length() <= 60, EInvalidParams);

    // 验证 GMPass 绑定
    assert!(gm_pass.game_id == game.id.to_inner(), EGMPassGameMismatch);

    let card_registry = tycoon::get_card_registry(game_data);

    // 收集购买信息
    let mut purchased_cards = vector::empty<events::CardDrawItem>();
    let mut total_cost = 0u64;
    let tile_id = game.decision_tile;

    // 逐张购买，使用 CardRegistry 查询价格（允许购买所有卡片）
    let mut i = 0u64;
    while (i < purchases.length()) {
        let kind = purchases[i];
        // 只校验 kind 有效
        assert!(cards::is_valid_kind(card_registry, kind), EInvalidParams);
        // 获取卡片价格并购买（所有卡片按各自价格计算）
        let price = cards::get_card_price(card_registry, kind);
        buy_card_internal(game, seat.player_index, kind, price);

        // 记录购买
        purchased_cards.push_back(events::make_card_draw_item(tile_id, kind, 1, false));
        total_cost = total_cost + price;
        i = i + 1;
    };

    // 发出卡片商店决策事件
    events::emit_card_shop_decision_event(
        game.id.to_inner(),
        game.active_idx,
        game.round,
        game.turn,
        tile_id,
        purchased_cards,
        total_cost
    );

    clear_decision_state(game);
    advance_turn(game, game_data, map, r, ctx);
}

/// 跳过卡片商店（不购买任何卡片）
entry fun skip_card_shop(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);
    assert!(game.pending_decision == types::DECISION_CARD_SHOP(), EInvalidDecision);

    let decision_type = game.pending_decision;
    let decision_tile = game.decision_tile;

    clear_decision_state(game);

    let event_round = game.round;
    let event_turn = game.turn;

    events::emit_decision_skipped_event(
        game.id.to_inner(),
        seat.player_index,
        decision_type,
        decision_tile,
        event_round,
        event_turn
    );

    advance_turn(game, game_data, map, r, ctx);
}

entry fun roll_and_step(
    game: &mut Game,
    seat: &Seat,
    path: vector<u16>,
    dice_count: u8,
    auto_buy: bool,
    auto_upgrade: bool,
    prefer_rent_card: bool,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    clock: &Clock,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);
    // 检查玩家是否应该跳过回合（住院等）
    assert!(!should_skip_turn(game, seat.player_index), ECannotRollDuringHospital);

    game.has_rolled = true;

    let player_index = seat.player_index;
    let player = &game.players[player_index as u64];
    let from_pos = player.pos;

    // 通用化检测：是否跳过移动
    let skip_movement = should_skip_movement(player, game.round);

    // 遥控骰子检测（仅在非跳过移动时有效）
    let has_move_ctrl = !skip_movement &&
        is_buff_active(player, types::BUFF_MOVE_CTRL(), game.round);

    // 根据模式处理骰子和路径
    let (dice_values, total_dice, mut generator) = if (skip_movement) {
        // === 跳过移动模式 ===
        // dice_count 必须为 0，路径可以为空
        assert!(dice_count == 0, ESkipMovementRequiresZeroDice);
        let generator = random::new_generator(r, ctx);
        (vector[], 0u8, generator)

    } else if (has_move_ctrl) {
        // === 遥控骰子模式 ===
        assert!(dice_count >= 1 && dice_count <= 3, EInvalidPath);
        assert!(!path.is_empty() && path.length() <= 18, EInvalidPath);
        let total = path.length() as u8;
        let values = split_into_dice_values(total, dice_count);
        let generator = random::new_generator(r, ctx);
        (values, total, generator)

    } else {
        // === 普通模式 ===
        assert!(dice_count >= 1 && dice_count <= 3, EInvalidPath);
        let mut generator = random::new_generator(r, ctx);
        let mut values = vector[];
        let mut total = 0u8;
        let mut i = 0u8;
        while (i < dice_count) {
            let value = generator.generate_u8_in_range(1, 6);
            values.push_back(value);
            total = total + value;
            i = i + 1;
        };
        assert!(path.length() >= (total as u64), EPathTooShort);
        (values, total, generator)
    };

    let mut steps = vector[];
    let mut cash_changes = vector[];

    execute_step_movement_with_choices(
        game,
        seat.player_index,
        total_dice,
        &path,
        &mut steps,
        &mut cash_changes,
        auto_buy,
        auto_upgrade,
        prefer_rent_card,
        game_data,
        map,
        &mut generator
    );

    let end_player = &game.players[player_index as u64];
    let end_pos = end_player.pos;

    let mut used_path = vector[];
    let mut i = 0u8;
    while (i < total_dice) {
        used_path.push_back(path[i as u64]);
        i = i + 1;
    };

    events::emit_roll_and_step_action_event_with_choices(
        game.id.to_inner(),
        player_index,
        game.round,
        game.turn,
        dice_values,
        used_path,
        from_pos,
        steps,
        cash_changes,
        end_pos
    );

    clean_turn_state(game, player_index);

    if (game.pending_decision == types::DECISION_NONE()) {
        advance_turn(game, game_data, map, r, ctx);
    };
}

entry fun decide_rent_payment(
    game: &mut Game,
    seat: &Seat,
    use_rent_free: bool,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(game.pending_decision == types::DECISION_PAY_RENT(), EInvalidDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;
    let tile_id = game.decision_tile;
    let toll = game.decision_amount;

    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);
    assert!(building_id != map::no_building(), ENotBuilding);

    let building =&game.buildings[building_id as u64];
    assert!(building.owner != NO_OWNER, EBuildingNotOwned);
    let owner_index = building.owner;

    if (use_rent_free) {
        let player = &game.players[player_index as u64];
        assert!(cards::player_has_card(&player.cards, types::CARD_RENT_FREE()), ECardNotFound);

        let player_mut = &mut game.players[player_index as u64];
        let used = cards::use_player_card(&mut player_mut.cards, types::CARD_RENT_FREE());
        assert!(used, ECardNotFound);

        // TODO: 发出免租事件
    } else {
        let player = &mut game.players[player_index as u64];
        assert!(player.cash >= toll, EInsufficientCash);
        player.cash = player.cash - toll;

        let owner_player = &mut game.players[owner_index as u64];
        owner_player.cash = owner_player.cash + toll;
    };

    clear_decision_state(game);

    let event_round = game.round;
    let event_turn = game.turn;

    let rent_info = events::make_rent_decision_info(
        player_index,
        owner_index,
        building_id,
        tile_id,
        toll,
        use_rent_free
    );

    events::emit_rent_decision_event(
        game.id.to_inner(),
        event_round,
        event_turn,
        false,
        rent_info
    );

    advance_turn(game, game_data, map, r, ctx);
}

entry fun skip_building_decision(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(
        game.pending_decision == types::DECISION_BUY_PROPERTY() ||
        game.pending_decision == types::DECISION_UPGRADE_PROPERTY(),
        EInvalidDecision
    );

    let decision_type = game.pending_decision;
    let decision_tile = game.decision_tile;

    clear_decision_state(game);

    let event_round = game.round;
    let event_turn = game.turn;

    events::emit_decision_skipped_event(
        game.id.to_inner(),
        seat.player_index,
        decision_type,
        decision_tile,
        event_round,
        event_turn
    );

    advance_turn(game, game_data, map, r, ctx);
}

// ============ 内部决策执行函数（供自动决策使用）============

/// 尝试执行购买建筑（内部逻辑复用）
/// 返回：(是否成功, Option<CashDelta>)
fun try_execute_buy_building(
    game: &mut Game,
    player_index: u8,
    building_id: u16,
    tile_id: u16,
    price: u64,
    building_static: &map::BuildingStatic
): (bool, option::Option<events::CashDelta>) {
    let player = &game.players[player_index as u64];

    if (player.cash <= price) {
        return (false, option::none())
    };

    let player_mut = &mut game.players[player_index as u64];
    player_mut.cash = player_mut.cash - price;

    let building_mut = &mut game.buildings[building_id as u64];
    building_mut.owner = player_index;
    // 购买空地后保持 level 0（空地状态），需要再次升级才变成 1 级
    // 符合大富翁游戏规则：购买 ≠ 建造

    // 注意：temple_levels 只在升级时添加（level > 0 才算有效 temple）

    let cash_delta = events::make_cash_delta(
        player_index,
        true,
        price,
        2,
        tile_id
    );

    (true, option::some(cash_delta))
}

/// 尝试执行升级建筑（内部逻辑复用）
/// 返回：(是否成功, Option<CashDelta>, 新等级, 最终建筑类型)
fun try_execute_upgrade_building(
    game: &mut Game,
    player_index: u8,
    building_id: u16,
    tile_id: u16,
    upgrade_cost: u64,
    current_level: u8,
    _game_data: &GameData,
    building_size: u8,
    requested_building_type: u8
): (bool, option::Option<events::CashDelta>, u8, u8) {
    let player = &game.players[player_index as u64];

    if (player.cash <= upgrade_cost) {
        return (false, option::none(), current_level, types::BUILDING_NONE())
    };

    let player_mut = &mut game.players[player_index as u64];
    player_mut.cash = player_mut.cash - upgrade_cost;

    let new_level = current_level + 1;

    let final_building_type = {
        let building_mut = &mut game.buildings[building_id as u64];

        if (building_size == types::SIZE_2X2() && current_level == 0) {
            assert!(types::is_large_building_type(requested_building_type), EInvalidBuildingType);

            // TODO: 其他建筑类型功能待实现（research/oil/commercial/hotel）
            building_mut.building_type = types::BUILDING_TEMPLE();
        };

        building_mut.level = new_level;
        building_mut.building_type
    };

    if (final_building_type == types::BUILDING_TEMPLE()) {
        rebuild_temple_levels_cache(game, player_index);
    };

    let cash_delta = events::make_cash_delta(
        player_index,
        true,
        upgrade_cost,
        3,
        tile_id
    );

    (true, option::some(cash_delta), new_level, final_building_type)
}

/// 尝试执行租金支付（内部逻辑复用）
/// prefer_rent_card: true表示优先使用免租卡，false表示优先现金支付
/// 返回：(是否成功支付, Vector<CashDelta>, 是否使用了免租卡)
fun try_execute_rent_payment(
    game: &mut Game,
    player_index: u8,
    owner_index: u8,
    tile_id: u16,
    toll: u64,
    prefer_rent_card: bool
): (bool, vector<events::CashDelta>, bool) {
    let mut cash_deltas = vector<events::CashDelta>[];
    let player = &game.players[player_index as u64];
    let has_rent_free_card = cards::player_has_card(&player.cards, types::CARD_RENT_FREE());

    let use_card = prefer_rent_card && has_rent_free_card;

    if (use_card) {
        let player_mut = &mut game.players[player_index as u64];
        let used = cards::use_player_card(&mut player_mut.cards, types::CARD_RENT_FREE());
        if (!used) {
            return (false, cash_deltas, false)
        };

        return (true, cash_deltas, true)
    } else {
        if (player.cash < toll) {
            return (false, cash_deltas, false)
        };

        let player_mut = &mut game.players[player_index as u64];
        player_mut.cash = player_mut.cash - toll;

        let owner_player = &mut game.players[owner_index as u64];
        owner_player.cash = owner_player.cash + toll;

        cash_deltas.push_back(events::make_cash_delta(
            player_index,
            true,
            toll,
            1,
            tile_id
        ));

        cash_deltas.push_back(events::make_cash_delta(
            owner_index,
            false,
            toll,
            1,
            tile_id
        ));

        return (true, cash_deltas, false)
    }
}

entry fun skip_turn(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);
    assert!(should_skip_turn(game, seat.player_index), EShouldSkipTurn);

    handle_skip_turn(game, seat.player_index);

    advance_turn(game, game_data, map, r, ctx);
}

entry fun buy_building(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(game.pending_decision == types::DECISION_BUY_PROPERTY(), EInvalidDecision);

    let player_index = seat.player_index;
    let player = &game.players[player_index as u64];
    let tile_id = player.pos;

    assert!(tile_id == game.decision_tile, EPosMismatch);

    let tile_static = map::get_tile(map, tile_id);

    let building_id = map::tile_building_id(tile_static);
    assert!(building_id != map::no_building(), ENotBuilding);

    let building =&game.buildings[building_id as u64];
    assert!(building.owner == NO_OWNER, EBuildingOwned);

    let building_static = map::get_building(map, building_id);

    let price = calculate_buy_price(building_static, game);
    assert!(price > 0, EInvalidPrice);
    assert!(player.cash > price, EInsufficientCash);

    let (success, _cash_delta_opt) = try_execute_buy_building(
        game, player_index, building_id, tile_id, price, building_static
    );
    assert!(success, EInsufficientCash);

    let building_type = game.buildings[building_id as u64].building_type;

    clear_decision_state(game);

    let event_round = game.round;
    let event_turn = game.turn;

    let decision_info = events::make_building_decision_info(
        types::DECISION_BUY_PROPERTY(),
        building_id,
        tile_id,
        price,
        0,  // 购买后保持 level 0（空地状态）
        building_type
    );

    events::emit_building_decision_event(
        game.id.to_inner(),
        player_index,
        event_round,
        event_turn,
        false,
        decision_info
    );

    advance_turn(game, game_data, map, r, ctx);
}

entry fun upgrade_building(
    game: &mut Game,
    seat: &Seat,
    building_type: u8,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    assert!(game.pending_decision == types::DECISION_UPGRADE_PROPERTY(), EInvalidDecision);

    let player_index = seat.player_index;
    let player = &game.players[player_index as u64];
    let tile_id = player.pos;

    assert!(tile_id == game.decision_tile, EPosMismatch);

    let tile_static = map::get_tile(map, tile_id);
    let tile_kind = map::tile_kind(tile_static);

    let building_id = map::tile_building_id(tile_static);
    assert!(building_id != map::no_building(), ENotBuilding);

    let building =&game.buildings[building_id as u64];
    assert!(building.owner != NO_OWNER, EBuildingNotOwned);
    let owner_idx = building.owner;
    assert!(owner_idx == player_index, ENotOwner);

    let current_level = building.level;
    assert!(current_level < types::LEVEL_4(), EMaxLevel);

    let building_static = map::get_building(map, building_id);
    let building_size = map::building_size(building_static);

    let upgrade_cost = calculate_building_price(building_static, building, current_level, current_level + 1, game, game_data);

    assert!(player.cash > upgrade_cost, EInsufficientCash);

    let (success, _cash_delta_opt, new_level, final_building_type) = try_execute_upgrade_building(
        game, player_index, building_id, tile_id, upgrade_cost,
        current_level, game_data, building_size, building_type
    );
    assert!(success, EInsufficientCash);

    clear_decision_state(game);

    let event_round = game.round;
    let event_turn = game.turn;

    let decision_info = events::make_building_decision_info(
        types::DECISION_UPGRADE_PROPERTY(),
        building_id,
        tile_id,
        upgrade_cost,
        new_level,
        final_building_type
    );

    events::emit_building_decision_event(
        game.id.to_inner(),
        player_index,
        event_round,
        event_turn,
        false,
        decision_info
    );

    advance_turn(game, game_data, map, r, ctx);
}

// ===== Internal Functions 内部函数 =====

fun create_player_with_cash(owner: address, cash: u64, _ctx: &mut TxContext): Player {
    let mut initial_cards = vector[];
    //for debug
    initial_cards.push_back(cards::new_card_entry(types::CARD_MOVE_CTRL(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_BARRIER(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_BOMB(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_RENT_FREE(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_FREEZE(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_DOG(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_CLEANSE(), 2));
    initial_cards.push_back(cards::new_card_entry(types::CARD_TURN(), 2));


    Player {
        owner,
        pos: 0,
        cash,
        buffs: vector[],
        in_hospital_turns: 0,
        bankrupt: false,
        cards: initial_cards,
        last_tile_id: 65535,
        next_tile_id: 65535,
        temple_levels: vector[]
    }
}

fun get_active_player_address(game: &Game): address {
    game.players[game.active_idx as u64].owner
}

fun get_player_by_seat(game: &Game, seat: &Seat): &Player {
    &game.players[seat.player_index as u64]
}

fun get_player_mut_by_seat(game: &mut Game, seat: &Seat): &mut Player {
    &mut game.players[seat.player_index as u64]
}

fun clear_decision_state(game: &mut Game) {
    game.pending_decision = types::DECISION_NONE();
    game.decision_tile = 0;
    game.decision_amount = 0;
}

public(package) fun find_player_index(game: &Game, player_addr: address): u8 {
    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];
        if (player.owner == player_addr) {
            return (i as u8)
        };
        i = i + 1;
    };
    abort EPlayerNotFound
}

/// 获取Game的UID引用（用于获取对象ID等）
public(package) fun game_uid(game: &Game): &UID {
    &game.id
}

fun validate_seat_and_turn(game: &Game, seat: &Seat) {
    assert!((seat.player_index as u64) < game.players.length(), EPlayerNotFound);
    assert!(seat.game_id == game.id.to_inner(), EWrongGame);

    let seat_owner = (&game.players[seat.player_index as u64]).owner;
    assert!(seat_owner == seat.player, ENotActivePlayer);

    let active_player = get_active_player_address(game);
    assert!(seat.player == active_player, ENotActivePlayer);

    assert!(game.status == types::STATUS_ACTIVE(), EGameNotActive);
}

fun should_skip_turn(game: &Game, player_index: u8): bool {
    let player = &game.players[player_index as u64];
    player.in_hospital_turns > 0
}

fun handle_skip_turn(game: &mut Game, player_index: u8) {
    let player = &mut game.players[player_index as u64];

    player.in_hospital_turns = player.in_hospital_turns - 1;
    let reason = types::SKIP_HOSPITAL();
    let remaining_turns = player.in_hospital_turns;

    let event_round = game.round;
    let event_turn = game.turn;

    clean_turn_state(game, player_index);

    events::emit_skip_turn_event(
        game.id.to_inner(),
        player_index,
        reason,
        remaining_turns,
        event_round,
        event_turn
    );
}

fun get_dice_value(game: &Game, player_index: u8, generator: &mut RandomGenerator): u8 {
    let player = &game.players[player_index as u64];

    if (is_buff_active(player, types::BUFF_MOVE_CTRL(), game.round)) {
        let value = get_buff_value(player, types::BUFF_MOVE_CTRL(), game.round);
        return (value as u8)
    };

    generator.generate_u8_in_range(1, 6)
}

/// 将总步数拆分为骰子值数组（用于遥控骰子模式的动画显示）
/// 每个骰子值保持在1-6范围内，尽量均匀分配
fun split_into_dice_values(total: u8, dice_count: u8): vector<u8> {
    let mut values = vector[];

    if (dice_count == 0 || total == 0) {
        return values
    };

    // 计算基础值和余数
    let base_value = total / dice_count;
    let remainder = total % dice_count;

    let mut i = 0u8;
    while (i < dice_count) {
        // 前 remainder 个骰子多分配1点
        let value = if (i < remainder) {
            base_value + 1
        } else {
            base_value
        };
        // 限制在1-6范围内（实际上遥控模式下不会超过6*3=18，每个骰子最多6）
        let clamped = if (value > 6) { 6 } else if (value < 1) { 1 } else { value };
        values.push_back(clamped);
        i = i + 1;
    };

    values
}

// 执行玩家的逐步移动，处理路径上的所有事件
//
// 算法流程：
// 1. 首先检查玩家是否被冻结（冻结状态下原地停留，不移动）
// 2. 根据path_choices移动：
//    - 有path_choices时：使用客户端提供的路径选择（用于遥控骰子）
//    - 无path_choices时：按玩家方向偏好自动移动（正常移动）
// 3. 逐格移动，每一步都要：
//    - 检查目标格子上的NPC（炸弹、狗、路障）
//    - 处理经过格子的触发事件（抽卡、彩票等）
//    - 到达最终格子时触发停留事件
// 4. 所有事件收集到steps和cash_changes中，供上层聚合到最终事件
fun execute_step_movement_with_choices(
    game: &mut Game,
    player_index: u8,
    dice: u8,
    path_choices: &vector<u16>,
    steps: &mut vector<events::StepEffect>,
    cash_changes: &mut vector<events::CashDelta>,
    auto_buy: bool,
    auto_upgrade: bool,
    prefer_rent_card: bool,
    game_data: &GameData,
    map: &map::MapTemplate,
    generator: &mut RandomGenerator
) {

    let (from_pos, mut last_tile_id, mut next_tile_id, skip_movement, has_move_ctrl) = {
        let player = &game.players[player_index as u64];
        (
            player.pos,
            player.last_tile_id,
            player.next_tile_id,
            should_skip_movement(player, game.round),
            is_buff_active(player, types::BUFF_MOVE_CTRL(), game.round)
        )
    };

    // 统一处理所有跳过移动的 buff（冰冻、瞬移等）
    if (skip_movement) {
        let stop_effect = handle_tile_stop_with_collector(
            game,
            player_index,
            from_pos,
            cash_changes,
            auto_buy,
            auto_upgrade,
            prefer_rent_card,
            game_data,
            map,
            generator
        );

        steps.push_back( events::make_step_effect(
            0,
            from_pos,
            from_pos,
            0,
            vector[],
            option::none(),
            option::some(stop_effect)
        ));
        return
    };

    // 遥控骰子buff：允许第一步转向，清除强制方向
    if (has_move_ctrl) {
        next_tile_id = 65535;
    };

    let mut current_pos = from_pos;
    let mut step_index: u8 = 0;
    let mut i = 0;

    while (i < dice) {
        let next_pos = path_choices[i as u64];

        // 第一步：检查是否有强制目标（转向卡等）或遥控骰子buff
        if (i == 0 && has_move_ctrl) {
            // 遥控骰子：只验证邻居关系，允许回头
            assert!(is_valid_neighbor(map, current_pos, next_pos, 65535), EInvalidPath);
        } else if (i == 0 && next_tile_id != 65535) {
            assert!(next_pos == next_tile_id, EInvalidPath);
            assert!(is_valid_neighbor(map, current_pos, next_pos, 65535), EInvalidPath);
            next_tile_id = 65535;
        } else {
            if (next_pos == last_tile_id) {
                let neighbors = map::get_valid_neighbors(map, current_pos);
                assert!(neighbors.length() == 1 && neighbors[0] == last_tile_id, EInvalidPath);
            } else {
                assert!(is_valid_neighbor(map, current_pos, next_pos, last_tile_id), EInvalidPath);
            }
        };

        let mut pass_draws = vector[];
        let mut npc_event_opt = option::none<events::NpcStepEvent>();
        let mut stop_effect_opt = option::none<events::StopEffect>();

        let tile_npc_index = game.tiles[next_pos as u64].npc_on;
        if (tile_npc_index != NO_NPC) {
            let npc = game.npc_on[tile_npc_index as u64];

            if (is_hospital_npc(npc.kind)) {
                {
                    let player = &mut game.players[player_index as u64];
                    player.pos = next_pos;
                };

                let hospital_tile = find_nearest_hospital(game, next_pos, map, game_data);
                send_to_hospital_internal(game, player_index, hospital_tile, game_data);

                let consumed = consume_npc_if_consumable(game, next_pos, &npc);

                npc_event_opt = option::some(events::make_npc_step_event(
                    next_pos,
                    npc.kind,
                    events::npc_result_send_hospital(),
                    consumed,
                    option::some(hospital_tile)
                ));

                steps.push_back( events::make_step_effect(
                    step_index,
                    current_pos,
                    next_pos,
                    dice - i - 1,
                    pass_draws,
                    npc_event_opt,
                    option::none()
                ));
                break
            } else if (npc.kind == types::NPC_BARRIER()) {
                {
                    let player = &mut game.players[player_index as u64];
                    player.pos = next_pos;
                };

                let consumed = consume_npc_if_consumable(game, next_pos, &npc);

                npc_event_opt = option::some(events::make_npc_step_event(
                    next_pos,
                    npc.kind,
                    events::npc_result_barrier_stop(),
                    consumed,
                    option::none()
                ));

                stop_effect_opt = option::some(handle_tile_stop_with_collector(
                    game,
                    player_index,
                    next_pos,
                    cash_changes,
                    auto_buy,
                    auto_upgrade,
                    prefer_rent_card,
                    game_data,
                    map,
                    generator
                ));

                steps.push_back( events::make_step_effect(
                    step_index,
                    current_pos,
                    next_pos,
                    dice - i - 1,
                    pass_draws,
                    npc_event_opt,
                    stop_effect_opt
                ));
                break
            };
        };

        {
            let player = &mut game.players[player_index as u64];
            player.pos = next_pos;
        };

        if (i < dice - 1) {
            let next_tile = map::get_tile(map, next_pos);
            let tile_kind = map::tile_kind(next_tile);

            if (tile_kind == types::TILE_CARD()) {
                let random_value = generator.generate_u8();
                let (card_kind, _) = cards::draw_card_on_pass(random_value);
                {
                    let player = &mut game.players[player_index as u64];
                    cards::give_card_to_player(&mut player.cards, card_kind, 1);
                };

                pass_draws.push_back(events::make_card_draw_item(
                    next_pos,
                    card_kind,
                    1,
                    true
                ));
            };

            steps.push_back( events::make_step_effect(
                step_index,
                current_pos,
                next_pos,
                dice - i - 1,
                pass_draws,
                npc_event_opt,
                option::none()
            ));
        } else {
            stop_effect_opt = option::some(handle_tile_stop_with_collector(
                game,
                player_index,
                next_pos,
                cash_changes,
                auto_buy,
                auto_upgrade,
                prefer_rent_card,
                game_data,
                map,
                generator
            ));

            steps.push_back( events::make_step_effect(
                step_index,
                current_pos,
                next_pos,
                0,
                pass_draws,
                npc_event_opt,
                stop_effect_opt
            ));
        };

        last_tile_id = current_pos;
        current_pos = next_pos;
        step_index = step_index + 1;
        i = i + 1;
    };

    {
        let player = &mut game.players[player_index as u64];
        player.last_tile_id = last_tile_id;
        player.next_tile_id = next_tile_id;
    };
}

fun is_valid_neighbor(
    template: &MapTemplate,
    current: u16,
    next: u16,
    last_tile_id: u16
): bool {
    if (next == last_tile_id) return false;

    if (next == current) return false;

    let tile = map::get_tile(template, current);

    next == map::tile_w(tile) ||
    next == map::tile_n(tile) ||
    next == map::tile_e(tile) ||
    next == map::tile_s(tile)
}

fun handle_tile_stop_with_collector(
    game: &mut Game,
    player_index: u8,
    tile_id: u16,
    cash_changes: &mut vector<events::CashDelta>,
    auto_buy: bool,
    auto_upgrade: bool,
    prefer_rent_card: bool,
    game_data: &GameData,
    map: &map::MapTemplate,
    generator: &mut RandomGenerator
): events::StopEffect {
    let tile = map::get_tile(map, tile_id);
    let tile_kind = map::tile_kind(tile);

    let mut stop_type = events::stop_none();
    let mut amount = 0;
    let mut owner_opt = option::none<u8>();
    let mut level_opt = option::none<u8>();
    let mut turns_opt = option::none<u8>();
    let mut card_gains = vector<events::CardDrawItem>[];
    let mut building_decision_opt = option::none<events::BuildingDecisionInfo>();
    let mut rent_decision_opt = option::none<events::RentDecisionInfo>();
    let mut npc_buff_opt = option::none<events::BuffChangeItem>();

    // ===== 处理停留格的NPC（土地神等）=====
    let tile_npc_index = game.tiles[tile_id as u64].npc_on;
    if (tile_npc_index != NO_NPC) {
        let npc = game.npc_on[tile_npc_index as u64];

        if (npc.kind == types::NPC_LAND_GOD()) {
            // 土地神触发 - 给玩家 7 回合的"土地神附身" buff
            // include_current_round = true，当回合立即生效
            let last_active_round = calculate_buff_last_active_round(
                player_index, player_index, game.round, 7, true
            );
            {
                let player = &mut game.players[player_index as u64];
                apply_buff_with_source(
                    player,
                    types::BUFF_LAND_BLESSING(),
                    last_active_round,
                    0,
                    npc.spawn_index
                );
            };

            // 记录NPC触发的buff变化
            npc_buff_opt = option::some(events::make_buff_change(
                types::BUFF_LAND_BLESSING(),
                player_index,
                option::some(last_active_round)
            ));

            // 消耗NPC
            consume_npc_if_consumable(game, tile_id, &npc);
            handle_npc_consumed(game, &npc, true);
        }
    };

    let building_id = map::tile_building_id(tile);
    if (building_id != map::no_building()) {
        let building =&game.buildings[building_id as u64];
        let building_static = map::get_building(map, building_id);

        if (building.owner == NO_OWNER) {
                // 检查土地神buff，免费获得无主地产
                let player = &game.players[player_index as u64];
                let has_land_blessing = is_buff_active(player, types::BUFF_LAND_BLESSING(), game.round);

                if (has_land_blessing) {
                    // ===== 土地神附身 - 免费获得无主地产 =====
                    let building_mut = &mut game.buildings[building_id as u64];
                    let building_type = building_mut.building_type;
                    building_mut.owner = player_index;

                    stop_type = events::stop_land_seize();
                    level_opt = option::some(0);  // 无主地产level为0

                    let decision_info = events::make_building_decision_info(
                        types::DECISION_BUY_PROPERTY(),
                        building_id,
                        tile_id,
                        0,  // 价格为0（免费获得）
                        0,
                        building_type
                    );

                    events::emit_building_decision_event(
                        game.id.to_inner(),
                        player_index,
                        game.round,
                        game.turn,
                        true,
                        decision_info
                    );

                    building_decision_opt = option::some(decision_info);
                } else {
                    // ===== 原有购买逻辑 =====
                    let price = calculate_buy_price(building_static, game);

                    if (auto_buy) {
                        let (success, cash_delta_opt) = try_execute_buy_building(
                            game, player_index, building_id, tile_id, price, building_static
                        );

                        if (success) {
                            stop_type = events::stop_building_unowned();
                            if (cash_delta_opt.is_some()) {
                                cash_changes.push_back(cash_delta_opt.destroy_some());
                            };

                            let purchased_building = &game.buildings[building_id as u64];
                            let decision_info = events::make_building_decision_info(
                                types::DECISION_BUY_PROPERTY(),
                                building_id,
                                tile_id,
                                price,
                                0,  // 购买后保持 level 0（空地状态）
                                purchased_building.building_type
                            );

                            events::emit_building_decision_event(
                                game.id.to_inner(),
                                player_index,
                                game.round,
                                game.turn,
                                true,
                                decision_info
                            );

                            building_decision_opt = option::some(decision_info);
                        } else {
                            stop_type = events::stop_building_unowned();
                            game.pending_decision = types::DECISION_BUY_PROPERTY();
                            game.decision_tile = tile_id;
                            game.decision_amount = price;
                        }
                    } else {
                        stop_type = events::stop_building_unowned();
                        game.pending_decision = types::DECISION_BUY_PROPERTY();
                        game.decision_tile = tile_id;
                        game.decision_amount = price;
                    }
                }
            } else {
                let owner_index = building.owner;
                if (owner_index != player_index) {
                    // 先检查土地神附身buff
                    let player = &game.players[player_index as u64];
                    let has_land_blessing = is_buff_active(player, types::BUFF_LAND_BLESSING(), game.round);

                    if (has_land_blessing) {
                        // ===== 土地神附身 - 直接抢夺地产 =====
                        let level = building.level;

                        // 转移所有权（保持原等级）
                        let building_mut = &mut game.buildings[building_id as u64];
                        let building_type = building_mut.building_type;
                        building_mut.owner = player_index;

                        // 如果是神殿，需要更新两边玩家的temple_levels缓存
                        if (building_type == types::BUILDING_TEMPLE()) {
                            rebuild_temple_levels_cache(game, owner_index);
                            rebuild_temple_levels_cache(game, player_index);
                        };

                        stop_type = events::stop_land_seize();
                        owner_opt = option::some(owner_index);  // 记录原主人
                        level_opt = option::some(level);

                        // 生成建筑决策事件
                        let decision_info = events::make_building_decision_info(
                            types::DECISION_BUY_PROPERTY(),
                            building_id,
                            tile_id,
                            0,  // 价格为0（免费抢夺）
                            level,
                            building_type
                        );

                        events::emit_building_decision_event(
                            game.id.to_inner(),
                            player_index,
                            game.round,
                            game.turn,
                            true,
                            decision_info
                        );

                        building_decision_opt = option::some(decision_info);

                    } else {
                        // ===== 原有租金逻辑 =====
                        let level = building.level;
                        let toll = calculate_toll(game, tile_id, map, game_data);

                        let player = &game.players[player_index as u64];
                        let has_rent_free_buff = is_buff_active(player, types::BUFF_RENT_FREE(), game.round);
                        let has_rent_free_card = cards::player_has_card(&player.cards, types::CARD_RENT_FREE());

                        if (has_rent_free_buff) {
                        stop_type = events::stop_building_no_rent();
                        owner_opt = option::some(owner_index);
                        level_opt = option::some(level);
                        amount = 0;
                    } else if (has_rent_free_card || prefer_rent_card) {
                        let (success, cash_deltas, used_card) = try_execute_rent_payment(
                            game, player_index, owner_index, tile_id, toll, prefer_rent_card
                        );

                        if (success) {
                            if (used_card) {
                                stop_type = events::stop_building_no_rent();

                                let rent_info = events::make_rent_decision_info(
                                    player_index,
                                    owner_index,
                                    building_id,
                                    tile_id,
                                    toll,
                                    true
                                );

                                events::emit_rent_decision_event(
                                    game.id.to_inner(),
                                    game.round,
                                    game.turn,
                                    true,
                                    rent_info
                                );

                                rent_decision_opt = option::some(rent_info);
                            } else {
                                stop_type = events::stop_building_toll();
                                let mut i = 0;
                                while (i < cash_deltas.length()) {
                                    cash_changes.push_back(cash_deltas[i]);
                                    i = i + 1;
                                };
                                amount = toll;

                                let rent_info = events::make_rent_decision_info(
                                    player_index,
                                    owner_index,
                                    building_id,
                                    tile_id,
                                    toll,
                                    false
                                );

                                events::emit_rent_decision_event(
                                    game.id.to_inner(),
                                    game.round,
                                    game.turn,
                                    true,
                                    rent_info
                                );

                                rent_decision_opt = option::some(rent_info);
                            };

                            owner_opt = option::some(owner_index);
                            level_opt = option::some(level);
                        } else {
                            stop_type = events::stop_building_toll();
                            game.pending_decision = types::DECISION_PAY_RENT();
                            game.decision_tile = tile_id;
                            game.decision_amount = toll;
                            owner_opt = option::some(owner_index);
                            level_opt = option::some(level);
                            amount = toll;
                        }
                    } else {
                        let (actual_payment, should_bankrupt) = {
                            let player_mut = &mut game.players[player_index as u64];
                            let payment = if (player_mut.cash >= toll) {
                                player_mut.cash = player_mut.cash - toll;
                                toll
                            } else {
                                let payment = player_mut.cash;
                                player_mut.cash = 0;
                                payment
                            };
                            let bankrupt = player_mut.cash == 0 && toll > payment;
                            (payment, bankrupt)

                        };

                        if (actual_payment > 0) {
                            let owner_player = &mut game.players[owner_index as u64];
                            owner_player.cash = owner_player.cash + actual_payment;

                            cash_changes.push_back( events::make_cash_delta(
                                player_index,
                                true,
                                actual_payment,
                                1,
                                tile_id
                            ));

                            cash_changes.push_back( events::make_cash_delta(
                                owner_index,
                                false,
                                actual_payment,
                                1,
                                tile_id
                            ));

                            stop_type = events::stop_building_toll();
                            amount = actual_payment;
                        };

                        if (should_bankrupt) {
                            handle_bankruptcy(game, game_data, map, player_index, option::some(owner_index));
                        };

                        owner_opt = option::some(owner_index);
                        level_opt = option::some(level);
                        }
                    }
            } else {
                let level = building.level;

                if (level < types::LEVEL_4()) {
                    let upgrade_cost = calculate_building_price(building_static, building, level, level + 1, game, game_data);

                    let building_size = map::building_size(building_static);
                    let needs_type_selection =
                        building_size == types::SIZE_2X2() &&
                        level == 0 &&
                        building.building_type == types::BUILDING_NONE();

                    if (auto_upgrade && !needs_type_selection) {
                        let (success, cash_delta_opt, new_level, final_type) = try_execute_upgrade_building(
                            game, player_index, building_id, tile_id, upgrade_cost, level, game_data,
                            building_size, types::BUILDING_TEMPLE()
                        );

                        if (success) {
                            stop_type = events::stop_none();
                            if (cash_delta_opt.is_some()) {
                                cash_changes.push_back(cash_delta_opt.destroy_some());
                            };

                            let decision_info = events::make_building_decision_info(
                                types::DECISION_UPGRADE_PROPERTY(),
                                building_id,
                                tile_id,
                                upgrade_cost,
                                new_level,
                                final_type
                            );

                            events::emit_building_decision_event(
                                game.id.to_inner(),
                                player_index,
                                game.round,
                                game.turn,
                                true,
                                decision_info
                            );

                            building_decision_opt = option::some(decision_info);
                        } else {
                            stop_type = events::stop_none();
                            game.pending_decision = types::DECISION_UPGRADE_PROPERTY();
                            game.decision_tile = tile_id;
                            game.decision_amount = upgrade_cost;
                        }
                    } else {
                        stop_type = events::stop_none();
                        game.pending_decision = types::DECISION_UPGRADE_PROPERTY();
                        game.decision_tile = tile_id;
                        game.decision_amount = upgrade_cost;
                    }
                } else {
                    stop_type = events::stop_none();
                };

                owner_opt = option::some(player_index);
                level_opt = option::some(level);
            }
        }
    } else if (tile_kind == types::TILE_HOSPITAL()) {
        let player = &mut game.players[player_index as u64];
        player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
        stop_type = events::stop_hospital();
        turns_opt = option::some(types::DEFAULT_HOSPITAL_TURNS());
    } else if (tile_kind == types::TILE_CARD()) {
        let random_value = generator.generate_u8();
        let (card_kind, count) = cards::draw_card_on_stop(random_value);
        let player = &mut game.players[player_index as u64];
        cards::give_card_to_player(&mut player.cards, card_kind, count);

        card_gains.push_back(events::make_card_draw_item(
            tile_id,
            card_kind,
            count,
            false
        ));
        stop_type = events::stop_card_stop();
    } else if (tile_kind == types::TILE_CHANCE()) {
        // TODO: 实现机会事件
        stop_type = events::stop_none();
    } else if (tile_kind == types::TILE_NEWS()) {
        // TODO: 实现新闻事件
        stop_type = events::stop_none();
    } else if (tile_kind == types::TILE_LOTTERY()) {
        // TODO: 实现彩票事件
        stop_type = events::stop_none();
    } else if (tile_kind == types::TILE_BONUS()) {
        let base_bonus = map::tile_special(tile);
        let price_index = calculate_price_index(game);
        let bonus = base_bonus * price_index;

        let player = &mut game.players[player_index as u64];
        player.cash = player.cash + bonus;

        cash_changes.push_back( events::make_cash_delta(
            player_index,
            false,
            bonus,
            4,
            tile_id
        ));

        stop_type = events::stop_bonus();
        amount = bonus;
    } else if (tile_kind == types::TILE_FEE()) {
        let base_fee = map::tile_special(tile);
        let price_index = calculate_price_index(game);
        let fee = base_fee * price_index;

        let player = &mut game.players[player_index as u64];
        let actual_payment = if (player.cash >= fee) {
            player.cash = player.cash - fee;
            fee
        } else {
            let payment = player.cash;
            player.cash = 0;
            payment
        };

        if (actual_payment > 0) {
            cash_changes.push_back( events::make_cash_delta(
                player_index,
                true,
                actual_payment,
                5,
                tile_id
            ));
        };

        stop_type = events::stop_fee();
        amount = actual_payment;

        if (player.cash == 0 && fee > actual_payment) {
            handle_bankruptcy(game, game_data, map, player_index, option::none());
        }
    } else if (tile_kind == types::TILE_CARD_SHOP()) {
        // CARD_SHOP: 设置 pending_decision，等待玩家购买卡片或跳过
        stop_type = events::stop_card_shop();
        game.pending_decision = types::DECISION_CARD_SHOP();
        game.decision_tile = tile_id;
    } else {
        stop_type = events::stop_none();
    };

    events::make_stop_effect(
        tile_id,
        tile_kind,
        stop_type,
        amount,
        owner_opt,
        level_opt,
        turns_opt,
        card_gains,
        game.pending_decision,
        game.decision_tile,
        game.decision_amount,
        building_decision_opt,
        rent_decision_opt,
        npc_buff_opt
    )
}

fun handle_hospital_stop(game: &mut Game, player_index: u8, tile_id: u16) {
    let player = &mut game.players[player_index as u64];
    player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
}

fun find_nearest_hospital(game: &Game, current_pos: u16, map: &map::MapTemplate, _game_data: &GameData): u16 {
    let hospital_ids = map::get_hospital_ids(map);

    if (hospital_ids.is_empty()) {
        return current_pos
    };

    hospital_ids[0]
}

fun send_to_hospital_internal(game: &mut Game, player_index: u8, hospital_tile: u16, game_data: &GameData) {
    let player = &mut game.players[player_index as u64];
    player.pos = hospital_tile;
    player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
}

// 处理玩家破产的完整流程
//
// 破产处理步骤：
// 1. 标记玩家破产状态，防止其继续参与游戏
// 2. 释放该玩家拥有的所有建筑：
//    - 重置建筑所有权为NO_OWNER
//    - 重置建筑等级为0（恢复初始状态）
// 3. 发送破产事件通知
// 4. 检查游戏结束条件：
//    - 如果只剩一个非破产玩家,该玩家获胜
//    - 游戏状态设置为结束，记录获胜者
fun handle_bankruptcy(
    game: &mut Game,
    _game_data: &GameData,
    _map: &map::MapTemplate,
    player_index: u8,
    creditor: Option<u8>
) {
    {
        let player = &mut game.players[player_index as u64];
        player.bankrupt = true;
    };

    let mut i = 0;
    while (i < game.buildings.length()) {
        let building = &mut game.buildings[i];
        if (building.owner == player_index) {
            building.owner = NO_OWNER;
        };
        i = i + 1;
    };

    {
        let player_mut = &mut game.players[player_index as u64];
        player_mut.temple_levels = vector[];
    };

    events::emit_bankrupt_event(
        game.id.to_inner(),
        player_index,
        0,
        creditor
    );

    let mut non_bankrupt_count = 0;
    let mut winner_idx = option::none<u8>();
    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];
        if (!player.bankrupt) {
            non_bankrupt_count = non_bankrupt_count + 1;
            winner_idx = option::some(i as u8);
        };
        i = i + 1;
    };

    if (non_bankrupt_count == 1) {
        game.status = types::STATUS_ENDED();
        game.winner = winner_idx;
        events::emit_game_ended_event(
            game.id.to_inner(),
            winner_idx,
            (game.round as u16),
            (game.turn as u8),
            2
        );
    }
}


fun place_npc_internal(
    game: &mut Game,
    tile_id: u16,
    kind: u8,
    consumable: bool,
    npc_changes: &mut vector<events::NpcChangeItem>,
) {
    assert!(game.tiles[tile_id as u64].npc_on == NO_NPC, ETileOccupiedByNpc);
    let npc = NpcInst {
        tile_id,
        kind,
        consumable,
        spawn_index: 0xFFFF
    };
    let npc_index = game.npc_on.length();
    game.npc_on.push_back(npc);
    game.tiles[tile_id as u64].npc_on = (npc_index as u16);
    npc_changes.push_back(
        events::make_npc_change(tile_id, kind, events::npc_action_spawn(), consumable)
    );
}

fun remove_npc_internal(
    game: &mut Game,
    tile_id: u16,
    npc_changes: &mut vector<events::NpcChangeItem>,
) {
    let tile_npc_index = game.tiles[tile_id as u64].npc_on;
    if (tile_npc_index == NO_NPC) {
        return
    };

    let npc = game.npc_on.swap_remove(tile_npc_index as u64);
    game.tiles[tile_id as u64].npc_on = NO_NPC;

    if ((tile_npc_index as u64) < game.npc_on.length()) {
        let moved_npc = &game.npc_on[tile_npc_index as u64];
        let moved_tile_id = moved_npc.tile_id;
        game.tiles[moved_tile_id as u64].npc_on = tile_npc_index;
    };

    npc_changes.push_back(
        events::make_npc_change(tile_id, npc.kind, events::npc_action_remove(), npc.consumable)
    );
}

fun consume_npc_if_consumable(
    game: &mut Game,
    tile_id: u16,
    npc: &NpcInst
): bool {
    if (npc.consumable) {
        let tile_npc_index = game.tiles[tile_id as u64].npc_on;
        assert!(tile_npc_index != NO_NPC, ENpcNotFound);

        game.npc_on.swap_remove(tile_npc_index as u64);
        game.tiles[tile_id as u64].npc_on = NO_NPC;

        if ((tile_npc_index as u64) < game.npc_on.length()) {
            let moved_npc = &game.npc_on[tile_npc_index as u64];
            let moved_tile_id = moved_npc.tile_id;
            game.tiles[moved_tile_id as u64].npc_on = tile_npc_index;
        };

        true
    } else {
        false
    }
}

fun apply_card_effect_with_collectors(
    game: &mut Game,
    player_index: u8,
    kind: u8,
    params: &vector<u16>,
    npc_changes: &mut vector<events::NpcChangeItem>,
    buff_changes: &mut vector<events::BuffChangeItem>,
    cash_changes: &mut vector<events::CashDelta>,
    game_data: &GameData,
    map: &map::MapTemplate
): Option<TeleportInfo> {
    if (kind == types::CARD_MOVE_CTRL()) {
        assert!(params.length() >= 2, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let mut dice_sum = 0u64;
        let mut i = 1;
        while (i < params.length()) {
            let dice = params[i];
            assert!(dice >= 1 && dice <= 6, EInvalidParams);
            dice_sum = dice_sum + (dice as u64);
            i = i + 1;
        };

        let target_player = &mut game.players[target_index as u64];

        // 移除冰冻buff（遥控骰子覆盖冰冻），并发出移除事件
        if (has_buff(target_player, types::BUFF_FROZEN())) {
            remove_buff(target_player, types::BUFF_FROZEN());
            buff_changes.push_back(events::make_buff_change(
                types::BUFF_FROZEN(),
                target_index,
                option::none()  // none表示移除
            ));
        };

        let last_active_round = calculate_buff_last_active_round(
            target_index, player_index, game.round, 1, true
        );
        apply_buff(target_player, types::BUFF_MOVE_CTRL(), last_active_round, dice_sum);

        buff_changes.push_back( events::make_buff_change(
            types::BUFF_MOVE_CTRL(),
            target_index,
            option::some(last_active_round)
        ));
    } else if (kind == types::CARD_RENT_FREE()) {
        // 免租卡：立即生效，持续1回合
        let target_index = if (params.length() > 0) {
            (params[0] as u8)
        } else {
            player_index
        };
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let last_active_round = calculate_buff_last_active_round(
            target_index, player_index, game.round, 1, true
        );
        let target_player = &mut game.players[target_index as u64];
        apply_buff(target_player, types::BUFF_RENT_FREE(), last_active_round, 0);

        buff_changes.push_back( events::make_buff_change(
            types::BUFF_RENT_FREE(),
            target_index,
            option::some(last_active_round)
        ));
    } else if (kind == types::CARD_FREEZE()) {
        // 冰冻卡可以对自己或其他玩家使用
        // 冰冻效果：停在原地，但仍可掷骰子、使用卡牌、升级建筑、购买等
        assert!(params.length() >= 1, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let last_active_round = calculate_buff_last_active_round(
            target_index, player_index, game.round, 1, true
        );

        let target_player = &mut game.players[target_index as u64];

        // 移除遥控骰子buff（冰冻覆盖遥控骰子），并发出移除事件
        if (has_buff(target_player, types::BUFF_MOVE_CTRL())) {
            remove_buff(target_player, types::BUFF_MOVE_CTRL());
            buff_changes.push_back(events::make_buff_change(
                types::BUFF_MOVE_CTRL(),
                target_index,
                option::none()  // none表示移除
            ));
        };

        apply_buff(target_player, types::BUFF_FROZEN(), last_active_round, 0);

        buff_changes.push_back( events::make_buff_change(
            types::BUFF_FROZEN(),
            target_index,
            option::some(last_active_round)
        ));
    } else if (kind == types::CARD_BARRIER() || kind == types::CARD_BOMB() || kind == types::CARD_DOG()) {
        assert!(params.length() >= 1, EInvalidParams);
        let tile_id = params[0];

        let npc_kind = if (kind == types::CARD_BARRIER()) {
            types::NPC_BARRIER()
        } else if (kind == types::CARD_BOMB()) {
            types::NPC_BOMB()
        } else {
            types::NPC_DOG()
        };

        if (game.tiles[tile_id as u64].npc_on == NO_NPC) {
            place_npc_internal(
                game,
                tile_id,
                npc_kind,
                is_npc_consumable(npc_kind),
                npc_changes
            );
        };
    } else if (kind == types::CARD_CLEANSE()) {
        let mut i = 0;
        while (i < params.length()) {
            let tile_id = params[i];
            remove_npc_internal(game, tile_id, npc_changes);
            i = i + 1;
        };
    } else if (kind == types::CARD_TURN()) {

        let target_index = if (params.length() > 0) {
            (params[0] as u8)
        } else {
            player_index
        };
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];

        assert!(target_player.last_tile_id != 65535, ECannotTurn);

        target_player.next_tile_id = target_player.last_tile_id;

    } else if (kind == types::CARD_TELEPORT()) {
        // 瞬移卡: params = [target_player_index, tile_id]
        // 设计意图：瞬移卡只改变位置，停留效果由后续的 roll_and_step 触发
        assert!(params.length() >= 2, EInvalidParams);
        let target_index = (params[0] as u8);
        let tile_id = params[1];
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);
        assert!((tile_id as u64) < game.tiles.length(), ENoSuchTile);

        // 1. 记录原位置
        let from_pos = game.players[target_index as u64].pos;

        // 2. 更新位置并清除强制方向
        game.players[target_index as u64].pos = tile_id;
        game.players[target_index as u64].next_tile_id = 65535;  // 清除转向卡设置

        // 3. 如果是传送自己，添加传送buff（瞬移覆盖遥控骰子）
        let is_self = (player_index == target_index);
        if (is_self) {
            // 移除遥控骰子buff（瞬移后路径已无意义）
            let target_player = &mut game.players[target_index as u64];
            if (has_buff(target_player, types::BUFF_MOVE_CTRL())) {
                remove_buff(target_player, types::BUFF_MOVE_CTRL());
                buff_changes.push_back(events::make_buff_change(
                    types::BUFF_MOVE_CTRL(),
                    target_index,
                    option::none()  // none 表示移除
                ));
            };

            let last_active_round = calculate_buff_last_active_round(
                player_index, player_index, game.round, 1, true
            );
            let target_player = &mut game.players[target_index as u64];
            apply_buff(target_player, types::BUFF_TELEPORT(), last_active_round, 0);

            buff_changes.push_back(events::make_buff_change(
                types::BUFF_TELEPORT(),
                target_index,
                option::some(last_active_round)
            ));
        };

        // 4. 返回简化的 TeleportInfo（不调用 handle_tile_stop_with_collector）
        return option::some(TeleportInfo {
            target_player: target_index,
            source_player: player_index,
            from_pos,
            to_pos: tile_id,
        })

    } else if (kind == types::CARD_BONUS_S()) {
        // 奖励卡（小）: params = [target_player_index]，+1万
        assert!(params.length() >= 1, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];
        target_player.cash = target_player.cash + 10000;

        cash_changes.push_back(events::make_cash_delta(
            target_index,
            false,   // is_debit=false: 获得金币
            10000,
            6,       // reason=6: CARD
            0        // details
        ));

    } else if (kind == types::CARD_BONUS_L()) {
        // 奖励卡（大）: params = [target_player_index]，+10万
        assert!(params.length() >= 1, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];
        target_player.cash = target_player.cash + 100000;

        cash_changes.push_back(events::make_cash_delta(
            target_index,
            false,   // is_debit=false: 获得金币
            100000,
            6,       // reason=6: CARD
            0        // details
        ));

    } else if (kind == types::CARD_FEE_S()) {
        // 费用卡（小）: params = [target_player_index]，-1万
        assert!(params.length() >= 1, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];
        if (target_player.cash >= 10000) {
            target_player.cash = target_player.cash - 10000;
            cash_changes.push_back(events::make_cash_delta(
                target_index,
                true,    // is_debit=true: 扣除金币
                10000,
                6,       // reason=6: CARD
                0        // details
            ));
        };

    } else if (kind == types::CARD_FEE_L()) {
        // 费用卡（大）: params = [target_player_index]，-10万
        assert!(params.length() >= 1, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];
        if (target_player.cash >= 100000) {
            target_player.cash = target_player.cash - 100000;
            cash_changes.push_back(events::make_cash_delta(
                target_index,
                true,    // is_debit=true: 扣除金币
                100000,
                6,       // reason=6: CARD
                0        // details
            ));
        };

    } else if (kind == types::CARD_CONSTRUCTION()) {
        // 建造卡: params = [building_idx]，升级建筑一级
        assert!(params.length() >= 1, EInvalidParams);
        let building_idx = (params[0] as u64);
        assert!(building_idx < game.buildings.length(), EBuildingNotFound);

        let building = &mut game.buildings[building_idx];
        if (building.level < 5) {
            building.level = building.level + 1;
        };

    } else if (kind == types::CARD_RENOVATION()) {
        // 改建卡: params = [building_idx, building_type]，更换大建筑类型
        assert!(params.length() >= 2, EInvalidParams);
        let building_idx = (params[0] as u64);
        let new_type = (params[1] as u8);
        assert!(building_idx < game.buildings.length(), EBuildingNotFound);
        assert!(types::is_large_building_type(new_type), EInvalidBuildingType);

        let building = &mut game.buildings[building_idx];
        building.building_type = new_type;

    } else if (kind == types::CARD_SUMMON()) {
        // 召唤卡: params = [tile_id, npc_type]，放置指定NPC
        assert!(params.length() >= 2, EInvalidParams);
        let tile_id = params[0];
        let npc_kind = (params[1] as u8);
        assert!((tile_id as u64) < game.tiles.length(), ENoSuchTile);

        if (game.tiles[tile_id as u64].npc_on == NO_NPC) {
            place_npc_internal(
                game,
                tile_id,
                npc_kind,
                is_npc_consumable(npc_kind),
                npc_changes
            );
        };

    } else if (kind == types::CARD_BANISH()) {
        // 驱逐卡: params = [tile_id]，移除tile上的NPC
        assert!(params.length() >= 1, EInvalidParams);
        let tile_id = params[0];
        assert!((tile_id as u64) < game.tiles.length(), ENoSuchTile);

        remove_npc_internal(game, tile_id, npc_changes);
    };

    // 其他卡牌返回 none
    option::none()
}

// ===== Buff管理API函数 =====

/// 计算 buff 的 last_active_round（统一公式）
///
/// 设计原则：
/// - 如果目标玩家在使用者之前行动（本回合已行动），buff 从下一回合开始算
/// - 如果目标玩家在使用者之后行动（本回合未行动），buff 从当前回合开始算
/// - include_current_round 控制当前回合是否算入持续时间
///
/// 参数：
/// - target_index: 目标玩家索引
/// - player_index: 使用者玩家索引
/// - current_round: 当前回合
/// - duration: 持续回合数
/// - include_current_round: 当前回合是否算入持续时间
///   - true: 当前回合算在内（默认场景）
///   - false: 当前回合不算在内
///
/// 返回：last_active_round（buff 激活的最后一个回合）
fun calculate_buff_last_active_round(
    target_index: u8,
    player_index: u8,
    current_round: u16,
    duration: u16,
    include_current_round: bool
): u16 {
    assert!(duration > 0, EInvalidParams);  // 防止 duration - 1 下溢
    // 如果不包含当前回合，或者目标已行动，当前回合不算在内
    if (!include_current_round || target_index < player_index) {
        current_round + duration           // 从下一回合开始算
    } else {
        current_round + (duration - 1)     // 从当前回合开始算
    }
}

// 为玩家应用一个buff效果
//
// Buff系统采用包含语义（inclusive semantics）：
// - last_active_round表示buff激活的最后一个回合
// - 当current_round <= last_active_round时，buff处于激活状态
// - 当current_round > last_active_round时，buff已过期
//
// 注意：同类型的buff会互相覆盖（同一时间只能有一个同类型buff）
fun apply_buff(player: &mut Player, kind: u8, last_active_round: u16, value: u64) {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.kind == kind) {
            player.buffs.remove(i);
            break
        };
        i = i + 1;
    };

    let buff = BuffEntry { kind, last_active_round, value, spawn_index: 0xFFFF };
    player.buffs.push_back(buff);
}

// 移除指定类型的buff（用于buff互相覆盖的场景）
fun remove_buff(player: &mut Player, kind: u8) {
    let mut i = 0;
    while (i < player.buffs.length()) {
        if (player.buffs[i].kind == kind) {
            player.buffs.remove(i);
            return
        };
        i = i + 1;
    };
}

// 检查是否存在指定类型的buff
fun has_buff(player: &Player, kind: u8): bool {
    let mut i = 0;
    while (i < player.buffs.length()) {
        if (player.buffs[i].kind == kind) {
            return true
        };
        i = i + 1;
    };
    false
}

fun apply_buff_with_source(
    player: &mut Player,
    kind: u8,
    last_active_round: u16,
    value: u64,
    spawn_index: u16
) {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.kind == kind) {
            player.buffs.remove(i);
            break
        };
        i = i + 1;
    };

    let buff = BuffEntry { kind, last_active_round, value, spawn_index };
    player.buffs.push_back(buff);
}

fun clear_expired_buffs(player: &mut Player, current_round: u16) {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.last_active_round < current_round) {
            player.buffs.remove(i);
        } else {
            i = i + 1;
        }
    }
}

fun process_and_clear_expired_buffs(game: &mut Game, player_index: u8) {
    let current_round = game.round;

    let mut expired_buffs = vector[];
    {
        let player = &game.players[player_index as u64];
        let mut i = 0;
        while (i < player.buffs.length()) {
            let buff = player.buffs[i];
            if (buff.last_active_round < current_round) {
                expired_buffs.push_back(buff);
            };
            i = i + 1;
        }
    };

    let mut j = 0;
    while (j < expired_buffs.length()) {
        handle_buff_expired(game, &expired_buffs[j]);
        j = j + 1;
    };

    let player = &mut game.players[player_index as u64];
    clear_expired_buffs(player, current_round);
}

fun is_buff_active(player: &Player, kind: u8, current_round: u16): bool {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.kind == kind && buff.last_active_round >= current_round) {
            return true
        };
        i = i + 1;
    };
    false
}

/// 检查玩家是否应该跳过移动（通用化检测）
/// 扩展时只需在此添加新的 buff 类型
fun should_skip_movement(player: &Player, current_round: u16): bool {
    is_buff_active(player, types::BUFF_FROZEN(), current_round) ||
    is_buff_active(player, types::BUFF_TELEPORT(), current_round)
}

// 获取激活buff的数值载荷
//
// 某些buff需要携带额外数据，如：
// - 移动控制buff：value存储指定的骰子点数
// - 免租buff：value可存储免租的比例或次数
fun get_buff_value(player: &Player, kind: u8, current_round: u16): u64 {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.kind == kind && buff.last_active_round >= current_round) {
            return buff.value
        };
        i = i + 1;
    };
    0
}

fun clean_turn_state(game: &mut Game, player_index: u8) {
    process_and_clear_expired_buffs(game, player_index);
}

fun find_richest_player(game: &Game): Option<u8> {
    let mut max_cash: u64 = 0;
    let mut richest_player: Option<u8> = option::none();

    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];

        if (!player.bankrupt) {
            if (player.cash > max_cash) {
                max_cash = player.cash;
                richest_player = option::some(i as u8);
            }
        };

        i = i + 1;
    };

    richest_player
}

// 推进游戏到下一个玩家的回合
//
// 回合切换逻辑：
// 1. 寻找下一个未破产的玩家
// 2. 更新回合数（仅在回到第一个玩家时）
// 3. 检查游戏结束条件
// 4. 重置游戏阶段为掷骰子阶段
fun advance_turn(
    game: &mut Game,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    let player_count = game.players.length() as u8;
    let mut attempts = 0;
    let mut will_wrap = false;

    loop {
        if ((game.active_idx + 1) >= player_count) {
            will_wrap = true;
        };

        game.active_idx = ((game.active_idx + 1) % player_count);
        attempts = attempts + 1;

        let current_player = &game.players[game.active_idx as u64];

        if (!current_player.bankrupt) {
            break
        };

        if (attempts >= player_count) {
            break
        };
    };

    game.turn = game.active_idx;

    if (will_wrap) {
        game.round = game.round + 1;

        refresh_at_round_end(game, game_data, map, r, ctx);

        if (game.max_rounds > 0) {
            if (game.round >= (game.max_rounds as u16)) {
                game.status = types::STATUS_ENDED();

                let winner = find_richest_player(game);
                game.winner = winner;

                events::emit_game_ended_event(
                    game.id.to_inner(),
                    winner,
                    (game.round as u16),
                    (game.turn as u8),
                    1
                );
            }
        }
    };

    game.has_rolled = false;
}

fun refresh_at_round_end(
    game: &mut Game,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    clean_expired_npcs(game);

    let mut generator = random::new_generator(r, ctx);
    let (npc_kind, tile_id) = spawn_random_npc(game, map, &mut generator);

    events::emit_round_ended_event(
        game.id.to_inner(),
        (game.round - 1),
        npc_kind,
        tile_id
    );
}

fun clean_expired_npcs(_game: &mut Game) {
    // TODO: 使用LinkedTable或其他方式跟踪所有NPC位置
}

fun get_round(game: &Game): u16 { game.round }

fun get_turn_in_round(game: &Game): u8 { game.turn }


fun get_seat_player(seat: &Seat): address { seat.player }

fun get_game_status(game: &Game): u8 { game.status }

fun get_current_turn(game: &Game): (u16, u8) {
    (game.round, game.turn)
}
fun get_active_player_index(game: &Game): u8 { game.active_idx }
fun get_player_count(game: &Game): u64 { game.players.length() }
fun get_template_map_id(game: &Game): ID { game.template_map_id }

fun get_player_position(game: &Game, player: address): u16 {
    let player_index = find_player_index(game, player);
    game.players[player_index as u64].pos
}

fun get_player_cash(game: &Game, player: address): u64 {
    let player_index = find_player_index(game, player);
    game.players[player_index as u64].cash
}

fun is_tile_owned(game: &Game, map: &map::MapTemplate, _game_data: &GameData, tile_id: u16): bool {
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);

    if (building_id == map::no_building()) {
        return false
    };

    (game.buildings[building_id as u64].owner != NO_OWNER)
}

fun get_tile_owner(game: &Game, map: &map::MapTemplate, _game_data: &GameData, tile_id: u16): address {
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);

    assert!(building_id != map::no_building(), ENoSuchTile);

    let building =&game.buildings[building_id as u64];
    assert!(building.owner != NO_OWNER, ENoSuchTile);
    let owner_index = building.owner;
    game.players[owner_index as u64].owner
}

fun get_tile_level(game: &Game, map: &map::MapTemplate, _game_data: &GameData, tile_id: u16): u8 {
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);

    if (building_id == map::no_building()) {
        return 0
    };

    game.buildings[building_id as u64].level
}

fun is_player_bankrupt(game: &Game, player: address): bool {
    let mut i = 0;
    while (i < game.players.length()) {
        let p = &game.players[i];
        if (p.owner == player) {
            return p.bankrupt
        };
        i = i + 1;
    };
    false
}

fun get_player_card_count(game: &Game, player: address, kind: u8): u8 {
    let mut i = 0;
    while (i < game.players.length()) {
        let player_data = &game.players[i];
        if (player_data.owner == player) {
            return cards::get_player_card_count(&player_data.cards, kind)
        };
        i = i + 1;
    };
    0
}

// ===== NPC Spawn Helper Functions NPC生成辅助函数 =====

fun init_npc_spawn_pool(weights: &vector<u8>): vector<NpcSpawnEntry> {
    let mut pool = vector[];
    let mut i = 0;

    while (i < weights.length()) {
        let npc_kind = weights[i];
        let weight = weights[i + 1];

        let mut j = 0;
        while (j < weight) {
            pool.push_back(NpcSpawnEntry {
                npc_kind,
                next_active_round: 0
            });
            j = j + 1;
        };

        i = i + 2;
    };

    pool
}

fun is_npc_consumable(npc_kind: u8): bool {
    npc_kind == types::NPC_BARRIER() ||
    npc_kind == types::NPC_BOMB() ||
    npc_kind == types::NPC_DOG() ||
    npc_kind == types::NPC_WEALTH_GOD() ||
    npc_kind == types::NPC_LAND_GOD() ||
    npc_kind == types::NPC_FORTUNE_GOD() ||
    npc_kind == types::NPC_POOR_GOD()
}

fun is_buff_npc(npc_kind: u8): bool {
    npc_kind == types::NPC_LAND_GOD() ||
    npc_kind == types::NPC_FORTUNE_GOD()
}

// ===== 探针式随机地块查找（Gas优化版本）=====
//
// 算法说明：
// 使用探针式查找(Probing)代替全量扫描，大幅降低gas消耗
// 原理类似哈希表的线性探测，但用于随机选择空闲地块
//
// 核心思路：
// 1. 不遍历所有地块建立候选列表（原方法O(n)）
// 2. 而是随机选择起点，按固定步长探测，最多检查8个位置（O(1)）
// 3. 利用素数步长保证良好的分布性，避免重复探测相同位置
//
// 优势：
// - Gas消耗从O(n)降至O(1)，8格地图节省60%，28格地图节省85%
// - 无需分配vector内存
// - 大地图性能优势更明显
//
// 劣势：
// - 分布不如完全随机均匀（但通过素数步长缓解）
// - 可能找不到空位（需要fallback到原方法）
fun random_spawn_tile_probing(
    game: &Game,
    template: &MapTemplate,
    gen: &mut RandomGenerator,
    npc_type: u8
): Option<u16> {
    let tile_count = game.tiles.length();
    if (tile_count == 0) return option::none();

    let start_pos = (random::generate_u64(gen) + (npc_type as u64)) % tile_count;

    let primes = if (tile_count <= 10) {
        vector[3u64, 5]
    } else if (tile_count <= 30) {
        vector[3u64, 5, 7, 11]
    } else {
        vector[7u64, 11, 13, 17, 19]
    };

    let step = primes[random::generate_u64(gen) % primes.length()];

    let max_attempts = if (tile_count <= 10) 4 else 8;

    let mut i = 0;
    while (i < max_attempts) {
        let pos = ((start_pos + i * step) % tile_count) as u16;

        let tile_static = map::get_tile(template, pos);

        if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
            game.tiles[pos as u64].npc_on == NO_NPC) {

            return option::some(pos)
        };

        i = i + 1;
    };

    option::none()
}

fun random_spawn_tile(
    game: &Game,
    template: &MapTemplate,
    gen: &mut RandomGenerator
): Option<u16> {
    let result = random_spawn_tile_probing(game, template, gen, 0);

    if (result.is_some()) {
        return result
    };

    let mut available_tiles = vector[];
    let mut i = 0;
    while (i < game.tiles.length()) {
        let tile_static = map::get_tile(template, i as u16);
        if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
            game.tiles[i].npc_on == NO_NPC) {
            available_tiles.push_back(i as u16);
        };
        i = i + 1;
    };

    if (available_tiles.is_empty()) {
        return option::none()
    };

    let tile_idx = random::generate_u64(gen) % available_tiles.length();
    option::some(available_tiles[tile_idx])
}

// NPC生成系统使用冷却机制：
// - 成功放置NPC后设置冷却时间
// - 如果因地块不足而失败，不设置冷却（下次还有机会生成）
// - Buff型NPC冷却3轮，普通NPC冷却2轮
fun spawn_random_npc(
    game: &mut Game,
    template: &MapTemplate,
    gen: &mut RandomGenerator
): (u8, u16) {
    if (game.npc_spawn_pool.is_empty()) return (0, 0);

    let current_round = game.round;

    let pool_idx = (random::generate_u64(gen) % game.npc_spawn_pool.length()) as u16;

    let entry = &game.npc_spawn_pool[pool_idx as u64];
    if (entry.next_active_round > current_round) {
        return (0, 0)
    };

    let npc_kind = entry.npc_kind;
    let is_consumable = is_npc_consumable(npc_kind);

    let mut tile_id_opt = random_spawn_tile_probing(game, template, gen, npc_kind);

    if (tile_id_opt.is_none()) {
        tile_id_opt = random_spawn_tile(game, template, gen);
    };

    if (tile_id_opt.is_none()) {
        return (0, 0)
    };
    let tile_id = tile_id_opt.extract();

    let npc = NpcInst {
        tile_id,
        kind: npc_kind,
        consumable: is_consumable,
        spawn_index: pool_idx
    };
    let npc_index = game.npc_on.length();
    game.npc_on.push_back(npc);
    game.tiles[tile_id as u64].npc_on = (npc_index as u16);

    let cooldown_rounds = if (is_buff_npc(npc_kind)) {
        3
    } else {
        2
    };
    game.npc_spawn_pool[pool_idx as u64].next_active_round = current_round + cooldown_rounds;

    (npc_kind, tile_id)
}

fun handle_npc_consumed(
    game: &mut Game,
    npc: &NpcInst,
    is_buff_npc: bool
) {
    if (npc.spawn_index == 0xFFFF) {
        return;
    };

    let current_round = game.round;
    let pool_entry = &mut game.npc_spawn_pool[npc.spawn_index as u64];

    if (is_buff_npc) {
        pool_entry.next_active_round = current_round + 3;  // Buff型NPC冷却3轮
    } else {
        pool_entry.next_active_round = current_round + 2;
    }
}

fun handle_buff_expired(
    game: &mut Game,
    buff: &BuffEntry
) {
    if (buff.spawn_index == 0xFFFF) {
        return;
    };

    let current_round = game.round;
    let pool_entry = &mut game.npc_spawn_pool[buff.spawn_index as u64];
    pool_entry.next_active_round = current_round + 2;
}

// ===== Helper Functions (moved from types) =====

fun validate_map(game: &Game, map: &map::MapTemplate) {
    let map_id = map::get_map_id(map);
    assert!(map_id == game.template_map_id, EMapMismatch);
}

fun get_chain_buildings(
    game: &Game,
    template: &map::MapTemplate,
    building_id: u16
): vector<u16> {
    if ((building_id as u64) >= game.buildings.length()) {
        return vector[]
    };

    let building_static = map::get_building(template, building_id);

    if (map::building_size(building_static) != types::SIZE_1X1()) {
        return vector[building_id]
    };

    let building = &game.buildings[building_id as u64];
    let owner = building.owner;

    if (owner == NO_OWNER) {
        return vector[building_id]
    };

    let mut chain = vector[building_id];

    let mut current = building_id;
    loop {
        let current_static = map::get_building(template, current);
        let next_id = map::building_chain_next_id(current_static);

        if (next_id == map::no_building()) break;
        if ((next_id as u64) >= game.buildings.length()) break;
        if (chain.contains(&next_id)) break;

        let next_building = &game.buildings[next_id as u64];
        if (next_building.owner != owner) break;

        chain.push_back(next_id);
        current = next_id;
    };

    current = building_id;
    let mut prev_chain = vector[];
    loop {
        let current_static = map::get_building(template, current);
        let prev_id = map::building_chain_prev_id(current_static);

        if (prev_id == map::no_building()) break;
        if ((prev_id as u64) >= game.buildings.length()) break;
        if (chain.contains(&prev_id)) break;

        let prev_building = &game.buildings[prev_id as u64];
        if (prev_building.owner != owner) break;

        prev_chain.push_back(prev_id);
        current = prev_id;
    };

    let mut result = vector[];
    let mut i = prev_chain.length();
    while (i > 0) {
        result.push_back(prev_chain[i - 1]);
        i = i - 1;
    };

    i = 0;
    while (i < chain.length()) {
        result.push_back(chain[i]);
        i = i + 1;
    };

    result
}

// 公式: (round / price_rise_days) + 1
fun calculate_price_index(game: &Game): u64 {
    let index_level = (game.round as u64) / (game.price_rise_days as u64);
    index_level + 1
}


/// 计算单块地的基础租金
/// 公式：P × 倍率 × I
fun calculate_single_tile_rent(
    price: u64,
    level: u8,
    price_index: u64,
    game_data: &GameData
): u64 {
    let rent_multipliers = tycoon::get_rent_multipliers(game_data);

    let multiplier = if ((level as u64) < rent_multipliers.length()) {
        rent_multipliers[level as u64]
    } else {
        100
    };

    (((price as u128) * (multiplier as u128) * (price_index as u128)) / 100) as u64
}

/// 计算土地庙加成（分别相加模式）
/// 多个土地庙不是连乘，而是各自计算加成后相加
fun calculate_temple_bonus(
    base_rent: u64,
    temple_levels: &vector<u8>,
    game_data: &GameData
): u64 {
    let mut bonus = 0u64;
    let temple_multipliers = tycoon::get_temple_multipliers(game_data);

    let mut i = 0;
    while (i < temple_levels.length()) {
        let level = temple_levels[i];
        if (level > 0 && (level as u64) <= temple_multipliers.length()) {
            let multiplier = temple_multipliers[(level - 1) as u64];
            let temple_bonus = (((base_rent as u128) * (multiplier as u128)) / 100) as u64;
            bonus = bonus + temple_bonus;
        };
        i = i + 1;
    };

    bonus
}

/// 计算过路费
/// 流程：
/// 1. 判断连街（使用 get_chain_buildings，考虑owner）
/// 2. 逐building计算：base_rent = P × mL[L] × I
/// 3. 土地庙加成：owner拥有土地庙则全局加成
/// 4. 连街求和；非连街返回单个
fun calculate_toll(
    game: &Game,
    landing_tile_id: u16,
    template: &MapTemplate,
    game_data: &GameData
): u64 {
    let tile_static = map::get_tile(template, landing_tile_id);
    let building_id = map::tile_building_id(tile_static);

    if (building_id == map::no_building()) return 0;

    let building = &game.buildings[building_id as u64];
    let owner = building.owner;

    if (owner == NO_OWNER) return 0;

    let price_index = calculate_price_index(game);

    let chain_buildings = get_chain_buildings(game, template, building_id);

    let temple_levels = find_owner_temples(game, owner);

    let mut total_rent = 0u64;

    let mut i = 0;
    while (i < chain_buildings.length()) {
        let b_id = chain_buildings[i];
        let b_static = map::get_building(template, b_id);
        let b = &game.buildings[b_id as u64];

        let base_rent = calculate_single_tile_rent(
            map::building_price(b_static),
            b.level,
            price_index,
            game_data
        );

        let temple_bonus = calculate_temple_bonus(base_rent, &temple_levels, game_data);

        total_rent = total_rent + base_rent + temple_bonus;
        i = i + 1;
    };

    total_rent
}

fun find_owner_temples(game: &Game, owner: u8): vector<u8> {
    let player = &game.players[owner as u64];
    player.temple_levels
}

fun rebuild_temple_levels_cache(game: &mut Game, player_index: u8) {
    let mut new_levels = vector[];

    let mut i = 0;
    while (i < game.buildings.length()) {
        let building = &game.buildings[i];
        if (building.owner == player_index &&
            building.building_type == types::BUILDING_TEMPLE() &&
            building.level > 0) {
            new_levels.push_back(building.level);
        };
        i = i + 1;
    };

    let player_mut = &mut game.players[player_index as u64];
    player_mut.temple_levels = new_levels;
}

/// 计算物价系数F
/// 公式：F = 0.2 × I
fun calculate_price_factor(game: &Game): u64 {
    let price_index = calculate_price_index(game);
    price_index * 20
}

/// 计算购买空地的价格（获得 L0 所有权）
/// 公式：base_price × F / 100
/// 注：购买后 level 保持 0，需要再次升级才变成 L1
fun calculate_buy_price(
    building_static: &map::BuildingStatic,
    game: &Game
): u64 {
    let base_price = map::building_price(building_static);
    let price_factor = calculate_price_factor(game);
    (((base_price as u128) * (price_factor as u128)) / 100) as u64
}

/// 计算建筑购买/升级价格（统一版本，根据size自动选择价格表）
/// 小建筑(1x1): 购地价公式：(P + 级别加价) × F / 100
/// 大建筑(2x2): 使用大建筑价格表 × F / 100
fun calculate_building_price(
    building_static: &map::BuildingStatic,
    building: &Building,
    current_level: u8,
    target_level: u8,
    game: &Game,
    game_data: &GameData
): u64 {
    if (target_level <= current_level) return 0;

    let price_factor = calculate_price_factor(game);
    let building_size = map::building_size(building_static);

    if (building_size == types::SIZE_1X1()) {
        let base_price = map::building_price(building_static);
        let upgrade_costs = tycoon::get_building_upgrade_costs(game_data);

        let current_cost = if ((current_level as u64) < upgrade_costs.length()) {
            upgrade_costs[current_level as u64]
        } else {
            0
        };

        let target_cost = if ((target_level as u64) < upgrade_costs.length()) {
            upgrade_costs[target_level as u64]
        } else {
            return 0
        };

        let current_total = ((((base_price + current_cost) as u128) * (price_factor as u128)) / 100) as u64;

        let target_total = ((((base_price + target_cost) as u128) * (price_factor as u128)) / 100) as u64;

        if (target_total > current_total) {
            target_total - current_total
        } else {
            0
        }
    } else if (building_size == types::SIZE_2X2()) {
        if (building.building_type == types::BUILDING_TEMPLE() && current_level > 0) {
            return 0
        };

        let large_costs = tycoon::get_large_building_costs(game_data);

        let current_idx = if (current_level > 0) { (current_level - 1) as u64 } else { 0 };
        let target_idx = (target_level - 1) as u64;

        let current_cost = if (current_level > 0 && current_idx < large_costs.length()) {
            large_costs[current_idx]
        } else {
            0
        };

        let target_cost = if (target_idx < large_costs.length()) {
            large_costs[target_idx]
        } else {
            return 0
        };

        let upgrade_diff = if (target_cost > current_cost) {
            target_cost - current_cost
        } else {
            target_cost
        };

        (((upgrade_diff as u128) * (price_factor as u128)) / 100) as u64
    } else {
        0
    }
}

fun is_hospital_npc(kind: u8): bool {
    kind == types::NPC_BOMB() || kind == types::NPC_DOG()
}
