/**
 * Keystore 加载工具
 * 参考 move/cli/src/utils/sui_utils.ts 的实现
 *
 * 前端适配：由于浏览器无法直接访问文件系统，改为从 localStorage 加载
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { encryptWithPassword, decryptWithPassword } from './CryptoUtils';
import { requestSuiFromFaucet } from './FaucetUtils';
import { UINotification } from '../../ui/utils/UINotification';

// 存储键和开发密码
const STORAGE_KEY = 'web3_tycoon_sui_encrypted_keypair';
const DEV_PASSWORD = 'web3-tycoon-dev-2024';  // 硬编码开发密码（仅测试网使用）

/**
 * 加载或生成 Keypair（自动处理 faucet 和加密存储）
 *
 * 流程：
 * 1. 从 localStorage 获取加密数据 → 解密 → 返回
 * 2. 没有找到 → 生成新 keypair → 请求 faucet → 加密保存 → 返回
 *
 * @returns Ed25519Keypair
 */
export async function loadKeypairFromKeystore(): Promise<Ed25519Keypair> {
    console.log('='.repeat(60));
    console.log('[KeystoreLoader] === START ===');
    console.log('  Timestamp:', new Date().toISOString());
    console.log('  Storage key:', STORAGE_KEY);
    console.log('='.repeat(60));

    try {
        // Step 1: 检查 localStorage
        console.log('[KeystoreLoader] Step 1: Checking localStorage');
        const encryptedData = localStorage.getItem(STORAGE_KEY);
        console.log('  Encrypted data exists:', !!encryptedData);
        if (encryptedData) {
            console.log('  Encrypted data length:', encryptedData.length);
        }

        if (encryptedData) {
            UINotification.info("加载已有密钥");

            // Step 2: 解密
            console.log('[KeystoreLoader] Step 2: Decrypting');
            const privateKeyBase64 = await decryptWithPassword(encryptedData, DEV_PASSWORD);
            console.log('  Decryption successful');
            console.log('  Decrypted data length:', privateKeyBase64.length);

            // Step 3: 解析
            console.log('[KeystoreLoader] Step 3: Parsing keypair');
            const keypair = parseKeypairFromBase64(privateKeyBase64);
            const address = keypair.toSuiAddress();
            console.log('  Address:', address);

            console.log('[KeystoreLoader] === SUCCESS (LOADED) ===');
            console.log('='.repeat(60));
            return keypair;
        }

        // 没有找到 → 生成新的
        console.log('[KeystoreLoader] No saved keypair found');
        UINotification.info("生成新开发密钥");

        // Step 4: 生成
        console.log('[KeystoreLoader] Step 4: Generating new keypair');
        const newKeypair = Ed25519Keypair.generate();
        const address = newKeypair.toSuiAddress();
        console.log('  Generated address:', address);

        // Step 5: Faucet（异步）
        console.log('[KeystoreLoader] Step 5: Requesting faucet (async)');
        UINotification.info("正在从水龙头获取测试币...");

        requestSuiFromFaucet(address, 'localnet').then(success => {
            console.log('[KeystoreLoader] Faucet callback, success:', success);
            if (success) {
                UINotification.success("测试币获取成功");
            } else {
                UINotification.warning("测试币获取失败");
            }
        }).catch(error => {
            console.error('[KeystoreLoader] Faucet callback error:', error);
        });

        // Step 6: 导出
        console.log('[KeystoreLoader] Step 6: Exporting keypair to base64');
        const privateKeyBase64 = exportKeypairToBase64(newKeypair);
        console.log('  Exported length:', privateKeyBase64.length);

        // Step 7: 加密
        console.log('[KeystoreLoader] Step 7: Encrypting');
        const encrypted = await encryptWithPassword(privateKeyBase64, DEV_PASSWORD);
        console.log('  Encrypted length:', encrypted.length);

        // Step 8: 保存
        console.log('[KeystoreLoader] Step 8: Saving to localStorage');
        localStorage.setItem(STORAGE_KEY, encrypted);
        console.log('  Saved');

        // Step 9: 验证保存
        console.log('[KeystoreLoader] Step 9: Verifying save');
        const saved = localStorage.getItem(STORAGE_KEY);
        const verified = saved === encrypted;
        console.log('  Verification result:', verified ? 'SUCCESS' : 'FAILED');
        console.log('  Saved data exists:', !!saved);
        if (saved) {
            console.log('  Saved data length:', saved.length);
            console.log('  Matches encrypted:', saved === encrypted);
        }

        if (!verified) {
            console.error('[KeystoreLoader] ✗ Save verification FAILED!');
            UINotification.error("密钥保存失败");
        }

        console.log('[KeystoreLoader] === SUCCESS (GENERATED) ===');
        console.log('='.repeat(60));

        return newKeypair;

    } catch (error) {
        console.error('='.repeat(60));
        console.error('[KeystoreLoader] === ERROR ===');
        console.error('  Error:', error);
        console.error('  Error message:', (error as Error).message);
        console.error('  Error stack:', (error as Error).stack);
        console.error('='.repeat(60));

        UINotification.error(`密钥加载失败: ${error}`);
        throw error;
    }
}

/**
 * 从 base64 解析 keypair
 * @param base64 Base64 编码的私钥（33 字节：1 字节标识符 + 32 字节私钥）
 * @returns Ed25519Keypair
 */
function parseKeypairFromBase64(base64: string): Ed25519Keypair {
    const decoded = atob(base64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
    }

    // 跳过第一个字节（密钥类型标识符）
    const privateKeyBytes = bytes.subarray(1);

    if (privateKeyBytes.length !== 32) {
        throw new Error(`Invalid private key length: ${privateKeyBytes.length}, expected 32 bytes`);
    }

    return Ed25519Keypair.fromSecretKey(privateKeyBytes);
}

/**
 * 导出 keypair 为 base64（兼容 Sui keystore 格式）
 * @param keypair Ed25519Keypair
 * @returns Base64 字符串
 */
function exportKeypairToBase64(keypair: Ed25519Keypair): string {
    console.log('[KeystoreLoader] exportKeypairToBase64: START');

    // 使用 getSecretKey() 获取私钥
    const secretKey = keypair.getSecretKey();
    console.log('  Secret key type:', secretKey.constructor.name);
    console.log('  Secret key length:', secretKey.length);
    console.log('  Secret key sample (first 10 bytes):', Array.from(secretKey.slice(0, 10)));

    // Sui SDK 的 getSecretKey() 返回格式：
    // - 可能是 32 字节（纯私钥）
    // - 可能是 64 字节（seed + key）
    // - 可能是 70 字节（未知格式）

    // 尝试不同的处理方式
    let privateKey: Uint8Array;

    if (secretKey.length === 32) {
        console.log('  Format: 32 bytes (pure private key)');
        privateKey = secretKey;
    } else if (secretKey.length === 64) {
        console.log('  Format: 64 bytes (seed + key)');
        privateKey = secretKey.slice(0, 32);  // 取前 32 字节
    } else if (secretKey.length === 70) {
        console.log('  Format: 70 bytes (unknown, trying bcs encoding)');
        // 可能是 BCS 编码，跳过前几个字节
        // 尝试跳过前 38 字节（70 - 32）
        privateKey = secretKey.slice(38);
    } else {
        console.error('[KeystoreLoader] Unexpected secret key length:', secretKey.length);
        console.error('  Trying to use last 32 bytes as fallback');
        // 尝试使用最后 32 字节
        privateKey = secretKey.slice(secretKey.length - 32);
    }

    console.log('  Extracted private key length:', privateKey.length);

    if (privateKey.length !== 32) {
        console.error('[KeystoreLoader] Failed to extract 32-byte private key');
        throw new Error(`Invalid private key length: ${privateKey.length}, expected 32`);
    }

    // 添加类型标识符（0x00 for Ed25519）
    const withFlag = new Uint8Array(33);
    withFlag[0] = 0x00;
    withFlag.set(privateKey, 1);
    console.log('  With flag length:', withFlag.length);

    const result = btoa(String.fromCharCode(...withFlag));
    console.log('  Base64 result length:', result.length);
    console.log('[KeystoreLoader] exportKeypairToBase64: SUCCESS');

    return result;
}

/**
 * 清除保存的 keypair
 */
export function clearStoredKeypair(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[KeystoreLoader] Stored keypair cleared');
}
