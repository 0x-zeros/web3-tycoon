/// Scallop协议存款检测模块
/// 负责识别Scallop的MarketCoin（存款凭证）类型
module defi_verifier::scallop_checker {
    use std::ascii::{Self, String};

    // ====== 常量定义 ======

    /// Scallop Protocol Package地址
    const SCALLOP_PACKAGE: vector<u8> = b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf";

    /// MarketCoin模块标识
    const MARKET_COIN_MODULE: vector<u8> = b"::reserve::MarketCoin";

    /// 支持的资产类型标识
    const USDC_TYPE: vector<u8> = b"::usdc::USDC";
    const SUI_TYPE: vector<u8> = b"::sui::SUI";
    const USDT_TYPE: vector<u8> = b"::usdt::USDT";

    // ====== 公共接口 ======

    /// 检查类型字符串是否为支持的Scallop MarketCoin
    ///
    /// # 参数
    /// - type_str: 类型名的字符串表示（通过type_name::into_string获取）
    /// - balance: Coin的余额值
    ///
    /// # 返回值
    /// - 0: 不是支持的Scallop存款类型 或 余额为0
    /// - 1: 是支持的Scallop存款类型 且 余额 > 0
    public(package) fun check(type_str: &String, balance: u64): u8 {
        // 余额为0直接返回
        if (balance == 0) {
            return 0
        };

        // 检查是否为Scallop MarketCoin
        if (!is_scallop_market_coin(type_str)) {
            return 0
        };

        // 检查是否为支持的资产类型
        if (is_supported_asset(type_str)) {
            return 1
        };

        0
    }

    // ====== 内部函数 ======

    /// 检查是否为Scallop的MarketCoin类型
    ///
    /// 示例类型: 0xefe8b36d...::reserve::MarketCoin<0x...::usdc::USDC>
    fun is_scallop_market_coin(type_str: &String): bool {
        let scallop_pkg = ascii::string(SCALLOP_PACKAGE);
        let market_coin_mod = ascii::string(MARKET_COIN_MODULE);

        // 检查是否包含Scallop package地址
        if (!string_contains(type_str, &scallop_pkg)) {
            return false
        };

        // 检查是否包含MarketCoin模块
        if (!string_contains(type_str, &market_coin_mod)) {
            return false
        };

        true
    }

    /// 检查是否为支持的资产类型
    fun is_supported_asset(type_str: &String): bool {
        // 支持USDC
        if (string_contains(type_str, &ascii::string(USDC_TYPE))) {
            return true
        };

        // 支持SUI
        if (string_contains(type_str, &ascii::string(SUI_TYPE))) {
            return true
        };

        // 支持USDT
        if (string_contains(type_str, &ascii::string(USDT_TYPE))) {
            return true
        };

        false
    }

    /// 字符串包含检查（辅助函数）
    ///
    /// 检查haystack是否包含needle
    fun string_contains(haystack: &String, needle: &String): bool {
        let haystack_bytes = ascii::as_bytes(haystack);
        let needle_bytes = ascii::as_bytes(needle);
        let haystack_len = haystack_bytes.length();
        let needle_len = needle_bytes.length();

        // needle长度大于haystack，肯定不包含
        if (needle_len > haystack_len) {
            return false
        };

        // 空needle视为包含
        if (needle_len == 0) {
            return true
        };

        // 朴素字符串匹配算法
        let mut i = 0;
        while (i <= haystack_len - needle_len) {
            let mut j = 0;
            let mut matched = true;

            while (j < needle_len) {
                if (haystack_bytes[i + j] != needle_bytes[j]) {
                    matched = false;
                    break
                };
                j = j + 1;
            };

            if (matched) {
                return true
            };

            i = i + 1;
        };

        false
    }

    // ====== 测试辅助函数 ======

    #[test_only]
    /// 测试用：检查MarketCoin识别
    public fun test_is_market_coin(type_str: &String): bool {
        is_scallop_market_coin(type_str)
    }

    #[test_only]
    /// 测试用：检查资产类型识别
    public fun test_is_supported(type_str: &String): bool {
        is_supported_asset(type_str)
    }
}
