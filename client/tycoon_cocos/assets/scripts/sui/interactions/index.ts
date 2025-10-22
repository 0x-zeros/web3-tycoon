/**
 * 交互函数统一导出
 */

export * from './game';
export * from './defi_rewards';

// 使用 import type 避免打包
import type { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { MapTemplate } from '../types/map';
import { GameInteraction } from './game';
import { loadSuiClient, loadSuiTransactions } from '../loader';

// 模块级缓存（由 initInteractions 初始化）
let Transaction_: typeof Transaction | null = null;

/**
 * 初始化交互模块（必须在使用前调用）
 */
export async function initInteractions(): Promise<void> {
    if (!Transaction_) {
        const { Transaction } = await loadSuiTransactions();
        Transaction_ = Transaction;
    }
}

// ===== Property Interactions 地产交互 =====

/**
 * 地产交互类
 */
export class PropertyInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string
    ) {}

    /**
     * 购买地产
     * 对应Move: 通过decision system处理
     */
    async buyProperty(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        keypair: Ed25519Keypair
    ): Promise<{ success: boolean; txHash: string }> {
        const tx = new Transaction_!();

        tx.moveCall({
            target: `${this.packageId}::game::decide_property_purchase`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId)
            ]
        });

        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair
        });

        return { success: true, txHash: result.digest };
    }

    /**
     * 升级地产
     * 对应Move: 通过decision system处理
     */
    async upgradeProperty(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        keypair: Ed25519Keypair
    ): Promise<{ success: boolean; txHash: string }> {
        const tx = new Transaction_!();

        tx.moveCall({
            target: `${this.packageId}::game::decide_property_upgrade`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId)
            ]
        });

        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair
        });

        return { success: true, txHash: result.digest };
    }
}

// ===== Card Interactions 卡牌交互 =====

/**
 * 卡牌交互类
 */
export class CardInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string,
        private randomObjectId: string = '0x8'
    ) {}

    /**
     * 使用卡牌
     * 对应Move: public entry fun use_card
     */
    async useCard(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        params: number[],
        keypair: Ed25519Keypair
    ): Promise<{ success: boolean; txHash: string }> {
        const tx = new Transaction_!();

        tx.moveCall({
            target: `${this.packageId}::game::use_card`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.u8(cardKind),
                tx.pure.vector('u16', params),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object(this.randomObjectId) // Random
            ]
        });

        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair
        });

        return { success: true, txHash: result.digest };
    }
}

// ===== Admin Interactions 管理交互 =====

/**
 * 管理交互类
 */
export class AdminInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string
    ) {}

    /**
     * 发布地图模板
     * 对应Move: public entry fun register_template
     */
    async publishMapTemplate(
        adminCap: string,
        template: {
            name: string;
            description: string;
            tiles: Array<{
                x: number;
                y: number;
                kind: number;
                property_id: number;
                special: bigint;
                cw_next: number;
                ccw_next: number;
                adj?: number[];
            }>;
            properties: Array<{
                kind: number;
                size: number;
                price: bigint;
                base_toll: bigint;
            }>;
            starting_tile: number;
            min_players: number;
            max_players: number;
        },
        keypair: Ed25519Keypair
    ): Promise<{ templateId: string; txHash: string }> {
        const tx = new Transaction_!();

        // 构建tiles向量
        const tileStructs = template.tiles.map(tile => {
            // 需要根据Move端的实际结构调整
            return tx.pure.vector('u8', [
                tile.x,
                tile.y,
                tile.kind,
                // ... 其他字段
            ]);
        });

        // 构建properties向量
        const propertyStructs = template.properties.map(prop => {
            return tx.pure.vector('u64', [
                prop.kind,
                prop.size,
                Number(prop.price),
                Number(prop.base_toll)
            ]);
        });

        tx.moveCall({
            target: `${this.packageId}::admin::register_template`,
            arguments: [
                tx.object(adminCap),
                tx.object(this.gameDataId),
                tx.pure.string(template.name),
                tx.pure.string(template.description),
                tx.pure.vector('vector<u8>', tileStructs),
                tx.pure.vector('vector<u64>', propertyStructs),
                tx.pure.u16(template.starting_tile),
                tx.pure.u8(template.min_players),
                tx.pure.u8(template.max_players)
            ]
        });

        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: { showEvents: true }
        });

        // 从事件中提取模板ID
        const templateId = this.extractTemplateId(result);

        return { templateId, txHash: result.digest };
    }

    private extractTemplateId(result: any): string {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('MapTemplatePublishedEvent')) {
                return event.parsedJson?.template_id || '0';
            }
        }
        return '0';
    }
}

// ===== Unified Game Client 统一游戏客户端 =====

/**
 * 统一的游戏客户端
 * 整合所有交互功能
 */
export class TycoonGameClient {
    public game: GameInteraction;
    public property: PropertyInteraction;
    public card: CardInteraction;
    public admin: AdminInteraction;

    constructor(
        client: SuiClient,
        packageId: string,
        gameDataId: string,
        randomObjectId: string = '0x8',
        clockObjectId: string = '0x6'
    ) {
        this.game = new GameInteraction(client, packageId, gameDataId, randomObjectId, clockObjectId);
        this.property = new PropertyInteraction(client, packageId, gameDataId);
        this.card = new CardInteraction(client, packageId, gameDataId, randomObjectId);
        this.admin = new AdminInteraction(client, packageId, gameDataId);
    }

    /**
     * 创建默认客户端
     */
    static async create(config: {
        network: 'testnet' | 'mainnet' | 'devnet' | string;
        packageId: string;
        gameDataId: string;
        randomObjectId?: string;
        clockObjectId?: string;
    }): Promise<TycoonGameClient> {
        const rpcUrl = typeof config.network === 'string' && config.network.startsWith('http')
            ? config.network
            : `https://fullnode.${config.network}.sui.io`;

        // 动态加载并创建 SuiClient
        const { SuiClient } = await loadSuiClient();
        const client = new SuiClient({ url: rpcUrl });
        return new TycoonGameClient(
            client,
            config.packageId,
            config.gameDataId,
            config.randomObjectId,
            config.clockObjectId
        );
    }
}