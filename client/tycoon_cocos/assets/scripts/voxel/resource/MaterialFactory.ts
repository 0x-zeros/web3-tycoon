import { Material, Texture2D, gfx } from 'cc';
import { TextureManager } from './TextureManager';

export enum MaterialType {
    OPAQUE = 'opaque',
    TRANSPARENT = 'transparent',
    CUTOUT = 'cutout',
    DOUBLE_SIDED = 'double_sided',
    PLANT = 'plant',
    EMISSIVE = 'emissive'
}

export interface MaterialConfig {
    type: MaterialType;
    texture: string;
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
        VOXEL_EMISSIVE: 'voxel-emissive'
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

        // 选择着色器和技术
        const shaderInfo = this.selectShaderAndTechnique(config);
        
        // 创建材质
        const material = new Material();
        material.initialize({
            effectName: shaderInfo.shader,
            technique: shaderInfo.technique
        });

        // 设置纹理
        material.setProperty('mainTexture', textureInfo.texture);
        
        // 设置天空盒纹理（如果可用）
        if (textureInfo.skyTexture) {
            material.setProperty('skyTexture', textureInfo.skyTexture);
        }

        // 设置体素着色器通用参数
        this.setVoxelShaderUniforms(material, config);

        // 配置材质属性（渲染状态等）
        this.configureMaterial(material, config);

        return material;
    }

    /**
     * 选择适当的着色器和技术
     * @param config 材质配置
     * @returns 着色器信息
     */
    private selectShaderAndTechnique(config: MaterialConfig): { shader: string, technique: string } {
        switch (config.type) {
            case MaterialType.OPAQUE:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 'opaque' };
            case MaterialType.TRANSPARENT:
            case MaterialType.DOUBLE_SIDED:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 'transparent' };
            case MaterialType.CUTOUT:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 'cutout' };
            case MaterialType.PLANT:
                return { shader: MaterialFactory.SHADERS.VOXEL_PLANT, technique: 'plant' };
            case MaterialType.EMISSIVE:
                return { shader: MaterialFactory.SHADERS.VOXEL_EMISSIVE, technique: 'emissive' };
            default:
                return { shader: MaterialFactory.SHADERS.VOXEL_BLOCK, technique: 'opaque' };
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
        }

        // 发光配置
        if (config.emissive) {
            this.configureEmissive(material, config);
        }
    }

    /**
     * 设置体素着色器通用参数
     */
    private setVoxelShaderUniforms(material: Material, config: MaterialConfig): void {
        // 通用参数
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