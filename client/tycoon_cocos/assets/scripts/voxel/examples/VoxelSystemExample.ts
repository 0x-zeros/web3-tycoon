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
}