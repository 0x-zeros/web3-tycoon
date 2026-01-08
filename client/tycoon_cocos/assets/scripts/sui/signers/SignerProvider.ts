/**
 * 签名提供者接口
 * 统一封装 Wallet 和 Keypair 两种签名方式
 */

// 使用 import type 避免打包
import type { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';

/**
 * 个人消息签名结果
 */
export interface PersonalMessageSignature {
    /** Base64 编码的消息 bytes */
    bytes: string;
    /** Base64 编码的签名 */
    signature: string;
}

/**
 * 签名提供者接口
 * 提供统一的签名和交易执行接口
 */
export interface SignerProvider {
    /**
     * 获取签名者地址
     */
    getAddress(): string;

    /**
     * 签名并执行交易
     * @param tx 交易对象
     * @param client Sui 客户端
     * @returns 交易结果
     */
    signAndExecuteTransaction(
        tx: Transaction,
        client: SuiClient
    ): Promise<SuiTransactionBlockResponse>;

    /**
     * 签名个人消息（用于身份验证）
     * @param message 消息字节数组
     * @returns 签名结果
     */
    signPersonalMessage(message: Uint8Array): Promise<PersonalMessageSignature>;

    /**
     * 获取签名者类型（用于调试）
     */
    getType(): 'wallet' | 'keypair';
}
