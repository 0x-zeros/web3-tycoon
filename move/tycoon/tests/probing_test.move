// 探针法NPC生成测试
#[test_only]
module tycoon::probing_test {
    use std::option;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;
    use sui::random::{Self, Random};

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game};
    use tycoon::tycoon;
    use tycoon::admin::{Self, AdminCap};
    use tycoon::types;
    use tycoon::map;

    // 测试探针法在不同地图规模下的效果
    #[test]
    fun test_probing_spawn_performance() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化
        scenario::next_tx(scenario, utils::admin_addr());
        {
            tycoon::init_for_testing(scenario::ctx(scenario));
            random::create_for_testing(scenario::ctx(scenario));
            clock::create_for_testing(scenario::ctx(scenario));
        };

        // 创建测试地图
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let admin_cap = scenario::take_from_sender<AdminCap>(scenario);
            let mut game_data = scenario::take_shared<tycoon::GameData>(scenario);

            let registry = tycoon::borrow_map_registry_mut(&mut game_data);
            admin::publish_test_map(registry, &admin_cap, scenario::ctx(scenario));

            scenario::return_to_sender(scenario, admin_cap);
            scenario::return_shared(game_data);
        };

        // 创建游戏
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
            game::create(
                1, // template_id
                10000, // starting_cash
                15, // price_rise_days
                0, // max_rounds (无限)
                &game_data,
                scenario::ctx(scenario)
            );
            scenario::return_shared(game_data);
        };

        // 添加玩家并开始游戏
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
            game::join(&mut game, &game_data, scenario::ctx(scenario));
            scenario::return_shared(game);
            scenario::return_shared(game_data);
        };

        scenario::next_tx(scenario, utils::player_addr(1));
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
            game::join(&mut game, &game_data, scenario::ctx(scenario));
            scenario::return_shared(game);
            scenario::return_shared(game_data);
        };

        // 开始游戏，测试NPC生成
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);
            let clock = scenario::take_shared<clock::Clock>(scenario);

            // 开始游戏会生成3个初始NPC
            game::start(&mut game, &game_data, &r, &clock, scenario::ctx(scenario));

            // 验证NPC已生成（通过检查tiles上的npc_on字段）
            let mut npc_count = 0u64;
            let tiles = game::get_tiles_for_testing(&game);
            let mut i = 0;
            while (i < tiles.length()) {
                if (game::get_tile_npc_for_testing(tiles, i) != 0) {
                    npc_count = npc_count + 1;
                };
                i = i + 1;
            };

            // 应该生成了至少1个NPC（取决于可用地块数量）
            assert!(npc_count > 0, 1001);

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
            scenario::return_shared(clock);
        };

        // 测试多轮NPC生成
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<tycoon::GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);

            // 手动生成更多NPC，测试探针法效率
            let map_registry = tycoon::get_map_registry(&game_data);
            let template_id = game::get_template_id_for_testing(&game);
            let template = map::get_template(map_registry, template_id);

            let mut generator = random::new_generator(&r, scenario::ctx(scenario));

            // 尝试生成10个NPC，测试探针法在地图逐渐变满时的表现
            let mut i = 0;
            while (i < 10) {
                game::spawn_random_npc(&mut game, template, &mut generator);
                i = i + 1;
            };

            // 再次统计NPC数量
            let mut npc_count = 0u64;
            let tiles = game::get_tiles_for_testing(&game);
            let mut j = 0;
            while (j < tiles.length()) {
                if (game::get_tile_npc_for_testing(tiles, j) != 0) {
                    npc_count = npc_count + 1;
                };
                j = j + 1;
            };

            // 验证NPC数量增加了
            assert!(npc_count > 1, 1002);

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
        };

        scenario::end(scenario_val);
    }
}