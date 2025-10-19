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
const EShouldSkipTurn: u64 = 6008;  // 当前状态不应跳过回合

// 经济相关错误
const EInsufficientFunds: u64 = 7001;
const EBuildingAlreadyOwned: u64 = 7002;
const ENotBuildingOwner: u64 = 7003;
const EMaxLevelReached: u64 = 7004;
const ENotLargeBuilding: u64 = 7010;         // 不是2x2建筑
const EBuildingTypeAlreadySet: u64 = 7011;   // 建筑类型已设置
const EInvalidBuildingType: u64 = 7012;      // 无效的建筑类型
const EBuildingAlreadyUpgraded: u64 = 7013;  // 建筑已升级，无法选择类型
const EBuildingNotFound: u64 = 7014;         // 建筑不存在

// 地块相关错误（game.move中使用的部分）
const EPosMismatch: u64 = 2003;
const ENotBuilding: u64 = 2004;
const EBuildingOwned: u64 = 2005;
const EBuildingNotOwned: u64 = 2006;
const ENotOwner: u64 = 2007;
const EInvalidPrice: u64 = 2008;
const EMaxLevel: u64 = 2009;
const EInsufficientCash: u64 = 2010;

// 卡牌相关错误（game.move中使用的部分）
const ECardNotOwned: u64 = 5001;
const EInvalidCardTarget: u64 = 5003;
const ECardNotFound: u64 = 5004;
const EInvalidParams: u64 = 5005;  // 参数无效
const ECannotTurn: u64 = 5006;     // 无法使用转向卡（初始位置等）

// 移动相关错误
const EInvalidMove: u64 = 4001;
const EPathTooShort: u64 = 4002;       // path长度不足dice值
const EInvalidPath: u64 = 4003;        // 非法path（包含非邻居或回头）

// NPC相关错误（已无全局数量限制）
const E_NPC_SPAWN_POOL_INDEX_OUT_OF_BOUNDS: u64 = 8001;  // NPC生成池索引越界
const E_TILE_INDEX_OUT_OF_BOUNDS: u64 = 8002;  // 地块索引越界

// Map相关错误（game.move中使用的部分）
const EMapMismatch: u64 = 9001;        // 地图不匹配（传入的map与game创建时的不一致）
const ETileOccupiedByNpc: u64 = 2001;
const ENpcNotFound: u64 = 2002;
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
// - last_tile_id: 上一步所在的tile_id（用于避免回头）
// - next_tile_id: 下一步强制目标tile（INVALID_TILE_ID表示无强制，用于转向卡等）
// - temple_levels: 拥有的土地庙等级列表（用于租金加成计算，Gas优化）
// - buffs: 当前激活的所有Buff列表
public struct Player has store {
    owner: address,
    pos: u16,  // tile_id (最多65535个地块)
    cash: u64,
    in_prison_turns: u8,
    in_hospital_turns: u8,
    bankrupt: bool,
    cards: vector<CardEntry>,  // 改为vector存储
    last_tile_id: u16,  // 上一步的tile（避免回头），初始为spawn_tile的某个邻居
    next_tile_id: u16,  // 下一步强制目标（默认65535=INVALID_TILE_ID）
    temple_levels: vector<u8>,  // 拥有的土地庙等级（Gas优化缓存）
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
    tile_id: u16,     // NPC所在tile
    kind: u8,         // NpcKind
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

// ===== Building Dynamic Data 建筑动态数据 =====

// 建筑动态数据结构
// 与MapTemplate.buildings_static对应，存储游戏中变化的数据
// 使用vector索引对齐，building_id即为数组下标
public struct Building has store, copy, drop {
    owner: u8,          // 所有者玩家索引（NO_OWNER=255表示无主）
    level: u8,          // 建筑等级（0-5级）
    building_type: u8   // 建筑类型（BUILDING_NONE/TEMPLE/RESEARCH等）
                        // 1x1建筑: 始终为BUILDING_NONE
                        // 2x2建筑: 初始BUILDING_NONE，玩家选择后设置为具体类型
}

// ===== Tile Dynamic Data 地块动态数据 =====

// 地块动态数据结构
// 与MapTemplate.tiles_static对应，存储游戏中变化的数据
// 使用vector索引对齐，tile_id即为数组下标
// 现在只存储NPC信息，建筑信息移至Building结构
public struct Tile has store, copy, drop {
    npc_on: u16    // NPC索引（65535表示无NPC，其他值为game.npc_on的index）
}

// 无主建筑的owner值
const NO_OWNER: u8 = 255;
// 无NPC的标记值
const NO_NPC: u16 = 65535;

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
// 建筑系统：
// - tiles: 地块动态数据vector，索引对应tile_id
// - buildings: 建筑动态数据vector，索引对应building_id
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
    template_map_id: ID,  // 使用的地图模板对象ID（防止被偷换）

    players: vector<Player>,

    round: u16,        // 轮次计数器（所有玩家各行动一次）
    turn: u8,          // 轮内回合（0到player_count-1）
    active_idx: u8,
    has_rolled: bool,  // 是否已经掷骰

    // 地块动态数据（与MapTemplate.tiles_static对齐）
    tiles: vector<Tile>,
    // 建筑动态数据（与MapTemplate.buildings_static对齐）
    buildings: vector<Building>,
    npc_on: vector<NpcInst>,      // NPC实例完整数据（vector索引存储在tiles[].npc_on）

    // NPC生成系统
    npc_spawn_pool: vector<NpcSpawnEntry>,  // NPC生成池

    // 配置
    max_rounds: u8,                 // 最大回合数（0表示无限期）
    price_rise_days: u8,            // 物价提升天数

    // 额外状态
    winner: Option<address>,//todo 重构使用Player.rank u8， 第一名就是winner

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
entry fun create_game(
    game_data: &GameData,
    map: &map::MapTemplate,  // 新增：直接传map引用
    params: vector<u64>,  // 通用参数（params[0]=max_rounds, 0表示无限）
    ctx: &mut TxContext
) {
    // 解析参数
    let (starting_cash, price_rise_days, max_rounds) = parse_game_params(&params);

    // 创建游戏对象
    let game_id = object::new(ctx);
    let game_id_copy = game_id.to_inner();

    // 根据地图模板初始化tiles vector
    let tile_count = map::get_tile_count(map);
    let mut tiles = vector[];
    let mut i = 0;
    while (i < tile_count) {
        tiles.push_back(Tile {
            npc_on: NO_NPC
        });
        i = i + 1;
    };

    // 根据地图模板初始化buildings vector
    let building_count = map::get_building_count(map);
    let mut buildings = vector[];
    let mut j = 0;
    while (j < building_count) {
        buildings.push_back(Building {
            owner: NO_OWNER,
            level: 0,
            building_type: types::BUILDING_NONE()  // 所有建筑初始为NONE
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
        max_rounds,
        price_rise_days,
        winner: option::none(),
        pending_decision: types::DECISION_NONE(),
        decision_tile: 0,
        decision_amount: 0
    };

    // 创建者自动加入（使用解析后的起始资金）
    let creator = ctx.sender();
    let player = create_player_with_cash(creator, starting_cash, ctx);
    game.players.push_back(player);

    // 发出游戏创建事件
    let template_map_id = map::get_map_id(map);
    events::emit_game_created_event(
        game_id_copy,
        creator,
        template_map_id
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
entry fun join(
    game: &mut Game,
    game_data: &GameData,
    ctx: &mut TxContext
) {
    let player_addr = ctx.sender();

    // 验证游戏状态
    assert!(game.status == types::STATUS_READY(), EAlreadyStarted);
    // 最大玩家数限制
    assert!(game.players.length() < types::DEFAULT_MAX_PLAYERS() as u64, EJoinFull);


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
    let player = create_player_with_cash(player_addr, starting_cash, ctx);
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
entry fun start(
    game: &mut Game,
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,  // 新增：用于随机分配方向
    clock: &Clock,
    ctx: &mut TxContext
) {
    validate_map(game, map);

    // 验证状态
    assert!(game.status == types::STATUS_READY(), EAlreadyStarted);
    assert!(game.players.length() >= 2, ENotEnoughPlayers);

    // 设置游戏状态
    game.status = types::STATUS_ACTIVE();
    // round和turn已在创建时初始化为0
    game.active_idx = 0;
    game.has_rolled = false;

    let mut generator = random::new_generator(r, ctx);

    // 为每个玩家随机分配不同的初始位置
    let player_count = game.players.length();
    let mut occupied_tiles = vector[];  // 记录已分配的位置
    let mut player_positions = vector[];  // 存储每个玩家的位置

    // 先找出所有玩家的位置
    let mut i = 0;
    while (i < player_count) {
        // 尝试找到一个未被占用的位置
        let mut attempts = 0;
        let mut assigned_pos = 0u16;  // 默认位置

        while (attempts < 10) {  // 最多尝试10次
            let mut tile_opt = random_spawn_tile(game, map, &mut generator);
            if (tile_opt.is_some()) {
                let tile_id = tile_opt.extract();
                // 检查是否已被其他玩家占用
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

    // 然后分配位置给玩家，并初始化last_tile_id
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
            // 如果没有邻居，使用spawn_pos自己（虽然不太可能）
            player.last_tile_id = spawn_pos;
        };

        i = i + 1;
    };

    let starting_player = (&game.players[0]).owner;

    // 生成初始NPC（尝试生成3个）
    let mut i = 0;
    while (i < 3) {
        let (_npc_kind, _tile_id) = spawn_random_npc(game, map, &mut generator);
        // 游戏开始时的NPC生成不需要关心返回值
        i = i + 1;
    };

    // 发出开始事件
    // 构建玩家地址列表
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

// mint_turncap 已被移除，直接使用 Seat 验证身份

// 使用卡牌
entry fun use_card(
    game: &mut Game,
    seat: &Seat,
    kind: u8,
    params: vector<u16>,  // 统一参数：玩家索引、地块ID、骰子值等
    game_data: &GameData,
    map: &map::MapTemplate,
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    // 验证没有待决策
    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);

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
    apply_card_effect_with_collectors(
        game,
        seat.player_index,
        kind,
        &params,
        &mut npc_changes,
        &mut buff_changes,
        &mut cash_changes,
        map
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
// path现在必须始终传递（客户端寻路）
entry fun roll_and_step(
    game: &mut Game,
    seat: &Seat,
    path: vector<u16>,  // 完整路径（客户端寻路生成）
    auto_buy: bool,     // 自动购买无主建筑
    auto_upgrade: bool, // 自动升级自己的建筑
    prefer_rent_card: bool, // 优先使用免租卡支付租金
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    clock: &Clock,//todo 在获取btc价格或者其他defi相关场景的时候会使用到
    ctx: &mut TxContext
) {
    validate_map(game, map);
    validate_seat_and_turn(game, seat);

    // 验证没有待决策
    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);

    // 标记已掷骰
    game.has_rolled = true;

    let player_addr = seat.player;
    let player_index = seat.player_index;

    // 在函数开头创建一个生成器，贯穿整个交易使用
    let mut generator = random::new_generator(r, ctx);

    let player = &game.players[player_index as u64];
    let from_pos = player.pos;
    let has_move_ctrl = is_buff_active(player, types::BUFF_MOVE_CTRL(), game.round);

    // 确定实际使用的骰子点数
    let dice = if (has_move_ctrl) {
        // 有遥控骰子：path长度即为骰子点数
        assert!(!path.is_empty() && path.length() <= 12, EInvalidPath);
        path.length() as u8
    } else {
        // 无遥控骰子：掷骰子，验证path足够长
        let dice_value = get_dice_value(game, player_index, &mut generator);
        assert!(path.length() >= (dice_value as u64), EPathTooShort);
        dice_value
    };

    // 创建事件收集器
    let mut steps = vector[];
    let mut cash_changes = vector[];

    // 执行逐步移动并收集事件数据
    execute_step_movement_with_choices(
        game,
        seat.player_index,
        dice,
        &path,  // 直接传原始path，dice控制使用前N个
        &mut steps,
        &mut cash_changes,
        auto_buy,           // 传递自动购买参数
        auto_upgrade,       // 传递自动升级参数
        prefer_rent_card,   // 传递优先使用免租卡参数
        game_data,
        map,
        &mut generator
    );

    // 获取最终位置
    let end_player = &game.players[player_index as u64];
    let end_pos = end_player.pos;

    // 发射聚合事件（只记录实际使用的path部分）
    // 截取path前dice个用于事件记录
    let mut used_path = vector[];
    let mut i = 0;
    while (i < dice) {
        used_path.push_back(path[i as u64]);
        i = i + 1;
    };

    events::emit_roll_and_step_action_event_with_choices(
        game.id.to_inner(),
        player_addr,
        game.round,
        game.turn,
        dice,
        used_path,  // 记录实际使用的路径
        from_pos,
        steps,
        cash_changes,
        end_pos
    );

    // 清理回合状态
    clean_turn_state(game, player_index);

    // 只在无待决策时推进回合
    if (game.pending_decision == types::DECISION_NONE()) {
        advance_turn(game, game_data, map, r, ctx);
    };
}

// 决定租金支付方式（使用免租卡或支付现金）
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

    // 验证待决策状态
    assert!(game.pending_decision == types::DECISION_PAY_RENT(), EInvalidDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;
    let tile_id = game.decision_tile;
    let toll = game.decision_amount;

    // 获取建筑所有者（需要从tile找到building）
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);
    assert!(building_id != map::no_building(), ENotBuilding);

    let building =&game.buildings[building_id as u64];
    assert!(building.owner != NO_OWNER, EBuildingNotOwned);
    let owner_index = building.owner;

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
    };

    // 清除待决策状态
    clear_decision_state(game);

    // 保存当前值用于事件
    let event_round = game.round;
    let event_turn = game.turn;

    // 发射租金决策事件（使用执行前的值）
    let owner_addr = game.players[owner_index as u64].owner;

    // ✅ 构造租金决策信息
    let rent_info = events::make_rent_decision_info(
        player_addr,
        owner_addr,
        building_id,
        tile_id,
        toll,
        use_rent_free
    );

    // ✅ 发射租金决策事件（使用新签名）
    events::emit_rent_decision_event(
        game.id.to_inner(),
        event_round,
        event_turn,
        false,  // auto_decision: 手动决策
        rent_info
    );

    // 推进回合
    advance_turn(game, game_data, map, r, ctx);
}

// 跳过建筑决策（不购买或不升级）
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

    // 验证有待决策
    assert!(
        game.pending_decision == types::DECISION_BUY_PROPERTY() ||
        game.pending_decision == types::DECISION_UPGRADE_PROPERTY(),
        EInvalidDecision
    );

    let player_addr = seat.player;
    let decision_type = game.pending_decision;  // 保存用于事件
    let decision_tile = game.decision_tile;

    // 清除待决策状态
    clear_decision_state(game);

    // 保存当前值用于事件
    let event_round = game.round;
    let event_turn = game.turn;

    // 发射跳过决策事件（使用执行前的值）
    events::emit_decision_skipped_event(
        game.id.to_inner(),
        player_addr,
        decision_type,
        decision_tile,
        event_round,
        event_turn
    );

    // 推进回合
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

    // 检查现金
    if (player.cash <= price) {
        return (false, option::none())
    };

    let player_addr = player.owner;

    // 扣除现金
    let player_mut = &mut game.players[player_index as u64];
    player_mut.cash = player_mut.cash - price;

    // 设置建筑所有权和等级
    let building_mut = &mut game.buildings[building_id as u64];
    building_mut.owner = player_index;
    building_mut.level = 1;

    // 维护 temple_levels 缓存（如果购买的是土地庙）
    if (building_mut.building_type == types::BUILDING_TEMPLE()) {
        player_mut.temple_levels.push_back(1);  // 新购土地庙初始L1
    };

    // 生成 CashDelta（购买不直接添加到collector，由调用方处理）
    let cash_delta = events::make_cash_delta(
        player_addr,
        true,   // is_debit
        price,
        2,      // reason=buy
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
    building_size: u8,           // 建筑尺寸
    requested_building_type: u8  // 请求的建筑类型（用于2x2 lv0->lv1）
): (bool, option::Option<events::CashDelta>, u8, u8) {
    let player = &game.players[player_index as u64];

    // 检查现金
    if (player.cash <= upgrade_cost) {
        return (false, option::none(), current_level, types::BUILDING_NONE())
    };

    let player_addr = player.owner;

    // 扣除现金
    let player_mut = &mut game.players[player_index as u64];
    player_mut.cash = player_mut.cash - upgrade_cost;

    // 提升等级
    let new_level = current_level + 1;

    // 处理2x2建筑从lv0->lv1的类型设置，并返回最终类型
    let final_building_type = {
        let building_mut = &mut game.buildings[building_id as u64];

        if (building_size == types::SIZE_2X2() && current_level == 0) {
            // 验证建筑类型是否有效（必须是大建筑类型）
            assert!(types::is_large_building_type(requested_building_type), EInvalidBuildingType);

            // TODO: 其他建筑类型功能待实现（research/oil/commercial/hotel）
            // 目前统一设置为 temple，后续实现其他类型功能后修改
            building_mut.building_type = types::BUILDING_TEMPLE();
        };

        building_mut.level = new_level;
        building_mut.building_type  // 返回升级后的建筑类型
    };

    // 维护 temple_levels 缓存（如果是土地庙）
    if (final_building_type == types::BUILDING_TEMPLE()) {
        rebuild_temple_levels_cache(game, player_index);
    };

    // 生成 CashDelta
    let cash_delta = events::make_cash_delta(
        player_addr,
        true,   // is_debit
        upgrade_cost,
        3,      // reason=upgrade
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

    // 决策逻辑：根据 prefer_rent_card 和卡牌可用性
    let use_card = prefer_rent_card && has_rent_free_card;

    if (use_card) {
        // 使用免租卡
        let player_mut = &mut game.players[player_index as u64];
        let used = cards::use_player_card(&mut player_mut.cards, types::CARD_RENT_FREE());
        if (!used) {
            // 卡牌使用失败（不应该发生）
            return (false, cash_deltas, false)
        };

        // 使用卡牌成功，无需支付现金
        return (true, cash_deltas, true)
    } else {
        // 现金支付
        if (player.cash < toll) {
            // 现金不足
            return (false, cash_deltas, false)
        };

        let player_addr = player.owner;
        let owner_addr = (&game.players[owner_index as u64]).owner;

        // 扣除租金
        let player_mut = &mut game.players[player_index as u64];
        player_mut.cash = player_mut.cash - toll;

        // 给所有者加钱
        let owner_player = &mut game.players[owner_index as u64];
        owner_player.cash = owner_player.cash + toll;

        // 记录现金变动 - 支付方
        cash_deltas.push_back(events::make_cash_delta(
            player_addr,
            true,  // is_debit
            toll,
            1,     // reason: toll
            tile_id
        ));

        // 记录现金变动 - 收款方
        cash_deltas.push_back(events::make_cash_delta(
            owner_addr,
            false, // is_debit (income)
            toll,
            1,     // reason: toll
            tile_id
        ));

        return (true, cash_deltas, false)
    }
}

// 处在监狱或医院中，跳过回合； 
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

    // 验证没有待决策
    assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);

    //验证should_skip_turn
    assert!(should_skip_turn(game, seat.player_index), EShouldSkipTurn);

    handle_skip_turn(game, seat.player_index);

    // 推进回合
    advance_turn(game, game_data, map, r, ctx);
}

// // 结束回合，暂时没有使用，现在的游戏设计用不到这个一个，所以去掉entry, 不然调用
// fun end_turn(
//     game: &mut Game,
//     seat: &Seat,
//     game_data: &GameData,
//     map: &map::MapTemplate,
//     r: &Random,
//     ctx: &mut TxContext
// ) {
//     validate_map(game, map);
//     validate_seat_and_turn(game, seat);

//     // 验证没有待决策
//     assert!(game.pending_decision == types::DECISION_NONE(), EPendingDecision);

//     let player_addr = seat.player;
//     let player_index = seat.player_index;

//     // 清理回合状态
//     clean_turn_state(game, player_index);

//     // 发出结束回合事件
//     events::emit_end_turn_event(
//         game.id.to_inner(),
//         player_addr,
//         (game.round as u16),
//         (game.turn as u8)
//     );

//     // 推进回合
//     advance_turn(game, game_data, map, r, ctx);
// }

// 购买建筑
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

    // 验证待决策状态
    assert!(game.pending_decision == types::DECISION_BUY_PROPERTY(), EInvalidDecision);

    let player_addr = seat.player;
    let player_index = seat.player_index;
    let player = &game.players[player_index as u64];
    let tile_id = player.pos;

    // 验证地块位置匹配
    assert!(tile_id == game.decision_tile, EPosMismatch);

    // 获取地块信息
    let tile_static = map::get_tile(map, tile_id);
    let tile_kind = map::tile_kind(tile_static);

    // 获取building_id
    let building_id = map::tile_building_id(tile_static);
    assert!(building_id != map::no_building(), ENotBuilding);

    // 验证建筑无主
    let building =&game.buildings[building_id as u64];
    assert!(building.owner == NO_OWNER, EBuildingOwned);

    // 获取建筑静态信息
    let building_static = map::get_building(map, building_id);

    // 验证价格和现金（应用物价指数）
    let base_price = map::building_price(building_static);
    assert!(base_price > 0, EInvalidPrice);
    let price_index = calculate_price_index(game);
    let price = (base_price * price_index);
    assert!(player.cash > price, EInsufficientCash);

    // 调用内部函数执行购买逻辑
    let (success, _cash_delta_opt) = try_execute_buy_building(
        game, player_index, building_id, tile_id, price, building_static
    );
    assert!(success, EInsufficientCash);

    // 获取购买后的建筑类型
    let building_type = game.buildings[building_id as u64].building_type;

    // 清除待决策状态
    clear_decision_state(game);

    // 保存当前值用于事件
    let event_round = game.round;
    let event_turn = game.turn;

    // 发射建筑决策事件（使用执行前的值）
    // ✅ 构造建筑决策信息
    let decision_info = events::make_building_decision_info(
        types::DECISION_BUY_PROPERTY(),
        building_id,
        tile_id,
        price,
        1,  // new_level
        building_type  // 购买后的建筑类型
    );

    // ✅ 发射建筑决策事件（使用新签名）
    events::emit_building_decision_event(
        game.id.to_inner(),
        player_addr,
        event_round,
        event_turn,
        false,  // auto_decision: 手动决策
        decision_info
    );

    // 推进回合
    advance_turn(game, game_data, map, r, ctx);
}

// 升级建筑
entry fun upgrade_building(
    game: &mut Game,
    seat: &Seat,
    building_type: u8,  // 建筑类型（用于2x2建筑lv0->lv1时设置类型）
    game_data: &GameData,
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    validate_map(game, map);
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
    let tile_static = map::get_tile(map, tile_id);
    let tile_kind = map::tile_kind(tile_static);

    // 获取building_id
    let building_id = map::tile_building_id(tile_static);
    assert!(building_id != map::no_building(), ENotBuilding);

    // 验证建筑所有权
    let building =&game.buildings[building_id as u64];
    assert!(building.owner != NO_OWNER, EBuildingNotOwned);
    let owner_idx = building.owner;
    assert!(owner_idx == player_index, ENotOwner);

    // 验证等级
    let current_level = building.level;
    assert!(current_level < types::LEVEL_4(), EMaxLevel);

    // 获取建筑静态信息
    let building_static = map::get_building(map, building_id);
    let building_size = map::building_size(building_static);

    // 计算升级费用（从当前等级升到下一级）
    let upgrade_cost = calculate_building_price(building_static, building, current_level, current_level + 1, game, game_data);

    // 验证现金
    assert!(player.cash > upgrade_cost, EInsufficientCash);

    // 调用内部函数执行升级逻辑
    let (success, _cash_delta_opt, new_level, final_building_type) = try_execute_upgrade_building(
        game, player_index, building_id, tile_id, upgrade_cost,
        current_level, game_data, building_size, building_type
    );
    assert!(success, EInsufficientCash);

    // 清除待决策状态
    clear_decision_state(game);

    // 保存当前值用于事件
    let event_round = game.round;
    let event_turn = game.turn;

    // 发射建筑决策事件（使用执行前的值）
    // ✅ 构造建筑决策信息
    let decision_info = events::make_building_decision_info(
        types::DECISION_UPGRADE_PROPERTY(),
        building_id,
        tile_id,
        upgrade_cost,
        new_level,
        final_building_type  // 升级后的建筑类型
    );

    // ✅ 发射建筑决策事件（使用新签名）
    events::emit_building_decision_event(
        game.id.to_inner(),
        player_addr,
        event_round,
        event_turn,
        false,  // auto_decision: 手动决策
        decision_info
    );

    // 推进回合
    advance_turn(game, game_data, map, r, ctx);
}

// ===== Internal Functions 内部函数 =====

// 创建玩家（指定起始资金）
fun create_player_with_cash(owner: address, cash: u64, _ctx: &mut TxContext): Player {
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
        last_tile_id: 65535,  // INVALID_TILE_ID，在start()中设置为有效值
        next_tile_id: 65535,  // INVALID_TILE_ID，默认无强制目标
        temple_levels: vector[]  // 初始无土地庙
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

// 检查是否应该跳过回合
fun should_skip_turn(game: &Game, player_index: u8): bool {
    let player = &game.players[player_index as u64];
    player.in_prison_turns > 0 || player.in_hospital_turns > 0
}

// 处理跳过回合
fun handle_skip_turn(game: &mut Game, player_index: u8) {
    let player = &mut game.players[player_index as u64];
    let player_addr = player.owner;

    let (reason, remaining_turns) = if (player.in_prison_turns > 0) {
        player.in_prison_turns = player.in_prison_turns - 1;
        (types::SKIP_PRISON(), player.in_prison_turns)
    } else {
        player.in_hospital_turns = player.in_hospital_turns - 1;
        (types::SKIP_HOSPITAL(), player.in_hospital_turns)
    };

    // 保存 round 和 turn（在 clean_turn_state 之前）
    let event_round = game.round;
    let event_turn = game.turn;

    // 清理回合状态
    clean_turn_state(game, player_index);

    events::emit_skip_turn_event(
        game.id.to_inner(),
        player_addr,
        reason,
        remaining_turns,
        event_round,
        event_turn
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
    auto_buy: bool,           // 自动购买无主建筑
    auto_upgrade: bool,       // 自动升级自己的建筑
    prefer_rent_card: bool,   // 优先使用免租卡支付租金
    game_data: &GameData,
    map: &map::MapTemplate,
    generator: &mut RandomGenerator
) {

    // 先读取必要的玩家信息
    let (from_pos, mut last_tile_id, mut next_tile_id, is_frozen) = {
        let player = &game.players[player_index as u64];
        (player.pos, player.last_tile_id, player.next_tile_id, is_buff_active(player, types::BUFF_FROZEN(), game.round))
    };

    if (is_frozen) {
        // 冻结时不移动，但仍需触发原地停留事件
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
    let mut step_index: u8 = 0;
    let mut i = 0;

    // 逐步移动主循环 - path_choices必须包含完整路径
    while (i < dice) {
        // 从path_choices获取下一个位置
        let next_pos = path_choices[i as u64];

        // 第一步：检查是否有强制目标（转向卡等）
        if (i == 0 && next_tile_id != 65535) {
            // 有强制目标：必须走向 next_tile_id
            assert!(next_pos == next_tile_id, EInvalidPath);
            // 验证 next_tile_id 确实是邻居
            assert!(is_valid_neighbor(map, current_pos, next_pos, 65535), EInvalidPath);
            next_tile_id = 65535;  // 使用后清空
        } else {
            // 正常验证：不能回头（除非是端点tile）
            if (next_pos == last_tile_id) {
                // 要回头：检查是否是端点tile（只有last_tile_id这一个邻居）
                let neighbors = map::get_valid_neighbors(map, current_pos);
                assert!(neighbors.length() == 1 && neighbors[0] == last_tile_id, EInvalidPath);
            } else {
                // 不回头：正常验证
                assert!(is_valid_neighbor(map, current_pos, next_pos, last_tile_id), EInvalidPath);
            }
        };

        let mut pass_draws = vector[];
        let mut npc_event_opt = option::none<events::NpcStepEvent>();
        let mut stop_effect_opt = option::none<events::StopEffect>();

        // 检查下一格的NPC/机关
        let tile_npc_index = game.tiles[next_pos as u64].npc_on;
        if (tile_npc_index != NO_NPC) {
            let npc = game.npc_on[tile_npc_index as u64];

            if (is_hospital_npc(npc.kind)) {
                // 炸弹或狗狗 - 送医院
                {
                    let player = &mut game.players[player_index as u64];
                    player.pos = next_pos;
                };

                // 找医院并送去
                let hospital_tile = find_nearest_hospital(game, next_pos, map, game_data);
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
            let next_tile = map::get_tile(map, next_pos);
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
                auto_buy,
                auto_upgrade,
                prefer_rent_card,
                game_data,
                map,
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

        // 更新last_tile_id为当前位置
        last_tile_id = current_pos;
        current_pos = next_pos;
        step_index = step_index + 1;
        i = i + 1;
    };

    // 更新玩家的 last_tile_id 和 next_tile_id
    {
        let player = &mut game.players[player_index as u64];
        player.last_tile_id = last_tile_id;
        player.next_tile_id = next_tile_id;  // 写回（已清空或仍无效）
    };
}

// 验证next_pos是current_pos的有效邻居，且不是last_tile_id
fun is_valid_neighbor(
    template: &MapTemplate,
    current: u16,
    next: u16,
    last_tile_id: u16
): bool {
    // 禁止回头
    if (next == last_tile_id) return false;

    // 禁止原地不动
    if (next == current) return false;

    let tile = map::get_tile(template, current);

    // 检查是否是四个方向的邻居之一
    next == map::tile_w(tile) ||
    next == map::tile_n(tile) ||
    next == map::tile_e(tile) ||
    next == map::tile_s(tile)
}

// UNUSED: handle_tile_pass - 已被 handle_tile_stop_with_collector 替代
// fun handle_tile_pass(
//     game: &mut Game,
//     player_index: u8,
//     tile_id: u16,
//     game_data: &GameData,
//     generator: &mut RandomGenerator
// ) {
//     let map_registry = tycoon::get_map_registry(game_data);
//     // TODO: 需要传入map参数: let template = map::get_template(map_registry, game.template_id);
//     // TODO: 需要传入map参数: let tile = map::get_tile(template, tile_id);
//     let tile_kind = map::tile_kind(tile);
//
//     // 只有卡片格和彩票格在经过时触发（固定行为）
//     if (is_passable_trigger(tile_kind)) {
//         if (tile_kind == types::TILE_CARD()) {
//             // 抽卡
//             let random_value = generator.generate_u8();
//             let (card_kind, count) = cards::draw_card_on_pass(random_value);
//             let player = &mut game.players[player_index as u64];
//             cards::give_card_to_player(&mut player.cards, card_kind, count);
//         } else if (tile_kind == types::TILE_LOTTERY()) {
//             // 彩票逻辑（简化）
//             // TODO: 实现彩票系统
//         };
//     }
// }

// UNUSED: handle_tile_stop - 已被 handle_tile_stop_with_collector 替代
// fun handle_tile_stop(
//     game: &mut Game,
//     player_index: u8,
//     tile_id: u16,
//     game_data: &GameData,
//     generator: &mut RandomGenerator
// ) {
//     let map_registry = tycoon::get_map_registry(game_data);
//     // TODO: 需要传入map参数: let template = map::get_template(map_registry, game.template_id);
//     // TODO: 需要传入map参数: let tile = map::get_tile(template, tile_id);
//     let tile_kind = map::tile_kind(tile);
//     let player_addr = (&game.players[player_index as u64]).owner;
//
//     // 先检查是否有建筑
//     let building_id = map::tile_building_id(tile);
//     if (building_id != map::no_building()) {
//         // 有建筑：处理建筑逻辑（购买/升级/租金）
//         handle_building_stop(game, player_index, tile_id, tile, game_data);
//         // 有建筑的tile不再有其他功能
//         return
//     };
//
//     // 按tile_kind处理功能性tile
//     if (tile_kind == types::TILE_HOSPITAL()) {
//         handle_hospital_stop(game, player_index, tile_id);
//     } else if (tile_kind == types::TILE_PRISON()) {
//         handle_prison_stop(game, player_index, tile_id);
//     } else if (tile_kind == types::TILE_CARD()) {
//         // 停留时也抽卡
//         let random_value = generator.generate_u8();
//         let (card_kind, count) = cards::draw_card_on_stop(random_value);
//         let player = &mut game.players[player_index as u64];
//         cards::give_card_to_player(&mut player.cards, card_kind, count);
//     } else if (tile_kind == types::TILE_CHANCE()) {
//         // TODO: 实现机会事件
//     } else if (tile_kind == types::TILE_BONUS()) {
//         // 奖励
//         let base_bonus = map::tile_special(tile);
//         let price_index = calculate_price_index(game);
//         let bonus = base_bonus * price_index;  // 应用物价指数
//         let player = &mut game.players[player_index as u64];
//         player.cash = player.cash + bonus;
//     } else if (tile_kind == types::TILE_FEE()) {
//         // 罚款
//         let base_fee = map::tile_special(tile);
//         let price_index = calculate_price_index(game);
//         let fee = base_fee * price_index;  // 应用物价指数
//         let player = &mut game.players[player_index as u64];
//         if (player.cash >= fee) {
//             player.cash = player.cash - fee;
//         } else {
//             player.cash = 0;
//             // TODO: 处理破产
//         };
//     }
//     // 其他地块类型...
// }

// 处理停留地块（带事件收集器）
fun handle_tile_stop_with_collector(
    game: &mut Game,
    player_index: u8,
    tile_id: u16,
    cash_changes: &mut vector<events::CashDelta>,
    auto_buy: bool,           // 自动购买无主建筑
    auto_upgrade: bool,       // 自动升级自己的建筑
    prefer_rent_card: bool,   // 优先使用免租卡支付租金
    game_data: &GameData,
    map: &map::MapTemplate,
    generator: &mut RandomGenerator
): events::StopEffect {
    let tile = map::get_tile(map, tile_id);
    let tile_kind = map::tile_kind(tile);
    let player_addr = (&game.players[player_index as u64]).owner;

    let mut stop_type = events::stop_none();
    let mut amount = 0;
    let mut owner_opt = option::none<address>();
    let mut level_opt = option::none<u8>();
    let mut turns_opt = option::none<u8>();
    let mut card_gains = vector<events::CardDrawItem>[];
    let mut building_decision_opt = option::none<events::BuildingDecisionInfo>();  // ✅ 新增
    let mut rent_decision_opt = option::none<events::RentDecisionInfo>();          // ✅ 新增

    // 检查是否有建筑（不基于tile_kind，而是基于building_id）
    let building_id = map::tile_building_id(tile);
    if (building_id != map::no_building()) {
        let building =&game.buildings[building_id as u64];
        let building_static = map::get_building(map, building_id);

        if (building.owner == NO_OWNER) {
                // 无主建筑 - 尝试自动购买或设置待决策状态
                let base_price = map::building_price(building_static);
                let price_index = calculate_price_index(game);
                let price = base_price * price_index;

                if (auto_buy) {
                    // 尝试自动购买
                    let (success, cash_delta_opt) = try_execute_buy_building(
                        game, player_index, building_id, tile_id, price, building_static
                    );

                    if (success) {
                        // 自动购买成功
                        stop_type = events::stop_building_unowned();
                        if (cash_delta_opt.is_some()) {
                            cash_changes.push_back(cash_delta_opt.destroy_some());
                        };

                        // ✅ 构造建筑决策信息
                        let purchased_building = &game.buildings[building_id as u64];
                        let decision_info = events::make_building_decision_info(
                            types::DECISION_BUY_PROPERTY(),
                            building_id,
                            tile_id,
                            price,
                            1,  // new_level
                            purchased_building.building_type
                        );

                        // ✅ 发射建筑决策事件（使用新签名）
                        events::emit_building_decision_event(
                            game.id.to_inner(),
                            player_addr,
                            game.round,
                            game.turn,
                            true,  // auto_decision
                            decision_info
                        );

                        // ✅ 保存决策信息到 StopEffect
                        building_decision_opt = option::some(decision_info);

                        // 不设置 pending_decision
                    } else {
                        // 现金不足，设置待决策（让玩家选择其他方式或跳过）
                        stop_type = events::stop_building_unowned();
                        game.pending_decision = types::DECISION_BUY_PROPERTY();
                        game.decision_tile = tile_id;
                        game.decision_amount = price;
                    }
                } else {
                    // 自动购买未启用，设置待决策
                    stop_type = events::stop_building_unowned();
                    game.pending_decision = types::DECISION_BUY_PROPERTY();
                    game.decision_tile = tile_id;
                    game.decision_amount = price;
                }
            } else {
                let owner_index = building.owner;
                if (owner_index != player_index) {
                    // 他人的建筑 - 需要支付过路费
                    let level = building.level;
                    let toll = calculate_toll(game, tile_id, map, game_data);

                    // 检查免租情况
                    let player = &game.players[player_index as u64];
                    let has_rent_free_buff = is_buff_active(player, types::BUFF_RENT_FREE(), game.round);
                    let has_rent_free_card = cards::player_has_card(&player.cards, types::CARD_RENT_FREE());

                    if (has_rent_free_buff) {
                        // 有免租buff - 直接免租，无需决策
                        stop_type = events::stop_building_no_rent();
                        let owner_addr = (&game.players[owner_index as u64]).owner;
                        owner_opt = option::some(owner_addr);
                        level_opt = option::some(level);
                        amount = 0;
                    } else if (has_rent_free_card || prefer_rent_card) {
                        // 有免租卡或prefer_rent_card=true - 尝试自动支付
                        let (success, cash_deltas, used_card) = try_execute_rent_payment(
                            game, player_index, owner_index, tile_id, toll, prefer_rent_card
                        );

                        if (success) {
                            // 自动支付成功
                            if (used_card) {
                                stop_type = events::stop_building_no_rent();
                                // 发射租金决策事件（使用卡牌）
                                let owner_addr = game.players[owner_index as u64].owner;

                                // ✅ 构造租金决策信息
                                let rent_info = events::make_rent_decision_info(
                                    player_addr,
                                    owner_addr,
                                    building_id,
                                    tile_id,
                                    toll,
                                    true  // use_rent_free
                                );

                                // ✅ 发射租金决策事件（使用新签名）
                                events::emit_rent_decision_event(
                                    game.id.to_inner(),
                                    game.round,
                                    game.turn,
                                    true,  // auto_decision: 自动决策
                                    rent_info
                                );

                                // ✅ 保存决策信息到 StopEffect
                                rent_decision_opt = option::some(rent_info);
                            } else {
                                stop_type = events::stop_building_toll();
                                // 添加现金变动记录
                                let mut i = 0;
                                while (i < cash_deltas.length()) {
                                    cash_changes.push_back(cash_deltas[i]);
                                    i = i + 1;
                                };
                                amount = toll;

                                // 发射租金决策事件（使用现金）
                                let owner_addr = game.players[owner_index as u64].owner;

                                // ✅ 构造租金决策信息
                                let rent_info = events::make_rent_decision_info(
                                    player_addr,
                                    owner_addr,
                                    building_id,
                                    tile_id,
                                    toll,
                                    false  // use_rent_free
                                );

                                // ✅ 发射租金决策事件（使用新签名）
                                events::emit_rent_decision_event(
                                    game.id.to_inner(),
                                    game.round,
                                    game.turn,
                                    true,  // auto_decision: 自动决策
                                    rent_info
                                );

                                // ✅ 保存决策信息到 StopEffect
                                rent_decision_opt = option::some(rent_info);
                            };

                            let owner_addr = (&game.players[owner_index as u64]).owner;
                            owner_opt = option::some(owner_addr);
                            level_opt = option::some(level);
                        } else {
                            // 自动支付失败（现金不足），设置待决策
                            stop_type = events::stop_building_toll();
                            game.pending_decision = types::DECISION_PAY_RENT();
                            game.decision_tile = tile_id;
                            game.decision_amount = toll;
                            let owner_addr = (&game.players[owner_index as u64]).owner;
                            owner_opt = option::some(owner_addr);
                            level_opt = option::some(level);
                            amount = toll;
                        }
                    } else {
                        // 既没有buff也没有卡，且prefer_rent_card=false - 直接扣费
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

                            stop_type = events::stop_building_toll();
                            amount = actual_payment;
                        };

                        // 检查破产
                        if (should_bankrupt) {
                            let owner_addr = (&game.players[owner_index as u64]).owner;
                            handle_bankruptcy(game, game_data, map, player_addr, option::some(owner_addr));
                        };

                        let owner_addr = (&game.players[owner_index as u64]).owner;
                        owner_opt = option::some(owner_addr);
                        level_opt = option::some(level);
                    }
            } else {
                // 自己的建筑 - 检查是否可以升级
                let level = building.level;
                let player_addr = (&game.players[player_index as u64]).owner;

                if (level < types::LEVEL_4()) {
                    // 可以升级 - 尝试自动升级或设置待决策状态
                    let upgrade_cost = calculate_building_price(building_static, building, level, level + 1, game, game_data);

                    // 检查是否需要玩家决策建筑类型（2x2建筑从lv0->lv1且类型为NONE）
                    let building_size = map::building_size(building_static);
                    let needs_type_selection =
                        building_size == types::SIZE_2X2() &&
                        level == 0 &&
                        building.building_type == types::BUILDING_NONE();

                    if (auto_upgrade && !needs_type_selection) {
                        // 可以自动升级（不需要类型选择）
                        let (success, cash_delta_opt, new_level, final_type) = try_execute_upgrade_building(
                            game, player_index, building_id, tile_id, upgrade_cost, level, game_data,
                            building_size, types::BUILDING_TEMPLE()  // 自动升级默认使用TEMPLE
                        );

                        if (success) {
                            // 自动升级成功
                            stop_type = events::stop_none();  // 自己的建筑，无特殊效果
                            if (cash_delta_opt.is_some()) {
                                cash_changes.push_back(cash_delta_opt.destroy_some());
                            };

                            // ✅ 构造建筑决策信息
                            let decision_info = events::make_building_decision_info(
                                types::DECISION_UPGRADE_PROPERTY(),
                                building_id,
                                tile_id,
                                upgrade_cost,
                                new_level,
                                final_type
                            );

                            // ✅ 发射建筑决策事件（使用新签名）
                            events::emit_building_decision_event(
                                game.id.to_inner(),
                                player_addr,
                                game.round,
                                game.turn,
                                true,  // auto_decision
                                decision_info
                            );

                            // ✅ 保存决策信息到 StopEffect
                            building_decision_opt = option::some(decision_info);

                            // 不设置 pending_decision
                        } else {
                            // 现金不足，设置待决策
                            stop_type = events::stop_none();  // 自己的建筑，无特殊效果
                            game.pending_decision = types::DECISION_UPGRADE_PROPERTY();
                            game.decision_tile = tile_id;
                            game.decision_amount = upgrade_cost;
                        }
                    } else {
                        // 需要玩家决策（自动升级未启用 或 需要选择建筑类型）
                        stop_type = events::stop_none();  // 自己的建筑，无特殊效果
                        game.pending_decision = types::DECISION_UPGRADE_PROPERTY();
                        game.decision_tile = tile_id;
                        game.decision_amount = upgrade_cost;
                    }
                } else {
                    // 已达最高级
                    stop_type = events::stop_none();  // 自己的建筑，无特殊效果
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
    } else if (tile_kind == types::TILE_CHANCE()) {
        // TODO: 实现机会事件
        stop_type = events::stop_none();
    } else if (tile_kind == types::TILE_NEWS()) {
        // TODO: 实现新闻事件
        stop_type = events::stop_none();
    } else if (tile_kind == types::TILE_LOTTERY()) {
        // TODO: 实现彩票事件
        stop_type = events::stop_none();
    } else if (tile_kind == types::TILE_SHOP()) {
        // TODO: 实现商店功能
        stop_type = events::stop_none();
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
            handle_bankruptcy(game, game_data, map, player_addr, option::none());
        }
    } else {
        // 其他未处理的地块类型
        stop_type = events::stop_none();
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
        card_gains,
        game.pending_decision,
        game.decision_tile,
        game.decision_amount,
        building_decision_opt,  // ✅ 建筑决策信息
        rent_decision_opt       // ✅ 租金决策信息
    )
}

// UNUSED: handle_building_stop - 已被 handle_tile_stop_with_collector 中的逻辑替代
// fun handle_building_stop(
//     game: &mut Game,
//     player_index: u8,
//     tile_id: u16,
//     tile_static: &map::TileStatic,
//     game_data: &GameData
// ) {
//     let map_registry = tycoon::get_map_registry(game_data);
//     // TODO: 需要传入map参数: let template = map::get_template(map_registry, game.template_id);
//     let player_addr = (&game.players[player_index as u64]).owner;
//
//     // 获取building_id
//     let building_id = map::tile_building_id(tile_static);
//     if (building_id == map::no_building()) {
//         return  // 非建筑tile
//     };
//
//     let building =&game.buildings[building_id as u64];
//
//     if (building.owner == NO_OWNER) {
//         // 无主建筑 - 可以购买
//         // TODO: 实现购买逻辑（需要用户确认）
//     } else {
//         let owner_index = building.owner;
//         if (owner_index != player_index) {
//             // 需要支付过路费
//             let level = building.level;
//             // TODO: 需要传入map参数: let toll = calculate_toll(game, tile_id, template, game_data);
//
//             let player = &mut game.players[player_index as u64];
//
//             // 检查免租
//             let has_rent_free = is_buff_active(player, types::BUFF_RENT_FREE(), game.round);
//
//             if (has_rent_free) {
//                 // 免租
//                 return
//             };
//
//             // 支付过路贩
//             let actual_toll = if (player.cash >= toll) {
//                 player.cash = player.cash - toll;
//                 toll
//             } else {
//                 // 现金不足 - 破产
//                 let paid = player.cash;
//                 player.cash = 0;
//                 paid
//             };
//
//             // 给房主加钱
//             let owner_player = &mut game.players[owner_index as u64];
//             owner_player.cash = owner_player.cash + actual_toll;
//
//             // 如果支付不足，处理破产
//             if (actual_toll < toll) {
//                 let owner_addr = owner_player.owner;
//                 handle_bankruptcy(game, game_data, player_addr, option::some(owner_addr));
//             };
//         }
//     }
// }

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
fun find_nearest_hospital(game: &Game, current_pos: u16, map: &map::MapTemplate, _game_data: &GameData): u16 {
    let hospital_ids = map::get_hospital_ids(map);

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

// UNUSED: send_to_hospital - 未被调用
// fun send_to_hospital(game: &mut Game, player_index: u8, map: &map::MapTemplate, _game_data: &GameData) {
//     let hospital_ids = map::get_hospital_ids(map);
//
//     if (!hospital_ids.is_empty()) {
//         let hospital_tile = hospital_ids[0];
//         let player = &mut game.players[player_index as u64];
//         player.pos = hospital_tile;
//         player.in_hospital_turns = types::DEFAULT_HOSPITAL_TURNS();
//     }
// }

// 处理破产
// 处理玩家破产的完整流程
//
// 破产处理步骤：
// 1. 标记玩家破产状态，防止其继续参与游戏
// 2. 释放该玩家拥有的所有建筑：
//    - 重置建筑所有权为NO_OWNER
//    - 重置建筑等级为0（恢复初始状态）
// 3. 发送破产事件通知
// 4. 检查游戏结束条件：
//    - 如果只剩一个非破产玩家，该玩家获胜
//    - 游戏状态设置为结束，记录获胜者
//
// 参数说明：
// - player_addr: 破产玩家的地址
// - creditor: 导致破产的债权人（如收租的建筑拥有者）
fun handle_bankruptcy(
    game: &mut Game,
    game_data: &GameData,
    map: &map::MapTemplate,
    player_addr: address,
    creditor: Option<address>
) {
    // 步骤1: 设置破产标志，标记玩家已出局
    let player_index = find_player_index(game, player_addr);
    {
        let player = &mut game.players[player_index as u64];
        player.bankrupt = true;
    };

    // 步骤2: 释放玩家拥有的所有建筑
    // 只重置所有权，保留建筑等级（其他玩家可以购买高等级建筑）
    let mut i = 0;
    while (i < game.buildings.length()) {
        let building = &mut game.buildings[i];
        if (building.owner == player_index) {
            building.owner = NO_OWNER;
            // 保留 building.level（不重置为0）
        };
        i = i + 1;
    };

    // 清空玩家的土地庙缓存
    {
        let player_mut = &mut game.players[player_index as u64];
        player_mut.temple_levels = vector[];
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
    assert!(game.tiles[tile_id as u64].npc_on == NO_NPC, ETileOccupiedByNpc);
    let npc = NpcInst {
        tile_id,
        kind,
        consumable,
        spawn_index: 0xFFFF  // 玩家手动放置的NPC
    };
    let npc_index = game.npc_on.length();
    game.npc_on.push_back(npc);
    // 更新 Tile 中的 NPC 索引
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

    // 关键：更新被swap到当前位置的NPC的tile索引
    if ((tile_npc_index as u64) < game.npc_on.length()) {
        let moved_npc = &game.npc_on[tile_npc_index as u64];
        let moved_tile_id = moved_npc.tile_id;
        game.tiles[moved_tile_id as u64].npc_on = tile_npc_index;
    };

    npc_changes.push_back(
        events::make_npc_change(tile_id, npc.kind, events::npc_action_remove(), npc.consumable)
    );
}

// 消耗NPC（用于玩家踩到NPC时）
// 注意：这个函数不生成NpcChangeItem事件，因为消耗信息已经在NpcStepEvent中体现
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

        // 关键：更新被swap到当前位置的NPC的tile索引
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

// 应用卡牌效果（带事件收集器）
fun apply_card_effect_with_collectors(
    game: &mut Game,
    player_index: u8,
    kind: u8,
    params: &vector<u16>,  // 统一参数
    npc_changes: &mut vector<events::NpcChangeItem>,
    buff_changes: &mut vector<events::BuffChangeItem>,
    cash_changes: &mut vector<events::CashDelta>,
    _map: &map::MapTemplate  // 保留下划线前缀，表示暂时未使用但保留接口
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
        if (game.tiles[tile_id as u64].npc_on == NO_NPC) {
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
        // 转向卡：设置next_tile_id为last_tile_id，允许下一步回头
        // params[0]=目标玩家索引（可选，默认为自己）

        let target_index = if (params.length() > 0) {
            (params[0] as u8)
        } else {
            player_index
        };
        assert!((target_index as u64) < game.players.length(), EPlayerNotFound);

        let target_player = &mut game.players[target_index as u64];

        // 验证 last_tile_id 有效（不是初始值）
        assert!(target_player.last_tile_id != 65535, ECannotTurn);

        // 设置 next_tile_id 为 last_tile_id（强制下一步回头）
        target_player.next_tile_id = target_player.last_tile_id;

        // 转向卡是即时效果，不需要记录buff
        // next_tile_id 会在 roll_and_step 的第一步使用后自动清空
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

/// 找出现金最多的玩家
///
/// 逻辑：
/// - 遍历所有玩家
/// - 过滤掉破产的玩家（bankrupt == true）
/// - 找出 cash 最高的玩家
/// - 如果有多个玩家现金相同，返回索引最小的（先加入的玩家）
///
/// @param game 游戏对象
/// @return 最富有玩家的地址，如果所有玩家都破产则返回 None
fun find_richest_player(game: &Game): Option<address> {
    let mut max_cash: u64 = 0;
    let mut richest_player: Option<address> = option::none();

    let mut i = 0;
    while (i < game.players.length()) {
        let player = &game.players[i];

        // 跳过破产玩家
        if (!player.bankrupt) {
            // 找出现金最多的玩家（>确保索引小的玩家优先）
            if (player.cash > max_cash) {
                max_cash = player.cash;
                richest_player = option::some(player.owner);
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
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    let player_count = game.players.length() as u8;
    let mut attempts = 0;  // 安全计数器
    let mut will_wrap = false;  // 回绕标志

    // 步骤1: 寻找下一个非破产玩家
    loop {
        // 在递增之前检测是否会回绕
        if ((game.active_idx + 1) >= player_count) {
            will_wrap = true;
        };

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

    // 步骤3: 如果检测到回绕，说明完成了一轮
    if (will_wrap) {
        game.round = game.round + 1;  // 增加轮次

        // 轮次结束时的刷新操作
        refresh_at_round_end(game, game_data, map, r, ctx);

        // 步骤4: 检查是否达到最大轮数限制
        if (game.max_rounds > 0) {  // 0表示无限期
            // 使用 >= 判断：当 round >= max_rounds 时结束（完成 max_rounds 轮后结束）
            if (game.round >= (game.max_rounds as u16)) {
                // 达到轮次上限，游戏结束
                game.status = types::STATUS_ENDED();

                // 找出现金最多的玩家作为赢家
                let winner = find_richest_player(game);
                game.winner = winner;  // 设置 game.winner 字段

                events::emit_game_ended_event(
                    game.id.to_inner(),
                    winner,  // 按现金确定的赢家
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
    map: &map::MapTemplate,
    r: &Random,
    ctx: &mut TxContext
) {
    // 清理过期的NPC
    clean_expired_npcs(game);

    // 生成新的随机NPC（只生成1个）
    let mut generator = random::new_generator(r, ctx);
    let (npc_kind, tile_id) = spawn_random_npc(game, map, &mut generator);

    // 发射轮次结束事件
    events::emit_round_ended_event(
        game.id.to_inner(),
        (game.round - 1),  // 当前轮次已经递增，所以减1表示刚结束的轮次
        npc_kind,          // 新生成的NPC类型（0表示没有生成）
        tile_id            // NPC放置的地块ID
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
public fun get_template_map_id(game: &Game): ID { game.template_map_id }

public fun get_player_position(game: &Game, player: address): u16 {
    let player_index = find_player_index(game, player);
    game.players[player_index as u64].pos
}

public fun get_player_cash(game: &Game, player: address): u64 {
    let player_index = find_player_index(game, player);
    game.players[player_index as u64].cash
}

public fun is_tile_owned(game: &Game, map: &map::MapTemplate, _game_data: &GameData, tile_id: u16): bool {
    // 获取tile对应的building_id
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);

    if (building_id == map::no_building()) {
        return false
    };

    (game.buildings[building_id as u64].owner != NO_OWNER)
}

public fun get_tile_owner(game: &Game, map: &map::MapTemplate, _game_data: &GameData, tile_id: u16): address {
    // 获取tile对应的building_id
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);

    assert!(building_id != map::no_building(), ENoSuchTile);

    let building =&game.buildings[building_id as u64];
    assert!(building.owner != NO_OWNER, ENoSuchTile);
    let owner_index = building.owner;
    game.players[owner_index as u64].owner
}

public fun get_tile_level(game: &Game, map: &map::MapTemplate, _game_data: &GameData, tile_id: u16): u8 {
    // 获取tile对应的building_id
    let tile_static = map::get_tile(map, tile_id);
    let building_id = map::tile_building_id(tile_static);

    if (building_id == map::no_building()) {
        return 0
    };

    game.buildings[building_id as u64].level
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
    npc_type: u8  // NPC类型，用于生成不同的起点，避免同类NPC聚集
): Option<u16> {
    let tile_count = game.tiles.length();
    if (tile_count == 0) return option::none();

    // ===== 步骤1：确定起点 =====
    // 使用 (随机数 + NPC类型) 作为种子，确保：
    // - 同一轮次不同类型NPC从不同位置开始探测
    // - 避免所有NPC都从相同位置开始导致聚集
    let start_pos = (random::generate_u64(gen) + (npc_type as u64)) % tile_count;

    // ===== 步骤2：选择探测步长 =====
    // 使用素数作为步长的好处：
    // - 素数与tile_count互质概率高，能遍历更多不同位置
    // - 避免探测路径出现短周期循环
    // - 不同地图规模使用不同素数集，优化探测效率
    let primes = if (tile_count <= 10) {
        // 小地图(8格测试地图)：使用小素数
        // 3和5与8互质，能保证良好覆盖
        vector[3u64, 5]
    } else if (tile_count <= 30) {
        // 中型地图(28格标准地图)：使用中等素数
        // 这些素数能在8次探测内覆盖合理范围
        vector[3u64, 5, 7, 11]
    } else {
        // 大型地图(50+格)：使用较大素数
        // 大步长快速跳过已占用区域，提高找到空位概率
        vector[7u64, 11, 13, 17, 19]
    };

    // 随机选择一个素数作为步长
    let step = primes[random::generate_u64(gen) % primes.length()];

    // ===== 步骤3：确定最大探测次数 =====
    // 根据地图大小动态调整，平衡gas消耗和成功率
    // - 小地图：4次（覆盖50%地块）
    // - 中大地图：8次（覆盖约25-30%地块）
    // - 如果8次都没找到，说明地图较满，回退到完整扫描
    let max_attempts = if (tile_count <= 10) 4 else 8;

    // ===== 步骤4：探针式查找 =====
    let mut i = 0;
    while (i < max_attempts) {
        // 计算探测位置：起点 + i*步长，对总数取模实现环形遍历
        // 例如：8格地图，起点=2，步长=3，探测序列为：2,5,0,3,6,1,4,7
        let pos = ((start_pos + i * step) % tile_count) as u16;

        // 获取地块静态信息（类型、价格等）
        let tile_static = map::get_tile(template, pos);

        // 检查三个条件：
        // 1. 地块类型允许放置NPC（PROPERTY或EMPTY）
        // 2. 地块上当前没有NPC（npc_on == NO_NPC）
        // 注意：不需要检查npc_on表，因为tiles[i].npc_on已包含此信息
        if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
            game.tiles[pos as u64].npc_on == NO_NPC) {

            // ===== 可选：邻格检查（避免NPC过度聚集）=====
            // 如果需要更分散的分布，可以检查相邻地块
            // 这里暂不实现，因为会增加复杂度和gas消耗

            return option::some(pos)
        };

        i = i + 1;
    };

    // 所有探测位置都被占用，返回none
    // 调用方应该处理这种情况（回退到全量扫描或放弃）
    option::none()
}

// ===== 改进版random_spawn_tile（带探针优化）=====
//
// 混合策略：先尝试探针法，失败后回退到全量扫描
// 这样在大多数情况下能节省gas，同时保证总能找到位置（如果存在）
//
// 使用场景：
// - 玩家初始位置分配（不知道具体NPC类型时）
// - 通用的随机地块选择
fun random_spawn_tile(
    game: &Game,
    template: &MapTemplate,
    gen: &mut RandomGenerator
): Option<u16> {
    // 先尝试探针法
    // 使用0作为默认类型值（相当于通用探测）
    let result = random_spawn_tile_probing(game, template, gen, 0);

    // 如果探针法成功，直接返回
    if (result.is_some()) {
        return result
    };

    // ===== Fallback：全量扫描（原实现）=====
    // 探针法失败说明空闲地块很少，需要完整扫描确保找到

    // 收集所有可用地块
    let mut available_tiles = vector[];
    let mut i = 0;
    while (i < game.tiles.length()) {
        let tile_static = map::get_tile(template, i as u16);
        // 检查条件：
        // 1. 地块类型允许放置（PROPERTY或EMPTY）
        // 2. 地块上没有NPC
        // 注意：去掉了table::contains检查，因为tiles[i].npc_on已经包含信息
        if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
            game.tiles[i].npc_on == NO_NPC) {
            available_tiles.push_back(i as u16);
        };
        i = i + 1;
    };

    // 如果没有可用地块，返回none
    if (available_tiles.is_empty()) {
        return option::none()
    };

    // 随机选择一个地块
    let tile_idx = random::generate_u64(gen) % available_tiles.length();
    option::some(available_tiles[tile_idx])
}

// 随机生成一个NPC到地图上
// 采用简单直接的随机逻辑：
// 1. 在spawn_pool中随机选择一个index
// 2. 如果该NPC不在冷却，尝试放置
// 3. 如果在冷却或无法放置，直接返回（注意：没有可用地块时不设置冷却）
// 注意：使用传入的RandomGenerator，符合一个交易一个generator的最佳实践
public(package) fun spawn_random_npc(
    game: &mut Game,
    template: &MapTemplate,
    gen: &mut RandomGenerator
): (u8, u16) {  // 返回 (npc_kind, tile_id)，如果失败返回 (0, 0)
    // 如果spawn_pool为空，直接返回
    if (game.npc_spawn_pool.is_empty()) return (0, 0);

    let current_round = game.round;

    // 随机选择一个spawn_pool索引
    let pool_idx = (random::generate_u64(gen) % game.npc_spawn_pool.length()) as u16;

    // 检查是否在冷却中
    let entry = &game.npc_spawn_pool[pool_idx as u64];
    if (entry.next_active_round > current_round) {
        return (0, 0) // 在冷却中，直接返回（保持原有冷却）
    };

    // 获取NPC类型（复制值，避免后续借用冲突）
    let npc_kind = entry.npc_kind;
    let is_consumable = is_npc_consumable(npc_kind);

    // 优化：先尝试探针法找空位（传入NPC类型避免同类聚集）
    let mut tile_id_opt = random_spawn_tile_probing(game, template, gen, npc_kind);

    // 如果探针法失败，回退到全量扫描
    if (tile_id_opt.is_none()) {
        tile_id_opt = random_spawn_tile(game, template, gen);
    };

    // 如果还是没找到，说明地图已满
    if (tile_id_opt.is_none()) {
        return (0, 0) // 没有可用地块，不设置冷却时间！
    };
    let tile_id = tile_id_opt.extract();

    // 放置NPC
    let npc = NpcInst {
        tile_id,
        kind: npc_kind,
        consumable: is_consumable,
        spawn_index: pool_idx
    };
    let npc_index = game.npc_on.length();
    game.npc_on.push_back(npc);
    game.tiles[tile_id as u64].npc_on = (npc_index as u16);

    // 只有成功放置NPC后才设置冷却
    // 这确保了如果因为地块不足而失败，NPC不会进入冷却，下次还有机会生成
    let cooldown_rounds = if (is_buff_npc(npc_kind)) {
        3  // Buff型NPC：3轮冷却
    } else {
        2  // 普通NPC：2轮冷却
    };
    game.npc_spawn_pool[pool_idx as u64].next_active_round = current_round + cooldown_rounds;

    // 返回生成的NPC信息
    (npc_kind, tile_id)
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

// ===== Helper Functions (moved from types) =====

/// 验证传入的 map 是否与 game 创建时的一致
/// 防止恶意替换地图
fun validate_map(game: &Game, map: &map::MapTemplate) {
    // 验证是同一个地图对象
    let map_id = map::get_map_id(map);
    assert!(map_id == game.template_map_id, EMapMismatch);
}

// Building 访问器（供map模块的get_chain_buildings使用）
public fun building_owner(building: &Building): u8 {
    building.owner
}

public fun no_owner(): u8 {
    NO_OWNER
}

/// 获取连街的所有建筑ID
/// 条件：1x1建筑 + 同owner + 中间无间隔
/// @param game 游戏实例（需要buildings数据）
/// @param building_id 起始建筑ID
/// @param template 地图模板（需要chain关系）
/// @returns 连街的所有建筑ID（至少包含自己）
public fun get_chain_buildings(
    game: &Game,
    template: &map::MapTemplate,
    building_id: u16
): vector<u16> {
    // 验证有效性
    if ((building_id as u64) >= game.buildings.length()) {
        return vector[]
    };

    let building_static = map::get_building(template, building_id);

    // 只处理1x1建筑
    if (map::building_size(building_static) != types::SIZE_1X1()) {
        return vector[building_id]
    };

    let building = &game.buildings[building_id as u64];
    let owner = building.owner;

    // 无主建筑不连街
    if (owner == NO_OWNER) {
        return vector[building_id]
    };

    let mut chain = vector[building_id];

    // 向 next 方向遍历
    let mut current = building_id;
    loop {
        let current_static = map::get_building(template, current);
        let next_id = map::building_chain_next_id(current_static);

        // 检查有效性（使用常量，0是合法值）
        if (next_id == map::no_building()) break;
        if ((next_id as u64) >= game.buildings.length()) break;
        if (chain.contains(&next_id)) break;  // 防止循环

        // 检查owner是否相同
        let next_building = &game.buildings[next_id as u64];
        if (next_building.owner != owner) break;

        chain.push_back(next_id);
        current = next_id;
    };

    // 向 prev 方向遍历
    current = building_id;
    let mut prev_chain = vector[];
    loop {
        let current_static = map::get_building(template, current);
        let prev_id = map::building_chain_prev_id(current_static);

        // 检查有效性
        if (prev_id == map::no_building()) break;
        if ((prev_id as u64) >= game.buildings.length()) break;
        if (chain.contains(&prev_id)) break;

        // 检查owner
        let prev_building = &game.buildings[prev_id as u64];
        if (prev_building.owner != owner) break;

        prev_chain.push_back(prev_id);
        current = prev_id;
    };

    // 合并：prev_chain（逆序）+ chain
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

// calculate_upgrade_cost 废弃函数已删除（未被调用）
// 现在使用 calculate_building_price

// 计算当前物价指数（内部函数）
// 公式: (round / price_rise_days) + 1
// 返回整数倍率：1, 2, 3...
fun calculate_price_index(game: &Game): u64 {
    let index_level = (game.round as u64) / (game.price_rise_days as u64);
    index_level + 1
}


/// 计算单块地的基础租金
/// 公式：P × 倍率 × I
/// 其中P为地价，倍率根据等级从rent_multipliers取得，I为物价指数
fun calculate_single_tile_rent(
    price: u64,        // 基础地价P
    level: u8,         // 等级L0-L5
    price_index: u64,  // 物价指数I
    game_data: &GameData
): u64 {
    let rent_multipliers = tycoon::get_rent_multipliers(game_data);

    // 获取等级对应的倍率（×100存储）
    let multiplier = if ((level as u64) < rent_multipliers.length()) {
        rent_multipliers[level as u64]
    } else {
        100  // 默认1倍
    };

    // 计算：P × 倍率 × I / 10000 （因为倍率×100存储）
    (price * multiplier * price_index) / 10000
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
            // 分别相加：每个庙独立计算加成
            bonus = bonus + (base_rent * multiplier) / 100;
        };
        i = i + 1;
    };

    bonus
}

/// 计算过路费
/// 按文档流程：
/// 1. 判断连街（使用 get_chain_buildings，考虑owner）
/// 2. 逐building计算：base_rent = P × mL[L] × I
/// 3. 土地庙加成：owner拥有土地庙则全局加成
/// 4. 连街求和；非连街返回单个
public fun calculate_toll(
    game: &Game,
    landing_tile_id: u16,
    template: &MapTemplate,
    game_data: &GameData
): u64 {
    // 获取building信息
    let tile_static = map::get_tile(template, landing_tile_id);
    let building_id = map::tile_building_id(tile_static);

    // 非建筑tile不收租
    if (building_id == map::no_building()) return 0;

    let building = &game.buildings[building_id as u64];
    let owner = building.owner;

    // 无主建筑不收租
    if (owner == NO_OWNER) return 0;

    // 物价指数
    let price_index = calculate_price_index(game);

    // 1. 获取连街建筑（基于building的连街关系）
    let chain_buildings = get_chain_buildings(game, template, building_id);

    // 2. 查找owner的土地庙等级（全局加成，不考虑距离）
    let temple_levels = find_owner_temples(game, owner);

    let mut total_rent = 0u64;

    // 3. 遍历所有连街building（单个或多个）
    let mut i = 0;
    while (i < chain_buildings.length()) {
        let b_id = chain_buildings[i];
        let b_static = map::get_building(template, b_id);
        let b = &game.buildings[b_id as u64];

        // 基础租金：P × mL[L] × I
        let base_rent = calculate_single_tile_rent(
            map::building_price(b_static),
            b.level,
            price_index,
            game_data
        );

        // 土地庙加成（分别相加）
        let temple_bonus = calculate_temple_bonus(base_rent, &temple_levels, game_data);

        total_rent = total_rent + base_rent + temple_bonus;
        i = i + 1;
    };

    total_rent
}

/// 获取owner的土地庙等级（从Player缓存读取）
fun find_owner_temples(game: &Game, owner: u8): vector<u8> {
    let player = &game.players[owner as u64];
    player.temple_levels  // 直接返回缓存
}

/// 重建玩家的 temple_levels 缓存
/// 在购买/升级/破产时调用
fun rebuild_temple_levels_cache(game: &mut Game, player_index: u8) {
    let mut new_levels = vector[];

    // 遍历所有building，找该玩家的土地庙
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

    // 更新缓存
    let player_mut = &mut game.players[player_index as u64];
    player_mut.temple_levels = new_levels;
}

/// 计算物价系数F
/// 公式：F = 0.2 × I，用于购地和升级价格计算
fun calculate_price_factor(game: &Game): u64 {
    let price_index = calculate_price_index(game);
    // F = 0.2 × I，这里×100存储为整数
    price_index * 20
}

/// 计算建筑购买/升级价格（统一版本，根据size自动选择价格表）
/// 小建筑(1x1): 购地价公式：(P + 级别加价) × F / 100
/// 大建筑(2x2): 使用大建筑价格表 × F / 100
public fun calculate_building_price(
    building_static: &map::BuildingStatic,  // 建筑静态信息
    building: &Building,  // 建筑动态信息（需要访问building_type）
    current_level: u8, // 当前等级
    target_level: u8,  // 目标等级
    game: &Game,
    game_data: &GameData
): u64 {
    // 不能降级
    if (target_level <= current_level) return 0;

    let price_factor = calculate_price_factor(game);  // F×100
    let building_size = map::building_size(building_static);

    // 根据建筑大小选择不同的价格表
    if (building_size == types::SIZE_1X1()) {
        // 小建筑(1x1)价格计算
        let base_price = map::building_price(building_static);
        let upgrade_costs = tycoon::get_building_upgrade_costs(game_data);

        // 获取当前等级的加价
        let current_cost = if ((current_level as u64) < upgrade_costs.length()) {
            upgrade_costs[current_level as u64]
        } else {
            0
        };

        // 获取目标等级的加价
        let target_cost = if ((target_level as u64) < upgrade_costs.length()) {
            upgrade_costs[target_level as u64]
        } else {
            return 0  // 无效等级
        };

        // 当前等级的总价：(P + 当前加价) × F / 100
        let current_total = ((base_price + current_cost) * price_factor) / 10000;

        // 目标等级的总价：(P + 目标加价) × F / 100
        let target_total = ((base_price + target_cost) * price_factor) / 10000;

        // 升级费用 = 目标总价 - 当前总价
        if (target_total > current_total) {
            target_total - current_total
        } else {
            0
        }
    } else if (building_size == types::SIZE_2X2()) {
        // 大建筑(2x2)价格计算
        // 土地庙不能升级，只能建造
        if (building.building_type == types::BUILDING_TEMPLE() && current_level > 0) {
            return 0
        };

        let large_costs = tycoon::get_large_building_costs(game_data);

        // 大建筑等级从1开始，所以要减1作为数组索引
        let current_idx = if (current_level > 0) { (current_level - 1) as u64 } else { 0 };
        let target_idx = (target_level - 1) as u64;

        // 获取当前等级的价格
        let current_cost = if (current_level > 0 && current_idx < large_costs.length()) {
            large_costs[current_idx]
        } else {
            0
        };

        // 获取目标等级的价格
        let target_cost = if (target_idx < large_costs.length()) {
            large_costs[target_idx]
        } else {
            return 0  // 无效等级
        };

        // 计算升级费用（目标价格 - 当前价格）× F / 100
        let upgrade_diff = if (target_cost > current_cost) {
            target_cost - current_cost
        } else {
            target_cost  // 从0级开始建造
        };

        (upgrade_diff * price_factor) / 10000
    } else {
        // 未知大小，返回0
        0
    }
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
