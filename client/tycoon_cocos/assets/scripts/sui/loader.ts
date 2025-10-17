/**
 * Sui SDK 动态加载器
 * 从预打包的 sui.system.js 加载（System.register 格式）
 */

// ============ 类型导入（不会被打包） ============

import type * as SuiClientTypes from '@mysten/sui/client';
import type * as SuiTransactionsTypes from '@mysten/sui/transactions';
import type * as SuiBcsTypes from '@mysten/sui/bcs';
import type * as Ed25519Types from '@mysten/sui/keypairs/ed25519';
import type * as WalletStandardTypes from '@mysten/wallet-standard';
import type * as SuiUtilsTypes from '@mysten/sui/utils';
import type * as SuiFaucetTypes from '@mysten/sui/faucet';

// ============ 模块缓存 ============

let suiModule: any = null;

/**
 * 加载 sui.system.js 模块（单例）
 * @returns 完整的 Sui SDK 导出对象
 */
async function loadSuiModule(): Promise<any> {
    if (suiModule) {
        return suiModule;
    }

    // 统一使用相对路径（Preview 和 Build 都适用，避免子路径部署问题）
    const modulePath = './libs/sui.system.js';

    console.log('[SuiLoader] Loading sui.system.js from:', modulePath);
    suiModule = await (window as any).System.import(modulePath);
    console.log('[SuiLoader] Sui SDK loaded successfully');

    return suiModule;
}

// ============ 运行时加载函数（简化为返回同一模块） ============

/**
 * 加载 @mysten/sui/client 模块
 * @returns 模块导出对象
 */
export async function loadSuiClient(): Promise<typeof SuiClientTypes> {
    return await loadSuiModule();
}

/**
 * 加载 @mysten/sui/transactions 模块
 * @returns 模块导出对象
 */
export async function loadSuiTransactions(): Promise<typeof SuiTransactionsTypes> {
    return await loadSuiModule();
}

/**
 * 加载 @mysten/sui/bcs 模块
 * @returns 模块导出对象
 */
export async function loadSuiBcs(): Promise<typeof SuiBcsTypes> {
    return await loadSuiModule();
}

/**
 * 加载 @mysten/sui/keypairs/ed25519 模块
 * @returns 模块导出对象
 */
export async function loadEd25519(): Promise<typeof Ed25519Types> {
    return await loadSuiModule();
}

/**
 * 加载 @mysten/wallet-standard 模块
 * @returns 模块导出对象
 */
export async function loadWalletStandard(): Promise<typeof WalletStandardTypes> {
    return await loadSuiModule();
}

/**
 * 加载 @mysten/sui/utils 模块
 * @returns 模块导出对象
 */
export async function loadSuiUtils(): Promise<typeof SuiUtilsTypes> {
    return await loadSuiModule();
}

/**
 * 加载 @mysten/sui/faucet 模块
 * @returns 模块导出对象
 */
export async function loadSuiFaucet(): Promise<typeof SuiFaucetTypes> {
    return await loadSuiModule();
}

// ============ 预加载函数 ============

/**
 * 预加载 Sui SDK（可选优化）
 * 在应用启动时调用，提前加载模块
 */
export async function preloadAll(): Promise<void> {
    console.log('[SuiLoader] Preloading Sui SDK...');
    await loadSuiModule();
    console.log('[SuiLoader] Sui SDK preloaded');
}
