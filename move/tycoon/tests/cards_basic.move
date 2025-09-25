// 卡牌系统测试
#[test_only]
module tycoon::cards_basic_tests {
    use std::option;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;
    use sui::random::{Self, Random};

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game};
    use tycoon::map::{MapRegistry};
    use tycoon::cards::{Self, CardRegistry};
    use tycoon::admin::{AdminCap};
    use tycoon::types;
    use tycoon::tycoon;

    // 测试遥控骰卡
    #[test]
    fun test_move_control_card() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        let mut game = scenario::take_shared<Game>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, &game_data, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);
        scenario::return_shared(game_data);

        // Admin使用遥控骰卡
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        // 给Admin遥控骰卡
        game::test_give_card(&mut game, utils::admin_addr(), types::card_move_ctrl(), 1);

        // 使用遥控骰卡
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_move_ctrl(),
            vector[],  // 无参数
            &game_data,
            scenario::ctx(scenario)
        );
        scenario::return_shared(game_data);

        // 验证玩家有遥控骰效果buff
        assert!(game::has_buff(&game, utils::admin_addr(), types::buff_move_ctrl()), 1);

        // 掷骰移动
        let mut r = scenario::take_shared<Random>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        // 显式更新随机信标
        random::update_randomness_state_for_testing(
            &mut r,
            1,
            b"test_move_ctrl_card",
            scenario::ctx(scenario)
        );
        game::roll_and_step(
            &mut game,
            &seat,
            vector[],  // 空的路径选择
            &game_data,
            &r,
            &clock,
            scenario::ctx(scenario)
        );
        scenario::return_shared(r);
        scenario::return_shared(game_data);

        // 验证移动了3步
        utils::assert_player_position(&game, utils::admin_addr(), 3);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试经过卡牌格抽卡
    #[test]
    fun test_card_draw_on_pass() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 创建包含卡牌格的复杂地图
        // 创建测试游戏（使用默认的测试地图）
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        let mut game = scenario::take_shared<Game>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, &game_data, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);
        scenario::return_shared(game_data);

        // Admin移动经过卡牌格（位置5是卡牌格）
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);

        // 获取初始卡牌数量
        let initial_cards = game::get_player_total_cards(&game, utils::admin_addr());

        // 设置位置并移动经过卡牌格
        game::test_set_player_position(&mut game, utils::admin_addr(), 4);
        // 模拟移动经过卡牌格
        game::test_set_player_position(&mut game, utils::admin_addr(), 5);

        // 验证获得了卡牌（经过获得1张）
        let final_cards = game::get_player_total_cards(&game, utils::admin_addr());
        assert!(final_cards == initial_cards + 1, 1);

        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试停留卡牌格抽卡
    #[test]
    fun test_card_draw_on_stop() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 使用复杂地图设置
        // 创建测试游戏（使用默认的测试地图）
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);

        // 停留在卡牌格
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);

        let initial_cards = game::get_player_total_cards(&game, utils::admin_addr());

        // 直接设置在卡牌格上
        game::test_set_player_position(&mut game, utils::admin_addr(), 5);

        // 处理停留效果
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::handle_tile_stop_effect(
            &mut game,
            utils::admin_addr(),
            5,
            &game_data
        );
        scenario::return_shared(game_data);

        // 验证获得了卡牌（停留获得2张）
        let final_cards = game::get_player_total_cards(&game, utils::admin_addr());
        assert!(final_cards == initial_cards + 2, 1);

        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试清除卡移除NPC
    #[test]
    fun test_cleanse_card_removes_npc() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        let mut game = scenario::take_shared<Game>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, &game_data, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);
        scenario::return_shared(game_data);

        // Admin放置路障
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 1);

        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[2],  // 目标地块ID
            &game_data,
            scenario::ctx(scenario)
        );
        scenario::return_shared(game_data);

        // 验证NPC已放置
        assert!(game::has_npc_on_tile(&game, 2), 1);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);

        // Alice使用清除卡
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::alice(), types::card_cleanse(), 1);

        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_cleanse(),
            vector[2],  // 目标地块ID
            &game_data,
            scenario::ctx(scenario)
        );
        scenario::return_shared(game_data);

        // 验证NPC已被移除
        assert!(!game::has_npc_on_tile(&game, 2), 2);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试冻结卡效果
    #[test]
    fun test_freeze_card_effect() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        let mut game = scenario::take_shared<Game>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, &game_data, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);
        scenario::return_shared(game_data);

        // Admin使用冻结卡冻结Alice
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::admin_addr(), types::card_freeze(), 1);

        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_freeze(),
            vector[1],  // Alice的player_index是1
            &game_data,
            scenario::ctx(scenario)
        );
        scenario::return_shared(game_data);

        // 验证Alice被冻结
        assert!(game::is_player_frozen(&game, utils::alice()), 1);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);

        // Alice的回合应该被跳过
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        // 尝试移动（应该被跳过）
        let mut r = scenario::take_shared<Random>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        // 显式更新随机信标
        random::update_randomness_state_for_testing(
            &mut r,
            2,
            b"test_freeze_skip",
            scenario::ctx(scenario)
        );
        game::roll_and_step(
            &mut game,
            &seat,
            vector[],  // 空的路径选择
            &game_data,
            &r,
            &clock,
            scenario::ctx(scenario)
        );
        scenario::return_shared(r);
        scenario::return_shared(game_data);

        // 验证回合已切换回Admin
        assert!(game::current_turn_player(&game) == utils::admin_addr(), 2);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试免租卡效果
    #[test]
    fun test_rent_free_card_effect() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        let mut game = scenario::take_shared<Game>(scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::join_players(&mut game, &game_data, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);
        scenario::return_shared(game_data);

        // Admin购买地产
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_set_player_position(&mut game, utils::admin_addr(), 1);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::buy_property(&mut game, &seat, &game_data, scenario::ctx(scenario));
        scenario::return_shared(game_data);
        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);

        // Alice使用免租卡
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::alice(), types::card_rent_free(), 1);

        let alice_initial_cash = game::get_player_cash(&game, utils::alice());

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

        // 移动到Admin的地产
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

        // 验证Alice没有支付租金
        assert!(game::get_player_cash(&game, utils::alice()) == alice_initial_cash, 1);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试卡牌数量管理
    #[test]
    fun test_card_count_management() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);

        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);

        // 给玩家多张卡牌
        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 3);
        game::test_give_card(&mut game, utils::admin_addr(), types::card_bomb(), 2);
        game::test_give_card(&mut game, utils::admin_addr(), types::card_freeze(), 1);

        // 验证各种卡牌数量
        assert!(game::get_player_card_count(&game, utils::admin_addr(), types::card_barrier()) == 3, 1);
        assert!(game::get_player_card_count(&game, utils::admin_addr(), types::card_bomb()) == 2, 2);
        assert!(game::get_player_card_count(&game, utils::admin_addr(), types::card_freeze()) == 1, 3);

        // 验证总卡牌数
        assert!(game::get_player_total_cards(&game, utils::admin_addr()) == 6, 4);

        // 使用一张路障卡
        let seat = utils::get_current_player_seat(&game, scenario);
        let game_data = scenario::take_shared<tycoon::GameData>(scenario);
        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[1],  // 目标地块ID
            &game_data,
            scenario::ctx(scenario)
        );
        scenario::return_shared(game_data);

        // 验证卡牌数量减少
        assert!(game::get_player_card_count(&game, utils::admin_addr(), types::card_barrier()) == 2, 5);
        assert!(game::get_player_total_cards(&game, utils::admin_addr()) == 5, 6);

        scenario::return_to_sender(scenario, seat);
        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}
