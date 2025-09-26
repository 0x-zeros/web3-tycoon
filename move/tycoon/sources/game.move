module tycoon::game;

use std::option::{Self, Option};

use sui::table::{Self, Table};
use sui::clock::{Self, Clock};
use sui::coin;
use sui::random::{Self, Random, RandomGenerator};

use tycoon::types;
use tycoon::map::{Self, MapTemplate, MapRegistry};
use tycoon::cards::{Self, CardEntry};
use tycoon::events;
use tycoon::tycoon::{Self, GameData};

// ===== Errors =====
// 玩家相关错误
const ENotActivePlayer: u64 = 1001;
const EAlreadyRolled: u64 = 1002;  // 已经掷过骰
const ENotRolledYet: u64 = 1005;   // 还未掷骰
const EWrongGame: u64 = 1003;
const EGameNotActive: u64 = 1004;
const EPlayerNotFound: u64 = 1006;  // 找不到玩家

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
const EInvalidParams: u64 = 5005;  // 参数无效

// 移动相关错误
const EInvalidMove: u64 = 4001;
const ENoPathAllowed: u64 = 4002;  // 无遥控骰子时不允许提供路径
const EInvalidPathChoice: u64 = 4003;  // 路径选择不是有效的邻居

// NPC相关错误（已无全局数量限制）
const E_NPC_SPAWN_POOL_INDEX_OUT_OF_BOUNDS: u64 = 8001;  // NPC生成池索引越界
const E_TILE_INDEX_OUT_OF_BOUNDS: u64 = 8002;  // 地块索引越界

// Map相关错误（game.move中使用的部分）
const ETemplateNotFound: u64 = 3001;
const ETileOccupiedByNpc: u64 = 2001;
const ENoSuchTile: u64 = 2002;


// ===== BuffEntry buff条目 =====
//
// 功能说明：
// 统一的Buff存储结构，用于管理玩家的各种临时状态效果
// 采用独占终止时间设计，便于统一的过期检查和清理
//
// Buff激活逻辑使用包含语义（inclusive semantics）：
// - Buff激活条件：current_round <= last_active_round
// - Buff过期条件：current_round > last_active_round
// - 示例：
//   - last_active_round = round → 仅当前轮激活
//   - last_active_round = round + 1 → 当前轮和下一轮激活
//   - last_active_round = round + 2 → 当前轮和接下来两轮激活
//
// 字段说明：
// - kind: Buff类型标识，对应types模块中的BUFF_*常量
// - last_active_round: 最后一个激活轮次（包含边界）
// - value: 附加数据，意义取决于Buff类型
//   * BUFF_MOVE_CTRL: 存储指定的骰子点数
//   * BUFF_RENT_FREE: 未使用（可扩展为免租比例）
//   * BUFF_FROZEN: 未使用（可扩展为冻结来源）
// - spawn_index: 关联的NPC spawn索引
//   * 0xFFFF: 表示非NPC产生的buff
public struct BuffEntry has store, copy, drop {
    kind: u8,                  // Buff类型 (rent_free, frozen, move_ctrl等)
    last_active_round: u16,    // 最后一个激活轮次（包含）
    value: u64,                // 数值载荷 (如move_ctrl的骰子值)
    spawn_index: u16          // 关联的NPC spawn索引，0xFFFF表示非NPC产生
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
// - cards: 手牌集合，使用vector存储以优化小集合性能
// - dir_pref: 移动方向偏好（顺时针/逆时针/自动选择）
// - buffs: 当前激活的所有Buff列表
public struct Player has store {
    owner: address,
    pos: u16,  // tile_id (最多65535个地块)
    cash: u64,
    in_prison_turns: u8,
    in_hospital_turns: u8,
    bankrupt: bool,
    cards: vector<CardEntry>,  // 改为vector存储
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
// - consumable: 是否可被消耗
//   * true: 触发后自动移除（如炸弹）
//   * false: 触发后保留（如路障）
// - spawn_index: 指向spawn_pool的索引
//   * 0xFFFF: 表示玩家手动放置（非随机生成）
public struct NpcInst has store, copy, drop {
    kind: u8,  // NpcKind
    consumable: bool,
    spawn_index: u16  // 指向spawn_pool的索引，0xFFFF表示玩家放置
}

// ===== NpcSpawnEntry NPC生成池条目 =====
//
// 功能说明：
// 用于追踪NPC生成池中每个条目的状态
//
// 字段说明：
// - npc_kind: NPC类型
// - next_active_round: 可以参与随机生成的最早轮次
public struct NpcSpawnEntry has store, copy, drop {
    npc_kind: u8,
    next_active_round: u16  // 可以参与随机的轮次
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
    player: address,
    player_index: u8  // 玩家在 players vector 中的索引
}

// TurnCap 已被移除，使用 Seat 进行身份验证

// ===== Tile Dynamic Data 地块动态数据 =====

// 地块动态数据结构
// 与MapTemplate.tiles_static对应，存储游戏中变化的数据
// 使用vector索引对齐，tile_id即为数组下标
public struct Tile has store, copy, drop {
    owner: u8,     // 所有者玩家索引（255表示无主）
    level: u8,     // 地产等级（0-4级）
    npc_on: u8     // NPC类型（0表示无NPC，用于查询密度）
}

// 无主地块的owner值
const NO_OWNER: u8 = 255;
// 无NPC的标记值
const NO_NPC: u8 = 0;

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
// - tiles: 地块动态数据vector，索引对应tile_id
// - owner_index: 反向索引，快速查找玩家的所有地产
//
// NPC系统：
// - npc_on: 地块上的NPC实例（完整数据）
//
// 其他组件：
// - max_rounds: 最大轮次限制（可选）
// - winner: 游戏结束时的获胜者
public struct Game has key, store {
    id: UID,
    status: u8,  // 0=ready, 1=active, 2=ended
    template_id: u16,

    players: vector<Player>,

    round: u16,        // 轮次计数器（所有玩家各行动一次）
    turn: u8,          // 轮内回合（0到player_count-1）
    active_idx: u8,
    has_rolled: bool,  // 是否已经掷骰

    // 地块动态数据（与MapTemplate.tiles_static对齐）
    tiles: vector<Tile>,
    npc_on: Table<u16, NpcInst>,  // NPC实例完整数据
    owner_index: Table<u8 /* player_index */, vector<u16>>,

    // NPC生成系统
    npc_spawn_pool: vector<NpcSpawnEntry>,  // NPC生成池

    // 配置
    max_rounds: u8,                 // 最大回合数（0表示无限期）
    price_rise_days: u8,            // 物价提升天数

    // 额外状态
    winner: Option<address>,//todo 不需要吧？

    // 待决策状态
    pending_decision: u8,           // 待决策类型
    decision_tile: u16,             // 相关的地块ID
    decision_amount: u64            // 相关金额（如租金）
}

// ===== Entry Functions 入口函数 =====

// 解析游戏创建参数
// params[0]: starting_cash (0=默认100000)
// params[1]: price_rise_days (0=默认15)
// params[2]: max_rounds (0=无限期)
fun parse_game_params(params: &vector<u64>): (u64, u8, u8) {
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
        0  // 默认无限期
    };

    (starting_cash, price_rise_days, max_rounds)
}

// 创建游戏
public entry fun create_game(
    game_data: &GameData,
    template_id: u16,
    params: vector<u64>,  // 通用参数（params[0]=max_rounds, 0表示无限）
    ctx: &mut TxContext
) {
    // 验证模板存在
    let map_registry = tycoon::get_map_registry(game_data);
    assert!(map::has_template(map_registry, template_id), ETemplateNotFound);
    let template = map::get_template(map_registry, template_id);

    // 解析参数
    let (starting_cash, price_rise_days, max_rounds) = parse_game_params(&params);

    // 创建游戏对象
    let game_id = object::new(ctx);
    let game_id_copy = game_id.to_inner();

    // 根据地图模板初始化tiles vector
    let tile_count = map::get_tile_count(template);
    let mut tiles = vector[];
    let mut i = 0;
    while (i < tile_count) {
        tiles.push_back(Tile {
            owner: NO_OWNER,
            level: 0,
            npc_on: NO_NPC
        });
        i = i + 1;
    };

    let mut game = Game {
        id: game_id,
        status: types::STATUS_READY(),
        template_id,
        players: vector[],
        round: 0,
        turn: 0,
        active_idx: 0,
        has_rolled: false,
        tiles,
        npc_on: table::new(ctx),
        owner_index: table::new(ctx),
        npc_spawn_pool: init_npc_spawn_pool(tycoon::get_npc_spawn_weights(game_data)),
        max_rounds,
        price_rise_days,
        winner: option::none(),
        pending_decision: types::DECISION_NONE(),
        decision_tile: 0,
        decision_amount: 0
    };

    // 创建者自动加入（使用解析后的起始资金）
    let creator = ctx.sender();
    let player = create_player_with_cash(creator, types::DIR_CW(), starting_cash, ctx);
    game.players.push_back(player);

    // 发出游戏创建事件
    let max_players = map::get_tile_count(template);  // 使用地块数量作为最大玩家数
    events::emit_game_created_event(
        game_id_copy,
        creator,
        template_id,
        (max_players as u8)
    );

    // 创建座位凭证（索引为 0）
    let seat = Seat {
        id: object::new(ctx),
        game_id: game_id_copy,
        player: creator,
        player_index: 0
    };

    // 共享游戏对象
    transfer::share_object(game);
    transfer::transfer(seat, creator);
}

// 加入游戏
public entry fun join(
    game: &mut Game,
    game_data: &GameData,
    ctx: &mut TxContext
) {
    let player_addr = ctx.sender();

    // 验证游戏状态
    assert!(game.status == types::STATUS_READY(), EAlreadyStarted);
    // 暂时移除最大玩家数限制（或使用地图模板的某个属性）

    // 检查是否已加入
    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];
        assert!(player.owner != player_addr, EAlreadyJoined);
        i = i + 1;
    };

    // 创建玩家 - 复制第一个玩家的现金作为起始资金
    // 游戏未开始时，第一个玩家的cash就是starting_cash
    let starting_cash = if (game.players.length() > 0) {
        game.players[0].cash  // 直接用第一个玩家的现金
    } else {
        tycoon::get_starting_cash(game_data)  // 兜底使用默认值
    };
    let player = create_player_with_cash(player_addr, types::DIR_CW(), starting_cash, ctx);  // 默认顺时针，游戏开始时随机
    let player_index = (game.players.length() as u8);
    game.players.push_back(player);

    // 发出加入事件
    events::emit_player_joined_event(
        game.id.to_inner(),
        player_addr,
        player_index
    );

    // 创建座位凭证
    let seat = Seat {
        id: object::new(ctx),
        game_id: game.id.to_inner(),
        player: player_addr,
        player_index
    };

    transfer::transfer(seat, player_addr);
}

// 开始游戏
public entry fun start(
    game: &mut Game,
    game_data: &GameData,
    r: &Random,  // 新增：用于随机分配方向
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 验证状态
    assert!(game.status == types::STATUS_READY(), EAlreadyStarted);
    assert!(game.players.length() >= 2, ENotEnoughPlayers);

    // 设置游戏状态
    game.status = types::STATUS_ACTIVE();
    // round和turn已在创建时初始化为0
    game.active_idx = 0;
    game.has_rolled = false;

    // 为每个玩家随机分配初始方向
    let mut generator = random::new_generator(r, ctx);
    let mut i = 0;
    while (i < game.players.length()) {
        let player = &mut game.players[i];
        let random_bit = generator.generate_u8() % 2;
        player.dir_pref = if (random_bit == 0) types::DIR_CW() else types::DIR_CCW();
        i = i + 1;
    };

    let starting_player = (&game.players[0]).owner;

    // 生成初始NPC（尝试生成3个）
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let mut i = 0;
    while (i < 3) {
        spawn_random_npc(game, template, &mut generator);
        i = i + 1;
    };

    // 发出开始事件
    events::emit_game_started_event(//todo 传回去的参数太少
        game.id.to_inner(),
        game.players.length() as u8,
        starting_player
    );
}

// mint_turncap 已被移除，直接使用 Seat 验证身份

// 使用卡牌
public entry fun use_card(
    game: &mut Game,
    seat: &Seat,
    kind: u8,
    params: vector<u16>,  // 统一参数：玩家索引、地块ID、骰子值等
    game_data: &GameData,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证还未掷骰（卡牌只能在掷骰前使用）
    assert!(!game.has_rolled, EAlreadyRolled);

    let player_addr = seat.player;

    // 使用卡牌（内部会检查拥有并扣除）
    {
        let player = &mut game.players[seat.player_index as u64];
        assert!(cards::use_player_card(&mut player.cards, kind), ECardNotOwned);
    };  // 借用在这里结束

    // 创建事件收集器
    let mut npc_changes = vector[];
    let mut buff_changes = vector[];
    let mut cash_changes = vector[];

    // 应用卡牌效果并收集事件数据
    let map_registry = tycoon::get_map_registry(game_data);
    apply_card_effect_with_collectors(
        game,
        seat.player_index,
        kind,
        &params,
        &mut npc_changes,
        &mut buff_changes,
        &mut cash_changes,
        map_registry
    );

    // 发射聚合事件
    events::emit_use_card_action_event(
        game.id.to_inner(),
        player_addr,
        (game.round as u16),
        (game.turn as u8),
        kind,
        params,  // 直接传递params
        npc_changes,
        buff_changes,
        cash_changes
    );
}

// 掷骰并移动
//todo 改为entry fun
public entry fun roll_and_step(
    game: &mut Game,
    seat: &Seat,
    path_choices: vector<u16>,  // 替换 dir_intent，传分叉选择序列
    game_data: &GameData,
    r: &Random,
    clock: &Clock,//todo 在获取btc价格或者其他defi相关场景的时候会使用到
    ctx: &mut TxContext
) {
    // 验证并自动处理跳过
    if (validate_and_auto_skip(game, seat, game_data, r, ctx)) {
        return
    };

    // 标记已掷骰
    game.has_rolled = true;

    let player_addr = seat.player;
    let player_index = seat.player_index;

    // 在函数开头创建一个生成器，贯穿整个交易使用
    let mut generator = random::new_generator(r, ctx);

    // 获取骰子点数
    let dice = get_dice_value(game, player_index, &mut generator);

    let player = &game.players[player_index as u64];
    let from_pos = player.pos;

    // 验证path_choices：有遥控骰子时才能提供路径选择
    if (is_buff_active(player, types::BUFF_MOVE_CTRL(), game.round)) {
        // 有遥控骰子buff，可以提供路径选择
    } else {
        // 无遥控骰子，不应提供路径选择
        assert!(path_choices.is_empty(), ENoPathAllowed);
    };

    // 创建事件收集器
    let mut steps = vector[];
    let mut cash_changes = vector[];

    // 执行逐步移动并收集事件数据
    let map_registry = tycoon::get_map_registry(game_data);
    execute_step_movement_with_choices(
        game,
        seat.player_index,
        dice,
        &path_choices,
        &mut steps,
        &mut cash_changes,
        game_data,
        &mut generator
    );

    // 获取最终位置
    let end_player = &game.players[player_index as u64];
    let end_pos = end_player.pos;

    // 发射聚合事件（包含path_choices）
    events::emit_roll_and_step_action_event_with_choices(
        game.id.to_inner(),
        player_addr,
        game.round,
        game.turn,
        dice,
        path_choices,  // 记录实际使用的路径选择
        from_pos,
        steps,
        cash_changes,
        end_pos
    );

    // 清理回合状态
    clean_turn_state(game, player_index);

    // 结束回合
    advance_turn(game, game_data, r, ctx);
}

// 决定租金支付方式（使用免租卡或支付现金）
public entry fun decide_rent_payment(
    game: &mut Game,
    seat: &Seat,
    use_rent_free: bool,
    game_data: &GameData,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证待决策状态
    assert!(game.pending_decision == types::DECISION_PAY_RENT(), EInvalidDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;
    let tile_id = game.decision_tile;
    let toll = game.decision_amount;

    // 获取地产所有者
    let tile = &game.tiles[tile_id as u64];
    assert!(tile.owner != NO_OWNER, EPropertyNotOwned);
    let owner_index = tile.owner;

    if (use_rent_free) {
        // 使用免租卡
        let player = &game.players[player_index as u64];
        assert!(cards::player_has_card(&player.cards, types::CARD_RENT_FREE()), ECardNotFound);

        // 消耗免租卡
        let player_mut = &mut game.players[player_index as u64];
        let used = cards::use_player_card(&mut player_mut.cards, types::CARD_RENT_FREE());
        assert!(used, ECardNotFound);

        // TODO: 发出免租事件
    } else {
        // 支付现金
        let player = &mut game.players[player_index as u64];
        assert!(player.cash >= toll, EInsufficientCash);
        player.cash = player.cash - toll;

        // 给所有者加钱
        let owner_player = &mut game.players[owner_index as u64];
        owner_player.cash = owner_player.cash + toll;

        // TODO: 发出支付租金事件
    };

    // 清除待决策状态
    clear_decision_state(game);
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
        game.pending_decision == types::DECISION_BUY_PROPERTY() ||
        game.pending_decision == types::DECISION_UPGRADE_PROPERTY(),
        EInvalidDecision
    );

    // 清除待决策状态
    clear_decision_state(game);
}

// 结束回合（手动）
public entry fun end_turn(
    game: &mut Game,
    game_data: &GameData,
    seat: &Seat,
    r: &Random,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证没有待决策
    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;

    // 清理回合状态
    clean_turn_state(game, player_index);

    // 发出结束回合事件
    events::emit_end_turn_event(
        game.id.to_inner(),
        player_addr,
        (game.round as u16),
        (game.turn as u8)
    );

    // 推进回合
    advance_turn(game, game_data, r, ctx);
}

// 购买地产
public entry fun buy_property(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证待决策状态
    assert!(game.pending_decision == types::DECISION_BUY_PROPERTY(), EInvalidDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;
    let player = &game.players[player_index as u64];
    let tile_id = player.pos;

    // 验证地块位置匹配
    assert!(tile_id == game.decision_tile, EPosMismatch);

    // 获取地块信息
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let tile = map::get_tile(template, tile_id);

    // 验证地块类型
    assert!(map::tile_kind(tile) == types::TILE_PROPERTY(), ENotProperty);

    // 验证地块无主
    assert!(game.tiles[tile_id as u64].owner == NO_OWNER, EPropertyOwned);

    // 验证价格和现金（应用物价指数）
    let base_price = map::tile_price(tile);
    assert!(base_price > 0, EInvalidPrice);
    let price_index = calculate_price_index(game);
    let price = (base_price * price_index);
    assert!(player.cash >= price, EInsufficientCash);

    // 扣除现金
    {
        let player_mut = &mut game.players[player_index as u64];
        player_mut.cash = player_mut.cash - price;
    };

    // 设置所有权和等级
    let tile = &mut game.tiles[tile_id as u64];
    tile.owner = player_index;
    tile.level = 1;

    // 更新owner_index
    if (!table::contains(&game.owner_index, player_index)) {
        table::add(&mut game.owner_index, player_index, vector[]);
    };
    let owner_tiles = table::borrow_mut(&mut game.owner_index, player_index);
    owner_tiles.push_back(tile_id);

    // 清除待决策状态
    clear_decision_state(game);

    // 发送购买事件

    // 发送现金变化事件
}

// 升级地产
public entry fun upgrade_property(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    ctx: &mut TxContext
) {
    // 验证座位和回合
    validate_seat_and_turn(game, seat);

    // 验证待决策状态
    assert!(game.pending_decision == types::DECISION_UPGRADE_PROPERTY(), EInvalidDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;
    let player = &game.players[player_index as u64];
    let tile_id = player.pos;

    // 验证地块位置匹配
    assert!(tile_id == game.decision_tile, EPosMismatch);

    // 获取地块信息
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let tile = map::get_tile(template, tile_id);

    // 验证地块类型
    assert!(map::tile_kind(tile) == types::TILE_PROPERTY(), ENotProperty);

    // 验证地块所有权
    let tile_dyn = &game.tiles[tile_id as u64];
    assert!(tile_dyn.owner != NO_OWNER, EPropertyNotOwned);
    let owner_idx = tile_dyn.owner;
    assert!(owner_idx == player_index, ENotOwner);

    // 验证等级
    let current_level = tile_dyn.level;
    assert!(current_level < types::LEVEL_4(), EMaxLevel);

    // 计算升级费用
    let price = map::tile_price(tile);
    let upgrade_cost = calculate_upgrade_cost(price, current_level, game, game_data);

    // 验证现金
    assert!(player.cash >= upgrade_cost, EInsufficientCash);

    // 扣除现金
    {
        let player_mut = &mut game.players[player_index as u64];
        player_mut.cash = player_mut.cash - upgrade_cost;
    };

    // 提升等级
    game.tiles[tile_id as u64].level = current_level + 1;

    // 清除待决策状态
    clear_decision_state(game);

    // 发送升级事件

    // 发送现金变化事件
}

// ===== Internal Functions 内部函数 =====

// 创建玩家（指定起始资金）
fun create_player_with_cash(owner: address, dir_pref: u8, cash: u64, _ctx: &mut TxContext): Player {
    // 创建初始卡牌
    let mut initial_cards = vector[];
    initial_cards.push_back(cards::new_card_entry(types::CARD_MOVE_CTRL(), 1));  // 遥控骰子 1 张
    initial_cards.push_back(cards::new_card_entry(types::CARD_BARRIER(), 1));     // 路障卡 1 张
    initial_cards.push_back(cards::new_card_entry(types::CARD_CLEANSE(), 1));     // 清除卡 1 张

    Player {
        owner,
        pos: 0,
        cash,
        buffs: vector[],  // 初始化buffs
        in_prison_turns: 0,
        in_hospital_turns: 0,
        bankrupt: false,
        cards: initial_cards,
        dir_pref  // 使用传入的方向
    }
}

// 获取当前活跃玩家地址
fun get_active_player_address(game: &Game): address {
    game.players[game.active_idx as u64].owner
}

// 通过 Seat 获取玩家（只读）
fun get_player_by_seat(game: &Game, seat: &Seat): &Player {
    &game.players[seat.player_index as u64]
}

// 通过 Seat 获取玩家（可变）
fun get_player_mut_by_seat(game: &mut Game, seat: &Seat): &mut Player {
    &mut game.players[seat.player_index as u64]
}

// 清理决策状态
fun clear_decision_state(game: &mut Game) {
    game.pending_decision = types::DECISION_NONE();
    game.decision_tile = 0;
    game.decision_amount = 0;
}

// 通过地址查找玩家索引
fun find_player_index(game: &Game, player_addr: address): u8 {
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

// 验证座位凭证和当前回合
fun validate_seat_and_turn(game: &Game, seat: &Seat) {
    // validate_seat_index: 验证座位索引有效性
    assert!((seat.player_index as u64) < game.players.length(), EPlayerNotFound);

    // 验证游戏ID匹配
    assert!(seat.game_id == game.id.to_inner(), EWrongGame);

    // 验证Seat一致性：索引对应的玩家地址必须与seat中的地址一致
    let seat_owner = (&game.players[seat.player_index as u64]).owner;
    assert!(seat_owner == seat.player, ENotActivePlayer);

    // 验证是当前活跃玩家
    let active_player = get_active_player_address(game);
    assert!(seat.player == active_player, ENotActivePlayer);

    // 验证游戏状态
    assert!(game.status == types::STATUS_ACTIVE(), EGameNotActive);
}

// 验证并自动处理跳过
fun validate_and_auto_skip(
    game: &mut Game,
    seat: &Seat,
    game_data: &GameData,
    r: &Random,
    ctx: &mut TxContext
): bool {
    validate_seat_and_turn(game, seat);

    // 如果需要跳过，自动处理
    if (should_skip_turn(game, seat.player_index)) {
        handle_skip_turn(game, seat.player_index);
        advance_turn(game, game_data, r, ctx);
        return true  // 表示已跳过
    };
    false  // 表示未跳过
}

// 检查是否应该跳过回合
fun should_skip_turn(game: &Game, player_index: u8): bool {
    let player = &game.players[player_index as u64];
    player.in_prison_turns > 0 || player.in_hospital_turns > 0
}

// 处理跳过回合
fun handle_skip_turn(game: &mut Game, player_index: u8) {
    let player = &mut game.players[player_index as u64];
    let player_addr = player.owner;

    let reason = if (player.in_prison_turns > 0) {
        player.in_prison_turns = player.in_prison_turns - 1;
        types::SKIP_PRISON()
    } else {
        player.in_hospital_turns = player.in_hospital_turns - 1;
        types::SKIP_HOSPITAL()
    };

    events::emit_skip_turn_event(
        game.id.to_inner(),
        player_addr,
        reason
    );
}

// 获取骰子点数
fun get_dice_value(game: &Game, player_index: u8, generator: &mut RandomGenerator): u8 {
    let player = &game.players[player_index as u64];

    // 使用buff系统检查遥控骰子
    if (is_buff_active(player, types::BUFF_MOVE_CTRL(), game.round)) {
        let value = get_buff_value(player, types::BUFF_MOVE_CTRL(), game.round);
        return (value as u8)
    };

    generator.generate_u8_in_range(1, 6)
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
//
// 参数说明：
// - player_index: 玩家索引
// - dice: 骰子点数，决定移动步数
// - path_choices: 客户端提供的路径选择序列（分叉点的选择）
// - steps: 收集每一步的效果事件
// - cash_changes: 收集现金变化事件
fun execute_step_movement_with_choices(
    game: &mut Game,
    player_index: u8,
    dice: u8,
    path_choices: &vector<u16>,
    steps: &mut vector<events::StepEffect>,
    cash_changes: &mut vector<events::CashDelta>,
    game_data: &GameData,
    generator: &mut RandomGenerator
) {
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);

    // 先读取必要的玩家信息
    let (from_pos, mut direction, is_frozen) = {
        let player = &game.players[player_index as u64];
        (player.pos, player.dir_pref, is_buff_active(player, types::BUFF_FROZEN(), game.round))
    };

    if (is_frozen) {
        // 冻结时不移动，但仍需触发原地停留事件
        let stop_effect = handle_tile_stop_with_collector(
            game,
            player_index,
            from_pos,
            cash_changes,
            game_data,
            generator
        );

        // 记录步骤（停留在原地）
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

    // 初始化移动状态
    let mut current_pos = from_pos;
    let mut choice_idx = 0;
    let mut step_index: u8 = 0;
    let mut i = 0;
    let mut dir_updated = false;  // 标记是否已更新方向

    // 逐步移动主循环
    while (i < dice) {
        // 确定下一个位置
        let next_pos = if (!path_choices.is_empty() &&
                          choice_idx < path_choices.length()) {
            // 提供了路径选择（可用于分叉或纯环方向控制）
            let chosen = path_choices[choice_idx];

            // 验证选择是否合法
            assert!(is_valid_next_tile(template, current_pos, chosen), EInvalidPathChoice);
            choice_idx = choice_idx + 1;

            // 首次消费方向选择时，更新 dir_pref
            if (!dir_updated) {
                let cw_next = map::get_cw_next(template, current_pos);
                let ccw_next = map::get_ccw_next(template, current_pos);

                // 如果选择的是 cw 或 ccw 方向，更新玩家方向偏好
                if (chosen == cw_next || chosen == ccw_next) {
                    let new_direction = if (chosen == ccw_next) {
                        types::DIR_CCW()
                    } else {
                        types::DIR_CW()
                    };

                    // 更新玩家的持久方向偏好
                    let player = &mut game.players[player_index as u64];
                    player.dir_pref = new_direction;

                    // 同步更新本回合的局部方向变量
                    direction = new_direction;

                    dir_updated = true;
                }
            };

            chosen
        } else {
            // 无分叉或无选择，按方向偏好自动前进
            let mut next_pos = if (direction == types::DIR_CCW()) {
                map::get_ccw_next(template, current_pos)
            } else {
                map::get_cw_next(template, current_pos)
            };

            // 如果遇到自环（终端地块），自动掉头
            if (next_pos == current_pos) {
                next_pos = if (direction == types::DIR_CCW()) {
                    map::get_cw_next(template, current_pos)  // 掉头走cw方向
                } else {
                    map::get_ccw_next(template, current_pos)  // 掉头走ccw方向
                };
            };

            next_pos
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
                    let player = &mut game.players[player_index as u64];
                    player.pos = next_pos;
                };

                // 找医院并送去
                let hospital_tile = find_nearest_hospital(game, next_pos, game_data);
                send_to_hospital_internal(game, player_index, hospital_tile, game_data);

                // 移除NPC
                let consumed = consume_npc_if_consumable(game, next_pos, &npc);

                // 创建NPC事件
                npc_event_opt = option::some(events::make_npc_step_event(
                    next_pos,  // tile_id
                    npc.kind,  // kind
                    events::npc_result_send_hospital(),  // result
                    consumed,  // consumed
                    option::some(hospital_tile)  // result_tile
                ));

                // 记录步骤并结束移动
                steps.push_back( events::make_step_effect(
                    step_index,
                    current_pos,
                    next_pos,
                    dice - i - 1,
                    pass_draws,
                    npc_event_opt,
                    option::none()
                ));
                break  // 送医后结束移动
            } else if (npc.kind == types::NPC_BARRIER()) {
                // 路障 - 停止移动
                {
                    let player = &mut game.players[player_index as u64];
                    player.pos = next_pos;
                };

                // 创建NPC事件
                npc_event_opt = option::some(events::make_npc_step_event(
                    next_pos,  // tile_id
                    npc.kind,  // kind
                    events::npc_result_barrier_stop(),  // result
                    false,  // 路障不消耗
                    option::none()  // result_tile
                ));

                // 记录步骤并处理停留
                stop_effect_opt = option::some(handle_tile_stop_with_collector(
                    game,
                    player_index,
                    next_pos,
                    cash_changes,
                    game_data,
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
                break  // 遇到路障停止
            };
        };

        // 更新位置
        {
            let player = &mut game.players[player_index as u64];
            player.pos = next_pos;
        };

        // 如果不是最后一步，处理经过效果
        if (i < dice - 1) {
            let next_tile = map::get_tile(template, next_pos);
            let tile_kind = map::tile_kind(next_tile);

            // 经过卡牌格抽卡
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

            // 记录步骤
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
            // 最后一步，处理停留效果
            stop_effect_opt = option::some(handle_tile_stop_with_collector(
                game,
                player_index,
                next_pos,
                cash_changes,
                game_data,
                generator
            ));

            // 记录最后的步骤
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

        current_pos = next_pos;
        step_index = step_index + 1;
        i = i + 1;
    };

    // 注意：早停（路障/炸弹/狗狗）时可能有剩余的choices，这是正常的
    // 不需要验证是否用完所有choices
}

// 验证选择的下一格是否合法
fun is_valid_next_tile(template: &MapTemplate, current: u16, chosen: u16): bool {
    // 禁止选择停留在原地（自环）
    if (chosen == current) {
        return false
    };

    let tile = map::get_tile(template, current);

    // 检查是否是cw/ccw
    if (chosen == map::get_cw_next(template, current) ||
        chosen == map::get_ccw_next(template, current)) {
        return true
    };

    // 检查是否在adj列表中
    if (map::tile_has_adj(template, current)) {
        let adjs = map::get_adj_tiles(template, current);
        let mut i = 0;
        while (i < adjs.length()) {
            if (adjs[i] == chosen) {
                return true
            };
            i = i + 1;
        };
    };

    false
}

fun handle_tile_pass(
    game: &mut Game,
    player_index: u8,
    tile_id: u16,
    game_data: &GameData,
    generator: &mut RandomGenerator
) {
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);

    // 只有卡片格和彩票格在经过时触发（固定行为）
    if (is_passable_trigger(tile_kind)) {
        if (tile_kind == types::TILE_CARD()) {
            // 抽卡
            let random_value = generator.generate_u8();
            let (card_kind, count) = cards::draw_card_on_pass(random_value);
            let player = &mut game.players[player_index as u64];
            cards::give_card_to_player(&mut player.cards, card_kind, count);
        } else if (tile_kind == types::TILE_LOTTERY()) {
            // 彩票逻辑（简化）
            // TODO: 实现彩票系统
        };
    }
}

// 处理停留地块
fun handle_tile_stop(
    game: &mut Game,
    player_index: u8,
    tile_id: u16,
    game_data: &GameData,
    generator: &mut RandomGenerator
) {
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);
    let player_addr = (&game.players[player_index as u64]).owner;

    if (tile_kind == types::TILE_PROPERTY()) {
        handle_property_stop(game, player_index, tile_id, tile, game_data);
    } else if (tile_kind == types::TILE_HOSPITAL()) {
        handle_hospital_stop(game, player_index, tile_id);
    } else if (tile_kind == types::TILE_PRISON()) {
        handle_prison_stop(game, player_index, tile_id);
    } else if (tile_kind == types::TILE_CARD()) {
        // 停留时也抽卡
        let random_value = generator.generate_u8();
        let (card_kind, count) = cards::draw_card_on_stop(random_value);
        let player = &mut game.players[player_index as u64];
        cards::give_card_to_player(&mut player.cards, card_kind, count);
    } else if (tile_kind == types::TILE_CHANCE()) {
        // TODO: 实现机会事件
    } else if (tile_kind == types::TILE_BONUS()) {
        // 奖励
        let base_bonus = map::tile_special(tile);
        let price_index = calculate_price_index(game);
        let bonus = base_bonus * price_index;  // 应用物价指数
        let player = &mut game.players[player_index as u64];
        player.cash = player.cash + bonus;
    } else if (tile_kind == types::TILE_FEE()) {
        // 罚款
        let base_fee = map::tile_special(tile);
        let price_index = calculate_price_index(game);
        let fee = base_fee * price_index;  // 应用物价指数
        let player = &mut game.players[player_index as u64];
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
    player_index: u8,
    tile_id: u16,
    cash_changes: &mut vector<events::CashDelta>,
    game_data: &GameData,
    generator: &mut RandomGenerator
): events::StopEffect {
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);
    let player_addr = (&game.players[player_index as u64]).owner;

    let mut stop_type = events::stop_none();
    let mut amount = 0;
    let mut owner_opt = option::none<address>();
    let mut level_opt = option::none<u8>();
    let mut turns_opt = option::none<u8>();
    let mut card_gains = vector[];

    if (tile_kind == types::TILE_PROPERTY()) {
        if (game.tiles[tile_id as u64].owner == NO_OWNER) {
            // 无主地产 - 设置待决策状态（应用物价指数）
            stop_type = events::stop_property_unowned();
            game.pending_decision = types::DECISION_BUY_PROPERTY();
            game.decision_tile = tile_id;
            let base_price = map::tile_price(tile);
            let price_index = calculate_price_index(game);
            game.decision_amount = base_price * price_index;
        } else {
            let owner_index = game.tiles[tile_id as u64].owner;
            if (owner_index != player_index) {
                let level = game.tiles[tile_id as u64].level;
                let toll = calculate_toll(map::tile_base_toll(tile), level, game, game_data);

                // 检查免租情况
                let player = &game.players[player_index as u64];
                let has_rent_free_buff = is_buff_active(player, types::BUFF_RENT_FREE(), game.round);
                let has_rent_free_card = cards::player_has_card(&player.cards, types::CARD_RENT_FREE());

                if (has_rent_free_buff) {
                    // 有免租buff - 直接免租，无需决策
                    stop_type = events::stop_property_no_rent();
                    let owner_addr = (&game.players[owner_index as u64]).owner;
                    owner_opt = option::some(owner_addr);
                    level_opt = option::some(level);
                    amount = 0;
                } else if (has_rent_free_card) {
                    // 没有buff但有免租卡 - 设置待决策状态
                    stop_type = events::stop_property_toll();
                    game.pending_decision = types::DECISION_PAY_RENT();
                    game.decision_tile = tile_id;
                    game.decision_amount = toll;
                    let owner_addr = (&game.players[owner_index as u64]).owner;
                    owner_opt = option::some(owner_addr);
                    level_opt = option::some(level);
                    amount = toll;
                } else {
                    // 既没有buff也没有卡 - 直接扣费
                    let (actual_payment, should_bankrupt) = {
                        let player_mut = &mut game.players[player_index as u64];
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
                        let owner_player = &mut game.players[owner_index as u64];
                        owner_player.cash = owner_player.cash + actual_payment;
                        let owner_addr = owner_player.owner;

                        // 记录现金变动 - 支付方
                        cash_changes.push_back( events::make_cash_delta(
                            player_addr,
                            true,  // is_debit
                            actual_payment,
                            1,  // reason: toll
                            tile_id
                        ));

                        // 记录现金变动 - 收款方
                        cash_changes.push_back( events::make_cash_delta(
                            owner_addr,
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
                        let owner_addr = (&game.players[owner_index as u64]).owner;
                        handle_bankruptcy(game, player_addr, option::some(owner_addr));
                    };

                    let owner_addr = (&game.players[owner_index as u64]).owner;
                    owner_opt = option::some(owner_addr);
                    level_opt = option::some(level);
                }
            } else {
                // 自己的地产 - 检查是否可以升级
                let level = game.tiles[tile_id as u64].level;
                if (level < types::LEVEL_4()) {
                    // 可以升级 - 设置待决策状态
                    stop_type = events::stop_none();  // 自己的地产，无特殊效果
                    game.pending_decision = types::DECISION_UPGRADE_PROPERTY();
                    game.decision_tile = tile_id;
                    let upgrade_cost = calculate_upgrade_cost(map::tile_price(tile), level, game, game_data);
                    game.decision_amount = upgrade_cost;
                } else {
                    // 已达最高级
                    stop_type = events::stop_none();  // 自己的地产，无特殊效果
                };
                owner_opt = option::some(player_addr);
                level_opt = option::some(level);
            }
        }
    } else if (tile_kind == types::TILE_HOSPITAL()) {
        let player = &mut game.players[player_index as u64];
        player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
        stop_type = events::stop_hospital();
        turns_opt = option::some(types::DEFAULT_HOSPITAL_TURNS());
    } else if (tile_kind == types::TILE_PRISON()) {
        let player = &mut game.players[player_index as u64];
        player.in_prison_turns = types::DEFAULT_PRISON_TURNS();
        stop_type = events::stop_prison();
        turns_opt = option::some(types::DEFAULT_PRISON_TURNS());
    } else if (tile_kind == types::TILE_CARD()) {
        // 停留时抽卡
        let random_value = generator.generate_u8();
        let (card_kind, count) = cards::draw_card_on_stop(random_value);
        let player = &mut game.players[player_index as u64];
        cards::give_card_to_player(&mut player.cards, card_kind, count);

        // 记录卡牌获取
        card_gains.push_back(events::make_card_draw_item(
            tile_id,
            card_kind,
            count,
            false  // not pass, but stop
        ));
        stop_type = events::stop_card_stop();
    } else if (tile_kind == types::TILE_BONUS()) {
        // 奖励
        let base_bonus = map::tile_special(tile);
        let price_index = calculate_price_index(game);
        let bonus = base_bonus * price_index;  // 应用物价指数

        let player = &mut game.players[player_index as u64];
        player.cash = player.cash + bonus;

        // 记录现金变动
        cash_changes.push_back( events::make_cash_delta(
            player_addr,
            false,  // is_debit (income)
            bonus,
            4,  // reason: bonus
            tile_id
        ));

        stop_type = events::stop_bonus();
        amount = bonus;
    } else if (tile_kind == types::TILE_FEE()) {
        // 罚款
        let base_fee = map::tile_special(tile);
        let price_index = calculate_price_index(game);
        let fee = base_fee * price_index;  // 应用物价指数

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
            // 记录现金变动
            cash_changes.push_back( events::make_cash_delta(
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
    player_index: u8,
    tile_id: u16,
    tile: &map::TileStatic,
    game_data: &GameData
) {
    let player_addr = (&game.players[player_index as u64]).owner;

    if (game.tiles[tile_id as u64].owner == NO_OWNER) {
        // 无主地产 - 可以购买
        // TODO: 实现购买逻辑（需要用户确认）
    } else {
        let owner_index = game.tiles[tile_id as u64].owner;
        if (owner_index != player_index) {
            // 需要支付过路费
            let level = game.tiles[tile_id as u64].level;
            let toll = calculate_toll(map::tile_base_toll(tile), level, game, game_data);

            let player = &mut game.players[player_index as u64];

            // 检查免租
            let has_rent_free = is_buff_active(player, types::BUFF_RENT_FREE(), game.round);

            if (has_rent_free) {
                // 免租
                return
            };

            // 支付过路贩
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
            let owner_player = &mut game.players[owner_index as u64];
            owner_player.cash = owner_player.cash + actual_toll;

            // 如果支付不足，处理破产
            if (actual_toll < toll) {
                let owner_addr = owner_player.owner;
                handle_bankruptcy(game, player_addr, option::some(owner_addr));
            };
        }
    }
}

// 处理医院停留
fun handle_hospital_stop(game: &mut Game, player_index: u8, tile_id: u16) {
    let player = &mut game.players[player_index as u64];
    player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
}

// 处理监狱停留
fun handle_prison_stop(game: &mut Game, player_index: u8, tile_id: u16) {
    let player = &mut game.players[player_index as u64];
    player.in_prison_turns = types::DEFAULT_PRISON_TURNS();
}

// 找最近的医院
fun find_nearest_hospital(game: &Game, current_pos: u16, game_data: &GameData): u16 {
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let hospital_ids = map::get_hospital_ids(template);

    if (hospital_ids.is_empty()) {
        return current_pos  // 没有医院，原地不动
    };

    // 简化处理：返回第一个医院
    hospital_ids[0]
}

// 送医院（内部函数）
fun send_to_hospital_internal(game: &mut Game, player_index: u8, hospital_tile: u16, game_data: &GameData) {
    let player = &mut game.players[player_index as u64];
    player.pos = hospital_tile;
    player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
}

// 送医院
fun send_to_hospital(game: &mut Game, player_index: u8, game_data: &GameData) {
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let hospital_ids = map::get_hospital_ids(template);

    if (!hospital_ids.is_empty()) {
        let hospital_tile = hospital_ids[0];
        let player = &mut game.players[player_index as u64];
        player.pos = hospital_tile;
        player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
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
    let player_index = find_player_index(game, player_addr);
    {
        let player = &mut game.players[player_index as u64];
        player.bankrupt = true;
    };

    // 步骤2: 释放玩家拥有的所有地产
    if (table::contains(&game.owner_index, player_index)) {
        let owned_tiles = *table::borrow(&game.owner_index, player_index);
        let mut i = 0;
        while (i < owned_tiles.length()) {
            let tile_id = owned_tiles[i];

            // 从全局所有权表中移除该地产的所有权记录
            if (game.tiles[tile_id as u64].owner != NO_OWNER) {
                game.tiles[tile_id as u64].owner = NO_OWNER;
            };

            // 重置地产等级为0（变回无主地产）
            game.tiles[tile_id as u64].level = 0;

            i = i + 1;
        };

        // 清空玩家的地产拥有列表
        let owner_tiles_mut = table::borrow_mut(&mut game.owner_index, player_index);
        *owner_tiles_mut = vector[];
    };

    // 步骤3: 发送破产事件，记录破产信息
    events::emit_bankrupt_event(
        game.id.to_inner(),
        player_addr,
        0,  // debt暂时设为0（未来可记录实际欠款金额）
        creditor
    );

    // 步骤4: 检查游戏是否应该结束
    // 统计仍在游戏中（非破产）的玩家数量
    let mut non_bankrupt_count = 0;
    let mut winner = option::none<address>();
    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];
        if (!player.bankrupt) {
            non_bankrupt_count = non_bankrupt_count + 1;
            winner = option::some(player.owner);  // 记录最后一个非破产玩家
        };
        i = i + 1;
    };

    // 如果只剩一个玩家，宣布游戏结束并确定获胜者
    if (non_bankrupt_count == 1) {
        game.status = types::STATUS_ENDED();
        game.winner = winner;  // 设置最后的赢家
        events::emit_game_ended_event(
            game.id.to_inner(),
            winner,
            (game.round as u16),
            (game.turn as u8),
            2  // 结束原因代码：2表示破产胜利
        );
    }
}


// 共享内部函数：统一NPC放置与移除
fun place_npc_internal(
    game: &mut Game,
    tile_id: u16,
    kind: u8,
    consumable: bool,
    npc_changes: &mut vector<events::NpcChangeItem>,
) {
    // 仅限制同一地块不可重复放置
    assert!(!table::contains(&game.npc_on, tile_id), ETileOccupiedByNpc);
    let npc = NpcInst {
        kind,
        consumable,
        spawn_index: 0xFFFF  // 玩家手动放置的NPC
    };
    table::add(&mut game.npc_on, tile_id, npc);
    // 更新 Tile 中的 NPC 类型记录
    game.tiles[tile_id as u64].npc_on = kind;
    npc_changes.push_back(
        events::make_npc_change(tile_id, kind, events::npc_action_spawn(), consumable)
    );
}

fun remove_npc_internal(
    game: &mut Game,
    tile_id: u16,
    npc_changes: &mut vector<events::NpcChangeItem>,
) {
    if (table::contains(&game.npc_on, tile_id)) {
        let npc = table::remove(&mut game.npc_on, tile_id);
        // 清除 Tile 中的 NPC 类型记录
        game.tiles[tile_id as u64].npc_on = NO_NPC;
        npc_changes.push_back(
            events::make_npc_change(tile_id, npc.kind, events::npc_action_remove(), npc.consumable)
        );
    }
}

// 消耗NPC（用于玩家踩到NPC时）
// 注意：这个函数不生成NpcChangeItem事件，因为消耗信息已经在NpcStepEvent中体现
fun consume_npc_if_consumable(
    game: &mut Game,
    tile_id: u16,
    npc: &NpcInst
): bool {
    if (npc.consumable) {
        table::remove(&mut game.npc_on, tile_id);
        // 清除 Tile 中的 NPC 类型记录
        game.tiles[tile_id as u64].npc_on = NO_NPC;
        true
    } else {
        false
    }
}

// 应用卡牌效果（带事件收集器）
fun apply_card_effect_with_collectors(
    game: &mut Game,
    player_index: u8,
    kind: u8,
    params: &vector<u16>,  // 统一参数
    npc_changes: &mut vector<events::NpcChangeItem>,
    buff_changes: &mut vector<events::BuffChangeItem>,
    cash_changes: &mut vector<events::CashDelta>,
    _registry: &MapRegistry  // 保留下划线前缀，表示暂时未使用但保留接口
) {
    let player_addr = (&game.players[player_index as u64]).owner;

    if (kind == types::CARD_MOVE_CTRL()) {
        // 遥控骰：params[0]=目标玩家索引, params[1..]=骰子值（支持多个）
        assert!(params.length() >= 2, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        // 计算骰子总和（支持多个骰子）
        let mut dice_sum = 0u64;
        let mut i = 1;
        while (i < params.length()) {
            let dice = params[i];
            assert!(dice >= 1 && dice <= 6, EInvalidParams);  // 验证骰子值范围
            dice_sum = dice_sum + (dice as u64);
            i = i + 1;
        };

        // 应用buff到目标玩家
        let target_player = &mut game.players[target_index as u64];
        apply_buff(target_player, types::BUFF_MOVE_CTRL(), game.round, dice_sum);

        // 记录buff变更
        let target_addr = (&game.players[target_index as u64]).owner;
        buff_changes.push_back( events::make_buff_change(
            types::BUFF_MOVE_CTRL(),
            target_addr,
            option::some(game.round)
        ));
    } else if (kind == types::CARD_RENT_FREE()) {
        // 免租卡：应用给自己（可扩展为params[0]指定目标）
        let target_index = if (params.length() > 0) {
            (params[0] as u8)
        } else {
            player_index  // 默认给自己
        };
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];
        apply_buff(target_player, types::BUFF_RENT_FREE(), game.round + 1, 0);

        // 记录buff变更
        let target_addr = (&game.players[target_index as u64]).owner;
        buff_changes.push_back( events::make_buff_change(
            types::BUFF_RENT_FREE(),
            target_addr,
            option::some(game.round + 1)
        ));
    } else if (kind == types::CARD_FREEZE()) {
        // 冻结：params[0]=目标玩家索引
        assert!(params.length() >= 1, EInvalidParams);
        let target_index = (params[0] as u8);
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);
        assert!(target_index != player_index, EInvalidCardTarget);  // 不能冻结自己

        let target_player = &mut game.players[target_index as u64];
        apply_buff(target_player, types::BUFF_FROZEN(), game.round + 1, 0);

        // 记录buff变更
        let target_addr = (&game.players[target_index as u64]).owner;
        buff_changes.push_back( events::make_buff_change(
            types::BUFF_FROZEN(),
            target_addr,
            option::some(game.round + 1)
        ));
    } else if (kind == types::CARD_BARRIER() || kind == types::CARD_BOMB() || kind == types::CARD_DOG()) {
        // 放置NPC类卡牌：params[0]=地块ID
        assert!(params.length() >= 1, EInvalidParams);
        let tile_id = params[0];

        // 确定NPC类型
        let npc_kind = if (kind == types::CARD_BARRIER()) {
            types::NPC_BARRIER()
        } else if (kind == types::CARD_BOMB()) {
            types::NPC_BOMB()
        } else {
            types::NPC_DOG()
        };

        // 尝试放置NPC（如果地块已被占用会跳过）
        if (!table::contains(&game.npc_on, tile_id)) {
            place_npc_internal(
                game,
                tile_id,
                npc_kind,
                /* consumable = */ true,
                npc_changes
            );
        };
    } else if (kind == types::CARD_CLEANSE()) {
        // 清除NPC：params[..]=所有要清除的地块ID
        let mut i = 0;
        while (i < params.length()) {
            let tile_id = params[i];
            remove_npc_internal(game, tile_id, npc_changes);
            i = i + 1;
        };
    } else if (kind == types::CARD_TURN()) {
        // 转向卡：切换玩家的方向偏好
        // params[0]=目标玩家索引（可选，默认为自己）
        let target_index = if (params.length() > 0) {
            (params[0] as u8)
        } else {
            player_index  // 默认给自己
        };
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        // 切换方向
        let target_player = &mut game.players[target_index as u64];
        target_player.dir_pref = if (target_player.dir_pref == types::DIR_CW()) {
            types::DIR_CCW()
        } else {
            types::DIR_CW()
        };

        // 转向卡是即时效果，不需要记录buff
    }
}

// ===== Buff管理API函数 =====

// 应用buff到玩家
// last_active_round: 最后一个激活回合（包含）
// 为玩家应用一个buff效果
//
// Buff系统采用包含语义（inclusive semantics）：
// - last_active_round表示buff激活的最后一个回合
// - 当current_round <= last_active_round时，buff处于激活状态
// - 当current_round > last_active_round时，buff已过期
//
// 例如：
// - 当前回合=10，last_active_round=10 → buff仅在第10回合激活
// - 当前回合=10，last_active_round=12 → buff在第10,11,12回合激活
//
// 注意：同类型的buff会互相覆盖（同一时间只能有一个同类型buff）
fun apply_buff(player: &mut Player, kind: u8, last_active_round: u16, value: u64) {
    // 步骤1: 清除同类型的现有buff（确保同类型buff唯一）
    let mut i = 0;
    while (i < player.buffs.length()) {//todo 感觉每次都寻找，有点费
        let buff = player.buffs[i];
        if (buff.kind == kind) {
            player.buffs.remove(i);
            break  // 找到并移除后即可退出
        };
        i = i + 1;
    };

    // 步骤2: 添加新的buff
    let buff = BuffEntry { kind, last_active_round, value, spawn_index: 0xFFFF };
    player.buffs.push_back(buff);
}

// 带来源的buff应用（支持NPC生成的buff）
fun apply_buff_with_source(
    player: &mut Player,
    kind: u8,
    last_active_round: u16,
    value: u64,
    spawn_index: u16
) {
    // 步骤1: 清除同类型的现有buff（确保同类型buff唯一）
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.kind == kind) {
            player.buffs.remove(i);
            break  // 找到并移除后即可退出
        };
        i = i + 1;
    };

    // 步骤2: 添加新的buff
    let buff = BuffEntry { kind, last_active_round, value, spawn_index };
    player.buffs.push_back(buff);
}

// 清除所有已过期的buffs
//
// 遍历玩家的所有buff，移除满足以下条件的buff：
// - current_round > last_active_round（buff已经失效）
//
// 注意：使用倒序遍历或不递增索引的方式处理vector::remove
fun clear_expired_buffs(player: &mut Player, current_round: u16) {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        if (buff.last_active_round < current_round) {
            // buff已过期，移除它
            player.buffs.remove(i);
            // 重要：不增加i，因为vector::remove会将后续元素前移
            // 下次循环仍然检查索引i（现在是原来的i+1位置的元素）
        } else {
            // buff仍有效，检查下一个
            i = i + 1;
        }
    }
}

// 处理并清理过期buffs（包括NPC冷却）
fun process_and_clear_expired_buffs(game: &mut Game, player_index: u8) {
    let current_round = game.round;

    // 先收集过期的buff用于处理NPC冷却
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

    // 处理过期buff的NPC冷却
    let mut j = 0;
    while (j < expired_buffs.length()) {
        handle_buff_expired(game, &expired_buffs[j]);
        j = j + 1;
    };

    // 清理过期的buff
    let player = &mut game.players[player_index as u64];
    clear_expired_buffs(player, current_round);
}

// 检查玩家是否有某种类型的buff处于激活状态
//
// Buff激活判断：current_round <= last_active_round
// 返回true表示buff正在生效，false表示没有该buff或buff已过期
fun is_buff_active(player: &Player, kind: u8, current_round: u16): bool {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        // 找到对应类型且未过期的buff
        if (buff.kind == kind && buff.last_active_round >= current_round) {
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
fun get_buff_value(player: &Player, kind: u8, current_round: u16): u64 {
    let mut i = 0;
    while (i < player.buffs.length()) {
        let buff = player.buffs[i];
        // 找到对应类型且未过期的buff，返回其value
        if (buff.kind == kind && buff.last_active_round >= current_round) {
            return buff.value
        };
        i = i + 1;
    };
    0  // 没有找到激活的buff，返回默认值0
}

// 清理回合状态
fun clean_turn_state(game: &mut Game, player_index: u8) {
    // 处理并清理过期的buff（包括NPC冷却）
    process_and_clear_expired_buffs(game, player_index);
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
fun advance_turn(
    game: &mut Game,
    game_data: &GameData,
    r: &Random,
    ctx: &mut TxContext
) {
    let player_count = game.players.length() as u8;
    let mut attempts = 0;  // 安全计数器

    // 步骤1: 寻找下一个非破产玩家
    loop {
        // 循环递增玩家索引（使用取模实现循环）
        game.active_idx = ((game.active_idx + 1) % player_count);
        attempts = attempts + 1;

        // 获取当前索引指向的玩家
        let current_player = &game.players[game.active_idx as u64];

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
    game.turn = game.active_idx;

    // 步骤3: 如果回到第一个玩家（索引0），说明完成了一轮
    if (game.active_idx == 0) {
        game.round = game.round + 1;  // 增加轮次

        // 轮次结束时的刷新操作
        refresh_at_round_end(game, game_data, r, ctx);

        // 步骤4: 检查是否达到最大轮数限制
        if (game.max_rounds > 0) {  // 0表示无限期
            // 使用 >= 判断：当 round >= max_rounds 时结束（完成 max_rounds 轮后结束）
            if (game.round >= (game.max_rounds as u16)) {
                // 达到轮次上限，游戏结束
                game.status = types::STATUS_ENDED();
                events::emit_game_ended_event(
                    game.id.to_inner(),
                    option::none(),  // TODO: 实现按资产确定赢家
                    (game.round as u16),
                    (game.turn as u8),
                    1  // 结束原因：1表示达到最大轮数
                );
            }
        }
    };

    // 步骤5: 重置游戏阶段为掷骰子
    game.has_rolled = false;
}

// 轮次结束时的刷新操作
fun refresh_at_round_end(
    game: &mut Game,
    game_data: &GameData,
    r: &Random,
    ctx: &mut TxContext
) {
    // 清理过期的NPC
    clean_expired_npcs(game);

    // 生成新的随机NPC（尝试生成2个）
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let mut gen = random::new_generator(r, ctx);
    spawn_random_npc(game, template, &mut gen);

    // TODO: 刷新地产指数
    // refresh_property_index(game);

    // TODO: 其他刷新逻辑
    // refresh_special_tiles(game);

    // 发射轮次结束事件
    events::emit_round_ended_event(
        game.id.to_inner(),
        (game.round - 1),  // 当前轮次已经递增，所以减1表示刚结束的轮次
        (game.round as u64) * (game.players.length())  // 新一轮的第0个全局索引
    );
}

// 清理过期的NPC
fun clean_expired_npcs(_game: &mut Game) {
    // 暂时简化实现：由于sui::table没有keys函数，需要更复杂的实现
    // TODO: 使用LinkedTable或其他方式跟踪所有NPC位置
    // 暂时保留空实现，在其他地方处理NPC过期
}

// 获取全局回合号

// 获取当前轮次
public fun get_round(game: &Game): u16 { game.round }

// 获取轮内回合
public fun get_turn_in_round(game: &Game): u8 { game.turn }

// ===== Public Query Functions 公共查询函数 =====

// 获取Seat的player地址
public fun get_seat_player(seat: &Seat): address { seat.player }

public fun get_game_status(game: &Game): u8 { game.status }
// 获取当前轮和回合
// 返回: (轮次, 轮内回合)
public fun get_current_turn(game: &Game): (u16, u8) {
    (game.round, game.turn)
}
public fun get_active_player_index(game: &Game): u8 { game.active_idx }
public fun get_player_count(game: &Game): u64 { game.players.length() }
public fun get_template_id(game: &Game): u16 { game.template_id }

public fun get_player_position(game: &Game, player: address): u16 {
    let player_index = find_player_index(game, player);
    game.players[player_index as u64].pos
}

public fun get_player_cash(game: &Game, player: address): u64 {
    let player_index = find_player_index(game, player);
    game.players[player_index as u64].cash
}

public fun is_tile_owned(game: &Game, tile_id: u16): bool {
    (game.tiles[tile_id as u64].owner != NO_OWNER)
}

public fun get_tile_owner(game: &Game, tile_id: u16): address {
    let tile = &game.tiles[tile_id as u64];
    assert!(tile.owner != NO_OWNER, ENoSuchTile);
    let owner_index = tile.owner;
    game.players[owner_index as u64].owner
}

public fun get_tile_level(game: &Game, tile_id: u16): u8 {
    game.tiles[tile_id as u64].level
}

public fun is_player_bankrupt(game: &Game, player: address): bool {
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

public fun get_player_card_count(game: &Game, player: address, kind: u8): u8 {
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

// 初始化NPC生成池
fun init_npc_spawn_pool(weights: &vector<u8>): vector<NpcSpawnEntry> {
    let mut pool = vector[];
    let mut i = 0;

    // 权重配置格式：[NPC类型, 权重, NPC类型, 权重, ...]
    while (i < weights.length()) {
        let npc_kind = weights[i];
        let weight = weights[i + 1];

        // 根据权重添加对应数量的条目
        let mut j = 0;
        while (j < weight) {
            pool.push_back(NpcSpawnEntry {
                npc_kind,
                next_active_round: 0  // 初始时所有NPC都可以立即生成
            });
            j = j + 1;
        };

        i = i + 2;  // 移动到下一对(类型,权重)
    };

    pool
}

// 判断NPC是否可消耗
fun is_npc_consumable(npc_kind: u8): bool {
    // 炸弹、财神、土地神、福神、穷神是一次性的
    npc_kind == types::NPC_BOMB() ||
    npc_kind == types::NPC_WEALTH_GOD() ||
    npc_kind == types::NPC_LAND_GOD() ||
    npc_kind == types::NPC_FORTUNE_GOD() ||
    npc_kind == types::NPC_POOR_GOD()
}

// 判断NPC是否是buff型
fun is_buff_npc(npc_kind: u8): bool {
    npc_kind == types::NPC_LAND_GOD() ||
    npc_kind == types::NPC_FORTUNE_GOD()
}

// 随机生成一个NPC到地图上
// 采用简单直接的随机逻辑：
// 1. 在spawn_pool中随机选择一个index
// 2. 如果该NPC不在冷却，尝试放置
// 3. 如果在冷却或无法放置，直接返回
// 注意：使用传入的RandomGenerator，符合一个交易一个generator的最佳实践
public(package) fun spawn_random_npc(
    game: &mut Game,
    template: &MapTemplate,
    gen: &mut RandomGenerator
) {
    // 如果spawn_pool为空，直接返回
    if (game.npc_spawn_pool.is_empty()) return;

    let current_round = game.round;

    // 随机选择一个spawn_pool索引
    let pool_idx = (random::generate_u64(gen) % game.npc_spawn_pool.length()) as u16;

    // 检查是否在冷却中
    let entry = &game.npc_spawn_pool[pool_idx as u64];
    if (entry.next_active_round > current_round) {
        return; // 在冷却中，直接返回
    };

    // 寻找可用地块
    let mut available_tiles = vector[];
    let mut i = 0;
    while (i < game.tiles.length()) {
        let tile_static = map::get_tile(template, i as u16);
        if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
            game.tiles[i].npc_on == NO_NPC &&
            !table::contains(&game.npc_on, i as u16)) {
            available_tiles.push_back(i as u16);
        };
        i = i + 1;
    };

    // 如果没有可用地块，直接返回
    if (available_tiles.is_empty()) return;

    // 随机选择一个地块
    let tile_idx = random::generate_u64(gen) % available_tiles.length();
    let tile_id = available_tiles[tile_idx];

    // 放置NPC
    let npc = NpcInst {
        kind: entry.npc_kind,
        consumable: is_npc_consumable(entry.npc_kind),
        spawn_index: pool_idx
    };
    table::add(&mut game.npc_on, tile_id, npc);
    game.tiles[tile_id as u64].npc_on = entry.npc_kind;

    // 设置冷却
    let cooldown_rounds = if (is_buff_npc(entry.npc_kind)) {
        3  // Buff型NPC：3轮冷却
    } else {
        2  // 普通NPC：2轮冷却
    };
    game.npc_spawn_pool[pool_idx as u64].next_active_round = current_round + cooldown_rounds;

    // TODO: 发出NPC生成事件
    // events::make_npc_change(tile_id, entry.npc_kind, events::npc_action_spawn(), npc.consumable)
}

// 处理NPC消失后的冷却
fun handle_npc_consumed(
    game: &mut Game,
    npc: &NpcInst,
    is_buff_npc: bool
) {
    if (npc.spawn_index == 0xFFFF) {
        return; // 玩家放置的，不处理
    };

    let current_round = game.round;
    let pool_entry = &mut game.npc_spawn_pool[npc.spawn_index as u64];

    if (is_buff_npc) {
        // Buff型NPC需要更长冷却
        // 将在buff过期后由handle_buff_expired设置
    } else {
        // 普通NPC：下下回合可重新加入
        pool_entry.next_active_round = current_round + 2;
    }
}

// 处理Buff过期后的NPC冷却
fun handle_buff_expired(
    game: &mut Game,
    buff: &BuffEntry
) {
    if (buff.spawn_index == 0xFFFF) {
        return; // 非NPC产生的buff
    };

    // Buff过期后，对应NPC可重新加入随机池
    let current_round = game.round;
    let pool_entry = &mut game.npc_spawn_pool[buff.spawn_index as u64];
    pool_entry.next_active_round = current_round + 2;
}

// ===== Test Helper Functions 测试辅助函数 =====

#[test_only]
public fun test_set_player_position(game: &mut Game, player: address, position: u16) {
    let player_index = find_player_index(game, player);
    let player_data = &mut game.players[player_index as u64];
    player_data.pos = position;
}

#[test_only]
public fun test_set_player_cash(game: &mut Game, player: address, cash: u64) {
    let player_index = find_player_index(game, player);
    let player_data = &mut game.players[player_index as u64];
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
public fun get_round_and_turn(game: &Game): (u16, u8) {
    (game.round, game.turn)
}

// 获取当前回合（仅返回turn）
#[test_only]
public fun get_turn(game: &Game): u8 {
    game.turn
}


#[test_only]
public fun current_turn_player(game: &Game): address {
    assert!(game.status == types::STATUS_ACTIVE(), EGameNotActive);
    game.players[game.active_idx as u64].owner
}

#[test_only]
public fun get_property_owner(game: &Game, tile_id: u16): option::Option<address> {
    if (game.tiles[tile_id as u64].owner != NO_OWNER) {
        let owner_index = game.tiles[tile_id as u64].owner;
        let owner_addr = (&game.players[owner_index as u64]).owner;
        option::some(owner_addr)
    } else {
        option::none()
    }
}

#[test_only]
public fun get_property_level(game: &Game, tile_id: u16): u8 {
    game.tiles[tile_id as u64].level
}


#[test_only]
public fun join_with_coin(
    game: &mut Game,
    game_data: &GameData,
    coin: coin::Coin<sui::sui::SUI>,
    ctx: &mut TxContext
) {
//该函数的作用： 在测试环境中，这个函数模拟了玩家需要支付费用才能加入游戏的真实场景：
// 销毁测试币：coin::burn_for_testing(coin) 销毁传入的 SUI 币
// 加入游戏：然后调用普通的 join 函数

    // 销毁测试币并加入游戏
    coin::burn_for_testing(coin);
    join(game, game_data, ctx)
}

#[test_only]
public fun get_players(game: &Game): vector<address> {
    let mut result = vector[];
    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];
        result.push_back(player.owner);
        i = i + 1;
    };
    result
}

#[test_only]
public fun test_give_card(
    game: &mut Game,
    player: address,
    card_kind: u8,
    count: u8
) {
    let player_index = find_player_index(game, player);
    let player_data = &mut game.players[player_index as u64];
    cards::give_card_to_player(&mut player_data.cards, card_kind, count);
}

#[test_only]
public fun test_set_player_in_hospital(
    game: &mut Game,
    player: address,
    turns: u8
) {
    let player_index = find_player_index(game, player);
    let player_data = &mut game.players[player_index as u64];
    player_data.in_hospital_turns = turns;
}

#[test_only]
public fun is_player_in_hospital(
    game: &Game,
    player: address
): bool {
    let player_index = find_player_index(game, player);
    let player_data = &game.players[player_index as u64];
    player_data.in_hospital_turns > 0
}



#[test_only]
public fun handle_tile_stop_effect(
    game: &mut Game,
    player: address,
    tile_id: u16,
    game_data: &GameData
) {
    // 处理停留效果
    let map_registry = tycoon::get_map_registry(game_data);
    let template = map::get_template(map_registry, game.template_id);
    let tile = map::get_tile(template, tile_id);
    let tile_kind = map::tile_kind(tile);
    let player_index = find_player_index(game, player);

    if (tile_kind == types::TILE_PROPERTY()) {
        // 处理地产过路费
        if (game.tiles[tile_id as u64].owner != NO_OWNER) {
            let owner_index = game.tiles[tile_id as u64].owner;
            if (owner_index != player_index) {
                // 计算并支付过路费
                let level = game.tiles[tile_id as u64].level;
                let base_toll = map::tile_base_toll(tile);
                // 计算过路费倍数：0级=1.0, 1级=2.0, 2级=3.0, 3级=4.0, 4级=5.0
                let multiplier = ((level + 1) as u64) * 100;
                let toll = (base_toll * multiplier) / 100;

                // 先检查免租buff
                let has_rent_free = {
                    let player_data = &game.players[player_index as u64];
                    is_buff_active(player_data, types::BUFF_RENT_FREE(), game.round)
                };

                // 如果不免租，执行转账
                if (!has_rent_free) {
                    // 扣除玩家现金
                    let player_data = &mut game.players[player_index as u64];
                    player_data.cash = player_data.cash - toll;

                    // 增加地主现金
                    let owner_data = &mut game.players[owner_index as u64];
                    owner_data.cash = owner_data.cash + toll;
                };
            };
        };
    } else if (tile_kind == types::TILE_CARD()) {
        // 停留抽2张卡
        let player_data = &mut game.players[player_index as u64];
        let (card_kind, _) = cards::draw_card_on_stop(0);
        cards::give_card_to_player(&mut player_data.cards, card_kind, 2);
    };
}

#[test_only]
public fun has_npc_on_tile(game: &Game, tile_id: u16): bool {
    table::contains(&game.npc_on, tile_id)
}

#[test_only]
public fun get_npc_on_tile(game: &Game, tile_id: u16): &NpcInst {
    table::borrow(&game.npc_on, tile_id)
}

#[test_only]
public fun get_npc_kind(npc: &NpcInst): u8 {
    npc.kind
}

#[test_only]
// 已移除全局NPC计数；如需统计请在客户端侧维护或添加专用索引

#[test_only]
public fun get_player_total_cards(game: &Game, player: address): u64 {
    let player_index = find_player_index(game, player);
    let player_data = &game.players[player_index as u64];
    cards::count_total_cards(&player_data.cards)
}

#[test_only]
public fun is_player_frozen(game: &Game, player: address): bool {
    let player_index = find_player_index(game, player);
    let player_data = &game.players[player_index as u64];
    is_buff_active(player_data, types::BUFF_FROZEN(), game.round)
}

#[test_only]
public fun has_buff(game: &Game, player_addr: address, buff_kind: u8): bool {
    let player_index = find_player_index(game, player_addr);
    let player = &game.players[player_index as u64];
    is_buff_active(player, buff_kind, game.round)
}

#[test_only]
public fun apply_buff_to_player(
    game: &mut Game,
    player_addr: address,
    buff_kind: u8,
    turns: u16,
    value: u64
) {
    let player_index = find_player_index(game, player_addr);
    let player = &mut game.players[player_index as u64];
    apply_buff(player, buff_kind, game.round + turns, value);
}

#[test_only]
public fun get_buff_value_for_test(
    game: &Game,
    player_addr: address,
    buff_kind: u8
): u64 {
    let player_index = find_player_index(game, player_addr);
    let player = &game.players[player_index as u64];
    get_buff_value(player, buff_kind, game.round)
}

// ===== Helper Functions (moved from types) =====

// 计算升级成本 - 使用GameData中的配置
public fun calculate_upgrade_cost(price: u64, level: u8, game: &Game, game_data: &GameData): u64 {
    let multipliers = tycoon::get_upgrade_multipliers(game_data);

    // 防御性编程：如果配置为空，使用默认倍率 150% (1.5x)
    if (multipliers.length() == 0) {
        let price_index = calculate_price_index(game);
        return (price * 150 * price_index) / 100
    };

    let idx = (level as u64);
    let level_multiplier = if (idx >= multipliers.length()) {
        // 如果等级超出配置，使用最后一个倍率
        let last_idx = multipliers.length() - 1;
        multipliers[last_idx]
    } else {
        multipliers[idx]
    };

    // 应用物价指数
    let price_index = calculate_price_index(game);
    (price * level_multiplier * price_index) / 100
}

// 计算当前物价指数（内部函数）
// 公式: (round / price_rise_days) + 1
// 返回整数倍率：1, 2, 3...
fun calculate_price_index(game: &Game): u64 {
    let index_level = (game.round as u64) / (game.price_rise_days as u64);
    index_level + 1
}

// 计算过路费 - 加入物价指数影响
public fun calculate_toll(base_toll: u64, level: u8, game: &Game, game_data: &GameData): u64 {
    let multipliers = tycoon::get_toll_multipliers(game_data);

    // 获取等级倍率
    let idx = (level as u64);
    let level_multiplier = if (idx >= multipliers.length()) {
        // 如果等级超出配置，使用最后一个倍率
        let last_idx = multipliers.length() - 1;
        multipliers[last_idx]
    } else {
        multipliers[idx]
    };

    // 计算物价指数
    let price_index = calculate_price_index(game);

    // 应用等级倍率和物价指数
    (base_toll * level_multiplier * price_index) / 100
}

// 检查是否是NPC类型
public fun is_npc(kind: u8): bool {
    kind == types::NPC_BARRIER() || kind == types::NPC_BOMB() || kind == types::NPC_DOG()
}

// 检查是否是会送医院的NPC
public fun is_hospital_npc(kind: u8): bool {
    kind == types::NPC_BOMB() || kind == types::NPC_DOG()
}

// 检查是否是可停留地块
public fun is_stoppable_tile(kind: u8): bool {
    kind == types::TILE_PROPERTY() ||
    kind == types::TILE_HOSPITAL() ||
    kind == types::TILE_PRISON() ||
    kind == types::TILE_CHANCE() ||
    kind == types::TILE_BONUS() ||
    kind == types::TILE_FEE() ||
    kind == types::TILE_CARD() ||
    kind == types::TILE_NEWS() ||
    kind == types::TILE_LOTTERY() ||
    kind == types::TILE_SHOP()
}

// 检查是否是可经过触发的地块
public fun is_passable_trigger(kind: u8): bool {
    kind == types::TILE_CARD() || kind == types::TILE_LOTTERY()
}
