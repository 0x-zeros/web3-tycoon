/// Navi协议存款检测模块
/// 负责检测用户在Navi Protocol的存款余额
///
/// 架构说明：
/// - Navi使用中心化账簿模式（与Scallop的对象所有权不同）
/// - 用户存款记录在Storage共享对象中
/// - 通过get_user_balance查询特定资产的supply
module defi_verifier::navi_checker {
    // 导入Navi的Storage模块
    use lending_core::storage::{Self, Storage};

    // ====== 常量定义 ======

    /// USDC在Navi中的asset ID（从交易确认）
    const ASSET_ID_USDC: u8 = 10;

    // ====== 公共接口 ======

    /// 检查用户在Navi的USDC存款
    ///
    /// # 参数
    /// - storage: Navi的Storage共享对象的可变引用
    /// - user: 用户地址
    ///
    /// # 返回值
    /// - 0: 无USDC存款（supply = 0）
    /// - 1: 有USDC存款（supply > 0）
    ///
    /// # 工作原理
    /// 调用Navi的storage::get_user_balance获取(supply, borrow)
    /// 只检查supply是否大于0，不关心具体数额
    public(package) fun check_usdc(
        storage: &mut Storage,
        user: address
    ): u8 {
        check_asset(storage, ASSET_ID_USDC, user)
    }

    /// 检查用户在Navi的任意资产存款
    ///
    /// # 参数
    /// - storage: Navi的Storage共享对象的可变引用
    /// - user: 用户地址
    ///
    /// # 返回值
    /// - 0: 无任何资产存款
    /// - 1: 至少有一种资产存款
    ///
    /// # 工作原理
    /// 1. 调用get_user_assets获取用户涉及的资产列表
    /// 2. 遍历每个资产ID，检查supply是否>0
    public(package) fun check_any_asset(
        storage: &mut Storage,
        user: address
    ): u8 {
        // 获取用户涉及的资产列表
        let (collateral_assets, _borrow_assets) =
            storage::get_user_assets(storage, user);

        // 检查是否有任何抵押品资产
        if (collateral_assets.length() > 0) {
            // 遍历检查每个资产的supply
            let mut i = 0;
            while (i < collateral_assets.length()) {
                let asset_id = collateral_assets[i];
                let (supply, _borrow) = storage::get_user_balance(
                    storage,
                    asset_id,
                    user
                );

                // 只要有任意资产supply > 0就返回1
                if (supply > 0) {
                    return 1
                };

                i = i + 1;
            }
        };

        0
    }

    // ====== 内部函数 ======

    /// 检查用户在Navi的特定资产存款
    ///
    /// # 参数
    /// - storage: Navi的Storage共享对象引用
    /// - asset_id: 资产ID（USDC=10）
    /// - user: 用户地址
    ///
    /// # 返回值
    /// - 0: 无存款
    /// - 1: 有存款（supply > 0）
    fun check_asset(
        storage: &mut Storage,
        asset_id: u8,
        user: address
    ): u8 {
        // 调用Navi的get_user_balance
        // 返回值：(supply: u256, borrow: u256)
        let (supply, _borrow) = storage::get_user_balance(
            storage,
            asset_id,
            user
        );

        // 检查supply是否 > 0
        if (supply > 0) {
            1
        } else {
            0
        }
    }

    // ====== 测试辅助函数 ======

    #[test_only]
    /// 测试用：检查特定资产
    public fun test_check_asset(
        storage: &mut Storage,
        asset_id: u8,
        user: address
    ): u8 {
        check_asset(storage, asset_id, user)
    }

    #[test_only]
    /// 测试用：获取USDC的asset ID
    public fun test_get_usdc_asset_id(): u8 {
        ASSET_ID_USDC
    }
}
