/**
 * 地图管理交互
 * 封装地图上传到链上的逻辑
 *
 * Move源文件: move/tycoon/sources/tycoon.move
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { MapTemplate } from '../types/map';
import { encodeMapTemplateToBCS } from '../utils/mapBcsEncoder';

/**
 * 地图管理交互类
 */
export class MapAdminInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string
    ) {}

    /**
     * 上传地图模板到链上
     * 使用 BCS 序列化传递复杂数据结构
     *
     * 对应Move: entry fun create_map_from_bcs
     *
     * @param mapTemplate 编辑器生成的地图数据
     * @param adminCapId 管理员权限对象ID
     * @param keypair 签名密钥
     * @returns 交易哈希和模板ID
     */
    async uploadMapTemplate(
        mapTemplate: MapTemplate,
        adminCapId: string,
        keypair: Ed25519Keypair
    ): Promise<{
        txHash: string;
        templateId: number;
    }> {
        console.log('[MapAdmin] Starting map upload...');
        console.log(`Template ID: ${mapTemplate.id}`);
        console.log(`Tiles: ${mapTemplate.tiles_static.size}`);
        console.log(`Buildings: ${mapTemplate.buildings_static.size}`);
        console.log(`Hospital IDs: ${mapTemplate.hospital_ids.length}`);

        // 1. BCS 序列化
        console.log('[MapAdmin] Encoding map template to BCS...');
        const encoded = encodeMapTemplateToBCS(mapTemplate);

        console.log(`Encoded tiles: ${encoded.tilesBytes.length} bytes`);
        console.log(`Encoded buildings: ${encoded.buildingsBytes.length} bytes`);
        console.log(`Encoded hospital_ids: ${encoded.hospitalIdsBytes.length} bytes`);

        // 2. 构建交易
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::tycoon::create_map_from_bcs`,
            arguments: [
                tx.object(this.gameDataId),                 // game_data: &mut GameData
                tx.pure.u16(mapTemplate.id),                // template_id: u16
                tx.pure.vector('u8', encoded.tilesBytes),   // tiles_bcs: vector<u8>
                tx.pure.vector('u8', encoded.buildingsBytes), // buildings_bcs: vector<u8>
                tx.pure.vector('u8', encoded.hospitalIdsBytes), // hospital_ids_bcs: vector<u8>
                tx.object(adminCapId)                       // _admin: &AdminCap
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
    async getMapTemplate(templateId: number): Promise<MapTemplate | null> {
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
