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

    #[test]
    fun test_calculation_functions() {
        let mut scenario_val = test_scenario::begin(@0xAD);
        let scenario = &mut scenario_val;

        // Initialize
        test_scenario::next_tx(scenario, @0xAD);
        {
            tycoon::init_for_testing(test_scenario::ctx(scenario));
        };

        // Test calculations
        test_scenario::next_tx(scenario, @0xAD);
        {
            let game_data = test_scenario::take_shared<GameData>(scenario);

            // Test upgrade cost calculation
            // Price 1000, level 0, multiplier 150 (1.5x) = 1500
            let cost = game::calculate_upgrade_cost(1000, 0, &game_data);
            assert!(cost == 1500, 1);

            // Test toll calculation
            // Base toll 100, level 0, multiplier 100 (1x) = 100
            let toll = game::calculate_toll(100, 0, &game_data);
            assert!(toll == 100, 2);

            // Base toll 100, level 2, multiplier 200 (2x) = 200
            let toll2 = game::calculate_toll(100, 2, &game_data);
            assert!(toll2 == 200, 3);

            test_scenario::return_shared(game_data);
        };

        test_scenario::end(scenario_val);
    }
}