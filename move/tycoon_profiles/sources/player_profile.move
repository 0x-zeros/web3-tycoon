/// 玩家档案模块
/// PlayerProfile 是 owned object，通过对象所有权关联钱包地址
module tycoon_profiles::player_profile;

use std::string::String;
use tycoon_profiles::events;

// ============ Constants ============

/// 名称最小长度
const MIN_NAME_LENGTH: u64 = 1;
/// 名称最大长度
const MAX_NAME_LENGTH: u64 = 32;
/// 最大头像索引
const MAX_AVATAR_INDEX: u8 = 255;

// ============ Errors ============

/// 名称长度无效（1-32字符）
const EInvalidNameLength: u64 = 1;
/// 头像索引无效（0-255）
const EInvalidAvatarIndex: u64 = 2;

// ============ Structs ============

/// 玩家档案
/// - owned object，通过所有权关联钱包地址
/// - 每个钱包最多一个 PlayerProfile
public struct PlayerProfile has key, store {
    id: UID,
    /// 玩家昵称 (1-32 字符)
    name: String,
    /// 头像索引 (0-255)
    avatar: u8,
}

// ============ Public Functions ============

/// 创建玩家档案
/// - 创建后 transfer 给 sender
/// - 名称长度: 1-32 字符
/// - 头像索引: 0-255
public entry fun create_profile(
    name: String,
    avatar: u8,
    ctx: &mut TxContext,
) {
    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);

    // 验证头像索引（u8 自然限制 0-255，这里只是显式检查）
    assert!(avatar <= MAX_AVATAR_INDEX, EInvalidAvatarIndex);

    let profile = PlayerProfile {
        id: object::new(ctx),
        name,
        avatar,
    };

    let profile_id = object::id(&profile);
    let owner = ctx.sender();

    // 转移给创建者
    transfer::transfer(profile, owner);

    // 发送创建事件
    events::emit_player_profile_created(profile_id, owner);
}

/// 更新玩家昵称
/// - owned object 自动验证权限
public entry fun update_name(
    profile: &mut PlayerProfile,
    name: String,
    ctx: &TxContext,
) {
    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);

    profile.name = name;

    // 发送更新事件
    events::emit_player_profile_updated(object::id(profile), ctx.sender());
}

/// 更新玩家头像
/// - owned object 自动验证权限
public entry fun update_avatar(
    profile: &mut PlayerProfile,
    avatar: u8,
    ctx: &TxContext,
) {
    assert!(avatar <= MAX_AVATAR_INDEX, EInvalidAvatarIndex);

    profile.avatar = avatar;

    // 发送更新事件
    events::emit_player_profile_updated(object::id(profile), ctx.sender());
}

/// 同时更新昵称和头像
public entry fun update_profile(
    profile: &mut PlayerProfile,
    name: String,
    avatar: u8,
    ctx: &TxContext,
) {
    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);
    assert!(avatar <= MAX_AVATAR_INDEX, EInvalidAvatarIndex);

    profile.name = name;
    profile.avatar = avatar;

    // 发送更新事件
    events::emit_player_profile_updated(object::id(profile), ctx.sender());
}

// ============ Accessor Functions ============

/// 获取玩家昵称
public fun name(profile: &PlayerProfile): &String {
    &profile.name
}

/// 获取头像索引
public fun avatar(profile: &PlayerProfile): u8 {
    profile.avatar
}

// ============ Tests ============

#[test_only]
use sui::test_scenario;

#[test]
fun test_create_profile() {
    let user = @0x1;
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_profile(b"Alice".to_string(), 1, ctx);
    };

    // 验证档案
    scenario.next_tx(user);
    {
        let profile = scenario.take_from_sender<PlayerProfile>();
        assert!(profile.name() == &b"Alice".to_string());
        assert!(profile.avatar() == 1);
        scenario.return_to_sender(profile);
    };

    scenario.end();
}

#[test]
fun test_update_profile() {
    let user = @0x1;
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_profile(b"Alice".to_string(), 1, ctx);
    };

    // 更新名称
    scenario.next_tx(user);
    {
        let mut profile = scenario.take_from_sender<PlayerProfile>();
        let ctx = scenario.ctx();
        update_name(&mut profile, b"Bob".to_string(), ctx);
        assert!(profile.name() == &b"Bob".to_string());
        scenario.return_to_sender(profile);
    };

    // 更新头像
    scenario.next_tx(user);
    {
        let mut profile = scenario.take_from_sender<PlayerProfile>();
        let ctx = scenario.ctx();
        update_avatar(&mut profile, 5, ctx);
        assert!(profile.avatar() == 5);
        scenario.return_to_sender(profile);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = EInvalidNameLength)]
fun test_create_profile_empty_name() {
    let user = @0x1;
    let mut scenario = test_scenario::begin(user);

    {
        let ctx = scenario.ctx();
        create_profile(b"".to_string(), 1, ctx);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = EInvalidNameLength)]
fun test_create_profile_name_too_long() {
    let user = @0x1;
    let mut scenario = test_scenario::begin(user);

    {
        let ctx = scenario.ctx();
        // 33 字符，超过限制
        create_profile(b"123456789012345678901234567890123".to_string(), 1, ctx);
    };

    scenario.end();
}
