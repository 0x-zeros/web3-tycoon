// Simple test to verify GameData configuration works
#[test_only]
module tycoon::test_config {
    use sui::test_scenario;
    use tycoon::tycoon::{Self, GameData};
    use tycoon::admin::{Self, AdminCap};
    use tycoon::game;

    #[test]
    fun test_gamedata_configuration() {
        let mut scenario_val = test_scenario::begin(@0xAD);
        let scenario = &mut scenario_val;

        // Initialize
        test_scenario::next_tx(scenario, @0xAD);
        {
            tycoon::init_for_testing(test_scenario::ctx(scenario));
        };

        // Get GameData and AdminCap
        test_scenario::next_tx(scenario, @0xAD);
        {
            let mut game_data = test_scenario::take_shared<GameData>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);

            // Test initial values
            assert!(tycoon::get_starting_cash(&game_data) == 10000, 1);

            // Test upgrade multipliers
            let upgrade_mults = tycoon::get_upgrade_multipliers(&game_data);
            assert!(upgrade_mults.length() == 4, 2);
            assert!(upgrade_mults[0] == 150, 3);

            // Test toll multipliers
            let toll_mults = tycoon::get_toll_multipliers(&game_data);
            assert!(toll_mults.length() == 5, 4);
            assert!(toll_mults[0] == 100, 5);

            // Update starting cash
            tycoon::update_starting_cash(&mut game_data, 20000, &admin_cap);
            assert!(tycoon::get_starting_cash(&game_data) == 20000, 6);

            // Update upgrade multipliers
            let new_upgrade_mults = vector[200, 300, 400, 600];
            tycoon::update_upgrade_multipliers(&mut game_data, new_upgrade_mults, &admin_cap);
            let updated_mults = tycoon::get_upgrade_multipliers(&game_data);
            assert!(updated_mults[0] == 200, 7);

            test_scenario::return_shared(game_data);
            test_scenario::return_to_sender(scenario, admin_cap);
        };

        test_scenario::end(scenario_val);
    }

    // 注释掉这个测试，因为 calculate_toll 和 calculate_upgrade_cost 现在需要 Game 对象
    // 这些函数的测试已经在 game_basic.move 中覆盖
    // #[test]
    // fun test_calculation_functions() {
    //     // 这个测试已过时，因为函数签名已更改
    //     // calculate_toll 和 calculate_upgrade_cost 现在需要 Game 对象来获取价格指数
    // }
}