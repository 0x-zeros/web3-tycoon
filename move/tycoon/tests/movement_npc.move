// 移动和NPC系统测试
#[test_only]
module tycoon::movement_npc_tests {
    use std::option;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;
    use sui::random::{Self, Random};

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game, Seat};
    use tycoon::map::{MapRegistry};
    use tycoon::types;
    use tycoon::cards::{Self, CardRegistry};

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
        let seat = utils::get_current_player_seat(&game, scenario);

        // 使用路障卡放置在位置2
        let card_registry = scenario::take_shared<cards::CardRegistry>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[2],  // 目标地块ID
            &registry,
            &card_registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(card_registry);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice的回合 - 尝试移动经过路障
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        // 设置Alice的位置为1，下一步会经过位置2的路障
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 掷骰移动（假设骰子点数会让Alice经过位置2）
        let r = scenario::take_shared<Random>(scenario);
        game::roll_and_step(
            &mut game,
            &seat,
            option::none(),
            &registry,
            &r,
            &clock,
            scenario::ctx(scenario)
        );
        scenario::return_shared(r);

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
        let seat = utils::get_current_player_seat(&game, scenario);

        let card_registry = scenario::take_shared<cards::CardRegistry>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_bomb(),
            vector[3],  // 目标地块ID
            &registry,
            &card_registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(card_registry);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice移动到炸弹位置
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);

        // 直接设置Alice到炸弹位置
        game::test_set_player_position(&mut game, utils::alice(), 3);

        // 模拟触发炸弹效果
        let seat = utils::get_current_player_seat(&game, scenario);

        // TODO: 需要改用其他方式测试炸弹触发
        // execute_step_movement 已经不是公开函数
        // 可以通过设置玩家位置并执行 roll_and_step 来测试

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
        let seat = utils::get_current_player_seat(&game, scenario);

        // 给Admin发狗狗卡
        game::test_give_card(&mut game, utils::admin_addr(), types::card_dog(), 1);

        // 使用狗狗卡放置在位置1
        let card_registry = scenario::take_shared<cards::CardRegistry>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_dog(),
            vector[1],  // 目标地块ID
            &registry,
            &card_registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(card_registry);

        // 验证NPC已放置
        assert!(game::has_npc_on_tile(&game, 1), 1);
        let npc = game::get_npc_on_tile(&game, 1);
        assert!(game::get_npc_kind(npc) == types::npc_dog(), 2);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice移动到狗狗位置
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);

        // 设置Alice位置接近狗狗
        game::test_set_player_position(&mut game, utils::alice(), 0);

        let seat = utils::get_current_player_seat(&game, scenario);

        // 移动到狗狗位置
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // TODO: 需要改用其他方式测试狗狗触发
        // execute_step_movement 已经不是公开函数
        // 可以通过设置玩家位置并执行 roll_and_step 来测试

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
        let seat = utils::get_current_player_seat(&game, scenario);
        let r = scenario::take_shared<Random>(scenario);
        game::roll_and_step(
            &mut game,
            &seat,
            option::none(),
            &registry,
            &r,
            &clock,
            scenario::ctx(scenario)
        );
        scenario::return_shared(r);

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
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 2);

        let card_registry = scenario::take_shared<cards::CardRegistry>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[1],  // 目标地块ID
            &registry,
            &card_registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(card_registry);

        // 尝试在同一位置放置第二个NPC（应该失败）
        let card_registry = scenario::take_shared<cards::CardRegistry>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[1],  // 目标地块ID
            &registry,
            &card_registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(card_registry);

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试NPC数量不受上限限制
    #[test]
    fun test_unlimited_npc_placement() {
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
        let seat = utils::get_current_player_seat(&game, scenario);

        // 给足够的卡牌
        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 10);

        // 尝试放置多个NPC（应全部成功）
        let mut i = 0;
        while (i < 6) {
            let card_registry = scenario::take_shared<cards::CardRegistry>(scenario);
            game::use_card(
                &mut game,
                &seat,
                types::card_barrier(),
                vector[i],  // 目标地块ID
                &registry,
                &card_registry,
                scenario::ctx(scenario)
            );
            scenario::return_shared(card_registry);
            i = i + 1;
        };

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}
