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
    try {
        // 1. 尝试从 localStorage 获取加密的私钥
        const encryptedData = localStorage.getItem(STORAGE_KEY);

        if (encryptedData) {
            console.log('[KeystoreLoader] Found encrypted keypair, decrypting...');

            // 2. 解密
            const privateKeyBase64 = await decryptWithPassword(encryptedData, DEV_PASSWORD);

            // 3. 解析 keypair
            const keypair = parseKeypairFromBase64(privateKeyBase64);

            console.log('[KeystoreLoader] ✓ Keypair decrypted and loaded');
            console.log('  Address:', keypair.toSuiAddress());

            // 通知用户
            UINotification.info("开发密钥加载成功");

            return keypair;
        }

        // 4. 没有找到 → 生成新的
        console.log('[KeystoreLoader] No keypair found, generating new one...');
        const newKeypair = Ed25519Keypair.generate();
        const address = newKeypair.toSuiAddress();

        console.log('[KeystoreLoader] ✓ Generated new keypair');
        console.log('  Address:', address);

        // 通知用户
        UINotification.info("生成新开发密钥");

        // 5. 请求 faucet（异步，不阻塞）
        console.log('[KeystoreLoader] Requesting SUI from faucet...');
        UINotification.info("正在从水龙头获取测试币...");

        requestSuiFromFaucet(address, 'localnet').then(success => {
            if (success) {
                console.log('[KeystoreLoader] ✓ Faucet request successful');
                UINotification.success("测试币获取成功");
            } else {
                console.warn('[KeystoreLoader] ⚠️  Faucet request failed');
                UINotification.warning("测试币获取失败（可能需要手动获取）");
            }
        }).catch(error => {
            console.error('[KeystoreLoader] Faucet error:', error);
            UINotification.error("测试币请求出错");
        });

        // 6. 加密并保存（不等待 faucet 完成）
        const privateKeyBase64 = exportKeypairToBase64(newKeypair);
        const encrypted = await encryptWithPassword(privateKeyBase64, DEV_PASSWORD);
        localStorage.setItem(STORAGE_KEY, encrypted);

        console.log('[KeystoreLoader] ✓ Keypair encrypted and saved to localStorage');
        console.log('  Storage key:', STORAGE_KEY);

        return newKeypair;

    } catch (error) {
        console.error('[KeystoreLoader] Error:', error);
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
 * 导出 keypair 为 base64
 * @param keypair Ed25519Keypair
 * @returns Base64 字符串（33 字节）
 */
function exportKeypairToBase64(keypair: Ed25519Keypair): string {
    const exported = keypair.export();
    const secretKey = exported.privateKey;

    // 添加类型标识符（0x00 for Ed25519）
    const withFlag = new Uint8Array(33);
    withFlag[0] = 0x00;
    withFlag.set(secretKey, 1);

    return btoa(String.fromCharCode(...withFlag));
}

/**
 * 清除保存的 keypair
 */
export function clearStoredKeypair(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[KeystoreLoader] Stored keypair cleared');
}
