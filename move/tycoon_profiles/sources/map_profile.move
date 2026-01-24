/// 地图档案模块
/// MapProfile 是 shared object，关联 MapTemplate 对象
module tycoon_profiles::map_profile;

use std::string::String;
use tycoon_profiles::events;

// ============ Constants ============

/// 名称最小长度
const MIN_NAME_LENGTH: u64 = 1;
/// 名称最大长度
const MAX_NAME_LENGTH: u64 = 64;
/// 描述最大长度
const MAX_DESCRIPTION_LENGTH: u64 = 256;

// ============ Errors ============

/// 名称长度无效（1-64字符）
const EInvalidNameLength: u64 = 1;
/// 描述长度无效（0-256字符）
const EInvalidDescriptionLength: u64 = 2;
/// 无权限（只有创建者可以修改）
const ENotCreator: u64 = 3;

// ============ Structs ============

/// 地图档案
/// - shared object，允许任何人读取
/// - 只有创建者可以修改
public struct MapProfile has key, store {
    id: UID,
    /// 关联的 MapTemplate 对象 ID
    map_id: ID,
    /// 创建者地址（用于权限验证）
    creator: address,
    /// 地图名称 (1-64 字符)
    name: String,
    /// 地图描述 (0-256 字符)
    description: String,
}

// ============ Public Functions ============

/// 创建地图档案
/// - 创建后设为 shared object
/// - 名称长度: 1-64 字符
/// - 描述长度: 0-256 字符
public entry fun create_map_profile(
    map_id: ID,
    name: String,
    description: String,
    ctx: &mut TxContext,
) {
    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);

    // 验证描述长度
    let desc_len = description.length();
    assert!(desc_len <= MAX_DESCRIPTION_LENGTH, EInvalidDescriptionLength);

    let creator = ctx.sender();

    let profile = MapProfile {
        id: object::new(ctx),
        map_id,
        creator,
        name,
        description,
    };

    let profile_id = object::id(&profile);

    // 设为 shared object
    transfer::share_object(profile);

    // 发送创建事件
    events::emit_map_profile_created(profile_id, map_id, creator);
}

/// 更新地图名称
/// - 只有创建者可以修改
public entry fun update_name(
    profile: &mut MapProfile,
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
    events::emit_map_profile_updated(object::id(profile), profile.map_id);
}

/// 更新地图描述
/// - 只有创建者可以修改
public entry fun update_description(
    profile: &mut MapProfile,
    description: String,
    ctx: &TxContext,
) {
    // 验证权限
    assert!(ctx.sender() == profile.creator, ENotCreator);

    // 验证描述长度
    let desc_len = description.length();
    assert!(desc_len <= MAX_DESCRIPTION_LENGTH, EInvalidDescriptionLength);

    profile.description = description;

    // 发送更新事件
    events::emit_map_profile_updated(object::id(profile), profile.map_id);
}

/// 同时更新名称和描述
/// - 只有创建者可以修改
public entry fun update_profile(
    profile: &mut MapProfile,
    name: String,
    description: String,
    ctx: &TxContext,
) {
    // 验证权限
    assert!(ctx.sender() == profile.creator, ENotCreator);

    // 验证名称长度
    let name_len = name.length();
    assert!(name_len >= MIN_NAME_LENGTH && name_len <= MAX_NAME_LENGTH, EInvalidNameLength);

    // 验证描述长度
    let desc_len = description.length();
    assert!(desc_len <= MAX_DESCRIPTION_LENGTH, EInvalidDescriptionLength);

    profile.name = name;
    profile.description = description;

    // 发送更新事件
    events::emit_map_profile_updated(object::id(profile), profile.map_id);
}

// ============ Accessor Functions ============

/// 获取关联的 MapTemplate ID
public fun map_id(profile: &MapProfile): ID {
    profile.map_id
}

/// 获取创建者地址
public fun creator(profile: &MapProfile): address {
    profile.creator
}

/// 获取地图名称
public fun name(profile: &MapProfile): &String {
    &profile.name
}

/// 获取地图描述
public fun description(profile: &MapProfile): &String {
    &profile.description
}

// ============ Tests ============

#[test_only]
use sui::test_scenario;

#[test]
fun test_create_map_profile() {
    let user = @0x1;
    let map_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_map_profile(
            map_id,
            b"My Map".to_string(),
            b"A cool map for playing".to_string(),
            ctx,
        );
    };

    // 验证档案
    scenario.next_tx(user);
    {
        let profile = scenario.take_shared<MapProfile>();
        assert!(profile.map_id() == map_id);
        assert!(profile.creator() == user);
        assert!(profile.name() == &b"My Map".to_string());
        assert!(profile.description() == &b"A cool map for playing".to_string());
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
fun test_update_map_profile() {
    let user = @0x1;
    let map_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_map_profile(map_id, b"My Map".to_string(), b"Desc".to_string(), ctx);
    };

    // 更新名称
    scenario.next_tx(user);
    {
        let mut profile = scenario.take_shared<MapProfile>();
        let ctx = scenario.ctx();
        update_name(&mut profile, b"New Name".to_string(), ctx);
        assert!(profile.name() == &b"New Name".to_string());
        test_scenario::return_shared(profile);
    };

    // 更新描述
    scenario.next_tx(user);
    {
        let mut profile = scenario.take_shared<MapProfile>();
        let ctx = scenario.ctx();
        update_description(&mut profile, b"New Description".to_string(), ctx);
        assert!(profile.description() == &b"New Description".to_string());
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = ENotCreator)]
fun test_update_map_profile_not_creator() {
    let user = @0x1;
    let other = @0x2;
    let map_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 创建档案
    {
        let ctx = scenario.ctx();
        create_map_profile(map_id, b"My Map".to_string(), b"".to_string(), ctx);
    };

    // 其他用户尝试更新
    scenario.next_tx(other);
    {
        let mut profile = scenario.take_shared<MapProfile>();
        let ctx = scenario.ctx();
        update_name(&mut profile, b"Hacked".to_string(), ctx);
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
fun test_create_map_profile_empty_description() {
    let user = @0x1;
    let map_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    // 空描述应该允许
    {
        let ctx = scenario.ctx();
        create_map_profile(map_id, b"My Map".to_string(), b"".to_string(), ctx);
    };

    scenario.next_tx(user);
    {
        let profile = scenario.take_shared<MapProfile>();
        assert!(profile.description() == &b"".to_string());
        test_scenario::return_shared(profile);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = EInvalidNameLength)]
fun test_create_map_profile_empty_name() {
    let user = @0x1;
    let map_id = object::id_from_address(@0x100);
    let mut scenario = test_scenario::begin(user);

    {
        let ctx = scenario.ctx();
        create_map_profile(map_id, b"".to_string(), b"".to_string(), ctx);
    };

    scenario.end();
}
