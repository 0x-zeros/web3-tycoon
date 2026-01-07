/**
 * 元数据服务
 *
 * 封装与Cloudflare Workers API的交互
 * 提供玩家、游戏房间、地图等元数据的CRUD操作
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { HttpClient } from './HttpClient';
import { CacheManager } from './CacheManager';
import {
    PlayerMetadata,
    GameRoomMetadata,
    MapMetadata,
    CreatePlayerRequest,
    UpdatePlayerRequest,
    CreateGameRoomRequest,
    UpdateGameRoomRequest,
    ListGamesRequest,
    ListGamesResponse,
    ListMapsRequest,
    ListMapsResponse
} from '../types/metadata';

/**
 * 元数据服务类
 * 管理所有链下元数据的获取和更新
 */
export class MetadataService {
    private httpClient: HttpClient;
    private cacheManager: CacheManager;

    constructor(httpClient: HttpClient, cacheManager: CacheManager) {
        this.httpClient = httpClient;
        this.cacheManager = cacheManager;
    }

    // ==================== 玩家元数据 ====================

    /**
     * 获取玩家元数据
     * @param address Sui地址
     * @returns 玩家元数据，不存在则返回null
     */
    public async getPlayer(address: string): Promise<PlayerMetadata | null> {
        const cacheKey = `player_${address}`;

        // 检查缓存
        const cached = this.cacheManager.get<PlayerMetadata>(cacheKey);
        if (cached) {
            console.log(`[MetadataService] 玩家元数据命中缓存: ${address}`);
            return cached;
        }

        // 远程获取
        try {
            const data = await this.httpClient.get<PlayerMetadata>(
                `/api/players/${address}`
            );

            // 缓存5分钟
            this.cacheManager.set(cacheKey, data, 300000);
            console.log(`[MetadataService] 获取玩家元数据成功: ${address}`);
            return data;
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('404')) {
                console.log(`[MetadataService] 玩家不存在: ${address}`);
                return null;
            }
            console.error(`[MetadataService] 获取玩家元数据失败: ${address}`, error);
            throw error;
        }
    }

    /**
     * 创建或更新玩家元数据
     */
    public async createOrUpdatePlayer(
        address: string,
        metadata: Partial<PlayerMetadata>
    ): Promise<PlayerMetadata> {
        try {
            const data = await this.httpClient.post<PlayerMetadata>(
                '/api/players',
                { address, ...metadata }
            );

            // 更新缓存
            const cacheKey = `player_${address}`;
            this.cacheManager.set(cacheKey, data, 300000);

            console.log(`[MetadataService] 创建/更新玩家元数据成功: ${address}`);
            return data;
        } catch (error) {
            console.error(`[MetadataService] 创建/更新玩家元数据失败: ${address}`, error);
            throw error;
        }
    }

    /**
     * 更新玩家元数据
     */
    public async updatePlayer(
        address: string,
        updates: UpdatePlayerRequest
    ): Promise<PlayerMetadata> {
        try {
            const data = await this.httpClient.put<PlayerMetadata>(
                `/api/players/${address}`,
                updates
            );

            // 更新缓存
            const cacheKey = `player_${address}`;
            this.cacheManager.set(cacheKey, data, 300000);

            console.log(`[MetadataService] 更新玩家元数据成功: ${address}`);
            return data;
        } catch (error) {
            console.error(`[MetadataService] 更新玩家元数据失败: ${address}`, error);
            throw error;
        }
    }

    // ==================== 游戏房间元数据 ====================

    /**
     * 获取游戏房间元数据
     */
    public async getGameRoom(gameId: string): Promise<GameRoomMetadata | null> {
        const cacheKey = `game_${gameId}`;

        // 检查缓存
        const cached = this.cacheManager.get<GameRoomMetadata>(cacheKey);
        if (cached) {
            console.log(`[MetadataService] 游戏房间元数据命中缓存: ${gameId}`);
            return cached;
        }

        // 远程获取
        try {
            const data = await this.httpClient.get<GameRoomMetadata>(
                `/api/games/${gameId}`
            );

            // 缓存1分钟（房间状态变化较快）
            this.cacheManager.set(cacheKey, data, 60000);
            console.log(`[MetadataService] 获取游戏房间元数据成功: ${gameId}`);
            return data;
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('404')) {
                console.log(`[MetadataService] 游戏房间不存在: ${gameId}`);
                return null;
            }
            console.error(`[MetadataService] 获取游戏房间元数据失败: ${gameId}`, error);
            throw error;
        }
    }

    /**
     * 创建游戏房间元数据
     */
    public async createGameRoom(
        request: CreateGameRoomRequest
    ): Promise<GameRoomMetadata> {
        try {
            const data = await this.httpClient.post<GameRoomMetadata>(
                '/api/games',
                request
            );

            // 缓存
            const cacheKey = `game_${request.gameId}`;
            this.cacheManager.set(cacheKey, data, 60000);

            console.log(`[MetadataService] 创建游戏房间元数据成功: ${request.gameId}`);
            return data;
        } catch (error) {
            console.error(`[MetadataService] 创建游戏房间元数据失败: ${request.gameId}`, error);
            throw error;
        }
    }

    /**
     * 更新游戏房间元数据
     */
    public async updateGameRoom(
        gameId: string,
        updates: UpdateGameRoomRequest
    ): Promise<GameRoomMetadata> {
        try {
            const data = await this.httpClient.put<GameRoomMetadata>(
                `/api/games/${gameId}`,
                updates
            );

            // 更新缓存
            const cacheKey = `game_${gameId}`;
            this.cacheManager.set(cacheKey, data, 60000);

            console.log(`[MetadataService] 更新游戏房间元数据成功: ${gameId}`);
            return data;
        } catch (error) {
            console.error(`[MetadataService] 更新游戏房间元数据失败: ${gameId}`, error);
            throw error;
        }
    }

    /**
     * 列出游戏房间
     */
    public async listGameRooms(filters?: ListGamesRequest): Promise<ListGamesResponse> {
        try {
            const queryParams = new URLSearchParams();

            if (filters?.status) queryParams.append('status', filters.status);
            if (filters?.host) queryParams.append('host', filters.host);
            if (filters?.limit) queryParams.append('limit', filters.limit.toString());
            if (filters?.offset) queryParams.append('offset', filters.offset.toString());

            const queryString = queryParams.toString();
            const url = `/api/games${queryString ? '?' + queryString : ''}`;

            const data = await this.httpClient.get<ListGamesResponse>(url);

            console.log(`[MetadataService] 列出游戏房间成功: ${data.games.length}个`);
            return data;
        } catch (error) {
            console.error(`[MetadataService] 列出游戏房间失败`, error);
            throw error;
        }
    }

    // ==================== 地图元数据 ====================

    /**
     * 获取地图元数据
     */
    public async getMap(templateId: string): Promise<MapMetadata | null> {
        const cacheKey = `map_${templateId}`;

        // 检查缓存
        const cached = this.cacheManager.get<MapMetadata>(cacheKey);
        if (cached) {
            console.log(`[MetadataService] 地图元数据命中缓存: ${templateId}`);
            return cached;
        }

        // 远程获取
        try {
            const data = await this.httpClient.get<MapMetadata>(
                `/api/maps/${templateId}`
            );

            // 缓存1小时（地图元数据变化很少）
            this.cacheManager.set(cacheKey, data, 3600000);
            console.log(`[MetadataService] 获取地图元数据成功: ${templateId}`);
            return data;
        } catch (error) {
            const err = error as Error;
            if (err.message.includes('404')) {
                console.log(`[MetadataService] 地图不存在: ${templateId}`);
                return null;
            }
            console.error(`[MetadataService] 获取地图元数据失败: ${templateId}`, error);
            throw error;
        }
    }

    /**
     * 列出地图
     */
    public async listMaps(filters?: ListMapsRequest): Promise<ListMapsResponse> {
        try {
            const queryParams = new URLSearchParams();

            if (filters?.creator) queryParams.append('creator', filters.creator);
            if (filters?.category) queryParams.append('category', filters.category);
            if (filters?.limit) queryParams.append('limit', filters.limit.toString());
            if (filters?.offset) queryParams.append('offset', filters.offset.toString());

            const queryString = queryParams.toString();
            const url = `/api/maps${queryString ? '?' + queryString : ''}`;

            const data = await this.httpClient.get<ListMapsResponse>(url);

            console.log(`[MetadataService] 列出地图成功: ${data.maps.length}个`);
            return data;
        } catch (error) {
            console.error(`[MetadataService] 列出地图失败`, error);
            throw error;
        }
    }

    // ==================== 缓存管理 ====================

    /**
     * 清除指定玩家的缓存
     */
    public clearPlayerCache(address: string): void {
        this.cacheManager.delete(`player_${address}`);
    }

    /**
     * 清除指定游戏的缓存
     */
    public clearGameCache(gameId: string): void {
        this.cacheManager.delete(`game_${gameId}`);
    }

    /**
     * 清除指定地图的缓存
     */
    public clearMapCache(templateId: string): void {
        this.cacheManager.delete(`map_${templateId}`);
    }

    /**
     * 清除所有元数据缓存
     */
    public clearAllCache(): void {
        this.cacheManager.clear('^(player_|game_|map_)');
    }
}
