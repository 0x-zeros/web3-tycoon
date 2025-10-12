/**
 * HistoryStorage - Rotor-Router 历史记录持久化工具
 *
 * 功能：
 * - 将 Rotor-Router 的路口方向记录存储到 localStorage
 * - 按 gameId + playerIndex 隔离不同游戏和玩家的历史
 * - 支持保存、加载、清除操作
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { RotorRouterHistory, createRotorRouterHistory, Direction } from './WalkingPreference';

/**
 * 存储键前缀
 */
const STORAGE_KEY_PREFIX = 'tycoon_rotor_history';

/**
 * 序列化的历史记录格式
 */
interface SerializedHistory {
    /** 路口方向记录（数组格式，方便 JSON 序列化） */
    lastDirection: Array<[number, Direction]>;
    /** 保存时间戳 */
    timestamp: number;
}

/**
 * HistoryStorage 类
 */
export class HistoryStorage {
    /**
     * 生成存储键
     *
     * @param gameId 游戏 ID
     * @param playerIndex 玩家索引
     * @returns localStorage 键
     */
    private static getStorageKey(gameId: string, playerIndex: number): string {
        // 移除特殊字符，确保键的合法性
        const safeGameId = gameId.replace(/[^a-zA-Z0-9_]/g, '_');
        return `${STORAGE_KEY_PREFIX}_${safeGameId}_${playerIndex}`;
    }

    /**
     * 保存历史记录
     *
     * @param gameId 游戏 ID
     * @param playerIndex 玩家索引
     * @param history Rotor-Router 历史记录
     */
    public static save(gameId: string, playerIndex: number, history: RotorRouterHistory): void {
        try {
            const key = this.getStorageKey(gameId, playerIndex);

            // 将 Map 转换为数组格式
            const serialized: SerializedHistory = {
                lastDirection: Array.from(history.lastDirection.entries()),
                timestamp: Date.now()
            };

            // 存储到 localStorage
            localStorage.setItem(key, JSON.stringify(serialized));

            console.log('[HistoryStorage] 历史记录已保存', {
                gameId,
                playerIndex,
                recordCount: history.lastDirection.size,
                key
            });
        } catch (error) {
            console.error('[HistoryStorage] 保存失败', error);
        }
    }

    /**
     * 加载历史记录
     *
     * @param gameId 游戏 ID
     * @param playerIndex 玩家索引
     * @returns Rotor-Router 历史记录（如果不存在返回空记录）
     */
    public static load(gameId: string, playerIndex: number): RotorRouterHistory {
        try {
            const key = this.getStorageKey(gameId, playerIndex);
            const stored = localStorage.getItem(key);

            if (!stored) {
                console.log('[HistoryStorage] 未找到历史记录，返回空记录', {
                    gameId,
                    playerIndex
                });
                return createRotorRouterHistory();
            }

            // 解析 JSON
            const serialized: SerializedHistory = JSON.parse(stored);

            // 将数组转换回 Map
            const history: RotorRouterHistory = {
                lastDirection: new Map(serialized.lastDirection)
            };

            console.log('[HistoryStorage] 历史记录已加载', {
                gameId,
                playerIndex,
                recordCount: history.lastDirection.size,
                age: Date.now() - serialized.timestamp
            });

            return history;
        } catch (error) {
            console.error('[HistoryStorage] 加载失败', error);
            return createRotorRouterHistory();
        }
    }

    /**
     * 清除历史记录
     *
     * @param gameId 游戏 ID
     * @param playerIndex 玩家索引
     */
    public static clear(gameId: string, playerIndex: number): void {
        try {
            const key = this.getStorageKey(gameId, playerIndex);
            localStorage.removeItem(key);

            console.log('[HistoryStorage] 历史记录已清除', {
                gameId,
                playerIndex,
                key
            });
        } catch (error) {
            console.error('[HistoryStorage] 清除失败', error);
        }
    }

    /**
     * 清除所有历史记录（慎用）
     *
     * 遍历所有 localStorage 键，删除 Rotor-Router 相关的记录
     */
    public static clearAll(): void {
        try {
            const keysToRemove: string[] = [];

            // 遍历所有键
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
                    keysToRemove.push(key);
                }
            }

            // 删除所有匹配的键
            for (const key of keysToRemove) {
                localStorage.removeItem(key);
            }

            console.log('[HistoryStorage] 所有历史记录已清除', {
                count: keysToRemove.length
            });
        } catch (error) {
            console.error('[HistoryStorage] 清除所有历史记录失败', error);
        }
    }

    /**
     * 检查是否存在历史记录
     *
     * @param gameId 游戏 ID
     * @param playerIndex 玩家索引
     * @returns 是否存在
     */
    public static exists(gameId: string, playerIndex: number): boolean {
        const key = this.getStorageKey(gameId, playerIndex);
        return localStorage.getItem(key) !== null;
    }

    /**
     * 获取所有历史记录的键
     *
     * @returns 所有 Rotor-Router 历史记录的键
     */
    public static getAllKeys(): string[] {
        const keys: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
                keys.push(key);
            }
        }

        return keys;
    }
}
