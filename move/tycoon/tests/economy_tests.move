// 经济系统测试
#[test_only]
module tycoon::economy_tests {
    use std::option;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game};
    use tycoon::map::{MapRegistry};
    use tycoon::types;

    // 测试购买地产
    #[test]
    fun test_buy_property() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 创建游戏
        let game_id = utils::create_test_game(scenario);

        // 获取游戏和注册表
        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 玩家加入游戏
        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);

        // 开始游戏
        utils::start_game(&mut game, scenario);

        // Alice的回合 - 移动到地产1
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::alice());

        // 假设Alice移动到位置1（Property 2，价格1500）
        // 这里简化处理，直接设置位置
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 购买地产
        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario));

        // 验证地产所有权
        utils::assert_property_owner(&game, 1, option::some(utils::alice()));
        utils::assert_property_level(&game, 1, types::level_0());

        // 验证现金减少（初始10000 - 1500 = 8500）
        utils::assert_player_cash(&game, utils::alice(), 8500);

        // 结束回合
        game::end_turn(&mut game, cap, scenario::ctx(scenario));

        // 清理
        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试升级地产
    #[test]
    fun test_upgrade_property() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, scenario);

        // Alice购买地产
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario));

        // 升级地产到等级1
        game::upgrade_property(&mut game, &cap, &registry, scenario::ctx(scenario));
        utils::assert_property_level(&game, 1, types::level_1());

        // 验证现金（初始10000 - 购买1500 - 升级900 = 7600）
        // 升级成本 = 1500 * 0.6 = 900
        utils::assert_player_cash(&game, utils::alice(), 7600);

        game::end_turn(&mut game, cap, scenario::ctx(scenario));

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试无法购买已拥有的地产
    #[test]
    #[expected_failure(abort_code = 2005)]
    fun test_cannot_buy_owned_property() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);
        utils::start_game(&mut game, scenario);

        // Alice购买地产1
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario));
        game::end_turn(&mut game, cap, scenario::ctx(scenario));

        // Bob尝试购买已被Alice拥有的地产1
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::bob());
        game::test_set_player_position(&mut game, utils::bob(), 1);
        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario)); // 应该失败

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试现金不足无法购买
    #[test]
    #[expected_failure(abort_code = 2010)]
    fun test_cannot_buy_with_insufficient_cash() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, scenario);

        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::alice());

        // 设置Alice现金为100（不足以购买价格1500的地产）
        game::test_set_player_cash(&mut game, utils::alice(), 100);
        game::test_set_player_position(&mut game, utils::alice(), 1);

        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario)); // 应该失败

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试破产处理
    #[test]
    fun test_bankruptcy() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);
        utils::start_game(&mut game, scenario);

        // Alice购买并升级地产1到最高级
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario));

        // 升级到等级4
        let mut i = 0;
        while (i < 4) {
            game::upgrade_property(&mut game, &cap, &registry, scenario::ctx(scenario));
            i = i + 1;
        };
        game::end_turn(&mut game, cap, scenario::ctx(scenario));

        // Bob的回合 - 设置Bob现金很少
        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::bob());
        game::test_set_player_cash(&mut game, utils::bob(), 100);

        // Bob移动到Alice的地产，触发破产
        game::test_set_player_position(&mut game, utils::bob(), 1);

        // 模拟支付租金导致破产
        game::test_trigger_bankruptcy(&mut game, utils::bob(), 2400, option::some(utils::alice()));

        // 验证Bob破产
        assert!(game::is_player_bankrupt(&game, utils::bob()), 1);

        // 验证地产被释放（无主）
        // 注意：根据实现，破产后地产应该被释放
        utils::assert_property_owner(&game, 1, option::none());

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试游戏胜利条件
    #[test]
    fun test_game_winner() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[
            utils::alice(),
            utils::bob(),
            utils::carol()
        ], scenario);
        utils::start_game(&mut game, scenario);

        // 使Bob和Carol破产
        game::test_trigger_bankruptcy(&mut game, utils::bob(), 10000, option::none());
        game::test_trigger_bankruptcy(&mut game, utils::carol(), 10000, option::none());

        // 验证游戏结束，Alice是赢家
        assert!(game::get_status(&game) == types::status_ended(), 1);
        assert!(game::get_winner(&game) == option::some(utils::alice()), 2);

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试最高等级无法再升级
    #[test]
    #[expected_failure(abort_code = 2009)]
    fun test_cannot_upgrade_max_level() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, scenario);

        let cap = utils::mint_turn_cap(&mut game, &clock, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        game::buy_property(&mut game, &cap, &registry, scenario::ctx(scenario));

        // 升级到等级4
        let mut i = 0;
        while (i < 4) {
            game::upgrade_property(&mut game, &cap, &registry, scenario::ctx(scenario));
            i = i + 1;
        };

        // 尝试再次升级（应该失败）
        game::upgrade_property(&mut game, &cap, &registry, scenario::ctx(scenario));

        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}