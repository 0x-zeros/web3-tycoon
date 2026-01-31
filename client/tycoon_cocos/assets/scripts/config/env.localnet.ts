/**
 * Sui区块链环境配置
 * 自动生成于: 2026-01-22 22:54:15
 */
export const SuiEnvConfig = {
    packageId: '0xfbd690acd526e4ac5ce0ffccf4094e8ce3aa8ea0bee85dae955f7e1b948ea683',
    upgradeCap: '0xec783249635527905ccd0aed7cfb77472ed3f811c524228fcfa6a80a167aaacc',
    adminCap: '0xeeee58814c28c6a357c38f7ac923fe44ad25744279da1ac04a5dd197ddbb404f',
    gameData: '0xb86dac8381efbe82a3d903eb70955d57661935f27341d648d27d1c0951d3cb8d',
    network: 'localnet',
    // tycoon_profiles 合约地址（部署后更新）
    profilesPackageId: '0xc89fa0e1beefc028a2a147e6d7ef63af0aecb35eced6834b019e5d9a0058e168',
    // ProfileRegistry shared object ID（部署后更新）
    profilesRegistryId: '0x47433c393c5df2bb10dbea37aeccbf0ece801650022d0a516b91290cbe38bc2b',

    // 开发环境使用 Keypair 签名
    signerType: 'keypair' as const
};
