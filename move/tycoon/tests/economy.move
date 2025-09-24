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
    use tycoon::cards::{CardRegistry};
    use tycoon::tycoon;

    // 测试购买地产
    #[test]
    fun test_buy_property() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 创建游戏
        let _game_id = utils::create_test_game(scenario);

        // 获取游戏和注册表
        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 玩家加入游戏
        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);

        // 开始游戏
        utils::start_game(&mut game, &clock, scenario);

        // Alice的回合 - 移动到地产1
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());

        // 假设Alice移动到位置1（Property 2，价格1500）
        // 这里简化处理，直接设置位置
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 购买地产
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        // 验证地产所有权
        utils::assert_property_owner(&game, 1, option::some(utils::alice()));
        utils::assert_property_level(&game, 1, types::level_0());

        // 验证现金减少（初始10000 - 1500 = 8500）
        utils::assert_player_cash(&game, utils::alice(), 8500);

        // 结束回合
        game::end_turn(&mut game, &seat, scenario::ctx(scenario));

        // 清理
        scenario::return_to_sender(scenario, seat);
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

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Alice购买地产
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        // 升级地产到等级1
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
        utils::assert_property_level(&game, 1, types::level_1());

        // 验证现金（初始10000 - 购买1500 - 升级900 = 7600）
        // 升级成本 = 1500 * 0.6 = 900
        utils::assert_player_cash(&game, utils::alice(), 7600);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));

        scenario::return_to_sender(scenario, seat);
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

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Alice购买地产1
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);

        // Bob尝试购买已被Alice拥有的地产1
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::bob());
        game::test_set_player_position(&mut game, utils::bob(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data); // 应该失败

        scenario::return_to_sender(scenario, seat);
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

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());

        // 设置Alice现金为100（不足以购买价格1500的地产）
        game::test_set_player_cash(&mut game, utils::alice(), 100);
        game::test_set_player_position(&mut game, utils::alice(), 1);

        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data); // 应该失败

        scenario::return_to_sender(scenario, seat);
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

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Alice购买并升级地产1到最高级
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        // 升级到等级4
        let mut i = 0;
        while (i < 4) {
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
            i = i + 1;
        };
        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);

        // Bob的回合 - 设置Bob现金很少
        let seat = utils::get_current_player_seat(&game, scenario);
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

        scenario::return_to_sender(scenario, seat);
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

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[
            utils::alice(),
            utils::bob(),
            utils::carol()
        ], scenario);
        utils::start_game(&mut game, &clock, scenario);

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

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());
        game::test_set_player_position(&mut game, utils::alice(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        // 升级到等级4
        let mut i = 0;
        while (i < 4) {
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
            i = i + 1;
        };

        // 尝试再次升级（应该失败）
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试支付过路费给拥有者
    #[test]
    fun test_pay_toll_to_owner() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 两个玩家加入
        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin购买并升级地产
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::admin_addr());
        game::test_set_player_position(&mut game, utils::admin_addr(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        // 升级到等级2
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);

        // Alice的回合 - 经过Admin的地产
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());

        // 记录双方初始现金
        let alice_initial = game::get_player_cash(&game, utils::alice());
        let admin_initial = game::get_player_cash(&game, utils::admin_addr());

        // Alice移动到Admin的地产
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 处理停留效果（支付过路费）
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::handle_tile_stop_effect(
            &mut game,
            utils::alice(),
            1,
            &game_data
        );
        scenario::return_shared(game_data);

        // 计算预期过路费（基础租金150 * 等级乘数）
        // 等级2的乘数是3.0，所以过路费 = 150 * 3 = 450
        let expected_toll = 450;

        // 验证Alice支付了过路费
        assert!(game::get_player_cash(&game, utils::alice()) == alice_initial - expected_toll, 1);

        // 验证Admin收到了过路费
        assert!(game::get_player_cash(&game, utils::admin_addr()) == admin_initial + expected_toll, 2);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试免租卡跳过过路费
    #[test]
    fun test_rent_free_skip_toll() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin购买地产
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::admin_addr());
        game::test_set_player_position(&mut game, utils::admin_addr(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);

        // Alice使用免租卡
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::alice());

        // 给Alice免租卡
        game::test_give_card(&mut game, utils::alice(), types::card_rent_free(), 1);

        // 使用免租卡
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_rent_free(),
            vector[],  // 无参数
            &game_data,
            scenario::ctx(scenario)
        );
        scenario::return_shared(game_data);

        // 记录Alice初始现金
        let alice_initial = game::get_player_cash(&game, utils::alice());

        // Alice移动到Admin的地产
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 处理停留效果（应该免租）
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::handle_tile_stop_effect(
            &mut game,
            utils::alice(),
            1,
            &game_data
        );
        scenario::return_shared(game_data);

        // 验证Alice没有支付过路费
        assert!(game::get_player_cash(&game, utils::alice()) == alice_initial, 1);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试连续破产导致游戏结束
    #[test]
    fun test_chain_bankruptcy_game_end() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 四个玩家加入
        utils::join_players(&mut game, vector[
            utils::alice(),
            utils::bob(),
            utils::carol()
        ], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin购买所有地产并升级到最高级
        let seat = utils::get_current_player_seat(&game, scenario);
        scenario::next_tx(scenario, utils::admin_addr());

        // 购买多个地产
        game::test_set_player_position(&mut game, utils::admin_addr(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);

        // 升级到最高级
        let mut i = 0;
        while (i < 4) {
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::upgrade_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
            i = i + 1;
        };

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));

        // 设置其他玩家现金很少
        game::test_set_player_cash(&mut game, utils::alice(), 100);
        game::test_set_player_cash(&mut game, utils::bob(), 100);
        game::test_set_player_cash(&mut game, utils::carol(), 100);

        // 逐个触发破产
        game::test_trigger_bankruptcy(&mut game, utils::alice(), 5000, option::some(utils::admin_addr()));
        game::test_trigger_bankruptcy(&mut game, utils::bob(), 5000, option::some(utils::admin_addr()));

        // 此时游戏还没结束（还有2个非破产玩家）
        assert!(game::get_status(&game) == types::status_active(), 1);

        // 最后一个破产导致游戏结束
        game::test_trigger_bankruptcy(&mut game, utils::carol(), 5000, option::some(utils::admin_addr()));

        // 验证游戏结束，Admin是赢家
        assert!(game::get_status(&game) == types::status_ended(), 2);
        assert!(game::get_winner(&game) == option::some(utils::admin_addr()), 3);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        scenario::return_shared(registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}