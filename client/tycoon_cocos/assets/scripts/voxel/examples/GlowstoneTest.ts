import { Component, Node, Vec3, _decorator, MeshRenderer } from 'cc';
import { VoxelSystem } from '../VoxelSystem';
import { BlockRegistry } from '../core/VoxelBlock';

const { ccclass, property } = _decorator;

/**
 * 萤石发光效果测试组件
 * 简单验证发光方块渲染效果
 */
@ccclass('GlowstoneTest')
export class GlowstoneTest extends Component {

    private voxelSystem: VoxelSystem | null = null;

    async start() {
        console.log('[GlowstoneTest] 开始萤石发光测试...');

        try {
            // 初始化体素系统
            this.voxelSystem = await VoxelSystem.quickInitialize();
            if (!this.voxelSystem) {
                console.error('[GlowstoneTest] 体素系统初始化失败');
                return;
            }
            
            console.log('[GlowstoneTest] 体素系统初始化成功');
            
            // 检查萤石方块是否存在
            if (!BlockRegistry.exists('minecraft:glowstone')) {
                console.error('[GlowstoneTest] 萤石方块未注册');
                return;
            }

            const glowstoneDef = BlockRegistry.getBlock('minecraft:glowstone');
            console.log(`[GlowstoneTest] 萤石方块定义: lightLevel=${glowstoneDef?.lightLevel}`);
            
            // 创建两个方块进行对比：普通石头 vs 萤石
            await this.createComparisonBlocks();

            console.log('[GlowstoneTest] 萤石发光测试完成');

        } catch (error) {
            console.error('[GlowstoneTest] 测试失败:', error);
        }
    }

    /**
     * 创建对比方块：普通石头 vs 萤石
     */
    private async createComparisonBlocks(): Promise<void> {
        const testBlocks = [
            { id: 'minecraft:stone', position: new Vec3(-2, 0, 0), name: 'Stone' },
            { id: 'minecraft:glowstone', position: new Vec3(2, 0, 0), name: 'Glowstone' },
        ];

        for (const block of testBlocks) {
            console.log(`[GlowstoneTest] 创建 ${block.name} 方块...`);
            
            // 检查方块定义
            const blockDef = BlockRegistry.getBlock(block.id);
            const lightLevel = blockDef ? blockDef.lightLevel : 0;
            console.log(`[GlowstoneTest] -> ${block.name} 光照等级: ${lightLevel}`);
            
            try {
                // 生成网格数据
                const meshData = await this.voxelSystem!.generateBlockMesh(block.id, block.position);
                if (!meshData) {
                    console.warn(`[GlowstoneTest] 无法生成 ${block.name} 网格`);
                    continue;
                }
                
                console.log(`[GlowstoneTest] ${block.name} 网格生成成功，纹理组: ${meshData.textureGroups.size}`);

                // 创建材质
                const material = await this.voxelSystem!.createBlockMaterial(block.id);
                if (!material) {
                    console.warn(`[GlowstoneTest] 无法创建 ${block.name} 材质`);
                    continue;
                }
                
                console.log(`[GlowstoneTest] ${block.name} 材质创建成功`);

                // 创建方块节点
                await this.createBlockNode(block.id, block.position, block.name, meshData, material);
                
            } catch (error) {
                console.error(`[GlowstoneTest] 创建 ${block.name} 失败:`, error);
            }
        }
    }

    /**
     * 创建方块节点
     */
    private async createBlockNode(
        blockId: string,
        position: Vec3,
        name: string,
        meshData: any,
        material: any
    ): Promise<void> {
        const blockNode = new Node(`Test_${name}`);
        blockNode.setParent(this.node);
        blockNode.setPosition(position);

        // 为每个纹理组创建子节点
        for (const [texture, group] of meshData.textureGroups) {
            if (group.vertices.length === 0) continue;

            const subNode = new Node(`${name}_${texture.replace(/[^a-zA-Z0-9]/g, '_')}`);
            subNode.setParent(blockNode);

            // 创建网格
            const { MeshBuilder } = await import('../resource/MeshBuilder');
            const meshDataForGroup = {
                vertices: [],
                indices: [],
                textureGroups: new Map([[texture, group]])
            };
            
            const mesh = MeshBuilder.createCocosMesh(meshDataForGroup, texture);
            if (mesh) {
                const meshRenderer = subNode.addComponent(MeshRenderer);
                meshRenderer.mesh = mesh;
                meshRenderer.material = material;

                console.log(`[GlowstoneTest] ${name} 节点创建成功 (纹理: ${texture})`);
                
                // 输出材质信息进行调试
                console.log(`[GlowstoneTest] ${name} 材质属性:`, {
                    effectName: material.effectAsset?.name,
                    technique: material.technique,
                    passes: material.passes.length
                });
                
                // 验证光照值传递
                console.log(`[GlowstoneTest] ${name} 网格顶点数量:`, mesh.struct.vertexBundles[0].view.count);
                console.log(`[GlowstoneTest] ${name} 网格属性:`, mesh.struct.vertexBundles[0].attributes.map(attr => attr.name));
            }
        }
    }

    onDestroy() {
        console.log('[GlowstoneTest] 清理测试资源');
    }
}