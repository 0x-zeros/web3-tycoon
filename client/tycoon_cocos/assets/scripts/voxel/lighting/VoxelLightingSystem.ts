import { Vec3 } from 'cc';
import { VoxelChunk, VoxelMap } from '../core/VoxelTypes';
import { VoxelMapUtils } from '../world/VoxelMapUtils';
import { BlockRegistry } from '../core/VoxelBlock';

/**
 * 体素光照系统
 * 实现 Minecraft 风格的光照传播算法
 */
export class VoxelLightingSystem {
    private static readonly MAX_LIGHT_LEVEL = 15;
    private static readonly LIGHT_ATTENUATION = 1;
    
    // 6个方向的偏移量 (上下东西南北)
    private static readonly DIRECTIONS = [
        new Vec3(0, 1, 0),   // up
        new Vec3(0, -1, 0),  // down
        new Vec3(1, 0, 0),   // east
        new Vec3(-1, 0, 0),  // west
        new Vec3(0, 0, 1),   // south
        new Vec3(0, 0, -1)   // north
    ];

    /**
     * 初始化区块光照
     * @param chunk 区块
     * @param getBlockAt 获取方块函数
     */
    static initializeChunkLighting(
        chunk: VoxelChunk,
        getBlockAt: (x: number, y: number, z: number) => string
    ): void {
        console.log(`[VoxelLightingSystem] 初始化区块光照 (${chunk.p}, ${chunk.q})`);
        
        const chunkSize = 16; // 假设区块大小为16x16
        const lightSources: Array<{x: number, y: number, z: number, level: number}> = [];
        
        // 1. 清除现有光照数据
        this.clearChunkLighting(chunk);
        
        // 2. 扫描光源方块
        for (let x = chunk.p * chunkSize; x < (chunk.p + 1) * chunkSize; x++) {
            for (let z = chunk.q * chunkSize; z < (chunk.q + 1) * chunkSize; z++) {
                for (let y = chunk.miny; y <= chunk.maxy; y++) {
                    const blockId = getBlockAt(x, y, z);
                    if (blockId && blockId !== 'minecraft:air') {
                        const lightLevel = BlockRegistry.getLightLevel(blockId);
                        if (lightLevel > 0) {
                            lightSources.push({ x, y, z, level: lightLevel });
                            // 设置光源方块的光照值
                            VoxelMapUtils.setMap(chunk.lights, x - chunk.p * chunkSize, y, z - chunk.q * chunkSize, lightLevel);
                        }
                    }
                }
            }
        }
        
        console.log(`[VoxelLightingSystem] 找到 ${lightSources.length} 个光源`);
        
        // 3. 从每个光源开始传播光照
        for (const lightSource of lightSources) {
            this.propagateLight(
                chunk, 
                lightSource.x - chunk.p * chunkSize, 
                lightSource.y, 
                lightSource.z - chunk.q * chunkSize, 
                lightSource.level, 
                getBlockAt,
                chunk.p * chunkSize,
                chunk.q * chunkSize
            );
        }
    }

    /**
     * 传播光照
     * @param chunk 区块
     * @param startX 起始X坐标（相对区块）
     * @param startY 起始Y坐标（绝对）
     * @param startZ 起始Z坐标（相对区块）
     * @param lightLevel 光照等级
     * @param getBlockAt 获取方块函数
     * @param chunkBaseX 区块基准X坐标
     * @param chunkBaseZ 区块基准Z坐标
     */
    private static propagateLight(
        chunk: VoxelChunk,
        startX: number,
        startY: number,
        startZ: number,
        lightLevel: number,
        getBlockAt: (x: number, y: number, z: number) => string,
        chunkBaseX: number,
        chunkBaseZ: number
    ): void {
        
        // 使用广度优先搜索传播光照
        const lightQueue: Array<{x: number, y: number, z: number, level: number}> = [];
        const visited = new Set<string>();
        
        lightQueue.push({ x: startX, y: startY, z: startZ, level: lightLevel });
        visited.add(`${startX},${startY},${startZ}`);
        
        while (lightQueue.length > 0) {
            const current = lightQueue.shift()!;
            const { x, y, z, level } = current;
            
            // 传播到6个方向
            for (const dir of this.DIRECTIONS) {
                const nextX = x + dir.x;
                const nextY = y + dir.y;
                const nextZ = z + dir.z;
                
                // 检查边界
                if (nextX < 0 || nextX >= 16 || nextZ < 0 || nextZ >= 16) {
                    continue; // 超出区块边界
                }
                
                if (nextY < chunk.miny || nextY > chunk.maxy) {
                    continue; // 超出Y轴范围
                }
                
                const posKey = `${nextX},${nextY},${nextZ}`;
                if (visited.has(posKey)) {
                    continue; // 已访问
                }
                
                // 检查目标位置的方块
                const targetBlockId = getBlockAt(chunkBaseX + nextX, nextY, chunkBaseZ + nextZ);
                if (targetBlockId && targetBlockId !== 'minecraft:air') {
                    // 非空气方块，检查是否透明
                    if (!BlockRegistry.isTransparent(targetBlockId)) {
                        continue; // 不透明方块阻挡光照
                    }
                }
                
                // 计算衰减后的光照等级
                const newLightLevel = Math.max(0, level - this.LIGHT_ATTENUATION);
                if (newLightLevel <= 0) {
                    continue; // 光照已衰减到0
                }
                
                // 检查现有光照值
                const existingLight = VoxelMapUtils.getMap(chunk.lights, nextX, nextY, nextZ);
                if (existingLight >= newLightLevel) {
                    continue; // 现有光照更强，不需要更新
                }
                
                // 设置新的光照值
                VoxelMapUtils.setMap(chunk.lights, nextX, nextY, nextZ, newLightLevel);
                visited.add(posKey);
                
                // 继续传播
                if (newLightLevel > 1) {
                    lightQueue.push({ x: nextX, y: nextY, z: nextZ, level: newLightLevel });
                }
            }
        }
    }

    /**
     * 更新方块光照（当方块变化时调用）
     * @param chunk 区块
     * @param x 方块X坐标（相对区块）
     * @param y 方块Y坐标（绝对）
     * @param z 方块Z坐标（相对区块）
     * @param newBlockId 新方块ID
     * @param getBlockAt 获取方块函数
     * @param chunkBaseX 区块基准X坐标
     * @param chunkBaseZ 区块基准Z坐标
     */
    static updateBlockLighting(
        chunk: VoxelChunk,
        x: number,
        y: number,
        z: number,
        newBlockId: string,
        getBlockAt: (x: number, y: number, z: number) => string,
        chunkBaseX: number,
        chunkBaseZ: number
    ): void {
        
        // 如果新方块是光源
        const newLightLevel = BlockRegistry.getLightLevel(newBlockId);
        if (newLightLevel > 0) {
            // 设置光源光照值
            VoxelMapUtils.setMap(chunk.lights, x, y, z, newLightLevel);
            
            // 传播光照
            this.propagateLight(chunk, x, y, z, newLightLevel, getBlockAt, chunkBaseX, chunkBaseZ);
        } else {
            // 移除了光源或放置了不发光的方块
            const oldLight = VoxelMapUtils.getMap(chunk.lights, x, y, z);
            
            if (oldLight > 0) {
                // 需要重新计算光照
                this.removeLightAndRecalculate(chunk, x, y, z, getBlockAt, chunkBaseX, chunkBaseZ);
            }
        }
        
        chunk.dirty = true;
    }

    /**
     * 移除光照并重新计算
     * @param chunk 区块
     * @param x 方块X坐标（相对区块）
     * @param y 方块Y坐标（绝对）
     * @param z 方块Z坐标（相对区块）
     * @param getBlockAt 获取方块函数
     * @param chunkBaseX 区块基准X坐标
     * @param chunkBaseZ 区块基准Z坐标
     */
    private static removeLightAndRecalculate(
        chunk: VoxelChunk,
        x: number,
        y: number,
        z: number,
        getBlockAt: (x: number, y: number, z: number) => string,
        chunkBaseX: number,
        chunkBaseZ: number
    ): void {
        
        // 简化实现：重新初始化整个区块的光照
        // 更高效的实现应该只重新计算受影响的区域
        console.log(`[VoxelLightingSystem] 重新计算区块光照 (${chunk.p}, ${chunk.q})`);
        this.initializeChunkLighting(chunk, getBlockAt);
    }

    /**
     * 清除区块光照
     * @param chunk 区块
     */
    private static clearChunkLighting(chunk: VoxelChunk): void {
        const chunkSize = 16;
        
        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                for (let y = chunk.miny; y <= chunk.maxy; y++) {
                    VoxelMapUtils.setMap(chunk.lights, x, y, z, 0);
                }
            }
        }
    }

    /**
     * 获取方块的光照值
     * @param chunk 区块
     * @param x 方块X坐标（相对区块）
     * @param y 方块Y坐标（绝对）
     * @param z 方块Z坐标（相对区块）
     * @returns 光照值 (0-15)
     */
    static getBlockLight(chunk: VoxelChunk, x: number, y: number, z: number): number {
        return VoxelMapUtils.getMap(chunk.lights, x, y, z);
    }

    /**
     * 获取顶点的光照值（用于渲染）
     * 通过插值相邻方块的光照值来获得平滑的光照过渡
     * @param chunk 区块
     * @param worldX 世界坐标X
     * @param worldY 世界坐标Y
     * @param worldZ 世界坐标Z
     * @param chunkBaseX 区块基准X坐标
     * @param chunkBaseZ 区块基准Z坐标
     * @returns 插值后的光照值 (0-1)
     */
    static getInterpolatedLight(
        chunk: VoxelChunk,
        worldX: number,
        worldY: number,
        worldZ: number,
        chunkBaseX: number,
        chunkBaseZ: number
    ): number {
        
        // 转换为相对区块坐标
        const relX = worldX - chunkBaseX;
        const relZ = worldZ - chunkBaseZ;
        
        // 获取最近的方块光照值
        const blockX = Math.floor(relX);
        const blockY = Math.floor(worldY);
        const blockZ = Math.floor(relZ);
        
        // 边界检查
        if (blockX < 0 || blockX >= 16 || blockZ < 0 || blockZ >= 16 ||
            blockY < chunk.miny || blockY > chunk.maxy) {
            return 0; // 超出边界，返回0
        }
        
        const lightLevel = this.getBlockLight(chunk, blockX, blockY, blockZ);
        
        // 转换为0-1范围
        return lightLevel / this.MAX_LIGHT_LEVEL;
    }

    /**
     * 调试：输出区块光照信息
     * @param chunk 区块
     */
    static debugChunkLighting(chunk: VoxelChunk): void {
        console.log(`[VoxelLightingSystem] 区块 (${chunk.p}, ${chunk.q}) 光照调试信息:`);
        
        let lightCount = 0;
        let maxLight = 0;
        
        const chunkSize = 16;
        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                for (let y = chunk.miny; y <= chunk.maxy; y++) {
                    const light = VoxelMapUtils.getMap(chunk.lights, x, y, z);
                    if (light > 0) {
                        lightCount++;
                        maxLight = Math.max(maxLight, light);
                    }
                }
            }
        }
        
        console.log(`  - 有光照的方块: ${lightCount}`);
        console.log(`  - 最高光照等级: ${maxLight}`);
    }
}