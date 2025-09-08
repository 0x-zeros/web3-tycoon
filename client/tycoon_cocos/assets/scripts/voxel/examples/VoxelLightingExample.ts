import { Component, Node, Vec3, _decorator, director, MeshRenderer } from 'cc';
import { VoxelSystem } from '../VoxelSystem';
import { BlockRegistry } from '../core/VoxelBlock';
import { VoxelLightingSystem } from '../lighting/VoxelLightingSystem';
import { VoxelChunk } from '../core/VoxelTypes';
import { VoxelMapUtils } from '../world/VoxelMapUtils';
import { MeshBuilder } from '../resource/MeshBuilder';

const { ccclass, property } = _decorator;

/**
 * 体素光照系统演示组件
 * 展示发光方块和光照传播效果
 */
@ccclass('VoxelLightingExample')
export class VoxelLightingExample extends Component {

    @property({ displayName: '演示规模', min: 3, max: 10 })
    public demoSize: number = 5;

    @property({ displayName: '发光方块密度', range: [0, 1] })
    public glowingDensity: number = 0.3;

    @property({ displayName: '显示光照调试', type: Boolean })
    public showLightingDebug: boolean = true;

    private voxelSystem: VoxelSystem | null = null;
    private demoChunk: VoxelChunk | null = null;
    private blockNodes: Node[] = [];

    async start() {
        console.log('[VoxelLightingExample] 开始初始化发光方块演示...');

        try {
            // 初始化体素系统
            this.voxelSystem = await VoxelSystem.quickInitialize();
            if (!this.voxelSystem) {
                console.error('[VoxelLightingExample] 体素系统初始化失败');
                return;
            }
            
            console.log('[VoxelLightingExample] 体素系统初始化成功');
            
            // 确保方块注册表已初始化
            const blockCount = BlockRegistry.getAllBlockIds().length;
            console.log(`[VoxelLightingExample] 方块注册表包含 ${blockCount} 个方块`);

            // 直接创建演示场景
            console.log('[VoxelLightingExample] 开始创建演示场景...');
            await this.createLightingDemo();

            console.log('[VoxelLightingExample] 发光方块演示初始化完成');

        } catch (error) {
            console.error('[VoxelLightingExample] 初始化失败:', error);
            console.error('[VoxelLightingExample] 错误堆栈:', error.stack);
        }
    }

    /**
     * 创建光照演示场景
     */
    private async createLightingDemo(): Promise<void> {
        console.log('[VoxelLightingExample] 创建光照演示场景...');

        try {
            // 简化测试：只创建几个发光方块
            const testBlocks = [
                { id: 'minecraft:stone', position: new Vec3(0, 0, 0) },
                { id: 'minecraft:glowstone', position: new Vec3(2, 0, 0) },  // 发光方块
                { id: 'minecraft:stone', position: new Vec3(4, 0, 0) },
                { id: 'minecraft:glowstone', position: new Vec3(0, 0, 2) },  // 发光方块
            ];
            
            console.log(`[VoxelLightingExample] 创建 ${testBlocks.length} 个测试方块...`);
            
            const getBlockAt = (x: number, y: number, z: number): string => {
                for (const block of testBlocks) {
                    if (block.position.x === x && block.position.y === y && block.position.z === z) {
                        return block.id;
                    }
                }
                return 'minecraft:air';
            };

            // 创建每个测试方块
            for (let i = 0; i < testBlocks.length; i++) {
                const block = testBlocks[i];
                console.log(`[VoxelLightingExample] 创建方块 ${i + 1}/${testBlocks.length}: ${block.id} at (${block.position.x}, ${block.position.y}, ${block.position.z})`);
                
                // 检查方块是否发光
                const lightLevel = BlockRegistry.getLightLevel(block.id);
                if (lightLevel > 0) {
                    console.log(`[VoxelLightingExample] -> 这是发光方块，光照等级: ${lightLevel}`);
                }
                
                await this.createBlockNode(block, getBlockAt);
            }
            
            console.log(`[VoxelLightingExample] 方块创建完成，实际创建了 ${this.blockNodes.length} 个节点`);

        } catch (error) {
            console.error('[VoxelLightingExample] 创建演示场景失败:', error);
            console.error('[VoxelLightingExample] 错误堆栈:', error.stack);
        }
    }

    /**
     * 创建完整演示
     */
    private async createFullDemo(): Promise<void> {
        // 创建演示用的区块
        this.demoChunk = this.createDemoChunk();

        // 生成方块数据
        const blocks = this.generateDemoBlocks();
        console.log(`[VoxelLightingExample] 生成 ${blocks.length} 个方块`);

        // 创建简单的方块查询函数
        const blockMap = new Map<string, string>();
        for (const block of blocks) {
            const key = `${block.position.x},${block.position.y},${block.position.z}`;
            blockMap.set(key, block.id);
        }

        const getBlockAt = (x: number, y: number, z: number): string => {
            const key = `${x},${y},${z}`;
            return blockMap.get(key) || 'minecraft:air';
        };

        // 初始化区块光照
        VoxelLightingSystem.initializeChunkLighting(this.demoChunk, getBlockAt);

        // 创建方块节点 (跳过第一个，因为已经创建了)
        console.log(`[VoxelLightingExample] 开始创建 ${blocks.length} 个方块节点...`);
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            // 跳过已经创建的测试方块
            if (block.position.equals(new Vec3(0, 0, 0))) continue;
            
            console.log(`[VoxelLightingExample] 创建方块 ${i + 1}/${blocks.length}: ${block.id} at (${block.position.x}, ${block.position.y}, ${block.position.z})`);
            await this.createBlockNode(block, getBlockAt);
        }
        console.log(`[VoxelLightingExample] 方块节点创建完成，实际创建了 ${this.blockNodes.length} 个节点`);

        // 显示光照调试信息
        if (this.showLightingDebug) {
            VoxelLightingSystem.debugChunkLighting(this.demoChunk);
            this.logLightingStats(blocks);
        }
    }

    /**
     * 生成演示方块数据
     */
    private generateDemoBlocks(): Array<{ id: string; position: Vec3 }> {
        const blocks: Array<{ id: string; position: Vec3 }> = [];

        // 创建一个基础平台
        for (let x = 0; x < this.demoSize; x++) {
            for (let z = 0; z < this.demoSize; z++) {
                blocks.push({
                    id: 'minecraft:stone',
                    position: new Vec3(x, 0, z)
                });
            }
        }

        // 添加发光方块
        const lightSources = this.getAvailableLightSources();
        const lightCount = Math.floor(this.demoSize * this.demoSize * this.glowingDensity);

        console.log(`[VoxelLightingExample] 添加 ${lightCount} 个发光方块`);

        for (let i = 0; i < lightCount; i++) {
            const x = Math.floor(Math.random() * this.demoSize);
            const z = Math.floor(Math.random() * this.demoSize);
            const y = 1 + Math.floor(Math.random() * 2); // 高度1-2

            const lightSource = lightSources[i % lightSources.length];

            blocks.push({
                id: lightSource,
                position: new Vec3(x, y, z)
            });
        }

        // 添加一些障碍物方块来展示光照传播
        const obstacleCount = Math.floor(this.demoSize * this.demoSize * 0.2);
        for (let i = 0; i < obstacleCount; i++) {
            const x = Math.floor(Math.random() * this.demoSize);
            const z = Math.floor(Math.random() * this.demoSize);
            const y = 1;

            blocks.push({
                id: 'minecraft:cobblestone',
                position: new Vec3(x, y, z)
            });
        }

        return blocks;
    }

    /**
     * 获取可用的发光方块类型
     */
    private getAvailableLightSources(): string[] {
        const allBlocks = BlockRegistry.getAllBlockIds();
        console.log(`[VoxelLightingExample] 总共找到 ${allBlocks.length} 个方块类型:`, allBlocks);
        
        const lightSources = allBlocks.filter(blockId => {
            const lightLevel = BlockRegistry.getLightLevel(blockId);
            if (lightLevel > 0) {
                console.log(`[VoxelLightingExample] 发光方块: ${blockId} (等级 ${lightLevel})`);
            }
            return lightLevel > 0;
        });

        console.log(`[VoxelLightingExample] 发现 ${lightSources.length} 种发光方块:`, lightSources);
        
        if (lightSources.length === 0) {
            console.warn('[VoxelLightingExample] 没有找到发光方块，使用默认');
            return ['minecraft:glowstone'];
        }
        
        return lightSources;
    }

    /**
     * 创建演示用区块
     */
    private createDemoChunk(): VoxelChunk {
        const chunk: VoxelChunk = {
            map: VoxelMapUtils.allocMap(0, 0, 0, 0),
            lights: VoxelMapUtils.allocMap(0, 0, 0, 0),
            p: 0,
            q: 0,
            faces: 0,
            dirty: false,
            miny: 0,
            maxy: 3
        };

        return chunk;
    }

    /**
     * 创建方块节点
     */
    private async createBlockNode(
        block: { id: string; position: Vec3 },
        getBlockAt: (x: number, y: number, z: number) => string
    ): Promise<void> {
        try {
            // 生成网格数据（包含真实的光照和AO数据）
            const meshData = await this.voxelSystem!.generateBlockMesh(block.id, block.position);
            if (!meshData) {
                console.warn(`[VoxelLightingExample] 无法生成方块网格: ${block.id}`);
                return;
            }
            
            console.log(`[VoxelLightingExample] 成功生成方块网格: ${block.id}, 纹理组数量: ${meshData.textureGroups.size}`);

            const node = await this.voxelSystem!.createBlockNode(this.node, block.id, block.position);
            if (node) this.blockNodes.push(node);

        } catch (error) {
            console.error(`[VoxelLightingExample] 创建方块节点失败 ${block.id}:`, error);
            console.error(`[VoxelLightingExample] 错误堆栈:`, error.stack);
        }
    }
    
    /**
     * 创建草方块节点（双子网格）
     */
    private async createGrassBlockNode(
        blockNode: Node,
        grassMesh: any,
        blockId: string,
        baseMaterial: any
    ): Promise<void> {
        // 已废弃：改用通用 overlay 流程。保留占位以兼容旧调用。
        console.warn('[VoxelLightingExample] createGrassBlockNode 已废弃，跳过。');
        return;
    }

    /**
     * 创建通用 overlay 方块节点
     */
    private async createOverlayBlockNode(
        blockNode: Node,
        overlayMeshes: { base: any; overlay: any },
        overlayInfo: { baseSideTexture: string; overlaySideTexture: string }
    ): Promise<void> {
        try {
            const baseNode = new Node('OverlayBase');
            baseNode.setParent(blockNode);
            const baseMr = baseNode.addComponent(MeshRenderer);
            baseMr.mesh = overlayMeshes.base;

            const overlayNode = new Node('OverlayTop');
            overlayNode.setParent(blockNode);
            const overlayMr = overlayNode.addComponent(MeshRenderer);
            overlayMr.mesh = overlayMeshes.overlay;

            const materialFactory = (this.voxelSystem as any).materialFactory;
            if (materialFactory && materialFactory.createOverlayBlockMaterial) {
                const overlayMat = await materialFactory.createOverlayBlockMaterial(
                    overlayInfo.baseSideTexture,
                    overlayInfo.overlaySideTexture
                );
                if (overlayMat) {
                    materialFactory.setOverlayUniforms(overlayMat, [0.5, 1.0, 0.3, 1.0]);
                    overlayMr.material = overlayMat;
                }

                const baseMat = await this.voxelSystem!.createBlockMaterial('minecraft:' + overlayInfo.baseSideTexture.replace('_side', ''));
                if (baseMat) baseMr.material = baseMat;
            }
        } catch (e) {
            console.error('[VoxelLightingExample] 创建 overlay 方块节点失败:', e);
        }
    }
    
    /**
     * 创建草方块 Overlay 材质
     */
    private async createGrassOverlayMaterial(): Promise<any | null> {
        if (!this.voxelSystem) {
            return null;
        }
        
        try {
            // 获取 MaterialFactory
            const materialFactory = (this.voxelSystem as any).materialFactory;
            if (materialFactory && materialFactory.createOverlayBlockMaterial) {
                const overlayMaterial = await materialFactory.createOverlayBlockMaterial(
                    'grass_block_side',
                    'grass_block_side_overlay'
                );
                
                if (overlayMaterial && materialFactory.setOverlayUniforms) {
                    // 设置生物群系颜色（草地绿色）
                    materialFactory.setOverlayUniforms(overlayMaterial, [0.5, 1.0, 0.3, 1.0]);
                    console.log(`[VoxelLightingExample] 草方块Overlay材质创建成功`);
                }
                
                return overlayMaterial;
            }
        } catch (error) {
            console.error('[VoxelLightingExample] Overlay材质创建失败:', error);
        }
        
        return null;
    }

    /**
     * 输出光照统计信息
     */
    private logLightingStats(blocks: Array<{ id: string; position: Vec3 }>): void {
        if (!this.demoChunk) return;

        console.log('[VoxelLightingExample] 光照统计信息:');

        // 按光照等级统计
        const lightLevelStats = new Map<number, number>();
        let totalLitBlocks = 0;

        for (let x = 0; x < this.demoSize; x++) {
            for (let z = 0; z < this.demoSize; z++) {
                for (let y = 0; y <= 3; y++) {
                    const light = VoxelLightingSystem.getBlockLight(this.demoChunk, x, y, z);
                    if (light > 0) {
                        totalLitBlocks++;
                        const count = lightLevelStats.get(light) || 0;
                        lightLevelStats.set(light, count + 1);
                    }
                }
            }
        }

        console.log(`- 有光照的方块总数: ${totalLitBlocks}`);
        console.log('- 光照等级分布:');
        for (const [level, count] of Array.from(lightLevelStats.entries()).sort((a, b) => b[0] - a[0])) {
            console.log(`  等级 ${level}: ${count} 个方块`);
        }

        // 方块类型统计
        const blockTypeStats = new Map<string, number>();
        for (const block of blocks) {
            const count = blockTypeStats.get(block.id) || 0;
            blockTypeStats.set(block.id, count + 1);
        }

        console.log('- 方块类型分布:');
        for (const [blockId, count] of blockTypeStats) {
            const lightLevel = BlockRegistry.getLightLevel(blockId);
            const isEmissive = lightLevel > 0 ? ` (发光等级: ${lightLevel})` : '';
            console.log(`  ${blockId}: ${count} 个${isEmissive}`);
        }
    }

    /**
     * 切换发光方块
     */
    public async toggleGlowingBlock(x: number, y: number, z: number): Promise<void> {
        if (!this.voxelSystem || !this.demoChunk) return;

        // 这里可以实现动态切换发光方块的逻辑
        // 用于演示光照系统的实时更新能力
        console.log(`[VoxelLightingExample] 切换位置 (${x}, ${y}, ${z}) 的发光状态`);
    }

    /**
     * 重新生成演示
     */
    public async regenerateDemo(): Promise<void> {
        console.log('[VoxelLightingExample] 重新生成演示...');

        // 清理现有节点
        for (const node of this.blockNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.blockNodes = [];

        // 重新创建演示
        await this.createLightingDemo();
    }

    private waitOneFrame(): Promise<void> {
        return new Promise(resolve => {
            director.once((director.constructor as any).EVENT_AFTER_UPDATE, resolve);
        });
    }

    onDestroy() {
        // 清理资源
        for (const node of this.blockNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }

        if (this.demoChunk) {
            VoxelMapUtils.freeMap(this.demoChunk.lights);
            VoxelMapUtils.freeMap(this.demoChunk.map);
        }

        console.log('[VoxelLightingExample] 光照演示已清理');
    }
}