import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';

/**
 * 从keystore文件获取keypair
 * mac 默认路径：~/.sui/sui_config/sui.keystore
 * @returns Ed25519Keypair
 */
export function get_keypair_from_keystore(): Ed25519Keypair {
    const keystorePath = os.homedir() + '/.sui/sui_config/sui.keystore';
    // console.log('filepath: ', keystorePath);

    // 读取 keystore 文件
    const keystoreData = JSON.parse(fs.readFileSync(keystorePath, 'utf-8'));

    // 选择一个 key（通常第一个）
    const base64PrivateKey = keystoreData[0]; // keystoreData 为 base64 字符串数组

    //Wrong secretKey size. Expected 32 bytes, got 33.
    //33-byte flag || privkey
    //https://docs.sui.io/references/cli/keytool#generate-a-new-key-pair-and-store-it-in-a-file

    // 从 base64 解码并跳过第一个字节（密钥类型标识符）
    const privateKeyBytes = Buffer.from(base64PrivateKey, 'base64').subarray(1);

    // 从 32 字节私钥创建 keypair
    const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);

    return keypair;
}

/**
 * 获取对象字段
 * @param objectId 对象ID
 * @param suiRpcUrl Sui RPC URL
 * @returns 对象字段
 */
export async function get_object_fields(suiRpcUrl: string, objectId: string): Promise<any> {
    try {
        const response = await axios.post(suiRpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getObject',
            params: [
                objectId,
                {
                    showType: true,
                    showOwner: true,
                    showDepth: true,
                    showContent: true,
                    showDisplay: true,
                },
            ],
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const fields = response.data.result?.data?.content?.fields;
        if (fields) {
            console.log('fields:', fields);
        } else {
            console.log('No fields found in the object.');
        }
        return fields;
    } catch (error: any) {
        console.error('Error fetching object data:', error.message);
        return undefined;
    }
}

/**
 * 获取交易事件
 * @param digest 交易摘要
 * @param suiRpcUrl Sui RPC URL
 * @param filterField 可选的过滤字段名，如果不提供则返回所有事件的parsedJson列表
 * @returns 如果提供了filterField，返回该字段的值；否则返回所有事件的parsedJson列表
 */
export async function get_transaction_events(
    suiRpcUrl: string, 
    digest: string, 
    filterField?: string
): Promise<any> {
    try {
        const response = await axios.post(suiRpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getTransactionBlock',
            params: [
                digest,
                {
                    showInput: false,
                    showRawInput: false,
                    showEffects: false,
                    showEvents: true,
                    showObjectChanges: false,
                    showBalanceChanges: false
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const events = response.data.result?.events;
        if (events && events.length > 0) {
            console.log('交易触发的事件列表:');
            
            // 如果没有提供过滤字段，返回所有事件的parsedJson列表
            if (!filterField) {
                const allEvents = events
                    .filter((event: any) => event.parsedJson)
                    .map((event: any) => event.parsedJson);
                console.log('所有事件内容:', allEvents);
                return allEvents;
            }
            
            // 如果提供了过滤字段，查找包含该字段的事件
            for (const event of events) {
                if (event.parsedJson && filterField in event.parsedJson) {
                    const value = (event as any).parsedJson[filterField];
                    console.log(`${filterField}:`, value);
                    return value;
                } else {
                    console.log('事件内容:', (event as any).parsedJson);
                }
            }
            return null;
        } else {
            console.log('该交易没有触发任何事件。');
            return filterField ? null : [];
        }

    } catch (error: any) {
        console.error('获取交易事件失败:', error.message);
        return filterField ? null : [];
    }
}

/**
 * 获取新创建的对象ID
 * @param digest 交易摘要
 * @param suiRpcUrl Sui RPC URL
 * @returns 新创建的对象ID
 */
export async function get_newly_created_object(
    suiRpcUrl: string, 
    digest: string
): Promise<string | null> {
    try {
        const response = await axios.post(suiRpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getTransactionBlock',
            params: [
                digest,
                {
                    showEffects: true,
                    showObjectChanges: true
                }
            ]
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        const result = response.data.result;
        const createdObjects = result.effects?.created || [];
        if (createdObjects.length === 0) {
            console.log('未找到新创建的对象');
            return null;
        }

        const newObjectId = createdObjects[0].reference.objectId;
        console.log('新对象 ID:', newObjectId);
        return newObjectId;

    } catch (error: any) {
        console.error('获取新对象失败:', error.message);
        return null;
    }
} 