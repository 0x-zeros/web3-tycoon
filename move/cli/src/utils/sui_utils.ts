/**
 * Sui工具函数
 *
 * 简化版：只保留核心的keypair获取功能
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as fs from 'fs';
import * as os from 'os';

/**
 * 从keystore文件获取keypair
 *
 * 默认路径：~/.sui/sui_config/sui.keystore
 *
 * @returns Ed25519Keypair
 */
export function get_keypair_from_keystore(): Ed25519Keypair {
    const keystorePath = os.homedir() + '/.sui/sui_config/sui.keystore';

    // 读取keystore文件
    const keystoreData = JSON.parse(fs.readFileSync(keystorePath, 'utf-8'));

    // 选择第一个key（通常是活跃地址）
    const base64PrivateKey = keystoreData[0];

    // 从base64解码并跳过第一个字节（密钥类型标识符）
    // Sui keystore格式: 33-byte flag || privkey
    // 参考: https://docs.sui.io/references/cli/keytool#generate-a-new-key-pair-and-store-it-in-a-file
    const privateKeyBytes = Buffer.from(base64PrivateKey, 'base64').subarray(1);

    // 从32字节私钥创建keypair
    const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);

    return keypair;
}
