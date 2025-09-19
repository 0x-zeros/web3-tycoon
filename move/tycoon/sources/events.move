module tycoon::events;

use std::option;
use sui::event;
use sui::object::ID;

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
    winner: option::Option<address>,
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

// 单步移动事件（可选发送）
public struct MoveStepEvent has copy, drop {
    game: ID,
    player: address,
    from_tile: u64,
    to_tile: u64,
    remaining_steps: u8,
    direction: u8  // 0=CW, 1=CCW
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
    target: option::Option<address>,
    tile_id: option::Option<u64>
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
    by_player: option::Option<address>
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
    creditor: option::Option<address>
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

// ===== Emit Functions 事件发射函数 =====

public(package) fun emit_game_created_event(
    game_id: ID,
    creator: address,
    template_id: u64,
    max_players: u8,
    created_at_ms: u64
) {
    event::emit(GameCreatedEvent {
        game: game_id,
        creator,
        template_id,
        max_players,
        created_at_ms
    });
}

public(package) fun emit_player_joined_event(
    game_id: ID,
    player: address,
    player_index: u8
) {
    event::emit(PlayerJoinedEvent {
        game: game_id,
        player,
        player_index
    });
}

public(package) fun emit_game_started_event(
    game_id: ID,
    player_count: u8,
    starting_player: address
) {
    event::emit(GameStartedEvent {
        game: game_id,
        player_count,
        starting_player
    });
}

public(package) fun emit_game_ended_event(
    game_id: ID,
    winner: option::Option<address>,
    turn: u64,
    reason: u8
) {
    event::emit(GameEndedEvent {
        game: game_id,
        winner,
        turn,
        reason
    });
}

public(package) fun emit_skip_turn_event(
    game_id: ID,
    player: address,
    reason: u8
) {
    event::emit(SkipTurnEvent {
        game: game_id,
        player,
        reason
    });
}

public(package) fun emit_end_turn_event(
    game_id: ID,
    player: address,
    turn: u64
) {
    event::emit(EndTurnEvent {
        game: game_id,
        player,
        turn
    });
}

public(package) fun emit_roll_event(
    game_id: ID,
    player: address,
    dice: u8,
    from: u64,
    to: u64
) {
    event::emit(RollEvent {
        game: game_id,
        player,
        dice,
        from,
        to
    });
}

public(package) fun emit_move_event(
    game_id: ID,
    player: address,
    from: u64,
    to: u64
) {
    event::emit(MoveEvent {
        game: game_id,
        player,
        from,
        to
    });
}

public(package) fun emit_pass_tile_event(
    game_id: ID,
    player: address,
    tile_id: u64,
    tile_kind: u8
) {
    event::emit(PassTileEvent {
        game: game_id,
        player,
        tile_id,
        tile_kind
    });
}

public(package) fun emit_stop_tile_event(
    game_id: ID,
    player: address,
    tile_id: u64,
    tile_kind: u8
) {
    event::emit(StopTileEvent {
        game: game_id,
        player,
        tile_id,
        tile_kind
    });
}

public(package) fun emit_move_step_event(
    game_id: ID,
    player: address,
    from_tile: u64,
    to_tile: u64,
    remaining_steps: u8,
    direction: u8
) {
    event::emit(MoveStepEvent {
        game: game_id,
        player,
        from_tile,
        to_tile,
        remaining_steps,
        direction
    });
}

public(package) fun emit_buy_event(
    game_id: ID,
    buyer: address,
    tile_id: u64,
    price: u64
) {
    event::emit(BuyEvent {
        game: game_id,
        buyer,
        tile_id,
        price
    });
}

public(package) fun emit_upgrade_event(
    game_id: ID,
    owner: address,
    tile_id: u64,
    from_lv: u8,
    to_lv: u8,
    cost: u64
) {
    event::emit(UpgradeEvent {
        game: game_id,
        owner,
        tile_id,
        from_lv,
        to_lv,
        cost
    });
}

public(package) fun emit_toll_event(
    game_id: ID,
    payer: address,
    owner: address,
    tile_id: u64,
    level: u8,
    amount: u64
) {
    event::emit(TollEvent {
        game: game_id,
        payer,
        owner,
        tile_id,
        level,
        amount
    });
}

public(package) fun emit_card_gain_event(
    game_id: ID,
    player: address,
    kind: u16,
    delta: u64
) {
    event::emit(CardGainEvent {
        game: game_id,
        player,
        kind,
        delta
    });
}

public(package) fun emit_card_use_event(
    game_id: ID,
    player: address,
    kind: u16,
    target: option::Option<address>,
    tile_id: option::Option<u64>
) {
    event::emit(CardUseEvent {
        game: game_id,
        player,
        kind,
        target,
        tile_id
    });
}

public(package) fun emit_npc_spawn_event(
    game_id: ID,
    tile_id: u64,
    kind: u8,
    by_player: option::Option<address>
) {
    event::emit(NpcSpawnEvent {
        game: game_id,
        tile_id,
        kind,
        by_player
    });
}

public(package) fun emit_bomb_or_dog_hit_event(
    game_id: ID,
    player: address,
    tile_id: u64,
    kind: u8
) {
    event::emit(BombOrDogHitEvent {
        game: game_id,
        player,
        tile_id,
        kind
    });
}

public(package) fun emit_send_to_hospital_event(
    game_id: ID,
    player: address,
    hospital_tile: u64
) {
    event::emit(SendToHospitalEvent {
        game: game_id,
        player,
        hospital_tile
    });
}

public(package) fun emit_barrier_stop_event(
    game_id: ID,
    player: address,
    tile_id: u64
) {
    event::emit(BarrierStopEvent {
        game: game_id,
        player,
        tile_id
    });
}

public(package) fun emit_cash_change_event(
    game_id: ID,
    player: address,
    amount: u64,
    is_debit: bool,
    reason: u8,
    details: u64
) {
    event::emit(CashChangeEvent {
        game: game_id,
        player,
        amount,
        is_debit,
        reason,
        details
    });
}

public(package) fun emit_enter_hospital_event(
    game_id: ID,
    player: address,
    hospital_tile: u64,
    turns: u8
) {
    event::emit(EnterHospitalEvent {
        game: game_id,
        player,
        hospital_tile,
        turns
    });
}

public(package) fun emit_enter_prison_event(
    game_id: ID,
    player: address,
    prison_tile: u64,
    turns: u8
) {
    event::emit(EnterPrisonEvent {
        game: game_id,
        player,
        prison_tile,
        turns
    });
}

public(package) fun emit_rent_free_applied_event(
    game_id: ID,
    player: address,
    until_turn: u64
) {
    event::emit(RentFreeAppliedEvent {
        game: game_id,
        player,
        until_turn
    });
}

public(package) fun emit_player_frozen_event(
    game_id: ID,
    player: address,
    frozen_by: address,
    until_turn: u64
) {
    event::emit(PlayerFrozenEvent {
        game: game_id,
        player,
        frozen_by,
        until_turn
    });
}

// ===== Constructor Functions 构造函数（保留兼容） =====

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
    target: option::Option<address>,
    tile_id: option::Option<u64>
): CardUseEvent {
    CardUseEvent { game, player, kind, target, tile_id }
}

public fun new_skip_turn_event(game: ID, player: address, reason: u8): SkipTurnEvent {
    SkipTurnEvent { game, player, reason }
}

public fun new_end_turn_event(game: ID, player: address, turn: u64): EndTurnEvent {
    EndTurnEvent { game, player, turn }
}

public fun new_npc_spawn_event(game: ID, tile_id: u64, kind: u8, by_player: option::Option<address>): NpcSpawnEvent {
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