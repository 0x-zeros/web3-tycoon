// 移动和NPC系统测试
#[test_only]
module tycoon::movement_npc_tests {
    use std::option;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game, TurnCap};
    use tycoon::map::{MapRegistry};
    use tycoon::types;
    use tycoon::cards;

    // 测试路障停止移动
    #[test]
    fun test_barrier_stops_movement() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 玩家加入并开始游戏
        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin的回合 - 放置路障在位置2
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        // 使用路障卡放置在位置2
        game::use_card(
            &mut game,
            &cap,
            types::card_barrier(),
            option::none(),  // 无目标玩家
            option::some(2),  // 目标地块
            &registry,
            scenario::ctx(scenario)
        );

        game::end_turn(&mut game, cap, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice的回合 - 尝试移动经过路障
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        // 设置Alice的位置为1，下一步会经过位置2的路障
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 掷骰移动（假设骰子点数会让Alice经过位置2）
        game::roll_and_step(
            &mut game,
            cap,
            option::none(),
            &registry,
            &clock,
            scenario::ctx(scenario)
        );

        // 验证Alice停在路障位置（位置2）
        utils::assert_player_position(&game, utils::alice(), 2);

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试炸弹送医
    #[test]
    fun test_bomb_sends_to_hospital() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin放置炸弹在位置3
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        game::use_card(
            &mut game,
            &cap,
            types::card_bomb(),
            option::none(),
            option::some(3),
            &registry,
            scenario::ctx(scenario)
        );

        game::end_turn(&mut game, cap, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice移动到炸弹位置
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);

        // 直接设置Alice到炸弹位置
        game::test_set_player_position(&mut game, utils::alice(), 3);

        // 模拟触发炸弹效果
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        // 执行步骤移动触发炸弹
        game::execute_step_movement(
            &mut game,
            utils::alice(),
            3,
            &registry
        );

        // 验证Alice被送到医院（假设医院在位置2）
        // 这里需要根据实际地图配置调整
        let player_pos = game::get_player_position(&game, utils::alice());
        assert!(player_pos == 2, 1); // 假设位置2是医院

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试狗狗NPC放置和触发
    #[test]
    fun test_dog_npc_placement_and_trigger() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin使用狗狗卡放置NPC
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        // 给Admin发狗狗卡
        game::test_give_card(&mut game, utils::admin_addr(), types::card_dog(), 1);

        // 使用狗狗卡放置在位置1
        game::use_card(
            &mut game,
            &cap,
            types::card_dog(),
            option::none(),
            option::some(1),
            &registry,
            scenario::ctx(scenario)
        );

        // 验证NPC已放置
        assert!(game::has_npc_on_tile(&game, 1), 1);
        let npc = game::get_npc_on_tile(&game, 1);
        assert!(npc.kind == types::npc_dog(), 2);

        game::end_turn(&mut game, cap, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice移动到狗狗位置
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);

        // 设置Alice位置接近狗狗
        game::test_set_player_position(&mut game, utils::alice(), 0);

        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        // 移动到狗狗位置
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 执行步骤触发狗狗
        game::execute_step_movement(
            &mut game,
            utils::alice(),
            1,
            &registry
        );

        // 验证Alice被送到医院
        let player_pos = game::get_player_position(&game, utils::alice());
        assert!(player_pos == 2, 3); // 假设位置2是医院

        // 验证狗狗NPC已被消耗
        assert!(!game::has_npc_on_tile(&game, 1), 4);

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试在医院跳过回合
    #[test]
    fun test_skip_turn_in_hospital() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // 设置Admin在医院
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        game::test_set_player_in_hospital(&mut game, utils::admin_addr(), 1);

        // Admin尝试移动（应该被跳过）
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        game::roll_and_step(
            &mut game,
            cap,
            option::none(),
            &registry,
            &clock,
            scenario::ctx(scenario)
        );

        // 验证Admin仍在医院
        assert!(game::is_player_in_hospital(&game, utils::admin_addr()), 1);

        // 验证回合已切换到Alice
        assert!(game::current_turn_player(&game) == utils::alice(), 2);

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试多个NPC叠加（应该失败）
    #[test]
    #[expected_failure(abort_code = 2002)] // err_tile_occupied_by_npc
    fun test_cannot_place_multiple_npcs() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::start_game(&mut game, &clock, scenario);

        // 放置第一个NPC（路障）
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 2);

        game::use_card(
            &mut game,
            &cap,
            types::card_barrier(),
            option::none(),
            option::some(1),
            &registry,
            scenario::ctx(scenario)
        );

        // 尝试在同一位置放置第二个NPC（应该失败）
        game::use_card(
            &mut game,
            &cap,
            types::card_barrier(),
            option::none(),
            option::some(1),
            &registry,
            scenario::ctx(scenario)
        );

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试NPC数量上限
    #[test]
    #[expected_failure(abort_code = 2003)] // err_npc_cap_reached
    fun test_npc_cap_limit() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::start_game(&mut game, &clock, scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);

        // 给足够的卡牌
        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 10);

        // 放置NPC直到达到上限（假设上限是5）
        let mut i = 0;
        while (i < 6) {  // 尝试放置6个，第6个应该失败
            game::use_card(
                &mut game,
                &cap,
                types::card_barrier(),
                option::none(),
                option::some(i),
                &registry,
                scenario::ctx(scenario)
            );
            i = i + 1;
        };

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}