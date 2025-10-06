/**
 * Sui 配置接口和管理
 */

/**
 * Sui 配置接口
 */
export interface SuiConfig {
    /** 网络类型 */
    network: 'localnet' | 'testnet' | 'mainnet' | 'devnet' | string;
    /** Package ID */
    packageId: string;
    /** GameData 共享对象 ID */
    gameDataId: string;
    /** AdminCap ID（可选，用于管理操作） */
    adminCapId?: string;
    /** UpgradeCap ID（可选） */
    upgradeCapId?: string;
    /** 自定义 RPC URL（可选，覆盖默认网络 URL） */
    rpcUrl?: string;
}

/**
 * 从环境配置转换为 SuiConfig
 */
export function fromEnvConfig(envConfig: {
    network: string;
    packageId: string;
    gameData: string;
    adminCap?: string;
    upgradeCap?: string;
}): SuiConfig {
    return {
        network: envConfig.network,
        packageId: envConfig.packageId,
        gameDataId: envConfig.gameData,
        adminCapId: envConfig.adminCap,
        upgradeCapId: envConfig.upgradeCap
    };
}

/**
 * 获取网络 RPC URL
 */
export function getNetworkRpcUrl(network: string, customUrl?: string): string {
    if (customUrl) {
        return customUrl;
    }

    switch (network) {
        case 'localnet':
            return 'http://127.0.0.1:9000';
        case 'testnet':
            return 'https://fullnode.testnet.sui.io:443';
        case 'mainnet':
            return 'https://fullnode.mainnet.sui.io:443';
        case 'devnet':
            return 'https://fullnode.devnet.sui.io:443';
        default:
            // 如果是自定义网络字符串，假设它本身就是 URL
            if (network.startsWith('http')) {
                return network;
            }
            throw new Error(`Unknown network: ${network}`);
    }
}
