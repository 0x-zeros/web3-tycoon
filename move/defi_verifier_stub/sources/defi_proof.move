/// DeFi验证凭证模块 - Stub版本
///
/// 用于testnet/devnet编译，不包含实际验证逻辑
/// 与mainnet版本接口完全相同
module defi_verifier::defi_proof {
    /// Navi USDC存款验证凭证
    public struct NaviProof has drop {}

    /// Scallop USDC存款验证凭证
    public struct ScallopProof has drop {}

    // ====== 创建函数 ======

    public(package) fun create_navi_proof(): NaviProof {
        NaviProof {}
    }

    public(package) fun create_scallop_proof(): ScallopProof {
        ScallopProof {}
    }

    // ====== 消费函数 ======

    public fun consume_navi_proof(proof: NaviProof): bool {
        let NaviProof {} = proof;
        true
    }

    public fun consume_scallop_proof(proof: ScallopProof): bool {
        let ScallopProof {} = proof;
        true
    }
}
