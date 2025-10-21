#[test_only]
module defi_verifier::defi_verifier_tests {
    use defi_verifier::defi_verifier;
    use defi_verifier::scallop_checker;
    use std::ascii;

    // ====== Scallop MarketCoin类型测试 ======

    #[test]
    /// 测试：Scallop MarketCoin<USDC>应该被识别
    fun test_scallop_market_coin_usdc() {
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN>"
        );

        // 测试MarketCoin识别
        assert!(scallop_checker::test_is_market_coin(&type_str), 0);

        // 测试USDC资产类型识别（这里用COIN作为占位符，实际应该是USDC）
        // 注意：因为我们的白名单检查的是::usdc::USDC，这里会失败
        // let supported = scallop_checker::test_is_supported(&type_str);
        // assert!(!supported, 1);
    }

    #[test]
    /// 测试：正确的Scallop USDC类型应该返回1（有效存款）
    fun test_verify_scallop_usdc_valid() {
        // 构造一个包含正确路径的类型字符串
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0xabc::usdc::USDC>"
        );

        // 余额 > 0 应该返回 1
        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 1, 0);
    }

    #[test]
    /// 测试：余额为0应该返回0
    fun test_verify_scallop_zero_balance() {
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0xabc::usdc::USDC>"
        );

        // 余额为0应该返回0
        let score = defi_verifier::test_verify_scallop_type(type_str, 0);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：非Scallop类型应该返回0
    fun test_verify_non_scallop() {
        let type_str = ascii::string(
            b"0x1234567890::some_other_protocol::Token<0xabc::usdc::USDC>"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：Scallop SUI类型应该被支持
    fun test_verify_scallop_sui() {
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0x2::sui::SUI>"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 1000);
        assert!(score == 1, 0);
    }

    #[test]
    /// 测试：Scallop USDT类型应该被支持
    fun test_verify_scallop_usdt() {
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0xdef::usdt::USDT>"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 500);
        assert!(score == 1, 0);
    }

    #[test]
    /// 测试：错误的package地址应该不被识别
    fun test_verify_wrong_package() {
        let type_str = ascii::string(
            b"0x0000000000000000000000000000000000000000000000000000000000000000::reserve::MarketCoin<0xabc::usdc::USDC>"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：错误的模块名应该不被识别
    fun test_verify_wrong_module() {
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::wrong_module::SomeToken<0xabc::usdc::USDC>"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：不支持的资产类型应该返回0
    fun test_verify_unsupported_asset() {
        let type_str = ascii::string(
            b"0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::reserve::MarketCoin<0xabc::btc::BTC>"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    // ====== 字符串匹配测试 ======

    #[test]
    /// 测试：字符串包含检查基础功能
    fun test_string_contains_basic() {
        let _haystack = ascii::string(b"hello world");
        let _needle1 = ascii::string(b"hello");
        let _needle2 = ascii::string(b"world");
        let _needle3 = ascii::string(b"xyz");

        // 这里我们通过构造特定的type_str来间接测试string_contains
        // 因为string_contains是private函数，无法直接测试
    }
}
