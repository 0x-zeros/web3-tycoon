import { getFullnodeUrl } from "@mysten/sui/client";

import DevnetPackage from "./env.devnet";
import LocalnetPackage from "./env.localnet";
import MainnetPackage from "./env.mainnet";
import TestnetPackage from "./env.testnet";


/**
// 方式1：使用函数（推荐）
import { createNetworkConfig, getExplorerUrl } from './config';
const devnetConfig = createNetworkConfig('devnet');

// 方式2：使用对象（保持兼容）
import config from './config';
const devnetConfig = config.devnet;

// 方式3：智能选择可用的 Explorer
const explorerUrl = await getExplorerUrl('devnet', '0x123...');
// 优先使用 suivision.xyz，如果不可用则回退到 suiscan.xyz

// 方式4：手动选择 Explorer
const primaryUrl = devnetConfig.variables.explorer('0x123...'); // suivision.xyz
const suiscanUrl = devnetConfig.variables.explorer_suiscan('0x123...'); // suiscan.xyz

// localnet 示例
const localnetConfig = createNetworkConfig('localnet');
const localnetUrl = localnetConfig.variables.explorer('0x123...');
// 生成: https://custom.suiscan.xyz/custom/object/0x123...?network=http%3A%2F%2F127.0.0.1%3A9000
*/

// 网络类型定义
export type NetworkType = "localnet" | "devnet" | "testnet" | "mainnet";

// 配置接口定义
export interface NetworkConfig {
    url: string;
    variables: {
        explorer: (id: string) => string;
        [key: string]: any;
    };
}

// Explorer 配置类型
export interface ExplorerConfig {
    primary: (id: string) => string;
    fallback: (id: string) => string;
}

// 创建 Explorer 配置的函数
function createExplorerConfig(network: NetworkType): ExplorerConfig {
    // localnet 的 explorer 函数
    const createLocalnetExplorer = (id: string) => {
        const localnetUrl = getFullnodeUrl("localnet");
        const encodedUrl = encodeURIComponent(localnetUrl);
        return `https://custom.suiscan.xyz/custom/object/${id}?network=${encodedUrl}`;
    };

    const explorers = {
        localnet: {
            // localnet 使用 custom.suiscan.xyz 并编码 localnet URL
            primary: createLocalnetExplorer,
            fallback: createLocalnetExplorer, // fallback 使用与 primary 相同的函数
        },
        devnet: {
            // 优先使用 suivision.xyz
            primary: (id: string) => `https://devnet.suivision.xyz/object/${id}`,
            fallback: (id: string) => `https://suiscan.xyz/devnet/object/${id}`,
        },
        testnet: {
            // 优先使用 suivision.xyz
            primary: (id: string) => `https://testnet.suivision.xyz/object/${id}`,
            fallback: (id: string) => `https://suiscan.xyz/testnet/object/${id}`,
        },
        mainnet: {
            // 优先使用 suivision.xyz
            primary: (id: string) => `https://suivision.xyz/object/${id}`,
            fallback: (id: string) => `https://suiscan.xyz/mainnet/object/${id}`,
        },
    };

    return explorers[network];
}

// 获取可用的 Explorer URL 的工具函数
export async function getExplorerUrl(network: NetworkType, objectId: string): Promise<string> {
    const explorerConfig = createExplorerConfig(network);
    
    try {
        // 尝试主要 explorer
        const primaryUrl = explorerConfig.primary(objectId);
        const response = await fetch(primaryUrl, { method: 'HEAD' });
        if (response.ok) {
            return primaryUrl;
        }
    } catch (error) {
        console.warn(`Primary explorer failed for ${network}:`, error);
    }
    
    // 回退到备用 explorer
    return explorerConfig.fallback(objectId);
}

// 创建网络配置的函数
export function createNetworkConfig(network: NetworkType): NetworkConfig {
    const explorerConfig = createExplorerConfig(network);
    
    const configs = {
        localnet: {
            url: getFullnodeUrl("localnet"),
            variables: {
                explorer: explorerConfig.primary,
                explorer_suiscan: explorerConfig.fallback,
                ...LocalnetPackage,
            },
        },
        devnet: {
            url: getFullnodeUrl("devnet"),
            variables: {
                explorer: explorerConfig.primary,
                explorer_suiscan: explorerConfig.fallback,
                ...DevnetPackage,
            },
        },
        testnet: {
            url: getFullnodeUrl("testnet"),
            variables: {
                explorer: explorerConfig.primary,
                explorer_suiscan: explorerConfig.fallback,
                ...TestnetPackage,
            },
        },
        mainnet: {
            url: getFullnodeUrl("mainnet"),
            variables: {
                explorer: explorerConfig.primary,
                explorer_suiscan: explorerConfig.fallback,
                ...MainnetPackage,
            },
        },
    };

    return configs[network];
}

// 导出所有网络配置（保持向后兼容）
export const config = {
    localnet: createNetworkConfig("localnet"),
    devnet: createNetworkConfig("devnet"),
    testnet: createNetworkConfig("testnet"),
    mainnet: createNetworkConfig("mainnet"),
};

export default config;
