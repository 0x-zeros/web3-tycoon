/// Scallop协议存款检测模块
/// 负责识别Scallop的sCoin（SCALLOP_USDC存款凭证）
///
/// 设计说明：
/// - 只检测USDC存款（与Navi保持一致）
/// - 使用精确类型匹配（不模糊匹配）
/// - 用户存USDC后获得SCALLOP_USDC (sUSDC) coin
module defi_verifier::scallop_checker {
    use std::ascii::{Self, String};

    // ====== 常量定义 ======

    /// Scallop USDC存款凭证类型（sUSDC）
    /// 来源：Scallop官网 + 用户交易确认
    const SCALLOP_USDC_TYPE: vector<u8> =
        b"0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_usdc::SCALLOP_USDC";

    // ====== 公共接口 ======

    /// 检查类型字符串是否为Scallop USDC存款凭证
    ///
    /// # 参数
    /// - type_str: 类型名的字符串表示（通过type_name::into_string获取）
    /// - balance: Coin的余额值
    ///
    /// # 返回值
    /// - 0: 不是Scallop USDC 或 余额为0
    /// - 1: 是Scallop USDC 且 余额 > 0
    public(package) fun check(type_str: &String, balance: u64): u8 {
        // 余额为0直接返回
        if (balance == 0) {
            return 0
        };

        // 精确匹配SCALLOP_USDC类型
        let scallop_usdc = ascii::string(SCALLOP_USDC_TYPE);

        if (*type_str == scallop_usdc) {
            1
        } else {
            0
        }
    }

    // ====== 测试辅助函数 ======

    #[test_only]
    /// 测试用：获取SCALLOP_USDC类型字符串
    public fun test_get_scallop_usdc_type(): String {
        ascii::string(SCALLOP_USDC_TYPE)
    }
}
