import { resources, Prefab, SpriteFrame, AudioClip, instantiate, Node, error, warn } from "cc";

/**
 * 资源加载结果接口
 */
export interface LoadResult<T> {
    /** 是否成功 */
    success: boolean;
    /** 资源对象 */
    asset?: T;
    /** 错误信息 */
    error?: string;
}

/**
 * 批量加载结果接口
 */
export interface BatchLoadResult<T> {
    /** 成功加载的资源 */
    loaded: { [key: string]: T };
    /** 加载失败的资源 */
    failed: { [key: string]: string };
    /** 加载成功数量 */
    successCount: number;
    /** 加载失败数量 */
    failureCount: number;
}

/**
 * 加载进度回调类型
 */
export type LoadProgressCallback = (finished: number, total: number, item: any) => void;

/**
 * UI资源加载器 - 提供UI相关资源的加载功能
 */
export class UILoader {
    /** 资源缓存 */
    private static _cache: Map<string, any> = new Map();
    /** 是否启用缓存 */
    private static _enableCache: boolean = true;
    /** 加载中的资源 */
    private static _loading: Set<string> = new Set();

    /**
     * 设置是否启用缓存
     */
    public static setEnableCache(enable: boolean): void {
        this._enableCache = enable;
        if (!enable) {
            this.clearCache();
        }
    }

    /**
     * 清理缓存
     */
    public static clearCache(path?: string): void {
        if (path) {
            this._cache.delete(path);
        } else {
            this._cache.clear();
        }
    }

    /**
     * 检查资源是否在缓存中
     */
    public static isInCache(path: string): boolean {
        return this._cache.has(path);
    }

    /**
     * 从缓存获取资源
     */
    public static getFromCache<T>(path: string): T | null {
        return this._cache.get(path) || null;
    }

    /**
     * 加载预制体
     */
    public static async loadPrefab(path: string, useCache: boolean = true): Promise<LoadResult<Prefab>> {
        // 检查缓存
        if (useCache && this._enableCache && this.isInCache(path)) {
            const cached = this.getFromCache<Prefab>(path);
            if (cached) {
                return { success: true, asset: cached };
            }
        }

        // 检查是否正在加载
        if (this._loading.has(path)) {
            return new Promise((resolve) => {
                const checkLoaded = () => {
                    if (!this._loading.has(path)) {
                        if (this.isInCache(path)) {
                            resolve({ success: true, asset: this.getFromCache<Prefab>(path)! });
                        } else {
                            resolve({ success: false, error: "Load failed during wait" });
                        }
                    } else {
                        setTimeout(checkLoaded, 10);
                    }
                };
                checkLoaded();
            });
        }

        this._loading.add(path);

        try {
            const prefab = await this._loadResource<Prefab>(path, Prefab);
            
            if (useCache && this._enableCache) {
                this._cache.set(path, prefab);
            }

            this._loading.delete(path);
            return { success: true, asset: prefab };

        } catch (e) {
            this._loading.delete(path);
            const errorMsg = `Failed to load prefab: ${path}, ${e}`;
            error(errorMsg);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * 加载精灵帧
     */
    public static async loadSpriteFrame(path: string, useCache: boolean = true): Promise<LoadResult<SpriteFrame>> {
        if (useCache && this._enableCache && this.isInCache(path)) {
            const cached = this.getFromCache<SpriteFrame>(path);
            if (cached) {
                return { success: true, asset: cached };
            }
        }

        if (this._loading.has(path)) {
            return new Promise((resolve) => {
                const checkLoaded = () => {
                    if (!this._loading.has(path)) {
                        if (this.isInCache(path)) {
                            resolve({ success: true, asset: this.getFromCache<SpriteFrame>(path)! });
                        } else {
                            resolve({ success: false, error: "Load failed during wait" });
                        }
                    } else {
                        setTimeout(checkLoaded, 10);
                    }
                };
                checkLoaded();
            });
        }

        this._loading.add(path);

        try {
            const spriteFrame = await this._loadResource<SpriteFrame>(path, SpriteFrame);
            
            if (useCache && this._enableCache) {
                this._cache.set(path, spriteFrame);
            }

            this._loading.delete(path);
            return { success: true, asset: spriteFrame };

        } catch (e) {
            this._loading.delete(path);
            const errorMsg = `Failed to load sprite frame: ${path}, ${e}`;
            error(errorMsg);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * 加载音频剪辑
     */
    public static async loadAudioClip(path: string, useCache: boolean = true): Promise<LoadResult<AudioClip>> {
        if (useCache && this._enableCache && this.isInCache(path)) {
            const cached = this.getFromCache<AudioClip>(path);
            if (cached) {
                return { success: true, asset: cached };
            }
        }

        if (this._loading.has(path)) {
            return new Promise((resolve) => {
                const checkLoaded = () => {
                    if (!this._loading.has(path)) {
                        if (this.isInCache(path)) {
                            resolve({ success: true, asset: this.getFromCache<AudioClip>(path)! });
                        } else {
                            resolve({ success: false, error: "Load failed during wait" });
                        }
                    } else {
                        setTimeout(checkLoaded, 10);
                    }
                };
                checkLoaded();
            });
        }

        this._loading.add(path);

        try {
            const audioClip = await this._loadResource<AudioClip>(path, AudioClip);
            
            if (useCache && this._enableCache) {
                this._cache.set(path, audioClip);
            }

            this._loading.delete(path);
            return { success: true, asset: audioClip };

        } catch (e) {
            this._loading.delete(path);
            const errorMsg = `Failed to load audio clip: ${path}, ${e}`;
            error(errorMsg);
            return { success: false, error: errorMsg };
        }
    }

    /**
     * 批量加载预制体
     */
    public static async loadPrefabBatch(
        paths: string[], 
        useCache: boolean = true,
        onProgress?: LoadProgressCallback
    ): Promise<BatchLoadResult<Prefab>> {
        const result: BatchLoadResult<Prefab> = {
            loaded: {},
            failed: {},
            successCount: 0,
            failureCount: 0
        };

        const total = paths.length;
        let finished = 0;

        for (const path of paths) {
            try {
                const loadResult = await this.loadPrefab(path, useCache);
                
                if (loadResult.success && loadResult.asset) {
                    result.loaded[path] = loadResult.asset;
                    result.successCount++;
                } else {
                    result.failed[path] = loadResult.error || "Unknown error";
                    result.failureCount++;
                }

            } catch (e) {
                result.failed[path] = e instanceof Error ? e.message : String(e);
                result.failureCount++;
            }

            finished++;
            onProgress?.(finished, total, path);
        }

        return result;
    }

    /**
     * 批量加载精灵帧
     */
    public static async loadSpriteFrameBatch(
        paths: string[], 
        useCache: boolean = true,
        onProgress?: LoadProgressCallback
    ): Promise<BatchLoadResult<SpriteFrame>> {
        const result: BatchLoadResult<SpriteFrame> = {
            loaded: {},
            failed: {},
            successCount: 0,
            failureCount: 0
        };

        const total = paths.length;
        let finished = 0;

        for (const path of paths) {
            try {
                const loadResult = await this.loadSpriteFrame(path, useCache);
                
                if (loadResult.success && loadResult.asset) {
                    result.loaded[path] = loadResult.asset;
                    result.successCount++;
                } else {
                    result.failed[path] = loadResult.error || "Unknown error";
                    result.failureCount++;
                }

            } catch (e) {
                result.failed[path] = e instanceof Error ? e.message : String(e);
                result.failureCount++;
            }

            finished++;
            onProgress?.(finished, total, path);
        }

        return result;
    }

    /**
     * 实例化预制体
     */
    public static async instantiatePrefab(path: string, parent?: Node): Promise<Node | null> {
        const loadResult = await this.loadPrefab(path);
        
        if (!loadResult.success || !loadResult.asset) {
            warn(`[UILoader] Failed to load prefab for instantiation: ${path}`);
            return null;
        }

        try {
            const node = instantiate(loadResult.asset);
            
            if (parent) {
                parent.addChild(node);
            }

            return node;

        } catch (e) {
            error(`[UILoader] Failed to instantiate prefab: ${path}`, e);
            return null;
        }
    }

    /**
     * 预加载UI资源
     */
    public static async preloadUIAssets(assetPaths: string[], onProgress?: LoadProgressCallback): Promise<void> {
        const total = assetPaths.length;
        let finished = 0;

        const promises = assetPaths.map(async (path) => {
            try {
                // 根据路径后缀判断资源类型
                if (path.endsWith('.prefab')) {
                    await this.loadPrefab(path);
                } else if (path.match(/\.(png|jpg|jpeg)$/i)) {
                    await this.loadSpriteFrame(path);
                } else if (path.match(/\.(mp3|wav|ogg)$/i)) {
                    await this.loadAudioClip(path);
                }
            } catch (e) {
                warn(`[UILoader] Failed to preload asset: ${path}`, e);
            } finally {
                finished++;
                onProgress?.(finished, total, path);
            }
        });

        await Promise.all(promises);
        console.log(`[UILoader] Preloaded ${finished} assets`);
    }

    /**
     * 通用资源加载方法
     */
    private static _loadResource<T>(path: string, type: any): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, type, (err, asset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(asset as T);
                }
            });
        });
    }

    /**
     * 获取缓存信息
     */
    public static getCacheInfo(): { size: number; keys: string[] } {
        return {
            size: this._cache.size,
            keys: Array.from(this._cache.keys())
        };
    }

    /**
     * 获取正在加载的资源
     */
    public static getLoadingAssets(): string[] {
        return Array.from(this._loading);
    }

    /**
     * 释放资源
     */
    public static releaseAsset(path: string): void {
        // 从缓存中移除
        const asset = this._cache.get(path);
        if (asset) {
            this._cache.delete(path);
            
            // 释放资源
            if (asset.destroy && typeof asset.destroy === 'function') {
                asset.destroy();
            }
        }

        // 通知resources管理器释放
        resources.release(path);
    }

    /**
     * 释放所有缓存资源
     */
    public static releaseAll(): void {
        // 释放缓存中的所有资源
        for (const [path, asset] of this._cache) {
            if (asset.destroy && typeof asset.destroy === 'function') {
                asset.destroy();
            }
            resources.release(path);
        }

        this.clearCache();
        this._loading.clear();
    }

    /**
     * 检查资源是否存在
     */
    public static async checkAssetExists(path: string): Promise<boolean> {
        try {
            const info = resources.getInfoWithPath(path);
            return info !== null;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取资源大小信息（如果可用）
     */
    public static getAssetSize(path: string): number {
        try {
            const info = resources.getInfoWithPath(path);
            return info?.size || 0;
        } catch (e) {
            return 0;
        }
    }
}