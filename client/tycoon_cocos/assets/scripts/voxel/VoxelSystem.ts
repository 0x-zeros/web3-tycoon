import { Vec3 } from 'cc';
import { ResourcePackLoader, getGlobalResourcePackLoader } from './resource/ResourcePackLoader';
import { TextureManager, initializeGlobalTextureManager, getGlobalTextureManager } from './resource/TextureManager';
import { MaterialFactory, initializeGlobalMaterialFactory, getGlobalMaterialFactory } from './resource/MaterialFactory';
import { ModelParser } from './resource/ModelParser';
import { BlockStateParser } from './resource/BlockStateParser';
import { MeshBuilder, VoxelMeshData } from './resource/MeshBuilder';
import { BlockRegistry, BlockDefinition } from './core/VoxelBlock';

/**
 * 体素系统主类 - Minecraft 资源包渲染系统
 * 统一管理资源加载、模型解析、网格生成等功能
 */
export class VoxelSystem {
    private static instance: VoxelSystem | null = null;
    
    private resourceLoader: ResourcePackLoader;
    private textureManager: TextureManager;
    private materialFactory: MaterialFactory;
    private modelParser: ModelParser;
    private initialized: boolean = false;

    private constructor() {
        this.resourceLoader = getGlobalResourcePackLoader();
        this.textureManager = initializeGlobalTextureManager(this.resourceLoader);
        this.materialFactory = initializeGlobalMaterialFactory(this.textureManager);
        this.modelParser = new ModelParser(this.resourceLoader);
    }

    /**
     * 获取体素系统单例
     */
    static getInstance(): VoxelSystem {
        if (!VoxelSystem.instance) {
            VoxelSystem.instance = new VoxelSystem();
        }
        return VoxelSystem.instance;
    }

    /**
     * 初始化体素系统
     */
    async initialize(resourcePackPath?: string): Promise<boolean> {
        if (this.initialized) {
            console.log('[VoxelSystem] 系统已初始化');
            return true;
        }

        console.log('[VoxelSystem] 开始初始化体素渲染系统...');

        try {
            // 1. 加载资源包
            await this.resourceLoader.load();
            
            // 2. 初始化纹理管理器
            await this.textureManager.initialize();
            
            // 3. 预加载常用纹理
            await this.textureManager.preloadCommonTextures();
            
            // 4. 确保方块注册表已初始化
            if (!BlockRegistry.exists('minecraft:stone')) {
                console.warn('[VoxelSystem] 方块注册表未正确初始化');
            }

            this.initialized = true;
            console.log('[VoxelSystem] 体素系统初始化完成');
            
            this.logSystemStats();
            return true;

        } catch (error) {
            console.error('[VoxelSystem] 初始化失败:', error);
            return false;
        }
    }

    /**
     * 生成方块网格数据
     * @param blockId 方块ID（如 "minecraft:stone"）
     * @param position 方块位置
     * @param rotation 方块旋转（可选）
     * @returns 网格数据
     */
    async generateBlockMesh(
        blockId: string, 
        position: Vec3, 
        rotation?: { x: number; y: number; z: number }
    ): Promise<VoxelMeshData | null> {
        
        if (!this.initialized) {
            console.error('[VoxelSystem] 系统未初始化');
            return null;
        }

        try {
            // 1. 获取方块状态
            const blockState = this.resourceLoader.getBlockState(blockId);
            if (!blockState) {
                console.warn(`[VoxelSystem] 方块状态未找到: ${blockId}`);
                return null;
            }

            // 2. 解析方块状态，获取模型信息
            const resolvedState = BlockStateParser.parseBlockState(blockState);
            if (!resolvedState) {
                console.warn(`[VoxelSystem] 方块状态解析失败: ${blockId}`);
                return null;
            }

            // 3. 解析模型
            const model = await this.modelParser.parseModel(resolvedState.modelId);
            if (!model) {
                console.warn(`[VoxelSystem] 模型解析失败: ${resolvedState.modelId}`);
                return null;
            }

            // 4. 构建网格
            const meshBuildContext = {
                blockPosition: position,
                blockRotation: rotation || resolvedState.rotation
            };

            const meshData = MeshBuilder.buildMesh(model, meshBuildContext);
            console.log(`[VoxelSystem] 方块网格生成成功: ${blockId}`);
            
            return meshData;

        } catch (error) {
            console.error(`[VoxelSystem] 生成方块网格失败: ${blockId}`, error);
            return null;
        }
    }

    /**
     * 创建方块材质
     * @param blockId 方块ID
     * @returns 材质对象
     */
    async createBlockMaterial(blockId: string): Promise<any | null> {
        if (!this.initialized) {
            console.error('[VoxelSystem] 系统未初始化');
            return null;
        }

        try {
            const blockDef = BlockRegistry.getBlock(blockId);
            const isEmissive = blockDef ? blockDef.lightLevel > 0 : false;

            // 根据方块类型选择主纹理
            const texturePath = this.getBlockMainTexture(blockId);
            return await this.materialFactory.createBlockMaterial(texturePath, isEmissive);

        } catch (error) {
            console.error(`[VoxelSystem] 创建方块材质失败: ${blockId}`, error);
            return null;
        }
    }

    /**
     * 批量生成方块网格
     * @param blocks 方块信息数组
     * @returns 网格数据数组
     */
    async generateBlockMeshesBatch(
        blocks: Array<{ id: string; position: Vec3; rotation?: { x: number; y: number; z: number } }>
    ): Promise<(VoxelMeshData | null)[]> {
        
        const promises = blocks.map(block => 
            this.generateBlockMesh(block.id, block.position, block.rotation)
        );

        return await Promise.all(promises);
    }

    /**
     * 获取方块主纹理路径
     * @param blockId 方块ID
     * @returns 纹理路径
     */
    private getBlockMainTexture(blockId: string): string {
        // 简化实现：直接使用方块ID作为纹理名
        const textureName = blockId.replace('minecraft:', '');
        return `minecraft:block/${textureName}`;
    }

    /**
     * 检查方块是否存在
     * @param blockId 方块ID
     * @returns 是否存在
     */
    hasBlock(blockId: string): boolean {
        return BlockRegistry.exists(blockId);
    }

    /**
     * 获取方块定义
     * @param blockId 方块ID
     * @returns 方块定义
     */
    getBlockDefinition(blockId: string): BlockDefinition | undefined {
        return BlockRegistry.getBlock(blockId);
    }

    /**
     * 获取所有可用的方块ID
     * @returns 方块ID数组
     */
    getAllBlockIds(): string[] {
        return BlockRegistry.getAllBlockIds();
    }

    /**
     * 获取纹理管理器
     */
    getTextureManager(): TextureManager {
        return this.textureManager;
    }

    /**
     * 获取材质工厂
     */
    getMaterialFactory(): MaterialFactory {
        return this.materialFactory;
    }

    /**
     * 获取资源加载器
     */
    getResourceLoader(): ResourcePackLoader {
        return this.resourceLoader;
    }

    /**
     * 清理系统缓存
     */
    clearCaches(): void {
        this.textureManager.clearCache();
        this.materialFactory.clearCache();
        this.modelParser.clearCache();
        console.log('[VoxelSystem] 缓存已清理');
    }

    /**
     * 输出系统统计信息
     */
    logSystemStats(): void {
        if (!this.initialized) return;

        const textureStats = this.textureManager.getCacheStats();
        const materialStats = this.materialFactory.getCacheStats();
        const modelStats = this.modelParser.getCacheStats();

        console.log('[VoxelSystem] 系统统计:');
        console.log(`- 方块类型: ${BlockRegistry.getAllBlockIds().length}`);
        console.log(`- 纹理缓存: ${textureStats.total} (${textureStats.loaded} 已加载)`);
        console.log(`- 材质缓存: ${materialStats.materials}`);
        console.log(`- 模型缓存: ${modelStats.size}`);
        console.log(`- 内存占用: ${(textureStats.totalMemory / 1024 / 1024).toFixed(2)} MB`);
    }

    /**
     * 获取系统状态
     */
    getSystemStatus(): {
        initialized: boolean;
        blockCount: number;
        textureCount: number;
        materialCount: number;
        modelCount: number;
    } {
        const textureStats = this.initialized ? this.textureManager.getCacheStats() : { total: 0 };
        const materialStats = this.initialized ? this.materialFactory.getCacheStats() : { materials: 0 };
        const modelStats = this.initialized ? this.modelParser.getCacheStats() : { size: 0 };

        return {
            initialized: this.initialized,
            blockCount: BlockRegistry.getAllBlockIds().length,
            textureCount: textureStats.total,
            materialCount: materialStats.materials,
            modelCount: modelStats.size
        };
    }

    /**
     * 销毁体素系统
     */
    destroy(): void {
        if (this.textureManager) {
            this.textureManager.destroy();
        }
        if (this.materialFactory) {
            this.materialFactory.destroy();
        }
        if (this.modelParser) {
            this.modelParser.clearCache();
        }

        VoxelSystem.instance = null;
        this.initialized = false;
        
        console.log('[VoxelSystem] 体素系统已销毁');
    }

    /**
     * 静态方法：快速初始化体素系统
     */
    static async quickInitialize(resourcePackPath?: string): Promise<VoxelSystem | null> {
        try {
            const system = VoxelSystem.getInstance();
            const success = await system.initialize(resourcePackPath);
            return success ? system : null;
        } catch (error) {
            console.error('[VoxelSystem] 快速初始化失败:', error);
            return null;
        }
    }
}

// 导出全局访问函数
export function getVoxelSystem(): VoxelSystem {
    return VoxelSystem.getInstance();
}

export function isVoxelSystemReady(): boolean {
    return VoxelSystem.getInstance().getSystemStatus().initialized;
}