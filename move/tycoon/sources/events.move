module tycoon::events;

use std::option;
use sui::event;
use sui::object::ID;

// ===== Admin Events 管理事件 =====

public struct MapTemplatePublishedEvent has copy, drop {
    template_id: ID,
    publisher: address,
    tile_count: u64,
    building_count: u64
}

public struct RegistryCreatedEvent has copy, drop {
    registry_id: ID,
    creator: address
}

public struct GameDataCreatedEvent has copy, drop {
    data_id: ID
}

// ===== Game Events 游戏事件 =====

public struct GameCreatedEvent has copy, drop {
    game: ID,
    creator: address,
    template_map_id: ID
}

public struct PlayerJoinedEvent has copy, drop {
    game: ID,
    player: address,
    player_index: u8
}

public struct GameStartedEvent has copy, drop {
    game: ID,
    template_map_id: ID,
    players: vector<address>,
    starting_player: address
}

public struct GameEndedEvent has copy, drop {
    game: ID,
    winner: option::Option<u8>,
    round: u16,
    turn_in_round: u8,
    reason: u8  // 0=正常结束, 1=达到最大回合数, 2=只剩一个玩家
}

// ===== Turn Events 回合事件 =====

public struct SkipTurnEvent has copy, drop {
    game: ID,
    player: u8,
    reason: u8,
    remaining_turns: u8,
    round: u16,
    turn: u8
}

public struct RoundEndedEvent has copy, drop {
    game: ID,
    round: u16,
    npc_kind: u8,
    tile_id: u16
}

// ===== Economy Events 经济事件 =====

public struct BankruptEvent has copy, drop {
    game: ID,
    player: u8,
    debt: u64,
    creditor: option::Option<u8>
}

// ===== Decision Events 决策事件 =====

public struct BuildingDecisionEvent has copy, drop {
    game: ID,
    player: u8,
    round: u16,
    turn: u8,
    auto_decision: bool,
    decision: BuildingDecisionInfo
}

public struct RentDecisionEvent has copy, drop {
    game: ID,
    round: u16,
    turn: u8,
    auto_decision: bool,
    decision: RentDecisionInfo
}

public struct DecisionSkippedEvent has copy, drop {
    game: ID,
    player: u8,
    decision_type: u8,
    tile_id: u16,
    round: u16,
    turn: u8
}

public struct CardShopDecisionEvent has copy, drop {
    game: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    decision: CardShopDecisionInfo
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
const NPC_RESULT_BUFF: u8 = 3;              // 增益型NPC触发（土地神等）

// 停留类型常量
const STOP_NONE: u8 = 0;
const STOP_BUILDING_TOLL: u8 = 1;
const STOP_BUILDING_NO_RENT: u8 = 2;
const STOP_HOSPITAL: u8 = 3;
const STOP_BONUS: u8 = 5;
const STOP_FEE: u8 = 6;
const STOP_CARD_STOP: u8 = 7;
const STOP_BUILDING_UNOWNED: u8 = 8;
const STOP_LAND_SEIZE: u8 = 9;              // 土地神附身抢地
const STOP_CARD_SHOP: u8 = 10;              // 卡片商店

// ===== Aggregated Event Data Types 聚合事件数据类型 =====

public struct CashDelta has copy, drop, store {
    player: u8,
    is_debit: bool,
    amount: u64,
    reason: u8,
    details: u16
}

public struct CardDrawItem has copy, drop, store {
    tile_id: u16,
    kind: u8,
    count: u8,
    is_pass: bool
}

public struct NpcChangeItem has copy, drop, store {
    tile_id: u16,
    kind: u8,
    action: u8,
    consumed: bool
}

public struct BuffChangeItem has copy, drop, store {
    buff_type: u8,
    target: u8,
    last_active_round: option::Option<u16>,
    value: u64  // buff 的数值参数（如 LOCOMOTIVE 的骰子数量）
}

public struct NpcStepEvent has copy, drop, store {
    tile_id: u16,
    kind: u8,
    result: u8,
    consumed: bool,
    result_tile: option::Option<u16>
}

public struct BuildingDecisionInfo has copy, drop, store {
    decision_type: u8,
    building_id: u16,
    tile_id: u16,
    amount: u64,
    new_level: u8,
    building_type: u8
}

public struct RentDecisionInfo has copy, drop, store {
    payer: u8,
    owner: u8,
    building_id: u16,
    tile_id: u16,
    rent_amount: u64,
    used_rent_free: bool
}

public struct CardShopDecisionInfo has copy, drop, store {
    tile_id: u16,                       // 卡片商店地块
    purchased_cards: vector<CardDrawItem>,  // 购买的卡片列表
    total_cost: u64                     // 总花费
}

public struct StopEffect has copy, drop, store {
    tile_id: u16,
    tile_kind: u8,
    stop_type: u8,
    amount: u64,
    owner: option::Option<u8>,
    level: option::Option<u8>,
    turns: option::Option<u8>,
    card_gains: vector<CardDrawItem>,
    pending_decision: u8,
    decision_tile: u16,
    decision_amount: u64,
    building_decision: option::Option<BuildingDecisionInfo>,
    rent_decision: option::Option<RentDecisionInfo>,
    npc_buff: option::Option<BuffChangeItem>   // NPC触发的buff（土地神等）
}

public struct StepEffect has copy, drop, store {
    step_index: u8,
    from_tile: u16,
    to_tile: u16,
    remaining_steps: u8,
    pass_draws: vector<CardDrawItem>,
    npc_event: option::Option<NpcStepEvent>,
    stop_effect: option::Option<StopEffect>
}

public struct UseCardActionEvent has copy, drop {
    game: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    kind: u8,
    params: vector<u16>,
    npc_changes: vector<NpcChangeItem>,
    buff_changes: vector<BuffChangeItem>,
    cash_changes: vector<CashDelta>,
    next_tile_id: u16  // 使用卡牌后的强制下一步目标（65535表示无强制）
}

public struct RollAndStepActionEvent has copy, drop {
    game: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    dice_values: vector<u8>,  // 每颗骰子的值，长度1-3
    path_choices: vector<u16>,
    from: u16,
    steps: vector<StepEffect>,
    cash_changes: vector<CashDelta>,
    end_pos: u16
}

// 瞬移动作事件
public struct TeleportActionEvent has copy, drop {
    game: ID,
    player: u8,                // 使用卡牌的玩家索引
    round: u16,
    turn_in_round: u8,
    target_player: u8,         // 被瞬移的玩家索引
    source_player: u8,         // 使用卡牌的玩家索引
    from_pos: u16,             // 原位置
    to_pos: u16,               // 目标位置
}


// ===== Emit Functions 事件发射函数 =====

public(package) fun emit_game_created_event(
    game_id: ID,
    creator: address,
    template_map_id: ID
) {
    event::emit(GameCreatedEvent {
        game: game_id,
        creator,
        template_map_id
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
    template_map_id: ID,
    players: vector<address>,
    starting_player: address
) {
    event::emit(GameStartedEvent {
        game: game_id,
        template_map_id,
        players,
        starting_player
    });
}

public(package) fun emit_game_ended_event(
    game_id: ID,
    winner: option::Option<u8>,
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
    player: u8,
    debt: u64,
    creditor: option::Option<u8>
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
    player: u8,
    reason: u8,
    remaining_turns: u8,
    round: u16,
    turn: u8
) {
    event::emit(SkipTurnEvent {
        game: game_id,
        player,
        reason,
        remaining_turns,
        round,
        turn
    });
}

public(package) fun emit_round_ended_event(
    game_id: ID,
    round: u16,
    npc_kind: u8,
    tile_id: u16
) {
    event::emit(RoundEndedEvent {
        game: game_id,
        round,
        npc_kind,
        tile_id
    });
}

// ===== Aggregated Event Constructor Functions 聚合事件构造函数 =====

public(package) fun make_cash_delta(
    player: u8,
    is_debit: bool,
    amount: u64,
    reason: u8,
    details: u16
): CashDelta {
    CashDelta {
        player,
        is_debit,
        amount,
        reason,
        details
    }
}

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

public(package) fun make_buff_change(
    buff_type: u8,
    target: u8,
    last_active_round: option::Option<u16>,
    value: u64
): BuffChangeItem {
    BuffChangeItem {
        buff_type,
        target,
        last_active_round,
        value
    }
}

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

public(package) fun make_building_decision_info(
    decision_type: u8,
    building_id: u16,
    tile_id: u16,
    amount: u64,
    new_level: u8,
    building_type: u8
): BuildingDecisionInfo {
    BuildingDecisionInfo {
        decision_type,
        building_id,
        tile_id,
        amount,
        new_level,
        building_type
    }
}

public(package) fun make_rent_decision_info(
    payer: u8,
    owner: u8,
    building_id: u16,
    tile_id: u16,
    rent_amount: u64,
    used_rent_free: bool
): RentDecisionInfo {
    RentDecisionInfo {
        payer,
        owner,
        building_id,
        tile_id,
        rent_amount,
        used_rent_free
    }
}

public(package) fun make_stop_effect(
    tile_id: u16,
    tile_kind: u8,
    stop_type: u8,
    amount: u64,
    owner: option::Option<u8>,
    level: option::Option<u8>,
    turns: option::Option<u8>,
    card_gains: vector<CardDrawItem>,
    pending_decision: u8,
    decision_tile: u16,
    decision_amount: u64,
    building_decision: option::Option<BuildingDecisionInfo>,
    rent_decision: option::Option<RentDecisionInfo>,
    npc_buff: option::Option<BuffChangeItem>
): StopEffect {
    StopEffect {
        tile_id,
        tile_kind,
        stop_type,
        amount,
        owner,
        level,
        turns,
        card_gains,
        pending_decision,
        decision_tile,
        decision_amount,
        building_decision,
        rent_decision,
        npc_buff
    }
}

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

public(package) fun emit_use_card_action_event(
    game_id: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    kind: u8,
    params: vector<u16>,
    npc_changes: vector<NpcChangeItem>,
    buff_changes: vector<BuffChangeItem>,
    cash_changes: vector<CashDelta>,
    next_tile_id: u16
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
        cash_changes,
        next_tile_id
    });
}

public(package) fun emit_roll_and_step_action_event_with_choices(
    game_id: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    dice_values: vector<u8>,
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
        dice_values,
        path_choices,
        from,
        steps,
        cash_changes,
        end_pos
    });
}

public(package) fun emit_teleport_action_event(
    game_id: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    target_player: u8,
    source_player: u8,
    from_pos: u16,
    to_pos: u16,
) {
    event::emit(TeleportActionEvent {
        game: game_id,
        player,
        round,
        turn_in_round,
        target_player,
        source_player,
        from_pos,
        to_pos,
    });
}


// ===== Aggregated Event Constant Getters 聚合事件常量获取函数 =====

public(package) fun npc_action_spawn(): u8 { NPC_ACTION_SPAWN }
public(package) fun npc_action_remove(): u8 { NPC_ACTION_REMOVE }
public(package) fun npc_action_hit(): u8 { NPC_ACTION_HIT }

public(package) fun npc_result_none(): u8 { NPC_RESULT_NONE }
public(package) fun npc_result_send_hospital(): u8 { NPC_RESULT_SEND_HOSPITAL }
public(package) fun npc_result_barrier_stop(): u8 { NPC_RESULT_BARRIER_STOP }
public(package) fun npc_result_buff(): u8 { NPC_RESULT_BUFF }

public(package) fun stop_none(): u8 { STOP_NONE }
public(package) fun stop_building_toll(): u8 { STOP_BUILDING_TOLL }
public(package) fun stop_building_no_rent(): u8 { STOP_BUILDING_NO_RENT }
public(package) fun stop_hospital(): u8 { STOP_HOSPITAL }
public(package) fun stop_bonus(): u8 { STOP_BONUS }
public(package) fun stop_fee(): u8 { STOP_FEE }
public(package) fun stop_card_stop(): u8 { STOP_CARD_STOP }
public(package) fun stop_building_unowned(): u8 { STOP_BUILDING_UNOWNED }
public(package) fun stop_land_seize(): u8 { STOP_LAND_SEIZE }
public(package) fun stop_card_shop(): u8 { STOP_CARD_SHOP }

// ===== Admin Event Emitters 管理事件发射函数 =====

public(package) fun emit_map_template_published_event(
    template_id: ID,
    publisher: address,
    tile_count: u64,
    building_count: u64
) {
    event::emit(MapTemplatePublishedEvent {
        template_id,
        publisher,
        tile_count,
        building_count
    });
}

public(package) fun emit_registry_created_event(
    registry_id: ID,
    creator: address
) {
    event::emit(RegistryCreatedEvent {
        registry_id,
        creator
    });
}

public(package) fun emit_game_data_created_event(data_id: ID) {
    event::emit(GameDataCreatedEvent { data_id });
}

// ===== Decision Event Emitters 决策事件发射函数 =====

public(package) fun emit_building_decision_event(
    game_id: ID,
    player: u8,
    round: u16,
    turn: u8,
    auto_decision: bool,
    decision: BuildingDecisionInfo
) {
    event::emit(BuildingDecisionEvent {
        game: game_id,
        player,
        round,
        turn,
        auto_decision,
        decision
    });
}

public(package) fun emit_rent_decision_event(
    game_id: ID,
    round: u16,
    turn: u8,
    auto_decision: bool,
    decision: RentDecisionInfo
) {
    event::emit(RentDecisionEvent {
        game: game_id,
        round,
        turn,
        auto_decision,
        decision
    });
}

public(package) fun emit_decision_skipped_event(
    game_id: ID,
    player: u8,
    decision_type: u8,
    tile_id: u16,
    round: u16,
    turn: u8
) {
    event::emit(DecisionSkippedEvent {
        game: game_id,
        player,
        decision_type,
        tile_id,
        round,
        turn
    });
}

public(package) fun emit_card_shop_decision_event(
    game_id: ID,
    player: u8,
    round: u16,
    turn_in_round: u8,
    tile_id: u16,
    purchased_cards: vector<CardDrawItem>,
    total_cost: u64
) {
    event::emit(CardShopDecisionEvent {
        game: game_id,
        player,
        round,
        turn_in_round,
        decision: CardShopDecisionInfo {
            tile_id,
            purchased_cards,
            total_cost
        }
    });
}

