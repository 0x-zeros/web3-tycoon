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

    // 测试遥控骰卡
    #[test]
    fun test_move_control_card() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);
        let card_registry = scenario::take_shared<CardRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin使用遥控骰卡
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        // 给Admin遥控骰卡
        game::test_give_card(&mut game, utils::admin_addr(), types::card_move_ctrl(), 1);

        // 使用遥控骰卡
        game::use_card(
            &mut game,
            &seat,
            types::card_move_ctrl(),
            vector[],  // 无参数
            &map_registry,
            &card_registry,
            scenario::ctx(scenario)
        );

        // 验证玩家有遥控骰效果buff
        assert!(game::has_buff(&game, utils::admin_addr(), types::buff_move_ctrl()), 1);

        // 掷骰移动
        let r = scenario::take_shared<Random>(scenario);
        game::roll_and_step(
            &mut game,
            &seat,
            option::none(),
            &map_registry,
            &r,
            &clock,
            scenario::ctx(scenario)
        );
        scenario::return_shared(r);

        // 验证移动了3步
        utils::assert_player_position(&game, utils::admin_addr(), 3);

        scenario::return_shared(game);
        scenario::return_shared(map_registry);
        scenario::return_shared(card_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试经过卡牌格抽卡
    #[test]
    fun test_card_draw_on_pass() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 创建包含卡牌格的复杂地图
        scenario::next_tx(scenario, utils::admin_addr());
        {
            tycoon::tycoon::init_for_testing(scenario::ctx(scenario));
            // CardRegistry 在 tycoon::tycoon::init_for_testing 中创建
        };

        scenario::next_tx(scenario, utils::admin_addr());
        let admin_cap = scenario::take_from_sender<AdminCap>(scenario);
        let mut registry = scenario::take_shared<MapRegistry>(scenario);

        // 创建复杂地图（包含卡牌格）
        let template_id = utils::create_complex_map(&admin_cap, &mut registry, scenario::ctx(scenario));

        scenario::return_to_sender(scenario, admin_cap);
        scenario::return_shared(registry);

        // 创建游戏
        scenario::next_tx(scenario, utils::admin_addr());
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let _game_id = game::create_game_with_config(
            b"Test Game",
            template_id,
            option::none(),
            &registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(registry);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin移动经过卡牌格（位置5是卡牌格）
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);

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
        scenario::return_shared(map_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试停留卡牌格抽卡
    #[test]
    fun test_card_draw_on_stop() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 使用复杂地图设置
        scenario::next_tx(scenario, utils::admin_addr());
        {
            tycoon::tycoon::init_for_testing(scenario::ctx(scenario));
            // CardRegistry 在 tycoon::tycoon::init_for_testing 中创建
        };

        scenario::next_tx(scenario, utils::admin_addr());
        let admin_cap = scenario::take_from_sender<AdminCap>(scenario);
        let mut registry = scenario::take_shared<MapRegistry>(scenario);

        let template_id = utils::create_complex_map(&admin_cap, &mut registry, scenario::ctx(scenario));

        scenario::return_to_sender(scenario, admin_cap);
        scenario::return_shared(registry);

        scenario::next_tx(scenario, utils::admin_addr());
        let registry = scenario::take_shared<MapRegistry>(scenario);
        let _game_id = game::create_game_with_config(
            b"Test Game",
            template_id,
            option::none(),
            &registry,
            scenario::ctx(scenario)
        );
        scenario::return_shared(registry);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::start_game(&mut game, &clock, scenario);

        // 停留在卡牌格
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);

        let initial_cards = game::get_player_total_cards(&game, utils::admin_addr());

        // 直接设置在卡牌格上
        game::test_set_player_position(&mut game, utils::admin_addr(), 5);

        // 处理停留效果
        game::handle_tile_stop_effect(
            &mut game,
            utils::admin_addr(),
            5,
            &map_registry
        );

        // 验证获得了卡牌（停留获得2张）
        let final_cards = game::get_player_total_cards(&game, utils::admin_addr());
        assert!(final_cards == initial_cards + 2, 1);

        scenario::return_shared(game);
        scenario::return_shared(map_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试清除卡移除NPC
    #[test]
    fun test_cleanse_card_removes_npc() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);
        let card_registry = scenario::take_shared<CardRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin放置路障
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::admin_addr(), types::card_barrier(), 1);

        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[2],  // 目标地块ID
            &map_registry,
            &card_registry,
            scenario::ctx(scenario)
        );

        // 验证NPC已放置
        assert!(game::has_npc_on_tile(&game, 2), 1);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice使用清除卡
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::alice(), types::card_cleanse(), 1);

        game::use_card(
            &mut game,
            &seat,
            types::card_cleanse(),
            vector[2],  // 目标地块ID
            &map_registry,
            &card_registry,
            scenario::ctx(scenario)
        );

        // 验证NPC已被移除
        assert!(!game::has_npc_on_tile(&game, 2), 2);

        scenario::return_shared(game);
        scenario::return_shared(map_registry);
        scenario::return_shared(card_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试冻结卡效果
    #[test]
    fun test_freeze_card_effect() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);
        let card_registry = scenario::take_shared<CardRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin使用冻结卡冻结Alice
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::admin_addr(), types::card_freeze(), 1);

        game::use_card(
            &mut game,
            &seat,
            types::card_freeze(),
            vector[1],  // Alice的player_index是1
            &map_registry,
            &card_registry,
            scenario::ctx(scenario)
        );

        // 验证Alice被冻结
        assert!(game::is_player_frozen(&game, utils::alice()), 1);

        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice的回合应该被跳过
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        // 尝试移动（应该被跳过）
        let r = scenario::take_shared<Random>(scenario);
        game::roll_and_step(
            &mut game,
            &seat,
            option::none(),
            &map_registry,
            &r,
            &clock,
            scenario::ctx(scenario)
        );
        scenario::return_shared(r);

        // 验证回合已切换回Admin
        assert!(game::current_turn_player(&game) == utils::admin_addr(), 2);

        scenario::return_shared(game);
        scenario::return_shared(map_registry);
        scenario::return_shared(card_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试免租卡效果
    #[test]
    fun test_rent_free_card_effect() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);
        let card_registry = scenario::take_shared<CardRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::join_players(&mut game, vector[utils::alice()], scenario);
        utils::start_game(&mut game, &clock, scenario);

        // Admin购买地产
        scenario::next_tx(scenario, utils::admin_addr());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_set_player_position(&mut game, utils::admin_addr(), 1);
        game::buy_property(&mut game, &seat, &map_registry, scenario::ctx(scenario));
        game::end_turn(&mut game, &seat, scenario::ctx(scenario));
        scenario::return_shared(game);

        // Alice使用免租卡
        scenario::next_tx(scenario, utils::alice());
        game = scenario::take_shared<Game>(scenario);
        let seat = utils::get_current_player_seat(&game, scenario);

        game::test_give_card(&mut game, utils::alice(), types::card_rent_free(), 1);

        let alice_initial_cash = game::get_player_cash(&game, utils::alice());

        game::use_card(
            &mut game,
            &seat,
            types::card_rent_free(),
            vector[],  // 无参数
            &map_registry,
            &card_registry,
            scenario::ctx(scenario)
        );

        // 移动到Admin的地产
        game::test_set_player_position(&mut game, utils::alice(), 1);

        // 处理停留效果（应该免租）
        game::handle_tile_stop_effect(
            &mut game,
            utils::alice(),
            1,
            &map_registry
        );

        // 验证Alice没有支付租金
        assert!(game::get_player_cash(&game, utils::alice()) == alice_initial_cash, 1);

        scenario::return_shared(game);
        scenario::return_shared(map_registry);
        scenario::return_shared(card_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试卡牌数量管理
    #[test]
    fun test_card_count_management() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化 admin 模块（会创建 MapRegistry 和 CardRegistry）
        tycoon::tycoon::init_for_testing(scenario::ctx(scenario));

        scenario::next_tx(scenario, utils::admin_addr());
        let game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let map_registry = scenario::take_shared<MapRegistry>(scenario);
        let card_registry = scenario::take_shared<CardRegistry>(scenario);
        let clock = utils::create_test_clock(scenario);

        scenario::return_shared(game);
        utils::start_game(&mut game, &clock, scenario);

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
        game::use_card(
            &mut game,
            &seat,
            types::card_barrier(),
            vector[1],  // 目标地块ID
            &map_registry,
            &card_registry,
            scenario::ctx(scenario)
        );

        // 验证卡牌数量减少
        assert!(game::get_player_card_count(&game, utils::admin_addr(), types::card_barrier()) == 2, 5);
        assert!(game::get_player_total_cards(&game, utils::admin_addr()) == 5, 6);

        scenario::return_shared(game);
        scenario::return_shared(map_registry);
        scenario::return_shared(card_registry);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}
