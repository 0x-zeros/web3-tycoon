/**
 * Sui 配置接口和管理
 */

/**
 * 网络类型定义
 */
export type NetworkType = "localnet" | "devnet" | "testnet" | "mainnet";

/**
 * Explorer 类型定义
 */
export type ExplorerItemType = 'object' | 'txblock' | 'address';

/**
 * Sui 配置接口
 */
export interface SuiConfig {
    /** 网络类型 */
    network: NetworkType | string;
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

/**
 * 获取 Explorer URL
 * @param network 网络类型
 * @param id 对象ID/交易哈希/地址
 * @param type 类型（默认 object）
 * @returns Explorer URL（优先使用 suivision.xyz）
 */
export function getExplorerUrl(
    network: NetworkType | string,
    id: string,
    type: ExplorerItemType = 'object'
): string {
    const networkType = network as NetworkType;

    // localnet 特殊处理
    if (networkType === 'localnet') {
        const localnetUrl = 'http://127.0.0.1:9000';
        const encodedUrl = encodeURIComponent(localnetUrl);
        return `https://custom.suiscan.xyz/custom/${type}/${id}?network=${encodedUrl}`;
    }

    // 其他网络使用 suivision.xyz（主要）
    const networkPrefix = networkType === 'mainnet' ? '' : `${networkType}.`;
    return `https://${networkPrefix}suivision.xyz/${type}/${id}`;
}

/**
 * 获取备用 Explorer URL（suiscan.xyz）
 * @param network 网络类型
 * @param id 对象ID/交易哈希/地址
 * @param type 类型（默认 object）
 * @returns Explorer URL
 */
export function getFallbackExplorerUrl(
    network: NetworkType | string,
    id: string,
    type: ExplorerItemType = 'object'
): string {
    const networkType = network as NetworkType;

    if (networkType === 'localnet') {
        // localnet 使用 custom.suiscan.xyz
        return getExplorerUrl(network, id, type);
    }

    const networkPrefix = networkType === 'mainnet' ? 'mainnet' : networkType;
    return `https://suiscan.xyz/${networkPrefix}/${type}/${id}`;
}

/**
 * 获取网络显示名称
 * @param network 网络标识
 * @returns 网络显示名称
 */
export function getNetworkDisplayName(network: string): string {
    const names: Record<string, string> = {
        'localnet': 'Localnet',
        'devnet': 'Devnet',
        'testnet': 'Testnet',
        'mainnet': 'Mainnet'
    };
    return names[network] || network;
}
