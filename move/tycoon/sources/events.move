module tycoon::events;

use std::option;

// ===== Game Events 游戏事件 =====

// 游戏创建事件
public struct GameCreatedEvent has copy, drop {
    game: ID,
    creator: address,
    template_id: u64,
    max_players: u8,
    created_at_ms: u64
}

// 玩家加入事件
public struct PlayerJoinedEvent has copy, drop {
    game: ID,
    player: address,
    player_index: u8
}

// 游戏开始事件
public struct GameStartedEvent has copy, drop {
    game: ID,
    player_count: u8,
    starting_player: address
}

// 游戏结束事件
public struct GameEndedEvent has copy, drop {
    game: ID,
    winner: Option<address>,
    turn: u64,
    reason: u8  // 0=正常结束, 1=达到最大回合数, 2=只剩一个玩家
}

// ===== Turn Events 回合事件 =====

// 回合开始事件
public struct TurnStartEvent has copy, drop {
    game: ID,
    player: address,
    turn: u64
}

// 跳过回合事件
public struct SkipTurnEvent has copy, drop {
    game: ID,
    player: address,
    reason: u8  // 1=监狱, 2=医院
}

// 回合结束事件
public struct EndTurnEvent has copy, drop {
    game: ID,
    player: address,
    turn: u64
}

// ===== Movement Events 移动事件 =====

// 掷骰事件
public struct RollEvent has copy, drop {
    game: ID,
    player: address,
    dice: u8,
    from: u64,
    to: u64
}

// 移动事件（每步触发）
public struct MoveEvent has copy, drop {
    game: ID,
    player: address,
    from: u64,
    to: u64
}

// 经过地块事件
public struct PassTileEvent has copy, drop {
    game: ID,
    player: address,
    tile_id: u64,
    tile_kind: u8
}

// 停留地块事件
public struct StopTileEvent has copy, drop {
    game: ID,
    player: address,
    tile_id: u64,
    tile_kind: u8
}

// ===== Property Events 地产事件 =====

// 购买地产事件
public struct BuyEvent has copy, drop {
    game: ID,
    buyer: address,
    tile_id: u64,
    price: u64
}

// 升级地产事件
public struct UpgradeEvent has copy, drop {
    game: ID,
    owner: address,
    tile_id: u64,
    from_lv: u8,
    to_lv: u8,
    cost: u64
}

// 支付过路费事件
public struct TollEvent has copy, drop {
    game: ID,
    payer: address,
    owner: address,
    tile_id: u64,
    level: u8,
    amount: u64
}

// ===== Card Events 卡牌事件 =====

// 获得卡牌事件
public struct CardGainEvent has copy, drop {
    game: ID,
    player: address,
    kind: u16,
    delta: u64  // 获得数量
}

// 使用卡牌事件
public struct CardUseEvent has copy, drop {
    game: ID,
    player: address,
    kind: u16,
    target: Option<address>,
    tile_id: Option<u64>
}

// 卡牌效果应用事件
public struct CardEffectEvent has copy, drop {
    game: ID,
    player: address,
    kind: u16,
    effect_type: u8,  // 1=移动控制, 2=放置机关, 3=buff应用
    details: u64
}

// ===== NPC Events NPC/机关事件 =====

// NPC生成事件
public struct NpcSpawnEvent has copy, drop {
    game: ID,
    tile_id: u64,
    kind: u8,
    by_player: Option<address>
}

// 炸弹/狗狗命中事件
public struct BombOrDogHitEvent has copy, drop {
    game: ID,
    player: address,
    tile_id: u64,
    kind: u8
}

// 送医院事件
public struct SendToHospitalEvent has copy, drop {
    game: ID,
    player: address,
    hospital_tile: u64
}

// 路障阻挡事件
public struct BarrierStopEvent has copy, drop {
    game: ID,
    player: address,
    tile_id: u64
}

// NPC移除事件
public struct NpcRemovedEvent has copy, drop {
    game: ID,
    tile_id: u64,
    kind: u8,
    reason: u8  // 1=被触发, 2=过期, 3=被替换
}

// ===== Economy Events 经济事件 =====

// 现金变动事件
public struct CashChangeEvent has copy, drop {
    game: ID,
    player: address,
    amount: u64,  // 金额
    is_debit: bool,  // true=支出, false=收入
    reason: u8,   // 1=过路费, 2=买地, 3=升级, 4=奖励, 5=罚款, 6=卡牌效果
    details: u64
}

// 破产事件
public struct BankruptEvent has copy, drop {
    game: ID,
    player: address,
    debt: u64,
    creditor: Option<address>
}

// ===== Status Events 状态事件 =====

// 玩家冻结事件
public struct PlayerFrozenEvent has copy, drop {
    game: ID,
    player: address,
    frozen_by: address,
    until_turn: u64
}

// 玩家解冻事件
public struct PlayerUnfrozenEvent has copy, drop {
    game: ID,
    player: address,
    turn: u64
}

// 免租buff应用事件
public struct RentFreeAppliedEvent has copy, drop {
    game: ID,
    player: address,
    until_turn: u64
}

// 免租buff到期事件
public struct RentFreeExpiredEvent has copy, drop {
    game: ID,
    player: address,
    turn: u64
}

// 入狱事件
public struct EnterPrisonEvent has copy, drop {
    game: ID,
    player: address,
    prison_tile: u64,
    turns: u8
}

// 出狱事件
public struct LeavePrisonEvent has copy, drop {
    game: ID,
    player: address,
    turn: u64
}

// 入院事件
public struct EnterHospitalEvent has copy, drop {
    game: ID,
    player: address,
    hospital_tile: u64,
    turns: u8
}

// 出院事件
public struct LeaveHospitalEvent has copy, drop {
    game: ID,
    player: address,
    turn: u64
}

// ===== Special Events 特殊事件 =====

// 新闻事件
public struct NewsEvent has copy, drop {
    game: ID,
    news_type: u8,
    affected_players: vector<address>,
    effect: u64
}

// 机会事件
public struct ChanceEvent has copy, drop {
    game: ID,
    player: address,
    chance_type: u8,
    outcome: u64
}

// 彩票事件
public struct LotteryEvent has copy, drop {
    game: ID,
    player: address,
    ticket_count: u64,
    win_amount: u64
}

// ===== Phase Events 阶段事件 =====

// 阶段变更事件
public struct PhaseChangeEvent has copy, drop {
    game: ID,
    from_phase: u8,
    to_phase: u8,
    turn: u64
}

// ===== Constructor Functions 构造函数 =====

public fun new_game_created_event(
    game: ID,
    creator: address,
    template_id: u64,
    max_players: u8,
    created_at_ms: u64
): GameCreatedEvent {
    GameCreatedEvent { game, creator, template_id, max_players, created_at_ms }
}

public fun new_player_joined_event(game: ID, player: address, player_index: u8): PlayerJoinedEvent {
    PlayerJoinedEvent { game, player, player_index }
}

public fun new_game_started_event(game: ID, player_count: u8, starting_player: address): GameStartedEvent {
    GameStartedEvent { game, player_count, starting_player }
}

public fun new_roll_event(game: ID, player: address, dice: u8, from: u64, to: u64): RollEvent {
    RollEvent { game, player, dice, from, to }
}

public fun new_move_event(game: ID, player: address, from: u64, to: u64): MoveEvent {
    MoveEvent { game, player, from, to }
}

public fun new_buy_event(game: ID, buyer: address, tile_id: u64, price: u64): BuyEvent {
    BuyEvent { game, buyer, tile_id, price }
}

public fun new_toll_event(
    game: ID,
    payer: address,
    owner: address,
    tile_id: u64,
    level: u8,
    amount: u64
): TollEvent {
    TollEvent { game, payer, owner, tile_id, level, amount }
}

public fun new_card_gain_event(game: ID, player: address, kind: u16, delta: u64): CardGainEvent {
    CardGainEvent { game, player, kind, delta }
}

public fun new_card_use_event(
    game: ID,
    player: address,
    kind: u16,
    target: Option<address>,
    tile_id: Option<u64>
): CardUseEvent {
    CardUseEvent { game, player, kind, target, tile_id }
}

public fun new_skip_turn_event(game: ID, player: address, reason: u8): SkipTurnEvent {
    SkipTurnEvent { game, player, reason }
}

public fun new_end_turn_event(game: ID, player: address, turn: u64): EndTurnEvent {
    EndTurnEvent { game, player, turn }
}

public fun new_npc_spawn_event(game: ID, tile_id: u64, kind: u8, by_player: Option<address>): NpcSpawnEvent {
    NpcSpawnEvent { game, tile_id, kind, by_player }
}

public fun new_bomb_or_dog_hit_event(game: ID, player: address, tile_id: u64, kind: u8): BombOrDogHitEvent {
    BombOrDogHitEvent { game, player, tile_id, kind }
}

public fun new_send_to_hospital_event(game: ID, player: address, hospital_tile: u64): SendToHospitalEvent {
    SendToHospitalEvent { game, player, hospital_tile }
}

public fun new_barrier_stop_event(game: ID, player: address, tile_id: u64): BarrierStopEvent {
    BarrierStopEvent { game, player, tile_id }
}