/// DeFi存款验证模块 - 主接口
///
/// 用途：验证用户持有的Coin对象是否为支持的DeFi协议存款凭证
/// 设计理念：
/// - 游戏模块（game.move）只需知道这个统一接口，无需了解具体DeFi协议
/// - 所有DeFi协议细节（类型、地址等）封装在各checker子模块中
/// - 使用泛型<CoinType>让调用方无需导入DeFi类型
/// - 通过type_name运行时检查类型字符串白名单
///
/// 支持的协议：
/// - Scallop: MarketCoin<USDC/SUI/USDT>（已实现）
/// - Navi: USDC存款（已实现）
/// - Bucket: sUSDB等（待实现）
module defi_verifier::defi_verifier {
    use sui::coin::Coin;
    use std::type_name;
    use defi_verifier::scallop_checker;
    use defi_verifier::navi_checker;
    use lending_core::storage::Storage as NaviStorage;

    // ====== 返回值约定 ======

    // 返回0：不是支持的DeFi存款类型 或 余额为0
    const SCORE_INVALID: u8 = 0;

    // 返回1：是支持的DeFi存款类型 且 余额 > 0
    // 返回2+：预留给未来扩展（如VIP等级、大额存款奖励等）

    // ====== 对外接口 ======

    /// 验证任意Coin对象是否为支持的DeFi存款凭证
    ///
    /// 这是唯一对外暴露的接口，游戏模块只需要知道这一个函数。
    ///
    /// # 工作原理
    /// 1. 获取CoinType的完整类型名字符串
    /// 2. 将类型名传递给各DeFi协议的checker模块
    /// 3. 每个checker检查类型是否匹配其白名单
    /// 4. 返回所有checker中的最高分数
    ///
    /// # 参数
    /// - coin: 任意Coin对象的不可变引用（泛型CoinType）
    ///
    /// # 返回值
    /// - 0: 不是支持的DeFi存款 或 余额为0
    /// - 1: 是支持的DeFi存款 且 余额 > 0
    /// - 2+: 未来扩展（如VIP等级）
    ///
    /// # 示例
    /// ```move
    /// // 游戏模块调用（不知道MarketCoin是什么）
    /// use defi_verifier::defi_verifier;
    ///
    /// public fun claim_reward<T>(coin: &Coin<T>, ctx: &mut TxContext) {
    ///     let score = defi_verifier::verify_defi_coin(coin);
    ///     if (score > 0) {
    ///         // 发放奖励
    ///     }
    /// }
    /// ```
    public fun verify_defi_coin<CoinType>(coin: &Coin<CoinType>): u8 {
        // 获取类型名字符串（使用defining_ids确保类型一致性）
        let type_name = type_name::with_defining_ids<CoinType>();
        let type_str = type_name::into_string(type_name);

        // 获取余额
        let balance = coin.value();

        // 调用各DeFi协议checker，取最高分
        let mut score = SCORE_INVALID;

        // 检查Scallop MarketCoin
        let scallop_score = scallop_checker::check(&type_str, balance);
        score = max(score, scallop_score);

        // TODO: 检查Navi nToken
        // let navi_score = navi_checker::check(type_str, balance);
        // score = max(score, navi_score);

        // TODO: 检查Bucket sUSDB
        // let bucket_score = bucket_checker::check(type_str, balance);
        // score = max(score, bucket_score);

        score
    }

    // ====== 辅助函数 ======

    /// 返回两个u8中的较大值
    fun max(a: u8, b: u8): u8 {
        if (a > b) { a } else { b }
    }

    // ====== Navi协议验证接口 ======

    /// 验证用户在Navi Protocol的USDC存款
    ///
    /// 注意：由于Navi使用中心化账簿模式，需要传入Storage对象
    ///
    /// # 参数
    /// - navi_storage: Navi的Storage共享对象引用
    /// - ctx: 交易上下文（用于获取调用者地址）
    ///
    /// # 返回值
    /// - 0: 无USDC存款
    /// - 1: 有USDC存款
    ///
    /// # 示例
    /// ```move
    /// // 游戏模块调用
    /// use defi_verifier::defi_verifier;
    ///
    /// public entry fun claim_navi_reward(
    ///     navi_storage: &mut NaviStorage,
    ///     game_state: &mut GameState,
    ///     ctx: &mut TxContext
    /// ) {
    ///     let score = defi_verifier::verify_navi_usdc(navi_storage, ctx);
    ///     if (score > 0) {
    ///         // 发放奖励
    ///     }
    /// }
    /// ```
    public fun verify_navi_usdc(
        navi_storage: &mut NaviStorage,
        ctx: &TxContext
    ): u8 {
        let user = ctx.sender();
        navi_checker::check_usdc(navi_storage, user)
    }

    /// 验证用户在Navi Protocol的任意资产存款
    ///
    /// 检查用户是否在Navi中有任何资产的存款（不限于USDC）
    ///
    /// # 参数
    /// - navi_storage: Navi的Storage共享对象引用
    /// - ctx: 交易上下文
    ///
    /// # 返回值
    /// - 0: 无任何资产存款
    /// - 1: 至少有一种资产存款
    public fun verify_navi_any(
        navi_storage: &mut NaviStorage,
        ctx: &TxContext
    ): u8 {
        let user = ctx.sender();
        navi_checker::check_any_asset(navi_storage, user)
    }

    // ====== 调试辅助函数 ======

    /// 调试：获取CoinType的type_name字符串（用于排查类型匹配问题）
    public fun debug_get_type_name<CoinType>(coin: &Coin<CoinType>): std::ascii::String {
        let type_name = type_name::with_defining_ids<CoinType>();
        type_name::into_string(type_name)
    }

    // ====== 测试辅助函数 ======

    #[test_only]
    /// 测试用：Scallop类型字符串验证
    public fun test_verify_scallop_type(type_str: std::ascii::String, balance: u64): u8 {
        scallop_checker::check(&type_str, balance)
    }

    #[test_only]
    /// 测试用：Navi资产验证
    public fun test_verify_navi_asset(
        storage: &mut NaviStorage,
        asset_id: u8,
        user: address
    ): u8 {
        navi_checker::test_check_asset(storage, asset_id, user)
    }
}

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions


