/**
 * 现代体素世界管理器
 * 使用调色板压缩和字符串ID系统
 * 替代旧的VoxelWorldManager
 */

import { Vec3 } from 'cc';
import { ModernVoxelChunk, VoxelChunkStorage } from '../core/VoxelChunkStorage';
import { BlockRegistry, MinecraftBlockId } from '../core/VoxelBlockRegistry';
import { VoxelSystem } from '../VoxelSystem';
import { VoxelConfig } from '../core/VoxelConfig';

export interface WorldStats {
    loadedChunks: number;
    totalBlocks: number;
    memoryUsage: number;
    compressionRatio: number;
    cacheHits: number;
    cacheMisses: number;
}

export interface ChunkLoadOptions {
    generateTerrain?: boolean;
    loadFromDisk?: boolean;
    priority?: 'low' | 'normal' | 'high';
}

/**
 * 现代体素世界管理器
 */
export class VoxelWorld {
    private chunks: Map<string, ModernVoxelChunk> = new Map();
    private chunkCount: number = 0;
    
    // 配置参数
    private loadRadius: number = VoxelConfig.CREATE_CHUNK_RADIUS || 3;
    private unloadRadius: number = VoxelConfig.DELETE_CHUNK_RADIUS || 5;
    private renderRadius: number = VoxelConfig.RENDER_CHUNK_RADIUS || 4;
    
    // 集成系统
    private voxelSystem: VoxelSystem | null = null;
    
    // 性能统计
    private stats = {
        cacheHits: 0,
        cacheMisses: 0,
        totalBlockOperations: 0
    };
    
    // 地形生成器（简化版）
    private terrainGenerator: TerrainGenerator;
    
    constructor() {
        console.log('[VoxelWorld] 初始化现代体素世界管理器...');
        this.terrainGenerator = new TerrainGenerator();
        
        // 尝试获取体素渲染系统
        this.voxelSystem = VoxelSystem.getInstance();
    }
    
    /**
     * 初始化世界
     */
    async initialize(): Promise<void> {
        console.log('[VoxelWorld] 开始初始化世界...');
        
        // 确保方块注册表已初始化
        if (!BlockRegistry) {
            throw new Error('BlockRegistry not initialized');
        }
        
        // 初始化体素渲染系统
        if (this.voxelSystem && !this.voxelSystem.getSystemStatus().initialized) {
            await this.voxelSystem.initialize();
        }
        
        console.log('[VoxelWorld] 世界初始化完成');
    }
    
    /**
     * 生成Chunk键
     */
    private getChunkKey(p: number, q: number): string {
        return `${p}_${q}`;
    }
    
    /**
     * 从世界坐标获取Chunk坐标
     */
    private getChunkCoords(x: number, z: number): { p: number, q: number } {
        return VoxelChunkStorage.getChunkCoords(x, z);
    }
    
    /**
     * 获取Chunk（如果不存在则创建）
     */
    getOrCreateChunk(p: number, q: number, options?: ChunkLoadOptions): ModernVoxelChunk {
        const key = this.getChunkKey(p, q);
        let chunk = this.chunks.get(key);
        
        if (!chunk) {
            this.stats.cacheMisses++;
            chunk = this.createChunk(p, q, options);
        } else {
            this.stats.cacheHits++;
        }
        
        return chunk;
    }
    
    /**
     * 创建新Chunk
     */
    private createChunk(p: number, q: number, options?: ChunkLoadOptions): ModernVoxelChunk {
        const chunk = VoxelChunkStorage.createChunk(p, q);
        const key = this.getChunkKey(p, q);
        
        this.chunks.set(key, chunk);
        this.chunkCount++;
        
        // 生成地形
        if (options?.generateTerrain !== false) {
            this.terrainGenerator.generateTerrain(chunk);
        }
        
        console.log(`[VoxelWorld] 创建Chunk(${p},${q})，当前总数: ${this.chunkCount}`);
        return chunk;
    }
    
    /**
     * 获取已存在的Chunk
     */
    getChunk(p: number, q: number): ModernVoxelChunk | null {
        const key = this.getChunkKey(p, q);
        return this.chunks.get(key) || null;
    }
    
    /**
     * 卸载Chunk
     */
    unloadChunk(p: number, q: number): boolean {
        const key = this.getChunkKey(p, q);
        const chunk = this.chunks.get(key);
        
        if (chunk) {
            VoxelChunkStorage.freeChunk(chunk);
            this.chunks.delete(key);
            this.chunkCount--;
            console.log(`[VoxelWorld] 卸载Chunk(${p},${q})，剩余: ${this.chunkCount}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * 设置方块（世界坐标）
     */
    setBlock(x: number, y: number, z: number, blockId: MinecraftBlockId | string): boolean {
        if (!this.isValidCoordinate(x, y, z)) {
            console.warn(`[VoxelWorld] 无效坐标: (${x}, ${y}, ${z})`);
            return false;
        }
        
        // 验证方块ID
        if (!BlockRegistry.exists(blockId)) {
            console.warn(`[VoxelWorld] 未知方块ID: ${blockId}`);
            return false;
        }
        
        const { p, q } = this.getChunkCoords(x, z);
        const chunk = this.getOrCreateChunk(p, q);
        
        const success = VoxelChunkStorage.setBlock(chunk, x, y, z, blockId);
        
        if (success) {
            this.stats.totalBlockOperations++;
            this.markNeighborChunksForUpdate(p, q);
        }
        
        return success;
    }
    
    /**
     * 获取方块（世界坐标）
     */
    getBlock(x: number, y: number, z: number): string {
        if (!this.isValidCoordinate(x, y, z)) {
            return 'minecraft:air';
        }
        
        const { p, q } = this.getChunkCoords(x, z);
        const chunk = this.getChunk(p, q);
        
        if (!chunk) {
            // 如果Chunk不存在，返回地形生成器的预测值
            return this.terrainGenerator.predictBlockAt(x, y, z);
        }
        
        this.stats.totalBlockOperations++;
        return VoxelChunkStorage.getBlock(chunk, x, y, z);
    }
    
    /**
     * 批量设置方块
     */
    setBlocks(positions: Array<{ x: number, y: number, z: number, blockId: string }>): number {
        let successCount = 0;
        const chunkUpdates = new Map<string, Array<{ x: number, y: number, z: number }>>();
        
        // 按Chunk分组
        for (const pos of positions) {
            if (!this.isValidCoordinate(pos.x, pos.y, pos.z)) continue;
            if (!BlockRegistry.exists(pos.blockId)) continue;
            
            const { p, q } = this.getChunkCoords(pos.x, pos.z);
            const key = this.getChunkKey(p, q);
            
            if (!chunkUpdates.has(key)) {
                chunkUpdates.set(key, []);
            }
            chunkUpdates.get(key)!.push(pos);
        }
        
        // 批量更新每个Chunk
        for (const [chunkKey, chunkPositions] of chunkUpdates) {
            const [pStr, qStr] = chunkKey.split('_');
            const p = parseInt(pStr), q = parseInt(qStr);
            const chunk = this.getOrCreateChunk(p, q);
            
            // 按方块类型再次分组以优化调色板操作
            const blockGroups = new Map<string, Array<{ x: number, y: number, z: number }>>();
            for (const pos of chunkPositions) {
                if (!blockGroups.has(pos.blockId)) {
                    blockGroups.set(pos.blockId, []);
                }
                blockGroups.get(pos.blockId)!.push(pos);
            }
            
            // 批量设置同类型方块
            for (const [blockId, blockPositions] of blockGroups) {
                VoxelChunkStorage.setBlocks(chunk, blockPositions, blockId);
                successCount += blockPositions.length;
            }
            
            this.markNeighborChunksForUpdate(p, q);
        }
        
        this.stats.totalBlockOperations += successCount;
        return successCount;
    }
    
    /**
     * 填充区域
     */
    fillRegion(min: Vec3, max: Vec3, blockId: MinecraftBlockId | string): number {
        if (!BlockRegistry.exists(blockId)) {
            console.warn(`[VoxelWorld] 未知方块ID: ${blockId}`);
            return 0;
        }
        
        const positions: Array<{ x: number, y: number, z: number, blockId: string }> = [];
        
        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    if (this.isValidCoordinate(x, y, z)) {
                        positions.push({ x, y, z, blockId });
                    }
                }
            }
        }
        
        return this.setBlocks(positions);
    }
    
    /**
     * 检查坐标有效性
     */
    private isValidCoordinate(x: number, y: number, z: number): boolean {
        return Number.isInteger(x) && 
               Number.isInteger(z) && 
               Number.isInteger(y) && 
               y >= 0 && 
               y < VoxelConfig.MAX_HEIGHT;
    }
    
    /**
     * 标记邻近Chunk需要更新
     */
    private markNeighborChunksForUpdate(p: number, q: number): void {
        const neighbors = [
            { p: p - 1, q }, { p: p + 1, q },
            { p, q: q - 1 }, { p, q: q + 1 }
        ];
        
        for (const { p: np, q: nq } of neighbors) {
            const chunk = this.getChunk(np, nq);
            if (chunk) {
                chunk.meshDirty = true;
            }
        }
    }
    
    /**
     * 更新玩家周围的Chunk
     */
    updateChunksAroundPlayer(playerX: number, playerZ: number): void {
        const { p: playerP, q: playerQ } = this.getChunkCoords(playerX, playerZ);
        
        // 卸载远距离Chunk
        this.unloadDistantChunks(playerP, playerQ);
        
        // 加载近距离Chunk
        this.loadNearbyChunks(playerP, playerQ);
    }
    
    /**
     * 卸载远距离Chunk
     */
    private unloadDistantChunks(playerP: number, playerQ: number): void {
        const chunksToUnload: Array<{ p: number, q: number }> = [];
        
        for (const chunk of this.chunks.values()) {
            const distance = Math.max(
                Math.abs(chunk.p - playerP),
                Math.abs(chunk.q - playerQ)
            );
            
            if (distance > this.unloadRadius) {
                chunksToUnload.push({ p: chunk.p, q: chunk.q });
            }
        }
        
        for (const { p, q } of chunksToUnload) {
            this.unloadChunk(p, q);
        }
    }
    
    /**
     * 加载近距离Chunk
     */
    private loadNearbyChunks(playerP: number, playerQ: number): void {
        for (let dp = -this.loadRadius; dp <= this.loadRadius; dp++) {
            for (let dq = -this.loadRadius; dq <= this.loadRadius; dq++) {
                const p = playerP + dp;
                const q = playerQ + dq;
                
                const distance = Math.max(Math.abs(dp), Math.abs(dq));
                if (distance <= this.loadRadius && !this.getChunk(p, q)) {
                    this.getOrCreateChunk(p, q, { generateTerrain: true });
                }
            }
        }
    }
    
    /**
     * 获取渲染范围内的Chunk
     */
    getRenderableChunks(playerX: number, playerZ: number): ModernVoxelChunk[] {
        const { p: playerP, q: playerQ } = this.getChunkCoords(playerX, playerZ);
        const renderableChunks: ModernVoxelChunk[] = [];
        
        for (const chunk of this.chunks.values()) {
            const distance = Math.max(
                Math.abs(chunk.p - playerP),
                Math.abs(chunk.q - playerQ)
            );
            
            if (distance <= this.renderRadius && !chunk.isEmpty) {
                renderableChunks.push(chunk);
            }
        }
        
        return renderableChunks;
    }
    
    /**
     * 获取需要网格更新的Chunk
     */
    getDirtyChunks(): ModernVoxelChunk[] {
        return Array.from(this.chunks.values()).filter(chunk => chunk.meshDirty);
    }
    
    /**
     * 射线检测
     */
    raycast(
        start: Vec3,
        direction: Vec3,
        maxDistance: number = 100
    ): { hit: boolean, position?: Vec3, blockId?: string, normal?: Vec3 } {
        
        const step = 0.1;
        const steps = Math.floor(maxDistance / step);
        const dir = direction.clone().normalize();
        
        for (let i = 0; i <= steps; i++) {
            const pos = start.clone().add(dir.clone().multiplyScalar(i * step));
            const x = Math.floor(pos.x);
            const y = Math.floor(pos.y);
            const z = Math.floor(pos.z);
            
            if (!this.isValidCoordinate(x, y, z)) continue;
            
            const blockId = this.getBlock(x, y, z);
            if (blockId !== 'minecraft:air') {
                // 计算法向量（简化版）
                const normal = this.calculateBlockNormal(start, new Vec3(x, y, z));
                
                return {
                    hit: true,
                    position: new Vec3(x, y, z),
                    blockId,
                    normal
                };
            }
        }
        
        return { hit: false };
    }
    
    /**
     * 计算方块法向量（简化实现）
     */
    private calculateBlockNormal(rayStart: Vec3, blockPos: Vec3): Vec3 {
        const diff = rayStart.clone().subtract(blockPos.clone().add(new Vec3(0.5, 0.5, 0.5)));
        const absX = Math.abs(diff.x);
        const absY = Math.abs(diff.y);
        const absZ = Math.abs(diff.z);
        
        if (absX > absY && absX > absZ) {
            return new Vec3(diff.x > 0 ? 1 : -1, 0, 0);
        } else if (absY > absZ) {
            return new Vec3(0, diff.y > 0 ? 1 : -1, 0);
        } else {
            return new Vec3(0, 0, diff.z > 0 ? 1 : -1);
        }
    }
    
    /**
     * 获取世界统计信息
     */
    getWorldStats(): WorldStats {
        let totalBlocks = 0;
        let totalMemory = 0;
        let totalUncompressedSize = 0;
        
        for (const chunk of this.chunks.values()) {
            const stats = VoxelChunkStorage.getChunkStats(chunk);
            totalBlocks += stats.blockCount;
            totalMemory += stats.memoryUsage.total;
            totalUncompressedSize += 16 * 16 * 256 * 4; // 假设每个方块4字节
        }
        
        return {
            loadedChunks: this.chunkCount,
            totalBlocks,
            memoryUsage: totalMemory,
            compressionRatio: totalUncompressedSize > 0 ? totalUncompressedSize / totalMemory : 1,
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses
        };
    }
    
    /**
     * 优化世界（清理和压缩）
     */
    optimizeWorld(): void {
        console.log('[VoxelWorld] 开始世界优化...');
        
        let optimizedChunks = 0;
        for (const chunk of this.chunks.values()) {
            VoxelChunkStorage.optimizeChunk(chunk);
            optimizedChunks++;
        }
        
        console.log(`[VoxelWorld] 优化完成，处理了 ${optimizedChunks} 个Chunk`);
    }
    
    /**
     * 清理世界
     */
    clear(): void {
        for (const chunk of this.chunks.values()) {
            VoxelChunkStorage.freeChunk(chunk);
        }
        
        this.chunks.clear();
        this.chunkCount = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        this.stats.totalBlockOperations = 0;
        
        console.log('[VoxelWorld] 世界已清理');
    }
    
    /**
     * 设置配置参数
     */
    setLoadRadius(radius: number): void { this.loadRadius = Math.max(1, radius); }
    setUnloadRadius(radius: number): void { this.unloadRadius = Math.max(2, radius); }
    setRenderRadius(radius: number): void { this.renderRadius = Math.max(1, radius); }
    
    /**
     * 获取配置参数
     */
    getLoadRadius(): number { return this.loadRadius; }
    getUnloadRadius(): number { return this.unloadRadius; }
    getRenderRadius(): number { return this.renderRadius; }
}

/**
 * 简化的地形生成器
 */
class TerrainGenerator {
    generateTerrain(chunk: ModernVoxelChunk): void {
        // 简单的平地生成
        const groundLevel = 64;
        
        for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
                for (let y = 0; y < groundLevel; y++) {
                    const blockId = y < groundLevel - 1 ? 'minecraft:stone' : 'minecraft:grass_block';
                    VoxelChunkStorage.setBlock(chunk, x, y, z, blockId);
                }
            }
        }
        
        // 随机添加一些植物
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * 16);
            const z = Math.floor(Math.random() * 16);
            const plantType = Math.random() > 0.5 ? 'minecraft:dandelion' : 'minecraft:grass';
            VoxelChunkStorage.setBlock(chunk, x, groundLevel, z, plantType);
        }
    }
    
    predictBlockAt(x: number, y: number, z: number): string {
        const groundLevel = 64;
        if (y < groundLevel - 1) return 'minecraft:stone';
        if (y === groundLevel - 1) return 'minecraft:grass_block';
        return 'minecraft:air';
    }
}