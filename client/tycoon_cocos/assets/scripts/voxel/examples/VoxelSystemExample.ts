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
        // await this.createTestBlocks();

        this.setSmallWorldConfig();
        await this.generateLargeWorld();


        // this.logSystemInfo();

        // // await this.fixGroundGaps();
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
        const results = await Promise.all(creationPromises);
        const successCount = results.filter(result => result).length;
        console.log(`[VoxelSystemExample] 测试方块创建结果: ${successCount}/${this.testBlocks.length} 成功`);

        console.log(`[VoxelSystemExample] 成功创建 ${this.testBlocks.length} 个测试方块`);
    }

    /**
     * 生成大型体素世界（使用已验证的方块类型）
     */
    public async generateLargeWorld(): Promise<void> {
        if (!this.voxelSystem) {
            console.error('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        // 验证配置参数
        this.validateConfiguration();

        console.log(`[VoxelSystemExample] 开始生成${this.worldSize}x${this.worldSize}体素世界...`);
        const startTime = Date.now();

        // 清除现有方块
        this.clearTestBlocks();

        // 使用已验证的方块类型（直接定义，无需验证）
        const blockTypes = [
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

        const plantTypes = [
            'minecraft:dandelion',
            'minecraft:poppy',
            'minecraft:short_grass',
            'minecraft:fern'
        ];

        console.log(`[VoxelSystemExample] 使用 ${blockTypes.length} 种基础方块，${plantTypes.length} 种植物`);

        const blocks: { id: string; position: Vec3 }[] = [];

        // 计算世界中心偏移量，让原点成为世界的中心
        const halfSize = Math.floor(this.worldSize / 2);
        const offsetX = -halfSize;
        const offsetZ = -halfSize;

        console.log(`[VoxelSystemExample] 世界中心偏移: (${offsetX}, 0, ${offsetZ})`);

        // 生成y=0层的基础方块
        console.log('[VoxelSystemExample] 生成y=0层基础方块...');
        for (let x = 0; x < this.worldSize; x++) {
            for (let z = 0; z < this.worldSize; z++) {
                const blockType = this.getRandomBlockType(blockTypes, x, z);
                const worldX = x + offsetX;
                const worldZ = z + offsetZ;
                blocks.push({
                    id: blockType,
                    position: new Vec3(worldX, 0, worldZ)
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
            const worldX = x + offsetX;
            const worldZ = z + offsetZ;
            blocks.push({
                id: plantType,
                position: new Vec3(worldX, 1, worldZ)
            });
        }

        console.log(`[VoxelSystemExample] 总共需要创建 ${blocks.length} 个方块`);
        console.log(`[VoxelSystemExample] 基础方块: ${this.worldSize * this.worldSize} 个`);
        console.log(`[VoxelSystemExample] 植物方块: ${plantCount} 个`);

        // 分批创建方块以避免内存问题
        const totalBatches = Math.ceil(blocks.length / this.batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * this.batchSize;
            const endIndex = Math.min(startIndex + this.batchSize, blocks.length);
            const batch = blocks.slice(startIndex, endIndex);

            console.log(`[VoxelSystemExample] 创建批次 ${batchIndex + 1}/${totalBatches} (${batch.length} 个方块)`);

            // 并行创建当前批次的方块
            const creationPromises = batch.map(block => this.createSingleBlock(block));
            const results = await Promise.all(creationPromises);
            const successCount = results.filter(result => result).length;
            console.log(`[VoxelSystemExample] 批次 ${batchIndex + 1} 创建结果: ${successCount}/${batch.length} 成功`);

            // 添加小延迟避免卡顿
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }
        }

        this.testBlocks = blocks;
        const endTime = Date.now();
        console.log(`[VoxelSystemExample] ${this.worldSize}x${this.worldSize}体素世界生成完成！耗时: ${endTime - startTime}ms`);
        
        // 验证生成结果
        this.validateWorldGeneration();
    }

    /**
     * 显示验证过的方块类型信息
     */
    private logValidatedBlockTypes(validatedBlocks: {
        validBlocks: string[];
        validPlants: string[];
        validGlowing: string[];
        invalidBlocks: string[];
    }): void {
        console.log('[VoxelSystemExample] 验证过的方块类型:');
        console.log(`  基础方块 (${validatedBlocks.validBlocks.length}):`, validatedBlocks.validBlocks);
        console.log(`  植物方块 (${validatedBlocks.validPlants.length}):`, validatedBlocks.validPlants);
        console.log(`  发光方块 (${validatedBlocks.validGlowing.length}):`, validatedBlocks.validGlowing);
        
        if (validatedBlocks.invalidBlocks.length > 0) {
            console.log(`  无效方块 (${validatedBlocks.invalidBlocks.length}):`, validatedBlocks.invalidBlocks.slice(0, 5));
        }
    }

    /**
     * 验证所有方块类型并返回可用的方块列表
     */
    private async validateAllBlockTypes(): Promise<{
        validBlocks: string[];
        validPlants: string[];
        validGlowing: string[];
        invalidBlocks: string[];
    }> {
        console.log('[VoxelSystemExample] 开始验证所有方块类型...');
        
        const allBlocks = this.getBlockTypes();
        const allPlants = this.getPlantTypes();
        const allGlowing = this.getGlowingBlockTypes();
        
        const validBlocks: string[] = [];
        const validPlants: string[] = [];
        const validGlowing: string[] = [];
        const invalidBlocks: string[] = [];
        
        // 验证基础方块
        console.log('[VoxelSystemExample] 验证基础方块...');
        for (const blockId of allBlocks) {
            if (this.voxelSystem!.hasBlock(blockId)) {
                validBlocks.push(blockId);
            } else {
                invalidBlocks.push(blockId);
            }
        }
        
        // 验证植物方块
        console.log('[VoxelSystemExample] 验证植物方块...');
        for (const blockId of allPlants) {
            if (this.voxelSystem!.hasBlock(blockId)) {
                validPlants.push(blockId);
            } else {
                invalidBlocks.push(blockId);
            }
        }
        
        // 验证发光方块 - 暂时跳过
        console.log('[VoxelSystemExample] 跳过发光方块验证 - 暂时注释掉');
        /*
        for (const blockId of allGlowing) {
            if (this.voxelSystem!.hasBlock(blockId)) {
                validGlowing.push(blockId);
            } else {
                invalidBlocks.push(blockId);
            }
        }
        */
        
        console.log(`[VoxelSystemExample] 验证结果:`);
        console.log(`  有效基础方块: ${validBlocks.length}/${allBlocks.length}`);
        console.log(`  有效植物方块: ${validPlants.length}/${allPlants.length}`);
        console.log(`  有效发光方块: ${validGlowing.length}/${allGlowing.length}`);
        console.log(`  无效方块总数: ${invalidBlocks.length}`);
        
        if (invalidBlocks.length > 0) {
            console.log(`[VoxelSystemExample] 无效方块列表:`, invalidBlocks.slice(0, 10));
        }
        
        // 如果某些类型没有有效方块，使用动态生成
        if (validBlocks.length === 0) {
            console.warn('[VoxelSystemExample] 没有有效的基础方块，使用动态生成');
            const availableBlocks = this.voxelSystem!.getAllBlockIds();
            validBlocks.push(...this.generateDynamicBlockList(availableBlocks, 'basic'));
        }
        
        if (validPlants.length === 0) {
            console.warn('[VoxelSystemExample] 没有有效的植物方块，使用动态生成');
            const availableBlocks = this.voxelSystem!.getAllBlockIds();
            validPlants.push(...this.generateDynamicBlockList(availableBlocks, 'plant'));
        }
        
        if (validGlowing.length === 0) {
            console.warn('[VoxelSystemExample] 没有有效的发光方块，跳过发光方块生成');
        }
        
        return {
            validBlocks,
            validPlants,
            validGlowing,
            invalidBlocks
        };
    }

    /**
     * 检查方块类型可用性并返回安全的方块列表
     */
    private getSafeBlockTypes(): string[] {
        const allBlockTypes = this.getBlockTypes();
        const availableBlocks = this.voxelSystem!.getAllBlockIds();
        const safeBlocks = allBlockTypes.filter(blockId => availableBlocks.indexOf(blockId) !== -1);
        
        console.log(`[VoxelSystemExample] 基础方块类型检查: ${safeBlocks.length}/${allBlockTypes.length} 可用`);
        
        if (safeBlocks.length === 0) {
            console.warn('[VoxelSystemExample] 没有可用的基础方块类型，使用动态生成列表');
            return this.generateDynamicBlockList(availableBlocks, 'basic');
        }
        
        return safeBlocks;
    }

    /**
     * 动态生成方块类型列表
     */
    private generateDynamicBlockList(availableBlocks: string[], category: string): string[] {
        console.log(`[VoxelSystemExample] 动态生成${category}方块列表...`);
        
        let patterns: string[] = [];
        
        switch (category) {
            case 'basic':
                patterns = ['stone', 'dirt', 'grass', 'sand', 'cobble', 'gravel'];
                break;
            case 'plant':
                patterns = ['grass', 'flower', 'fern', 'bush', 'dandelion', 'poppy'];
                break;
            case 'glowing':
                patterns = ['torch', 'glow', 'lamp', 'fire', 'lantern'];
                break;
        }
        
        const dynamicBlocks = availableBlocks.filter(blockId => {
            return patterns.some(pattern => blockId.includes(pattern));
        });
        
        console.log(`[VoxelSystemExample] 动态生成${category}方块: ${dynamicBlocks.length} 个`);
        
        if (dynamicBlocks.length === 0) {
            console.warn(`[VoxelSystemExample] 动态生成失败，使用前几个可用方块`);
            return availableBlocks.slice(0, 5);
        }
        
        return dynamicBlocks;
    }

    /**
     * 获取基础方块类型（使用已验证可用的方块）
     */
    private getBlockTypes(): string[] {
        return [
            // 已验证可用的基础方块
            'minecraft:stone',
            'minecraft:dirt',
            'minecraft:grass_block',
            'minecraft:sand',
            'minecraft:cobblestone',
            
            // 已验证可用的木质方块
            'minecraft:oak_log',
            'minecraft:oak_planks',
            'minecraft:oak_leaves',
            
            // 已验证可用的装饰方块
            'minecraft:glass'
        ];
    }

    /**
     * 获取安全的植物类型
     */
    private getSafePlantTypes(): string[] {
        const allPlantTypes = this.getPlantTypes();
        const availableBlocks = this.voxelSystem!.getAllBlockIds();
        const safePlants = allPlantTypes.filter(blockId => availableBlocks.indexOf(blockId) !== -1);
        
        console.log(`[VoxelSystemExample] 植物类型检查: ${safePlants.length}/${allPlantTypes.length} 可用`);
        
        if (safePlants.length === 0) {
            console.warn('[VoxelSystemExample] 没有可用的植物类型，使用动态生成列表');
            return this.generateDynamicBlockList(availableBlocks, 'plant');
        }
        
        return safePlants;
    }

    /**
     * 获取安全的发光方块类型
     */
    private getSafeGlowingBlockTypes(): string[] {
        const allGlowingTypes = this.getGlowingBlockTypes();
        const availableBlocks = this.voxelSystem!.getAllBlockIds();
        const safeGlowing = allGlowingTypes.filter(blockId => availableBlocks.indexOf(blockId) !== -1);
        
        console.log(`[VoxelSystemExample] 发光方块类型检查: ${safeGlowing.length}/${allGlowingTypes.length} 可用`);
        
        if (safeGlowing.length === 0) {
            console.warn('[VoxelSystemExample] 没有可用的发光方块类型，使用动态生成列表');
            return this.generateDynamicBlockList(availableBlocks, 'glowing');
        }
        
        return safeGlowing;
    }

    /**
     * 获取植物类型（使用已验证可用的植物）
     */
    private getPlantTypes(): string[] {
        return [
            // 已验证可用的植物
            'minecraft:dandelion',
            'minecraft:poppy',
            'minecraft:short_grass',
            'minecraft:fern'
        ];
    }

    /**
     * 获取发光方块类型（保守列表）
     */
    private getGlowingBlockTypes(): string[] {
        return [
            // 最基础的发光方块
            'minecraft:torch',
            'minecraft:glowstone',
            'minecraft:redstone_lamp'
        ];
    }

    /**
     * 验证世界生成结果
     */
    private validateWorldGeneration(): void {
        console.log('[VoxelSystemExample] 验证世界生成结果...');
        
        // 统计实际创建的节点数量
        const actualNodes = this.testBlocks.filter(block => block.node && block.node.isValid).length;
        const expectedNodes = this.testBlocks.length;
        
        console.log(`[VoxelSystemExample] 预期方块数: ${expectedNodes}, 实际创建节点数: ${actualNodes}`);
        
        if (actualNodes < expectedNodes) {
            console.warn(`[VoxelSystemExample] 警告: 有 ${expectedNodes - actualNodes} 个方块创建失败！`);
        }
        
        // 检查y=0层的连续性
        this.checkGroundContinuity();
        
        // 统计各层方块数量
        this.statisticsByLayer();
    }

    /**
     * 检查地面连续性
     */
    private checkGroundContinuity(): void {
        console.log('[VoxelSystemExample] 检查地面连续性...');
        
        const groundBlocks = this.testBlocks.filter(block => 
            block.position.y === 0 && block.node && block.node.isValid
        );
        
        console.log(`[VoxelSystemExample] y=0层实际方块数: ${groundBlocks.length}`);
        console.log(`[VoxelSystemExample] 预期y=0层方块数: ${this.worldSize * this.worldSize}`);
        
        if (groundBlocks.length < this.worldSize * this.worldSize) {
            console.warn(`[VoxelSystemExample] 警告: y=0层有 ${this.worldSize * this.worldSize - groundBlocks.length} 个空隙！`);
            
            // 找出缺失的位置
            const existingPositions = new Set();
            groundBlocks.forEach(block => {
                const key = `${block.position.x},${block.position.z}`;
                existingPositions.add(key);
            });
            
            const missingPositions = [];
            for (let x = 0; x < this.worldSize; x++) {
                for (let z = 0; z < this.worldSize; z++) {
                    const key = `${x},${z}`;
                    if (!existingPositions.has(key)) {
                        missingPositions.push({ x, z });
                    }
                }
            }
            
            if (missingPositions.length > 0) {
                console.warn(`[VoxelSystemExample] 缺失位置示例:`, missingPositions.slice(0, 10));
            }
        } else {
            console.log('[VoxelSystemExample] ✓ y=0层地面连续，无空隙');
        }
    }

    /**
     * 按层统计方块数量
     */
    private statisticsByLayer(): void {
        console.log('[VoxelSystemExample] 按层统计方块数量:');
        
        const layerStats = new Map<number, number>();
        this.testBlocks.forEach(block => {
            if (block.node && block.node.isValid) {
                const y = block.position.y;
                layerStats.set(y, (layerStats.get(y) || 0) + 1);
            }
        });
        
        // 按y坐标排序显示
        const sortedLayers = Array.from(layerStats.entries()).sort((a, b) => a[0] - b[0]);
        sortedLayers.forEach(([y, count]) => {
            console.log(`[VoxelSystemExample]   y=${y}: ${count} 个方块`);
        });
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

        //随机返回blockTypes中的一个
        return blockTypes[Math.floor(Math.random() * blockTypes.length)];

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
    private async createSingleBlock(blockInfo: { id: string; position: Vec3; node?: Node }): Promise<boolean> {
        try {
            // 检查方块类型是否存在
            if (!this.voxelSystem!.hasBlock(blockInfo.id)) {
                console.warn(`[VoxelSystemExample] 方块类型不存在: ${blockInfo.id}`);
                return false;
            }

            // 1. 生成网格数据
            const meshData = await this.voxelSystem!.generateBlockMesh(blockInfo.id, blockInfo.position);
            if (!meshData) {
                console.warn(`[VoxelSystemExample] 方块网格生成失败: ${blockInfo.id} at (${blockInfo.position.x}, ${blockInfo.position.y}, ${blockInfo.position.z})`);
                return false;
            }

            // 2. 创建节点
            const blockNode = new Node(`Block_${blockInfo.id.replace('minecraft:', '')}`);
            blockNode.position = blockInfo.position; // 设置方块在场景中的位置
            this.containerNode!.addChild(blockNode);
            blockInfo.node = blockNode;

            // 3. 为每个纹理组创建子网格
            const subMeshSuccess = await this.createBlockSubMeshes(blockNode, meshData, blockInfo.id);
            if (!subMeshSuccess) {
                console.warn(`[VoxelSystemExample] 子网格创建失败: ${blockInfo.id}`);
                // 清理已创建的节点
                if (blockNode && blockNode.isValid) {
                    blockNode.destroy();
                    blockInfo.node = undefined;
                }
                return false;
            }

            return true;

        } catch (error) {
            console.error(`[VoxelSystemExample] 创建方块失败: ${blockInfo.id} at (${blockInfo.position.x}, ${blockInfo.position.y}, ${blockInfo.position.z})`, error);
            return false;
        }
    }

    /**
     * 为方块创建子网格（按纹理分组）
     */
    private async createBlockSubMeshes(blockNode: Node, meshData: any, blockId: string): Promise<boolean> {
        let subMeshIndex = 0;
        let successCount = 0;
        let totalGroups = meshData.textureGroups.size;

        console.log(`[VoxelSystemExample] createBlockSubMeshes: textureGroups数量=${totalGroups}`);
        
        if (totalGroups === 0) {
            console.warn(`[VoxelSystemExample] 没有纹理组数据: ${blockId}`);
            return false;
        }

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
                successCount++;

            } catch (error) {
                console.error(`[VoxelSystemExample] 创建子网格失败: ${texturePath}`, error);
            }
        }

        const success = successCount > 0;
        if (!success) {
            console.error(`[VoxelSystemExample] 所有子网格创建失败: ${blockId}`);
        } else if (successCount < totalGroups) {
            console.warn(`[VoxelSystemExample] 部分子网格创建失败: ${blockId} (${successCount}/${totalGroups})`);
        }

        return success;
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
        
        // 分析可用方块类型
        this.analyzeAvailableBlocks(availableBlocks);
        
        this.voxelSystem.logSystemStats();
    }

    /**
     * 分析可用的方块类型
     */
    private analyzeAvailableBlocks(availableBlocks: string[]): void {
        console.log('[VoxelSystemExample] 分析可用方块类型...');
        
        // 分类统计
        const categories = {
            basic: 0,
            wood: 0,
            ore: 0,
            plant: 0,
            glowing: 0,
            other: 0
        };
        
        availableBlocks.forEach(blockId => {
            if (blockId.includes('stone') || blockId.includes('dirt') || blockId.includes('sand') || 
                blockId.includes('grass') || blockId.includes('cobble') || blockId.includes('gravel')) {
                categories.basic++;
            } else if (blockId.includes('log') || blockId.includes('plank') || blockId.includes('leaves')) {
                categories.wood++;
            } else if (blockId.includes('ore') || blockId.includes('coal') || blockId.includes('iron') || 
                      blockId.includes('gold') || blockId.includes('diamond') || blockId.includes('emerald')) {
                categories.ore++;
            } else if (blockId.includes('flower') || blockId.includes('grass') || blockId.includes('fern') || 
                      blockId.includes('bush') || blockId.includes('cactus') || blockId.includes('vine')) {
                categories.plant++;
            } else if (blockId.includes('torch') || blockId.includes('glow') || blockId.includes('lamp') || 
                      blockId.includes('fire') || blockId.includes('lantern') || blockId.includes('candle')) {
                categories.glowing++;
            } else {
                categories.other++;
            }
        });
        
        console.log('[VoxelSystemExample] 方块类型统计:');
        console.log(`  基础方块: ${categories.basic} 个`);
        console.log(`  木质方块: ${categories.wood} 个`);
        console.log(`  矿物方块: ${categories.ore} 个`);
        console.log(`  植物方块: ${categories.plant} 个`);
        console.log(`  发光方块: ${categories.glowing} 个`);
        console.log(`  其他方块: ${categories.other} 个`);
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
     * 修复地面空隙（补充缺失的方块）
     */
    public async fixGroundGaps(): Promise<void> {
        if (!this.voxelSystem) {
            console.error('[VoxelSystemExample] 体素系统未初始化');
            return;
        }

        console.log('[VoxelSystemExample] 开始修复地面空隙...');
        
        // 找出缺失的地面方块位置
        const existingPositions = new Set();
        this.testBlocks.forEach(block => {
            if (block.position.y === 0 && block.node && block.node.isValid) {
                const key = `${block.position.x},${block.position.z}`;
                existingPositions.add(key);
            }
        });
        
        const missingPositions = [];
        for (let x = 0; x < this.worldSize; x++) {
            for (let z = 0; z < this.worldSize; z++) {
                const key = `${x},${z}`;
                if (!existingPositions.has(key)) {
                    missingPositions.push({ x, z });
                }
            }
        }
        
        if (missingPositions.length === 0) {
            console.log('[VoxelSystemExample] 地面无空隙，无需修复');
            return;
        }
        
        console.log(`[VoxelSystemExample] 发现 ${missingPositions.length} 个空隙，开始补充...`);
        
        // 补充缺失的方块
        const blockTypes = this.getBlockTypes();
        const blocksToAdd = [];
        
        for (const pos of missingPositions) {
            const blockType = this.getRandomBlockType(blockTypes, pos.x, pos.z);
            blocksToAdd.push({
                id: blockType,
                position: new Vec3(pos.x, 0, pos.z)
            });
        }
        
        // 分批创建缺失的方块
        const batchSize = Math.min(100, blocksToAdd.length);
        const totalBatches = Math.ceil(blocksToAdd.length / batchSize);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * batchSize;
            const endIndex = Math.min(startIndex + batchSize, blocksToAdd.length);
            const batch = blocksToAdd.slice(startIndex, endIndex);
            
            console.log(`[VoxelSystemExample] 修复批次 ${batchIndex + 1}/${totalBatches} (${batch.length} 个方块)`);
            
            const creationPromises = batch.map(block => this.createSingleBlock(block));
            const results = await Promise.all(creationPromises);
            const successCount = results.filter(result => result).length;
            console.log(`[VoxelSystemExample] 修复批次 ${batchIndex + 1} 创建结果: ${successCount}/${batch.length} 成功`);
            
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }
        }
        
        // 更新testBlocks数组
        this.testBlocks.push(...blocksToAdd);
        
        console.log(`[VoxelSystemExample] 地面空隙修复完成，补充了 ${blocksToAdd.length} 个方块`);
        
        // 重新验证
        this.validateWorldGeneration();
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