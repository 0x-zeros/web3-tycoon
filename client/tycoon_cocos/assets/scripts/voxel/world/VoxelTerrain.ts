import { VoxelWorldFunc } from "../core/VoxelTypes";
import { VoxelNoise } from "../math/VoxelNoise";
import { VoxelConfig } from "../core/VoxelConfig";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldConfig, VoxelWorldMode } from "../core/VoxelWorldConfig";

export class VoxelTerrain {
    
    static createWorld(p: number, q: number, func: VoxelWorldFunc, arg?: any): void {
        const worldMode = VoxelWorldConfig.getMode();
        
        switch (worldMode) {
            case VoxelWorldMode.SMALL_FLAT:
            case VoxelWorldMode.TINY_DEBUG:
                this.createFlatWorld(p, q, func, arg);
                break;
            case VoxelWorldMode.NORMAL:
            default:
                this.createNormalWorld(p, q, func, arg);
                break;
        }
    }

    static createNormalWorld(p: number, q: number, func: VoxelWorldFunc, arg?: any): void {
        const chunkSize = VoxelConfig.CHUNK_SIZE;
        const pad = 1;
        
        for (let dx = -pad; dx < chunkSize + pad; dx++) {
            for (let dz = -pad; dz < chunkSize + pad; dz++) {
                let flag = 1;
                if (dx < 0 || dz < 0 || dx >= chunkSize || dz >= chunkSize) {
                    flag = -1;
                }
                
                const x = p * chunkSize + dx;
                const z = q * chunkSize + dz;
                
                const f = VoxelNoise.simplex2(
                    x * VoxelConfig.TERRAIN_NOISE_SCALE, 
                    z * VoxelConfig.TERRAIN_NOISE_SCALE, 
                    4, 0.5, 2
                );
                const g = VoxelNoise.simplex2(
                    -x * VoxelConfig.TERRAIN_NOISE_SCALE, 
                    -z * VoxelConfig.TERRAIN_NOISE_SCALE, 
                    2, 0.9, 2
                );
                
                const mh = g * VoxelConfig.TERRAIN_HEIGHT_SCALE + VoxelConfig.TERRAIN_HEIGHT_OFFSET;
                let h = Math.floor(f * mh);
                let blockType = VoxelBlockType.GRASS;
                const seaLevel = VoxelConfig.SEA_LEVEL;
                
                if (h <= seaLevel) {
                    h = seaLevel;
                    blockType = VoxelBlockType.SAND;
                }
                
                for (let y = 0; y < h; y++) {
                    func(x, y, z, blockType * flag, arg);
                }
                
                if (blockType === VoxelBlockType.GRASS && VoxelConfig.SHOW_PLANTS) {
                    this.generatePlants(x, h, z, flag, func, arg);
                }
                
                if (VoxelConfig.SHOW_TREES) {
                    this.generateTrees(x, h, z, dx, dz, chunkSize, blockType, func, arg);
                }
            }
        }
        
        if (VoxelConfig.SHOW_CLOUDS) {
            this.generateClouds(p, q, func, arg);
        }
    }

    static createFlatWorld(p: number, q: number, func: VoxelWorldFunc, arg?: any): void {
        const chunkSize = VoxelConfig.CHUNK_SIZE;
        const pad = 1;
        
        const worldMode = VoxelWorldConfig.getMode();
        
        if (worldMode === VoxelWorldMode.SMALL_FLAT) {
            // SMALL_FLAT模式：只生成1层完全平坦的草方块
            const flatHeight = 0; // 只在y=0层生成
            
            for (let dx = -pad; dx < chunkSize + pad; dx++) {
                for (let dz = -pad; dz < chunkSize + pad; dz++) {
                    let flag = 1;
                    if (dx < 0 || dz < 0 || dx >= chunkSize || dz >= chunkSize) {
                        flag = -1;
                    }
                    
                    const x = p * chunkSize + dx;
                    const z = q * chunkSize + dz;
                    
                    // 只生成1层草方块
                    func(x, flatHeight, z, VoxelBlockType.GRASS * flag, arg);
                    
                    // 可选：在某些位置生成花朵作为装饰
                    if (VoxelConfig.SHOW_PLANTS && flag > 0) {
                        const flowerChance = VoxelNoise.simplex2(x * 0.1, z * 0.1, 4, 0.8, 2);
                        if (flowerChance > 0.8) { // 降低花朵密度
                            const flowerType = VoxelBlockType.YELLOW_FLOWER + Math.floor(Math.abs(flowerChance) * 3) % 3;
                            func(x, flatHeight + 1, z, flowerType * flag, arg);
                        }
                    }
                }
            }
        } else {
            // TINY_DEBUG模式：保留原来的多层逻辑
            const flatHeight = Math.max(3, VoxelConfig.SEA_LEVEL - 1);
            const grassHeight = flatHeight + 1;
            
            for (let dx = -pad; dx < chunkSize + pad; dx++) {
                for (let dz = -pad; dz < chunkSize + pad; dz++) {
                    let flag = 1;
                    if (dx < 0 || dz < 0 || dx >= chunkSize || dz >= chunkSize) {
                        flag = -1;
                    }
                    
                    const x = p * chunkSize + dx;
                    const z = q * chunkSize + dz;
                    
                    for (let y = 0; y < flatHeight; y++) {
                        func(x, y, z, VoxelBlockType.STONE * flag, arg);
                    }
                    
                    func(x, flatHeight, z, VoxelBlockType.GRASS * flag, arg);
                    
                    if (VoxelConfig.SHOW_PLANTS && flag > 0) {
                        const flowerChance = VoxelNoise.simplex2(x * 0.1, z * 0.1, 4, 0.8, 2);
                        if (flowerChance > 0.7) {
                            const flowerType = VoxelBlockType.YELLOW_FLOWER + Math.floor(Math.abs(flowerChance) * 3) % 3;
                            func(x, grassHeight, z, flowerType * flag, arg);
                        }
                    }
                }
            }
        }
    }

    private static generatePlants(x: number, h: number, z: number, flag: number, func: VoxelWorldFunc, arg?: any): void {
        const grassNoise = VoxelNoise.simplex2(
            -x * VoxelConfig.PLANT_NOISE_SCALE, 
            z * VoxelConfig.PLANT_NOISE_SCALE, 
            4, 0.8, 2
        );
        
        if (grassNoise > VoxelConfig.PLANT_THRESHOLD) {
            func(x, h, z, VoxelBlockType.TALL_GRASS * flag, arg);
        }
        
        const flowerNoise = VoxelNoise.simplex2(
            x * VoxelConfig.FLOWER_NOISE_SCALE, 
            -z * VoxelConfig.FLOWER_NOISE_SCALE, 
            4, 0.8, 2
        );
        
        if (flowerNoise > VoxelConfig.FLOWER_THRESHOLD) {
            const flowerTypeNoise = VoxelNoise.simplex2(x * 0.1, z * 0.1, 4, 0.8, 2);
            const flowerType = VoxelBlockType.YELLOW_FLOWER + Math.floor(flowerTypeNoise * 6);
            func(x, h, z, flowerType * flag, arg);
        }
    }

    private static generateTrees(
        x: number, 
        h: number, 
        z: number, 
        dx: number, 
        dz: number, 
        chunkSize: number, 
        blockType: VoxelBlockType,
        func: VoxelWorldFunc, 
        arg?: any
    ): void {
        const treeMargin = 4;
        
        let canPlaceTree = true;
        if (dx - treeMargin < 0 || dz - treeMargin < 0 ||
            dx + treeMargin >= chunkSize || dz + treeMargin >= chunkSize) {
            canPlaceTree = false;
        }
        
        if (canPlaceTree && blockType === VoxelBlockType.GRASS) {
            const treeNoise = VoxelNoise.simplex2(x, z, 6, 0.5, 2);
            
            if (treeNoise > VoxelConfig.TREE_THRESHOLD) {
                this.generateSingleTree(x, h, z, func, arg);
            }
        }
    }

    private static generateSingleTree(x: number, baseY: number, z: number, func: VoxelWorldFunc, arg?: any): void {
        const trunkHeight = VoxelConfig.TREE_TRUNK_HEIGHT;
        const leavesRadius = VoxelConfig.TREE_LEAVES_RADIUS;
        const leavesCenter = baseY + VoxelConfig.TREE_LEAVES_HEIGHT_OFFSET;
        
        for (let y = baseY + VoxelConfig.TREE_HEIGHT_MIN; y < baseY + VoxelConfig.TREE_HEIGHT_MAX + 1; y++) {
            for (let ox = -leavesRadius; ox <= leavesRadius; ox++) {
                for (let oz = -leavesRadius; oz <= leavesRadius; oz++) {
                    const d = (ox * ox) + (oz * oz) + 
                             (y - leavesCenter) * (y - leavesCenter);
                    if (d < 11) {
                        func(x + ox, y, z + oz, VoxelBlockType.LEAVES, arg);
                    }
                }
            }
        }
        
        for (let y = baseY; y < baseY + trunkHeight; y++) {
            func(x, y, z, VoxelBlockType.WOOD, arg);
        }
    }

    private static generateClouds(p: number, q: number, func: VoxelWorldFunc, arg?: any): void {
        const chunkSize = VoxelConfig.CHUNK_SIZE;
        
        for (let dx = 0; dx < chunkSize; dx++) {
            for (let dz = 0; dz < chunkSize; dz++) {
                const x = p * chunkSize + dx;
                const z = q * chunkSize + dz;
                
                for (let y = VoxelConfig.CLOUD_HEIGHT_MIN; y < VoxelConfig.CLOUD_HEIGHT_MAX; y++) {
                    const cloudNoise = VoxelNoise.simplex3(
                        x * VoxelConfig.CLOUD_NOISE_SCALE, 
                        y * 0.1, 
                        z * VoxelConfig.CLOUD_NOISE_SCALE, 
                        8, 0.5, 2
                    );
                    
                    if (cloudNoise > VoxelConfig.CLOUD_THRESHOLD) {
                        func(x, y, z, VoxelBlockType.CLOUD, arg);
                    }
                }
            }
        }
    }

    static getHeightAt(x: number, z: number): number {
        const worldMode = VoxelWorldConfig.getMode();
        
        if (worldMode === VoxelWorldMode.SMALL_FLAT) {
            return 1; // SMALL_FLAT模式：地面高度为1（y=0是地面）
        } else if (worldMode === VoxelWorldMode.TINY_DEBUG) {
            return Math.max(3, VoxelConfig.SEA_LEVEL - 1) + 1;
        }
        
        const f = VoxelNoise.simplex2(
            x * VoxelConfig.TERRAIN_NOISE_SCALE, 
            z * VoxelConfig.TERRAIN_NOISE_SCALE, 
            4, 0.5, 2
        );
        const g = VoxelNoise.simplex2(
            -x * VoxelConfig.TERRAIN_NOISE_SCALE, 
            -z * VoxelConfig.TERRAIN_NOISE_SCALE, 
            2, 0.9, 2
        );
        
        const mh = g * VoxelConfig.TERRAIN_HEIGHT_SCALE + VoxelConfig.TERRAIN_HEIGHT_OFFSET;
        let h = Math.floor(f * mh);
        
        if (h <= VoxelConfig.SEA_LEVEL) {
            h = VoxelConfig.SEA_LEVEL;
        }
        
        return h;
    }

    static getBlockTypeAt(x: number, y: number, z: number): VoxelBlockType {
        const worldMode = VoxelWorldConfig.getMode();
        
        if (worldMode === VoxelWorldMode.SMALL_FLAT) {
            // SMALL_FLAT模式：只有y=0层是草方块
            if (y === 0) {
                return VoxelBlockType.GRASS;
            } else if (y === 1 && VoxelConfig.SHOW_PLANTS) {
                const flowerChance = VoxelNoise.simplex2(x * 0.1, z * 0.1, 4, 0.8, 2);
                if (flowerChance > 0.8) { // 降低花朵密度
                    const flowerType = VoxelBlockType.YELLOW_FLOWER + Math.floor(Math.abs(flowerChance) * 3) % 3;
                    return flowerType;
                }
            }
            
            return VoxelBlockType.EMPTY;
        } else if (worldMode === VoxelWorldMode.TINY_DEBUG) {
            const flatHeight = Math.max(3, VoxelConfig.SEA_LEVEL - 1);
            const grassHeight = flatHeight + 1;
            
            if (y < flatHeight) {
                return VoxelBlockType.STONE;
            } else if (y === flatHeight) {
                return VoxelBlockType.GRASS;
            } else if (y === grassHeight && VoxelConfig.SHOW_PLANTS) {
                const flowerChance = VoxelNoise.simplex2(x * 0.1, z * 0.1, 4, 0.8, 2);
                if (flowerChance > 0.7) {
                    const flowerType = VoxelBlockType.YELLOW_FLOWER + Math.floor(Math.abs(flowerChance) * 3) % 3;
                    return flowerType;
                }
            }
            
            return VoxelBlockType.EMPTY;
        }
        
        const height = this.getHeightAt(x, z);
        
        if (y < height) {
            if (height <= VoxelConfig.SEA_LEVEL) {
                return VoxelBlockType.SAND;
            } else {
                return VoxelBlockType.GRASS;
            }
        }
        
        if (y === height && height > VoxelConfig.SEA_LEVEL && VoxelConfig.SHOW_PLANTS) {
            const grassNoise = VoxelNoise.simplex2(
                -x * VoxelConfig.PLANT_NOISE_SCALE, 
                z * VoxelConfig.PLANT_NOISE_SCALE, 
                4, 0.8, 2
            );
            
            if (grassNoise > VoxelConfig.PLANT_THRESHOLD) {
                return VoxelBlockType.TALL_GRASS;
            }
            
            const flowerNoise = VoxelNoise.simplex2(
                x * VoxelConfig.FLOWER_NOISE_SCALE, 
                -z * VoxelConfig.FLOWER_NOISE_SCALE, 
                4, 0.8, 2
            );
            
            if (flowerNoise > VoxelConfig.FLOWER_THRESHOLD) {
                const flowerTypeNoise = VoxelNoise.simplex2(x * 0.1, z * 0.1, 4, 0.8, 2);
                return VoxelBlockType.YELLOW_FLOWER + Math.floor(flowerTypeNoise * 6);
            }
        }
        
        if (VoxelConfig.SHOW_CLOUDS && 
            y >= VoxelConfig.CLOUD_HEIGHT_MIN && 
            y < VoxelConfig.CLOUD_HEIGHT_MAX) {
            const cloudNoise = VoxelNoise.simplex3(
                x * VoxelConfig.CLOUD_NOISE_SCALE, 
                y * 0.1, 
                z * VoxelConfig.CLOUD_NOISE_SCALE, 
                8, 0.5, 2
            );
            
            if (cloudNoise > VoxelConfig.CLOUD_THRESHOLD) {
                return VoxelBlockType.CLOUD;
            }
        }
        
        return VoxelBlockType.EMPTY;
    }

    static getBiomeAt(x: number, z: number): string {
        const height = this.getHeightAt(x, z);
        
        if (height <= VoxelConfig.SEA_LEVEL) {
            return "ocean";
        } else if (height < VoxelConfig.SEA_LEVEL + 10) {
            return "beach";
        } else if (height < VoxelConfig.SEA_LEVEL + 30) {
            return "plains";
        } else {
            return "hills";
        }
    }

    static isValidSpawnLocation(x: number, z: number): boolean {
        const height = this.getHeightAt(x, z);
        return height > VoxelConfig.SEA_LEVEL && height < VoxelConfig.SEA_LEVEL + 20;
    }
}