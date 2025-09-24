// 基础游戏功能测试
#[test_only]
module tycoon::game_basic_tests {
    use std::option;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;
    use sui::object;
    use sui::random::{Self, Random};

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game};
    use tycoon::map;
    use tycoon::tycoon;
    use tycoon::admin::{Self, AdminCap};
    use tycoon::types;

    // 测试地图创建
    #[test]
    fun test_map_creation() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化管理模块
        scenario::next_tx(scenario, utils::admin_addr());
        {
            tycoon::init_for_testing(scenario::ctx(scenario));
        };

        // 创建并注册地图
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let admin_cap = scenario::take_from_sender<AdminCap>(scenario);
            let mut game_data = scenario::take_shared<tycoon::GameData>(scenario);

            // 发布测试地图 - 直接传递整个GameData，让publish_test_map内部获取registry
            let registry = tycoon::borrow_map_registry_mut(&mut game_data);
            admin::publish_test_map(registry, &admin_cap, scenario::ctx(scenario));

            // 验证地图已注册 (测试地图的template_id是1)
            let registry_ref = tycoon::borrow_map_registry(&game_data);
            assert!(map::has_template(registry_ref, 1), 1);

            scenario::return_to_sender(scenario, admin_cap);
            scenario::return_shared(game_data);
        };

        scenario::end(scenario_val);
    }

    // 测试游戏创建和加入
    #[test]
    fun test_game_creation_and_join() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 创建测试游戏
        let _game_id = utils::create_test_game(scenario);

        // 获取游戏对象
        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);

        // 验证初始状态
        assert!(game::get_status(&game) == types::status_ready(), 1);
        assert!(game::get_turn(&game) == 0, 2);
        assert!(game::get_round(&game) == 0, 3);

        // 玩家加入游戏
        utils::join_game(&mut game, utils::alice(), scenario);

        scenario::return_shared(game);
        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);

        // 验证玩家数量（创建者 + Alice = 2）
        let players = game::get_players(&game);
        assert!(players.length() == 2, 3);

        scenario::return_shared(game);
        scenario::end(scenario_val);
    }

    // 测试多玩家加入
    #[test]
    fun test_multiple_players_join() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);

        // 多个玩家加入
        let players = vector[utils::alice(), utils::bob(), utils::carol()];
        utils::join_players(&mut game, players, scenario);
        scenario::return_shared(game);

        scenario::next_tx(scenario, utils::admin_addr());
        let game = scenario::take_shared<Game>(scenario);

        // 验证所有玩家都已加入（创建者 + 3个玩家 = 4）
        let all_players = game::get_players(&game);
        assert!(all_players.length() == 4, 1);

        scenario::return_shared(game);
        scenario::end(scenario_val);
    }

    // 测试游戏开始和回合切换
    #[test]
    fun test_game_start_and_turns() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 玩家加入
        utils::join_players(&mut game, vector[utils::alice(), utils::bob()], scenario);

        // 开始游戏
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);

        scenario::next_tx(scenario, utils::admin_addr());
        let game = scenario::take_shared<Game>(scenario);

        // 验证游戏已开始
        assert!(game::get_status(&game) == types::status_active(), 1);
        let (round, turn) = game::get_round_and_turn(&game);
        assert!(round == 0, 2);  // 第一轮
        assert!(turn == 0, 3);   // 第一个玩家的回合

        // 验证当前玩家（应该是第一个玩家）
        let current_player = game::current_turn_player(&game);
        assert!(current_player == utils::admin_addr(), 3);

        // 执行一个回合
        scenario::return_shared(game);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);

        utils::play_turn(&mut game, vector[], scenario);
        scenario::return_shared(game);

        scenario::next_tx(scenario, utils::admin_addr());
        let game = scenario::take_shared<Game>(scenario);

        // 验证回合已切换
        let (round2, turn2) = game::get_round_and_turn(&game);
        assert!(round2 == 0, 4);  // 仍然是第一轮
        assert!(turn2 == 1, 5);   // 第二个玩家的回合
        let next_player = game::current_turn_player(&game);
        assert!(next_player == utils::alice(), 6);

        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试游戏状态验证
    #[test]
    fun test_game_status_validation() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        // 初始状态应该是ready
        utils::assert_game_status(&game, types::status_ready());

        // 加入玩家
        utils::join_players(&mut game, vector[utils::alice()], scenario);

        // 开始游戏
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);

        scenario::next_tx(scenario, utils::admin_addr());
        let game = scenario::take_shared<Game>(scenario);

        // 状态应该是active
        utils::assert_game_status(&game, types::status_active());

        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试无法在游戏开始后加入
    #[test]
    #[expected_failure(abort_code = 1004)] // EAlreadyStarted
    fun test_cannot_join_after_start() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let clock = utils::create_test_clock(scenario);

        // Alice加入
        utils::join_game(&mut game, utils::alice(), scenario);

        // 开始游戏
        utils::start_game(&mut game, &clock, scenario);
        scenario::return_shared(game);

        // Bob尝试加入（应该失败）
        scenario::next_tx(scenario, utils::bob());
        let game = scenario::take_shared<Game>(scenario);
        let coin = utils::mint_sui(10000, scenario::ctx(scenario));
        game::join_with_coin(&mut game, coin, scenario::ctx(scenario));

        scenario::return_shared(game);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }

    // 测试最少玩家数量要求
    #[test]
    #[expected_failure(abort_code = 1003)] // err_not_enough_players
    fun test_minimum_players_requirement() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        let _game_id = utils::create_test_game(scenario);

        // 不加入额外玩家，直接尝试开始游戏（只有创建者）
        scenario::next_tx(scenario, utils::admin_addr());
        let mut game = scenario::take_shared<Game>(scenario);
        let mut r = scenario::take_shared<Random>(scenario);
        // 显式更新随机信标
        random::update_randomness_state_for_testing(
            &mut r,
            0,
            b"test_start_alone",
            scenario::ctx(scenario)
        );
        let clock = utils::create_test_clock(scenario);
        game::start(&mut game, &r, &clock, scenario::ctx(scenario));

        scenario::return_shared(game);
        scenario::return_shared(r);
        clock::destroy_for_testing(clock);
        scenario::end(scenario_val);
    }
}