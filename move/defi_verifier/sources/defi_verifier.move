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
/// - Navi: nToken系列（待实现）
/// - Bucket: sUSDB等（待实现）
module defi_verifier::defi_verifier {
    use sui::coin::Coin;
    use std::type_name;
    use defi_verifier::scallop_checker;

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

    // ====== 测试辅助函数 ======

    #[test_only]
    /// 测试用：直接传入类型字符串验证
    public fun test_verify_type_string(type_str: std::ascii::String, balance: u64): u8 {
        scallop_checker::check(&type_str, balance)
    }
}

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions


