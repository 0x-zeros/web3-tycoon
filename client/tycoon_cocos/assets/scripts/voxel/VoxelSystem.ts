import { Vec3, Node, MeshRenderer } from 'cc';
import { BlockParser } from './resource_pack/BlockParser';
import { isCross, ParsedBlockData } from './resource_pack/types';
import { TextureManager, initializeGlobalTextureManager, getGlobalTextureManager } from './resource/TextureManager';
import { MaterialFactory, initializeGlobalMaterialFactory, getGlobalMaterialFactory } from './resource/MaterialFactory';
import { MeshBuilder, VoxelMeshData } from './resource/MeshBuilder';
import { BlockRegistry, BlockDefinition } from './core/VoxelBlock';
import { WEB3_BLOCKS, getWeb3TileBlocks, getWeb3ObjectBlocks, getAllWeb3BlockIds, Web3BlockInfo } from './Web3BlockTypes';

/**
 * 体素系统主类 - Minecraft 资源包渲染系统
 * 统一管理资源加载、模型解析、网格生成等功能
 */
export class VoxelSystem {
    private static instance: VoxelSystem | null = null;
    
    private blockParser: BlockParser;
    private textureManager: TextureManager;
    private materialFactory: MaterialFactory;
    private blockCache: Map<string, ParsedBlockData> = new Map();
    private initialized: boolean = false;
    private overlayEnabled: boolean = false; // overlay 功能开关（默认关闭）
    private rootDir: string = 'voxel/resource_pack';

    private constructor() {
        // 使用新的 BlockParser
        this.blockParser = new BlockParser({
            rootDir: this.rootDir,
            searchRoots: [this.rootDir],
            defaultNamespace: 'minecraft'
        });
        
        // 初始化纹理管理器和材质工厂
        this.textureManager = initializeGlobalTextureManager();
        this.materialFactory = initializeGlobalMaterialFactory(this.textureManager);
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
            // 1. 初始化纹理管理器
            await this.textureManager.initialize(this.rootDir);
            
            // 2. 确保方块注册表已初始化
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
            const blockData = await this.getBlockData(blockId);

            // 4. 构建网格上下文
            const meshBuildContext = {
                blockPosition: position,
                blockRotation: rotation || { x: 0, y: blockData.rotationY || 0, z: 0 },
                blockId: blockId // 传递方块ID用于光照计算
            };

            if (this.overlayEnabled) {
                // 通用 Overlay 检测：如果模型任一元素的侧面使用 *_side_overlay 纹理，则采用双子网格方案
                const overlayInfo = this.detectOverlayInfo(blockData);
                if (overlayInfo) {
                    console.log(`[VoxelSystem] 检测到 overlay 方案: ${blockId} overlay=${overlayInfo.overlaySideTexture}`);
                    const { baseMesh, overlayMesh } = MeshBuilder.buildOverlayBlockMeshes(blockData, meshBuildContext);

                    const meshData: VoxelMeshData = {
                        vertices: [],
                        indices: [],
                        textureGroups: new Map(),
                        hasOverlay: true,
                        overlayMeshes: { base: baseMesh, overlay: overlayMesh },
                        overlayInfo
                    };
                    return meshData;
                }
            }

            // 5. 使用新的数据结构构建网格
            const meshData = MeshBuilder.buildMesh(blockData, meshBuildContext);
            console.log(`[VoxelSystem] 普通方块网格生成成功: ${blockId}`);
            return meshData;

        } catch (error) {
            console.error(`[VoxelSystem] 生成方块网格失败: ${blockId}`, error);
            return null;
        }
    }

    /**
     * 检测模型是否具有侧面 overlay 纹理（如 *_side_overlay）
     * 返回基础侧面纹理和 overlay 侧面纹理
     */
    private detectOverlayInfo(blockData: ParsedBlockData): { baseSideTexture: string; overlaySideTexture: string } | null {
        try {
            // 扫描所有元素的四个侧面纹理
            const sideNames = ['north', 'south', 'east', 'west'];
            for (const element of blockData.elements || []) {
                for (const face of element.faces) {
                    if (sideNames.indexOf(face.dir) === -1) continue;
                    
                    // 通过 textureKey 查找纹理信息
                    const textureInfo = blockData.textures.find(t => t.key === face.textureKey);
                    if (!textureInfo) continue;
                    
                    const texName = textureInfo.name;
                    if (texName.includes('_side_overlay')) {
                        const overlaySideTexture = texName;
                        const baseSideTexture = texName.replace('_side_overlay', '_side');
                        return {
                            baseSideTexture,
                            overlaySideTexture
                        };
                    }
                }
            }
            return null;
        } catch (e) {
            console.warn('[VoxelSystem] detectOverlayInfo 失败，按普通方块处理', e);
            return null;
        }
    }

    /**
     * 预加载方块材质（避免粉色闪烁）
     * @param blockId 方块ID
     */
    async preloadBlockMaterial(blockId: string): Promise<void> {
        if (!this.initialized) {
            console.error('[VoxelSystem] 系统未初始化');
            return;
        }

        try {
            const blockDef = BlockRegistry.getBlock(blockId);
            const isEmissive = blockDef ? blockDef.lightLevel > 0 : false;

            // 根据方块类型选择主纹理
            const texturePath = this.getBlockMainTexture(blockId);
            
            // 预加载纹理资源（通过MaterialFactory的公共方法）
            await this.materialFactory.preloadTexture(texturePath);
            
            console.log(`[VoxelSystem] Preloaded material for ${blockId}`);
        } catch (error) {
            console.error(`[VoxelSystem] 预加载方块材质失败: ${blockId}`, error);
        }
    }

    /**
     * 创建方块材质
     * @param blockId 方块ID
     * @returns 材质对象
     */
    async createBlockMaterial(blockId: string, texturePath?: string): Promise<any | null> {
        if (!this.initialized) {
            console.error('[VoxelSystem] 系统未初始化');
            return null;
        }

        try {
            const blockDef = BlockRegistry.getBlock(blockId);
            const blockData = await this.getBlockData(blockId);
            return await this.materialFactory.createBlockMaterial(texturePath, blockData, blockDef);

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
        // 规范化输入，支持以下形式：
        // - "minecraft:grass_block"
        // - "minecraft:block/grass_block"
        // - "web3:empty_land"
        // - "web3:block/empty_land"
        // - "block/grass_block"
        // - "grass_block"
        let id = blockId.trim();
        
        // 处理 web3 命名空间
        if (id.startsWith('web3:block/')) {
            return id;
        }
        if (id.startsWith('web3:')) {
            const name = id.substring('web3:'.length);
            return `web3:block/${name}`;
        }
        
        // 处理 minecraft 命名空间
        if (id.startsWith('minecraft:block/')) {
            return id;
        }
        if (id.startsWith('minecraft:')) {
            id = id.substring('minecraft:'.length);
            return `minecraft:block/${id}`;
        }
        
        // 处理无命名空间的情况（默认 minecraft）
        if (id.startsWith('block/')) {
            id = id.substring('block/'.length);
        }
        return `minecraft:block/${id}`;
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
        // 优先返回Web3方块，然后是默认方块
        const web3Ids = getAllWeb3BlockIds();
        const defaultIds = BlockRegistry.getAllBlockIds();
        
        // 合并去重，Web3方块优先
        const allIds = [...web3Ids];
        for (const id of defaultIds) {
            if (allIds.indexOf(id) === -1) {
                allIds.push(id);
            }
        }
        return allIds;
    }

    /**
     * 获取所有Web3方块ID
     * @returns Web3方块ID数组
     */
    getWeb3BlockIds(): string[] {
        return getAllWeb3BlockIds();
    }

    /**
     * 获取Web3地块类型方块
     * @returns Web3地块方块信息数组
     */
    getWeb3TileBlocks(): Web3BlockInfo[] {
        return getWeb3TileBlocks();
    }

    /**
     * 获取Web3物体类型方块
     * @returns Web3物体方块信息数组
     */
    getWeb3ObjectBlocks(): Web3BlockInfo[] {
        return getWeb3ObjectBlocks();
    }

    /**
     * 获取所有Web3方块信息
     * @returns Web3方块信息数组
     */
    getAllWeb3Blocks(): Web3BlockInfo[] {
        return WEB3_BLOCKS;
    }

    /**
     * 设置 overlay 功能开关
     */
    setOverlayEnabled(enabled: boolean): void {
        this.overlayEnabled = !!enabled;
        console.log(`[VoxelSystem] Overlay 功能 ${this.overlayEnabled ? '已开启' : '已关闭'}`);
    }

    /**
     * 查询 overlay 功能是否开启
     */
    isOverlayEnabled(): boolean {
        return this.overlayEnabled;
    }

    /**
     * 返回常用的基础方块 ID 列表（不扫描 blockstates，固定清单）
     */
    getCommonBlockIds(): string[] {
        return [
            'minecraft:stone',
            'minecraft:dirt',
            'minecraft:grass_block',
            'minecraft:sand',
            'minecraft:cobblestone',
            'minecraft:oak_log',
            'minecraft:oak_planks',
            'minecraft:oak_leaves',
            'minecraft:glass'
        ];
    }

    /**
     * 生成一个方块 Node 并挂到 parent 下（按需加载资源，内部封装网格与材质创建）
     */
    async createBlockNode(parent: Node, blockId: string, position: Vec3): Promise<Node | null> {
        try {
            if (!this.initialized) {
                console.error('[VoxelSystem] 系统未初始化');
                return null;
            }
            
            const blockData = await this.getBlockData(blockId);

            // 生成网格数据
            const meshData = await this.generateBlockMesh(blockId, position);
            if (!meshData) return null;

            console.log(`[VoxelSystem] ${blockId} meshData:`, meshData);

            // 创建方块节点（先不添加到场景，避免粉色闪烁）
            const blockNode = new Node(`Block_${blockId.replace('minecraft:', '')}`);//todo
            blockNode.position = position;
            // 暂时不添加到父节点，等材质加载完成后再添加

            // Overlay 情况暂不在此处处理，统一走普通纹理组（overlay 分支可后续打开）
            if (meshData.textureGroups.size === 0) {
                console.warn('[VoxelSystem] 纹理组为空，取消创建:', blockId);
                blockNode.destroy();
                return null;
            }

            for (const [key, textureGroup] of meshData.textureGroups) {//now, key is texturePath
                if (!textureGroup || textureGroup.vertices.length === 0) continue;

                const subNode = new Node('SubMesh');
                blockNode.addChild(subNode);

                // 网格
                const mesh = MeshBuilder.createCocosMesh({
                    vertices: [],
                    indices: [],
                    textureGroups: new Map([[key, textureGroup]])
                } as any, key);
                if (!mesh) continue;

                const mr = subNode.addComponent(MeshRenderer);
                mr.mesh = mesh;

                // 材质
                const material = await this.createBlockMaterial(blockId, textureGroup.texture);
                if (material) mr.material = material;
            }

            // 所有材质加载完成后，再添加到场景中
            parent.addChild(blockNode);

            return blockNode;
        } catch (e) {
            console.error('[VoxelSystem] createBlockNode 失败:', blockId, e);
            return null;
        }
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
     * 获取方块解析器
     */
    getBlockParser(): BlockParser {
        return this.blockParser;
    }

    /**
     * 清理系统缓存（不清理纹理缓存，纹理永久保留以提高性能）
     */
    clearCaches(): void {
        // 不清理纹理缓存，保持永久缓存以提高性能
        // this.textureManager.clearCache();
        
        // 清理材质和解析器缓存
        this.materialFactory.clearCache();
        this.blockParser.clearCache();
        this.blockCache.clear();
        console.log('[VoxelSystem] 缓存已清理（纹理缓存保留）');
    }

    async getBlockData(blockId: string): Promise<ParsedBlockData | null> {
    
        // 1. 检查缓存
        let blockData = this.blockCache.get(blockId);
    
        if (!blockData) {
            // 2. 使用新的 BlockParser 解析方块
            blockData = await this.blockParser.parseBlock(blockId);
            if (!blockData) {
                console.warn(`[VoxelSystem] 方块解析失败: ${blockId}`);
                return null;
            }
            
            // 3. 缓存解析结果
            this.blockCache.set(blockId, blockData);
        }

        return blockData;
    }

    /**
     * 输出系统统计信息
     */
    logSystemStats(): void {
        if (!this.initialized) return;

        const textureStats = this.textureManager.getCacheStats();
        const materialStats = this.materialFactory.getCacheStats();
        const parserStats = this.blockParser.getCacheStats();

        console.log('[VoxelSystem] 系统统计:');
        console.log(`- 方块类型: ${BlockRegistry.getAllBlockIds().length}`);
        console.log(`- 纹理缓存: ${textureStats.total} (${textureStats.loaded} 已加载)`);
        console.log(`- 材质缓存: ${materialStats.materials}`);
        console.log(`- 方块缓存: ${this.blockCache.size}`);
        console.log(`- 解析器缓存: JSON=${parserStats.jsonCache}, 纹理检查=${parserStats.textureCheckCache}`);
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

        return {
            initialized: this.initialized,
            blockCount: BlockRegistry.getAllBlockIds().length,
            textureCount: textureStats.total,
            materialCount: materialStats.materials,
            modelCount: this.blockCache.size
        };
    }

    /**
     * 销毁体素系统（保留纹理缓存以供下次使用）
     */
    destroy(): void {
        // 不销毁纹理管理器，保持纹理缓存
        // if (this.textureManager) {
        //     this.textureManager.destroy();
        // }
        
        if (this.materialFactory) {
            this.materialFactory.destroy();
        }
        if (this.blockParser) {
            this.blockParser.clearCache();
        }
        this.blockCache.clear();

        VoxelSystem.instance = null;
        this.initialized = false;
        
        console.log('[VoxelSystem] 体素系统已销毁（纹理缓存保留）');
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