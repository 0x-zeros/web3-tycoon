/**
 * DeFi协议配置
 *
 * 包含Scallop、Navi等DeFi协议的主网地址和类型信息
 */

/**
 * DeFi Verifier配置
 */
export const DefiVerifierConfig = {
    /** DeFi Verifier Package ID（主网） */
    packageId: '0x2377de485d8fc4d4f0e8e2e93f36b02ea30c6e3118a2af86b5839984867f14ce',
} as const;

/**
 * Navi Protocol配置
 */
export const NaviConfig = {
    /** Navi Package ID */
    packageId: '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',

    /** Navi Storage共享对象ID */
    storageId: '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe',

    /** USDC Asset ID */
    usdcAssetId: 10,
} as const;

/**
 * Scallop Protocol配置
 */
export const ScallopConfig = {
    /** Scallop Package ID */
    packageId: '0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf',

    /** Scallop USDC (sUSDC)类型 */
    usdcType: '0x854950aa624b1df59fe64e630b2ba7c550642e9342267a33061d59fb31582da5::scallop_usdc::SCALLOP_USDC',
} as const;

/**
 * DeFi奖励配置
 */
export const DefiRewardConfig = {
    /** 奖励cash数量 */
    rewardCash: 2000,

    /** 收益倍数（150 = 1.5x） */
    incomeMultiplier: 150,
} as const;
