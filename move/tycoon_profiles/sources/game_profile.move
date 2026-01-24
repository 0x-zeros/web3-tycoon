/// 游戏档案模块
/// GameProfile 是 shared object，关联 Game 对象
module tycoon_profiles::game_profile;

use std::string::String;
use tycoon_profiles::events;

// ============ Constants ============

/// 名称最小长度
const MIN_NAME_LENGTH: u64 = 1;
/// 名称最大长度
const MAX_NAME_LENGTH: u64 = 64;

// ============ Errors ============

/// 名称长度无效（1-64字符）
const EInvalidNameLength: u64 = 1;
/// 无权限（只有创建者可以修改）
const ENotCreator: u64 = 2;

// ============ Structs ============

/// 游戏档案
/// - shared object，允许任何人读取
/// - 只有创建者可以修改
public struct GameProfile has key, store {
    id: UID,
    /// 关联的 Game 对象 ID
    game_id: ID,
    /// 创建者地址（用于权限验证）
    creator: address,
    /// 游戏名称 (1-64 字符)
    name: String,
}

// ============ Public Functions ============

/// 创建游戏档案
/// - 创建后设为 shared object
/// - 名称长度: 1-64 字符
public entry fun create_game_profile(
    game_id: ID,
    name: String,
    ctx: &mut TxContext,
) {
    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);

    let creator = ctx.sender();

    let profile = GameProfile {
        id: object::new(ctx),
        game_id,
        creator,
        name,
    };

    let profile_id = object::id(&profile);

    // 设为 shared object
    transfer::share_object(profile);

    // 发送创建事件
    events::emit_game_profile_created(profile_id, game_id, creator);
}

/// 更新游戏名称
/// - 只有创建者可以修改
public entry fun update_name(
    profile: &mut GameProfile,
    name: String,
    ctx: &TxContext,
) {
    // 验证权限
    assert!(ctx.sender() == profile.creator, ENotCreator);

    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);

    profile.name = name;

    // 发送更新事件
    events::emit_game_profile_updated(object::id(profile), profile.game_id);
}

// ============ Accessor Functions ============

/// 获取关联的 Game ID
public fun game_id(profile: &GameProfile): ID {
    profile.game_id
}

/// 获取创建者地址
public fun creator(profile: &GameProfile): address {
    profile.creator
}

/// 获取游戏名称
public fun name(profile: &GameProfile): &String {
    &profile.name
}

// ============ Tests ============

#[test_only]
use sui::test_scenario;

#[test]
fun test_create_game_profile() {
    let user = @0x1;
    let game_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_game_profile(game_id, b"My Game".to_string(), ctx);
    };

    // 验证档案
    scenario.next_tx(user);
    {
        let profile = scenario.take_shared<GameProfile>();
        assert!(profile.game_id() == game_id);
        assert!(profile.creator() == user);
        assert!(profile.name() == &b"My Game".to_string());
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
fun test_update_game_profile_name() {
    let user = @0x1;
    let game_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_game_profile(game_id, b"My Game".to_string(), ctx);
    };

    // 更新名称
    scenario.next_tx(user);
    {
        let mut profile = scenario.take_shared<GameProfile>();
        let ctx = scenario.ctx();
        update_name(&mut profile, b"New Name".to_string(), ctx);
        assert!(profile.name() == &b"New Name".to_string());
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = ENotCreator)]
fun test_update_game_profile_not_creator() {
    let user = @0x1;
    let other = @0x2;
    let game_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_game_profile(game_id, b"My Game".to_string(), ctx);
    };

    // 其他用户尝试更新
    scenario.next_tx(other);
    {
        let mut profile = scenario.take_shared<GameProfile>();
        let ctx = scenario.ctx();
        update_name(&mut profile, b"Hacked".to_string(), ctx);
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = EInvalidNameLength)]
fun test_create_game_profile_empty_name() {
    let user = @0x1;
    let game_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    {
        let ctx = scenario.ctx();
        create_game_profile(game_id, b"".to_string(), ctx);
    };

    scenario.end();
}
