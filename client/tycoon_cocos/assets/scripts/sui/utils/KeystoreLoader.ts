/**
 * Keystore 加载工具
 * 参考 move/cli/src/utils/sui_utils.ts 的实现
 *
 * 前端适配：由于浏览器无法直接访问文件系统，改为从 localStorage 加载
 */

// 使用 import type 避免打包
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { loadEd25519 } from '../loader';
import { encryptWithPassword, decryptWithPassword } from './CryptoUtils';
import { requestSuiFromFaucet } from './FaucetUtils';
import { UINotification } from '../../ui/utils/UINotification';
import { KeystoreConfig } from './KeystoreConfig';
import { SuiEnvConfigManager } from '../../config/SuiEnvConfigManager';
import { getNetworkRpcUrl, NetworkType } from '../config/SuiConfig';

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
    // 从配置获取 storageKey 和 password
    const config = KeystoreConfig.instance;
    const storageKey = config.getFullStorageKey();
    const password = config.getPassword();

    // 获取当前网络配置
    const savedConfig = SuiEnvConfigManager.instance.load();
    const network = savedConfig.network;
    const rpcUrl = getNetworkRpcUrl(network);

    console.log('='.repeat(60));
    console.log('[KeystoreLoader] === START ===');
    console.log('  Timestamp:', new Date().toISOString());
    console.log('  Storage key:', storageKey);
    console.log('  Network:', network);
    console.log('  RPC URL:', rpcUrl);
    console.log('  Config:', config.getSummary());
    console.log('='.repeat(60));

    try {
        // Step 1: 检查 localStorage
        console.log('[KeystoreLoader] Step 1: Checking localStorage');
        const encryptedData = localStorage.getItem(storageKey);
        console.log('  Encrypted data exists:', !!encryptedData);
        if (encryptedData) {
            console.log('  Encrypted data length:', encryptedData.length);
        }

        if (encryptedData) {
            UINotification.info("加载已有密钥");

            // Step 2: 解密
            console.log('[KeystoreLoader] Step 2: Decrypting');
            const privateKeyBase64 = await decryptWithPassword(encryptedData, password);
            console.log('  Decryption successful');
            console.log('  Decrypted data length:', privateKeyBase64.length);

            // Step 3: 解析（async）
            console.log('[KeystoreLoader] Step 3: Parsing keypair');
            const keypair = await parseKeypairFromBase64(privateKeyBase64);
            const address = keypair.toSuiAddress();
            console.log('  Address:', address);

            // Step 4: 检查余额并请求 faucet（如果需要）
            // 仅在 localnet/devnet/testnet 时检查余额
            if (network === 'localnet' || network === 'devnet' || network === 'testnet') {
                await checkBalanceAndRequestFaucet(address, network, rpcUrl);
            }

            console.log('[KeystoreLoader] === SUCCESS (LOADED) ===');
            console.log('='.repeat(60));
            return keypair;
        }

        // 没有找到 → 生成新的
        console.log('[KeystoreLoader] No saved keypair found');
        UINotification.info("生成新开发密钥");

        // Step 4: 生成（动态加载）
        console.log('[KeystoreLoader] Step 4: Generating new keypair');
        const { Ed25519Keypair: Ed25519Keypair_ } = await loadEd25519();
        const newKeypair = Ed25519Keypair_.generate();
        const address = newKeypair.toSuiAddress();
        console.log('  Generated address:', address);

        // Step 5: Faucet（异步，仅在测试网络）
        if (network === 'localnet' || network === 'devnet' || network === 'testnet') {
            console.log('[KeystoreLoader] Step 5: Requesting faucet (async)');
            UINotification.info("正在从水龙头获取测试币...");

            requestSuiFromFaucet(address, network).then(success => {
                console.log('[KeystoreLoader] Faucet callback, success:', success);
                if (success) {
                    UINotification.success("测试币获取成功");
                } else {
                    UINotification.warning("测试币获取失败");
                }
            }).catch(error => {
                console.error('[KeystoreLoader] Faucet callback error:', error);
            });
        }

        // Step 6: 导出
        console.log('[KeystoreLoader] Step 6: Exporting keypair to base64');
        const privateKeyBase64 = exportKeypairToBase64(newKeypair);
        console.log('  Exported length:', privateKeyBase64.length);

        // Step 7: 加密
        console.log('[KeystoreLoader] Step 7: Encrypting');
        const encrypted = await encryptWithPassword(privateKeyBase64, password);
        console.log('  Encrypted length:', encrypted.length);

        // Step 8: 保存
        console.log('[KeystoreLoader] Step 8: Saving to localStorage');
        localStorage.setItem(storageKey, encrypted);
        console.log('  Saved');

        // Step 9: 验证保存
        console.log('[KeystoreLoader] Step 9: Verifying save');
        const saved = localStorage.getItem(storageKey);
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
 * 从加密存储的数据解析 keypair
 * @param data 解密后的私钥数据（Bech32 字符串或 Base64）
 * @returns Ed25519Keypair
 */
async function parseKeypairFromBase64(data: string): Promise<Ed25519Keypair> {
    console.log('[KeystoreLoader] parseKeypairFromBase64: START');
    console.log('  Data length:', data.length);
    console.log('  Data sample:', data.substring(0, 20) + '...');

    // 动态加载 Ed25519Keypair
    const { Ed25519Keypair: Ed25519Keypair_ } = await loadEd25519();

    try {
        // 方法1: 尝试直接作为 Bech32 或原始数据传给 fromSecretKey
        console.log('[KeystoreLoader] Attempting method 1: Direct fromSecretKey');
        const keypair = Ed25519Keypair_.fromSecretKey(data);
        const address = keypair.toSuiAddress();
        console.log('  Method 1 SUCCESS, address:', address);
        return keypair;
    } catch (error1) {
        console.warn('[KeystoreLoader] Method 1 failed:', error1);

        try {
            // 方法2: 尝试 Base64 解码后传给 fromSecretKey
            console.log('[KeystoreLoader] Attempting method 2: Base64 decode');
            const decoded = atob(data);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
            }

            // 跳过第一个字节（可能是类型标识符）
            const privateKeyBytes = bytes.subarray(1);
            console.log('  Decoded bytes length:', privateKeyBytes.length);

            const keypair = Ed25519Keypair_.fromSecretKey(privateKeyBytes);
            const address = keypair.toSuiAddress();
            console.log('  Method 2 SUCCESS, address:', address);
            return keypair;
        } catch (error2) {
            console.error('[KeystoreLoader] Method 2 also failed:', error2);
            throw new Error('Failed to parse keypair from stored data');
        }
    }
}

/**
 * 导出 keypair（使用 Sui SDK 原生格式）
 * @param keypair Ed25519Keypair
 * @returns 私钥数据（可直接传给 fromSecretKey）
 */
function exportKeypairToBase64(keypair: Ed25519Keypair): string {
    console.log('[KeystoreLoader] exportKeypairToBase64: START');

    // 使用 getSecretKey() 获取私钥（可能是 Bech32 字符串或 Uint8Array）
    const secretKey = keypair.getSecretKey();

    // 检查类型
    const isString = typeof secretKey === 'string';
    const isUint8Array = secretKey instanceof Uint8Array;

    console.log('  Secret key type:', isString ? 'string' : isUint8Array ? 'Uint8Array' : 'unknown');
    console.log('  Secret key length:', secretKey.length);

    if (isString) {
        // Bech32 格式（如 "suiprivkey..."），直接返回
        console.log('  Format: Bech32 string');
        console.log('  Sample:', secretKey.substring(0, 20) + '...');
        return secretKey;
    } else if (isUint8Array) {
        // Uint8Array 格式，转为 Base64
        console.log('  Format: Uint8Array, converting to Base64');
        const result = btoa(String.fromCharCode(...secretKey));
        console.log('  Base64 length:', result.length);
        return result;
    } else {
        console.error('[KeystoreLoader] Unknown secret key format');
        throw new Error('Unknown secret key format from getSecretKey()');
    }
}

/**
 * 清除保存的 keypair
 */
export function clearStoredKeypair(): void {
    const storageKey = KeystoreConfig.instance.getFullStorageKey();
    localStorage.removeItem(storageKey);
    console.log('[KeystoreLoader] Stored keypair cleared:', storageKey);
}

/**
 * 检查余额，如果少于 10 SUI 则请求 faucet
 * @param address 地址
 * @param network 网络类型
 * @param rpcUrl RPC URL
 */
async function checkBalanceAndRequestFaucet(
    address: string,
    network: 'localnet' | 'devnet' | 'testnet',
    rpcUrl: string
): Promise<void> {
    console.log('[KeystoreLoader] Step 4: Checking balance');
    console.log('  Network:', network);
    console.log('  RPC URL:', rpcUrl);

    try {
        // 动态加载并创建临时 client 查询余额
        const { loadSuiClient } = await import('../loader');
        const { SuiClient } = await loadSuiClient();
        const client = new SuiClient({ url: rpcUrl });

        const balanceResult = await client.getBalance({
            owner: address,
            coinType: '0x2::sui::SUI'
        });

        const balance = BigInt(balanceResult.totalBalance);
        const balanceInSui = Number(balance) / 1_000_000_000;

        console.log('  Balance:', balanceInSui.toFixed(4), 'SUI');

        // 少于 10 SUI 则请求 faucet
        if (balance < 10_000_000_000n) {
            console.log('[KeystoreLoader] Balance too low (< 10 SUI), requesting faucet');
            UINotification.warning(`余额不足（${balanceInSui.toFixed(4)} SUI），正在请求测试币...`);

            const success = await requestSuiFromFaucet(address, network);
            if (success) {
                UINotification.success("测试币获取成功");
            } else {
                UINotification.warning("测试币获取失败，请手动获取");
            }
        } else {
            console.log('[KeystoreLoader] Balance sufficient (>= 10 SUI)');
        }
    } catch (error) {
        console.error('[KeystoreLoader] Failed to check balance:', error);
        // 忽略错误，不影响 keypair 加载
    }
}
