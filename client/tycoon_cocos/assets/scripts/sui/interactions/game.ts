/**
 * 游戏交互函数封装
 * 封装与Move合约的游戏相关交互逻辑
 *
 * Move源文件: move/tycoon/sources/game.move
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Game, Player, Building, Tile, GameCreateConfig, Seat } from '../types/game';

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
     * @returns Transaction 对象
     */
    buildJoinGameTx(gameId: string): Transaction {
        const tx = new Transaction();

        // 调用 join 函数（entry fun，不返回值）
        // 合约内部已处理 transfer::transfer(seat, player_addr)
        tx.moveCall({
            target: `${this.packageId}::game::join`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(this.gameDataId)  // game_data: &GameData
            ]
        });

        // entry fun 内部已调用：
        // - transfer::transfer(seat, player_addr)
        // 所以不需要手动 transferObjects

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


    /**
     * 获取游戏状态
     */
    async getGameState(gameId: string): Promise<Game | null> {
        try {
            console.log('[Game] getGameState gameId:', gameId);
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
     * 解析 ID 类型（可能是字符串或对象 { bytes: "0x..." }）
     */
    private parseID(value: any): string {
        if (typeof value === 'string') return value;
        if (value?.bytes) return value.bytes;
        if (value?.id) return value.id;  // 某些情况下可能嵌套在 id 字段中
        return '';
    }

    /**
     * 解析 Option 类型（格式: { vec: [] } 或 { vec: [value] }）
     */
    private parseOption<T>(value: any): T | undefined {
        if (!value) return undefined;
        if (value.vec && Array.isArray(value.vec)) {
            return value.vec.length > 0 ? value.vec[0] : undefined;
        }
        return undefined;
    }

    /**
     * 解析游戏对象
     */
    private parseGameObject(fields: any): Game {
        return {
            id: fields.id?.id || '',
            status: Number(fields.status) || 0,
            template_map_id: this.parseID(fields.template_map_id),  // ✅ 修复 ID 类型解析
            players: this.parsePlayers(fields.players || []),
            round: Number(fields.round) || 0,
            turn: Number(fields.turn) || 0,
            active_idx: Number(fields.active_idx) || 0,
            has_rolled: Boolean(fields.has_rolled),
            tiles: this.parseTiles(fields.tiles || []),
            buildings: this.parseBuildings(fields.buildings || []),
            npc_on: new Map(),  // Table 类型，保持空 Map
            owner_index: new Map(),  // Table 类型，保持空 Map
            npc_spawn_pool: fields.npc_spawn_pool || [],
            max_rounds: Number(fields.max_rounds) || 0,
            price_rise_days: Number(fields.price_rise_days) || 0,
            pending_decision: Number(fields.pending_decision) || 0,
            decision_tile: Number(fields.decision_tile) || 0,
            decision_amount: BigInt(fields.decision_amount || 0),
            winner: this.parseOption<string>(fields.winner)  // ✅ 修复 Option 类型解析
        };
    }

    /**
     * 解析玩家列表
     */
    private parsePlayers(playersData: any[]): Player[] {
        return playersData.map((p: any): Player => {
            const f = p.fields || p;
            return {
                owner: f.owner || '',
                pos: Number(f.pos) || 0,
                cash: BigInt(f.cash || 0),
                bankrupt: Boolean(f.bankrupt),
                in_hospital_turns: Number(f.in_hospital_turns) || 0,
                in_prison_turns: Number(f.in_prison_turns) || 0,
                last_tile_id: Number(f.last_tile_id) || 0,
                next_tile_id: Number(f.next_tile_id) || 0,
                buffs: f.buffs || [],
                cards: new Map()  // Table 类型，保持空 Map
            };
        });
    }

    /**
     * 解析地块列表
     */
    private parseTiles(tilesData: any[]): Tile[] {
        return tilesData.map((t: any): Tile => {
            const f = t.fields || t;
            return {
                npc_on: Number(f.npc_on) || 0
            };
        });
    }

    /**
     * 解析建筑列表
     */
    private parseBuildings(buildingsData: any[]): Building[] {
        return buildingsData.map((b: any): Building => {
            const f = b.fields || b;
            return {
                owner: Number(f.owner),
                level: Number(f.level) || 0,
                building_type: Number(f.building_type) || 0
            };
        });
    }

    /**
     * 解析座位对象
     */
    private parseSeatObject(fields: any): Seat {
        return {
            id: fields.id?.id || '',
            game: this.parseID(fields.game),  // ✅ 修复 ID 类型解析
            player: fields.player || '',
            player_index: Number(fields.player_index) || 0
        };
    }
}