/**
 * Profile 服务
 *
 * 与链上 tycoon_profiles 合约交互的服务层
 * 提供 PlayerProfile、GameProfile、MapProfile 的 CRUD 操作
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { SuiClient, SuiObjectResponse, SuiMoveObject, EventId } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { SuiManager } from '../managers/SuiManager';
import { PlayerProfile, GameProfile, MapProfile } from '../types/profile';

/**
 * 缓存条目
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

/**
 * Profile 服务
 * 管理链上 Profile 数据的查询和创建
 */
export class ProfileService {
    private static _instance: ProfileService | null = null;

    /** 缓存有效期 (5分钟) */
    private static readonly CACHE_TTL = 5 * 60 * 1000;

    /** PlayerProfile 缓存 (address -> profile) */
    private playerProfileCache = new Map<string, CacheEntry<PlayerProfile | null>>();

    /** GameProfile 缓存 (gameId -> profile) */
    private gameProfileCache = new Map<string, CacheEntry<GameProfile | null>>();

    /** MapProfile 缓存 (mapId -> profile) */
    private mapProfileCache = new Map<string, CacheEntry<MapProfile | null>>();

    /** Game/Map ID -> Profile ID 索引（从事件建立） */
    private gameProfileIndex = new Map<string, string>();
    private mapProfileIndex = new Map<string, string>();

    /** profiles package ID */
    private packageId: string = '';

    private constructor() {}

    /**
     * 获取单例实例
     */
    public static get instance(): ProfileService {
        if (!ProfileService._instance) {
            ProfileService._instance = new ProfileService();
        }
        return ProfileService._instance;
    }

    /**
     * 初始化服务
     * @param packageId tycoon_profiles 合约的 package ID
     */
    public initialize(packageId: string): void {
        this.packageId = packageId;
        console.log('[ProfileService] 初始化完成, packageId:', packageId);
    }

    /**
     * 获取 Sui 客户端
     */
    private getClient(): SuiClient {
        return SuiManager.instance.client;
    }

    /**
     * 检查缓存是否有效
     */
    private isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
        if (!entry) return false;
        return Date.now() - entry.timestamp < ProfileService.CACHE_TTL;
    }

    // ==================== PlayerProfile ====================

    /**
     * 获取玩家档案
     * 通过 getOwnedObjects 查询指定地址拥有的 PlayerProfile
     * @param address 钱包地址
     * @returns PlayerProfile 或 null
     */
    public async getPlayerProfile(address: string): Promise<PlayerProfile | null> {
        // 检查缓存
        const cached = this.playerProfileCache.get(address);
        if (this.isCacheValid(cached)) {
            console.log('[ProfileService] PlayerProfile 缓存命中:', address);
            return cached!.data;
        }

        try {
            const client = this.getClient();
            const profileType = `${this.packageId}::player_profile::PlayerProfile`;

            // 查询该地址拥有的 PlayerProfile 对象
            const response = await client.getOwnedObjects({
                owner: address,
                filter: {
                    StructType: profileType
                },
                options: {
                    showContent: true
                }
            });

            if (response.data.length === 0) {
                console.log('[ProfileService] 玩家档案不存在:', address);
                this.playerProfileCache.set(address, { data: null, timestamp: Date.now() });
                return null;
            }

            // 取第一个（每个地址应该只有一个 PlayerProfile）
            const obj = response.data[0];
            const profile = this.parsePlayerProfile(obj);

            if (profile) {
                this.playerProfileCache.set(address, { data: profile, timestamp: Date.now() });
                console.log('[ProfileService] 获取玩家档案成功:', address, profile.name);
            }

            return profile;

        } catch (error) {
            console.error('[ProfileService] 获取玩家档案失败:', address, error);
            return null;
        }
    }

    /**
     * 创建玩家档案
     * @param name 昵称 (1-32 字符)
     * @param avatar 头像索引 (0-255)
     * @returns 创建的 Profile ID（从事件中提取）
     */
    public async createPlayerProfile(name: string, avatar: number): Promise<string> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::player_profile::create_profile`,
            arguments: [
                tx.pure.string(name),
                tx.pure.u8(avatar)
            ]
        });

        const result = await SuiManager.instance.signAndExecuteTransaction(tx);

        // 清除缓存
        const address = SuiManager.instance.currentAddress;
        if (address) {
            this.playerProfileCache.delete(address);
        }

        // 从事件中提取 Profile ID
        const profileId = this.extractProfileIdFromEvents(result.events, 'PlayerProfileCreatedEvent');
        console.log('[ProfileService] 创建玩家档案成功:', profileId || result.digest);
        return profileId || result.digest;
    }

    /**
     * 更新玩家昵称
     * @param profileId Profile 对象 ID
     * @param name 新昵称
     */
    public async updatePlayerName(profileId: string, name: string): Promise<void> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::player_profile::update_name`,
            arguments: [
                tx.object(profileId),
                tx.pure.string(name)
            ]
        });

        await SuiManager.instance.signAndExecuteTransaction(tx);

        // 清除缓存
        const address = SuiManager.instance.currentAddress;
        if (address) {
            this.playerProfileCache.delete(address);
        }

        console.log('[ProfileService] 更新玩家昵称成功');
    }

    /**
     * 更新玩家头像
     * @param profileId Profile 对象 ID
     * @param avatar 新头像索引
     */
    public async updatePlayerAvatar(profileId: string, avatar: number): Promise<void> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::player_profile::update_avatar`,
            arguments: [
                tx.object(profileId),
                tx.pure.u8(avatar)
            ]
        });

        await SuiManager.instance.signAndExecuteTransaction(tx);

        // 清除缓存
        const address = SuiManager.instance.currentAddress;
        if (address) {
            this.playerProfileCache.delete(address);
        }

        console.log('[ProfileService] 更新玩家头像成功');
    }

    // ==================== GameProfile ====================

    /**
     * 获取游戏档案
     * @param gameId Game 对象 ID
     * @returns GameProfile 或 null
     */
    public async getGameProfile(gameId: string): Promise<GameProfile | null> {
        // 检查缓存
        const cached = this.gameProfileCache.get(gameId);
        if (this.isCacheValid(cached)) {
            console.log('[ProfileService] GameProfile 缓存命中:', gameId);
            return cached!.data;
        }

        // 检查索引
        const profileId = this.gameProfileIndex.get(gameId);
        if (profileId) {
            const profile = await this.getGameProfileById(profileId);
            if (profile) {
                this.gameProfileCache.set(gameId, { data: profile, timestamp: Date.now() });
                return profile;
            }
        }

        // 索引未命中，尝试从链上事件回填
        console.log('[ProfileService] GameProfile 不在索引中，尝试链上回填:', gameId);
        const backfilledProfileId = await this.queryProfileFromEvents(gameId, 'GameProfileCreatedEvent', 'game_id');
        if (backfilledProfileId) {
            this.registerGameProfileIndex(gameId, backfilledProfileId);
            const profile = await this.getGameProfileById(backfilledProfileId);
            if (profile) {
                this.gameProfileCache.set(gameId, { data: profile, timestamp: Date.now() });
                return profile;
            }
        }

        this.gameProfileCache.set(gameId, { data: null, timestamp: Date.now() });
        return null;
    }

    /**
     * 通过 Profile ID 获取 GameProfile
     */
    private async getGameProfileById(profileId: string): Promise<GameProfile | null> {
        try {
            const client = this.getClient();
            const response = await client.getObject({
                id: profileId,
                options: { showContent: true }
            });

            return this.parseGameProfile(response);

        } catch (error) {
            console.error('[ProfileService] 获取 GameProfile 失败:', profileId, error);
            return null;
        }
    }

    /**
     * 创建游戏档案
     * @param gameId Game 对象 ID
     * @param name 游戏名称 (1-64 字符)
     * @returns 创建的 Profile ID（从事件中提取）
     */
    public async createGameProfile(gameId: string, name: string): Promise<string> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game_profile::create_game_profile`,
            arguments: [
                tx.pure.id(gameId),
                tx.pure.string(name)
            ]
        });

        const result = await SuiManager.instance.signAndExecuteTransaction(tx);

        // 从事件中提取 Profile ID 并注册索引
        const profileId = this.extractProfileIdFromEvents(result.events, 'GameProfileCreatedEvent');
        if (profileId) {
            this.registerGameProfileIndex(gameId, profileId);
        }

        console.log('[ProfileService] 创建游戏档案成功:', profileId || result.digest);
        return profileId || result.digest;
    }

    /**
     * 更新游戏名称
     * @param profileId Profile 对象 ID
     * @param name 新名称
     */
    public async updateGameName(profileId: string, name: string): Promise<void> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game_profile::update_name`,
            arguments: [
                tx.object(profileId),
                tx.pure.string(name)
            ]
        });

        await SuiManager.instance.signAndExecuteTransaction(tx);

        // 清除缓存（因为不知道 game_id，清除所有 game profile 缓存）
        this.gameProfileCache.clear();

        console.log('[ProfileService] 更新游戏名称成功');
    }

    /**
     * 注册 Game -> Profile 索引
     * 通过事件处理器调用，建立 gameId -> profileId 的映射
     */
    public registerGameProfileIndex(gameId: string, profileId: string): void {
        this.gameProfileIndex.set(gameId, profileId);
        this.gameProfileCache.delete(gameId); // 清除缓存，下次查询时重新加载
        console.log('[ProfileService] 注册 GameProfile 索引:', gameId, '->', profileId);
    }

    // ==================== MapProfile ====================

    /**
     * 获取地图档案
     * @param mapId MapTemplate 对象 ID
     * @returns MapProfile 或 null
     */
    public async getMapProfile(mapId: string): Promise<MapProfile | null> {
        // 检查缓存
        const cached = this.mapProfileCache.get(mapId);
        if (this.isCacheValid(cached)) {
            console.log('[ProfileService] MapProfile 缓存命中:', mapId);
            return cached!.data;
        }

        // 检查索引
        const profileId = this.mapProfileIndex.get(mapId);
        if (profileId) {
            const profile = await this.getMapProfileById(profileId);
            if (profile) {
                this.mapProfileCache.set(mapId, { data: profile, timestamp: Date.now() });
                return profile;
            }
        }

        // 索引未命中，尝试从链上事件回填
        console.log('[ProfileService] MapProfile 不在索引中，尝试链上回填:', mapId);
        const backfilledProfileId = await this.queryProfileFromEvents(mapId, 'MapProfileCreatedEvent', 'map_id');
        if (backfilledProfileId) {
            this.registerMapProfileIndex(mapId, backfilledProfileId);
            const profile = await this.getMapProfileById(backfilledProfileId);
            if (profile) {
                this.mapProfileCache.set(mapId, { data: profile, timestamp: Date.now() });
                return profile;
            }
        }

        this.mapProfileCache.set(mapId, { data: null, timestamp: Date.now() });
        return null;
    }

    /**
     * 通过 Profile ID 获取 MapProfile
     */
    private async getMapProfileById(profileId: string): Promise<MapProfile | null> {
        try {
            const client = this.getClient();
            const response = await client.getObject({
                id: profileId,
                options: { showContent: true }
            });

            return this.parseMapProfile(response);

        } catch (error) {
            console.error('[ProfileService] 获取 MapProfile 失败:', profileId, error);
            return null;
        }
    }

    /**
     * 创建地图档案
     * @param mapId MapTemplate 对象 ID
     * @param name 地图名称 (1-64 字符)
     * @param description 地图描述 (0-256 字符)
     * @returns 创建的 Profile ID（从事件中提取）
     */
    public async createMapProfile(mapId: string, name: string, description: string): Promise<string> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::map_profile::create_map_profile`,
            arguments: [
                tx.pure.id(mapId),
                tx.pure.string(name),
                tx.pure.string(description)
            ]
        });

        const result = await SuiManager.instance.signAndExecuteTransaction(tx);

        // 从事件中提取 Profile ID 并注册索引
        const profileId = this.extractProfileIdFromEvents(result.events, 'MapProfileCreatedEvent');
        if (profileId) {
            this.registerMapProfileIndex(mapId, profileId);
        }

        console.log('[ProfileService] 创建地图档案成功:', profileId || result.digest);
        return profileId || result.digest;
    }

    /**
     * 更新地图名称
     * @param profileId Profile 对象 ID
     * @param name 新名称
     */
    public async updateMapName(profileId: string, name: string): Promise<void> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::map_profile::update_name`,
            arguments: [
                tx.object(profileId),
                tx.pure.string(name)
            ]
        });

        await SuiManager.instance.signAndExecuteTransaction(tx);

        // 清除缓存（因为不知道 map_id，清除所有 map profile 缓存）
        this.mapProfileCache.clear();

        console.log('[ProfileService] 更新地图名称成功');
    }

    /**
     * 更新地图描述
     * @param profileId Profile 对象 ID
     * @param description 新描述
     */
    public async updateMapDescription(profileId: string, description: string): Promise<void> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::map_profile::update_description`,
            arguments: [
                tx.object(profileId),
                tx.pure.string(description)
            ]
        });

        await SuiManager.instance.signAndExecuteTransaction(tx);

        // 清除缓存（因为不知道 map_id，清除所有 map profile 缓存）
        this.mapProfileCache.clear();

        console.log('[ProfileService] 更新地图描述成功');
    }

    /**
     * 注册 Map -> Profile 索引
     * 通过事件处理器调用，建立 mapId -> profileId 的映射
     */
    public registerMapProfileIndex(mapId: string, profileId: string): void {
        this.mapProfileIndex.set(mapId, profileId);
        this.mapProfileCache.delete(mapId);
        console.log('[ProfileService] 注册 MapProfile 索引:', mapId, '->', profileId);
    }

    // ==================== 辅助方法 ====================

    /**
     * 规范化 ID 格式
     * 处理可能是对象或字符串的 ID
     */
    private normalizeId(id: any): string {
        if (typeof id === 'string') {
            return id;
        }
        if (typeof id === 'object') {
            if (id.id) return id.id;
            if (id.bytes) return id.bytes;
        }
        return String(id);
    }

    /**
     * 从链上事件查询 Profile ID（回填机制）
     * 当索引未命中时，通过遍历历史事件找到匹配的 profile
     *
     * @param targetId 目标 ID（game_id 或 map_id）
     * @param eventTypeName 事件类型名称
     * @param idFieldName 事件中的 ID 字段名
     * @returns Profile ID 或 null
     */
    private async queryProfileFromEvents(
        targetId: string,
        eventTypeName: 'GameProfileCreatedEvent' | 'MapProfileCreatedEvent',
        idFieldName: 'game_id' | 'map_id'
    ): Promise<string | null> {
        // 检查服务是否已初始化
        if (!this.packageId) {
            console.log('[ProfileService] 服务未初始化，跳过链上回填');
            return null;
        }

        try {
            const client = this.getClient();
            const fullType = `${this.packageId}::events::${eventTypeName}`;

            // 分页查询所有事件
            let cursor: EventId | null | undefined = undefined;
            let hasNextPage = true;
            let pageCount = 0;
            const maxPages = 100;  // 防止无限循环
            const pageLimit = 50;

            while (hasNextPage && pageCount < maxPages) {
                const res = await client.queryEvents({
                    query: { MoveEventType: fullType },
                    order: 'descending',
                    limit: pageLimit,
                    cursor
                });

                // 在当前页查找匹配
                for (const event of res.data) {
                    const json = event.parsedJson as any;
                    if (!json) continue;

                    const eventTargetId = this.normalizeId(json[idFieldName]);
                    if (eventTargetId === targetId) {
                        const profileId = this.normalizeId(json.profile_id);
                        console.log('[ProfileService] 链上回填成功:', targetId, '->', profileId);
                        return profileId;
                    }
                }

                hasNextPage = res.hasNextPage;
                cursor = res.nextCursor ?? undefined;
                pageCount++;

                // 防止 nextCursor 为空时无限循环
                if (hasNextPage && !cursor) {
                    console.warn('[ProfileService] hasNextPage=true 但 nextCursor 为空，终止分页');
                    break;
                }
            }

            if (pageCount >= maxPages) {
                console.warn('[ProfileService] 达到最大页数限制:', maxPages);
            }

            console.log('[ProfileService] 遍历事件未找到匹配:', targetId, `(${pageCount} 页)`);
            return null;

        } catch (error) {
            console.error('[ProfileService] 链上查询失败:', error);
            return null;
        }
    }

    /**
     * 从交易事件中提取 Profile ID
     * @param events 交易事件列表
     * @param eventTypeName 事件类型名称（如 'PlayerProfileCreatedEvent'）
     * @returns Profile ID 或 null
     */
    private extractProfileIdFromEvents(events: any[] | undefined, eventTypeName: string): string | null {
        if (!events || events.length === 0) {
            return null;
        }

        const event = events.find(e => e.type?.includes(eventTypeName));
        if (!event?.parsedJson) {
            return null;
        }

        const profileId = event.parsedJson.profile_id;
        if (!profileId) {
            return null;
        }

        // 规范化 ID（可能是对象或字符串）
        if (typeof profileId === 'string') {
            return profileId;
        }
        if (typeof profileId === 'object') {
            if (profileId.id) return profileId.id;
            if (profileId.bytes) return profileId.bytes;
        }

        return null;
    }

    // ==================== 解析方法 ====================

    /**
     * 解析 PlayerProfile 对象
     */
    private parsePlayerProfile(obj: SuiObjectResponse): PlayerProfile | null {
        if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
            return null;
        }

        const content = obj.data.content as SuiMoveObject;
        const fields = content.fields as Record<string, any>;

        return {
            id: obj.data.objectId,
            name: fields.name as string,
            avatar: Number(fields.avatar)
        };
    }

    /**
     * 解析 GameProfile 对象
     */
    private parseGameProfile(obj: SuiObjectResponse): GameProfile | null {
        if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
            return null;
        }

        const content = obj.data.content as SuiMoveObject;
        const fields = content.fields as Record<string, any>;

        return {
            id: obj.data.objectId,
            game_id: fields.game_id as string,
            creator: fields.creator as string,
            name: fields.name as string
        };
    }

    /**
     * 解析 MapProfile 对象
     */
    private parseMapProfile(obj: SuiObjectResponse): MapProfile | null {
        if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
            return null;
        }

        const content = obj.data.content as SuiMoveObject;
        const fields = content.fields as Record<string, any>;

        return {
            id: obj.data.objectId,
            map_id: fields.map_id as string,
            creator: fields.creator as string,
            name: fields.name as string,
            description: fields.description as string
        };
    }

    // ==================== 缓存管理 ====================

    /**
     * 清除玩家档案缓存
     */
    public clearPlayerCache(address: string): void {
        this.playerProfileCache.delete(address);
    }

    /**
     * 清除游戏档案缓存
     */
    public clearGameCache(gameId: string): void {
        this.gameProfileCache.delete(gameId);
    }

    /**
     * 清除地图档案缓存
     */
    public clearMapCache(mapId: string): void {
        this.mapProfileCache.delete(mapId);
    }

    /**
     * 清除所有缓存
     */
    public clearAllCache(): void {
        this.playerProfileCache.clear();
        this.gameProfileCache.clear();
        this.mapProfileCache.clear();
        console.log('[ProfileService] 所有缓存已清除');
    }
}
