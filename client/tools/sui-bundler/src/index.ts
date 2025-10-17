/**
 * Sui SDK System.register 打包入口
 * 只导出实际使用的 API，减少体积
 */

// ===== Buffer polyfill (Node 内建兜底) =====
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer;
}

// ===== @mysten/sui =====

// Client API
export * from '@mysten/sui/client';

// Transaction Builder
export * from '@mysten/sui/transactions';

// BCS Serialization
export * from '@mysten/sui/bcs';

// Keypairs
export * from '@mysten/sui/keypairs/ed25519';

// Utils
export * from '@mysten/sui/utils';

// Faucet
export * from '@mysten/sui/faucet';

// ===== @mysten/wallet-standard =====

export * from '@mysten/wallet-standard';

// ===== 版本信息 =====

export const SDK_VERSION = '1.42.0';
export const BUNDLER_VERSION = '1.0.0';
