/**
 * 游戏交互函数封装
 * 封装与Move合约的游戏相关交互逻辑
 *
 * Move源文件: move/tycoon/sources/game.move
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Game, GameCreateConfig, Seat } from '../types/game';

/**
 * 游戏交互类
 */
export class GameInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string  // GameData共享对象ID
    ) {}

    // ============ 新版本：返回 Transaction（推荐使用）============

    /**
     * 构建创建游戏的交易
     * @param config 游戏创建配置
     * @param senderAddress 发送者地址（用于 transferObjects）
     * @returns Transaction 对象
     */
    buildCreateGameTx(config: GameCreateConfig, senderAddress: string): Transaction {
        const tx = new Transaction();

        // 构建 params 向量（根据 Move 端的 parse_game_params）
        // params[0] = starting_cash
        // params[1] = price_rise_days
        // params[2] = max_rounds
        // 注意：上层 SuiManager 已确保传入正确的默认值，这里直接使用
        const params = [
            Number(config.starting_cash),     // 上层已填充 GameData.starting_cash
            config.price_rise_days,           // 上层已填充 15
            config.max_rounds                 // 上层已填充 0
        ];

        console.log('[GameInteraction] buildCreateGameTx params:', params);
        console.log('  starting_cash:', config.starting_cash);

        // 调用 create_game 函数（entry fun，不返回值）
        // 合约内部已处理 share_object 和 transfer
        tx.moveCall({
            target: `${this.packageId}::game::create_game`,
            arguments: [
                tx.object(this.gameDataId),           // game_data: &GameData
                tx.object(config.template_map_id),    // map: &MapTemplate
                tx.pure.vector('u64', params)         // params: vector<u64>
            ]
        });

        // entry fun 内部已调用：
        // - transfer::share_object(game)
        // - transfer::transfer(seat, creator)
        // 所以不需要手动处理

        return tx;
    }

    /**
     * 构建加入游戏的交易
     * @param gameId 游戏 ID
     * @param senderAddress 发送者地址
     * @returns Transaction 对象
     */
    buildJoinGameTx(gameId: string, senderAddress: string): Transaction {
        const tx = new Transaction();

        // 调用join函数
        const seat = tx.moveCall({
            target: `${this.packageId}::game::join`,
            arguments: [
                tx.object(gameId),       // game: &mut Game
                tx.object(this.gameDataId) // game_data: &GameData
            ]
        });

        // 将座位转移给加入者
        tx.transferObjects([seat], senderAddress);

        return tx;
    }

    /**
     * 构建开始游戏的交易
     * @param gameId 游戏 ID
     * @param mapTemplateId 地图模板 ID
     * @returns Transaction 对象
     */
    buildStartGameTx(gameId: string, mapTemplateId: string): Transaction {
        const tx = new Transaction();

        // 调用start函数
        tx.moveCall({
            target: `${this.packageId}::game::start`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(this.gameDataId), // game_data: &GameData
                tx.object(mapTemplateId),   // map: &MapTemplate
                tx.object('0x8'),           // random: &Random
                tx.object('0x6')            // clock: &Clock
            ]
        });

        return tx;
    }

    // ============ 旧版本：直接签名执行（已弃用，保持兼容）============

    /**
     * 创建游戏
     * 对应Move: public entry fun create_game
     */
    async createGame(
        config: GameCreateConfig,
        keypair: Ed25519Keypair
    ): Promise<{
        gameId: string;
        seatId: string;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用create_game函数
        const [game, seat] = tx.moveCall({
            target: `${this.packageId}::game::create_game`,
            arguments: [
                tx.object(this.gameDataId),              // game_data: &GameData
                tx.object(config.template_map_id),       // template_map: &MapTemplate
                tx.pure.u8(config.max_players),          // max_players: u8
                tx.pure.u64(config.starting_cash || 0),  // starting_cash: u64 (0使用默认值)
                tx.pure.u8(config.price_rise_days || 0), // price_rise_days: u8
                tx.pure.u8(config.max_rounds || 0)       // max_rounds: u8
            ]
        });

        // 分享游戏对象
        tx.moveCall({
            target: '0x2::transfer::public_share_object',
            typeArguments: [`${this.packageId}::game::Game`],
            arguments: [game]
        });

        // 将座位转移给创建者
        tx.transferObjects([seat], keypair.toSuiAddress());

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showObjectChanges: true,
                showEvents: true
            }
        });

        // 解析结果
        const gameId = this.extractObjectId(result, 'Game');
        const seatId = this.extractObjectId(result, 'Seat');

        return {
            gameId,
            seatId,
            txHash: result.digest
        };
    }

    /**
     * 加入游戏
     * 对应Move: public entry fun join
     */
    async joinGame(
        gameId: string,
        keypair: Ed25519Keypair
    ): Promise<{
        seatId: string;
        playerIndex: number;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用join函数
        const seat = tx.moveCall({
            target: `${this.packageId}::game::join`,
            arguments: [
                tx.object(gameId),       // game: &mut Game
                tx.object(this.gameDataId) // game_data: &GameData
            ]
        });

        // 将座位转移给加入者
        tx.transferObjects([seat], keypair.toSuiAddress());

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showObjectChanges: true,
                showEvents: true
            }
        });

        // 解析结果
        const seatId = this.extractObjectId(result, 'Seat');
        const playerIndex = this.extractPlayerIndex(result);

        return {
            seatId,
            playerIndex,
            txHash: result.digest
        };
    }

    /**
     * 开始游戏
     * 对应Move: public entry fun start
     */
    async startGame(
        gameId: string,
        mapTemplateId: string,
        keypair: Ed25519Keypair
    ): Promise<{
        success: boolean;
        startingPlayer: string;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用start函数
        tx.moveCall({
            target: `${this.packageId}::game::start`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(this.gameDataId), // game_data: &GameData
                tx.object(mapTemplateId),   // map: &MapTemplate
                tx.object('0x8'),           // random: &Random
                tx.object('0x6')            // clock: &Clock
            ]
        });

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEvents: true
            }
        });

        // 解析事件获取起始玩家
        const startingPlayer = this.extractStartingPlayer(result);

        return {
            success: true,
            startingPlayer,
            txHash: result.digest
        };
    }

    /**
     * 获取游戏状态
     */
    async getGameState(gameId: string): Promise<Game | null> {
        try {
            const object = await this.client.getObject({
                id: gameId,
                options: {
                    showContent: true,
                    showType: true
                }
            });

            if (object.data?.content?.dataType === 'moveObject') {
                return this.parseGameObject(object.data.content.fields);
            }

            return null;
        } catch (error) {
            console.error('Failed to get game state:', error);
            return null;
        }
    }

    /**
     * 获取座位信息
     */
    async getSeatInfo(seatId: string): Promise<Seat | null> {
        try {
            const object = await this.client.getObject({
                id: seatId,
                options: {
                    showContent: true
                }
            });

            if (object.data?.content?.dataType === 'moveObject') {
                return this.parseSeatObject(object.data.content.fields);
            }

            return null;
        } catch (error) {
            console.error('Failed to get seat info:', error);
            return null;
        }
    }

    /**
     * 获取玩家的座位
     */
    async getPlayerSeat(
        playerAddress: string,
        gameId: string
    ): Promise<Seat | null> {
        try {
            // 获取玩家拥有的所有对象
            const objects = await this.client.getOwnedObjects({
                owner: playerAddress,
                filter: {
                    StructType: `${this.packageId}::game::Seat`
                },
                options: {
                    showContent: true
                }
            });

            // 查找对应游戏的座位
            for (const obj of objects.data) {
                if (obj.data?.content?.dataType === 'moveObject') {
                    const seat = this.parseSeatObject(obj.data.content.fields);
                    if (seat && seat.game === gameId) {
                        return seat;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Failed to get player seat:', error);
            return null;
        }
    }

    /**
     * 获取所有可加入的游戏
     */
    async getAvailableGames(): Promise<Game[]> {
        // 这需要通过事件或索引器来实现
        // 临时返回空数组
        return [];
    }

    // ===== 辅助函数 =====

    /**
     * 从交易结果中提取对象ID
     */
    private extractObjectId(result: any, objectType: string): string {
        const changes = result.objectChanges || [];
        for (const change of changes) {
            if (change.type === 'created' && change.objectType?.includes(objectType)) {
                return change.objectId;
            }
        }
        throw new Error(`Failed to extract ${objectType} ID from transaction`);
    }

    /**
     * 从交易结果中提取玩家索引
     */
    private extractPlayerIndex(result: any): number {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('PlayerJoinedEvent')) {
                return event.parsedJson?.player_index || 0;
            }
        }
        return 0;
    }

    /**
     * 从交易结果中提取起始玩家
     */
    private extractStartingPlayer(result: any): string {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('GameStartedEvent')) {
                return event.parsedJson?.starting_player || '';
            }
        }
        return '';
    }

    /**
     * 解析游戏对象
     */
    private parseGameObject(fields: any): Game {
        // 这里需要根据实际的对象结构进行解析
        // 临时返回一个简化的结构
        return {
            id: fields.id?.id || '',
            status: fields.status || 0,
            template_map_id: fields.template_map_id || '',
            players: fields.players || [],
            round: fields.round || 0,
            turn: fields.turn || 0,
            active_idx: fields.active_idx || 0,
            has_rolled: fields.has_rolled || false,
            tiles: fields.tiles || [],
            buildings: fields.buildings || [],
            npc_on: new Map(),
            owner_index: new Map(),
            npc_spawn_pool: fields.npc_spawn_pool || [],
            max_rounds: fields.max_rounds || 0,
            price_rise_days: fields.price_rise_days || 0,
            pending_decision: fields.pending_decision || 0,
            decision_tile: fields.decision_tile || 0,
            decision_amount: BigInt(fields.decision_amount || 0),
            winner: fields.winner
        };
    }

    /**
     * 解析座位对象
     */
    private parseSeatObject(fields: any): Seat {
        return {
            id: fields.id?.id || '',
            game: fields.game || '',
            player: fields.player || '',
            player_index: fields.player_index || 0
        };
    }
}