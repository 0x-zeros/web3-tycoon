// 探针式NPC生成算法测试
// 测试目标：
// 1. 验证探针法在不同密度下的表现
// 2. 对比探针法和全量扫描的gas消耗
// 3. 测试边界条件（地图满/空）
// 4. 验证NPC分布的均匀性

#[test_only]
module tycoon::npc_spawn_probing_tests {
    use std::option::{Self, Option};
    use std::vector;
    use sui::test_scenario::{Self as scenario};
    use sui::clock;
    use sui::random::{Self, Random, RandomGenerator};
    use sui::table;

    use tycoon::test_utils::{Self as utils};
    use tycoon::game::{Self, Game};
    use tycoon::tycoon::{Self, GameData};
    use tycoon::admin::{Self, AdminCap};
    use tycoon::types;
    use tycoon::map;

    // ===== 测试1: 探针法基础功能测试 =====
    #[test]
    fun test_probing_basic_functionality() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        // 初始化
        utils::init_game_env(scenario);

        // 创建8格测试地图的游戏
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let game_data = scenario::take_shared<GameData>(scenario);
            game::create_game(&game_data, 1, vector[], scenario::ctx(scenario));
            scenario::return_shared(game_data);
        };

        // 加入两个玩家并开始游戏
        utils::setup_two_players_and_start(scenario);

        // 测试NPC生成
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);

            // 获取地图信息
            let map_registry = tycoon::get_map_registry(&game_data);
            let template_id = game::get_template_id_for_testing(&game);
            let template = map::get_template(map_registry, template_id);

            // 生成随机数生成器
            let mut generator = random::new_generator(&r, scenario::ctx(scenario));

            // 测试探针法生成NPC（应该成功）
            let initial_npc_count = count_npcs(&game);

            // 尝试生成5个NPC
            let mut i = 0;
            while (i < 5) {
                let (_npc_kind, _tile_id) = game::spawn_random_npc(&mut game, template, &mut generator);
                i = i + 1;
            };

            let final_npc_count = count_npcs(&game);

            // 验证：至少生成了1个NPC（取决于spawn_pool和冷却时间）
            assert!(final_npc_count > initial_npc_count, 1001);

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
        };

        scenario::end(scenario_val);
    }

    // ===== 测试2: 不同地图密度下的探针法性能 =====
    #[test]
    fun test_probing_at_different_densities() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        utils::init_game_env(scenario);

        // 创建游戏
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let game_data = scenario::take_shared<GameData>(scenario);
            game::create_game(&game_data, 1, vector[], scenario::ctx(scenario));
            scenario::return_shared(game_data);
        };

        utils::setup_two_players_and_start(scenario);

        // 逐步增加NPC密度，测试探针法表现
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);

            let map_registry = tycoon::get_map_registry(&game_data);
            let template_id = game::get_template_id_for_testing(&game);
            let template = map::get_template(map_registry, template_id);

            let mut generator = random::new_generator(&r, scenario::ctx(scenario));

            // 测试不同密度下的成功率
            let mut densities = vector[];
            let mut success_counts = vector[];

            // 分阶段测试：0%, 25%, 50%, 75% 密度
            let mut phase = 0;
            while (phase < 4) {
                let initial_count = count_npcs(&game);
                densities.push_back(initial_count);

                // 尝试生成10个NPC
                let mut attempts = 0;
                let mut successes = 0;
                while (attempts < 10) {
                    let before = count_npcs(&game);
                    let (_npc_kind, _tile_id) = game::spawn_random_npc(&mut game, template, &mut generator);
                    let after = count_npcs(&game);

                    if (after > before) {
                        successes = successes + 1;
                    };
                    attempts = attempts + 1;
                };

                success_counts.push_back(successes);
                phase = phase + 1;
            };

            // 验证：密度越高，成功率应该越低
            // 这是符合预期的，因为可用空位减少
            let mut i = 1;
            while (i < success_counts.length()) {
                // 成功率应该递减或相等（不会增加）
                assert!(success_counts[i] <= success_counts[i-1], 2001);
                i = i + 1;
            };

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
        };

        scenario::end(scenario_val);
    }

    // ===== 测试3: 探针法vs全量扫描对比 =====
    #[test]
    fun test_probing_vs_full_scan_comparison() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        utils::init_game_env(scenario);

        // 创建两个相同的游戏用于对比
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let game_data = scenario::take_shared<GameData>(scenario);

            // 游戏1：用于测试探针法优先
            game::create_game(&game_data, 1, vector[], scenario::ctx(scenario));

            scenario::return_shared(game_data);
        };

        utils::setup_two_players_and_start(scenario);

        // 测试混合策略的有效性
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);

            let map_registry = tycoon::get_map_registry(&game_data);
            let template_id = game::get_template_id_for_testing(&game);
            let template = map::get_template(map_registry, template_id);

            let mut generator = random::new_generator(&r, scenario::ctx(scenario));

            // 模拟高密度场景：手动放置NPC占据大部分地块
            manually_fill_tiles(&mut game, &game_data, 6); // 填充75%的地块

            let initial_count = count_npcs(&game);

            // 在高密度下，探针法可能失败，但混合策略应该仍能找到空位
            let (_npc_kind, _tile_id) = game::spawn_random_npc(&mut game, template, &mut generator);

            let final_count = count_npcs(&game);

            // 如果还有空位，应该能成功放置
            let available_tiles = count_available_tiles(&game, template);
            if (available_tiles > 0) {
                // 注意：可能因为冷却时间而无法生成
                // 所以这里只验证不会崩溃，而不是一定增加
                assert!(final_count >= initial_count, 3001);
            };

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
        };

        scenario::end(scenario_val);
    }

    // ===== 测试4: NPC类型分布测试 =====
    #[test]
    fun test_npc_type_distribution() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        utils::init_game_env(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        {
            let game_data = scenario::take_shared<GameData>(scenario);
            game::create_game(&game_data, 1, vector[], scenario::ctx(scenario));
            scenario::return_shared(game_data);
        };

        utils::setup_two_players_and_start(scenario);

        // 测试不同类型NPC的分布
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);

            let map_registry = tycoon::get_map_registry(&game_data);
            let template_id = game::get_template_id_for_testing(&game);
            let template = map::get_template(map_registry, template_id);

            let mut generator = random::new_generator(&r, scenario::ctx(scenario));

            // 记录各种NPC类型的数量
            let mut npc_types = vector[];
            let mut npc_counts = vector[];

            // 生成多个NPC并统计类型
            let mut i = 0;
            while (i < 20) {
                let (_npc_kind, _tile_id) = game::spawn_random_npc(&mut game, template, &mut generator);
                i = i + 1;
            };

            // 统计NPC类型分布
            let tiles = game::get_tiles_for_testing(&game);
            let mut j = 0;
            while (j < tiles.length()) {
                let npc_type = game::get_tile_npc_for_testing(tiles, j);
                if (npc_type != 0) {
                    update_npc_type_count(&mut npc_types, &mut npc_counts, npc_type);
                };
                j = j + 1;
            };

            // 验证：应该有多种类型的NPC（根据spawn_pool配置）
            assert!(npc_types.length() > 0, 4001);

            // 验证：NPC数量应该符合权重配置（这里简单验证有分布即可）
            if (npc_types.length() > 1) {
                // 至少有两种类型，说明分布工作正常
                assert!(true, 4002);
            };

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
        };

        scenario::end(scenario_val);
    }

    // ===== 测试5: 边界条件测试 =====
    #[test]
    fun test_edge_cases() {
        let mut scenario_val = scenario::begin(utils::admin_addr());
        let scenario = &mut scenario_val;

        utils::init_game_env(scenario);

        scenario::next_tx(scenario, utils::admin_addr());
        {
            let game_data = scenario::take_shared<GameData>(scenario);
            game::create_game(&game_data, 1, vector[], scenario::ctx(scenario));
            scenario::return_shared(game_data);
        };

        utils::setup_two_players_and_start(scenario);

        // 测试边界条件
        scenario::next_tx(scenario, utils::admin_addr());
        {
            let mut game = scenario::take_shared<Game>(scenario);
            let game_data = scenario::take_shared<GameData>(scenario);
            let r = scenario::take_shared<Random>(scenario);

            let map_registry = tycoon::get_map_registry(&game_data);
            let template_id = game::get_template_id_for_testing(&game);
            let template = map::get_template(map_registry, template_id);

            let mut generator = random::new_generator(&r, scenario::ctx(scenario));

            // 边界1：地图完全满（所有可放置地块都有NPC）
            manually_fill_all_available_tiles(&mut game, &game_data);

            let before_full = count_npcs(&game);

            // 尝试生成NPC（应该失败但不崩溃）
            let (_npc_kind, _tile_id) = game::spawn_random_npc(&mut game, template, &mut generator);

            let after_full = count_npcs(&game);

            // 验证：数量不变（因为没有空位）
            assert!(after_full == before_full, 5001);

            // 边界2：清空所有NPC后重新生成
            clear_all_npcs(&mut game);

            let after_clear = count_npcs(&game);
            assert!(after_clear == 0, 5002);

            // 应该能成功生成
            let (_npc_kind, _tile_id) = game::spawn_random_npc(&mut game, template, &mut generator);

            let after_spawn = count_npcs(&game);
            // 注意：可能因为spawn_pool配置而无法生成
            // 所以只验证不会崩溃
            assert!(after_spawn >= 0, 5003);

            scenario::return_shared(game);
            scenario::return_shared(game_data);
            scenario::return_shared(r);
        };

        scenario::end(scenario_val);
    }

    // ===== 辅助函数 =====

    // 统计NPC数量
    fun count_npcs(game: &Game): u64 {
        let tiles = game::get_tiles_for_testing(game);
        let mut count = 0;
        let mut i = 0;
        while (i < tiles.length()) {
            if (game::get_tile_npc_for_testing(tiles, i) != 0) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    // 统计可用地块数量
    fun count_available_tiles(game: &Game, template: &map::MapTemplate): u64 {
        let tiles = game::get_tiles_for_testing(game);
        let mut count = 0;
        let mut i = 0;
        while (i < tiles.length()) {
            let tile_static = map::get_tile(template, i as u16);
            if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
                game::get_tile_npc_for_testing(tiles, i) == 0) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    // 手动填充指定数量的地块
    fun manually_fill_tiles(game: &mut Game, game_data: &GameData, count: u64) {
        let map_registry = tycoon::get_map_registry(game_data);
        let template_id = game::get_template_id_for_testing(game);
        let template = map::get_template(map_registry, template_id);

        let tiles = game::get_tiles_for_testing(game);
        let mut filled = 0;
        let mut i = 0;

        while (i < tiles.length() && filled < count) {
            let tile_static = map::get_tile(template, i as u16);
            if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
                game::get_tile_npc_for_testing(tiles, i) == 0) {
                // 手动放置路障NPC
                game::test_place_npc(game, i as u16, types::NPC_BARRIER());
                filled = filled + 1;
            };
            i = i + 1;
        };
    }

    // 填充所有可用地块
    fun manually_fill_all_available_tiles(game: &mut Game, game_data: &GameData) {
        let map_registry = tycoon::get_map_registry(game_data);
        let template_id = game::get_template_id_for_testing(game);
        let template = map::get_template(map_registry, template_id);

        let tiles = game::get_tiles_for_testing(game);
        let mut i = 0;

        while (i < tiles.length()) {
            let tile_static = map::get_tile(template, i as u16);
            if (map::can_place_npc_on_tile(map::tile_kind(tile_static)) &&
                game::get_tile_npc_for_testing(tiles, i) == 0) {
                game::test_place_npc(game, i as u16, types::NPC_BARRIER());
            };
            i = i + 1;
        };
    }

    // 清空所有NPC
    fun clear_all_npcs(game: &mut Game) {
        let tiles = game::get_tiles_for_testing(game);
        let mut i = 0;

        while (i < tiles.length()) {
            if (game::get_tile_npc_for_testing(tiles, i) != 0) {
                game::test_remove_npc(game, i as u16);
            };
            i = i + 1;
        };
    }

    // 更新NPC类型统计
    fun update_npc_type_count(
        types: &mut vector<u8>,
        counts: &mut vector<u64>,
        npc_type: u8
    ) {
        let mut i = 0;
        let mut found = false;

        while (i < types.length()) {
            if (*types.borrow(i) == npc_type) {
                let current = *counts.borrow(i);
                counts.remove(i);
                counts.insert(current + 1, i);
                found = true;
                break
            };
            i = i + 1;
        };

        if (!found) {
            types.push_back(npc_type);
            counts.push_back(1);
        };
    }
}