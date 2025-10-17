/**
 * 地图管理交互
 * 封装地图上传到链上的逻辑
 *
 * Move源文件: move/tycoon/sources/tycoon.move
 */

// 使用 import type 避免打包
import type { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { MapTemplate } from '../types/map';
import { encodeMapTemplateToBCS } from '../utils/mapBcsEncoder';
import { loadSuiTransactions } from '../loader';

// 模块级缓存
let Transaction_: typeof Transaction | null = null;

/**
 * 初始化模块
 */
export async function initMapAdminInteraction(): Promise<void> {
    if (!Transaction_) {
        const { Transaction } = await loadSuiTransactions();
        Transaction_ = Transaction;
    }
}

/**
 * 地图管理交互类
 */
export class MapAdminInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string
    ) {}

    // ============ 新版本：返回 Transaction（推荐使用）============

    /**
     * 构建上传地图模板的交易
     * @param mapTemplate 地图模板数据
     * @param schemaVersion schema 版本（从 GameData 获取）
     * @returns Transaction 对象
     */
    async buildUploadMapTemplateTx(mapTemplate: MapTemplate, schemaVersion: number): Promise<Transaction> {
        console.log('[MapAdmin] Building upload map template transaction...');
        console.log(`Template ID: ${mapTemplate.id}`);
        console.log(`Schema version: ${schemaVersion}`);
        console.log(`Tiles: ${mapTemplate.tiles_static.size}`);
        console.log(`Buildings: ${mapTemplate.buildings_static.size}`);
        console.log(`Hospital IDs: ${mapTemplate.hospital_ids.length}`);

        // 1. BCS 序列化（async）
        console.log('[MapAdmin] Encoding map template to BCS...');
        const encoded = await encodeMapTemplateToBCS(mapTemplate);

        console.log(`Encoded tiles: ${encoded.tilesBytes.length} bytes`);
        console.log(`Encoded buildings: ${encoded.buildingsBytes.length} bytes`);
        console.log(`Encoded hospital_ids: ${encoded.hospitalIdsBytes.length} bytes`);

        // 2. 构建交易
        const tx = new Transaction_!();

        tx.moveCall({
            target: `${this.packageId}::tycoon::publish_map_from_bcs`,
            arguments: [
                tx.object(this.gameDataId),                 // game_data: &mut GameData
                tx.pure.u8(schemaVersion),                  // schema_version: u8（从 GameData 获取）
                tx.pure.vector('u8', encoded.tilesBytes),   // tiles_bcs: vector<u8>
                tx.pure.vector('u8', encoded.buildingsBytes), // buildings_bcs: vector<u8>
                tx.pure.vector('u8', encoded.hospitalIdsBytes) // hospital_ids_bcs: vector<u8>
            ]
        });

        return tx;
    }

    // ============ 旧版本：直接签名执行（已弃用，保持兼容）============

    /**
     * 上传地图模板到链上
     * 使用 BCS 序列化传递复杂数据结构
     *
     * 对应Move: entry fun publish_map_from_bcs
     *
     * @param mapTemplate 编辑器生成的地图数据
     * @param keypair 签名密钥
     * @returns 交易哈希和模板ID
     * @deprecated 使用 buildUploadMapTemplateTx 代替
     */
    async uploadMapTemplate(
        mapTemplate: MapTemplate,
        keypair: Ed25519Keypair
    ): Promise<{
        txHash: string;
        templateId: string;
    }> {
        console.log('[MapAdmin] Starting map upload...');
        console.log(`Template ID: ${mapTemplate.id}`);
        console.log(`Tiles: ${mapTemplate.tiles_static.size}`);
        console.log(`Buildings: ${mapTemplate.buildings_static.size}`);
        console.log(`Hospital IDs: ${mapTemplate.hospital_ids.length}`);

        // 1. BCS 序列化（async）
        console.log('[MapAdmin] Encoding map template to BCS...');
        const encoded = await encodeMapTemplateToBCS(mapTemplate);

        console.log(`Encoded tiles: ${encoded.tilesBytes.length} bytes`);
        console.log(`Encoded buildings: ${encoded.buildingsBytes.length} bytes`);
        console.log(`Encoded hospital_ids: ${encoded.hospitalIdsBytes.length} bytes`);

        // 2. 构建交易
        const tx = new Transaction_!();

        tx.moveCall({
            target: `${this.packageId}::tycoon::publish_map_from_bcs`,
            arguments: [
                tx.object(this.gameDataId),                 // game_data: &mut GameData
                tx.pure.u8(mapTemplate.schema_version),     // schema_version: u8
                tx.pure.vector('u8', encoded.tilesBytes),   // tiles_bcs: vector<u8>
                tx.pure.vector('u8', encoded.buildingsBytes), // buildings_bcs: vector<u8>
                tx.pure.vector('u8', encoded.hospitalIdsBytes) // hospital_ids_bcs: vector<u8>
            ]
        });

        // 3. 执行交易
        console.log('[MapAdmin] Submitting transaction...');
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEffects: true,
                showEvents: true,
                showObjectChanges: true
            }
        });

        // 4. 检查执行结果
        if (result.effects?.status?.status !== 'success') {
            const error = result.effects?.status?.error || 'Unknown error';
            throw new Error(`Transaction failed: ${error}`);
        }

        console.log('[MapAdmin] Map template uploaded successfully!');
        console.log('Transaction digest:', result.digest);

        // 5. 解析事件（获取模板发布事件）
        const publishEvent = result.events?.find(e =>
            e.type.includes('MapTemplatePublishedEvent')
        );

        if (publishEvent) {
            console.log('MapTemplatePublished Event:', publishEvent.parsedJson);
        }

        return {
            txHash: result.digest,
            templateId: mapTemplate.id
        };
    }

    /**
     * 获取已发布的地图模板
     * @param templateId 模板ID
     */
    async getMapTemplate(templateId: string): Promise<MapTemplate | null> {
        try {
            // 这需要通过 GameData 对象的动态字段查询
            // 或通过事件索引器查询
            // 临时返回 null，等待实现
            console.log(`[MapAdmin] Getting map template ${templateId}...`);
            return null;
        } catch (error) {
            console.error('[MapAdmin] Failed to get map template:', error);
            return null;
        }
    }

    /**
     * 列出所有可用的地图模板
     */
    async listMapTemplates(): Promise<number[]> {
        try {
            // 通过事件查询所有 MapTemplatePublishedEvent
            // 临时返回空数组
            return [];
        } catch (error) {
            console.error('[MapAdmin] Failed to list map templates:', error);
            return [];
        }
    }
}
