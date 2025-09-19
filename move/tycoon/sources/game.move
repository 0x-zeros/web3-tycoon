module tycoon::game;

use sui::table::{Self, Table};
use sui::clock::{Self, Clock};

use tycoon::types;
use tycoon::map::{Self, MapTemplate, MapRegistry};
use tycoon::cards::{Self, CardCatalog};
use tycoon::events;

// ===== Config 游戏配置 =====
public struct Config has store, copy, drop {
    trigger_card_on_pass: bool,
    trigger_lottery_on_pass: bool,
    npc_cap: u16,
    max_players: u8,
    max_turns: Option<u64>,
    bomb_to_hospital: bool,
    dog_to_hospital: bool,
    barrier_consumed_on_stop: bool,
    // 移动相关配置
    allow_reverse: bool,              // 是否允许逆时针移动
    emit_move_step_events: bool,      // 是否发送逐步移动事件
    use_adj_traversal: bool           // 是否使用邻接寻路
}

// ===== Player 玩家状态 =====
public struct Player has store {
    owner: address,
    pos: u64,  // tile_id
    cash: u64,
    in_prison_turns: u8,
    in_hospital_turns: u8,
    frozen_until_turn: Option<u64>,
    rent_free_until_turn: Option<u64>,
    bankrupt: bool,
    cards: Table<u16 /* CardKind */, u64 /* count */>,
    dir_pref: u8,  // DirMode
    roll_override: Option<u8>
}

// ===== NpcInst NPC实例 =====
public struct NpcInst has store, copy, drop {
    kind: u8,  // NpcKind
    expires_at_turn: Option<u64>,
    consumable: bool
}

// ===== Seat 座位（入座凭证） =====
public struct Seat has key {
    id: UID,
    game_id: ID,
    player: address
}

// ===== TurnCap 回合令牌 =====
public struct TurnCap has key {
    id: UID,
    game_id: ID,
    player: address,
    turn: u64
}

// ===== Game 游戏对象 =====
public struct Game has key, store {
    id: UID,
    status: u8,  // 0=ready, 1=active, 2=ended
    created_at_ms: u64,
    template_id: u64,
    template_digest: vector<u8>,

    players: Table<address, Player>,
    join_order: vector<address>,

    turn: u64,
    active_idx: u8,
    phase: u8,

    owner_of: Table<u64 /* tile_id */, address>,
    level_of: Table<u64, u8>,
    npc_on: Table<u64, NpcInst>,
    owner_index: Table<address, vector<u64>>,  // 玩家拥有的地产列表

    config: Config,
    rng_nonce: u64,

    // 额外状态
    current_npc_count: u16,
    card_catalog: CardCatalog,
    winner: Option<address>
}

// ===== Entry Functions 入口函数 =====

// 创建游戏
public entry fun create_game(
    registry: &MapRegistry,
    template_id: u64,
    ctx: &mut TxContext
) {
    // 验证模板存在
    assert!(map::has_template(registry, template_id), types::err_template_not_found());
    let template = map::get_template(registry, template_id);

    // 创建默认配置
    let config = Config {
        trigger_card_on_pass: true,
        trigger_lottery_on_pass: true,
        npc_cap: types::default_npc_cap(),
        max_players: types::default_max_players(),
        max_turns: option::some(types::default_max_turns()),
        bomb_to_hospital: true,
        dog_to_hospital: true,
        barrier_consumed_on_stop: true,
        allow_reverse: true,              // 默认允许双向移动
        emit_move_step_events: true,      // 默认发送移动事件
        use_adj_traversal: false          // 默认使用环路寻路
    };

    // 创建游戏对象
    let game_id = object::new(ctx);
    let game_id_copy = object::uid_to_inner(&game_id);

    let mut game = Game {
        id: game_id,
        status: types::status_ready(),
        created_at_ms: 0,  // 将在start时设置
        template_id,
        template_digest: map::get_template_digest(template),
        players: table::new(ctx),
        join_order: vector::empty(),
        turn: 0,
        active_idx: 0,
        phase: types::phase_roll(),
        owner_of: table::new(ctx),
        level_of: table::new(ctx),
        npc_on: table::new(ctx),
        owner_index: table::new(ctx),
        config,
        rng_nonce: 0,
        current_npc_count: 0,
        card_catalog: cards::create_catalog(ctx),
        winner: option::none()
    };

    // 创建者自动加入
    let creator = ctx.sender();
    let player = create_player(creator, ctx);
    table::add(&mut game.players, creator, player);
    game.join_order.push_back(creator);

    // 发出游戏创建事件
    events::emit_game_created_event(
        game_id_copy,
        creator,
        template_id,
        config.max_players,
        0
    );

    // 创建座位凭证
    let seat = Seat {
        id: object::new(ctx),
        game_id: game_id_copy,
        player: creator
    };

    // 共享游戏对象
    transfer::share_object(game);
    transfer::transfer(seat, creator);
}

// 加入游戏
public entry fun join(
    game: &mut Game,
    ctx: &mut TxContext
) {
    let player_addr = ctx.sender();

    // 验证游戏状态
    assert!(game.status == types::status_ready(), types::err_already_started());
    assert!(game.join_order.length() < (game.config.max_players as u64), types::err_join_full());
    assert!(!table::contains(&game.players, player_addr), types::err_already_joined());

    // 创建玩家
    let player = create_player(player_addr, ctx);
    table::add(&mut game.players, player_addr, player);
    game.join_order.push_back(player_addr);

    // 发出加入事件
    events::emit_player_joined_event(
        object::uid_to_inner(&game.id),
        player_addr,
        (game.join_order.length() - 1) as u8
    );

    // 创建座位凭证
    let seat = Seat {
        id: object::new(ctx),
        game_id: object::uid_to_inner(&game.id),
        player: player_addr
    };

    transfer::transfer(seat, player_addr);
}

// 开始游戏
public entry fun start(
    game: &mut Game,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 验证状态
    assert!(game.status == types::status_ready(), types::err_already_started());
    assert!(game.join_order.length() >= 2, types::err_not_enough_players());

    // 设置游戏状态
    game.status = types::status_active();
    game.created_at_ms = clock::timestamp_ms(clock);
    game.turn = 1;
    game.active_idx = 0;
    game.phase = types::phase_roll();

    // 初始化随机数种子
    game.rng_nonce = game.created_at_ms;

    let starting_player = *game.join_order.borrow(0);

    // 发出开始事件
    events::emit_game_started_event(
        object::uid_to_inner(&game.id),
        game.join_order.length() as u8,
        starting_player
    );
}

// 铸造回合令牌
public entry fun mint_turncap(
    game: &mut Game,
    seat: &Seat,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 验证游戏状态
    assert!(game.status == types::status_active(), types::err_game_ended());
    assert!(seat.game_id == object::uid_to_inner(&game.id), types::err_pos_mismatch());

    // 验证是当前活跃玩家
    let active_player = get_active_player(game);
    assert!(seat.player == active_player, types::err_not_active_player());

    // 验证阶段
    assert!(game.phase == types::phase_roll(), types::err_wrong_phase());

    // 创建回合令牌
    let cap = TurnCap {
        id: object::new(ctx),
        game_id: object::uid_to_inner(&game.id),
        player: active_player,
        turn: game.turn
    };

    transfer::transfer(cap, active_player);
}

// 使用卡牌
public entry fun use_card(
    game: &mut Game,
    cap: &TurnCap,
    kind: u16,
    target: Option<address>,
    tile: Option<u64>,
    registry: &MapRegistry,
    ctx: &mut TxContext
) {
    // 验证令牌
    validate_turn_cap(game, cap);

    let player_addr = cap.player;
    let player = table::borrow_mut(&mut game.players, player_addr);

    // 验证玩家有这张卡
    assert!(cards::player_has_card(&player.cards, kind), types::err_card_not_owned());

    // 获取卡牌信息
    let card = cards::get_card(&game.card_catalog, kind);

    // 验证目标
    assert!(cards::validate_card_target(card, target, tile), types::err_invalid_card_target());

    // 使用卡牌
    assert!(cards::use_player_card(&mut player.cards, kind), types::err_card_not_owned());

    // 应用卡牌效果
    apply_card_effect(game, player_addr, kind, target, tile, registry);

    // 发出使用卡牌事件
    events::emit_card_use_event(
        object::uid_to_inner(&game.id),
        player_addr,
        kind,
        target,
        tile
    );
}

// 掷骰并移动
public entry fun roll_and_step(
    game: &mut Game,
    cap: TurnCap,
    dir_intent: Option<u8>,
    registry: &MapRegistry,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 验证令牌
    validate_turn_cap(game, &cap);

    let player_addr = cap.player;

    // 检查是否被跳过
    if (should_skip_turn(game, player_addr)) {
        handle_skip_turn(game, player_addr);
        // 消耗令牌
        let TurnCap { id, game_id: _, player: _, turn: _ } = cap;
        object::delete(id);
        advance_turn(game);
        return
    };

    // 获取骰子点数
    let dice = get_dice_value(game, player_addr, clock);

    let player = table::borrow_mut(&mut game.players, player_addr);
    let from_pos = player.pos;

    // 计算目标位置和方向
    let template = map::get_template(registry, game.template_id);
    let use_adj = game.config.use_adj_traversal && map::get_use_adj_traversal(template);

    // 确定移动方向
    let direction = if (option::is_some(&dir_intent)) {
        let intent = *option::borrow(&dir_intent);
        // 检查是否允许逆时针
        if (!game.config.allow_reverse && intent == types::dir_ccw()) {
            types::dir_cw()  // 强制顺时针
        } else {
            intent
        }
    } else {
        // 使用玩家偏好方向
        if (!game.config.allow_reverse && player.dir_pref == types::dir_ccw()) {
            types::dir_cw()  // 强制顺时针
        } else {
            player.dir_pref
        }
    };

    let to_pos = calculate_move_target(template, from_pos, dice, player.dir_pref, dir_intent, use_adj);

    // 发出掷骰事件
    events::emit_roll_event(
        object::uid_to_inner(&game.id),
        player_addr,
        dice,
        from_pos,
        to_pos
    );

    // 执行逐步移动
    execute_step_movement(game, player_addr, from_pos, to_pos, dice, direction, registry);

    // 清理回合状态
    clean_turn_state(game, player_addr);

    // 消耗令牌
    let TurnCap { id, game_id: _, player: _, turn: _ } = cap;
    object::delete(id);

    // 结束回合
    advance_turn(game);
}

// 结束回合（手动）
public entry fun end_turn(
    game: &mut Game,
    cap: TurnCap,
    ctx: &mut TxContext
) {
    // 验证令牌
    validate_turn_cap(game, &cap);

    let player_addr = cap.player;

    // 清理回合状态
    clean_turn_state(game, player_addr);

    // 发出结束回合事件
    events::emit_end_turn_event(
        object::uid_to_inner(&game.id),
        player_addr,
        game.turn
    );

    // 消耗令牌
    let TurnCap { id, game_id: _, player: _, turn: _ } = cap;
    object::delete(id);

    // 推进回合
    advance_turn(game);
}

// 购买地产
public entry fun buy_property(
    game: &mut Game,
    cap: &TurnCap,
    registry: &MapRegistry,
    ctx: &mut TxContext
) {
    // 验证回合令牌
    validate_turn_cap(game, cap);

    let player_addr = cap.player;
    let player = table::borrow(&game.players, player_addr);
    let tile_id = player.pos;

    // 获取地块信息
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);

    // 验证地块类型
    assert!(map::tile_kind(tile) == types::tile_property(), types::err_not_property());

    // 验证地块无主
    assert!(!table::contains(&game.owner_of, tile_id), types::err_property_owned());

    // 验证价格和现金
    let price = map::tile_price(tile);
    assert!(price > 0, types::err_invalid_price());
    assert!(player.cash >= price, types::err_insufficient_cash());

    // 扣除现金
    {
        let player_mut = table::borrow_mut(&mut game.players, player_addr);
        player_mut.cash = player_mut.cash - price;
    };

    // 设置所有权和等级
    table::add(&mut game.owner_of, tile_id, player_addr);
    table::add(&mut game.level_of, tile_id, 1);

    // 更新owner_index
    if (!table::contains(&game.owner_index, player_addr)) {
        table::add(&mut game.owner_index, player_addr, vector::empty());
    };
    let owner_tiles = table::borrow_mut(&mut game.owner_index, player_addr);
    owner_tiles.push_back(tile_id);

    // 发送购买事件
    events::emit_buy_event(
        object::uid_to_inner(&game.id),
        player_addr,
        tile_id,
        price
    );

    // 发送现金变化事件
    events::emit_cash_change_event(
        object::uid_to_inner(&game.id),
        player_addr,
        price,
        true,  // 支出
        1,     // 购买地产
        tile_id
    );
}

// 升级地产
public entry fun upgrade_property(
    game: &mut Game,
    cap: &TurnCap,
    registry: &MapRegistry,
    ctx: &mut TxContext
) {
    // 验证回合令牌
    validate_turn_cap(game, cap);

    let player_addr = cap.player;
    let player = table::borrow(&game.players, player_addr);
    let tile_id = player.pos;

    // 获取地块信息
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);

    // 验证地块类型
    assert!(map::tile_kind(tile) == types::tile_property(), types::err_not_property());

    // 验证地块所有权
    assert!(table::contains(&game.owner_of, tile_id), types::err_property_not_owned());
    let owner = *table::borrow(&game.owner_of, tile_id);
    assert!(owner == player_addr, types::err_not_owner());

    // 验证等级
    let current_level = *table::borrow(&game.level_of, tile_id);
    assert!(current_level < types::level_4(), types::err_max_level());

    // 计算升级费用
    let price = map::tile_price(tile);
    let upgrade_cost = types::calculate_upgrade_cost(price, current_level);

    // 验证现金
    assert!(player.cash >= upgrade_cost, types::err_insufficient_cash());

    // 扣除现金
    {
        let player_mut = table::borrow_mut(&mut game.players, player_addr);
        player_mut.cash = player_mut.cash - upgrade_cost;
    };

    // 提升等级
    let level_mut = table::borrow_mut(&mut game.level_of, tile_id);
    *level_mut = current_level + 1;

    // 发送升级事件
    events::emit_upgrade_event(
        object::uid_to_inner(&game.id),
        player_addr,
        tile_id,
        current_level,       // from_lv
        current_level + 1,   // to_lv
        upgrade_cost
    );

    // 发送现金变化事件
    events::emit_cash_change_event(
        object::uid_to_inner(&game.id),
        player_addr,
        upgrade_cost,
        true,  // 支出
        2,     // 升级地产
        tile_id
    );
}

// ===== Internal Functions 内部函数 =====

// 创建玩家
fun create_player(owner: address, ctx: &mut TxContext): Player {
    Player {
        owner,
        pos: 0,
        cash: types::default_starting_cash(),
        in_prison_turns: 0,
        in_hospital_turns: 0,
        frozen_until_turn: option::none(),
        rent_free_until_turn: option::none(),
        bankrupt: false,
        cards: table::new(ctx),
        dir_pref: types::dir_auto(),
        roll_override: option::none()
    }
}

// 获取当前活跃玩家
fun get_active_player(game: &Game): address {
    *game.join_order.borrow((game.active_idx as u64))
}

// 验证回合令牌
fun validate_turn_cap(game: &Game, cap: &TurnCap) {
    assert!(cap.game_id == object::uid_to_inner(&game.id), types::err_pos_mismatch());
    assert!(cap.turn == game.turn, types::err_cap_expired());
    assert!(cap.player == get_active_player(game), types::err_not_active_player());
}

// 检查是否应该跳过回合
fun should_skip_turn(game: &Game, player_addr: address): bool {
    let player = table::borrow(&game.players, player_addr);
    player.in_prison_turns > 0 || player.in_hospital_turns > 0
}

// 处理跳过回合
fun handle_skip_turn(game: &mut Game, player_addr: address) {
    let player = table::borrow_mut(&mut game.players, player_addr);

    let reason = if (player.in_prison_turns > 0) {
        player.in_prison_turns = player.in_prison_turns - 1;
        types::skip_prison()
    } else {
        player.in_hospital_turns = player.in_hospital_turns - 1;
        types::skip_hospital()
    };

    events::emit_skip_turn_event(
        object::uid_to_inner(&game.id),
        player_addr,
        reason
    );
}

// 获取骰子点数
fun get_dice_value(game: &mut Game, player_addr: address, clock: &Clock): u8 {
    let player = table::borrow(&game.players, player_addr);

    if (option::is_some(&player.roll_override)) {
        *option::borrow(&player.roll_override)
    } else {
        rand_1_6(game, clock)
    }
}

// 简单随机数生成（生产环境应使用VRF或预言机）
fun rand_1_6(game: &mut Game, clock: &Clock): u8 {
    let seed = game.rng_nonce + clock::timestamp_ms(clock);
    game.rng_nonce = seed;
    ((seed % 6) + 1) as u8
}

// 计算移动目标（简化版）
fun calculate_move_target(
    template: &MapTemplate,
    from: u64,
    steps: u8,
    dir_pref: u8,
    dir_intent: Option<u8>,
    use_adj: bool
): u64 {
    // 如果使用邻接寻路，简单返回from（目标会在execute_step_movement中动态确定）
    if (use_adj) {
        return from
    };

    let mut pos = from;
    let mut i = 0;

    // 确定方向
    let dir = if (option::is_some(&dir_intent)) {
        *option::borrow(&dir_intent)
    } else {
        dir_pref
    };

    // 逐步移动
    while (i < steps) {
        pos = if (dir == types::dir_ccw() || dir == types::dir_forced_ccw()) {
            map::get_ccw_next(template, pos)
        } else {
            map::get_cw_next(template, pos)
        };
        i = i + 1;
    };

    pos
}

// 执行逐步移动（核心逻辑）
fun execute_step_movement(
    game: &mut Game,
    player_addr: address,
    from: u64,
    to: u64,
    dice: u8,
    direction: u8,  // 移动方向
    registry: &MapRegistry
) {
    let template = map::get_template(registry, game.template_id);

    // 检查冻结
    {
        let player = table::borrow(&game.players, player_addr);
        if (option::is_some(&player.frozen_until_turn) &&
            *option::borrow(&player.frozen_until_turn) >= game.turn) {
            // 冻结时不移动，触发原地停留事件
            handle_tile_stop(game, player_addr, from, registry);
            return
        };
    };

    let mut current_pos = from;
    let mut steps_left = dice;
    let use_adj = game.config.use_adj_traversal && map::get_use_adj_traversal(template);

    while (steps_left > 0) {
        // 计算下一格
        let next_pos = if (use_adj) {
            // 使用邻接寻路
            let next_opt = map::next_step_toward(template, current_pos, to, steps_left);
            if (option::is_some(&next_opt)) {
                *option::borrow(&next_opt)
            } else {
                // 寻路失败，使用默认方向
                if (direction == types::dir_ccw()) {
                    map::get_ccw_next(template, current_pos)
                } else {
                    map::get_cw_next(template, current_pos)
                }
            }
        } else {
            // 使用环路导航
            if (direction == types::dir_ccw()) {
                map::get_ccw_next(template, current_pos)
            } else {
                map::get_cw_next(template, current_pos)
            }
        };

        // 发送单步移动事件（如果配置允许）
        if (game.config.emit_move_step_events) {
            events::emit_move_step_event(
                object::uid_to_inner(&game.id),
                player_addr,
                current_pos,
                next_pos,
                steps_left - 1,
                direction
            );
        };

        // 检查下一格的NPC/机关
        if (table::contains(&game.npc_on, next_pos)) {
            let npc = *table::borrow(&game.npc_on, next_pos);

            if (types::is_hospital_npc(npc.kind)) {
                // 炸弹或狗狗 - 送医院
                {
                    let player = table::borrow_mut(&mut game.players, player_addr);
                    player.pos = next_pos;
                };
                send_to_hospital(game, player_addr, registry);

                // 移除NPC（如果是消耗性的）
                if (npc.consumable) {
                    table::remove(&mut game.npc_on, next_pos);
                    game.current_npc_count = game.current_npc_count - 1;
                };

                events::emit_bomb_or_dog_hit_event(
                    object::uid_to_inner(&game.id),
                    player_addr,
                    next_pos,
                    npc.kind
                );
                return  // 终止移动
            } else if (npc.kind == types::npc_barrier()) {
                // 路障 - 停止移动
                {
                    let player = table::borrow_mut(&mut game.players, player_addr);
                    player.pos = next_pos;
                };

                // 移除路障（如果配置为消耗）
                if (game.config.barrier_consumed_on_stop) {
                    table::remove(&mut game.npc_on, next_pos);
                    game.current_npc_count = game.current_npc_count - 1;
                };

                events::emit_barrier_stop_event(
                    object::uid_to_inner(&game.id),
                    player_addr,
                    next_pos
                );

                // 触发停留事件
                handle_tile_stop(game, player_addr, next_pos, registry);
                return  // 终止移动
            }
        };

        // 正常移动到下一格
        let prev_pos = current_pos;
        current_pos = next_pos;
        {
            let player = table::borrow_mut(&mut game.players, player_addr);
            player.pos = current_pos;
        };
        steps_left = steps_left - 1;

        // 发出移动事件
        events::emit_move_event(
            object::uid_to_inner(&game.id),
            player_addr,
            prev_pos,
            current_pos
        );

        // 如果不是最后一步，检查是否触发经过事件
        if (steps_left > 0) {
            handle_tile_pass(game, player_addr, current_pos, registry);
        }
    };

    // 最后一步 - 触发停留事件
    handle_tile_stop(game, player_addr, current_pos, registry);
}

// 处理经过地块
fun handle_tile_pass(
    game: &mut Game,
    player_addr: address,
    tile_id: u64,
    registry: &MapRegistry
) {
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);

    // 只有卡片格和彩票格在经过时触发
    if (types::is_passable_trigger(tile_kind)) {
        if (tile_kind == types::tile_card() && game.config.trigger_card_on_pass) {
            // 抽卡
            let (card_kind, count) = cards::draw_card_on_pass(game.rng_nonce);
            let player = table::borrow_mut(&mut game.players, player_addr);
            cards::give_card_to_player(&mut player.cards, card_kind, count);

            events::emit_card_gain_event(
                object::uid_to_inner(&game.id),
                player_addr,
                card_kind,
                count
            );
        } else if (tile_kind == types::tile_lottery() && game.config.trigger_lottery_on_pass) {
            // 彩票逻辑（简化）
            // TODO: 实现彩票系统
        };

        events::emit_pass_tile_event(
            object::uid_to_inner(&game.id),
            player_addr,
            tile_id,
            tile_kind
        );
    }
}

// 处理停留地块
fun handle_tile_stop(
    game: &mut Game,
    player_addr: address,
    tile_id: u64,
    registry: &MapRegistry
) {
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);

    events::emit_stop_tile_event(
        object::uid_to_inner(&game.id),
        player_addr,
        tile_id,
        tile_kind
    );

    if (tile_kind == types::tile_property()) {
        handle_property_stop(game, player_addr, tile_id, tile);
    } else if (tile_kind == types::tile_hospital()) {
        handle_hospital_stop(game, player_addr, tile_id);
    } else if (tile_kind == types::tile_prison()) {
        handle_prison_stop(game, player_addr, tile_id);
    } else if (tile_kind == types::tile_card()) {
        // 停留时也抽卡
        let (card_kind, count) = cards::draw_card_on_stop(game.rng_nonce);
        let player = table::borrow_mut(&mut game.players, player_addr);
        cards::give_card_to_player(&mut player.cards, card_kind, count);

        events::emit_card_gain_event(
            object::uid_to_inner(&game.id),
            player_addr,
            card_kind,
            count
        );
    } else if (tile_kind == types::tile_chance()) {
        // TODO: 实现机会事件
    } else if (tile_kind == types::tile_bonus()) {
        // 奖励
        let bonus = map::tile_special(tile);
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.cash = player.cash + bonus;

        events::emit_cash_change_event(
            object::uid_to_inner(&game.id),
            player_addr,
            bonus,
            false,  // 收入
            4,  // 奖励
            tile_id
        );
    } else if (tile_kind == types::tile_fee()) {
        // 罚款
        let fee = map::tile_special(tile);
        let player = table::borrow_mut(&mut game.players, player_addr);
        if (player.cash >= fee) {
            player.cash = player.cash - fee;
        } else {
            player.cash = 0;
            // TODO: 处理破产
        };

        events::emit_cash_change_event(
            object::uid_to_inner(&game.id),
            player_addr,
            fee,
            true,  // 支出
            5,  // 罚款
            tile_id
        );
    }
    // 其他地块类型...
}

// 处理地产停留
fun handle_property_stop(
    game: &mut Game,
    player_addr: address,
    tile_id: u64,
    tile: &map::TileStatic
) {
    if (!table::contains(&game.owner_of, tile_id)) {
        // 无主地产 - 可以购买
        // TODO: 实现购买逻辑（需要用户确认）
    } else {
        let owner = *table::borrow(&game.owner_of, tile_id);
        if (owner != player_addr) {
            // 需要支付过路费
            let level = *table::borrow(&game.level_of, tile_id);
            let toll = types::calculate_toll(map::tile_base_toll(tile), level);

            let player = table::borrow_mut(&mut game.players, player_addr);

            // 检查免租
            if (option::is_some(&player.rent_free_until_turn) &&
                *option::borrow(&player.rent_free_until_turn) >= game.turn) {
                // 免租
                return
            };

            // 支付过路费
            let actual_toll = if (player.cash >= toll) {
                player.cash = player.cash - toll;
                toll
            } else {
                // 现金不足 - 破产
                let paid = player.cash;
                player.cash = 0;
                paid
            };

            // 给房主加钱
            let owner_player = table::borrow_mut(&mut game.players, owner);
            owner_player.cash = owner_player.cash + actual_toll;

            // 如果支付不足，处理破产
            if (actual_toll < toll) {
                handle_bankruptcy(game, player_addr, option::some(owner));
            };

            events::emit_toll_event(
                object::uid_to_inner(&game.id),
                player_addr,
                owner,
                tile_id,
                level,
                actual_toll
            );
        }
    }
}

// 处理医院停留
fun handle_hospital_stop(game: &mut Game, player_addr: address, tile_id: u64) {
    let player = table::borrow_mut(&mut game.players, player_addr);
    player.in_hospital_turns = types::default_hospital_turns();

    events::emit_enter_hospital_event(
        object::uid_to_inner(&game.id),
        player_addr,
        tile_id,
        types::default_hospital_turns()
    );
}

// 处理监狱停留
fun handle_prison_stop(game: &mut Game, player_addr: address, tile_id: u64) {
    let player = table::borrow_mut(&mut game.players, player_addr);
    player.in_prison_turns = types::default_prison_turns();

    events::emit_enter_prison_event(
        object::uid_to_inner(&game.id),
        player_addr,
        tile_id,
        types::default_prison_turns()
    );
}

// 送医院
fun send_to_hospital(game: &mut Game, player_addr: address, registry: &MapRegistry) {
    let template = map::get_template(registry, game.template_id);
    let hospital_ids = map::get_hospital_ids(template);

    if (!hospital_ids.is_empty()) {
        let hospital_tile = *hospital_ids.borrow(0);
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.pos = hospital_tile;
        player.in_hospital_turns = types::default_hospital_turns();

        events::emit_send_to_hospital_event(
            object::uid_to_inner(&game.id),
            player_addr,
            hospital_tile
        );
    }
}

// 处理破产
fun handle_bankruptcy(
    game: &mut Game,
    player_addr: address,
    creditor: Option<address>
) {
    // 设置破产标志
    {
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.bankrupt = true;
    };

    // 释放所有地产
    if (table::contains(&game.owner_index, player_addr)) {
        let owned_tiles = *table::borrow(&game.owner_index, player_addr);
        let mut i = 0;
        while (i < owned_tiles.length()) {
            let tile_id = *owned_tiles.borrow(i);

            // 移除所有权
            if (table::contains(&game.owner_of, tile_id)) {
                table::remove(&mut game.owner_of, tile_id);
            };

            // 重置等级
            if (table::contains(&game.level_of, tile_id)) {
                *table::borrow_mut(&mut game.level_of, tile_id) = 0;
            };

            i = i + 1;
        };

        // 清空owner_index
        let owner_tiles_mut = table::borrow_mut(&mut game.owner_index, player_addr);
        *owner_tiles_mut = vector::empty();
    };

    // 发送破产事件
    events::emit_bankrupt_event(
        object::uid_to_inner(&game.id),
        player_addr,
        0,  // debt暂时设为0
        creditor
    );

    // 检查游戏是否结束（只剩一个非破产玩家）
    let mut non_bankrupt_count = 0;
    let mut winner = option::none<address>();
    let mut i = 0;
    while (i < game.join_order.length()) {
        let addr = *game.join_order.borrow(i);
        let player = table::borrow(&game.players, addr);
        if (!player.bankrupt) {
            non_bankrupt_count = non_bankrupt_count + 1;
            winner = option::some(addr);
        };
        i = i + 1;
    };

    // 如果只剩一个非破产玩家，游戏结束
    if (non_bankrupt_count == 1) {
        game.status = types::status_ended();
        game.winner = winner;  // 设置赢家
        events::emit_game_ended_event(
            object::uid_to_inner(&game.id),
            winner,
            game.turn,
            2  // 原因：破产胜利
        );
    }
}

// 应用卡牌效果
fun apply_card_effect(
    game: &mut Game,
    player_addr: address,
    kind: u16,
    target: Option<address>,
    tile: Option<u64>,
    registry: &MapRegistry
) {
    if (kind == types::card_move_ctrl()) {
        // 遥控骰
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.roll_override = option::some(3);  // 设置为3点
    } else if (kind == types::card_barrier() || kind == types::card_bomb()) {
        // 放置机关
        if (option::is_some(&tile)) {
            let tile_id = *option::borrow(&tile);
            let npc_kind = if (kind == types::card_barrier()) {
                types::npc_barrier()
            } else {
                types::npc_bomb()
            };

            // 检查是否可以放置
            assert!(!table::contains(&game.npc_on, tile_id), types::err_tile_occupied_by_npc());
            assert!(game.current_npc_count < game.config.npc_cap, types::err_npc_cap_reached());

            // 放置NPC
            let npc = NpcInst {
                kind: npc_kind,
                expires_at_turn: option::none(),
                consumable: true
            };
            table::add(&mut game.npc_on, tile_id, npc);
            game.current_npc_count = game.current_npc_count + 1;

            events::emit_npc_spawn_event(
                object::uid_to_inner(&game.id),
                tile_id,
                npc_kind,
                option::some(player_addr)
            );
        }
    } else if (kind == types::card_rent_free()) {
        // 免租
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.rent_free_until_turn = option::some(game.turn);

        events::emit_rent_free_applied_event(
            object::uid_to_inner(&game.id),
            player_addr,
            game.turn
        );
    } else if (kind == types::card_freeze()) {
        // 冻结
        if (option::is_some(&target)) {
            let target_addr = *option::borrow(&target);
            let target_player = table::borrow_mut(&mut game.players, target_addr);
            target_player.frozen_until_turn = option::some(game.turn);

            events::emit_player_frozen_event(
                object::uid_to_inner(&game.id),
                target_addr,
                player_addr,
                game.turn
            );
        }
    } else if (kind == types::card_dog()) {
        // 放置狗狗NPC
        if (option::is_some(&tile)) {
            let tile_id = *option::borrow(&tile);

            // 检查是否可以放置
            assert!(!table::contains(&game.npc_on, tile_id), types::err_tile_occupied_by_npc());
            assert!(game.current_npc_count < game.config.npc_cap, types::err_npc_cap_reached());

            // 放置狗狗NPC
            let npc = NpcInst {
                kind: types::npc_dog(),
                expires_at_turn: option::none(),
                consumable: true  // 碰到狗狗后会消失
            };
            table::add(&mut game.npc_on, tile_id, npc);
            game.current_npc_count = game.current_npc_count + 1;

            events::emit_npc_spawn_event(
                object::uid_to_inner(&game.id),
                tile_id,
                types::npc_dog(),
                option::some(player_addr)
            );
        }
    } else if (kind == types::card_cleanse()) {
        // 清除NPC
        if (option::is_some(&tile)) {
            let tile_id = *option::borrow(&tile);

            // 检查是否有NPC在该地块
            if (table::contains(&game.npc_on, tile_id)) {
                // 移除NPC
                let npc = table::remove(&mut game.npc_on, tile_id);
                game.current_npc_count = game.current_npc_count - 1;

                events::emit_npc_remove_event(
                    object::uid_to_inner(&game.id),
                    tile_id,
                    npc.kind,
                    option::some(player_addr)
                );
            }
        }
    }
}

// 清理回合状态
fun clean_turn_state(game: &mut Game, player_addr: address) {
    let player = table::borrow_mut(&mut game.players, player_addr);

    // 清理当回合buff
    player.roll_override = option::none();

    // 清理过期的buff
    if (option::is_some(&player.rent_free_until_turn) &&
        *option::borrow(&player.rent_free_until_turn) <= game.turn) {
        player.rent_free_until_turn = option::none();
    };

    if (option::is_some(&player.frozen_until_turn) &&
        *option::borrow(&player.frozen_until_turn) <= game.turn) {
        player.frozen_until_turn = option::none();
    };
}

// 推进回合
fun advance_turn(game: &mut Game) {
    let player_count = game.join_order.length() as u8;
    let mut attempts = 0;

    // 寻找下一个非破产玩家
    loop {
        // 更新活跃玩家索引
        game.active_idx = ((game.active_idx + 1) % player_count);
        attempts = attempts + 1;

        // 获取当前玩家
        let current_addr = *game.join_order.borrow(game.active_idx as u64);
        let current_player = table::borrow(&game.players, current_addr);

        // 如果玩家未破产，使用该玩家
        if (!current_player.bankrupt) {
            break
        };

        // 如果已经检查了所有玩家，说明全部破产（不应该发生）
        if (attempts >= player_count) {
            break
        };
    };

    // 如果回到第一个玩家，增加回合数
    if (game.active_idx == 0) {
        game.turn = game.turn + 1;

        // 检查是否达到最大回合数
        if (option::is_some(&game.config.max_turns)) {
            let max_turns = *option::borrow(&game.config.max_turns);
            if (game.turn > max_turns) {
                game.status = types::status_ended();
                events::emit_game_ended_event(
                    object::uid_to_inner(&game.id),
                    option::none(),
                    game.turn,
                    1  // 达到最大回合数
                );
            }
        }
    };

    // 重置阶段
    game.phase = types::phase_roll();
}

// ===== Public Query Functions 公共查询函数 =====

public fun get_game_status(game: &Game): u8 { game.status }
public fun get_current_turn(game: &Game): u64 { game.turn }
public fun get_active_player_index(game: &Game): u8 { game.active_idx }
public fun get_player_count(game: &Game): u64 { game.join_order.length() }
public fun get_template_id(game: &Game): u64 { game.template_id }

public fun get_player_position(game: &Game, player: address): u64 {
    table::borrow(&game.players, player).pos
}

public fun get_player_cash(game: &Game, player: address): u64 {
    table::borrow(&game.players, player).cash
}

public fun is_tile_owned(game: &Game, tile_id: u64): bool {
    table::contains(&game.owner_of, tile_id)
}

public fun get_tile_owner(game: &Game, tile_id: u64): address {
    assert!(table::contains(&game.owner_of, tile_id), types::err_no_such_tile());
    *table::borrow(&game.owner_of, tile_id)
}

public fun get_tile_level(game: &Game, tile_id: u64): u8 {
    if (table::contains(&game.level_of, tile_id)) {
        *table::borrow(&game.level_of, tile_id)
    } else {
        0
    }
}

public fun is_player_bankrupt(game: &Game, player: address): bool {
    if (table::contains(&game.players, player)) {
        table::borrow(&game.players, player).bankrupt
    } else {
        false
    }
}

public fun get_player_card_count(game: &Game, player: address, kind: u16): u64 {
    if (table::contains(&game.players, player)) {
        let player_data = table::borrow(&game.players, player);
        cards::get_player_card_count(&player_data.cards, kind)
    } else {
        0
    }
}

// ===== Test Helper Functions 测试辅助函数 =====

#[test_only]
public fun test_set_player_position(game: &mut Game, player: address, position: u64) {
    let player_data = table::borrow_mut(&mut game.players, player);
    player_data.pos = position;
}

#[test_only]
public fun test_set_player_cash(game: &mut Game, player: address, cash: u64) {
    let player_data = table::borrow_mut(&mut game.players, player);
    player_data.cash = cash;
}

#[test_only]
public fun test_trigger_bankruptcy(
    game: &mut Game,
    player: address,
    debt: u64,
    creditor: option::Option<address>
) {
    handle_bankruptcy(game, player, creditor);
}

#[test_only]
public fun get_winner(game: &Game): option::Option<address> {
    game.winner
}

#[test_only]
public fun get_status(game: &Game): u8 {
    game.status
}

#[test_only]
public fun get_turn(game: &Game): u64 {
    game.turn
}

#[test_only]
public fun current_turn_player(game: &Game): address {
    assert!(game.status == types::status_active(), types::err_already_started());
    *game.join_order.borrow((game.active_idx as u64))
}

#[test_only]
public fun get_property_owner(game: &Game, tile_id: u64): option::Option<address> {
    if (table::contains(&game.owner_of, tile_id)) {
        option::some(*table::borrow(&game.owner_of, tile_id))
    } else {
        option::none()
    }
}

#[test_only]
public fun get_property_level(game: &Game, tile_id: u64): u8 {
    if (table::contains(&game.level_of, tile_id)) {
        *table::borrow(&game.level_of, tile_id)
    } else {
        types::level_0()
    }
}