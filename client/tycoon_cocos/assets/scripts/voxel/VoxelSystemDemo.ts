/**
 * 现代体素系统演示和使用指南
 * 展示如何使用新的调色板压缩架构
 */

import { _decorator, Component, Node, Vec3 } from 'cc';
import { VoxelWorld } from './world/VoxelWorld';
import { BlockCatalog, searchBlocks } from './core/VoxelBlockCatalog';
import { BlockRegistry, MinecraftBlockId } from './core/VoxelBlockRegistry';
import { VoxelChunkStorage } from './core/VoxelChunkStorage';

const { ccclass, property } = _decorator;

@ccclass('VoxelSystemDemo')
export class VoxelSystemDemo extends Component {
    
    @property({ displayName: "演示类型", tooltip: "选择要演示的功能" })
    public demoType: DemoType = DemoType.BASIC_USAGE;
    
    @property({ displayName: "自动运行", tooltip: "启动时自动运行演示" })
    public autoRun: boolean = true;
    
    private world: VoxelWorld = null;
    
    protected async onLoad() {
        console.log('[VoxelSystemDemo] 初始化体素系统演示...');
        
        // 创建体素世界
        this.world = new VoxelWorld();
        await this.world.initialize();
        
        if (this.autoRun) {
            this.runDemo();
        }
    }
    
    /**
     * 运行演示
     */
    public async runDemo(): Promise<void> {
        console.log(`[VoxelSystemDemo] 开始运行演示: ${DemoType[this.demoType]}`);
        
        switch (this.demoType) {
            case DemoType.BASIC_USAGE:
                this.demoBasicUsage();
                break;
            case DemoType.BLOCK_CATALOG:
                this.demoBlockCatalog();
                break;
            case DemoType.PERFORMANCE:
                this.demoPerformance();
                break;
            case DemoType.MEMORY_USAGE:
                this.demoMemoryUsage();
                break;
            case DemoType.PALETTE_COMPRESSION:
                this.demoPaletteCompression();
                break;
        }
    }
    
    /**
     * 基础使用演示
     */
    private demoBasicUsage(): void {
        console.log('\n=== 基础使用演示 ===');
        
        // 1. 设置单个方块
        this.world.setBlock(0, 64, 0, 'minecraft:stone');
        this.world.setBlock(1, 64, 0, 'minecraft:grass_block');
        this.world.setBlock(2, 64, 0, 'minecraft:sand');
        
        // 2. 获取方块
        const block1 = this.world.getBlock(0, 64, 0);
        const block2 = this.world.getBlock(1, 64, 0);
        console.log(`方块 (0,64,0): ${block1}`);
        console.log(`方块 (1,64,0): ${block2}`);
        
        // 3. 批量设置方块
        const positions = [];
        for (let x = -5; x <= 5; x++) {
            for (let z = -5; z <= 5; z++) {
                positions.push({ x, y: 63, z, blockId: 'minecraft:cobblestone' });
            }
        }
        const count = this.world.setBlocks(positions);
        console.log(`批量设置了 ${count} 个方块`);
        
        // 4. 填充区域
        const fillCount = this.world.fillRegion(
            new Vec3(-3, 65, -3),
            new Vec3(3, 67, 3),
            'minecraft:glass'
        );
        console.log(`填充了 ${fillCount} 个玻璃方块`);
        
        // 5. 射线检测
        const rayResult = this.world.raycast(
            new Vec3(10, 70, 10),
            new Vec3(-1, -1, -1),
            50
        );
        
        if (rayResult.hit) {
            console.log(`射线击中: ${rayResult.blockId} at (${rayResult.position.x}, ${rayResult.position.y}, ${rayResult.position.z})`);
        }
    }
    
    /**
     * 方块目录演示
     */
    private demoBlockCatalog(): void {
        console.log('\n=== 方块目录演示 ===');
        
        // 1. 获取所有方块
        const allBlocks = BlockCatalog.getAllBlocks();
        console.log(`总共有 ${allBlocks.length} 种方块`);
        
        // 2. 按分类获取
        const categories = BlockCatalog.getCategories();
        console.log(`分类信息:`);
        categories.forEach(cat => {
            console.log(`  ${cat.displayName}: ${cat.blocks.length} 个方块`);
        });
        
        // 3. 搜索方块
        const buildingBlocks = searchBlocks({
            query: '石',
            sortBy: 'name',
            limit: 5
        });
        
        console.log(`搜索 "石" 相关的方块:`);
        buildingBlocks.forEach(block => {
            console.log(`  ${block.displayName} (${block.id})`);
        });
        
        // 4. 记录使用并查看统计
        BlockCatalog.recordBlockUsage('minecraft:stone');
        BlockCatalog.recordBlockUsage('minecraft:grass_block');
        BlockCatalog.recordBlockUsage('minecraft:stone'); // 再次使用
        
        const stats = BlockCatalog.getCatalogStats();
        console.log(`目录统计:`, stats);
        
        // 5. 收藏功能
        BlockCatalog.addToFavorites('minecraft:diamond_block');
        const favorites = BlockCatalog.getFavoriteBlocks();
        console.log(`收藏的方块: ${favorites.length} 个`);
    }
    
    /**
     * 性能演示
     */
    private demoPerformance(): void {
        console.log('\n=== 性能演示 ===');
        
        const startTime = performance.now();
        
        // 大量方块设置测试
        const testPositions = [];
        for (let x = 0; x < 50; x++) {
            for (let z = 0; z < 50; z++) {
                for (let y = 60; y < 65; y++) {
                    testPositions.push({ 
                        x, y, z, 
                        blockId: y === 64 ? 'minecraft:grass_block' : 'minecraft:dirt'
                    });
                }
            }
        }
        
        const setCount = this.world.setBlocks(testPositions);
        const setTime = performance.now() - startTime;
        
        console.log(`设置 ${setCount} 个方块耗时: ${setTime.toFixed(2)}ms`);
        
        // 批量读取测试
        const readStartTime = performance.now();
        let readCount = 0;
        
        for (let x = 0; x < 50; x++) {
            for (let z = 0; z < 50; z++) {
                for (let y = 60; y < 65; y++) {
                    const block = this.world.getBlock(x, y, z);
                    if (block !== 'minecraft:air') readCount++;
                }
            }
        }
        
        const readTime = performance.now() - readStartTime;
        console.log(`读取 ${readCount} 个方块耗时: ${readTime.toFixed(2)}ms`);
        
        // 获取世界统计信息
        const worldStats = this.world.getWorldStats();
        console.log('世界统计信息:', worldStats);
    }
    
    /**
     * 内存使用演示
     */
    private demoMemoryUsage(): void {
        console.log('\n=== 内存使用演示 ===');
        
        // 创建不同类型的chunk来展示内存差异
        
        // 1. 空chunk（只有空气）
        const emptyChunk = VoxelChunkStorage.createChunk(10, 10);
        VoxelChunkStorage.fillChunk(emptyChunk, 'minecraft:air');
        const emptyStats = VoxelChunkStorage.getChunkStats(emptyChunk);
        console.log('空气Chunk统计:', emptyStats);
        
        // 2. 单一方块chunk
        const uniformChunk = VoxelChunkStorage.createChunk(11, 11);
        VoxelChunkStorage.fillChunk(uniformChunk, 'minecraft:stone');
        const uniformStats = VoxelChunkStorage.getChunkStats(uniformChunk);
        console.log('单一方块Chunk统计:', uniformStats);
        
        // 3. 混合方块chunk
        const mixedChunk = VoxelChunkStorage.createChunk(12, 12);
        const blockTypes = ['minecraft:stone', 'minecraft:dirt', 'minecraft:grass_block', 'minecraft:sand'];
        
        for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
                for (let y = 0; y < 16; y++) {
                    const blockType = blockTypes[(x + z + y) % blockTypes.length];
                    VoxelChunkStorage.setBlock(mixedChunk, x, y, z, blockType);
                }
            }
        }
        
        const mixedStats = VoxelChunkStorage.getChunkStats(mixedChunk);
        console.log('混合方块Chunk统计:', mixedStats);
        
        // 4. 优化前后对比
        console.log('优化前调色板大小:', mixedChunk.palette.size());
        VoxelChunkStorage.optimizeChunk(mixedChunk);
        console.log('优化后调色板大小:', mixedChunk.palette.size());
        
        // 清理测试chunk
        VoxelChunkStorage.freeChunk(emptyChunk);
        VoxelChunkStorage.freeChunk(uniformChunk);
        VoxelChunkStorage.freeChunk(mixedChunk);
    }
    
    /**
     * 调色板压缩演示
     */
    private demoPaletteCompression(): void {
        console.log('\n=== 调色板压缩演示 ===');
        
        // 展示不同方块数量下的存储类型
        const testChunk = VoxelChunkStorage.createChunk(20, 20);
        
        // 1. 4位存储 (<=16种方块)
        for (let i = 0; i < 15; i++) {
            const blockId = `minecraft:${i < 10 ? 'block_0' + i : 'block_' + i}`;
            // 注册测试方块
            if (!BlockRegistry.exists(blockId)) {
                BlockRegistry.register({
                    id: blockId,
                    displayName: `测试方块${i}`,
                    category: 'miscellaneous' as any,
                    renderType: 'cube' as any,
                    properties: {
                        hardness: 1,
                        transparent: false,
                        luminance: 0,
                        flammable: false,
                        solid: true,
                        waterlogged: false,
                        gravity: false
                    },
                    textures: { all: 'test' }
                });
            }
            VoxelChunkStorage.setBlock(testChunk, i, 64, 0, blockId);
        }
        
        let stats = VoxelChunkStorage.getChunkStats(testChunk);
        console.log('15种方块时:', stats.palette);
        
        // 2. 8位存储 (17种方块)
        VoxelChunkStorage.setBlock(testChunk, 15, 64, 0, 'minecraft:stone');
        VoxelChunkStorage.setBlock(testChunk, 16, 64, 0, 'minecraft:dirt');
        
        stats = VoxelChunkStorage.getChunkStats(testChunk);
        console.log('17种方块时:', stats.palette);
        
        // 显示压缩效果
        console.log(`压缩比: ${stats.palette.compressionRatio}x`);
        console.log(`内存占用: ${(stats.memoryUsage.total / 1024).toFixed(2)} KB`);
        
        VoxelChunkStorage.freeChunk(testChunk);
    }
    
    /**
     * 获取使用指南
     */
    public static getUsageGuide(): string {
        return `
现代体素系统使用指南:

1. 基础用法:
   - 创建世界: const world = new VoxelWorld(); await world.initialize();
   - 设置方块: world.setBlock(x, y, z, 'minecraft:stone');
   - 获取方块: const block = world.getBlock(x, y, z);
   - 批量操作: world.setBlocks(positions);

2. 方块目录:
   - 搜索方块: searchBlocks({ query: '石头' });
   - 获取分类: getBlockCategories();
   - 记录使用: recordBlockUsage('minecraft:stone');

3. 性能优化:
   - 使用调色板压缩大幅减少内存占用
   - 批量操作比单个操作快10-100倍
   - 定期调用 world.optimizeWorld() 进行优化

4. UI集成:
   - 使用 BlockCatalog 为UI提供方块列表
   - 支持搜索、分类、收藏、最近使用等功能
   - 所有API使用字符串ID，类型安全

5. 系统优势:
   - 内存压缩比可达50-90%
   - 支持无限种方块类型
   - 完全兼容Minecraft资源包格式
   - TypeScript类型安全
        `;
    }
}

enum DemoType {
    BASIC_USAGE = 0,        // 基础使用
    BLOCK_CATALOG = 1,      // 方块目录
    PERFORMANCE = 2,        // 性能测试
    MEMORY_USAGE = 3,       // 内存使用
    PALETTE_COMPRESSION = 4 // 调色板压缩
}