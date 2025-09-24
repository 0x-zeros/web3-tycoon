module tycoon::events;

// use std::option;
use sui::event;
// use sui::object::ID;

// ===== Game Events 游戏事件 =====

// 游戏创建事件
public struct GameCreatedEvent has copy, drop {
    game: ID,
    creator: address,
    template_id: u64,
    max_players: u8
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
    winner: option::Option<address>,//todo 改为所有玩家排名
    round: u16,
    turn_in_round: u8,
    reason: u8  // 0=正常结束, 1=达到最大回合数, 2=只剩一个玩家
}
 
// ===== Turn Events 回合事件 =====

// 回合开始事件
public struct TurnStartEvent has copy, drop {
    game: ID,
    player: address,
    round: u16,
    turn_in_round: u8
}

// 跳过回合事件
public struct SkipTurnEvent has copy, drop {//todo miss turn
    game: ID,
    player: address,
    reason: u8  // 1=监狱, 2=医院
}

// 回合结束事件
public struct EndTurnEvent has copy, drop {
    game: ID,
    player: address,
    round: u16,
    turn_in_round: u8
}

// 轮次结束事件
public struct RoundEndedEvent has copy, drop {
    game: ID,
    round: u16,
    global_turn: u64 //新一轮的 0 全局索引
}

// ===== Economy Events 经济事件 =====

// 破产事件
public struct BankruptEvent has copy, drop {
    game: ID,
    player: address,
    debt: u64,
    creditor: option::Option<address>
}

// ===== Aggregated Event Constants 聚合事件常量 =====


// NPC操作常量
const NPC_ACTION_SPAWN: u8 = 1;
const NPC_ACTION_REMOVE: u8 = 2;
const NPC_ACTION_HIT: u8 = 3;

// NPC步骤结果常量
const NPC_RESULT_NONE: u8 = 0;
const NPC_RESULT_SEND_HOSPITAL: u8 = 1;
const NPC_RESULT_BARRIER_STOP: u8 = 2;

// 停留类型常量
const STOP_NONE: u8 = 0;
const STOP_PROPERTY_TOLL: u8 = 1;
const STOP_PROPERTY_NO_RENT: u8 = 2;
const STOP_HOSPITAL: u8 = 3;
const STOP_PRISON: u8 = 4;
const STOP_BONUS: u8 = 5;
const STOP_FEE: u8 = 6;
const STOP_CARD_STOP: u8 = 7;
const STOP_PROPERTY_UNOWNED: u8 = 8;  // 无主地产（可购买）

// ===== Aggregated Event Data Types 聚合事件数据类型 =====

// 现金变动项
public struct CashDelta has copy, drop, store {
    player: address,
    is_debit: bool,
    amount: u64,
    reason: u8,  // 1=toll, 2=buy, 3=upgrade, 4=bonus, 5=fee, 6=card
    details: u64
}

// 卡牌获取项
public struct CardDrawItem has copy, drop, store {
    tile_id: u16,
    kind: u8,
    count: u8,
    is_pass: bool
}

// NPC变更项
public struct NpcChangeItem has copy, drop, store {
    tile_id: u16,
    kind: u8,
    action: u8,  // NPC_ACTION_*
    consumed: bool
}

// Buff变更项
public struct BuffChangeItem has copy, drop, store {
    buff_type: u8,  // 使用types模块的buff类型常量
    target: address,
    first_inactive_turn: option::Option<u16>  // 首个未激活回合（独占）
}

// NPC步骤事件
public struct NpcStepEvent has copy, drop, store {
    tile_id: u16,
    kind: u8,
    result: u8,  // NPC_RESULT_*
    consumed: bool,
    result_tile: option::Option<u16>
}

// 停留效果
public struct StopEffect has copy, drop, store {
    tile_id: u16,
    tile_kind: u8,
    stop_type: u8,  // STOP_*
    amount: u64,
    owner: option::Option<address>,
    level: option::Option<u8>,
    turns: option::Option<u8>,
    card_gains: vector<CardDrawItem>
}

// 步骤效果
public struct StepEffect has copy, drop, store {
    step_index: u8,
    from_tile: u16,
    to_tile: u16,
    remaining_steps: u8,
    pass_draws: vector<CardDrawItem>,
    npc_event: option::Option<NpcStepEvent>,
    stop_effect: option::Option<StopEffect>
}

// 使用卡牌操作聚合事件
public struct UseCardActionEvent has copy, drop {
    game: ID,
    player: address,
    round: u16,
    turn_in_round: u8,
    kind: u8,
    params: vector<u16>,  // 统一参数：玩家索引、地块ID、骰子值等
    npc_changes: vector<NpcChangeItem>,
    buff_changes: vector<BuffChangeItem>,
    cash_changes: vector<CashDelta>
}

// 掷骰移动操作聚合事件
public struct RollAndStepActionEvent has copy, drop {
    game: ID,
    player: address,
    round: u16,
    turn_in_round: u8,
    dice: u8,
    path_choices: vector<u16>,  // 分叉选择序列（新增）
    from: u16,
    steps: vector<StepEffect>,
    cash_changes: vector<CashDelta>,//todo casedelta 也应该放到stepeffect里？
    end_pos: u16
}


// ===== Emit Functions 事件发射函数 =====

public(package) fun emit_game_created_event(
    game_id: ID,
    creator: address,
    template_id: u64,
    max_players: u8
) {
    event::emit(GameCreatedEvent {
        game: game_id,
        creator,
        template_id,
        max_players
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
    round: u16,
    turn_in_round: u8,
    reason: u8
) {
    event::emit(GameEndedEvent {
        game: game_id,
        winner,
        round,
        turn_in_round,
        reason
    });
}

public(package) fun emit_bankrupt_event(
    game_id: ID,
    player: address,
    debt: u64,
    creditor: option::Option<address>
) {
    event::emit(BankruptEvent {
        game: game_id,
        player,
        debt,
        creditor
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
    round: u16,
    turn_in_round: u8
) {
    event::emit(EndTurnEvent {
        game: game_id,
        player,
        round,
        turn_in_round
    });
}

public(package) fun emit_round_ended_event(
    game_id: ID,
    round: u16,
    global_turn: u64
) {
    event::emit(RoundEndedEvent {
        game: game_id,
        round,
        global_turn
    });
}

// ===== Aggregated Event Constructor Functions 聚合事件构造函数 =====

// 构造现金变动项
public(package) fun make_cash_delta(
    player: address,
    is_debit: bool,
    amount: u64,
    reason: u8,
    details: u64
): CashDelta {
    CashDelta {
        player,
        is_debit,
        amount,
        reason,
        details
    }
}

// 构造卡牌获取项
public(package) fun make_card_draw_item(
    tile_id: u16,
    kind: u8,
    count: u8,
    is_pass: bool
): CardDrawItem {
    CardDrawItem {
        tile_id,
        kind,
        count,
        is_pass
    }
}

// 构造NPC变更项
public(package) fun make_npc_change(
    tile_id: u16,
    kind: u8,
    action: u8,
    consumed: bool
): NpcChangeItem {
    NpcChangeItem {
        tile_id,
        kind,
        action,
        consumed
    }
}

// 构造Buff变更项
public(package) fun make_buff_change(
    buff_type: u8,
    target: address,
    first_inactive_turn: option::Option<u16>
): BuffChangeItem {
    BuffChangeItem {
        buff_type,
        target,
        first_inactive_turn
    }
}

// 构造NPC步骤事件
public(package) fun make_npc_step_event(
    tile_id: u16,
    kind: u8,
    result: u8,
    consumed: bool,
    result_tile: option::Option<u16>
): NpcStepEvent {
    NpcStepEvent {
        tile_id,
        kind,
        result,
        consumed,
        result_tile
    }
}

// 构造停留效果
public(package) fun make_stop_effect(
    tile_id: u16,
    tile_kind: u8,
    stop_type: u8,
    amount: u64,
    owner: option::Option<address>,
    level: option::Option<u8>,
    turns: option::Option<u8>,
    card_gains: vector<CardDrawItem>
): StopEffect {
    StopEffect {
        tile_id,
        tile_kind,
        stop_type,
        amount,
        owner,
        level,
        turns,
        card_gains
    }
}

// 构造步骤效果
public(package) fun make_step_effect(
    step_index: u8,
    from_tile: u16,
    to_tile: u16,
    remaining_steps: u8,
    pass_draws: vector<CardDrawItem>,
    npc_event: option::Option<NpcStepEvent>,
    stop_effect: option::Option<StopEffect>
): StepEffect {
    StepEffect {
        step_index,
        from_tile,
        to_tile,
        remaining_steps,
        pass_draws,
        npc_event,
        stop_effect
    }
}

// 发射使用卡牌聚合事件
public(package) fun emit_use_card_action_event(
    game_id: ID,
    player: address,
    round: u16,
    turn_in_round: u8,
    kind: u8,
    params: vector<u16>,  // 统一参数
    npc_changes: vector<NpcChangeItem>,
    buff_changes: vector<BuffChangeItem>,
    cash_changes: vector<CashDelta>
) {
    event::emit(UseCardActionEvent {
        game: game_id,
        player,
        round,
        turn_in_round,
        kind,
        params,
        npc_changes,
        buff_changes,
        cash_changes
    });
}

// 发射掷骰移动聚合事件（带路径选择）
public(package) fun emit_roll_and_step_action_event_with_choices(
    game_id: ID,
    player: address,
    round: u16,
    turn_in_round: u8,
    dice: u8,
    path_choices: vector<u16>,
    from: u16,
    steps: vector<StepEffect>,
    cash_changes: vector<CashDelta>,
    end_pos: u16
) {
    event::emit(RollAndStepActionEvent {
        game: game_id,
        player,
        round,
        turn_in_round,
        dice,
        path_choices,
        from,
        steps,
        cash_changes,
        end_pos
    });
}

// 兼容旧版本（已废弃）
public(package) fun emit_roll_and_step_action_event(
    game_id: ID,
    player: address,
    round: u16,
    turn_in_round: u8,
    dice: u8,
    dir: u8,
    from: u16,
    steps: vector<StepEffect>,
    cash_changes: vector<CashDelta>,
    end_pos: u16
) {
    emit_roll_and_step_action_event_with_choices(
        game_id,
        player,
        round,
        turn_in_round,
        dice,
        vector[],  // 空的路径选择
        from,
        steps,
        cash_changes,
        end_pos
    );
}

// ===== Aggregated Event Constant Getters 聚合事件常量获取函数 =====


// NPC操作常量获取函数
public fun npc_action_spawn(): u8 { NPC_ACTION_SPAWN }
public fun npc_action_remove(): u8 { NPC_ACTION_REMOVE }
public fun npc_action_hit(): u8 { NPC_ACTION_HIT }

// NPC结果常量获取函数
public fun npc_result_none(): u8 { NPC_RESULT_NONE }
public fun npc_result_send_hospital(): u8 { NPC_RESULT_SEND_HOSPITAL }
public fun npc_result_barrier_stop(): u8 { NPC_RESULT_BARRIER_STOP }

// 停留类型常量获取函数
public fun stop_none(): u8 { STOP_NONE }
public fun stop_property_toll(): u8 { STOP_PROPERTY_TOLL }
public fun stop_property_no_rent(): u8 { STOP_PROPERTY_NO_RENT }
public fun stop_hospital(): u8 { STOP_HOSPITAL }
public fun stop_prison(): u8 { STOP_PRISON }
public fun stop_bonus(): u8 { STOP_BONUS }
public fun stop_fee(): u8 { STOP_FEE }
public fun stop_card_stop(): u8 { STOP_CARD_STOP }
public fun stop_property_unowned(): u8 { STOP_PROPERTY_UNOWNED }

// ===== Constructor Functions 构造函数（保留兼容） =====

public fun new_game_created_event(
    game: ID,
    creator: address,
    template_id: u64,
    max_players: u8
): GameCreatedEvent {
    GameCreatedEvent { game, creator, template_id, max_players }
}

public fun new_player_joined_event(game: ID, player: address, player_index: u8): PlayerJoinedEvent {
    PlayerJoinedEvent { game, player, player_index }
}

public fun new_game_started_event(game: ID, player_count: u8, starting_player: address): GameStartedEvent {
    GameStartedEvent { game, player_count, starting_player }
}

