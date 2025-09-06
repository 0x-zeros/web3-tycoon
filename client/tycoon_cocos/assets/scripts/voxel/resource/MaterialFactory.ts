import { Material, Texture2D, renderer } from 'cc';
import { TextureManager } from './TextureManager';

export enum MaterialType {
    OPAQUE = 'opaque',
    TRANSPARENT = 'transparent',
    CUTOUT = 'cutout',
    DOUBLE_SIDED = 'double_sided'
}

export interface MaterialConfig {
    type: MaterialType;
    texture: string;
    alphaTest?: number;
    emissive?: boolean;
    emissiveIntensity?: number;
    doubleSided?: boolean;
}

export class MaterialFactory {
    private textureManager: TextureManager;
    private materialCache: Map<string, Material> = new Map();
    private shaderCache: Map<string, renderer.EffectAsset> = new Map();

    // 内置着色器路径
    private static readonly SHADERS = {
        UNLIT_OPAQUE: 'builtin-unlit',
        UNLIT_TRANSPARENT: 'builtin-unlit',
        UNLIT_CUTOUT: 'builtin-unlit',
        STANDARD_OPAQUE: 'builtin-standard',
        STANDARD_TRANSPARENT: 'builtin-standard'
    };

    constructor(textureManager: TextureManager) {
        this.textureManager = textureManager;
    }

    /**
     * 创建材质
     * @param config 材质配置
     * @returns 材质对象
     */
    async createMaterial(config: MaterialConfig): Promise<Material | null> {
        const cacheKey = this.getMaterialCacheKey(config);
        
        // 检查缓存
        if (this.materialCache.has(cacheKey)) {
            return this.materialCache.get(cacheKey)!;
        }

        try {
            const material = await this.doCreateMaterial(config);
            if (material) {
                this.materialCache.set(cacheKey, material);
                console.log(`[MaterialFactory] 材质创建成功: ${cacheKey}`);
            }
            return material;
        } catch (error) {
            console.error(`[MaterialFactory] 材质创建失败: ${cacheKey}`, error);
            return null;
        }
    }

    /**
     * 实际创建材质
     * @param config 材质配置
     * @returns 材质对象
     */
    private async doCreateMaterial(config: MaterialConfig): Promise<Material | null> {
        // 加载纹理
        const textureInfo = await this.textureManager.loadTexture(config.texture);
        if (!textureInfo || !textureInfo.texture) {
            console.error(`[MaterialFactory] 纹理加载失败: ${config.texture}`);
            return null;
        }

        // 选择着色器
        const shaderName = this.selectShader(config);
        
        // 创建材质
        const material = new Material();
        material.initialize({
            effectName: shaderName
        });

        // 设置纹理
        material.setProperty('mainTexture', textureInfo.texture);

        // 配置材质属性
        this.configureMaterial(material, config);

        return material;
    }

    /**
     * 选择适当的着色器
     * @param config 材质配置
     * @returns 着色器名称
     */
    private selectShader(config: MaterialConfig): string {
        switch (config.type) {
            case MaterialType.OPAQUE:
                return MaterialFactory.SHADERS.UNLIT_OPAQUE;
            case MaterialType.TRANSPARENT:
                return MaterialFactory.SHADERS.UNLIT_TRANSPARENT;
            case MaterialType.CUTOUT:
                return MaterialFactory.SHADERS.UNLIT_CUTOUT;
            case MaterialType.DOUBLE_SIDED:
                return MaterialFactory.SHADERS.UNLIT_TRANSPARENT;
            default:
                return MaterialFactory.SHADERS.UNLIT_OPAQUE;
        }
    }

    /**
     * 配置材质属性
     * @param material 材质对象
     * @param config 材质配置
     */
    private configureMaterial(material: Material, config: MaterialConfig): void {
        const pass = material.passes[0];
        if (!pass) return;

        // 基础配置
        switch (config.type) {
            case MaterialType.OPAQUE:
                this.configureOpaqueMaterial(pass, config);
                break;
            case MaterialType.TRANSPARENT:
                this.configureTransparentMaterial(pass, config);
                break;
            case MaterialType.CUTOUT:
                this.configureCutoutMaterial(pass, config);
                break;
            case MaterialType.DOUBLE_SIDED:
                this.configureDoubleSidedMaterial(pass, config);
                break;
        }

        // 发光配置
        if (config.emissive) {
            this.configureEmissive(material, config);
        }
    }

    /**
     * 配置不透明材质
     */
    private configureOpaqueMaterial(pass: any, config: MaterialConfig): void {
        // 不透明材质设置
        pass.setBlend(
            false, // 不启用混合
            renderer.BlendFactor.ONE,
            renderer.BlendFactor.ZERO,
            renderer.BlendOp.ADD,
            renderer.BlendFactor.ONE,
            renderer.BlendFactor.ZERO,
            renderer.BlendOp.ADD
        );

        pass.setDepthStencilState(
            true,  // 深度测试
            true,  // 深度写入
            renderer.ComparisonFunc.LESS
        );

        pass.setCullMode(renderer.CullMode.BACK);
    }

    /**
     * 配置透明材质
     */
    private configureTransparentMaterial(pass: any, config: MaterialConfig): void {
        // 透明混合设置
        pass.setBlend(
            true, // 启用混合
            renderer.BlendFactor.SRC_ALPHA,
            renderer.BlendFactor.ONE_MINUS_SRC_ALPHA,
            renderer.BlendOp.ADD,
            renderer.BlendFactor.ONE,
            renderer.BlendFactor.ONE_MINUS_SRC_ALPHA,
            renderer.BlendOp.ADD
        );

        pass.setDepthStencilState(
            true,  // 深度测试
            false, // 不写入深度（透明物体）
            renderer.ComparisonFunc.LESS
        );

        pass.setCullMode(renderer.CullMode.BACK);

        // 设置渲染队列为透明
        pass.setPhase(renderer.RenderPhase.TRANSPARENT);
    }

    /**
     * 配置裁切材质（alpha test）
     */
    private configureCutoutMaterial(pass: any, config: MaterialConfig): void {
        // 裁切材质（类似不透明但使用alpha test）
        pass.setBlend(
            false,
            renderer.BlendFactor.ONE,
            renderer.BlendFactor.ZERO,
            renderer.BlendOp.ADD,
            renderer.BlendFactor.ONE,
            renderer.BlendFactor.ZERO,
            renderer.BlendOp.ADD
        );

        pass.setDepthStencilState(
            true,  // 深度测试
            true,  // 深度写入
            renderer.ComparisonFunc.LESS
        );

        pass.setCullMode(renderer.CullMode.BACK);

        // 设置alpha test阈值
        const alphaTest = config.alphaTest || 0.5;
        pass.setProperty('alphaThreshold', alphaTest);
    }

    /**
     * 配置双面材质
     */
    private configureDoubleSidedMaterial(pass: any, config: MaterialConfig): void {
        // 继承透明材质设置
        this.configureTransparentMaterial(pass, config);
        
        // 禁用背面剔除
        pass.setCullMode(renderer.CullMode.NONE);
    }

    /**
     * 配置发光属性
     */
    private configureEmissive(material: Material, config: MaterialConfig): void {
        const intensity = config.emissiveIntensity || 1.0;
        
        // 设置发光颜色和强度
        material.setProperty('emissive', [intensity, intensity, intensity, 1.0]);
        material.setProperty('emissiveScale', intensity);
    }

    /**
     * 创建方块材质（根据纹理自动选择类型）
     * @param texturePath 纹理路径
     * @param emissive 是否发光
     * @returns 材质对象
     */
    async createBlockMaterial(texturePath: string, emissive: boolean = false): Promise<Material | null> {
        const textureInfo = await this.textureManager.loadTexture(texturePath);
        if (!textureInfo) {
            return null;
        }

        // 根据纹理特性自动选择材质类型
        let materialType: MaterialType;
        if (this.isPlantTexture(texturePath)) {
            materialType = MaterialType.DOUBLE_SIDED; // 植物使用双面
        } else if (textureInfo.transparent) {
            materialType = MaterialType.TRANSPARENT; // 透明纹理
        } else {
            materialType = MaterialType.OPAQUE; // 不透明
        }

        const config: MaterialConfig = {
            type: materialType,
            texture: texturePath,
            emissive,
            emissiveIntensity: emissive ? 1.0 : 0,
            alphaTest: materialType === MaterialType.CUTOUT ? 0.5 : undefined
        };

        return await this.createMaterial(config);
    }

    /**
     * 批量创建材质
     * @param configs 材质配置数组
     * @returns 材质映射
     */
    async createMaterialsBatch(configs: MaterialConfig[]): Promise<Map<string, Material | null>> {
        const results = new Map<string, Material | null>();
        
        const promises = configs.map(async (config) => {
            const material = await this.createMaterial(config);
            const key = this.getMaterialCacheKey(config);
            results.set(key, material);
            return { key, material };
        });

        await Promise.allSettled(promises);
        
        console.log(`[MaterialFactory] 批量创建完成: ${configs.length} 个材质`);
        return results;
    }

    /**
     * 获取材质缓存键
     * @param config 材质配置
     * @returns 缓存键
     */
    private getMaterialCacheKey(config: MaterialConfig): string {
        const parts = [
            config.type,
            config.texture,
            config.alphaTest?.toString() || 'no-alpha',
            config.emissive ? 'emissive' : 'no-emissive',
            config.doubleSided ? 'double-sided' : 'single-sided'
        ];
        return parts.join('|');
    }

    /**
     * 判断是否为植物纹理
     * @param texturePath 纹理路径
     * @returns 是否为植物纹理
     */
    private isPlantTexture(texturePath: string): boolean {
        const plantTextures = [
            'grass', 'fern', 'dandelion', 'poppy', 'flower',
            'sapling', 'vine', 'wheat', 'carrot', 'potato'
        ];
        
        const lowerPath = texturePath.toLowerCase();
        return plantTextures.some(plant => lowerPath.includes(plant));
    }

    /**
     * 获取材质
     * @param texturePath 纹理路径
     * @param materialType 材质类型
     * @returns 材质对象（如果存在）
     */
    getMaterial(texturePath: string, materialType: MaterialType = MaterialType.OPAQUE): Material | null {
        const config: MaterialConfig = { type: materialType, texture: texturePath };
        const cacheKey = this.getMaterialCacheKey(config);
        return this.materialCache.get(cacheKey) || null;
    }

    /**
     * 清理材质缓存
     */
    clearCache(): void {
        for (const material of this.materialCache.values()) {
            material.destroy();
        }
        this.materialCache.clear();
        console.log('[MaterialFactory] 材质缓存已清理');
    }

    /**
     * 获取缓存统计
     */
    getCacheStats(): { 
        materials: number;
        opaque: number;
        transparent: number;
        cutout: number;
        doubleSided: number;
    } {
        let opaque = 0, transparent = 0, cutout = 0, doubleSided = 0;

        for (const [key] of this.materialCache) {
            if (key.includes('opaque')) opaque++;
            else if (key.includes('transparent')) transparent++;
            else if (key.includes('cutout')) cutout++;
            else if (key.includes('double_sided')) doubleSided++;
        }

        return {
            materials: this.materialCache.size,
            opaque,
            transparent,
            cutout,
            doubleSided
        };
    }

    /**
     * 销毁材质工厂
     */
    destroy(): void {
        this.clearCache();
        this.shaderCache.clear();
    }
}

// 全局单例
let globalMaterialFactory: MaterialFactory | null = null;

export function getGlobalMaterialFactory(): MaterialFactory | null {
    return globalMaterialFactory;
}

export function initializeGlobalMaterialFactory(textureManager: TextureManager): MaterialFactory {
    if (globalMaterialFactory) {
        globalMaterialFactory.destroy();
    }
    
    globalMaterialFactory = new MaterialFactory(textureManager);
    return globalMaterialFactory;
}