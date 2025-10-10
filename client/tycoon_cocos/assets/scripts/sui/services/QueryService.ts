/**
 * Sui 查询服务
 * 封装链上数据查询逻辑
 */

import { SuiClient, SuiObjectResponse } from '@mysten/sui/client';
import type { Game, Player, Building, Tile } from '../types/game';
import type { MapTemplatePublishedEvent } from '../types/admin';
import { GameStatus } from '../types/constants';
import { GameData } from '../models/GameData';

/**
 * 游戏列表查询选项
 */
export interface GameQueryOptions {
    /** 游戏状态过滤 */
    status?: GameStatus;
    /** 最大返回数量 */
    limit?: number;
    /** 排序方式 */
    order?: 'ascending' | 'descending';
}

/**
 * 游戏列表项（带元数据）
 */
export interface GameListItem {
    game: Game;
    objectId: string;
    createdAt: number;
    isMyCreation: boolean;
}

/**
 * 查询服务类
 */
export class QueryService {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string
    ) {}

    /**
     * 获取 GameData 共享对象
     * @returns GameData 模型实例
     */
    async getGameData(): Promise<GameData | null> {
        try {
            const response = await this.client.getObject({
                id: this.gameDataId,
                options: {
                    showContent: true,
                    showType: true
                }
            });

            if (response.data?.content?.dataType === 'moveObject') {
                const fields = response.data.content.fields;
                return GameData.loadFromFields(fields);
            }

            return null;
        } catch (error) {
            console.error('[QueryService] Failed to get GameData:', error);
            return null;
        }
    }

    /**
     * 通过 Dynamic Fields 查询 Game 对象
     * 注意：这需要 GameData 使用 Table 或 ObjectTable 存储游戏
     */
    async queryGamesByDynamicFields(options?: GameQueryOptions): Promise<Game[]> {
        const games: Game[] = [];

        try {
            // TODO: 实现通过 dynamic fields 查询
            // 这需要知道 GameData 的具体存储结构
            console.warn('[QueryService] queryGamesByDynamicFields not implemented yet');
        } catch (error) {
            console.error('[QueryService] Failed to query games:', error);
        }

        return games;
    }

    /**
     * 查询所有 Game 类型的共享对象
     * 这是更通用的方法，但可能较慢
     */
    async queryAllGames(options: GameQueryOptions = {}): Promise<GameListItem[]> {
        const games: GameListItem[] = [];

        try {
            // 查询所有 Game 类型的对象
            const response = await this.client.queryEvents({
                query: {
                    MoveEventType: `${this.packageId}::events::GameCreatedEvent`
                },
                limit: options.limit || 50,
                order: options.order || 'descending'
            });

            console.log('[QueryService] queryAllGames num:', response.data.length);

            // 提取游戏 ID 并获取详情
            for (const event of response.data) {
                const eventData = event.parsedJson as any;
                const gameId = eventData.game;

                // console.log('[QueryService] GameCreatedEvent:', eventData);

                if (!gameId) continue;

                // 获取 Game 对象详情
                const game = await this.getGame(gameId);
                if (!game) 
                {
                    console.log('[QueryService] Game not found:', gameId);
                    continue;
                }

                // 过滤状态
                if (options.status !== undefined && game.status !== options.status) {
                    continue;
                }

                games.push({
                    game,
                    objectId: gameId,
                    createdAt: Number(event.timestampMs || 0),
                    isMyCreation: false  // 后续由调用者设置
                });
            }
        } catch (error) {
            console.error('[QueryService] Failed to query all games:', error);
        }

        return games;
    }

    /**
     * 查询所有 Game 类型的共享对象（批量版本，使用 multiGetObjects）
     * 性能优化：减少网络请求次数（50个游戏：从50次降为1次）
     */
    async queryAllGamesBatch(options: GameQueryOptions = {}): Promise<GameListItem[]> {
        const games: GameListItem[] = [];

        try {
            // 1. 查询所有 GameCreatedEvent
            const response = await this.client.queryEvents({
                query: {
                    MoveEventType: `${this.packageId}::events::GameCreatedEvent`
                },
                limit: options.limit || 50,
                order: options.order || 'descending'
            });

            console.log('[QueryService] queryAllGamesBatch num:', response.data.length);

            // 2. 提取所有 gameId 和 event 元数据
            const eventDataList = response.data
                .map(event => {
                    const eventData = event.parsedJson as any;
                    const gameId = eventData.game;
                    if (!gameId) return null;

                    return {
                        gameId,
                        createdAt: Number(event.timestampMs || 0),
                        creator: eventData.creator
                    };
                })
                .filter(item => item !== null) as Array<{
                    gameId: string;
                    createdAt: number;
                    creator: string;
                }>;

            if (eventDataList.length === 0) {
                return games;
            }

            // 3. 批量获取 Game 对象（关键优化点）
            const gameIds = eventDataList.map(item => item.gameId);
            console.log(`[QueryService] Fetching ${gameIds.length} games in batch...`);

            const gameResponses = await this.client.multiGetObjects({
                ids: gameIds,
                options: {
                    showContent: true,
                    showType: true
                }
            });

            // 4. 批量解析并组装结果
            for (let i = 0; i < gameResponses.length; i++) {
                const response = gameResponses[i];
                const eventData = eventDataList[i];

                const game = this.parseGameObject(response);
                if (!game) {
                    console.log('[QueryService] Game not found:', eventData.gameId);
                    continue;
                }

                // 过滤状态
                if (options.status !== undefined && game.status !== options.status) {
                    continue;
                }

                games.push({
                    game,
                    objectId: eventData.gameId,
                    createdAt: eventData.createdAt,
                    isMyCreation: false  // 后续由调用者设置
                });
            }

            console.log(`[QueryService] Batch query completed: ${games.length} games matched`);

            //1st game
            // console.log('[QueryService] 1st game:', games[0].game);

        } catch (error) {
            console.error('[QueryService] Failed to query all games (batch):', error);
        }

        return games;
    }

    /**
     * 获取单个游戏详情
     */
    async getGame(gameId: string): Promise<Game | null> {
        try {
            const response = await this.client.getObject({
                id: gameId,
                options: {
                    showContent: true,
                    showType: true
                }
            });

            if (response.data?.content?.dataType === 'moveObject') {
                return this.parseGameObject(response);
                // return response.data.content.fields;
            }

            return null;
        } catch (error) {
            console.error(`[QueryService] Failed to get game ${gameId}:`, error);
            return null;
        }
    }

    /**
     * 获取可加入的游戏列表（STATUS_READY）
     * @param myAddress 当前用户地址（用于标记自己创建的游戏）
     * @param limit 最大返回数量
     */
    async getReadyGames(myAddress?: string, limit: number = 50): Promise<GameListItem[]> {
        console.log('[QueryService] Querying READY games...');

        const games = await this.queryAllGames({
            status: GameStatus.READY,
            limit,
            order: 'descending'
        });

        // 标记自己创建的游戏
        if (myAddress) {
            for (const item of games) {
                // 检查创建者是否是自己（通过第一个玩家判断）
                if (item.game.players.length > 0) {
                    item.isMyCreation = item.game.players[0].owner === myAddress;
                }
            }
        }

        console.log(`[QueryService] Found ${games.length} READY games`);
        return games;
    }

    /**
     * 获取地图模板列表（通过事件查询）
     * 返回 MapTemplatePublishedEvent 数据，不查询完整对象
     */
    async getMapTemplates(): Promise<MapTemplatePublishedEvent[]> {
        const templates: MapTemplatePublishedEvent[] = [];

        try {
            // 通过 MapTemplatePublishedEvent 查询
            const response = await this.client.queryEvents({
                query: {
                    MoveEventType: `${this.packageId}::events::MapTemplatePublishedEvent`
                },
                limit: 50,
                order: 'descending'
            });

            for (const event of response.data) {
                const eventData = event.parsedJson as any;
                templates.push({
                    template_id: eventData.template_id || '',
                    publisher: eventData.publisher || '',
                    tile_count: eventData.tile_count || 0,
                    building_count: eventData.building_count || 0
                });
            }

            console.log(`[QueryService] Found ${templates.length} map templates`);
        } catch (error) {
            console.error('[QueryService] Failed to query map templates:', error);
        }

        return templates;
    }

    /**
     * 获取玩家拥有的所有 Seat
     */
    async getPlayerSeats(playerAddress: string): Promise<any[]> {
        try {
            const response = await this.client.getOwnedObjects({
                owner: playerAddress,
                filter: {
                    StructType: `${this.packageId}::game::Seat`
                },
                options: {
                    showContent: true,
                    showType: true
                }
            });

            return response.data.map(obj => {
                if (obj.data?.content?.dataType === 'moveObject') {
                    return obj.data.content.fields;
                }
                return null;
            }).filter(seat => seat !== null);
        } catch (error) {
            console.error('[QueryService] Failed to get player seats:', error);
            return [];
        }
    }

    // ============ 私有辅助方法 ============

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
     * 解析 Game 对象
     */
    private parseGameObject(response: SuiObjectResponse): Game | null {
        if (response.data?.content?.dataType !== 'moveObject') {
            return null;
        }

        const fields = response.data.content.fields as any;
        console.log('[QueryService] parseGameObject:', fields);

        
        try {
            return {
                id: fields.id?.id || response.data.objectId,
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
                npc_spawn_pool: fields.npc_spawn_pool || [],
                max_rounds: Number(fields.max_rounds) || 0,
                price_rise_days: Number(fields.price_rise_days) || 0,
                pending_decision: Number(fields.pending_decision) || 0,
                decision_tile: Number(fields.decision_tile) || 0,
                decision_amount: BigInt(fields.decision_amount || 0),
                winner: this.parseOption<string>(fields.winner)  // ✅ 修复 Option 类型解析
            };
        } catch (error) {
            console.error('[QueryService] Failed to parse game object:', error);
            console.error('  Raw fields:', fields);
            return null;
        }
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
                temple_levels: f.temple_levels || [],  // ✅ 添加 temple_levels
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
}
