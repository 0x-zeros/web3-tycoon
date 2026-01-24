/**
 * ProfileEventHandler - Profile 事件处理器
 *
 * 职责：
 * 1. 监听 tycoon_profiles 包的 Profile 创建事件
 * 2. 调用 ProfileService 建立索引
 *
 * 注意：Profile 事件来自 tycoon_profiles 包，不是 tycoon 包，
 * 因此需要独立轮询，不能复用 TycoonEventIndexer。
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { SuiClient } from '@mysten/sui/client';
import { ProfileService } from '../../services/ProfileService';
import { loadSuiClient } from '../../loader';
import type {
    GameProfileCreatedEvent,
    MapProfileCreatedEvent,
    PlayerProfileCreatedEvent
} from '../types';

/**
 * ProfileEventHandler 类
 * 独立轮询 tycoon_profiles 包的事件
 */
export class ProfileEventHandler {
    /** 单例实例 */
    private static _instance: ProfileEventHandler | null = null;

    /** Sui 客户端 */
    private client: SuiClient | null = null;

    /** profiles 包 ID */
    private packageId: string = '';

    /** 轮询间隔 (ms) */
    private pollInterval: number = 5000;

    /** 是否正在运行 */
    private isRunning: boolean = false;

    /** 轮询定时器 */
    private pollTimer?: ReturnType<typeof setTimeout>;

    /** 事件类型列表 */
    private readonly eventTypes = [
        'PlayerProfileCreatedEvent',
        'GameProfileCreatedEvent',
        'MapProfileCreatedEvent',
    ];

    /** 每个事件类型的游标 */
    private perTypeCursor: Map<string, { txDigest: string; eventSeq: string } | null> = new Map();

    /** 是否已完成初始引导 */
    private bootstrapped: boolean = false;

    private constructor() {
        console.log('[ProfileEventHandler] Handler 创建');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): ProfileEventHandler {
        if (!ProfileEventHandler._instance) {
            ProfileEventHandler._instance = new ProfileEventHandler();
        }
        return ProfileEventHandler._instance;
    }

    /**
     * 初始化
     * @param packageId tycoon_profiles 包 ID
     * @param pollInterval 轮询间隔 (可选，默认 5000ms)
     */
    public async initialize(packageId: string, pollInterval?: number): Promise<void> {
        if (!packageId) {
            console.warn('[ProfileEventHandler] packageId 为空，跳过初始化');
            return;
        }

        this.packageId = packageId;
        if (pollInterval) {
            this.pollInterval = pollInterval;
        }

        // 动态加载 SuiClient
        const { SuiClient } = await loadSuiClient();
        const { SuiManager } = await import('../../managers/SuiManager');
        const rpcUrl = SuiManager.instance.client;

        // 直接使用 SuiManager 的 client
        this.client = SuiManager.instance.client;

        console.log('[ProfileEventHandler] 初始化完成, packageId:', packageId);
    }

    /**
     * 开始监听事件
     */
    public start(): void {
        if (this.isRunning) {
            console.log('[ProfileEventHandler] 已在运行中');
            return;
        }

        if (!this.packageId || !this.client) {
            console.warn('[ProfileEventHandler] 未初始化，无法启动');
            return;
        }

        this.isRunning = true;
        console.log('[ProfileEventHandler] 开始监听事件');

        // 先进行游标引导
        this.bootstrap().finally(() => {
            this.pollEvents();
        });
    }

    /**
     * 停止监听事件
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        console.log('[ProfileEventHandler] 停止监听事件');
    }

    /**
     * 启动时引导游标至当前最新事件
     */
    private async bootstrap(): Promise<void> {
        if (!this.client) return;

        try {
            for (const typeName of this.eventTypes) {
                const fullType = `${this.packageId}::events::${typeName}`;
                const res = await this.client.queryEvents({
                    query: { MoveEventType: fullType },
                    order: 'descending',
                    limit: 1,
                });

                if (res.data && res.data.length > 0) {
                    const latest = res.data[0];
                    this.perTypeCursor.set(typeName, latest.id);
                } else {
                    this.perTypeCursor.set(typeName, null);
                }
            }
            this.bootstrapped = true;
            console.log('[ProfileEventHandler] 游标引导完成');
        } catch (e) {
            console.warn('[ProfileEventHandler] 游标引导失败:', e);
        }
    }

    /**
     * 轮询事件
     */
    private async pollEvents(): Promise<void> {
        if (!this.isRunning || !this.client) {
            return;
        }

        try {
            for (const typeName of this.eventTypes) {
                const cursor = this.perTypeCursor.get(typeName) ?? undefined;
                const fullType = `${this.packageId}::events::${typeName}`;

                const result = await this.client.queryEvents({
                    query: { MoveEventType: fullType },
                    order: 'ascending',
                    limit: 50,
                    cursor,
                });

                const count = result.data?.length ?? 0;
                if (count > 0) {
                    console.log(`[ProfileEventHandler] 收到 ${count} 个 ${typeName} 事件`);

                    for (const ev of result.data) {
                        await this.handleEvent(typeName, ev.parsedJson);
                    }

                    // 更新游标
                    const last = result.data[result.data.length - 1];
                    this.perTypeCursor.set(typeName, last?.id ?? cursor ?? null);
                }
            }
        } catch (error) {
            console.error('[ProfileEventHandler] 轮询事件失败:', error);
        }

        // 继续轮询
        if (this.isRunning) {
            this.pollTimer = setTimeout(() => this.pollEvents(), this.pollInterval);
        }
    }

    /**
     * 处理事件
     */
    private async handleEvent(typeName: string, parsedJson: any): Promise<void> {
        try {
            // 规范化 ID 字段（可能是对象或字符串）
            const normalizeId = (id: any): string => {
                if (typeof id === 'string') return id;
                if (typeof id === 'object') {
                    if (id.id) return id.id;
                    if (id.bytes) return id.bytes;
                }
                return String(id);
            };

            switch (typeName) {
                case 'PlayerProfileCreatedEvent': {
                    const event = parsedJson as PlayerProfileCreatedEvent;
                    const profileId = normalizeId(event.profile_id);
                    const owner = normalizeId(event.owner);
                    console.log('[ProfileEventHandler] PlayerProfileCreated:', { profileId, owner });
                    // PlayerProfile 通过 getOwnedObjects 查询，无需索引
                    // 但可以清除缓存
                    ProfileService.instance.clearPlayerCache(owner);
                    break;
                }

                case 'GameProfileCreatedEvent': {
                    const event = parsedJson as GameProfileCreatedEvent;
                    const profileId = normalizeId(event.profile_id);
                    const gameId = normalizeId(event.game_id);
                    console.log('[ProfileEventHandler] GameProfileCreated:', { profileId, gameId });
                    ProfileService.instance.registerGameProfileIndex(gameId, profileId);
                    break;
                }

                case 'MapProfileCreatedEvent': {
                    const event = parsedJson as MapProfileCreatedEvent;
                    const profileId = normalizeId(event.profile_id);
                    const mapId = normalizeId(event.map_id);
                    console.log('[ProfileEventHandler] MapProfileCreated:', { profileId, mapId });
                    ProfileService.instance.registerMapProfileIndex(mapId, profileId);
                    break;
                }

                default:
                    console.warn('[ProfileEventHandler] 未知事件类型:', typeName);
            }
        } catch (error) {
            console.error('[ProfileEventHandler] 处理事件失败:', typeName, error);
        }
    }

    /**
     * 销毁
     */
    public destroy(): void {
        this.stop();
        this.client = null;
        this.packageId = '';
        this.perTypeCursor.clear();
        this.bootstrapped = false;
        ProfileEventHandler._instance = null;
        console.log('[ProfileEventHandler] Handler 销毁');
    }
}

// 导出单例访问器
export const profileEventHandler = {
    get instance(): ProfileEventHandler {
        return ProfileEventHandler.getInstance();
    }
};
