module tycoon::game;

// use std::option::{Self, Option};

use sui::table::{Self, Table};
use sui::clock::{Self, Clock};
use sui::coin;

use tycoon::types;
use tycoon::map::{Self, MapTemplate, MapRegistry};
use tycoon::cards::{Self, CardRegistry};
use tycoon::events;

// ===== Errors =====
// 玩家相关错误
const ENotActivePlayer: u64 = 1001;
const EAlreadyRolled: u64 = 1002;  // 已经掷过骰
const ENotRolledYet: u64 = 1005;   // 还未掷骰
const EWrongGame: u64 = 1003;
const EGameNotActive: u64 = 1004;

// 游戏状态相关错误
const EJoinFull: u64 = 6001;
const EAlreadyStarted: u64 = 6002;
const EGameEnded: u64 = 6003;
const ENotEnoughPlayers: u64 = 6004;
const EAlreadyJoined: u64 = 6005;
const EInvalidDecision: u64 = 6006;
const EPendingDecision: u64 = 6007;

// 经济相关错误
const EInsufficientFunds: u64 = 7001;
const EPropertyAlreadyOwned: u64 = 7002;
const ENotPropertyOwner: u64 = 7003;
const EMaxLevelReached: u64 = 7004;

// 地块相关错误（game.move中使用的部分）
const EPosMismatch: u64 = 2003;
const ENotProperty: u64 = 2004;
const EPropertyOwned: u64 = 2005;
const EPropertyNotOwned: u64 = 2006;
const ENotOwner: u64 = 2007;
const EInvalidPrice: u64 = 2008;
const EMaxLevel: u64 = 2009;
const EInsufficientCash: u64 = 2010;

// 卡牌相关错误（game.move中使用的部分）
const ECardNotOwned: u64 = 5001;
const EInvalidCardTarget: u64 = 5003;
const ECardNotFound: u64 = 5004;

// 移动相关错误
const EInvalidMove: u64 = 4001;

// NPC相关错误
const ENpcCapReached: u64 = 8001;

// Map相关错误（game.move中使用的部分）
const ETemplateNotFound: u64 = 3001;
const ETileOccupiedByNpc: u64 = 2001;
const ENoSuchTile: u64 = 2002;

// ===== Config 游戏配置 =====
public struct Config has store, copy, drop {
    trigger_card_on_pass: bool,
    trigger_lottery_on_pass: bool,
    npc_cap: u16,
    max_players: u8,
    max_rounds: Option<u64>,
    bomb_to_hospital: bool,
    dog_to_hospital: bool,
    barrier_consumed_on_stop: bool,
    // 移动相关配置
    allow_reverse: bool,              // 是否允许逆时针移动
    use_adj_traversal: bool           // 是否使用邻接寻路
}

// ===== BuffEntry buff条目 =====
//
// 功能说明：
// 统一的Buff存储结构，用于管理玩家的各种临时状态效果
// 采用独占终止时间设计，便于统一的过期检查和清理
//
// Buff激活逻辑使用独占语义（exclusive semantics）：
// - Buff激活条件：current_round < first_inactive_round
// - Buff过期条件：current_round >= first_inactive_round
// - 示例：
//   - first_inactive_round = round + 1 → 仅当前轮激活
//   - first_inactive_round = round + 2 → 当前轮和下一轮激活
//   - first_inactive_round = round + 3 → 当前轮和接下来两轮激活
//
// 字段说明：
// - kind: Buff类型标识，对应types模块中的BUFF_*常量
// - first_inactive_round: 首个未激活的轮次（独占边界）
// - value: 附加数据，意义取决于Buff类型
//   * BUFF_MOVE_CTRL: 存储指定的骰子点数
//   * BUFF_RENT_FREE: 未使用（可扩展为免租比例）
//   * BUFF_FROZEN: 未使用（可扩展为冻结来源）
public struct BuffEntry has store, copy, drop {
    kind: u8,                  // Buff类型 (rent_free, frozen, move_ctrl等)
    first_inactive_round: u64, // 首个未激活轮次（独占）
    value: u64                 // 数值载荷 (如move_ctrl的骰子值)
}

// ===== Player 玩家状态 =====
//
// 功能说明：
// 存储单个玩家的完整游戏状态，包括位置、资产、卡牌、Buff等
// 作为Game对象中players表的值存储
//
// 字段说明：
// - owner: 玩家的区块链地址，用于身份验证
// - pos: 当前所在地块的ID
// - cash: 现金余额
// - in_prison_turns: 剩余监狱回合数（0表示不在监狱）
// - in_hospital_turns: 剩余医院回合数（0表示不在医院）
// - bankrupt: 破产标志，破产后不参与游戏但保留在players表中
// - cards: 手牌集合，键为卡牌种类，值为数量
// - dir_pref: 移动方向偏好（顺时针/逆时针/自动选择）
// - buffs: 当前激活的所有Buff列表
public struct Player has store {
    owner: address,
    pos: u64,  // tile_id
    cash: u64,
    in_prison_turns: u8,
    in_hospital_turns: u8,
    bankrupt: bool,
    cards: Table<u16 /* CardKind */, u64 /* count */>,
    dir_pref: u8,  // DirMode
    buffs: vector<BuffEntry>  // 统一的buff存储
}

// ===== NpcInst NPC实例 =====
//
// 功能说明：
// 表示地图上的NPC实体，如路障、炸弹、狗等
// NPC可以影响玩家的移动和地块效果
//
// 字段说明：
// - kind: NPC类型（BARRIER/BOMB/DOG等）
// - expires_at_global_turn: 过期的全局回合号
//   * Some(turn): 在指定全局回合自动移除（global_turn = round * player_count + turn）
//   * None: 永久存在，需要手动清除
// - consumable: 是否可被消耗
//   * true: 触发后自动移除（如炸弹）
//   * false: 触发后保留（如路障）
public struct NpcInst has store, copy, drop {
    kind: u8,  // NpcKind
    expires_at_global_turn: Option<u64>,
    consumable: bool
}

// ===== Seat 座位（入座凭证） =====
//
// 功能说明：
// 玩家加入游戏后获得的凭证对象
// 代表玩家在特定游戏中的参与资格
// 用于退出游戏时验证身份
//
// 字段说明：
// - id: 唯一对象ID
// - game_id: 所属游戏的ID
// - player: 持有者地址
public struct Seat has key {
    id: UID,
    game_id: ID,
    player: address
}

// TurnCap 已被移除，使用 Seat 进行身份验证

// ===== Game 游戏对象 =====
//
// 功能说明：
// 核心游戏状态对象，包含一局游戏的所有动态数据
// 作为共享对象存储在链上，所有玩家通过它进行交互
//
// 状态管理：
// - status: 游戏生命周期状态
//   * 0 (READY): 等待玩家加入
//   * 1 (ACTIVE): 游戏进行中
//   * 2 (ENDED): 游戏已结束
//
// 玩家管理：
// - players: 地址到玩家状态的映射
// - join_order: 玩家加入顺序，决定回合顺序
// - active_idx: 当前活跃玩家在join_order中的索引
//
// 回合系统：
// - round: 当前轮次，从0开始（所有玩家各行动一次为一轮）
// - turn: 当前轮内回合，从0开始（0到player_count-1）
// - has_rolled: 是否已经掷骰（限制卡牌使用时机）
//
// 地产系统：
// - owner_of: 地块所有权映射
// - level_of: 地块等级映射（0-4级）
// - owner_index: 反向索引，快速查找玩家的所有地产
//
// NPC系统：
// - npc_on: 地块上的NPC实例
// - current_npc_count: 当前NPC总数，用于限制
//
// 其他组件：
// - config: 游戏配置参数
// - rng_nonce: 随机数种子
// - winner: 游戏结束时的获胜者
public struct Game has key, store {
    id: UID,
    status: u8,  // 0=ready, 1=active, 2=ended
    created_at_ms: u64,
    template_id: u64,
    template_digest: vector<u8>,

    players: Table<address, Player>,
    join_order: vector<address>,

    round: u64,        // 轮次计数器（所有玩家各行动一次）
    turn: u64,         // 轮内回合（0到player_count-1）
    active_idx: u8,
    has_rolled: bool,  // 是否已经掷骰


    owner_of: Table<u64 /* tile_id */, address>,
    level_of: Table<u64, u8>,
    npc_on: Table<u64, NpcInst>,
    owner_index: Table<address, vector<u64>>,

    config: Config,
    rng_nonce: u64,

    // 额外状态
    current_npc_count: u16,
    winner: Option<address>,//todo 不需要吧？

    // 待决策状态
    pending_decision: u8,           // 待决策类型
    decision_tile: u64,             // 相关的地块ID
    decision_amount: u64            // 相关金额（如租金）
}

// ===== Entry Functions 入口函数 =====

// 创建游戏
public entry fun create_game(
    registry: &MapRegistry,
    template_id: u64,
    ctx: &mut TxContext
) {
    // 验证模板存在
    assert!(map::has_template(registry, template_id), ETemplateNotFound);
    let template = map::get_template(registry, template_id);

    // 创建默认配置
    let config = Config {//todo config应该作为参数传进来，有些数值应该是需要客户端传进来
        trigger_card_on_pass: true,
        trigger_lottery_on_pass: true,
        npc_cap: types::default_npc_cap(),
        max_players: types::default_max_players(),
        max_rounds: option::some(types::default_max_rounds()),
        bomb_to_hospital: true,
        dog_to_hospital: true,
        barrier_consumed_on_stop: true,
        allow_reverse: true,              // 默认允许双向移动
        use_adj_traversal: false          // 默认使用环路寻路
    };

    // 创建游戏对象
    let game_id = object::new(ctx);
    let game_id_copy = object::uid_to_inner(&game_id);

    let mut game = Game {
        id: game_id,
        status: types::status_ready(),
        created_at_ms: 0,  // 将在start时设置 //todo, 这样的话变量名不太对呀
        template_id,
        template_digest: map::get_template_digest(template),//这个字段无意义 todo
        players: table::new(ctx),
        join_order: vector::empty(),
        round: 0,
        turn: 0,
        active_idx: 0,
        has_rolled: false,
        owner_of: table::new(ctx),
        level_of: table::new(ctx),
        npc_on: table::new(ctx),
        owner_index: table::new(ctx),
        config,
        rng_nonce: 0,
        current_npc_count: 0,
        winner: option::none(),
        pending_decision: types::decision_none(),
        decision_tile: 0,
        decision_amount: 0
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
    assert!(game.status == types::status_ready(), EAlreadyStarted);
    assert!(game.join_order.length() < (game.config.max_players as u64), EJoinFull);
    assert!(!table::contains(&game.players, player_addr), EAlreadyJoined);

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
    assert!(game.status == types::status_ready(), EAlreadyStarted);
    assert!(game.join_order.length() >= 2, ENotEnoughPlayers);

    // 设置游戏状态
    game.status = types::status_active();
    game.created_at_ms = clock::timestamp_ms(clock);
    // round和turn已在创建时初始化为0
    game.active_idx = 0;
    game.has_rolled = false;

    // 初始化随机数种子
    game.rng_nonce = game.created_at_ms;

    let starting_player = *game.join_order.borrow(0);

    // 发出开始事件
    events::emit_game_started_event(//todo 传回去的参数太少
        object::uid_to_inner(&game.id),
        game.join_order.length() as u8,
        starting_player
    );
}

// mint_turncap 已被移除，直接使用 Seat 验证身份

// 使用卡牌
public entry fun use_card(
    game: &mut Game,
    seat: &Seat,
    kind: u16,
    target: Option<address>,
    tile: Option<u64>,
    map_registry: &MapRegistry,
    card_registry: &cards::CardRegistry,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证还未掷骰（卡牌只能在掷骰前使用）
    assert!(!game.has_rolled, EAlreadyRolled);

    let player_addr = seat.player;
    let player = table::borrow_mut(&mut game.players, player_addr);

    // 验证玩家有这张卡
    assert!(cards::player_has_card(&player.cards, kind), ECardNotOwned);

    // 获取卡牌信息
    let card = cards::get_card(card_registry, kind);

    // 验证目标 //todo 比如均富卡，target是所有的Player
    assert!(cards::validate_card_target(card, target, tile), EInvalidCardTarget);

    // 使用卡牌
    assert!(cards::use_player_card(&mut player.cards, kind), ECardNotOwned);

    // 创建事件收集器
    let mut npc_changes = vector[];
    let mut buff_changes = vector[];
    let mut cash_changes = vector[];

    // 应用卡牌效果并收集事件数据
    apply_card_effect_with_collectors(
        game,
        player_addr,
        kind,
        target,
        tile,
        &mut npc_changes,
        &mut buff_changes,
        &mut cash_changes,
        map_registry
    );

    // 发射聚合事件
    events::emit_use_card_action_event(
        object::uid_to_inner(&game.id),
        player_addr,
        get_global_turn(game),
        kind,
        target,
        tile,
        npc_changes,
        buff_changes,
        cash_changes
    );
}

// 掷骰并移动
public entry fun roll_and_step(
    game: &mut Game,
    seat: &Seat,
    dir_intent: Option<u8>,
    registry: &MapRegistry,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 验证并自动处理跳过
    if (validate_and_auto_skip(game, seat)) {
        return
    };

    // 标记已掷骰
    game.has_rolled = true;

    let player_addr = seat.player;

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

    // 创建事件收集器
    let mut steps = vector[];
    let mut cash_changes = vector[];

    // 执行逐步移动并收集事件数据
    execute_step_movement_with_collectors(
        game,
        player_addr,
        from_pos,
        to_pos,
        dice,
        direction,
        &mut steps,
        &mut cash_changes,
        registry
    );

    // 获取最终位置
    let end_player = table::borrow(&game.players, player_addr);
    let end_pos = end_player.pos;

    // 发射聚合事件
    events::emit_roll_and_step_action_event(
        object::uid_to_inner(&game.id),
        player_addr,
        get_global_turn(game),
        dice,
        direction,
        from_pos,
        steps,
        cash_changes,
        end_pos
    );

    // 清理回合状态
    clean_turn_state(game, player_addr);

    // 结束回合
    advance_turn(game);
}

// 决定租金支付方式（使用免租卡或支付现金）
public entry fun decide_rent_payment(
    game: &mut Game,
    seat: &Seat,
    use_rent_free: bool,
    registry: &MapRegistry,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证待决策状态
    assert!(game.pending_decision == types::decision_pay_rent(), EInvalidDecision);

    let player_addr = seat.player;
    let tile_id = game.decision_tile;
    let toll = game.decision_amount;

    // 获取地产所有者
    assert!(table::contains(&game.owner_of, tile_id), EPropertyNotOwned);
    let owner = *table::borrow(&game.owner_of, tile_id);

    if (use_rent_free) {
        // 使用免租卡
        let player = table::borrow(&game.players, player_addr);
        assert!(cards::player_has_card(&player.cards, types::card_rent_free()), ECardNotFound);

        // 消耗免租卡
        let player_mut = table::borrow_mut(&mut game.players, player_addr);
        let used = cards::use_player_card(&mut player_mut.cards, types::card_rent_free());
        assert!(used, ECardNotFound);

        // TODO: 发出免租事件
    } else {
        // 支付现金
        let player = table::borrow_mut(&mut game.players, player_addr);
        assert!(player.cash >= toll, EInsufficientCash);
        player.cash = player.cash - toll;

        // 给所有者加钱
        let owner_player = table::borrow_mut(&mut game.players, owner);
        owner_player.cash = owner_player.cash + toll;

        // TODO: 发出支付租金事件
    };

    // 清除待决策状态
    game.pending_decision = types::decision_none();
    game.decision_tile = 0;
    game.decision_amount = 0;
}

// 跳过地产决策（不购买或不升级）
public entry fun skip_property_decision(
    game: &mut Game,
    seat: &Seat,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证有待决策
    assert!(
        game.pending_decision == types::decision_buy_property() ||
        game.pending_decision == types::decision_upgrade_property(),
        EInvalidDecision
    );

    // 清除待决策状态
    game.pending_decision = types::decision_none();
    game.decision_tile = 0;
    game.decision_amount = 0;
}

// 结束回合（手动）
public entry fun end_turn(
    game: &mut Game,
    seat: &Seat,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证没有待决策
    assert!(game.pending_decision == types::decision_none(), EPendingDecision);

    let player_addr = seat.player;

    // 清理回合状态
    clean_turn_state(game, player_addr);

    // 发出结束回合事件
    events::emit_end_turn_event(
        object::uid_to_inner(&game.id),
        player_addr,
        get_global_turn(game)
    );

    // 推进回合
    advance_turn(game);
}

// 购买地产
public entry fun buy_property(
    game: &mut Game,
    seat: &Seat,
    registry: &MapRegistry,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证待决策状态
    assert!(game.pending_decision == types::decision_buy_property(), EInvalidDecision);

    let player_addr = seat.player;
    let player = table::borrow(&game.players, player_addr);
    let tile_id = player.pos;

    // 验证地块位置匹配
    assert!(tile_id == game.decision_tile, EPosMismatch);

    // 获取地块信息
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);

    // 验证地块类型
    assert!(map::tile_kind(tile) == types::tile_property(), ENotProperty);

    // 验证地块无主
    assert!(!table::contains(&game.owner_of, tile_id), EPropertyOwned);

    // 验证价格和现金
    let price = map::tile_price(tile);
    assert!(price > 0, EInvalidPrice);
    assert!(player.cash >= price, EInsufficientCash);

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

    // 清除待决策状态
    game.pending_decision = types::decision_none();
    game.decision_tile = 0;
    game.decision_amount = 0;

    // 发送购买事件

    // 发送现金变化事件
}

// 升级地产
public entry fun upgrade_property(
    game: &mut Game,
    seat: &Seat,
    registry: &MapRegistry,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证待决策状态
    assert!(game.pending_decision == types::decision_upgrade_property(), EInvalidDecision);

    let player_addr = seat.player;
    let player = table::borrow(&game.players, player_addr);
    let tile_id = player.pos;

    // 验证地块位置匹配
    assert!(tile_id == game.decision_tile, EPosMismatch);

    // 获取地块信息
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);

    // 验证地块类型
    assert!(map::tile_kind(tile) == types::tile_property(), ENotProperty);

    // 验证地块所有权
    assert!(table::contains(&game.owner_of, tile_id), EPropertyNotOwned);
    let owner = *table::borrow(&game.owner_of, tile_id);
    assert!(owner == player_addr, ENotOwner);

    // 验证等级
    let current_level = *table::borrow(&game.level_of, tile_id);
    assert!(current_level < types::level_4(), EMaxLevel);

    // 计算升级费用
    let price = map::tile_price(tile);
    let upgrade_cost = calculate_upgrade_cost(price, current_level);

    // 验证现金
    assert!(player.cash >= upgrade_cost, EInsufficientCash);

    // 扣除现金
    {
        let player_mut = table::borrow_mut(&mut game.players, player_addr);
        player_mut.cash = player_mut.cash - upgrade_cost;
    };

    // 提升等级
    let level_mut = table::borrow_mut(&mut game.level_of, tile_id);
    *level_mut = current_level + 1;

    // 清除待决策状态
    game.pending_decision = types::decision_none();
    game.decision_tile = 0;
    game.decision_amount = 0;

    // 发送升级事件

    // 发送现金变化事件
}

// ===== Internal Functions 内部函数 =====

// 创建玩家
fun create_player(owner: address, ctx: &mut TxContext): Player {
    Player {
        owner,
        pos: 0,
        cash: types::default_starting_cash(),
        buffs: vector::empty(),  // 初始化buffs
        in_prison_turns: 0,
        in_hospital_turns: 0,
        bankrupt: false,
        cards: table::new(ctx),
        dir_pref: types::dir_auto()
    }
}

// 获取当前活跃玩家
fun get_active_player(game: &Game): address {
    *game.join_order.borrow((game.active_idx as u64))
}

// 验证座位凭证和当前回合
fun validate_seat_and_turn(game: &Game, seat: &Seat) {
    // 验证游戏ID匹配
    assert!(seat.game_id == object::uid_to_inner(&game.id), EWrongGame);

    // 验证是当前活跃玩家
    let active_player = get_active_player(game);
    assert!(seat.player == active_player, ENotActivePlayer);

    // 验证游戏状态
    assert!(game.status == types::status_active(), EGameNotActive);
}

// 验证并自动处理跳过
fun validate_and_auto_skip(game: &mut Game, seat: &Seat): bool {
    validate_seat_and_turn(game, seat);

    // 如果需要跳过，自动处理
    if (should_skip_turn(game, seat.player)) {
        handle_skip_turn(game, seat.player);
        advance_turn(game);
        return true  // 表示已跳过
    };
    false  // 表示未跳过
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

    // 使用buff系统检查遥控骰子
    if (is_buff_active(player, types::buff_move_ctrl(), game.round)) {
        let value = get_buff_value(player, types::buff_move_ctrl(), game.round);
        return (value as u8)
    };

    rand_1_6(game, clock)
}

// 简单随机数生成（生产环境应使用VRF或预言机）
fun rand_1_6(game: &mut Game, clock: &Clock): u8 {
    let seed = game.rng_nonce + clock::timestamp_ms(clock);
    game.rng_nonce = seed;
    ((seed % 6) + 1) as u8
}

// 计算移动目标
// 注意：当use_adj=true时，返回from作为占位符，实际路径将通过BFS动态确定
// 这是因为邻接寻路需要在执行时根据实际可达性来决定路径
// 计算移动的目标位置
//
// 该函数根据不同的寻路模式计算玩家移动后的目标位置：
// 1. 邻接寻路模式（use_adj=true）：
//    - 返回起始位置，实际路径由execute_step_movement动态计算
//    - 适用于复杂的非环形地图
// 2. 环路导航模式（use_adj=false）：
//    - 直接计算目标位置，按照固定的顺/逆时针方向移动
//    - 适用于简单的环形地图（如传统大富翁）
//
// 参数说明：
// - from: 起始位置
// - steps: 移动步数（通常为骰子点数）
// - dir_pref: 玩家的方向偏好（自动选择方向）
// - dir_intent: 玩家的明确方向意图（如使用方向控制卡）
// - use_adj: 是否使用邻接寻路
fun calculate_move_target(
    template: &MapTemplate,
    from: u64,
    steps: u8,
    dir_pref: u8,
    dir_intent: Option<u8>,
    use_adj: bool
): u64 {
    // 邻接寻路模式：延迟计算，这里只返回起始位置
    // 实际目标位置会在execute_step_movement中通过BFS算法动态计算
    if (use_adj) {
        return from
    };

    // 环路导航模式：直接计算目标位置
    let mut pos = from;
    let mut i = 0;

    // 确定移动方向（优先使用玩家意图，否则使用偏好）
    let dir = if (option::is_some(&dir_intent)) {
        *option::borrow(&dir_intent)
    } else {
        dir_pref
    };

    // 按照确定的方向逐步移动
    while (i < steps) {
        pos = if (dir == types::dir_ccw() || dir == types::dir_forced_ccw()) {
            map::get_ccw_next(template, pos)  // 逆时针移动
        } else {
            map::get_cw_next(template, pos)   // 顺时针移动
        };
        i = i + 1;
    };

    pos
}

// 执行玩家的逐步移动，处理路径上的所有事件
//
// 算法流程：
// 1. 首先检查玩家是否被冻结（冻结状态下原地停留，不移动）
// 2. 根据地图配置选择寻路方式：
//    - use_adj_traversal=true: 使用BFS邻接寻路（支持复杂地图）
//    - use_adj_traversal=false: 使用环路导航（简单环形地图）
// 3. 逐格移动，每一步都要：
//    - 检查目标格子上的NPC（炸弹、狗、路障）
//    - 处理经过格子的触发事件（抽卡、彩票等）
//    - 到达最终格子时触发停留事件
// 4. 所有事件收集到steps和cash_changes中，供上层聚合到最终事件
//
// 参数说明：
// - from/to: 起始和目标位置（to仅在邻接寻路时使用）
// - dice: 骰子点数，决定移动步数
// - direction: 移动方向（顺时针/逆时针）
// - steps: 收集每一步的效果事件
// - cash_changes: 收集现金变化事件
fun execute_step_movement_with_collectors(
    game: &mut Game,
    player_addr: address,
    from: u64,
    to: u64,
    dice: u8,
    direction: u8,
    steps: &mut vector<events::StepEffect>,
    cash_changes: &mut vector<events::CashDelta>,
    registry: &MapRegistry
) {
    let template = map::get_template(registry, game.template_id);

    // 步骤1: 检查玩家是否处于冻结状态
    {
        let player = table::borrow(&game.players, player_addr);
        // 使用buff系统检查冻结状态（冻结buff激活时玩家无法移动）
        let is_frozen = is_buff_active(player, types::buff_frozen(), game.round);

        if (is_frozen) {
            // 冻结时不移动，但仍需触发原地停留事件（如收租等）
            let stop_effect = handle_tile_stop_with_collector(
                game,
                player_addr,
                from,
                cash_changes,
                registry
            );

            // 记录步骤（停留在原地）
            vector::push_back(steps, events::make_step_effect(
                0,  // step_index
                from,
                from,
                0,  // remaining_steps
                vector[],  // pass_draws
                option::none(),  // npc_event
                option::some(stop_effect)
            ));
            return
        };
    };

    // 步骤2: 初始化移动状态
    let mut current_pos = from;
    let mut steps_left = dice;
    let use_adj = game.config.use_adj_traversal && map::get_use_adj_traversal(template);
    let mut step_index: u8 = 0;

    // 步骤3: 逐步移动主循环
    while (steps_left > 0) {
        // 计算下一格位置（根据寻路模式选择算法）
        let next_pos = if (use_adj) {
            // BFS邻接寻路模式：支持任意连通图结构
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

        let mut pass_draws = vector[];
        let mut npc_event_opt = option::none<events::NpcStepEvent>();
        let mut stop_effect_opt = option::none<events::StopEffect>();

        // 检查下一格的NPC/机关
        if (table::contains(&game.npc_on, next_pos)) {
            let npc = *table::borrow(&game.npc_on, next_pos);

            if (is_hospital_npc(npc.kind)) {
                // 炸弹或狗狗 - 送医院
                {
                    let player = table::borrow_mut(&mut game.players, player_addr);
                    player.pos = next_pos;
                };

                // 找医院
                let hospital_tile = find_nearest_hospital(game, next_pos, registry);
                send_to_hospital_internal(game, player_addr, hospital_tile, registry);

                // 移除NPC（如果是消耗性的）
                if (npc.consumable) {
                    table::remove(&mut game.npc_on, next_pos);
                    game.current_npc_count = game.current_npc_count - 1;
                };

                // 创建NPC事件
                npc_event_opt = option::some(events::make_npc_step_event(
                    next_pos,
                    npc.kind,
                    events::npc_result_send_hospital(),
                    npc.consumable,
                    option::some(hospital_tile)
                ));

                // 记录步骤并结束
                vector::push_back(steps, events::make_step_effect(
                    step_index,
                    current_pos,
                    next_pos,
                    steps_left - 1,
                    pass_draws,
                    npc_event_opt,
                    stop_effect_opt
                ));
                return
            } else if (npc.kind == types::npc_barrier()) {
                // 路障 - 停止移动
                {
                    let player = table::borrow_mut(&mut game.players, player_addr);
                    player.pos = next_pos;
                };

                // 移除路障
                if (npc.consumable) {
                    table::remove(&mut game.npc_on, next_pos);
                    game.current_npc_count = game.current_npc_count - 1;
                };

                // 创建NPC事件
                npc_event_opt = option::some(events::make_npc_step_event(
                    next_pos,
                    npc.kind,
                    events::npc_result_barrier_stop(),
                    npc.consumable,
                    option::none()
                ));

                // 处理停留效果
                stop_effect_opt = option::some(handle_tile_stop_with_collector(
                    game,
                    player_addr,
                    next_pos,
                    cash_changes,
                    registry
                ));

                // 记录步骤并结束
                vector::push_back(steps, events::make_step_effect(
                    step_index,
                    current_pos,
                    next_pos,
                    steps_left - 1,
                    pass_draws,
                    npc_event_opt,
                    stop_effect_opt
                ));
                return
            }
        };

        // 移动到下一格
        {
            let player = table::borrow_mut(&mut game.players, player_addr);
            player.pos = next_pos;
        };

        // 如果不是最后一步，处理经过效果
        if (steps_left > 1) {
            let tile = map::get_tile(template, next_pos);
            let tile_kind = map::tile_kind(tile);

            // 处理经过卡牌格
            if (tile_kind == types::tile_card()) {
                // 经过抽1张卡
                let (card_kind, _) = cards::draw_card_on_pass(game.rng_nonce);
                let player = table::borrow_mut(&mut game.players, player_addr);
                cards::give_card_to_player(&mut player.cards, card_kind, 1);

                // 记录卡牌获取
                vector::push_back(&mut pass_draws, events::make_card_draw_item(
                    next_pos,
                    card_kind,
                    1,
                    true  // is_pass
                ));
            };

            // 记录步骤
            vector::push_back(steps, events::make_step_effect(
                step_index,
                current_pos,
                next_pos,
                steps_left - 1,
                pass_draws,
                npc_event_opt,
                option::none()  // 经过时没有停留效果
            ));
        } else {
            // 最后一步，处理停留效果
            stop_effect_opt = option::some(handle_tile_stop_with_collector(
                game,
                player_addr,
                next_pos,
                cash_changes,
                registry
            ));

            // 记录最后的步骤
            vector::push_back(steps, events::make_step_effect(
                step_index,
                current_pos,
                next_pos,
                0,  // remaining_steps
                pass_draws,
                npc_event_opt,
                stop_effect_opt
            ));
        };

        current_pos = next_pos;
        steps_left = steps_left - 1;
        step_index = step_index + 1;
    }
}

// 执行逐步移动（核心逻辑）

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
    if (is_passable_trigger(tile_kind)) {
        if (tile_kind == types::tile_card() && game.config.trigger_card_on_pass) {
            // 抽卡
            let (card_kind, count) = cards::draw_card_on_pass(game.rng_nonce);
            let player = table::borrow_mut(&mut game.players, player_addr);
            cards::give_card_to_player(&mut player.cards, card_kind, count);
        } else if (tile_kind == types::tile_lottery() && game.config.trigger_lottery_on_pass) {
            // 彩票逻辑（简化）
            // TODO: 实现彩票系统
        };
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
    } else if (tile_kind == types::tile_chance()) {
        // TODO: 实现机会事件
    } else if (tile_kind == types::tile_bonus()) {
        // 奖励
        let bonus = map::tile_special(tile);
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.cash = player.cash + bonus;
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
    }
    // 其他地块类型...
}

// 处理停留地块（带事件收集器）
fun handle_tile_stop_with_collector(
    game: &mut Game,
    player_addr: address,
    tile_id: u64,
    cash_changes: &mut vector<events::CashDelta>,
    registry: &MapRegistry
): events::StopEffect {
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);

    let mut stop_type = events::stop_none();
    let mut amount = 0;
    let mut owner_opt = option::none<address>();
    let mut level_opt = option::none<u8>();
    let mut turns_opt = option::none<u8>();
    let mut card_gains = vector[];

    if (tile_kind == types::tile_property()) {
        if (!table::contains(&game.owner_of, tile_id)) {
            // 无主地产 - 设置待决策状态
            stop_type = events::stop_property_unowned();
            game.pending_decision = types::decision_buy_property();
            game.decision_tile = tile_id;
            game.decision_amount = map::tile_price(tile);
        } else {
            let owner = *table::borrow(&game.owner_of, tile_id);
            if (owner != player_addr) {
                let level = *table::borrow(&game.level_of, tile_id);
                let toll = calculate_toll(map::tile_base_toll(tile), level);

                // 检查免租情况
                let player = table::borrow(&game.players, player_addr);
                let has_rent_free_buff = is_buff_active(player, types::buff_rent_free(), game.round);
                let has_rent_free_card = cards::player_has_card(&player.cards, types::card_rent_free());

                if (has_rent_free_buff) {
                    // 有免租buff - 直接免租，无需决策
                    stop_type = events::stop_property_no_rent();
                    owner_opt = option::some(owner);
                    level_opt = option::some(level);
                    amount = 0;
                } else if (has_rent_free_card) {
                    // 没有buff但有免租卡 - 设置待决策状态
                    stop_type = events::stop_property_toll();
                    game.pending_decision = types::decision_pay_rent();
                    game.decision_tile = tile_id;
                    game.decision_amount = toll;
                    owner_opt = option::some(owner);
                    level_opt = option::some(level);
                    amount = toll;
                } else {
                    // 既没有buff也没有卡 - 直接扣费
                    let (actual_payment, should_bankrupt) = {
                        let player_mut = table::borrow_mut(&mut game.players, player_addr);
                        // 支付过路费
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
                        // 给所有者加钱
                        let owner_player = table::borrow_mut(&mut game.players, owner);
                        owner_player.cash = owner_player.cash + actual_payment;

                        // 记录现金变动 - 支付方
                        vector::push_back(cash_changes, events::make_cash_delta(
                            player_addr,
                            true,  // is_debit
                            actual_payment,
                            1,  // reason: toll
                            tile_id
                        ));

                        // 记录现金变动 - 收款方
                        vector::push_back(cash_changes, events::make_cash_delta(
                            owner,
                            false,  // is_debit (income)
                            actual_payment,
                            1,  // reason: toll
                            tile_id
                        ));

                        stop_type = events::stop_property_toll();
                        amount = actual_payment;
                    };

                    // 检查破产
                    if (should_bankrupt) {
                        handle_bankruptcy(game, player_addr, option::some(owner));
                    };

                    owner_opt = option::some(owner);
                    level_opt = option::some(level);
                }
            } else {
                // 自己的地产 - 检查是否可以升级
                let level = *table::borrow(&game.level_of, tile_id);
                if (level < types::level_4()) {
                    // 可以升级 - 设置待决策状态
                    stop_type = events::stop_none();  // 自己的地产，无特殊效果
                    game.pending_decision = types::decision_upgrade_property();
                    game.decision_tile = tile_id;
                    let upgrade_cost = calculate_upgrade_cost(map::tile_price(tile), level);
                    game.decision_amount = upgrade_cost;
                } else {
                    // 已达最高级
                    stop_type = events::stop_none();  // 自己的地产，无特殊效果
                };
                owner_opt = option::some(owner);
                level_opt = option::some(level);
            }
        }
    } else if (tile_kind == types::tile_hospital()) {
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.in_hospital_turns = types::default_hospital_turns();
        stop_type = events::stop_hospital();
        turns_opt = option::some(types::default_hospital_turns());
    } else if (tile_kind == types::tile_prison()) {
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.in_prison_turns = types::default_prison_turns();
        stop_type = events::stop_prison();
        turns_opt = option::some(types::default_prison_turns());
    } else if (tile_kind == types::tile_card()) {
        // 停留时抽卡
        let (card_kind, count) = cards::draw_card_on_stop(game.rng_nonce);
        let player = table::borrow_mut(&mut game.players, player_addr);
        cards::give_card_to_player(&mut player.cards, card_kind, count);

        // 记录卡牌获取
        vector::push_back(&mut card_gains, events::make_card_draw_item(
            tile_id,
            card_kind,
            count,
            false  // not pass, but stop
        ));
        stop_type = events::stop_card_stop();
    } else if (tile_kind == types::tile_bonus()) {
        // 奖励
        let bonus = map::tile_special(tile);
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.cash = player.cash + bonus;

        // 记录现金变动
        vector::push_back(cash_changes, events::make_cash_delta(
            player_addr,
            false,  // is_debit (income)
            bonus,
            4,  // reason: bonus
            tile_id
        ));

        stop_type = events::stop_bonus();
        amount = bonus;
    } else if (tile_kind == types::tile_fee()) {
        // 罚款
        let fee = map::tile_special(tile);
        let player = table::borrow_mut(&mut game.players, player_addr);
        let actual_payment = if (player.cash >= fee) {
            player.cash = player.cash - fee;
            fee
        } else {
            let payment = player.cash;
            player.cash = 0;
            payment
        };

        if (actual_payment > 0) {
            // 记录现金变动
            vector::push_back(cash_changes, events::make_cash_delta(
                player_addr,
                true,  // is_debit
                actual_payment,
                5,  // reason: fee
                tile_id
            ));
        };

        stop_type = events::stop_fee();
        amount = actual_payment;

        // 检查破产
        if (player.cash == 0 && fee > actual_payment) {
            handle_bankruptcy(game, player_addr, option::none());
        }
    };

    // 返回停留效果
    events::make_stop_effect(
        tile_id,
        tile_kind,
        stop_type,
        amount,
        owner_opt,
        level_opt,
        turns_opt,
        card_gains
    )
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
            let toll = calculate_toll(map::tile_base_toll(tile), level);

            let player = table::borrow_mut(&mut game.players, player_addr);

            // 检查免租
            let has_rent_free = is_buff_active(player, types::buff_rent_free(), game.round);

            if (has_rent_free) {
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
        }
    }
}

// 处理医院停留
fun handle_hospital_stop(game: &mut Game, player_addr: address, tile_id: u64) {
    let player = table::borrow_mut(&mut game.players, player_addr);
    player.in_hospital_turns = types::default_hospital_turns();
}

// 处理监狱停留
fun handle_prison_stop(game: &mut Game, player_addr: address, tile_id: u64) {
    let player = table::borrow_mut(&mut game.players, player_addr);
    player.in_prison_turns = types::default_prison_turns();
}

// 找最近的医院
fun find_nearest_hospital(game: &Game, current_pos: u64, registry: &MapRegistry): u64 {
    let template = map::get_template(registry, game.template_id);
    let hospital_ids = map::get_hospital_ids(template);

    if (hospital_ids.is_empty()) {
        return current_pos  // 没有医院，原地不动
    };

    // 简化处理：返回第一个医院
    *hospital_ids.borrow(0)
}

// 送医院（内部函数）
fun send_to_hospital_internal(game: &mut Game, player_addr: address, hospital_tile: u64, registry: &MapRegistry) {
    let player = table::borrow_mut(&mut game.players, player_addr);
    player.pos = hospital_tile;
    player.in_hospital_turns = types::default_hospital_turns();
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
    }
}

// 处理破产
// 处理玩家破产的完整流程
//
// 破产处理步骤：
// 1. 标记玩家破产状态，防止其继续参与游戏
// 2. 释放该玩家拥有的所有地产：
//    - 从owner_of表中移除所有权记录
//    - 重置地产等级为0（恢复初始状态）
//    - 清空owner_index中的拥有列表
// 3. 发送破产事件通知
// 4. 检查游戏结束条件：
//    - 如果只剩一个非破产玩家，该玩家获胜
//    - 游戏状态设置为结束，记录获胜者
//
// 参数说明：
// - player_addr: 破产玩家的地址
// - creditor: 导致破产的债权人（如收租的地产拥有者）
fun handle_bankruptcy(
    game: &mut Game,
    player_addr: address,
    creditor: Option<address>
) {
    // 步骤1: 设置破产标志，标记玩家已出局
    {
        let player = table::borrow_mut(&mut game.players, player_addr);
        player.bankrupt = true;
    };

    // 步骤2: 释放玩家拥有的所有地产
    if (table::contains(&game.owner_index, player_addr)) {
        let owned_tiles = *table::borrow(&game.owner_index, player_addr);
        let mut i = 0;
        while (i < owned_tiles.length()) {
            let tile_id = *owned_tiles.borrow(i);

            // 从全局所有权表中移除该地产的所有权记录
            if (table::contains(&game.owner_of, tile_id)) {
                table::remove(&mut game.owner_of, tile_id);
            };

            // 重置地产等级为0（变回无主地产）
            if (table::contains(&game.level_of, tile_id)) {
                *table::borrow_mut(&mut game.level_of, tile_id) = 0;
            };

            i = i + 1;
        };

        // 清空玩家的地产拥有列表
        let owner_tiles_mut = table::borrow_mut(&mut game.owner_index, player_addr);
        *owner_tiles_mut = vector::empty();
    };

    // 步骤3: 发送破产事件，记录破产信息
    events::emit_bankrupt_event(
        object::uid_to_inner(&game.id),
        player_addr,
        0,  // debt暂时设为0（未来可记录实际欠款金额）
        creditor
    );

    // 步骤4: 检查游戏是否应该结束
    // 统计仍在游戏中（非破产）的玩家数量
    let mut non_bankrupt_count = 0;
    let mut winner = option::none<address>();
    let mut i = 0;
    while (i < game.join_order.length()) {
        let addr = *game.join_order.borrow(i);
        let player = table::borrow(&game.players, addr);
        if (!player.bankrupt) {
            non_bankrupt_count = non_bankrupt_count + 1;
            winner = option::some(addr);  // 记录最后一个非破产玩家
        };
        i = i + 1;
    };

    // 如果只剩一个玩家，宣布游戏结束并确定获胜者
    if (non_bankrupt_count == 1) {
        game.status = types::status_ended();
        game.winner = winner;  // 设置最后的赢家
        events::emit_game_ended_event(
            object::uid_to_inner(&game.id),
            winner,
            game.turn,
            2  // 结束原因代码：2表示破产胜利
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
        // 使用buff系统
        apply_buff(player, types::buff_move_ctrl(), game.round + 1, 3);
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
            assert!(!table::contains(&game.npc_on, tile_id), ETileOccupiedByNpc);
            assert!(game.current_npc_count < game.config.npc_cap, ENpcCapReached);

            // 放置NPC
            let npc = NpcInst {
                kind: npc_kind,
                expires_at_global_turn: option::none(),
                consumable: true
            };
            table::add(&mut game.npc_on, tile_id, npc);
            game.current_npc_count = game.current_npc_count + 1;
        }
    } else if (kind == types::card_rent_free()) {
        // 免租
        let player = table::borrow_mut(&mut game.players, player_addr);
        // 使用buff系统
        apply_buff(player, types::buff_rent_free(), game.round + 2, 0);
    } else if (kind == types::card_freeze()) {
        // 冻结
        if (option::is_some(&target)) {
            let target_addr = *option::borrow(&target);
            let target_player = table::borrow_mut(&mut game.players, target_addr);
            // 使用buff系统
            apply_buff(target_player, types::buff_frozen(), game.round + 2, 0);
        }
    } else if (kind == types::card_dog()) {
        // 放置狗狗NPC
        if (option::is_some(&tile)) {
            let tile_id = *option::borrow(&tile);

            // 检查是否可以放置
            assert!(!table::contains(&game.npc_on, tile_id), ETileOccupiedByNpc);
            assert!(game.current_npc_count < game.config.npc_cap, ENpcCapReached);

            // 放置狗狗NPC
            let npc = NpcInst {
                kind: types::npc_dog(),
                expires_at_global_turn: option::none(),
                consumable: true  // 碰到狗狗后会消失
            };
            table::add(&mut game.npc_on, tile_id, npc);
            game.current_npc_count = game.current_npc_count + 1;
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
            }
        }
    }
}

// 应用卡牌效果（带事件收集器）
fun apply_card_effect_with_collectors(
    game: &mut Game,
    player_addr: address,
    kind: u16,
    target: Option<address>,
    tile: Option<u64>,
    npc_changes: &mut vector<events::NpcChangeItem>,
    buff_changes: &mut vector<events::BuffChangeItem>,
    cash_changes: &mut vector<events::CashDelta>,
    registry: &MapRegistry
) {
    if (kind == types::card_move_ctrl()) {
        // 遥控骰
        let player = table::borrow_mut(&mut game.players, player_addr);//todo borrow_mut 寻找太多次了呀, 我觉得直接用vector装player好
        // 使用buff系统
        apply_buff(player, types::buff_move_ctrl(), game.round + 1, 3);//todo 遥控骰值在使用卡片的时候，会从客户端传过来选择好的1-6的值

        // 记录buff变更
        vector::push_back(buff_changes, events::make_buff_change(
            types::buff_move_ctrl(),
            player_addr,
            option::some(get_global_turn(game) + 3)
        ));
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
            assert!(!table::contains(&game.npc_on, tile_id), ETileOccupiedByNpc);
            assert!(game.current_npc_count < game.config.npc_cap, ENpcCapReached);

            // 放置NPC
            let npc = NpcInst {
                kind: npc_kind,
                expires_at_global_turn: option::none(),
                consumable: true
            };
            table::add(&mut game.npc_on, tile_id, npc);
            game.current_npc_count = game.current_npc_count + 1;

            // 记录NPC变更
            vector::push_back(npc_changes, events::make_npc_change(
                tile_id,
                npc_kind,
                events::npc_action_spawn(),
                true
            ));
        }
    } else if (kind == types::card_rent_free()) {
        // 免租
        let player = table::borrow_mut(&mut game.players, player_addr);
        // 使用buff系统
        apply_buff(player, types::buff_rent_free(), game.round + 2, 0);

        // 记录buff变更
        vector::push_back(buff_changes, events::make_buff_change(
            types::buff_rent_free(),
            player_addr,
            option::some(get_global_turn(game) + 6)
        ));
    } else if (kind == types::card_freeze()) {
        // 冻结
        if (option::is_some(&target)) {
            let target_addr = *option::borrow(&target);
            let target_player = table::borrow_mut(&mut game.players, target_addr);
            // 使用buff系统
            apply_buff(target_player, types::buff_frozen(), game.round + 2, 0);

            // 记录buff变更
            vector::push_back(buff_changes, events::make_buff_change(
                types::buff_frozen(),
                target_addr,
                option::some(get_global_turn(game) + 6)
            ));
        }
    } else if (kind == types::card_dog()) {
        // 放置狗狗NPC
        if (option::is_some(&tile)) {
            let tile_id = *option::borrow(&tile);

            // 检查是否可以放置
            assert!(!table::contains(&game.npc_on, tile_id), ETileOccupiedByNpc);
            assert!(game.current_npc_count < game.config.npc_cap, ENpcCapReached);

            // 放置狗狗NPC
            let npc = NpcInst {
                kind: types::npc_dog(),
                expires_at_global_turn: option::none(),
                consumable: true  // 碰到狗狗后会消失
            };
            table::add(&mut game.npc_on, tile_id, npc);
            game.current_npc_count = game.current_npc_count + 1;

            // 记录NPC变更
            vector::push_back(npc_changes, events::make_npc_change(
                tile_id,
                types::npc_dog(),
                events::npc_action_spawn(),
                true
            ));
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

                // 记录NPC变更
                vector::push_back(npc_changes, events::make_npc_change(
                    tile_id,
                    npc.kind,
                    events::npc_action_remove(),
                    npc.consumable
                ));
            }
        }
    }
}

// ===== Buff管理API函数 =====

// 应用buff到玩家
// first_inactive_turn: 首个未激活回合（独占）
// 为玩家应用一个buff效果
//
// Buff系统采用独占语义（exclusive semantics）：
// - first_inactive_turn表示buff失效的第一个回合
// - 当current_turn < first_inactive_turn时，buff处于激活状态
// - 当current_turn >= first_inactive_turn时，buff已过期
//
// 例如：
// - 当前回合=10，first_inactive_turn=11 → buff仅在第10回合激活
// - 当前回合=10，first_inactive_turn=13 → buff在第10,11,12回合激活
//
// 注意：同类型的buff会互相覆盖（同一时间只能有一个同类型buff）
fun apply_buff(player: &mut Player, kind: u8, first_inactive_round: u64, value: u64) {
    // 步骤1: 清除同类型的现有buff（确保同类型buff唯一）
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs.borrow(i);
        if (buff.kind == kind) {
            vector::remove(&mut player.buffs, i);
            break  // 找到并移除后即可退出
        };
        i = i + 1;
    };

    // 步骤2: 添加新的buff
    let buff = BuffEntry { kind, first_inactive_round, value };
    player.buffs.push_back(buff);
}

// 清除所有已过期的buffs
//
// 遍历玩家的所有buff，移除满足以下条件的buff：
// - current_round >= first_inactive_round（buff已经失效）
//
// 注意：使用倒序遍历或不递增索引的方式处理vector::remove
fun clear_expired_buffs(player: &mut Player, current_round: u64) {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs.borrow(i);
        if (buff.first_inactive_round <= current_round) {
            // buff已过期，移除它
            vector::remove(&mut player.buffs, i);
            // 重要：不增加i，因为vector::remove会将后续元素前移
            // 下次循环仍然检查索引i（现在是原来的i+1位置的元素）
        } else {
            // buff仍有效，检查下一个
            i = i + 1;
        }
    }
}

// 检查玩家是否有某种类型的buff处于激活状态
//
// Buff激活判断：current_round < first_inactive_round
// 返回true表示buff正在生效，false表示没有该buff或buff已过期
fun is_buff_active(player: &Player, kind: u8, current_round: u64): bool {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs.borrow(i);
        // 找到对应类型且未过期的buff
        if (buff.kind == kind && buff.first_inactive_round > current_round) {
            return true
        };
        i = i + 1;
    };
    false  // 没有找到激活的buff
}

// 获取激活buff的数值载荷
//
// 某些buff需要携带额外数据，如：
// - 移动控制buff：value存储指定的骰子点数
// - 免租buff：value可存储免租的比例或次数
//
// 返回激活buff的value值，如果buff不存在或已过期返回0
fun get_buff_value(player: &Player, kind: u8, current_round: u64): u64 {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs.borrow(i);
        // 找到对应类型且未过期的buff，返回其value
        if (buff.kind == kind && buff.first_inactive_round > current_round) {
            return buff.value
        };
        i = i + 1;
    };
    0  // 没有找到激活的buff，返回默认值0
}

// 清理回合状态
fun clean_turn_state(game: &mut Game, player_addr: address) {
    let player = table::borrow_mut(&mut game.players, player_addr);

    // 清理过期的buff
    clear_expired_buffs(player, game.round);
}

// 推进游戏到下一个玩家的回合
//
// 回合切换逻辑：
// 1. 寻找下一个未破产的玩家
//    - 使用循环索引遍历玩家列表
//    - 跳过所有已破产的玩家
// 2. 更新回合数（仅在回到第一个玩家时）
//    - 这意味着所有玩家都行动过一次
// 3. 检查游戏结束条件
//    - 是否达到最大回合数限制
// 4. 重置游戏阶段为掷骰子阶段
//
// 推进到下一个玩家
fun advance_turn(game: &mut Game) {
    let player_count = game.join_order.length() as u8;
    let mut attempts = 0;  // 安全计数器

    // 步骤1: 寻找下一个非破产玩家
    loop {
        // 循环递增玩家索引（使用取模实现循环）
        game.active_idx = ((game.active_idx + 1) % player_count);
        attempts = attempts + 1;

        // 获取当前索引指向的玩家
        let current_addr = *game.join_order.borrow(game.active_idx as u64);
        let current_player = table::borrow(&game.players, current_addr);

        // 如果找到未破产的玩家，停止寻找
        if (!current_player.bankrupt) {
            break
        };

        // 安全检查：如果检查了所有玩家都是破产的
        // 这种情况理论上不应该发生（游戏应该在只剩一人时结束）
        if (attempts >= player_count) {
            break
        };
    };

    // 步骤2: 更新turn（轮内回合）
    game.turn = (game.active_idx as u64);

    // 步骤3: 如果回到第一个玩家（索引0），说明完成了一轮
    if (game.active_idx == 0) {
        game.round = game.round + 1;  // 增加轮次

        // 轮次结束时的刷新操作
        refresh_at_round_end(game);

        // 步骤4: 检查是否达到最大轮数限制
        if (option::is_some(&game.config.max_rounds)) {
            let max_rounds = *option::borrow(&game.config.max_rounds);
            // 使用 >= 判断：当 round >= max_rounds 时结束（完成 max_rounds 轮后结束）
            if (game.round >= max_rounds) {
                // 达到轮次上限，游戏结束
                game.status = types::status_ended();
                events::emit_game_ended_event(
                    object::uid_to_inner(&game.id),
                    option::none(),  // TODO: 实现按资产确定赢家
                    get_global_turn(game),
                    1  // 结束原因：1表示达到最大轮数
                );
            }
        }
    };

    // 步骤5: 重置游戏阶段为掷骰子
    game.has_rolled = false;
}

// 轮次结束时的刷新操作
fun refresh_at_round_end(game: &mut Game) {
    // 清理过期的NPC
    clean_expired_npcs(game);

    // TODO: 刷新地产指数
    // refresh_property_index(game);

    // TODO: 其他刷新逻辑
    // refresh_special_tiles(game);

    // 发射轮次结束事件
    events::emit_round_ended_event(
        object::uid_to_inner(&game.id),
        game.round - 1,  // 当前轮次已经递增，所以减1表示刚结束的轮次
        get_global_turn(game)
    );
}

// 清理过期的NPC
fun clean_expired_npcs(_game: &mut Game) {
    // 暂时简化实现：由于sui::table没有keys函数，需要更复杂的实现
    // TODO: 使用LinkedTable或其他方式跟踪所有NPC位置
    // 暂时保留空实现，在其他地方处理NPC过期
}

// 获取全局回合号
public fun get_global_turn(game: &Game): u64 {
    game.round * (game.join_order.length() as u64) + game.turn
}

// 获取当前轮次
public fun get_round(game: &Game): u64 { game.round }

// 获取轮内回合
public fun get_turn_in_round(game: &Game): u64 { game.turn }

// ===== Public Query Functions 公共查询函数 =====

public fun get_game_status(game: &Game): u8 { game.status }
public fun get_current_turn(game: &Game): u64 { get_global_turn(game) }
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
    assert!(table::contains(&game.owner_of, tile_id), ENoSuchTile);
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
    get_global_turn(game)
}

#[test_only]
public fun current_turn_player(game: &Game): address {
    assert!(game.status == types::status_active(), EAlreadyStarted);
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

// 额外的测试辅助函数
#[test_only]
public fun create_game_with_config(
    name: vector<u8>,
    template_id: u64,
    _config: Option<Config>,
    registry: &MapRegistry,
    ctx: &mut TxContext
): ID {
    // 忽略name和config参数，使用默认值创建游戏
    create_game(registry, template_id, ctx);

    // 获取刚创建的游戏ID
    // 注意：实际实现中需要返回正确的ID
    object::id_from_address(@0x1234)
}

#[test_only]
public fun join_with_coin(
    game: &mut Game,
    _coin: coin::Coin<sui::sui::SUI>,
    ctx: &mut TxContext
) {
    // 忽略coin参数，直接加入游戏
    join(game, ctx)
}

#[test_only]
public fun get_players(game: &Game): &vector<address> {
    &game.join_order
}

#[test_only]
public fun test_give_card(
    game: &mut Game,
    player: address,
    card_kind: u16,
    count: u64
) {
    let player_data = table::borrow_mut(&mut game.players, player);
    cards::give_card_to_player(&mut player_data.cards, card_kind, count);
}

#[test_only]
public fun test_set_player_in_hospital(
    game: &mut Game,
    player: address,
    turns: u8
) {
    let player_data = table::borrow_mut(&mut game.players, player);
    player_data.in_hospital_turns = turns;
}

#[test_only]
public fun is_player_in_hospital(
    game: &Game,
    player: address
): bool {
    let player_data = table::borrow(&game.players, player);
    player_data.in_hospital_turns > 0
}



#[test_only]
public fun handle_tile_stop_effect(
    game: &mut Game,
    player: address,
    tile_id: u64,
    registry: &MapRegistry
) {
    // 处理停留效果
    let template = map::get_template(registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);

    if (tile_kind == types::tile_property()) {
        // 处理地产过路费
        if (table::contains(&game.owner_of, tile_id)) {
            let owner = *table::borrow(&game.owner_of, tile_id);
            if (owner != player) {
                // 计算并支付过路费
                let level = *table::borrow(&game.level_of, tile_id);
                let base_toll = map::tile_base_toll(tile);
                // 计算过路费倍数：0级=1.0, 1级=2.0, 2级=3.0, 3级=4.0, 4级=5.0
                let multiplier = ((level + 1) as u64) * 100;
                let toll = (base_toll * multiplier) / 100;

                // 先检查免租buff
                let has_rent_free = {
                    let player_data = table::borrow(&game.players, player);
                    is_buff_active(player_data, types::buff_rent_free(), game.round)
                };

                // 如果不免租，执行转账
                if (!has_rent_free) {
                    // 扣除玩家现金
                    let player_data = table::borrow_mut(&mut game.players, player);
                    player_data.cash = player_data.cash - toll;

                    // 增加地主现金
                    let owner_data = table::borrow_mut(&mut game.players, owner);
                    owner_data.cash = owner_data.cash + toll;
                };
            };
        };
    } else if (tile_kind == types::tile_card()) {
        // 停留抽2张卡
        let player_data = table::borrow_mut(&mut game.players, player);
        let (card_kind, _) = cards::draw_card_on_stop(0);
        cards::give_card_to_player(&mut player_data.cards, card_kind, 2);
    };
}

#[test_only]
public fun has_npc_on_tile(game: &Game, tile_id: u64): bool {
    table::contains(&game.npc_on, tile_id)
}

#[test_only]
public fun get_npc_on_tile(game: &Game, tile_id: u64): &NpcInst {
    table::borrow(&game.npc_on, tile_id)
}

#[test_only]
public fun get_npc_count(game: &Game): u16 {
    game.current_npc_count
}

#[test_only]
public fun get_player_total_cards(game: &Game, player: address): u64 {
    let player_data = table::borrow(&game.players, player);
    cards::count_total_cards(&player_data.cards)
}

#[test_only]
public fun is_player_frozen(game: &Game, player: address): bool {
    let player_data = table::borrow(&game.players, player);
    is_buff_active(player_data, types::buff_frozen(), game.round)
}

#[test_only]
public fun has_buff(game: &Game, player_addr: address, buff_kind: u8): bool {
    let player = table::borrow(&game.players, player_addr);
    is_buff_active(player, buff_kind, game.round)
}

#[test_only]
public fun apply_buff_to_player(
    game: &mut Game,
    player_addr: address,
    buff_kind: u8,
    turns: u64,
    value: u64
) {
    let player = table::borrow_mut(&mut game.players, player_addr);
    apply_buff(player, buff_kind, game.round + turns, value);
}

#[test_only]
public fun get_buff_value_for_test(
    game: &Game,
    player_addr: address,
    buff_kind: u8
): u64 {
    let player = table::borrow(&game.players, player_addr);
    get_buff_value(player, buff_kind, game.round)
}

// ===== Helper Functions (moved from types) =====

// 获取等级倍率数组（用于计算过路费）
public fun get_level_multipliers(): vector<u64> {
    vector[1, 2, 4, 8, 16]  // M[0..4]
}

// 计算升级成本
public fun calculate_upgrade_cost(price: u64, level: u8): u64 {
    // cost(level) = price * (0.6 + 0.5 * level)
    let multiplier = 60 + 50 * (level as u64);  // 以百分比计算
    (price * multiplier) / 100
}

// 计算过路费
public fun calculate_toll(base_toll: u64, level: u8): u64 {
    let multipliers = get_level_multipliers();
    let idx = (level as u64);
    if (idx >= multipliers.length()) {
        base_toll  // 防御性编程
    } else {
        base_toll * *multipliers.borrow(idx)
    }
}

// 检查是否是NPC类型
public fun is_npc(kind: u8): bool {
    kind == types::npc_barrier() || kind == types::npc_bomb() || kind == types::npc_dog()
}

// 检查是否是会送医院的NPC
public fun is_hospital_npc(kind: u8): bool {
    kind == types::npc_bomb() || kind == types::npc_dog()
}

// 检查是否是可停留地块
public fun is_stoppable_tile(kind: u8): bool {
    kind == types::tile_property() ||
    kind == types::tile_hospital() ||
    kind == types::tile_prison() ||
    kind == types::tile_chance() ||
    kind == types::tile_bonus() ||
    kind == types::tile_fee() ||
    kind == types::tile_card() ||
    kind == types::tile_news() ||
    kind == types::tile_lottery() ||
    kind == types::tile_shop()
}

// 检查是否是可经过触发的地块
public fun is_passable_trigger(kind: u8): bool {
    kind == types::tile_card() || kind == types::tile_lottery()
}