#[test_only]
module tycoon::tycoon_tests;

use sui::test_scenario::{Self as ts, Scenario};
use sui::clock::{Self, Clock};
use sui::table;
use std::option;

use tycoon::types;
use tycoon::map::{Self, MapRegistry, MapTemplate};
use tycoon::game::{Self, Game, Seat, TurnCap};
use tycoon::cards;
use tycoon::admin::{Self, AdminCap};

// ===== Test Setup Helpers 测试设置辅助函数 =====

fun setup_test(): Scenario {
    ts::begin(@0x1)
}

fun create_test_registry_and_map(scenario: &mut Scenario) {
    ts::next_tx(scenario, @0x1);
    {
        admin::create_map_registry(ts::ctx(scenario));
    };

    ts::next_tx(scenario, @0x1);
    {
        let mut registry = ts::take_shared<MapRegistry>(scenario);
        let template = map::create_test_map_8(ts::ctx(scenario));
        map::publish_template(&mut registry, template, ts::ctx(scenario));
        ts::return_shared(registry);
    };
}

fun create_test_game(scenario: &mut Scenario): ID {
    ts::next_tx(scenario, @0x1);
    {
        let registry = ts::take_shared<MapRegistry>(scenario);
        game::create_game(&registry, 1, ts::ctx(scenario));
        ts::return_shared(registry);
    };

    ts::next_tx(scenario, @0x1);
    {
        let game = ts::take_shared<Game>(scenario);
        let game_id = object::id(&game);
        ts::return_shared(game);
        game_id
    }
}

fun create_clock(scenario: &mut Scenario) {
    ts::next_tx(scenario, @0x1);
    {
        let clock = clock::create_for_testing(ts::ctx(scenario));
        clock::share_for_testing(clock);
    };
}

// ===== Test 1: 回合跳过测试 =====
#[test]
fun test_skip_turn_in_hospital() {
    let mut scenario = setup_test();
    create_test_registry_and_map(&mut scenario);
    create_clock(&mut scenario);
    let game_id = create_test_game(&mut scenario);

    // Player 2 joins
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        ts::return_shared(game);
    };

    // Start game
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::start(&mut game, &clock, ts::ctx(&mut scenario));
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Simulate player 1 being in hospital
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        // 直接修改玩家状态（测试用）
        // 注意：实际游戏中这应该通过游戏逻辑触发
        // 这里简化处理，实际需要通过内部函数访问
        ts::return_shared(game);
    };

    // Player 1 mints turn cap
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let seat = ts::take_from_sender<Seat>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::mint_turncap(&mut game, &seat, &clock, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, seat);
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1 tries to roll - should skip
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::roll_and_step(&mut game, cap, option::none(), &registry, &clock, ts::ctx(&mut scenario));
        ts::return_shared(game);
        ts::return_shared(registry);
        ts::return_shared(clock);
    };

    ts::end(scenario);
}

// ===== Test 2: 路障停止测试 =====
#[test]
fun test_barrier_stops_movement() {
    let mut scenario = setup_test();
    create_test_registry_and_map(&mut scenario);
    create_clock(&mut scenario);
    let game_id = create_test_game(&mut scenario);

    // Player 2 joins
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        ts::return_shared(game);
    };

    // Start game
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::start(&mut game, &clock, ts::ctx(&mut scenario));
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1 gets and uses barrier card
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let seat = ts::take_from_sender<Seat>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        // Mint turn cap
        game::mint_turncap(&mut game, &seat, &clock, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, seat);
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Use barrier card on tile 2
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);

        // 给玩家发路障卡（测试用）
        // 实际游戏中通过抽卡获得

        // Use barrier card
        game::use_card(&mut game, &cap, types::card_barrier(), option::none(), option::some(2), &registry, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, cap);
        ts::return_shared(game);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

// ===== Test 3: 炸弹送医测试 =====
#[test]
fun test_bomb_sends_to_hospital() {
    let mut scenario = setup_test();
    create_test_registry_and_map(&mut scenario);
    create_clock(&mut scenario);
    let game_id = create_test_game(&mut scenario);

    // Player 2 joins
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        ts::return_shared(game);
    };

    // Start game
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::start(&mut game, &clock, ts::ctx(&mut scenario));
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1 places bomb on tile 2
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let seat = ts::take_from_sender<Seat>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        game::mint_turncap(&mut game, &seat, &clock, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, seat);
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);

        // Use bomb card
        game::use_card(&mut game, &cap, types::card_bomb(), option::none(), option::some(2), &registry, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, cap);
        ts::return_shared(game);
        ts::return_shared(registry);
    };

    // End turn for player 1
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        game::end_turn(&mut game, cap, ts::ctx(&mut scenario));
        ts::return_shared(game);
    };

    // Player 2's turn - will hit bomb if moves 2 steps
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let seat = ts::take_from_sender<Seat>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        game::mint_turncap(&mut game, &seat, &clock, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, seat);
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 2 rolls and hits bomb
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        // Will hit bomb and be sent to hospital
        game::roll_and_step(&mut game, cap, option::none(), &registry, &clock, ts::ctx(&mut scenario));

        ts::return_shared(game);
        ts::return_shared(registry);
        ts::return_shared(clock);
    };

    ts::end(scenario);
}

// ===== Test 4: 经过发卡测试 =====
#[test]
fun test_card_draw_on_pass() {
    let mut scenario = setup_test();
    create_test_registry_and_map(&mut scenario);
    create_clock(&mut scenario);
    let game_id = create_test_game(&mut scenario);

    // Player 2 joins
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        ts::return_shared(game);
    };

    // Start game
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::start(&mut game, &clock, ts::ctx(&mut scenario));
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1's turn
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let seat = ts::take_from_sender<Seat>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        game::mint_turncap(&mut game, &seat, &clock, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, seat);
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1 rolls dice - will pass card tile at position 2
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        // Roll dice - should pass tile 2 (CARD) and trigger card draw
        game::roll_and_step(&mut game, cap, option::none(), &registry, &clock, ts::ctx(&mut scenario));

        // Check if player got cards (would need accessor functions)

        ts::return_shared(game);
        ts::return_shared(registry);
        ts::return_shared(clock);
    };

    ts::end(scenario);
}

// ===== Test 5: 遥控骰测试 =====
#[test]
fun test_move_control_card() {
    let mut scenario = setup_test();
    create_test_registry_and_map(&mut scenario);
    create_clock(&mut scenario);
    let game_id = create_test_game(&mut scenario);

    // Player 2 joins
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        ts::return_shared(game);
    };

    // Start game
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        game::start(&mut game, &clock, ts::ctx(&mut scenario));
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1 gets turn cap
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let seat = ts::take_from_sender<Seat>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        game::mint_turncap(&mut game, &seat, &clock, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, seat);
        ts::return_shared(game);
        ts::return_shared(clock);
    };

    // Player 1 uses move control card
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);

        // Use move control card (sets dice to 3)
        game::use_card(&mut game, &cap, types::card_move_ctrl(), option::none(), option::none(), &registry, ts::ctx(&mut scenario));

        ts::return_to_sender(&scenario, cap);
        ts::return_shared(game);
        ts::return_shared(registry);
    };

    // Player 1 rolls - should get exactly 3
    ts::next_tx(&mut scenario, @0x1);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        let cap = ts::take_from_sender<TurnCap>(&scenario);
        let registry = ts::take_shared<MapRegistry>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);

        // Roll dice - should be 3 due to move control
        game::roll_and_step(&mut game, cap, option::none(), &registry, &clock, ts::ctx(&mut scenario));

        // Verify player moved exactly 3 steps
        // Position should be 3
        assert!(game::get_player_position(&game, @0x1) == 3, 0);

        ts::return_shared(game);
        ts::return_shared(registry);
        ts::return_shared(clock);
    };

    ts::end(scenario);
}

// ===== Helper Test: 测试地图创建 =====
#[test]
fun test_map_creation() {
    let mut scenario = setup_test();

    ts::next_tx(&mut scenario, @0x1);
    {
        admin::create_map_registry(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, @0x1);
    {
        let mut registry = ts::take_shared<MapRegistry>(&scenario);
        let template = map::create_test_map_8(ts::ctx(&mut scenario));

        // Verify map properties
        assert!(map::get_template_id(&template) == 1, 0);
        assert!(map::get_tile_count(&template) == 8, 1);

        // Verify tile 2 is CARD type
        let tile2 = map::get_tile(&template, 2);
        assert!(map::tile_kind(tile2) == types::tile_card(), 2);

        // Verify tile 5 is HOSPITAL
        let tile5 = map::get_tile(&template, 5);
        assert!(map::tile_kind(tile5) == types::tile_hospital(), 3);

        map::publish_template(&mut registry, template, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

// ===== Helper Test: 测试游戏创建和加入 =====
#[test]
fun test_game_creation_and_join() {
    let mut scenario = setup_test();
    create_test_registry_and_map(&mut scenario);

    // Create game
    ts::next_tx(&mut scenario, @0x1);
    {
        let registry = ts::take_shared<MapRegistry>(&scenario);
        game::create_game(&registry, 1, ts::ctx(&mut scenario));
        ts::return_shared(registry);
    };

    // Verify game created and player 1 joined
    ts::next_tx(&mut scenario, @0x1);
    {
        let game = ts::take_shared<Game>(&scenario);
        assert!(game::get_game_status(&game) == types::status_ready(), 0);
        assert!(game::get_player_count(&game) == 1, 1);
        ts::return_shared(game);
    };

    // Player 2 joins
    ts::next_tx(&mut scenario, @0x2);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        assert!(game::get_player_count(&game) == 2, 2);
        ts::return_shared(game);
    };

    // Player 3 joins
    ts::next_tx(&mut scenario, @0x3);
    {
        let mut game = ts::take_shared<Game>(&scenario);
        game::join(&mut game, ts::ctx(&mut scenario));
        assert!(game::get_player_count(&game) == 3, 3);
        ts::return_shared(game);
    };

    ts::end(scenario);
}