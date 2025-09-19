// 测试工具模块 - 提供测试辅助函数
#[test_only]
module tycoon::test_utils {
    use std::option::{Self, Option};
    use sui::object::{Self, ID};
    use sui::clock::{Self, Clock};
    use sui::test_scenario::{Self as scenario, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    use tycoon::types;
    use tycoon::game::{Self, Game, TurnCap};
    use tycoon::admin::{Self, AdminCap};
    use tycoon::map::{Self, MapRegistry, MapTemplate};

    // ===== 测试用户地址 =====
    public fun alice(): address { @0xA11CE }
    public fun bob(): address { @0xB0B }
    public fun carol(): address { @0xCAA01 }
    public fun dave(): address { @0xDAEE }
    public fun admin_addr(): address { @0xAD }

    // ===== 游戏初始化辅助函数 =====

    // 创建测试游戏（带默认配置）
    public fun create_test_game(scenario: &mut Scenario): ID {
        scenario::next_tx(scenario, admin_addr());
        {
            admin::init_for_testing(scenario::ctx(scenario));
        };

        scenario::next_tx(scenario, admin_addr());
        {
            let admin_cap = scenario::take_from_sender<AdminCap>(scenario);
            let registry = scenario::take_shared<MapRegistry>(scenario);

            // 创建简单测试地图模板
            let template_id = create_simple_map(&admin_cap, &mut registry, scenario::ctx(scenario));

            // 创建游戏
            let game_id = game::create_game_with_config(
                b"Test Game",
                template_id,
                option::none(),  // 使用默认配置
                &registry,
                scenario::ctx(scenario)
            );

            scenario::return_to_sender(scenario, admin_cap);
            scenario::return_shared(registry);

            game_id
        }
    }

    // 创建简单的测试地图（4个地块的环形）
    public fun create_simple_map(
        admin_cap: &AdminCap,
        registry: &mut MapRegistry,
        ctx: &mut TxContext
    ): ID {
        let mut template = map::create_template(
            b"Simple Test Map",
            b"4-tile ring map",
            4,  // 宽度
            1,  // 高度
            ctx
        );

        // 添加4个地块
        map::add_tile(&mut template, 0, 0, types::tile_property(), b"Property 1", 1000, 100);
        map::add_tile(&mut template, 1, 0, types::tile_property(), b"Property 2", 1500, 150);
        map::add_tile(&mut template, 2, 0, types::tile_chance(), b"Chance", 0, 0);
        map::add_tile(&mut template, 3, 0, types::tile_property(), b"Property 3", 2000, 200);

        // 添加连接（形成环）
        map::add_connection(&mut template, 0, 1);
        map::add_connection(&mut template, 1, 2);
        map::add_connection(&mut template, 2, 3);
        map::add_connection(&mut template, 3, 0);

        // 完成地图并注册
        map::finalize_template(&mut template);
        let template_id = map::register_template(admin_cap, registry, template, ctx);

        template_id  // 返回实际的模板ID
    }

    // 创建复杂的测试地图（8个地块，包含各种类型）
    public fun create_complex_map(
        admin_cap: &AdminCap,
        registry: &mut MapRegistry,
        ctx: &mut TxContext
    ): ID {
        let mut template = map::create_template(
            b"Complex Test Map",
            b"8-tile map with various types",
            4,
            2,
            ctx
        );

        // 第一行
        map::add_tile(&mut template, 0, 0, types::tile_property(), b"Start", 1000, 100);
        map::add_tile(&mut template, 1, 0, types::tile_property(), b"Broadway", 2000, 200);
        map::add_tile(&mut template, 2, 0, types::tile_hospital(), b"Hospital", 0, 0);
        map::add_tile(&mut template, 3, 0, types::tile_property(), b"Park Place", 3000, 300);

        // 第二行
        map::add_tile(&mut template, 0, 1, types::tile_prison(), b"Prison", 0, 0);
        map::add_tile(&mut template, 1, 1, types::tile_card(), b"Card", 0, 0);
        map::add_tile(&mut template, 2, 1, types::tile_chance(), b"Chance", 0, 0);
        map::add_tile(&mut template, 3, 1, types::tile_lottery(), b"Lottery", 0, 0);

        // 添加连接（形成8字形路径）
        map::add_connection(&mut template, 0, 1);
        map::add_connection(&mut template, 1, 2);
        map::add_connection(&mut template, 2, 3);
        map::add_connection(&mut template, 3, 7);  // 连接到第二行
        map::add_connection(&mut template, 7, 6);
        map::add_connection(&mut template, 6, 5);
        map::add_connection(&mut template, 5, 4);
        map::add_connection(&mut template, 4, 0);  // 回到起点

        // 添加分叉（在position 2可以选择走向position 5）
        map::add_connection(&mut template, 2, 5);

        map::finalize_template(&mut template);
        let template_id = map::register_template(admin_cap, registry, template, ctx);

        template_id
    }

    // ===== 玩家操作辅助函数 =====

    // 让玩家加入游戏
    public fun join_game(
        game: &mut Game,
        player: address,
        scenario: &mut Scenario
    ) {
        scenario::next_tx(scenario, player);
        {
            let coin = coin::mint_for_testing<SUI>(20000, scenario::ctx(scenario));
            game::join_with_coin(game, coin, scenario::ctx(scenario));
        };
    }

    // 批量加入玩家
    public fun join_players(
        game: &mut Game,
        players: vector<address>,
        scenario: &mut Scenario
    ) {
        let mut i = 0;
        while (i < players.length()) {
            join_game(game, *players.borrow(i), scenario);
            i = i + 1;
        };
    }

    // 开始游戏
    public fun start_game(
        game: &mut Game,
        scenario: &mut Scenario
    ) {
        scenario::next_tx(scenario, admin_addr());
        game::start(game, scenario::ctx(scenario));
    }

    // 创建并获取回合令牌
    public fun mint_turn_cap(
        game: &mut Game,
        clock: &Clock,
        scenario: &mut Scenario
    ): TurnCap {
        let player = game::current_turn_player(game);
        scenario::next_tx(scenario, player);
        game::mint_turncap(game, clock, scenario::ctx(scenario));
        scenario::take_from_sender<TurnCap>(scenario)
    }

    // 执行掷骰并移动
    public fun roll_and_move(
        game: &mut Game,
        cap: TurnCap,
        dir_intent: Option<u8>,
        registry: &MapRegistry,
        clock: &Clock,
        scenario: &mut Scenario
    ) {
        let player = game::current_turn_player(game);
        scenario::next_tx(scenario, player);
        game::roll_and_step(game, cap, dir_intent, registry, clock, scenario::ctx(scenario));
    }

    // 结束回合
    public fun end_turn(
        game: &mut Game,
        cap: TurnCap,
        scenario: &mut Scenario
    ) {
        let player = cap.player;
        scenario::next_tx(scenario, player);
        game::end_turn(game, cap, scenario::ctx(scenario));
    }

    // 完整的回合流程
    public fun play_turn(
        game: &mut Game,
        dir_intent: Option<u8>,
        registry: &MapRegistry,
        clock: &Clock,
        scenario: &mut Scenario
    ) {
        let cap = mint_turn_cap(game, clock, scenario);
        let player = cap.player;

        scenario::next_tx(scenario, player);
        game::roll_and_step(game, cap, dir_intent, registry, clock, scenario::ctx(scenario));

        // 获取新的令牌（如果移动后还能操作）
        if (scenario::has_most_recent_for_sender<TurnCap>(scenario)) {
            let cap = scenario::take_from_sender<TurnCap>(scenario);
            scenario::next_tx(scenario, player);
            game::end_turn(game, cap, scenario::ctx(scenario));
        };
    }

    // ===== 断言辅助函数 =====

    // 断言玩家位置
    public fun assert_player_position(
        game: &Game,
        player: address,
        expected_pos: u64
    ) {
        let actual_pos = game::get_player_position(game, player);
        assert!(actual_pos == expected_pos, 1001);
    }

    // 断言玩家现金
    public fun assert_player_cash(
        game: &Game,
        player: address,
        expected_cash: u64
    ) {
        let actual_cash = game::get_player_cash(game, player);
        assert!(actual_cash == expected_cash, 1002);
    }

    // 断言地产所有者
    public fun assert_property_owner(
        game: &Game,
        tile_id: u64,
        expected_owner: Option<address>
    ) {
        let actual_owner = game::get_property_owner(game, tile_id);
        assert!(actual_owner == expected_owner, 1003);
    }

    // 断言地产等级
    public fun assert_property_level(
        game: &Game,
        tile_id: u64,
        expected_level: u8
    ) {
        let actual_level = game::get_property_level(game, tile_id);
        assert!(actual_level == expected_level, 1004);
    }

    // 断言游戏状态
    public fun assert_game_status(
        game: &Game,
        expected_status: u8
    ) {
        let actual_status = game::get_status(game);
        assert!(actual_status == expected_status, 1005);
    }

    // 断言当前回合玩家
    public fun assert_current_player(
        game: &Game,
        expected_player: address
    ) {
        let actual_player = game::current_turn_player(game);
        assert!(actual_player == expected_player, 1006);
    }

    // ===== 测试时钟辅助函数 =====

    // 创建测试时钟
    public fun create_test_clock(scenario: &mut Scenario): Clock {
        scenario::next_tx(scenario, admin_addr());
        clock::create_for_testing(scenario::ctx(scenario))
    }

    // 推进时钟
    public fun advance_clock(clock: &mut Clock, ms: u64) {
        clock::increment_for_testing(clock, ms);
    }

    // ===== 创建测试币 =====

    public fun mint_sui(amount: u64, ctx: &mut TxContext): Coin<SUI> {
        coin::mint_for_testing<SUI>(amount, ctx)
    }

    // ===== 调试辅助函数 =====

    // 打印游戏状态（用于调试）
    public fun print_game_state(game: &Game) {
        let status = game::get_status(game);
        let turn = game::get_turn(game);
        let current_player = if (status == types::status_active()) {
            option::some(game::current_turn_player(game))
        } else {
            option::none()
        };

        // 这里可以添加更多调试信息
        // 注意：实际测试中，这些信息会通过事件或返回值查看
    }
}