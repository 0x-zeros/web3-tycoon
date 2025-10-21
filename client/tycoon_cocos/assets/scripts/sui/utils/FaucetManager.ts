/**
 * Faucet 管理器
 * 统一管理 faucet 请求，防止重复失败和限速
 *
 * 功能：
 * - 记录失败的请求（内存，刷新后重置）
 * - 提供统一的请求接口（自动/手动都调用）
 * - 失败 1 次后不再重试（避免被限速）
 */

import { requestSuiFromFaucet } from './FaucetUtils';
import { UINotification } from '../../ui/utils/UINotification';

/**
 * Faucet 管理器（单例）
 */
export class FaucetManager {
    private static _instance: FaucetManager | null = null;

    /** 记录失败的请求（key: "network:address"）*/
    private _failedRequests: Set<string> = new Set();

    /**
     * 私有构造函数
     */
    private constructor() {}

    /**
     * 获取单例实例
     */
    public static get instance(): FaucetManager {
        if (!FaucetManager._instance) {
            FaucetManager._instance = new FaucetManager();
        }
        return FaucetManager._instance;
    }

    /**
     * 请求 faucet（统一入口）
     *
     * @param address 接收地址
     * @param network 网络类型（仅支持 localnet/devnet）
     * @returns 是否成功
     */
    public async requestFaucet(
        address: string,
        network: 'localnet' | 'devnet'
    ): Promise<boolean> {
        console.log('[FaucetManager] Requesting faucet...');
        console.log('  Address:', address);
        console.log('  Network:', network);

        // 生成唯一键
        const key = `${network}:${address}`;

        // 检查是否已失败过
        if (this._failedRequests.has(key)) {
            console.log('[FaucetManager] Already failed for this address/network, skipping');
            UINotification.warning("Faucet 之前已失败，请稍后重试");
            return false;
        }

        // 显示请求中通知
        UINotification.info("正在从水龙头获取测试币...");

        try {
            // 调用 faucet 请求
            const success = await requestSuiFromFaucet(address, network);

            if (success) {
                console.log('[FaucetManager] Faucet request succeeded');
                UINotification.success("测试币获取成功");
                return true;
            } else {
                console.log('[FaucetManager] Faucet request failed, marking as failed');

                // 记录失败状态（内存，刷新后重置）
                this._failedRequests.add(key);

                UINotification.warning("测试币获取失败，请稍后重试");
                return false;
            }

        } catch (error) {
            console.error('[FaucetManager] Faucet request error:', error);

            // 记录失败状态
            this._failedRequests.add(key);

            UINotification.error("测试币获取失败");
            return false;
        }
    }

    /**
     * 清除失败记录（用于重置状态，如切换网络）
     * @param address 可选，指定地址。不传则清除所有
     * @param network 可选，指定网络。不传则清除所有
     */
    public clearFailedRecords(address?: string, network?: 'localnet' | 'devnet'): void {
        if (address && network) {
            const key = `${network}:${address}`;
            this._failedRequests.delete(key);
            console.log('[FaucetManager] Cleared failed record:', key);
        } else {
            this._failedRequests.clear();
            console.log('[FaucetManager] Cleared all failed records');
        }
    }

    /**
     * 检查是否已失败过
     * @param address 地址
     * @param network 网络
     * @returns 是否已失败
     */
    public hasFailed(address: string, network: 'localnet' | 'devnet'): boolean {
        const key = `${network}:${address}`;
        return this._failedRequests.has(key);
    }
}

/**
 * 便捷的全局访问器
 */
export const faucetManager = FaucetManager.instance;
