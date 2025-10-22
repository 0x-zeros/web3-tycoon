/// DeFi验证凭证模块
///
/// 定义DeFi协议验证凭证（热土豆模式）
/// - 凭证只能由defi_verifier包创建
/// - 必须在同一交易中被消费
/// - 游戏包通过消费凭证来确认验证通过
module defi_verifier::defi_proof {
    /// Navi USDC存款验证凭证
    ///
    /// 热土豆：只有drop能力，必须被消费
    public struct NaviProof has drop {}

    /// Scallop USDC存款验证凭证
    public struct ScallopProof has drop {}

    // ====== 创建函数（package内部可见） ======

    /// 创建Navi凭证
    ///
    /// 只有defi_verifier包内的模块能调用
    public(package) fun create_navi_proof(): NaviProof {
        NaviProof {}
    }

    /// 创建Scallop凭证
    public(package) fun create_scallop_proof(): ScallopProof {
        ScallopProof {}
    }

    // ====== 消费函数（外部包调用） ======

    /// 消费Navi凭证
    ///
    /// 热土豆被销毁，返回true表示凭证有效
    public fun consume_navi_proof(proof: NaviProof): bool {
        let NaviProof {} = proof;
        true
    }

    /// 消费Scallop凭证
    public fun consume_scallop_proof(proof: ScallopProof): bool {
        let ScallopProof {} = proof;
        true
    }
}
