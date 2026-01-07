/**
 * 缓存管理器
 *
 * 提供两层缓存机制：内存缓存（快速访问）+ localStorage（持久化）
 * 支持TTL过期、LRU淘汰策略
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

export interface CacheEntry {
    key: string;
    data: any;
    expiresAt: number;
    createdAt: number;
}

export interface CacheOptions {
    useLocalStorage?: boolean;
    maxMemoryEntries?: number;
}

/**
 * 缓存管理器类
 * 内存缓存 + localStorage双层缓存
 */
export class CacheManager {
    private memoryCache: Map<string, CacheEntry> = new Map();
    private useLocalStorage: boolean;
    private maxMemoryEntries: number;

    constructor(options?: CacheOptions) {
        this.useLocalStorage = options?.useLocalStorage !== false;
        this.maxMemoryEntries = options?.maxMemoryEntries || 100;
    }

    /**
     * 获取缓存数据
     * 优先从内存缓存读取，失败则从localStorage读取
     */
    public get<T>(key: string): T | null {
        // 1. 检查内存缓存
        const memEntry = this.memoryCache.get(key);
        if (memEntry && !this.isExpired(memEntry)) {
            console.log(`[CacheManager] 内存缓存命中: ${key}`);
            return memEntry.data as T;
        }

        // 2. 检查localStorage
        if (this.useLocalStorage) {
            try {
                const stored = localStorage.getItem(`cache_${key}`);
                if (stored) {
                    const entry: CacheEntry = JSON.parse(stored);
                    if (!this.isExpired(entry)) {
                        console.log(`[CacheManager] localStorage缓存命中: ${key}`);
                        // 回填内存缓存
                        this.setMemory(key, entry);
                        return entry.data as T;
                    } else {
                        // 删除过期的localStorage条目
                        localStorage.removeItem(`cache_${key}`);
                    }
                }
            } catch (error) {
                console.warn(`[CacheManager] localStorage读取失败: ${key}`, error);
            }
        }

        console.log(`[CacheManager] 缓存未命中: ${key}`);
        return null;
    }

    /**
     * 设置缓存数据
     * 同时写入内存和localStorage
     */
    public set(key: string, data: any, ttl: number): void {
        const entry: CacheEntry = {
            key,
            data,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now()
        };

        // 写入内存
        this.setMemory(key, entry);

        // 写入localStorage
        if (this.useLocalStorage) {
            try {
                localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
            } catch (error) {
                console.warn(`[CacheManager] localStorage写入失败: ${key}`, error);
            }
        }

        console.log(`[CacheManager] 缓存已设置: ${key}, TTL: ${ttl}ms`);
    }

    /**
     * 删除指定缓存
     */
    public delete(key: string): void {
        this.memoryCache.delete(key);

        if (this.useLocalStorage) {
            localStorage.removeItem(`cache_${key}`);
        }

        console.log(`[CacheManager] 缓存已删除: ${key}`);
    }

    /**
     * 清除缓存
     * @param pattern 可选的正则表达式模式，匹配要清除的键
     */
    public clear(pattern?: string): void {
        if (pattern) {
            // 清除匹配的键
            const regex = new RegExp(pattern);
            const keysToDelete: string[] = [];

            for (const key of this.memoryCache.keys()) {
                if (regex.test(key)) {
                    keysToDelete.push(key);
                }
            }

            for (const key of keysToDelete) {
                this.delete(key);
            }

            console.log(`[CacheManager] 清除匹配缓存: ${pattern}, 删除数: ${keysToDelete.length}`);
        } else {
            // 清除所有缓存
            this.memoryCache.clear();

            if (this.useLocalStorage) {
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('cache_')) {
                        keysToRemove.push(key);
                    }
                }
                for (const key of keysToRemove) {
                    localStorage.removeItem(key);
                }
            }

            console.log(`[CacheManager] 已清除所有缓存`);
        }
    }

    /**
     * 检查缓存是否存在且未过期
     */
    public has(key: string): boolean {
        const entry = this.memoryCache.get(key);
        if (entry && !this.isExpired(entry)) {
            return true;
        }

        if (this.useLocalStorage) {
            try {
                const stored = localStorage.getItem(`cache_${key}`);
                if (stored) {
                    const entry: CacheEntry = JSON.parse(stored);
                    return !this.isExpired(entry);
                }
            } catch (error) {
                return false;
            }
        }

        return false;
    }

    /**
     * 获取缓存统计信息
     */
    public getStats(): {
        memoryEntries: number;
        localStorageEntries: number;
        maxMemoryEntries: number;
    } {
        let localStorageEntries = 0;

        if (this.useLocalStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache_')) {
                    localStorageEntries++;
                }
            }
        }

        return {
            memoryEntries: this.memoryCache.size,
            localStorageEntries,
            maxMemoryEntries: this.maxMemoryEntries
        };
    }

    /**
     * 清理过期缓存
     */
    public cleanExpired(): void {
        let cleaned = 0;

        // 清理内存缓存
        for (const [key, entry] of this.memoryCache) {
            if (this.isExpired(entry)) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }

        // 清理localStorage
        if (this.useLocalStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('cache_')) {
                    try {
                        const stored = localStorage.getItem(key);
                        if (stored) {
                            const entry: CacheEntry = JSON.parse(stored);
                            if (this.isExpired(entry)) {
                                localStorage.removeItem(key);
                                cleaned++;
                            }
                        }
                    } catch (error) {
                        // 删除无效的条目
                        localStorage.removeItem(key);
                        cleaned++;
                    }
                }
            }
        }

        if (cleaned > 0) {
            console.log(`[CacheManager] 清理过期缓存: ${cleaned}条`);
        }
    }

    // 私有方法

    /**
     * 设置内存缓存
     * 使用LRU策略：超过上限时删除最旧的条目
     */
    private setMemory(key: string, entry: CacheEntry): void {
        // LRU淘汰：超过上限时删除最旧的
        if (this.memoryCache.size >= this.maxMemoryEntries) {
            const oldestKey = this.memoryCache.keys().next().value;
            if (oldestKey) {
                this.memoryCache.delete(oldestKey);
                console.log(`[CacheManager] LRU淘汰: ${oldestKey}`);
            }
        }

        this.memoryCache.set(key, entry);
    }

    /**
     * 检查缓存条目是否过期
     */
    private isExpired(entry: CacheEntry): boolean {
        return Date.now() > entry.expiresAt;
    }
}
