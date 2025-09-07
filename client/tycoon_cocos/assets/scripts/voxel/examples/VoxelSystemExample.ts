import { _decorator, Component, Node, MeshRenderer, Vec3, Camera, Material, director } from 'cc';
import { VoxelSystem, getVoxelSystem } from '../VoxelSystem';
import { MeshBuilder } from '../resource/MeshBuilder';
// import { CameraController } from '../../camera/CameraController';

const { ccclass, property } = _decorator;

/**
 * 体素系统测试组件
 * 用于验证新的 Minecraft 资源包渲染系统
 */
@ccclass('VoxelSystemExample')
export class VoxelSystemExample extends Component {

    @property(Node)
    public containerNode: Node | null = null;

    @property(Camera)
    public camera: Camera | null = null;

    // 世界生成配置属性
    @property({ tooltip: "世界大小 (N x N)" })
    public worldSize: number = 100;

    @property({ tooltip: "植物密度 (0.0-1.0，表示植物方块占总方块数的比例)" })
    public plantDensity: number = 0.1;

    @property({ tooltip: "发光方块密度 (0.0-1.0，表示发光方块占总方块数的比例)" })
    public glowingBlockDensity: number = 0.05;

    @property({ tooltip: "每批处理的方块数量 (影响生成速度和内存使用)" })
    public batchSize: number = 1000;

    @property({ tooltip: "批次间延迟 (毫秒，避免卡顿)" })
    public batchDelay: number = 50;

    private voxelSystem: VoxelSystem | null = null;
    private testBlocks: { id: string; position: Vec3; node?: Node }[] = [];

    async onLoad() {
        console.log('[VoxelSystemExample] 开始测试体素系统...');

        if (!this.containerNode) {
            this.containerNode = new Node('VoxelContainer');
            this.node.addChild(this.containerNode);
        }

        if (!this.camera) {
            // 尝试查找场景中的相机
            const cameraNode = director.getScene()?.getComponentInChildren(Camera);
            this.camera = cameraNode || null;
            if (!this.camera) {
                console.warn('[VoxelSystemExample] 请在Inspector中设置Camera引用');
            }
        }

        // 初始化体素系统
        await this.initializeVoxelSystem();

        // 创建测试方块
        await this.createTestBlocks();
        // await this.generateLargeWorld();
    }

    /**
     * 初始化体素系统
     */
    private async initializeVoxelSystem(): Promise<void> {
        console.log('[VoxelSystemExample] 初始化体素系统...');
        
        try {
            this.voxelSystem = await VoxelSystem.quickInitialize();
            if (!this.voxelSystem) {
                throw new Error('体素系统初始化失败');
            }

            console.log('[VoxelSystemExample] 体素系统初始化成功');
            this.voxelSystem.logSystemStats();

        } catch (error) {
            console.error('[VoxelSystemExample] 体素系统初始化失败:', error);
        }
    }

    /**
     * 创建测试方块
     */
    private async createTestBlocks(): Promise<void> {
        if (!this.voxelSystem) {
            console.error('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        console.log('[VoxelSystemExample] 创建测试方块...');

        // 定义测试方块
        this.testBlocks = [
            // 第一排：基础方块
            { id: 'minecraft:stone', position: new Vec3(-4, 0, 0) },
            { id: 'minecraft:dirt', position: new Vec3(-3, 0, 0) },
            { id: 'minecraft:grass_block', position: new Vec3(-2, 0, 0) },
            { id: 'minecraft:sand', position: new Vec3(-1, 0, 0) },
            { id: 'minecraft:cobblestone', position: new Vec3(0, 0, 0) },

            // 第二排：木质方块
            { id: 'minecraft:oak_log', position: new Vec3(-4, 0, 1) },
            { id: 'minecraft:oak_planks', position: new Vec3(-3, 0, 1) },
            { id: 'minecraft:oak_leaves', position: new Vec3(-2, 0, 1) },

            // 第三排：透明方块
            { id: 'minecraft:glass', position: new Vec3(-4, 0, 2) },

            // 第四排：植物（交叉模型）
            { id: 'minecraft:dandelion', position: new Vec3(-4, 0, 3) },
            { id: 'minecraft:poppy', position: new Vec3(-3, 0, 3) },
            { id: 'minecraft:short_grass', position: new Vec3(-2, 0, 3) },
            { id: 'minecraft:fern', position: new Vec3(-1, 0, 3) }
        ];

        // 并行创建所有方块
        const creationPromises = this.testBlocks.map(block => this.createSingleBlock(block));
        await Promise.all(creationPromises);

        console.log(`[VoxelSystemExample] 成功创建 ${this.testBlocks.length} 个测试方块`);
    }

    /**
     * 生成大型体素世界
     */
    public async generateLargeWorld(): Promise<void> {
        if (!this.voxelSystem) {
            console.error('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        // 验证配置参数
        this.validateConfiguration();

        console.log(`[VoxelSystemExample] 开始生成${this.worldSize}x${this.worldSize}体素世界...`);
        console.log(`[VoxelSystemExample] 配置参数: 世界大小=${this.worldSize}, 植物密度=${this.plantDensity}, 发光方块密度=${this.glowingBlockDensity}`);
        const startTime = Date.now();

        // 清除现有方块
        this.clearTestBlocks();

        // 定义方块类型
        const blockTypes = this.getBlockTypes();
        const plantTypes = this.getPlantTypes();
        const glowingTypes = this.getGlowingBlockTypes();

        const blocks: { id: string; position: Vec3 }[] = [];

        // 生成y=0层的基础方块
        console.log('[VoxelSystemExample] 生成y=0层基础方块...');
        for (let x = 0; x < this.worldSize; x++) {
            for (let z = 0; z < this.worldSize; z++) {
                const blockType = this.getRandomBlockType(blockTypes, x, z);
                blocks.push({
                    id: blockType,
                    position: new Vec3(x, 0, z)
                });
            }
        }

        // 生成y=1层的植物（随机放置）
        console.log('[VoxelSystemExample] 生成y=1层植物...');
        const plantCount = Math.floor(this.worldSize * this.worldSize * this.plantDensity);
        for (let i = 0; i < plantCount; i++) {
            const x = Math.floor(Math.random() * this.worldSize);
            const z = Math.floor(Math.random() * this.worldSize);
            const plantType = plantTypes[Math.floor(Math.random() * plantTypes.length)];
            blocks.push({
                id: plantType,
                position: new Vec3(x, 1, z)
            });
        }

        // 生成y=5层的发光方块（随机放置）
        console.log('[VoxelSystemExample] 生成y=5层发光方块...');
        const glowingCount = Math.floor(this.worldSize * this.worldSize * this.glowingBlockDensity);
        for (let i = 0; i < glowingCount; i++) {
            const x = Math.floor(Math.random() * this.worldSize);
            const z = Math.floor(Math.random() * this.worldSize);
            const glowingType = glowingTypes[Math.floor(Math.random() * glowingTypes.length)];
            blocks.push({
                id: glowingType,
                position: new Vec3(x, 5, z)
            });
        }

        console.log(`[VoxelSystemExample] 总共需要创建 ${blocks.length} 个方块`);
        console.log(`[VoxelSystemExample] 基础方块: ${this.worldSize * this.worldSize} 个`);
        console.log(`[VoxelSystemExample] 植物方块: ${plantCount} 个`);
        console.log(`[VoxelSystemExample] 发光方块: ${glowingCount} 个`);

        // 分批创建方块以避免内存问题
        const totalBatches = Math.ceil(blocks.length / this.batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * this.batchSize;
            const endIndex = Math.min(startIndex + this.batchSize, blocks.length);
            const batch = blocks.slice(startIndex, endIndex);

            console.log(`[VoxelSystemExample] 创建批次 ${batchIndex + 1}/${totalBatches} (${batch.length} 个方块)`);

            // 并行创建当前批次的方块
            const creationPromises = batch.map(block => this.createSingleBlock(block));
            await Promise.all(creationPromises);

            // 添加小延迟避免卡顿
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }
        }

        this.testBlocks = blocks;
        const endTime = Date.now();
        console.log(`[VoxelSystemExample] ${this.worldSize}x${this.worldSize}体素世界生成完成！耗时: ${endTime - startTime}ms`);
    }

    /**
     * 获取基础方块类型
     */
    private getBlockTypes(): string[] {
        return [
            // 基础方块
            'minecraft:stone',
            'minecraft:dirt',
            'minecraft:grass_block',
            'minecraft:sand',
            'minecraft:cobblestone',
            'minecraft:gravel',
            'minecraft:clay',
            'minecraft:coarse_dirt',
            'minecraft:podzol',
            'minecraft:mycelium',
            
            // 木质方块
            'minecraft:oak_log',
            'minecraft:birch_log',
            'minecraft:spruce_log',
            'minecraft:jungle_log',
            'minecraft:acacia_log',
            'minecraft:dark_oak_log',
            'minecraft:oak_planks',
            'minecraft:birch_planks',
            'minecraft:spruce_planks',
            'minecraft:jungle_planks',
            'minecraft:acacia_planks',
            'minecraft:dark_oak_planks',
            
            // 矿物方块
            'minecraft:coal_ore',
            'minecraft:iron_ore',
            'minecraft:gold_ore',
            'minecraft:diamond_ore',
            'minecraft:emerald_ore',
            'minecraft:lapis_ore',
            'minecraft:redstone_ore',
            'minecraft:copper_ore',
            
            // 装饰方块
            'minecraft:oak_leaves',
            'minecraft:birch_leaves',
            'minecraft:spruce_leaves',
            'minecraft:jungle_leaves',
            'minecraft:acacia_leaves',
            'minecraft:dark_oak_leaves',
            'minecraft:glass',
            'minecraft:ice',
            'minecraft:snow_block',
            'minecraft:water',
            'minecraft:lava'
        ];
    }

    /**
     * 获取植物类型
     */
    private getPlantTypes(): string[] {
        return [
            'minecraft:dandelion',
            'minecraft:poppy',
            'minecraft:blue_orchid',
            'minecraft:allium',
            'minecraft:azure_bluet',
            'minecraft:red_tulip',
            'minecraft:orange_tulip',
            'minecraft:white_tulip',
            'minecraft:pink_tulip',
            'minecraft:oxeye_daisy',
            'minecraft:cornflower',
            'minecraft:lily_of_the_valley',
            'minecraft:sunflower',
            'minecraft:lilac',
            'minecraft:rose_bush',
            'minecraft:peony',
            'minecraft:tall_grass',
            'minecraft:short_grass',
            'minecraft:fern',
            'minecraft:large_fern',
            'minecraft:dead_bush',
            'minecraft:cactus',
            'minecraft:sugar_cane',
            'minecraft:bamboo',
            'minecraft:kelp',
            'minecraft:seagrass',
            'minecraft:sea_pickle',
            'minecraft:vine',
            'minecraft:lily_pad',
            'minecraft:nether_wart',
            'minecraft:crimson_fungus',
            'minecraft:warped_fungus',
            'minecraft:crimson_roots',
            'minecraft:warped_roots',
            'minecraft:nether_sprouts',
            'minecraft:weeping_vines',
            'minecraft:twisting_vines'
        ];
    }

    /**
     * 获取发光方块类型
     */
    private getGlowingBlockTypes(): string[] {
        return [
            'minecraft:glowstone',
            'minecraft:sea_lantern',
            'minecraft:end_rod',
            'minecraft:beacon',
            'minecraft:redstone_lamp',
            'minecraft:torch',
            'minecraft:wall_torch',
            'minecraft:redstone_torch',
            'minecraft:redstone_wall_torch',
            'minecraft:soul_torch',
            'minecraft:soul_wall_torch',
            'minecraft:lantern',
            'minecraft:soul_lantern',
            'minecraft:campfire',
            'minecraft:soul_campfire',
            'minecraft:fire',
            'minecraft:soul_fire',
            'minecraft:end_crystal',
            'minecraft:respawn_anchor',
            'minecraft:conduit',
            'minecraft:jack_o_lantern',
            'minecraft:shroomlight',
            'minecraft:magma_block',
            'minecraft:lava',
            'minecraft:end_portal',
            'minecraft:nether_portal',
            'minecraft:end_gateway',
            'minecraft:lightning_rod',
            'minecraft:candle',
            'minecraft:white_candle',
            'minecraft:orange_candle',
            'minecraft:magenta_candle',
            'minecraft:light_blue_candle',
            'minecraft:yellow_candle',
            'minecraft:lime_candle',
            'minecraft:pink_candle',
            'minecraft:gray_candle',
            'minecraft:light_gray_candle',
            'minecraft:cyan_candle',
            'minecraft:purple_candle',
            'minecraft:blue_candle',
            'minecraft:brown_candle',
            'minecraft:green_candle',
            'minecraft:red_candle',
            'minecraft:black_candle'
        ];
    }

    /**
     * 验证配置参数
     */
    private validateConfiguration(): void {
        // 验证世界大小
        if (this.worldSize < 1 || this.worldSize > 1000) {
            console.warn(`[VoxelSystemExample] 世界大小 ${this.worldSize} 超出合理范围，重置为 100`);
            this.worldSize = 100;
        }

        // 验证植物密度
        if (this.plantDensity < 0 || this.plantDensity > 1) {
            console.warn(`[VoxelSystemExample] 植物密度 ${this.plantDensity} 超出范围 [0,1]，重置为 0.1`);
            this.plantDensity = 0.1;
        }

        // 验证发光方块密度
        if (this.glowingBlockDensity < 0 || this.glowingBlockDensity > 1) {
            console.warn(`[VoxelSystemExample] 发光方块密度 ${this.glowingBlockDensity} 超出范围 [0,1]，重置为 0.05`);
            this.glowingBlockDensity = 0.05;
        }

        // 验证批次大小
        if (this.batchSize < 1 || this.batchSize > 10000) {
            console.warn(`[VoxelSystemExample] 批次大小 ${this.batchSize} 超出合理范围，重置为 1000`);
            this.batchSize = 1000;
        }

        // 验证批次延迟
        if (this.batchDelay < 0 || this.batchDelay > 1000) {
            console.warn(`[VoxelSystemExample] 批次延迟 ${this.batchDelay} 超出合理范围，重置为 50`);
            this.batchDelay = 50;
        }
    }

    /**
     * 根据位置获取随机方块类型（用于创建地形变化）
     */
    private getRandomBlockType(blockTypes: string[], x: number, z: number): string {
        // 使用位置作为种子创建伪随机数，确保相同位置总是生成相同的方块
        const seed = x * 1000 + z;
        const random = this.seededRandom(seed);
        
        // 根据位置创建不同的地形区域
        const centerX = this.worldSize / 2;
        const centerZ = this.worldSize / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        const maxDistance = Math.sqrt(centerX ** 2 + centerZ ** 2);
        
        // 中心区域：草地 (20% 区域)
        if (distanceFromCenter < maxDistance * 0.2) {
            const grassBlocks = ['minecraft:grass_block', 'minecraft:dirt', 'minecraft:stone'];
            return grassBlocks[Math.floor(random * grassBlocks.length)];
        }
        
        // 中等距离：混合地形 (40% 区域)
        if (distanceFromCenter < maxDistance * 0.4) {
            const mixedBlocks = [
                'minecraft:grass_block', 'minecraft:dirt', 'minecraft:stone', 
                'minecraft:sand', 'minecraft:gravel', 'minecraft:clay'
            ];
            return mixedBlocks[Math.floor(random * mixedBlocks.length)];
        }
        
        // 边缘区域：更多矿物和特殊方块 (60% 区域)
        if (distanceFromCenter < maxDistance * 0.6) {
            const edgeBlocks = [
                'minecraft:stone', 'minecraft:cobblestone', 'minecraft:gravel',
                'minecraft:coal_ore', 'minecraft:iron_ore', 'minecraft:gold_ore',
                'minecraft:sand', 'minecraft:clay'
            ];
            return edgeBlocks[Math.floor(random * edgeBlocks.length)];
        }
        
        // 最外层：稀有矿物和特殊方块 (剩余区域)
        const rareBlocks = [
            'minecraft:stone', 'minecraft:diamond_ore', 'minecraft:emerald_ore',
            'minecraft:lapis_ore', 'minecraft:redstone_ore', 'minecraft:copper_ore',
            'minecraft:obsidian', 'minecraft:netherrack', 'minecraft:end_stone'
        ];
        return rareBlocks[Math.floor(random * rareBlocks.length)];
    }

    /**
     * 种子随机数生成器
     */
    private seededRandom(seed: number): number {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    /**
     * 创建单个方块
     */
    private async createSingleBlock(blockInfo: { id: string; position: Vec3; node?: Node }): Promise<void> {
        try {
            console.log(`[VoxelSystemExample] 创建方块: ${blockInfo.id}`);

            // 1. 生成网格数据
            const meshData = await this.voxelSystem!.generateBlockMesh(blockInfo.id, blockInfo.position);
            if (!meshData) {
                console.warn(`[VoxelSystemExample] 方块网格生成失败: ${blockInfo.id}`);
                return;
            }

            // 2. 创建节点
            const blockNode = new Node(`Block_${blockInfo.id.replace('minecraft:', '')}`);
            blockNode.position = blockInfo.position; // 设置方块在场景中的位置
            this.containerNode!.addChild(blockNode);
            blockInfo.node = blockNode;

            // 3. 为每个纹理组创建子网格
            await this.createBlockSubMeshes(blockNode, meshData, blockInfo.id);

            console.log(`[VoxelSystemExample] 方块创建成功: ${blockInfo.id}`);

        } catch (error) {
            console.error(`[VoxelSystemExample] 创建方块失败: ${blockInfo.id}`, error);
        }
    }

    /**
     * 为方块创建子网格（按纹理分组）
     */
    private async createBlockSubMeshes(blockNode: Node, meshData: any, blockId: string): Promise<void> {
        let subMeshIndex = 0;

        console.log(`[VoxelSystemExample] createBlockSubMeshes: textureGroups数量=${meshData.textureGroups.size}`);
        for (const [texturePath, textureGroup] of meshData.textureGroups) {
            try {
                console.log(`[VoxelSystemExample]   处理纹理组: ${texturePath}, 顶点数=${textureGroup.vertices.length}`);
                
                // 1. 创建子节点
                const subMeshNode = new Node(`SubMesh_${subMeshIndex}`);
                blockNode.addChild(subMeshNode);

                // 2. 创建网格
                const mesh = MeshBuilder.createCocosMesh(meshData, texturePath);
                if (!mesh) {
                    console.warn(`[VoxelSystemExample] 子网格创建失败: ${texturePath}`);
                    continue;
                }
                console.log(`[VoxelSystemExample]   mesh创建成功: ${texturePath}`);

                // 3. 添加MeshRenderer组件
                const meshRenderer = subMeshNode.addComponent(MeshRenderer);
                meshRenderer.mesh = mesh;

                // 4. 创建并设置材质
                const material = await this.voxelSystem!.createBlockMaterial(blockId);
                if (material) {
                    meshRenderer.material = material;
                } else {
                    console.warn(`[VoxelSystemExample] 材质创建失败: ${blockId}`);
                }

                subMeshIndex++;

            } catch (error) {
                console.error(`[VoxelSystemExample] 创建子网格失败: ${texturePath}`, error);
            }
        }
    }

    /**
     * 动态添加方块（用于测试）
     */
    public async addTestBlock(blockId: string, position: Vec3): Promise<void> {
        if (!this.voxelSystem) {
            console.error('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        const blockInfo = { id: blockId, position };
        this.testBlocks.push(blockInfo);
        await this.createSingleBlock(blockInfo);
    }

    /**
     * 清除所有测试方块
     */
    public clearTestBlocks(): void {
        for (const block of this.testBlocks) {
            if (block.node && block.node.isValid) {
                block.node.destroy();
            }
        }
        this.testBlocks = [];
        console.log('[VoxelSystemExample] 所有测试方块已清除');
    }

    /**
     * 重新创建测试方块（用于测试重载）
     */
    public async recreateTestBlocks(): Promise<void> {
        this.clearTestBlocks();
        
        // 清理系统缓存
        if (this.voxelSystem) {
            this.voxelSystem.clearCaches();
        }
        
        // 重新创建
        await this.createTestBlocks();
    }

    /**
     * 显示系统信息
     */
    public logSystemInfo(): void {
        if (!this.voxelSystem) {
            console.log('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        const status = this.voxelSystem.getSystemStatus();
        console.log('[VoxelSystemExample] 系统状态:', status);
        
        const availableBlocks = this.voxelSystem.getAllBlockIds();
        console.log(`[VoxelSystemExample] 可用方块 (${availableBlocks.length}):`, availableBlocks);
        
        this.voxelSystem.logSystemStats();
    }

    /**
     * 显示当前配置信息
     */
    public logConfiguration(): void {
        console.log('[VoxelSystemExample] 当前配置:');
        console.log(`  世界大小: ${this.worldSize}x${this.worldSize}`);
        console.log(`  植物密度: ${this.plantDensity} (${Math.floor(this.worldSize * this.worldSize * this.plantDensity)} 个植物)`);
        console.log(`  发光方块密度: ${this.glowingBlockDensity} (${Math.floor(this.worldSize * this.worldSize * this.glowingBlockDensity)} 个发光方块)`);
        console.log(`  批次大小: ${this.batchSize}`);
        console.log(`  批次延迟: ${this.batchDelay}ms`);
        console.log(`  预计总方块数: ${this.worldSize * this.worldSize + Math.floor(this.worldSize * this.worldSize * this.plantDensity) + Math.floor(this.worldSize * this.worldSize * this.glowingBlockDensity)}`);
    }

    /**
     * 重置配置为默认值
     */
    public resetConfiguration(): void {
        this.worldSize = 100;
        this.plantDensity = 0.1;
        this.glowingBlockDensity = 0.05;
        this.batchSize = 1000;
        this.batchDelay = 50;
        console.log('[VoxelSystemExample] 配置已重置为默认值');
    }

    /**
     * 设置小世界配置（用于快速测试）
     */
    public setSmallWorldConfig(): void {
        this.worldSize = 20;
        this.plantDensity = 0.2;
        this.glowingBlockDensity = 0.1;
        this.batchSize = 100;
        this.batchDelay = 10;
        console.log('[VoxelSystemExample] 已设置为小世界配置');
    }

    /**
     * 设置大世界配置（用于性能测试）
     */
    public setLargeWorldConfig(): void {
        this.worldSize = 200;
        this.plantDensity = 0.05;
        this.glowingBlockDensity = 0.02;
        this.batchSize = 2000;
        this.batchDelay = 100;
        console.log('[VoxelSystemExample] 已设置为大世界配置');
    }

    /**
     * 测试特定方块类型
     */
    public async testBlockType(blockId: string): Promise<void> {
        if (!this.voxelSystem) {
            console.error('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        console.log(`[VoxelSystemExample] 测试方块类型: ${blockId}`);

        // 检查方块是否存在
        if (!this.voxelSystem.hasBlock(blockId)) {
            console.error(`[VoxelSystemExample] 方块类型不存在: ${blockId}`);
            return;
        }

        // 获取方块定义
        const blockDef = this.voxelSystem.getBlockDefinition(blockId);
        console.log(`[VoxelSystemExample] 方块定义:`, blockDef);

        // 在场景中心创建测试方块
        const testPosition = new Vec3(0, 2, 0);
        await this.addTestBlock(blockId, testPosition);
    }

    protected onDestroy(): void {
        this.clearTestBlocks();
        
        if (this.voxelSystem) {
            // 不销毁全局系统，只清理缓存
            this.voxelSystem.clearCaches();
        }
    }
}

// 导出便捷的测试函数
export namespace VoxelSystemTest {
    /**
     * 快速测试体素系统
     */
    export async function quickTest(containerNode: Node): Promise<VoxelSystemExample | null> {
        try {
            const testComponent = containerNode.addComponent(VoxelSystemExample);
            
            // 等待组件完成初始化
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return testComponent;
        } catch (error) {
            console.error('[VoxelSystemTest] 快速测试失败:', error);
            return null;
        }
    }

    /**
     * 测试所有方块类型
     */
    export async function testAllBlocks(example: VoxelSystemExample): Promise<void> {
        const voxelSystem = getVoxelSystem();
        const allBlockIds = voxelSystem.getAllBlockIds();
        
        console.log(`[VoxelSystemTest] 开始测试所有方块类型 (${allBlockIds.length} 个)...`);
        
        for (let i = 0; i < allBlockIds.length; i++) {
            const blockId = allBlockIds[i];
            const position = new Vec3(
                i % 10 - 5,  // X: -5 到 4
                0,
                Math.floor(i / 10) - 2  // Z: 每10个方块换一排
            );
            
            await example.addTestBlock(blockId, position);
            
            // 添加小延迟避免卡顿
            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        console.log('[VoxelSystemTest] 所有方块类型测试完成');
    }

    /**
     * 生成100x100大型体素世界
     */
    export async function generateLargeWorld(example: VoxelSystemExample): Promise<void> {
        console.log('[VoxelSystemTest] 开始生成100x100大型体素世界...');
        await example.generateLargeWorld();
        console.log('[VoxelSystemTest] 100x100大型体素世界生成完成！');
    }
}