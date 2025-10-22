/**
 * DeFi奖励交互类
 *
 * 封装DeFi存款验证和奖励激活的PTB构造逻辑
 *
 * Move模块：
 * - defi_verifier::defi_verifier
 * - tycoon::defi_rewards
 */

// 使用 import type 避免打包
import type { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { loadSuiTransactions } from '../loader';
import { DefiVerifierConfig, NaviConfig, ScallopConfig } from '../config/DefiConfig';

// 模块级缓存
let Transaction_: typeof Transaction | null = null;

/**
 * 初始化DeFi奖励交互模块
 */
export async function initDefiRewardInteraction(): Promise<void> {
    if (!Transaction_) {
        const { Transaction } = await loadSuiTransactions();
        Transaction_ = Transaction;
    }
}

/**
 * DeFi存款检查结果
 */
export interface DefiDepositStatus {
    hasNaviDeposit: boolean;
    hasScallopDeposit: boolean;
    scallopCoinId?: string;
}

/**
 * DeFi奖励激活结果
 */
export interface DefiRewardResult {
    tx: Transaction;
    protocols: string[];  // 激活的协议列表
}

/**
 * DeFi奖励交互类
 */
export class DefiRewardInteraction {
    constructor(
        private client: SuiClient,
        private tycoonPackageId: string
    ) {}

    /**
     * 检查用户的DeFi存款状态
     *
     * @param userAddress 用户地址
     * @returns DeFi存款状态
     */
    async checkDefiDeposits(userAddress: string): Promise<DefiDepositStatus> {
        const [hasNaviDeposit, scallopInfo] = await Promise.all([
            this._checkNaviDeposit(userAddress),
            this._checkScallopDeposit(userAddress)
        ]);

        return {
            hasNaviDeposit,
            hasScallopDeposit: scallopInfo.hasDeposit,
            scallopCoinId: scallopInfo.coinId
        };
    }

    /**
     * 构建激活DeFi奖励的交易
     *
     * 流程：
     * 1. 先检查用户的DeFi存款状态
     * 2. 只为有存款的协议构造验证+激活调用
     * 3. 返回组合的PTB
     *
     * @param gameId 游戏对象ID
     * @param userAddress 用户地址
     * @returns 交易对象和激活的协议列表
     * @throws 如果用户在两个协议都没有存款
     */
    async buildActivateDefiRewardsTx(
        gameId: string,
        userAddress: string
    ): Promise<DefiRewardResult> {
        const tx = new Transaction_!();
        const protocols: string[] = [];

        // 检查存款状态
        const status = await this.checkDefiDeposits(userAddress);

        // 构造Navi奖励调用
        if (status.hasNaviDeposit) {
            console.log('[DefiReward] 检测到Navi存款，添加验证+激活调用');

            // 验证Navi存款 → 返回NaviProof热土豆
            const naviProof = tx.moveCall({
                target: `${DefiVerifierConfig.packageId}::defi_verifier::verify_navi_with_proof`,
                arguments: [tx.object(NaviConfig.storageId)]
            });

            // 消费热土豆，激活Navi奖励
            tx.moveCall({
                target: `${this.tycoonPackageId}::defi_rewards::activate_navi_reward`,
                arguments: [
                    tx.object(gameId),
                    naviProof  // 热土豆result
                ]
            });

            protocols.push('Navi');
        }

        // 构造Scallop奖励调用
        if (status.hasScallopDeposit && status.scallopCoinId) {
            console.log('[DefiReward] 检测到Scallop存款，添加验证+激活调用');

            // 验证Scallop存款 → 返回ScallopProof热土豆
            const scallopProof = tx.moveCall({
                target: `${DefiVerifierConfig.packageId}::defi_verifier::verify_scallop_with_proof`,
                arguments: [tx.object(status.scallopCoinId)],
                typeArguments: [ScallopConfig.usdcType]
            });

            // 消费热土豆，激活Scallop奖励
            tx.moveCall({
                target: `${this.tycoonPackageId}::defi_rewards::activate_scallop_reward`,
                arguments: [
                    tx.object(gameId),
                    scallopProof
                ]
            });

            protocols.push('Scallop');
        }

        // 检查是否有任何存款
        if (protocols.length === 0) {
            throw new Error('未发现DeFi存款（Navi或Scallop的USDC）');
        }

        console.log('[DefiReward] PTB构造完成，包含协议:', protocols);

        return { tx, protocols };
    }

    // ============ 私有辅助函数 ============

    /**
     * 检查Navi USDC存款
     *
     * 使用devInspect调用verify_navi_usdc查询
     */
    private async _checkNaviDeposit(userAddress: string): Promise<boolean> {
        try {
            const tx = new Transaction_!();

            tx.moveCall({
                target: `${DefiVerifierConfig.packageId}::defi_verifier::verify_navi_usdc`,
                arguments: [tx.object(NaviConfig.storageId)]
            });

            tx.setSender(userAddress);

            const result = await this.client.devInspectTransactionBlock({
                sender: userAddress,
                transactionBlock: tx
            });

            // 解析返回值
            if (result.results?.[0]?.returnValues) {
                const score = result.results[0].returnValues[0][0][0];
                return score === 1;
            }

            return false;
        } catch (error) {
            console.warn('[DefiReward] Navi检查失败:', error);
            return false;
        }
    }

    /**
     * 检查Scallop USDC存款
     *
     * 查询用户持有的SCALLOP_USDC coin
     */
    private async _checkScallopDeposit(userAddress: string): Promise<{
        hasDeposit: boolean;
        coinId?: string;
    }> {
        try {
            const coins = await this.client.getAllCoins({
                owner: userAddress,
                coinType: ScallopConfig.usdcType
            });

            if (coins.data.length > 0 && coins.data[0].balance !== '0') {
                return {
                    hasDeposit: true,
                    coinId: coins.data[0].coinObjectId
                };
            }

            return { hasDeposit: false };
        } catch (error) {
            console.warn('[DefiReward] Scallop检查失败:', error);
            return { hasDeposit: false };
        }
    }
}
