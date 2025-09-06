import { Texture2D, ImageAsset, resources } from 'cc';
import { ResourcePackLoader } from './ResourcePackLoader';

export interface TextureInfo {
    texture: Texture2D;
    path: string;
    loaded: boolean;
    transparent: boolean;
    size: { width: number; height: number };
}

export class TextureManager {
    private resourceLoader: ResourcePackLoader;
    private textureCache: Map<string, TextureInfo> = new Map();
    private loadingPromises: Map<string, Promise<TextureInfo | null>> = new Map();
    private missingTexture: Texture2D | null = null;

    constructor(resourceLoader: ResourcePackLoader) {
        this.resourceLoader = resourceLoader;
    }

    /**
     * 初始化纹理管理器
     */
    async initialize(): Promise<void> {
        console.log('[TextureManager] 初始化纹理管理器...');
        
        // 创建缺失纹理（紫黑方格）
        await this.createMissingTexture();
        
        console.log('[TextureManager] 纹理管理器初始化完成');
    }

    /**
     * 加载纹理
     * @param texturePath 纹理路径（如 "minecraft:block/stone"）
     * @returns 纹理信息
     */
    async loadTexture(texturePath: string): Promise<TextureInfo | null> {
        // 检查缓存
        if (this.textureCache.has(texturePath)) {
            return this.textureCache.get(texturePath)!;
        }

        // 检查是否正在加载
        if (this.loadingPromises.has(texturePath)) {
            return await this.loadingPromises.get(texturePath)!;
        }

        // 开始加载
        const loadingPromise = this.doLoadTexture(texturePath);
        this.loadingPromises.set(texturePath, loadingPromise);

        try {
            const result = await loadingPromise;
            return result;
        } finally {
            this.loadingPromises.delete(texturePath);
        }
    }

    /**
     * 实际执行纹理加载
     * @param texturePath 纹理路径
     * @returns 纹理信息
     */
    private async doLoadTexture(texturePath: string): Promise<TextureInfo | null> {
        console.log(`[TextureManager] 开始加载纹理: ${texturePath}`);

        try {
            const texture = await this.resourceLoader.loadTexture(texturePath);
            if (!texture) {
                console.warn(`[TextureManager] 纹理加载失败: ${texturePath}`);
                return this.getMissingTextureInfo();
            }

            const textureInfo: TextureInfo = {
                texture,
                path: texturePath,
                loaded: true,
                transparent: this.isTransparentTexture(texturePath),
                size: {
                    width: texture.width,
                    height: texture.height
                }
            };

            // 配置纹理采样
            this.configureTexture(texture, textureInfo.transparent);

            // 缓存纹理
            this.textureCache.set(texturePath, textureInfo);

            console.log(`[TextureManager] 纹理加载成功: ${texturePath} (${texture.width}x${texture.height})`);
            return textureInfo;

        } catch (error) {
            console.error(`[TextureManager] 纹理加载异常: ${texturePath}`, error);
            return this.getMissingTextureInfo();
        }
    }

    /**
     * 配置纹理设置
     * @param texture 纹理对象
     * @param transparent 是否透明
     */
    private configureTexture(texture: Texture2D, transparent: boolean): void {
        // 设置最近邻采样（保持像素风格）
        texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        
        // 设置包装模式
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        
        // 关闭 mipmap（可选，根据性能需求）
        // texture.setMipFilter(Texture2D.Filter.NONE);
    }

    /**
     * 批量加载纹理
     * @param texturePaths 纹理路径数组
     * @returns 加载结果映射
     */
    async loadTexturesBatch(texturePaths: string[]): Promise<Map<string, TextureInfo | null>> {
        const results = new Map<string, TextureInfo | null>();
        
        // 并发加载所有纹理
        const loadingPromises = texturePaths.map(async (path) => {
            const result = await this.loadTexture(path);
            results.set(path, result);
            return { path, result };
        });

        await Promise.allSettled(loadingPromises);
        
        console.log(`[TextureManager] 批量加载完成，成功: ${Array.from(results.values()).filter(r => r?.loaded).length}/${texturePaths.length}`);
        
        return results;
    }

    /**
     * 预加载常用纹理
     */
    async preloadCommonTextures(): Promise<void> {
        const commonTextures = [
            'minecraft:block/stone',
            'minecraft:block/dirt',
            'minecraft:block/grass_block_side',
            'minecraft:block/grass_block_top',
            'minecraft:block/oak_log',
            'minecraft:block/oak_log_top',
            'minecraft:block/oak_planks',
            'minecraft:block/sand',
            'minecraft:block/cobblestone',
            'minecraft:block/glass',
            'minecraft:block/oak_leaves',
            'minecraft:block/dandelion',
            'minecraft:block/poppy',
            'minecraft:block/grass',
            'minecraft:block/fern'
        ];

        console.log('[TextureManager] 开始预加载常用纹理...');
        await this.loadTexturesBatch(commonTextures);
        console.log('[TextureManager] 常用纹理预加载完成');
    }

    /**
     * 获取纹理
     * @param texturePath 纹理路径
     * @returns 纹理对象（如果未加载则返回缺失纹理）
     */
    getTexture(texturePath: string): Texture2D {
        const textureInfo = this.textureCache.get(texturePath);
        if (textureInfo && textureInfo.loaded) {
            return textureInfo.texture;
        }
        
        // 返回缺失纹理
        return this.missingTexture || this.createEmptyTexture();
    }

    /**
     * 检查纹理是否已加载
     * @param texturePath 纹理路径
     * @returns 是否已加载
     */
    isTextureLoaded(texturePath: string): boolean {
        const textureInfo = this.textureCache.get(texturePath);
        return textureInfo ? textureInfo.loaded : false;
    }

    /**
     * 获取纹理信息
     * @param texturePath 纹理路径
     * @returns 纹理信息
     */
    getTextureInfo(texturePath: string): TextureInfo | null {
        return this.textureCache.get(texturePath) || null;
    }

    /**
     * 判断纹理是否透明
     * @param texturePath 纹理路径
     * @returns 是否透明
     */
    private isTransparentTexture(texturePath: string): boolean {
        const transparentTextures = [
            'glass', 'leaves', 'grass', 'fern', 'dandelion', 'poppy',
            'water', 'ice', 'portal', 'vine', 'flower', 'sapling'
        ];

        const lowerPath = texturePath.toLowerCase();
        return transparentTextures.some(keyword => lowerPath.includes(keyword));
    }

    /**
     * 创建缺失纹理（紫黑方格）
     */
    private async createMissingTexture(): Promise<void> {
        const size = 16; // 16x16 像素
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // 绘制紫黑方格图案
        const magenta = '#FF00FF';
        const black = '#000000';
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const checker = Math.floor(x / (size / 2)) + Math.floor(y / (size / 2));
                ctx.fillStyle = (checker % 2 === 0) ? magenta : black;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        // 转换为ImageAsset
        const imageAsset = new ImageAsset();
        imageAsset.reset({
            _nativeAsset: canvas,
            width: size,
            height: size,
            format: Texture2D.PixelFormat.RGBA8888
        });

        // 创建纹理
        this.missingTexture = new Texture2D();
        this.missingTexture.image = imageAsset;
        this.configureTexture(this.missingTexture, false);

        console.log('[TextureManager] 缺失纹理创建完成');
    }

    /**
     * 获取缺失纹理信息
     */
    private getMissingTextureInfo(): TextureInfo {
        return {
            texture: this.missingTexture || this.createEmptyTexture(),
            path: 'minecraft:missing',
            loaded: true,
            transparent: false,
            size: { width: 16, height: 16 }
        };
    }

    /**
     * 创建空纹理（降级方案）
     */
    private createEmptyTexture(): Texture2D {
        const imageAsset = new ImageAsset();
        imageAsset.reset({
            width: 1,
            height: 1,
            format: Texture2D.PixelFormat.RGBA8888
        });

        const texture = new Texture2D();
        texture.image = imageAsset;
        return texture;
    }

    /**
     * 清理纹理缓存
     * @param keepMissing 是否保留缺失纹理
     */
    clearCache(keepMissing: boolean = true): void {
        for (const [path, info] of this.textureCache) {
            if (!keepMissing || path !== 'minecraft:missing') {
                info.texture.destroy();
                this.textureCache.delete(path);
            }
        }
        
        console.log('[TextureManager] 纹理缓存已清理');
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): { 
        total: number; 
        loaded: number; 
        transparent: number;
        totalMemory: number;
    } {
        let loaded = 0;
        let transparent = 0;
        let totalMemory = 0;

        for (const info of this.textureCache.values()) {
            if (info.loaded) loaded++;
            if (info.transparent) transparent++;
            totalMemory += info.size.width * info.size.height * 4; // RGBA
        }

        return {
            total: this.textureCache.size,
            loaded,
            transparent,
            totalMemory
        };
    }

    /**
     * 销毁纹理管理器
     */
    destroy(): void {
        this.clearCache(false);
        if (this.missingTexture) {
            this.missingTexture.destroy();
            this.missingTexture = null;
        }
        this.loadingPromises.clear();
    }
}

// 全局单例
let globalTextureManager: TextureManager | null = null;

export function getGlobalTextureManager(): TextureManager | null {
    return globalTextureManager;
}

export function initializeGlobalTextureManager(resourceLoader: ResourcePackLoader): TextureManager {
    if (globalTextureManager) {
        globalTextureManager.destroy();
    }
    
    globalTextureManager = new TextureManager(resourceLoader);
    return globalTextureManager;
}