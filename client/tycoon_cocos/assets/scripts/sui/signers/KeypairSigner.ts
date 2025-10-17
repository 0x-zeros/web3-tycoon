/**
 * Keypair 签名器实现
 * 使用本地密钥对进行签名（用于测试或后端）
 */

// 使用 import type 避免打包（运行时由调用者提供实例）
import type { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SignerProvider } from './SignerProvider';

/**
 * Keypair 签名器
 * 使用本地存储的密钥对进行签名
 * 注意：不建议在前端生产环境使用，仅用于测试
 */
export class KeypairSigner implements SignerProvider {
    constructor(private keypair: Ed25519Keypair) {}

    /**
     * 获取密钥对对应的地址
     */
    getAddress(): string {
        return this.keypair.toSuiAddress();
    }

    /**
     * 使用密钥对签名并执行交易
     */
    async signAndExecuteTransaction(
        tx: Transaction,
        client: SuiClient
    ): Promise<SuiTransactionBlockResponse> {
        console.log('[KeypairSigner] Signing transaction with keypair:', this.getAddress());

        try {
            // 使用 SuiClient 的签名并执行方法
            const result = await client.signAndExecuteTransaction({
                transaction: tx,
                signer: this.keypair,
                options: {
                    showEffects: true,
                    showEvents: true,
                    showObjectChanges: true
                }
            });

            console.log('[KeypairSigner] Transaction executed:', result.digest);
            return result;

        } catch (error) {
            console.error('[KeypairSigner] Transaction failed:', error);
            throw error;
        }
    }

    /**
     * 获取签名器类型
     */
    getType(): 'wallet' | 'keypair' {
        return 'keypair';
    }
}
