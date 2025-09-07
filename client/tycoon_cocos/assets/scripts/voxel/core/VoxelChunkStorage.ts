/**
 * 现代体素Chunk存储系统
 * 使用调色板压缩技术，大幅优化内存占用和性能
 */

import { ChunkPalette, PaletteManager } from './VoxelPalette';
import { VoxelConfig } from './VoxelConfig';

export interface ModernVoxelChunk {
    // Chunk坐标
    p: number;  // X方向chunk坐标
    q: number;  // Z方向chunk坐标
    
    // 调色板压缩存储
    palette: ChunkPalette;                          // 方块调色板
    blocks: Uint8Array | Uint16Array;               // 压缩的方块数据
    lights: Uint8Array;                             // 光照数据（8位足够）
    
    // 渲染相关
    dirty: boolean;                                 // 是否需要重新生成网格
    meshDirty: boolean;                             // 网格是否需要更新
    faces: number;                                  // 可见面数量
    
    // 高度优化
    minY: number;                                   // 最低非空方块Y坐标
    maxY: number;                                   // 最高非空方块Y坐标
    
    // 渲染节点
    node?: any;                                     // Cocos Creator渲染节点
    
    // 统计信息
    blockCount: number;                             // 非空方块数量
    lastAccessTime: number;                         // 最后访问时间（用于缓存管理）
    
    // 性能优化标记
    isEmpty: boolean;                               // 是否为空chunk（只有空气）
    isFull: boolean;                                // 是否为满chunk（无空气）
    isUniform: boolean;                             // 是否为单一方块类型
    uniformBlockId?: string;                        // 单一方块的ID（当isUniform为true时）
}

/**
 * Chunk存储操作类
 * 提供高效的方块访问和修改操作
 */
export class VoxelChunkStorage {
    private static readonly CHUNK_SIZE = VoxelConfig.CHUNK_SIZE || 16;
    private static readonly MAX_HEIGHT = VoxelConfig.MAX_HEIGHT || 256;
    private static readonly BLOCKS_PER_CHUNK = this.CHUNK_SIZE * this.CHUNK_SIZE * this.MAX_HEIGHT;
    
    /**
     * 创建新的现代Chunk
     */
    static createChunk(p: number, q: number): ModernVoxelChunk {
        const palette = new ChunkPalette();
        const chunk: ModernVoxelChunk = {
            p,
            q,
            palette,
            blocks: palette.createStorageArray(this.BLOCKS_PER_CHUNK),
            lights: new Uint8Array(this.BLOCKS_PER_CHUNK),
            dirty: true,
            meshDirty: true,
            faces: 0,
            minY: this.MAX_HEIGHT,
            maxY: 0,
            blockCount: 0,
            lastAccessTime: Date.now(),
            isEmpty: true,
            isFull: false,
            isUniform: true,
            uniformBlockId: 'minecraft:air'
        };
        
        // 初始化为全空气
        this.fillChunk(chunk, 'minecraft:air');
        
        PaletteManager.registerPalette(palette);
        return chunk;
    }
    
    /**
     * 释放Chunk内存
     */
    static freeChunk(chunk: ModernVoxelChunk): void {
        PaletteManager.unregisterPalette(chunk.palette);
        
        if (chunk.node) {
            chunk.node.destroy();
            chunk.node = null;
        }
        
        // 清理引用
        chunk.blocks = null as any;
        chunk.lights = null as any;
        chunk.palette = null as any;
    }
    
    /**
     * 坐标转换：世界坐标到Chunk内索引
     */
    private static getChunkIndex(x: number, y: number, z: number): number {
        const localX = x & (this.CHUNK_SIZE - 1);  // x % CHUNK_SIZE
        const localZ = z & (this.CHUNK_SIZE - 1);  // z % CHUNK_SIZE
        const localY = Math.max(0, Math.min(y, this.MAX_HEIGHT - 1));
        
        // 使用Y-Z-X顺序存储，便于垂直访问
        return localY * (this.CHUNK_SIZE * this.CHUNK_SIZE) + localZ * this.CHUNK_SIZE + localX;
    }
    
    /**
     * 获取Chunk坐标
     */
    static getChunkCoords(worldX: number, worldZ: number): { p: number, q: number } {
        return {
            p: Math.floor(worldX / this.CHUNK_SIZE),
            q: Math.floor(worldZ / this.CHUNK_SIZE)
        };
    }
    
    /**
     * 设置方块
     */
    static setBlock(chunk: ModernVoxelChunk, x: number, y: number, z: number, blockId: string): boolean {
        if (y < 0 || y >= this.MAX_HEIGHT) {
            return false;
        }
        
        const index = this.getChunkIndex(x, y, z);
        const oldIndex = chunk.palette.readFromStorage(chunk.blocks, index);
        const oldBlockId = chunk.palette.getBlockId(oldIndex);
        
        if (oldBlockId === blockId) {
            return false; // 没有变化
        }
        
        // 获取新方块的调色板索引
        const newIndex = chunk.palette.getOrAddIndex(blockId);
        
        // 检查是否需要升级存储数组
        const newStorageType = chunk.palette.getStorageType();
        if (this.needStorageUpgrade(chunk, newStorageType)) {
            this.upgradeStorage(chunk, newStorageType);
        }
        
        // 写入新数据
        chunk.palette.writeToStorage(chunk.blocks, index, newIndex);
        
        // 更新统计信息
        this.updateChunkStats(chunk, oldBlockId, blockId, y);
        
        // 标记为脏
        chunk.dirty = true;
        chunk.meshDirty = true;
        chunk.lastAccessTime = Date.now();
        
        return true;
    }
    
    /**
     * 获取方块
     */
    static getBlock(chunk: ModernVoxelChunk, x: number, y: number, z: number): string {
        if (y < 0 || y >= this.MAX_HEIGHT) {
            return 'minecraft:air';
        }
        
        chunk.lastAccessTime = Date.now();
        
        // 如果是单一方块类型的chunk，直接返回
        if (chunk.isUniform && chunk.uniformBlockId) {
            return chunk.uniformBlockId;
        }
        
        const index = this.getChunkIndex(x, y, z);
        const paletteIndex = chunk.palette.readFromStorage(chunk.blocks, index);
        return chunk.palette.getBlockId(paletteIndex);
    }
    
    /**
     * 填充整个Chunk为指定方块
     */
    static fillChunk(chunk: ModernVoxelChunk, blockId: string): void {
        const paletteIndex = chunk.palette.getOrAddIndex(blockId);
        
        // 优化：如果是单一方块类型，可以使用特殊存储
        chunk.isUniform = true;
        chunk.uniformBlockId = blockId;
        chunk.isEmpty = blockId === 'minecraft:air';
        chunk.isFull = blockId !== 'minecraft:air';
        
        // 填充存储数组
        for (let i = 0; i < this.BLOCKS_PER_CHUNK; i++) {
            chunk.palette.writeToStorage(chunk.blocks, i, paletteIndex);
        }
        
        // 更新统计信息
        if (blockId === 'minecraft:air') {
            chunk.blockCount = 0;
            chunk.minY = this.MAX_HEIGHT;
            chunk.maxY = 0;
        } else {
            chunk.blockCount = this.BLOCKS_PER_CHUNK;
            chunk.minY = 0;
            chunk.maxY = this.MAX_HEIGHT - 1;
        }
        
        chunk.dirty = true;
        chunk.meshDirty = true;
    }
    
    /**
     * 批量设置方块
     */
    static setBlocks(chunk: ModernVoxelChunk, positions: Array<{x: number, y: number, z: number}>, blockId: string): void {
        const paletteIndex = chunk.palette.getOrAddIndex(blockId);
        
        // 检查是否需要升级存储
        const newStorageType = chunk.palette.getStorageType();
        if (this.needStorageUpgrade(chunk, newStorageType)) {
            this.upgradeStorage(chunk, newStorageType);
        }
        
        let changed = false;
        for (const pos of positions) {
            if (pos.y >= 0 && pos.y < this.MAX_HEIGHT) {
                const index = this.getChunkIndex(pos.x, pos.y, pos.z);
                const oldIndex = chunk.palette.readFromStorage(chunk.blocks, index);
                
                if (oldIndex !== paletteIndex) {
                    chunk.palette.writeToStorage(chunk.blocks, index, paletteIndex);
                    const oldBlockId = chunk.palette.getBlockId(oldIndex);
                    this.updateChunkStats(chunk, oldBlockId, blockId, pos.y);
                    changed = true;
                }
            }
        }
        
        if (changed) {
            chunk.dirty = true;
            chunk.meshDirty = true;
            chunk.lastAccessTime = Date.now();
        }
    }
    
    /**
     * 设置光照值
     */
    static setLight(chunk: ModernVoxelChunk, x: number, y: number, z: number, light: number): void {
        if (y < 0 || y >= this.MAX_HEIGHT) return;
        
        const index = this.getChunkIndex(x, y, z);
        chunk.lights[index] = Math.max(0, Math.min(255, light));
        chunk.dirty = true;
    }
    
    /**
     * 获取光照值
     */
    static getLight(chunk: ModernVoxelChunk, x: number, y: number, z: number): number {
        if (y < 0 || y >= this.MAX_HEIGHT) return 0;
        
        const index = this.getChunkIndex(x, y, z);
        return chunk.lights[index];
    }
    
    /**
     * 检查是否需要升级存储数组
     */
    private static needStorageUpgrade(chunk: ModernVoxelChunk, newStorageType: string): boolean {
        const currentType = chunk.blocks.constructor.name;
        
        if (newStorageType === 'uint16' && currentType !== 'Uint16Array') return true;
        if (newStorageType === 'uint8' && currentType === 'Uint8Array' && chunk.palette.size() > 16) return true;
        
        return false;
    }
    
    /**
     * 升级存储数组类型
     */
    private static upgradeStorage(chunk: ModernVoxelChunk, newStorageType: string): void {
        const oldBlocks = chunk.blocks;
        chunk.blocks = chunk.palette.createStorageArray(this.BLOCKS_PER_CHUNK);
        
        // 复制数据
        for (let i = 0; i < this.BLOCKS_PER_CHUNK; i++) {
            const value = chunk.palette.readFromStorage(oldBlocks, i);
            chunk.palette.writeToStorage(chunk.blocks, i, value);
        }
        
        console.log(`[VoxelChunkStorage] Chunk(${chunk.p},${chunk.q}) 存储升级到: ${newStorageType}`);
    }
    
    /**
     * 更新Chunk统计信息
     */
    private static updateChunkStats(chunk: ModernVoxelChunk, oldBlockId: string, newBlockId: string, y: number): void {
        // 更新方块计数
        if (oldBlockId === 'minecraft:air' && newBlockId !== 'minecraft:air') {
            chunk.blockCount++;
        } else if (oldBlockId !== 'minecraft:air' && newBlockId === 'minecraft:air') {
            chunk.blockCount--;
        }
        
        // 更新高度范围
        if (newBlockId !== 'minecraft:air') {
            chunk.minY = Math.min(chunk.minY, y);
            chunk.maxY = Math.max(chunk.maxY, y);
        } else if (chunk.blockCount === 0) {
            chunk.minY = this.MAX_HEIGHT;
            chunk.maxY = 0;
        }
        
        // 更新状态标记
        chunk.isEmpty = chunk.blockCount === 0;
        chunk.isFull = chunk.blockCount === this.BLOCKS_PER_CHUNK;
        
        // 检查是否还是单一类型
        if (chunk.isUniform && chunk.uniformBlockId !== newBlockId) {
            chunk.isUniform = false;
            chunk.uniformBlockId = undefined;
        }
    }
    
    /**
     * 优化Chunk存储（移除未使用的调色板条目）
     */
    static optimizeChunk(chunk: ModernVoxelChunk): void {
        // 统计每个调色板条目的使用次数
        const usageCounts = new Map<number, number>();
        
        for (let i = 0; i < this.BLOCKS_PER_CHUNK; i++) {
            const paletteIndex = chunk.palette.readFromStorage(chunk.blocks, i);
            usageCounts.set(paletteIndex, (usageCounts.get(paletteIndex) || 0) + 1);
        }
        
        // 优化调色板
        const indexMapping = chunk.palette.optimize(usageCounts);
        
        // 如果有映射变化，更新存储数据
        if (indexMapping.size > 0) {
            const newBlocks = chunk.palette.createStorageArray(this.BLOCKS_PER_CHUNK);
            
            for (let i = 0; i < this.BLOCKS_PER_CHUNK; i++) {
                const oldIndex = chunk.palette.readFromStorage(chunk.blocks, i);
                const newIndex = indexMapping.get(oldIndex) || 0;
                chunk.palette.writeToStorage(newBlocks, i, newIndex);
            }
            
            chunk.blocks = newBlocks;
            chunk.dirty = true;
        }
    }
    
    /**
     * 获取Chunk内所有非空方块
     */
    static getNonAirBlocks(chunk: ModernVoxelChunk): Array<{x: number, y: number, z: number, blockId: string}> {
        const blocks: Array<{x: number, y: number, z: number, blockId: string}> = [];
        
        for (let y = chunk.minY; y <= chunk.maxY; y++) {
            for (let z = 0; z < this.CHUNK_SIZE; z++) {
                for (let x = 0; x < this.CHUNK_SIZE; x++) {
                    const blockId = this.getBlock(chunk, x, y, z);
                    if (blockId !== 'minecraft:air') {
                        blocks.push({
                            x: chunk.p * this.CHUNK_SIZE + x,
                            y,
                            z: chunk.q * this.CHUNK_SIZE + z,
                            blockId
                        });
                    }
                }
            }
        }
        
        return blocks;
    }
    
    /**
     * 获取Chunk统计信息
     */
    static getChunkStats(chunk: ModernVoxelChunk) {
        const paletteStats = chunk.palette.getStats();
        
        return {
            coordinates: { p: chunk.p, q: chunk.q },
            blockCount: chunk.blockCount,
            isEmpty: chunk.isEmpty,
            isFull: chunk.isFull,
            isUniform: chunk.isUniform,
            uniformBlockId: chunk.uniformBlockId,
            heightRange: { min: chunk.minY, max: chunk.maxY },
            palette: paletteStats,
            memoryUsage: {
                blocks: chunk.blocks.byteLength,
                lights: chunk.lights.byteLength,
                total: chunk.blocks.byteLength + chunk.lights.byteLength + paletteStats.memoryUsage
            },
            lastAccess: chunk.lastAccessTime
        };
    }
    
    /**
     * 复制Chunk
     */
    static cloneChunk(source: ModernVoxelChunk): ModernVoxelChunk {
        const clone = this.createChunk(source.p, source.q);
        
        // 复制调色板
        clone.palette = source.palette.clone();
        
        // 复制存储数据
        clone.blocks = source.blocks.slice();
        clone.lights = source.lights.slice();
        
        // 复制属性
        clone.dirty = source.dirty;
        clone.meshDirty = source.meshDirty;
        clone.faces = source.faces;
        clone.minY = source.minY;
        clone.maxY = source.maxY;
        clone.blockCount = source.blockCount;
        clone.isEmpty = source.isEmpty;
        clone.isFull = source.isFull;
        clone.isUniform = source.isUniform;
        clone.uniformBlockId = source.uniformBlockId;
        
        return clone;
    }
}