/// Profile Registry 模块
/// 使用 Table 存储 game_id/map_id -> profile_id 的映射
/// 客户端可通过 getDynamicFieldObject RPC 免 gas 查询
module tycoon_profiles::registry;

use sui::table::{Self, Table};

/// 错误码：Profile 已注册
const EAlreadyRegistered: u64 = 1;

/// 全局 Profile Registry（shared object）
public struct ProfileRegistry has key {
    id: UID,
    /// game_id -> GameProfile ID
    game_profiles: Table<ID, ID>,
    /// map_id -> MapProfile ID
    map_profiles: Table<ID, ID>,
}

/// 初始化 Registry
fun init(ctx: &mut TxContext) {
    transfer::share_object(ProfileRegistry {
        id: object::new(ctx),
        game_profiles: table::new(ctx),
        map_profiles: table::new(ctx),
    });
}

/// 注册 GameProfile
/// 首次注册原则：禁止覆盖已有映射
public(package) fun register_game_profile(
    registry: &mut ProfileRegistry,
    game_id: ID,
    profile_id: ID,
) {
    assert!(!table::contains(&registry.game_profiles, game_id), EAlreadyRegistered);
    table::add(&mut registry.game_profiles, game_id, profile_id);
}

/// 注册 MapProfile
/// 首次注册原则：禁止覆盖已有映射
public(package) fun register_map_profile(
    registry: &mut ProfileRegistry,
    map_id: ID,
    profile_id: ID,
) {
    assert!(!table::contains(&registry.map_profiles, map_id), EAlreadyRegistered);
    table::add(&mut registry.map_profiles, map_id, profile_id);
}

// ============ Accessor Functions ============

/// 检查 GameProfile 是否已注册
public fun contains_game_profile(registry: &ProfileRegistry, game_id: ID): bool {
    table::contains(&registry.game_profiles, game_id)
}

/// 检查 MapProfile 是否已注册
public fun contains_map_profile(registry: &ProfileRegistry, map_id: ID): bool {
    table::contains(&registry.map_profiles, map_id)
}

/// 获取 GameProfile ID（仅用于 Move 端内部调用）
public fun get_game_profile_id(registry: &ProfileRegistry, game_id: ID): ID {
    *table::borrow(&registry.game_profiles, game_id)
}

/// 获取 MapProfile ID（仅用于 Move 端内部调用）
public fun get_map_profile_id(registry: &ProfileRegistry, map_id: ID): ID {
    *table::borrow(&registry.map_profiles, map_id)
}

// ============ Test Only ============

#[test_only]
/// 测试用初始化函数
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

// ============ Tests ============

#[test_only]
use sui::test_scenario;

#[test]
fun test_register_game_profile() {
    let admin = @0x1;
    let mut scenario = test_scenario::begin(admin);

    // 初始化
    {
        let ctx = scenario.ctx();
        init(ctx);
    };

    // 注册 game profile
    scenario.next_tx(admin);
    {
        let mut registry = scenario.take_shared<ProfileRegistry>();

        let game_id = object::id_from_address(@0x100);
        let profile_id = object::id_from_address(@0x200);

        register_game_profile(&mut registry, game_id, profile_id);

        assert!(contains_game_profile(&registry, game_id));
        assert!(get_game_profile_id(&registry, game_id) == profile_id);

        test_scenario::return_shared(registry);
    };

    scenario.end();
}

#[test]
fun test_register_map_profile() {
    let admin = @0x1;
    let mut scenario = test_scenario::begin(admin);

    // 初始化
    {
        let ctx = scenario.ctx();
        init(ctx);
    };

    // 注册 map profile
    scenario.next_tx(admin);
    {
        let mut registry = scenario.take_shared<ProfileRegistry>();

        let map_id = object::id_from_address(@0x100);
        let profile_id = object::id_from_address(@0x200);

        register_map_profile(&mut registry, map_id, profile_id);

        assert!(contains_map_profile(&registry, map_id));
        assert!(get_map_profile_id(&registry, map_id) == profile_id);

        test_scenario::return_shared(registry);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = EAlreadyRegistered)]
fun test_register_duplicate_game_profile_should_fail() {
    let admin = @0x1;
    let mut scenario = test_scenario::begin(admin);

    // 初始化
    {
        let ctx = scenario.ctx();
        init(ctx);
    };

    // 尝试重复注册同一 game_id，应该 abort
    scenario.next_tx(admin);
    {
        let mut registry = scenario.take_shared<ProfileRegistry>();

        let game_id = object::id_from_address(@0x100);
        let profile_id_1 = object::id_from_address(@0x200);
        let profile_id_2 = object::id_from_address(@0x300);

        // 首次注册
        register_game_profile(&mut registry, game_id, profile_id_1);
        assert!(get_game_profile_id(&registry, game_id) == profile_id_1);

        // 尝试覆盖（应该失败）
        register_game_profile(&mut registry, game_id, profile_id_2);

        test_scenario::return_shared(registry);
    };

    scenario.end();
}
