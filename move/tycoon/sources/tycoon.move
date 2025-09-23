/// 包的顶层模块，负责初始化所有共享资源
module tycoon::tycoon;

use sui::transfer;
use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};

use tycoon::admin::{Self, AdminCap};
use tycoon::map;
use tycoon::cards;

// ===== Package Init 包初始化 =====

/// 包发布时的初始化函数
/// 创建所有全局唯一的共享对象
fun init(ctx: &mut TxContext) {
    // 1. 创建管理员权限并转移给部署者
    admin::create_admin_cap(ctx);

    // 2. 创建全局唯一的地图注册表
    map::create_registry(ctx);

    // 3. 创建全局唯一的卡牌注册表
    cards::create_card_registry(ctx);

    // 4. 创建全局唯一的掉落配置
    cards::create_drop_config(ctx);
}

// ===== Test Helper 测试辅助 =====

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}