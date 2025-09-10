import { Material, Texture2D, gfx, EffectAsset, resources } from 'cc';
import { TextureManager } from './TextureManager';

export enum MaterialType {
    OPAQUE = 'opaque',
    TRANSPARENT = 'transparent',
    CUTOUT = 'cutout',
    DOUBLE_SIDED = 'double_sided',
    PLANT = 'plant',
    EMISSIVE = 'emissive',
    OVERLAY = 'overlay'
}

export interface MaterialConfig {
    type: MaterialType;
    texture: string;
    overlayTexture?: string;  // overlay纹理路径
    alphaTest?: number;
    emissive?: boolean;
    emissiveIntensity?: number;
    emissiveColor?: [number, number, number, number];
    doubleSided?: boolean;
    windStrength?: number;
    windSpeed?: number;
    flickerSpeed?: number;
    flickerAmount?: number;
    transparency?: number;
}

export class MaterialFactory {
    private textureManager: TextureManager;
    private materialCache: Map<string, Material> = new Map();
    private shaderCache: Map<string, any> = new Map();

    // 体素专用着色器
    private static readonly SHADERS = {
        VOXEL_BLOCK: 'voxel-block',
        VOXEL_PLANT: 'voxel-plant', 
        VOXEL_EMISSIVE: 'voxel-emissive',
        VOXEL_OVERLAY: 'voxel-overlay'
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
            console.warn(`[MaterialFactory] 纹理加载失败，使用后备材质: ${config.texture}`);
            return await this.createMissingMaterial();
        }

        // 选择着色器和技术
        const shaderInfo = this.selectShaderAndTechnique(config);
        
        // 创建材质
        const material = new Material();
        
        // 从 resources 仅加载 EffectAsset，再用 effectAsset 初始化（不做任何回退）
        const effectAsset = await this.loadEffectAsset(shaderInfo.shader);
        if (!effectAsset) {
            console.error(`[MaterialFactory] EffectAsset 加载失败: voxel/shaders/${shaderInfo.shader}`);
            return null;
        }
        console.log(`[MaterialFactory] EffectAsset 加载成功: voxel/shaders/${shaderInfo.shader}`);

        material.initialize({ effectAsset, technique: shaderInfo.technique });

        try {
            // 设置主纹理
            material.setProperty('mainTexture', textureInfo.texture);
            
            // 设置overlay纹理（如果有）
            if (config.overlayTexture) {
                const overlayTextureInfo = await this.textureManager.loadTexture(config.overlayTexture);
                if (overlayTextureInfo && overlayTextureInfo.texture) {
                    material.setProperty('u_OverlayTex', overlayTextureInfo.texture);
                    console.log(`[MaterialFactory] Overlay纹理加载成功: ${config.overlayTexture}`);
                } else {
                    console.warn(`[MaterialFactory] Overlay纹理加载失败: ${config.overlayTexture}`);
                    // 使用白色纹理作为fallback
                    material.setProperty('u_OverlayTex', textureInfo.texture);
                }
                
                // 设置默认的overlay uniform参数
                this.setOverlayUniforms(material);
            }
            
            // // 设置天空盒纹理（如果可用）
            // if (textureInfo.skyTexture) {
            //     material.setProperty('skyTexture', textureInfo.skyTexture);
            // }

            // 设置体素着色器通用参数
            this.setVoxelShaderUniforms(material, config);

            // 配置材质属性（渲染状态等）
            this.configureMaterial(material, config);
        } catch (error) {
            console.error(`[MaterialFactory] 材质属性设置失败:`, error);
            material.destroy();
            return null;
        }

        return material;
    }

    /**
     * 选择适当的着色器和技术
     * @param config 材质配置
     * @returns 着色器信息
     */
    private selectShaderAndTechnique(config: MaterialConfig): { shader: string, technique: number } {
        // technique 索引按 effect 文件 techniques 顺序：
        // voxel-block.effect: 0=opaque, 1=cutout, 2=transparent
        // voxel-plant.effect: 0=plant
        // voxel-emissive.effect: 0=emissive
        // voxel-overlay.effect: 0=opaque, 1=cutout, 2=transparent
        switch (config.type) {
            case MaterialType.OPAQUE:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 0 };
            case MaterialType.CUTOUT:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 1 };
            case MaterialType.TRANSPARENT:
            case MaterialType.DOUBLE_SIDED:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 2 };
            case MaterialType.PLANT:
                return { shader: MaterialFactory.SHADERS.VOXEL_PLANT, technique: 0 };
            case MaterialType.EMISSIVE:
                return { shader: MaterialFactory.SHADERS.VOXEL_EMISSIVE, technique: 0 };
            case MaterialType.OVERLAY:
                // overlay材质默认使用opaque technique，根据需要可以扩展
                return { shader: MaterialFactory.SHADERS.VOXEL_OVERLAY, technique: 0 };
            default:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 0 };
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
            case MaterialType.PLANT:
                this.configurePlantMaterial(pass, config);
                break;
            case MaterialType.EMISSIVE:
                this.configureEmissiveMaterial(pass, config);
                break;
            case MaterialType.OVERLAY:
                this.configureOverlayMaterial(pass, config);
                break;
        }

        // 发光效果由顶点light值在shader中实现，不需要额外材质配置
    }

    /**
     * 设置体素着色器通用参数
     */
    private setVoxelShaderUniforms(material: Material, config: MaterialConfig): void {
        try {
            console.log(`[MaterialFactory] 设置着色器参数，材质类型: ${config.type}`);
            
            // 通用参数 - 所有着色器都有这些
            material.setProperty('timer', 0.0);
            material.setProperty('daylight', 1.0);
            material.setProperty('fogDistance', 150.0);
            material.setProperty('ortho', 0);
            
            // 根据材质类型设置特定参数
            switch (config.type) {
                case MaterialType.CUTOUT:
                    material.setProperty('alphaThreshold', config.alphaTest || 0.5);
                    break;
                    
                case MaterialType.TRANSPARENT:
                case MaterialType.DOUBLE_SIDED:
                    material.setProperty('transparency', config.transparency || 0.8);
                    break;
                    
                case MaterialType.PLANT:
                    material.setProperty('windStrength', config.windStrength || 0.1);
                    material.setProperty('windSpeed', config.windSpeed || 1.0);
                    material.setProperty('alphaThreshold', config.alphaTest || 0.1);
                    material.setProperty('tintColor', [1.0, 1.0, 1.0, 1.0]);
                    material.setProperty('plantHeight', 1.0);
                    break;
                    
                case MaterialType.EMISSIVE:
                    const emissiveColor = config.emissiveColor || [1.0, 0.8, 0.3, 1.0];
                    material.setProperty('emissiveColor', emissiveColor);
                    material.setProperty('emissiveIntensity', config.emissiveIntensity || 2.0);
                    material.setProperty('flickerSpeed', config.flickerSpeed || 0.0);
                    material.setProperty('flickerAmount', config.flickerAmount || 0.0);
                    material.setProperty('bloomIntensity', 1.0);
                    break;
            }
            
            console.log(`[MaterialFactory] 着色器参数设置完成`);
        } catch (error) {
            console.error(`[MaterialFactory] 设置着色器参数失败:`, error);
            throw error;
        }
    }
    
    /**
     * 配置不透明材质
     */
    private configureOpaqueMaterial(pass: any, config: MaterialConfig): void {
        // 注意：新的着色器系统主要通过technique控制渲染状态
        // 这里只需要基本配置
        // 大部分渲染状态已在effect文件中定义
    }

    /**
     * 配置透明材质
     */
    private configureTransparentMaterial(pass: any, config: MaterialConfig): void {
        // 透明材质的渲染状态已在effect文件的technique中定义
        // 这里主要处理动态参数
    }

    /**
     * 配置裁切材质（alpha test）
     */
    private configureCutoutMaterial(pass: any, config: MaterialConfig): void {
        // Alpha test材质的渲染状态已在effect文件中定义
    }

    /**
     * 配置植物材质
     */
    private configurePlantMaterial(pass: any, config: MaterialConfig): void {
        // 植物材质的双面渲染等已在effect文件中定义
    }
    
    /**
     * 配置发光材质
     */
    private configureEmissiveMaterial(pass: any, config: MaterialConfig): void {
        // 发光材质的渲染状态已在effect文件中定义
    }

    /**
     * 配置overlay材质
     */
    private configureOverlayMaterial(pass: any, config: MaterialConfig): void {
        // overlay材质的渲染状态已在effect文件中定义
        console.log('[MaterialFactory] 配置overlay材质参数');
    }
    
    /**
     * 设置overlay材质的生物群系颜色
     * @param material 材质对象
     * @param biomeColor 生物群系颜色 [r, g, b, a]
     * @param inflate 顶点膀胀参数（防止Z-fighting）
     */
    public setOverlayUniforms(
        material: Material, 
        biomeColor: [number, number, number, number] = [0.5, 1.0, 0.3, 1.0], // 默认草地绿色
        inflate: number = 0.001
    ): void {
        material.setProperty('u_BiomeColor', biomeColor);
        material.setProperty('u_Inflate', inflate);
        console.log(`[MaterialFactory] 设置overlay uniform: biomeColor=${biomeColor}, inflate=${inflate}`);
    }

    /**
     * 更新材质动画参数（由外部定期调用）
     */
    public updateAnimationUniforms(material: Material, deltaTime: number): void {
        // 更新时间参数
        const currentTime = (material.getProperty('timer') as number || 0) + deltaTime;
        material.setProperty('timer', currentTime);
    }
    
    /**
     * 设置环境参数
     */
    public setEnvironmentUniforms(material: Material, daylight: number, fogDistance: number): void {
        material.setProperty('daylight', daylight);
        material.setProperty('fogDistance', fogDistance);
    }


    /**
     * 配置双面材质
     */
    private configureDoubleSidedMaterial(pass: any, config: MaterialConfig): void {
        // 继承透明材质设置
        this.configureTransparentMaterial(pass, config);
        
        // 注意：双面渲染状态主要在effect文件中定义
        // cullMode: none 已经在voxel-plant.effect中设置
    }

    /**
     * 配置发光属性
     */
    private configureEmissive(material: Material, config: MaterialConfig): void {
        // 发光属性已经在setVoxelShaderUniforms方法中设置
        // 这里不需要额外的设置，因为我们使用的是体素发光着色器的标准属性
        console.log(`[MaterialFactory] 发光属性配置：intensity=${config.emissiveIntensity}`);
    }

    /**
     * 创建缺失纹理的后备材质
     * @returns 基础材质对象
     */
    async createMissingMaterial(): Promise<Material | null> {
        console.warn('[MaterialFactory] 创建缺失纹理后备材质');
        
        const material = new Material();
        material.initialize({
            effectName: 'voxel/shaders/voxel-block',
            technique: 0 // 后备材质使用 opaque 技术
        });
        
        if (!material.passes || material.passes.length === 0) {
            console.error('[MaterialFactory] 后备材质创建失败');
            return null;
        }
        
        // 设置基础参数
        material.setProperty('timer', 0.0);
        material.setProperty('daylight', 1.0);
        material.setProperty('fogDistance', 150.0);
        material.setProperty('ortho', 0);
        
        return material;
    }

    /** 仅从 resources 加载 EffectAsset */
    private async loadEffectAsset(shaderName: string): Promise<EffectAsset | null> {
        return await new Promise<EffectAsset | null>((resolve) => {
            resources.load(`voxel/shaders/${shaderName}`, EffectAsset, (err, res) => {
                resolve(err ? null : (res as EffectAsset));
            });
        });
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
            materialType = MaterialType.OPAQUE; // 不透明（包括发光方块）
        }

        const config: MaterialConfig = {
            type: materialType,
            texture: texturePath,
            alphaTest: materialType === MaterialType.CUTOUT ? 0.5 : undefined
        };
        
        if (emissive) {
            console.log(`[MaterialFactory] 创建发光方块材质: ${texturePath} (发光效果由顶点light值实现)`);
        }

        return await this.createMaterial(config);
    }

    /**
     * 创建overlay方块材质（支持双纹理）
     * @param baseTexturePath 基础纹理路径
     * @param overlayTexturePath overlay纹理路径
     * @param emissive 是否发光
     * @returns 材质对象
     */
    async createOverlayBlockMaterial(
        baseTexturePath: string, 
        overlayTexturePath: string, 
        emissive: boolean = false
    ): Promise<Material | null> {
        const config: MaterialConfig = {
            type: MaterialType.OVERLAY,
            texture: baseTexturePath,
            overlayTexture: overlayTexturePath,
            emissive,
            emissiveIntensity: emissive ? 1.0 : 0
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
            config.overlayTexture || 'no-overlay',
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
            'short_grass', 'fern', 'dandelion', 'poppy', 'flower',
            'sapling', 'vine', 'wheat', 'carrot', 'potato'
        ];
        
        // Web3 方块中的 cross 类型方块（使用 cross 模型）
        const web3CrossTextures = [
            'bomb', 'bonus', 'card', 'chance', 'dog', 'empty_land', 'fee',
            'fortune_god', 'hospital', 'land_god', 'news', 'poverty_god',
            'property', 'roadblock', 'wealth_god'
        ];
        
        const lowerPath = texturePath.toLowerCase();
        
        // 检查 minecraft 植物纹理
        if (plantTextures.some(plant => lowerPath.includes(plant))) {
            return true;
        }
        
        // 检查 web3 cross 类型方块
        if (lowerPath.includes('web3:block/') && 
            web3CrossTextures.some(web3Block => lowerPath.includes(web3Block))) {
            return true;
        }
        
        return false;
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
        overlay: number;
    } {
        let opaque = 0, transparent = 0, cutout = 0, doubleSided = 0, overlay = 0;

        for (const [key] of this.materialCache) {
            if (key.includes('opaque')) opaque++;
            else if (key.includes('transparent')) transparent++;
            else if (key.includes('cutout')) cutout++;
            else if (key.includes('double_sided')) doubleSided++;
            else if (key.includes('overlay')) overlay++;
        }

        return {
            materials: this.materialCache.size,
            opaque,
            transparent,
            cutout,
            doubleSided,
            overlay
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