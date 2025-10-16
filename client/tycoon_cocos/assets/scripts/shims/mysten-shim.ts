/**
 * @mysten/* Shim
 *
 * 这是一个占位模块，用于在 TypeScript 编译和 Rollup 打包时提供类型和导出。
 * 实际运行时，SystemJS 会通过 import-map 解析到真实的 ESM 文件（libs/*.js）。
 *
 * 这个 shim 会被打包进 bundle，但 SystemJS 会优先使用 import-map 中的映射，
 * 所以运行时实际加载的是我们复制的原始 ESM 文件（未经转译，保留 BigInt 等现代语法）。
 */

// 导出一个 Proxy 对象，在运行时拦截所有访问
const shimProxy = new Proxy({}, {
    get(_target, prop) {
        console.warn(`[mysten-shim] 访问了 ${String(prop)}，这应该由 SystemJS import-map 解析。`);
        return undefined;
    }
});

// 默认导出
export default shimProxy;

// 导出所有可能的命名导出（覆盖常用的）
export const SuiClient = shimProxy;
export const SuiHTTPTransport = shimProxy;
export const Transaction = shimProxy;
export const Ed25519Keypair = shimProxy;
export const getFullnodeUrl = shimProxy;
export const getWallets = shimProxy;
export const Wallet = shimProxy;
export const WalletAccount = shimProxy;
export const bcs = shimProxy;
export const fromHex = shimProxy;
export const toHex = shimProxy;

// 类型导出（仅用于 TypeScript 编译）
export type * from '@mysten/sui/client';
export type * from '@mysten/sui/transactions';
export type * from '@mysten/sui/keypairs/ed25519';
export type * from '@mysten/sui/utils';
export type * from '@mysten/sui/bcs';
export type * from '@mysten/wallet-standard';
export type * from '@mysten/bcs';
