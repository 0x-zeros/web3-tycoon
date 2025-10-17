/**
 * @mysten/* 动态加载器
 * 通过 SystemJS 运行时加载，避免被 Rollup 打包
 */

// ============ 类型导入（不会被打包） ============

import type * as SuiClientTypes from '@mysten/sui/client';
import type * as SuiTransactionsTypes from '@mysten/sui/transactions';
import type * as SuiBcsTypes from '@mysten/sui/bcs';
import type * as Ed25519Types from '@mysten/sui/keypairs/ed25519';
import type * as WalletStandardTypes from '@mysten/wallet-standard';
import type * as SuiUtilsTypes from '@mysten/sui/utils';
import type * as SuiFaucetTypes from '@mysten/sui/faucet';

// ============ 运行时加载函数 ============

/**
 * 加载 @mysten/sui/client 模块
 * @returns 模块导出对象
 */
export async function loadSuiClient(): Promise<typeof SuiClientTypes> {
    return await (window as any).System.import('@mysten/sui/client');
}

/**
 * 加载 @mysten/sui/transactions 模块
 * @returns 模块导出对象
 */
export async function loadSuiTransactions(): Promise<typeof SuiTransactionsTypes> {
    return await (window as any).System.import('@mysten/sui/transactions');
}

/**
 * 加载 @mysten/sui/bcs 模块
 * @returns 模块导出对象
 */
export async function loadSuiBcs(): Promise<typeof SuiBcsTypes> {
    return await (window as any).System.import('@mysten/sui/bcs');
}

/**
 * 加载 @mysten/sui/keypairs/ed25519 模块
 * @returns 模块导出对象
 */
export async function loadEd25519(): Promise<typeof Ed25519Types> {
    return await (window as any).System.import('@mysten/sui/keypairs/ed25519');
}

/**
 * 加载 @mysten/wallet-standard 模块
 * @returns 模块导出对象
 */
export async function loadWalletStandard(): Promise<typeof WalletStandardTypes> {
    return await (window as any).System.import('@mysten/wallet-standard');
}

/**
 * 加载 @mysten/sui/utils 模块
 * @returns 模块导出对象
 */
export async function loadSuiUtils(): Promise<typeof SuiUtilsTypes> {
    return await (window as any).System.import('@mysten/sui/utils');
}

/**
 * 加载 @mysten/sui/faucet 模块
 * @returns 模块导出对象
 */
export async function loadSuiFaucet(): Promise<typeof SuiFaucetTypes> {
    return await (window as any).System.import('@mysten/sui/faucet');
}

// ============ 批量加载函数（可选优化） ============

/**
 * 预加载所有常用模块（可选）
 * 在应用启动时调用，提前加载所有模块
 */
export async function preloadAll(): Promise<void> {
    console.log('[SuiLoader] Preloading all @mysten/* modules...');

    await Promise.all([
        loadSuiClient(),
        loadSuiTransactions(),
        loadSuiBcs(),
        loadEd25519(),
        loadWalletStandard(),
        loadSuiUtils(),
        loadSuiFaucet()
    ]);

    console.log('[SuiLoader] All modules preloaded');
}
