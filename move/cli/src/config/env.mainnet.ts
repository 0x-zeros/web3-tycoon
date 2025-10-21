const env = {
    // DeFi Verifier Package ID（部署后需要更新）
    defiVerifierPackageId: '0xd50a32ae860628d7f941e2b00dcb993661b2b2c87c2e4c3c0141422bc358528e', // TODO: 部署defi_verifier后更新此地址

    // Scallop Protocol Package ID（主网地址）
    scallopPackageId:
        '0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf',

    // Navi Protocol相关配置
    naviPackageId:
        '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',

    // Navi Storage对象ID（共享对象，从交易确认）
    naviStorageId:
        '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe',

    // Navi Asset IDs
    naviAssetIds: {
        USDC: 10,  // 已确认
    },
};

export default env;
