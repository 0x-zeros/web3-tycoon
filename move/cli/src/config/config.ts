/**
 * Sui Mainnet 配置
 *
 * 简化版配置，只支持主网环境
 */

import { getFullnodeUrl } from '@mysten/sui/client';
import MainnetPackage from './env.mainnet';

// 网络类型：固定为mainnet
export type NetworkType = 'mainnet';

// 配置接口定义
export interface NetworkConfig {
    url: string;
    variables: {
        explorer: (id: string) => string;
        explorer_suiscan: (id: string) => string;
        defiVerifierPackageId: string;
        scallopPackageId: string;
        naviPackageId: string;
        naviStorageId: string;
        naviAssetIds: {
            USDC: number;
        };
    };
}

// Mainnet Explorer配置
const createMainnetExplorer = {
    // 优先使用 suivision.xyz
    primary: (id: string) => `https://suivision.xyz/object/${id}`,
    // 备用 suiscan.xyz
    fallback: (id: string) => `https://suiscan.xyz/mainnet/object/${id}`,
};

// 导出Mainnet配置
export const networkConfig: NetworkConfig = {
    url: getFullnodeUrl('mainnet'),
    variables: {
        explorer: createMainnetExplorer.primary,
        explorer_suiscan: createMainnetExplorer.fallback,
        ...MainnetPackage,
    },
};

// 默认导出（保持兼容性）
export default networkConfig;
