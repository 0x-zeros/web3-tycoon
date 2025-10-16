/**
 * Wallet 签名器实现
 * 使用浏览器钱包扩展进行签名（推荐方式）
 */

import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Wallet, WalletAccount } from '@mysten/wallet-standard';
import { SignerProvider } from './SignerProvider';

/**
 * Wallet 签名器
 * 使用浏览器钱包（如 Sui Wallet, Suiet 等）进行签名
 */
export class WalletSigner implements SignerProvider {
    constructor(
        private wallet: Wallet,
        private account: WalletAccount,
        private network: string
    ) {}

    /**
     * 获取当前账户地址
     */
    getAddress(): string {
        return this.account.address;
    }

    /**
     * 使用钱包签名并执行交易
     */
    async signAndExecuteTransaction(
        tx: Transaction,
        client: SuiClient
    ): Promise<SuiTransactionBlockResponse> {
        console.log('[WalletSigner] Signing transaction with wallet:', this.wallet.name);

        // 获取钱包的签名并执行功能
        const signFeature = this.wallet.features['sui:signAndExecuteTransaction'] as any;

        if (!signFeature || typeof signFeature.signAndExecuteTransaction !== 'function') {
            throw new Error(`Wallet ${this.wallet.name} does not support sui:signAndExecuteTransaction`);
        }

        try {
            // 调用钱包扩展的签名并执行方法
            const result = await signFeature.signAndExecuteTransaction({
                transaction: tx,
                account: this.account,
                chain: `sui:${this.network}`,  // 添加 chain 参数（Wallet Standard 规范要求）
                // options 可根据需要添加
                options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true
                }
            });

            console.log('[WalletSigner] Transaction executed:', result.digest);
            return result;

        } catch (error) {
            console.error('[WalletSigner] Transaction failed:', error);
            throw error;
        }
    }

    /**
     * 获取签名器类型
     */
    getType(): 'wallet' | 'keypair' {
        return 'wallet';
    }

    /**
     * 获取钱包名称
     */
    getWalletName(): string {
        return this.wallet.name;
    }
}
