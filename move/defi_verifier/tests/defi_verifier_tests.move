#[test_only]
module defi_verifier::defi_verifier_tests {
    use defi_verifier::defi_verifier;
    use defi_verifier::scallop_checker;
    use std::ascii;

    // ====== Scallop USDC类型测试 ======

    #[test]
    /// 测试：正确的Scallop USDC类型应该返回1
    fun test_verify_scallop_usdc_valid() {
        // 使用真实的SCALLOP_USDC类型
        let type_str = ascii::string(
            b"0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_usdc::SCALLOP_USDC"
        );

        // 余额 > 0 应该返回 1
        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 1, 0);
    }

    #[test]
    /// 测试：余额为0应该返回0
    fun test_verify_scallop_zero_balance() {
        let type_str = ascii::string(
            b"0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_usdc::SCALLOP_USDC"
        );

        // 余额为0应该返回0
        let score = defi_verifier::test_verify_scallop_type(type_str, 0);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：非Scallop类型应该返回0
    fun test_verify_non_scallop() {
        let type_str = ascii::string(
            b"0x1234567890::some_other_protocol::Token"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：错误的package地址应该不被识别
    fun test_verify_wrong_package() {
        let type_str = ascii::string(
            b"0x0000000000000000000000000000000000000000000000000000000000000000::scallop_usdc::SCALLOP_USDC"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：错误的模块名应该不被识别
    fun test_verify_wrong_module() {
        let type_str = ascii::string(
            b"0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::wrong_module::SCALLOP_USDC"
        );

        let score = defi_verifier::test_verify_scallop_type(type_str, 100);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：Scallop SUI类型不再支持（只支持USDC）
    fun test_verify_scallop_sui_not_supported() {
        let type_str = ascii::string(
            b"0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_sui::SCALLOP_SUI"
        );

        // 应该返回0（不支持SUI）
        let score = defi_verifier::test_verify_scallop_type(type_str, 1000);
        assert!(score == 0, 0);
    }

    #[test]
    /// 测试：获取SCALLOP_USDC类型字符串
    fun test_get_scallop_type() {
        let expected = ascii::string(
            b"0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_usdc::SCALLOP_USDC"
        );
        let actual = scallop_checker::test_get_scallop_usdc_type();
        assert!(expected == actual, 0);
    }

    // ====== Navi协议测试 ======
    // 注意：Navi使用native storage实现，无法在sui move test中运行
    // 需要在主网使用devInspect测试

    #[test]
    /// 测试：验证Navi USDC asset ID
    fun test_navi_usdc_asset_id() {
        use defi_verifier::navi_checker;

        let asset_id = navi_checker::test_get_usdc_asset_id();
        assert!(asset_id == 10, 0);  // USDC的asset ID应该是10
    }
}
