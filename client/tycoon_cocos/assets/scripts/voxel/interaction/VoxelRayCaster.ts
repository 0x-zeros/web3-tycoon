import { Vec3 } from "cc";
import { VoxelBlockType } from "../core/VoxelBlock";

export interface VoxelHitResult {
    hit: boolean;
    position?: Vec3;
    worldPosition?: Vec3;
    blockType?: VoxelBlockType;
    face?: number;
    normal?: Vec3;
}

export interface VoxelRayData {
    voxelMap: Map<string, VoxelBlockType>;
    getBlockAt?: (x: number, y: number, z: number) => VoxelBlockType;
}

export class VoxelRayCaster {
    
    // 算法切换开关: true=DDA算法(推荐), false=简单步进算法
    private static USE_DDA_ALGORITHM = true;
    // private static USE_DDA_ALGORITHM = false;
    
    raycast(
        origin: Vec3, 
        direction: Vec3, 
        maxDistance: number,
        voxelData: VoxelRayData
    ): VoxelHitResult {
        // 通过静态变量切换算法
        if (VoxelRayCaster.USE_DDA_ALGORITHM) {
            return this.raycastDDA(origin, direction, maxDistance, voxelData);
        } else {
            return this.raycastSimple(origin, direction, maxDistance, voxelData);
        }
    }

    // 方法1: 简单步进算法（原版的改进版本）
    private raycastSimple(
        origin: Vec3, 
        direction: Vec3, 
        maxDistance: number,
        voxelData: VoxelRayData
    ): VoxelHitResult {
        const normalizedDir = direction.clone().normalize();
        // 增加步数以确保能到达地面
        const steps = Math.floor(maxDistance * 32);
        const stepSize = maxDistance / steps;
        
        console.log(`[VoxelRayCaster-简单] 开始射线投射: ${steps}步, 步长=${stepSize.toFixed(4)}`);
        
        let checkedBlocks = 0;
        let lastBlockPos = new Vec3(-999, -999, -999);
        
        for (let i = 0; i < steps; i++) {
            const currentPos = origin.clone().add(normalizedDir.clone().multiplyScalar(i * stepSize));
            const blockPos = this.worldToBlockPosition(currentPos);
            
            // 避免重复检查同一个方块
            if (!blockPos.equals(lastBlockPos)) {
                checkedBlocks++;
                lastBlockPos = blockPos.clone();
                
                let blockType: VoxelBlockType;
                
                if (voxelData.getBlockAt) {
                    blockType = voxelData.getBlockAt(blockPos.x, blockPos.y, blockPos.z);
                } else {
                    blockType = this.getBlockFromMap(blockPos, voxelData.voxelMap);
                }
                
                // 只显示前5个检查的方块或非空方块
                if (checkedBlocks <= 5 || blockType !== VoxelBlockType.EMPTY) {
                    console.log(`[VoxelRayCaster-简单] 检查方块(${blockPos.x}, ${blockPos.y}, ${blockPos.z}) = ${blockType}`);
                }
                
                if (blockType !== VoxelBlockType.EMPTY) {
                    const face = this.calculateHitFace(currentPos, blockPos);
                    const normal = this.getFaceNormal(face);
                    const worldPos = this.blockToWorldPosition(blockPos);
                    
                    console.log(`[VoxelRayCaster-简单] ✓ 击中方块! 位置:(${blockPos.x}, ${blockPos.y}, ${blockPos.z}), 面:${face}, 类型:${blockType}`);
                    
                    return {
                        hit: true,
                        position: blockPos,
                        worldPosition: worldPos,
                        blockType: blockType,
                        face: face,
                        normal: normal
                    };
                }
            }
        }
        
        console.log(`[VoxelRayCaster-简单] ✗ 射线投射完成: 检查了${checkedBlocks}个方块，未击中任何目标`);
        return { hit: false };
    }

    // 方法2: DDA算法（Digital Differential Analyzer）
    private raycastDDA(
        origin: Vec3, 
        direction: Vec3, 
        maxDistance: number,
        voxelData: VoxelRayData
    ): VoxelHitResult {
        const normalizedDir = direction.clone().normalize();
        
        // 当前方块坐标
        let mapX = Math.floor(origin.x);
        let mapY = Math.floor(origin.y);
        let mapZ = Math.floor(origin.z);
        
        // 计算每个轴的步长
        const deltaDistX = Math.abs(1 / normalizedDir.x);
        const deltaDistY = Math.abs(1 / normalizedDir.y);
        const deltaDistZ = Math.abs(1 / normalizedDir.z);
        
        // 计算步进方向和到下一个方块边界的距离
        let stepX: number, sideDistX: number;
        let stepY: number, sideDistY: number;
        let stepZ: number, sideDistZ: number;
        
        if (normalizedDir.x < 0) {
            stepX = -1;
            sideDistX = (origin.x - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - origin.x) * deltaDistX;
        }
        
        if (normalizedDir.y < 0) {
            stepY = -1;
            sideDistY = (origin.y - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - origin.y) * deltaDistY;
        }
        
        if (normalizedDir.z < 0) {
            stepZ = -1;
            sideDistZ = (origin.z - mapZ) * deltaDistZ;
        } else {
            stepZ = 1;
            sideDistZ = (mapZ + 1.0 - origin.z) * deltaDistZ;
        }
        
        console.log(`[VoxelRayCaster-DDA] 开始DDA射线投射: 起点(${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)})`);
        console.log(`[VoxelRayCaster-DDA] 方向(${normalizedDir.x.toFixed(2)}, ${normalizedDir.y.toFixed(2)}, ${normalizedDir.z.toFixed(2)})`);
        
        // DDA主循环
        let hit = false;
        let side = 0; // 记录击中的面（0=X面, 1=Y面, 2=Z面）
        let distance = 0;
        let checkedBlocks = 0;
        
        while (!hit && distance < maxDistance) {
            // 选择最近的边界
            if (sideDistX < sideDistY && sideDistX < sideDistZ) {
                // X边界最近
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
                distance = sideDistX;
            } else if (sideDistY < sideDistZ) {
                // Y边界最近
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
                distance = sideDistY;
            } else {
                // Z边界最近
                sideDistZ += deltaDistZ;
                mapZ += stepZ;
                side = 2;
                distance = sideDistZ;
            }
            
            // 检查当前方块
            checkedBlocks++;
            let blockType: VoxelBlockType;
            
            if (voxelData.getBlockAt) {
                blockType = voxelData.getBlockAt(mapX, mapY, mapZ);
            } else {
                const blockPos = new Vec3(mapX, mapY, mapZ);
                blockType = this.getBlockFromMap(blockPos, voxelData.voxelMap);
            }
            
            // 只显示前5个检查的方块或非空方块
            if (checkedBlocks <= 5 || blockType !== VoxelBlockType.EMPTY) {
                console.log(`[VoxelRayCaster-DDA] 检查方块(${mapX}, ${mapY}, ${mapZ}) = ${blockType}, 距离=${distance.toFixed(2)}`);
            }
            
            if (blockType !== VoxelBlockType.EMPTY) {
                hit = true;
                
                // 计算击中点
                const hitDistance = distance - (side === 0 ? deltaDistX : side === 1 ? deltaDistY : deltaDistZ) / 2;
                const hitPos = origin.clone().add(normalizedDir.clone().multiplyScalar(hitDistance));
                
                const blockPos = new Vec3(mapX, mapY, mapZ);
                const face = this.calculateHitFace(hitPos, blockPos);
                const normal = this.getFaceNormal(face);
                const worldPos = this.blockToWorldPosition(blockPos);
                
                console.log(`[VoxelRayCaster-DDA] ✓ 击中方块! 位置:(${mapX}, ${mapY}, ${mapZ}), 面:${face}, 类型:${blockType}, 距离:${hitDistance.toFixed(2)}`);
                
                return {
                    hit: true,
                    position: blockPos,
                    worldPosition: worldPos,
                    blockType: blockType,
                    face: face,
                    normal: normal
                };
            }
        }
        
        console.log(`[VoxelRayCaster-DDA] ✗ DDA射线投射完成: 检查了${checkedBlocks}个方块，未击中任何目标，最大距离:${distance.toFixed(2)}`);
        return { hit: false };
    }

    private worldToBlockPosition(worldPos: Vec3): Vec3 {
        return new Vec3(
            Math.floor(worldPos.x),
            Math.floor(worldPos.y),
            Math.floor(worldPos.z)
        );
    }

    private blockToWorldPosition(blockPos: Vec3): Vec3 {
        return new Vec3(
            blockPos.x + 0.5,
            blockPos.y + 0.5,
            blockPos.z + 0.5
        );
    }

    private getBlockFromMap(blockPos: Vec3, voxelMap: Map<string, VoxelBlockType>): VoxelBlockType {
        const key = this.getBlockKey(blockPos.x, blockPos.y, blockPos.z);
        return voxelMap.get(key) || VoxelBlockType.EMPTY;
    }

    private getBlockKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }

    private calculateHitFace(hitPos: Vec3, blockPos: Vec3): number {
        const localPos = hitPos.clone().subtract(blockPos);
        
        const absX = Math.abs(localPos.x - 0.5);
        const absY = Math.abs(localPos.y - 0.5);
        const absZ = Math.abs(localPos.z - 0.5);
        
        if (absY > absX && absY > absZ) {
            return localPos.y > 0.5 ? 0 : 1; // top : bottom
        } else if (absZ > absX) {
            return localPos.z > 0.5 ? 2 : 3; // front : back
        } else {
            return localPos.x > 0.5 ? 4 : 5; // right : left
        }
    }

    private getFaceNormal(face: number): Vec3 {
        const normals = [
            new Vec3(0, 1, 0),   // top
            new Vec3(0, -1, 0),  // bottom
            new Vec3(0, 0, 1),   // front
            new Vec3(0, 0, -1),  // back
            new Vec3(1, 0, 0),   // right
            new Vec3(-1, 0, 0)   // left
        ];
        return normals[face] || new Vec3(0, 1, 0);
    }

    raycastBlocks(
        origin: Vec3,
        direction: Vec3,
        maxDistance: number,
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType
    ): VoxelHitResult {
        return this.raycast(origin, direction, maxDistance, { 
            voxelMap: new Map(), 
            getBlockAt 
        });
    }
}