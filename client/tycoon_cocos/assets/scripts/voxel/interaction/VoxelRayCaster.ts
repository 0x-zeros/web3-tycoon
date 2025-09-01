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

// 射线投射算法类型
export enum RaycastAlgorithm {
    SIMPLE = 0,           // 简单步进算法（原始方法，增加了步数）
    DDA = 1,              // DDA算法（修复版本）
    AMANATIDES_WOO = 2    // Amanatides-Woo算法（1987年论文标准实现）
}

export class VoxelRayCaster {
    
    // 算法切换：可通过静态方法修改，默认保持用户当前设置
    private static currentAlgorithm: RaycastAlgorithm = RaycastAlgorithm.SIMPLE;
    
    // 静态方法用于切换算法
    public static setAlgorithm(algorithm: RaycastAlgorithm): void {
        VoxelRayCaster.currentAlgorithm = algorithm;
        console.log(`[VoxelRayCaster] 切换到算法: ${RaycastAlgorithm[algorithm]}`);
    }
    
    public static getAlgorithm(): RaycastAlgorithm {
        return VoxelRayCaster.currentAlgorithm;
    }
    
    raycast(
        origin: Vec3, 
        direction: Vec3, 
        maxDistance: number,
        voxelData: VoxelRayData
    ): VoxelHitResult {
        // 根据当前算法设置调用对应方法
        switch (VoxelRayCaster.currentAlgorithm) {
            case RaycastAlgorithm.SIMPLE:
                return this.raycastSimple(origin, direction, maxDistance, voxelData);
            case RaycastAlgorithm.DDA:
                return this.raycastDDA(origin, direction, maxDistance, voxelData);
            case RaycastAlgorithm.AMANATIDES_WOO:
                return this.raycastAmanatidesWoo(origin, direction, maxDistance, voxelData);
            default:
                console.warn(`[VoxelRayCaster] 未知算法类型: ${VoxelRayCaster.currentAlgorithm}，使用简单算法`);
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
                // X边界最近 - 先记录击中距离，再更新到下一个边界
                distance = sideDistX;  // 击中当前边界的距离
                sideDistX += deltaDistX; // 更新到下一个边界
                mapX += stepX;      // 进入新方块
                side = 0;
            } else if (sideDistY < sideDistZ) {
                // Y边界最近
                distance = sideDistY;
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            } else {
                // Z边界最近
                distance = sideDistZ;
                sideDistZ += deltaDistZ;
                mapZ += stepZ;
                side = 2;
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
                
                // 计算击中点 - distance已经是正确的击中边界距离
                const hitDistance = distance;
                const hitPos = origin.clone().add(normalizedDir.clone().multiplyScalar(hitDistance));
                
                const blockPos = new Vec3(mapX, mapY, mapZ);
                // 根据DDA的side值直接确定击中面，更精确
                const face = this.calculateHitFaceFromSide(side, stepX, stepY, stepZ);
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

    // 方法3: Amanatides-Woo算法（1987年论文标准实现）
    private raycastAmanatidesWoo(
        origin: Vec3,
        direction: Vec3,
        maxDistance: number,
        voxelData: VoxelRayData
    ): VoxelHitResult {
        const normalizedDir = direction.clone().normalize();
        
        console.log(`[VoxelRayCaster-AW] 开始Amanatides-Woo射线投射: 起点(${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)})`);
        console.log(`[VoxelRayCaster-AW] 方向(${normalizedDir.x.toFixed(2)}, ${normalizedDir.y.toFixed(2)}, ${normalizedDir.z.toFixed(2)})`);
        
        // 当前体素坐标
        let X = Math.floor(origin.x);
        let Y = Math.floor(origin.y);
        let Z = Math.floor(origin.z);
        
        // 步进方向（+1 或 -1）
        const stepX = normalizedDir.x >= 0 ? 1 : -1;
        const stepY = normalizedDir.y >= 0 ? 1 : -1;
        const stepZ = normalizedDir.z >= 0 ? 1 : -1;
        
        // 计算tMax：到达下一个X、Y、Z边界的参数化距离
        let tMaxX, tMaxY, tMaxZ;
        let tDeltaX, tDeltaY, tDeltaZ;
        
        // X轴
        if (normalizedDir.x === 0) {
            tMaxX = Number.POSITIVE_INFINITY;
            tDeltaX = Number.POSITIVE_INFINITY;
        } else {
            if (stepX > 0) {
                tMaxX = (X + 1 - origin.x) / normalizedDir.x;
            } else {
                tMaxX = (origin.x - X) / normalizedDir.x;
            }
            tDeltaX = Math.abs(1.0 / normalizedDir.x);
        }
        
        // Y轴
        if (normalizedDir.y === 0) {
            tMaxY = Number.POSITIVE_INFINITY;
            tDeltaY = Number.POSITIVE_INFINITY;
        } else {
            if (stepY > 0) {
                tMaxY = (Y + 1 - origin.y) / normalizedDir.y;
            } else {
                tMaxY = (origin.y - Y) / normalizedDir.y;
            }
            tDeltaY = Math.abs(1.0 / normalizedDir.y);
        }
        
        // Z轴
        if (normalizedDir.z === 0) {
            tMaxZ = Number.POSITIVE_INFINITY;
            tDeltaZ = Number.POSITIVE_INFINITY;
        } else {
            if (stepZ > 0) {
                tMaxZ = (Z + 1 - origin.z) / normalizedDir.z;
            } else {
                tMaxZ = (origin.z - Z) / normalizedDir.z;
            }
            tDeltaZ = Math.abs(1.0 / normalizedDir.z);
        }
        
        // 主遍历循环
        let checkedBlocks = 0;
        let currentT = 0;
        let hitNormal = new Vec3(0, 1, 0);
        
        while (currentT < maxDistance) {
            // 检查当前体素
            checkedBlocks++;
            let blockType: VoxelBlockType;
            
            if (voxelData.getBlockAt) {
                blockType = voxelData.getBlockAt(X, Y, Z);
            } else {
                const blockPos = new Vec3(X, Y, Z);
                blockType = this.getBlockFromMap(blockPos, voxelData.voxelMap);
            }
            
            // 只显示前5个检查的方块或非空方块
            if (checkedBlocks <= 5 || blockType !== VoxelBlockType.EMPTY) {
                console.log(`[VoxelRayCaster-AW] 检查方块(${X}, ${Y}, ${Z}) = ${blockType}, t=${currentT.toFixed(3)}`);
            }
            
            if (blockType !== VoxelBlockType.EMPTY) {
                // 击中！
                const hitPos = origin.clone().add(normalizedDir.clone().multiplyScalar(currentT));
                const blockPos = new Vec3(X, Y, Z);
                
                // 根据进入的面确定法向量和面ID
                let face: number;
                if (tMaxX - tDeltaX <= tMaxY - tDeltaY && tMaxX - tDeltaX <= tMaxZ - tDeltaZ) {
                    // 从X面进入
                    hitNormal = new Vec3(-stepX, 0, 0);
                    face = stepX > 0 ? 5 : 4; // 射线向右击中左面(5) : 射线向左击中右面(4)
                } else if (tMaxY - tDeltaY <= tMaxZ - tDeltaZ) {
                    // 从Y面进入
                    hitNormal = new Vec3(0, -stepY, 0);
                    face = stepY > 0 ? 1 : 0; // 射线向上击中底面(1) : 射线向下击中顶面(0)
                } else {
                    // 从Z面进入
                    hitNormal = new Vec3(0, 0, -stepZ);
                    face = stepZ > 0 ? 3 : 2; // 射线向前击中后面(3) : 射线向后击中前面(2)
                }
                
                const worldPos = this.blockToWorldPosition(blockPos);
                
                console.log(`[VoxelRayCaster-AW] ✓ 击中方块! 位置:(${X}, ${Y}, ${Z}), 面:${face}, 类型:${blockType}, t:${currentT.toFixed(3)}`);
                
                return {
                    hit: true,
                    position: blockPos,
                    worldPosition: worldPos,
                    blockType: blockType,
                    face: face,
                    normal: hitNormal
                };
            }
            
            // 移动到下一个体素
            if (tMaxX < tMaxY && tMaxX < tMaxZ) {
                // X方向的边界最近
                currentT = tMaxX;
                tMaxX += tDeltaX;
                X += stepX;
            } else if (tMaxY < tMaxZ) {
                // Y方向的边界最近
                currentT = tMaxY;
                tMaxY += tDeltaY;
                Y += stepY;
            } else {
                // Z方向的边界最近
                currentT = tMaxZ;
                tMaxZ += tDeltaZ;
                Z += stepZ;
            }
        }
        
        console.log(`[VoxelRayCaster-AW] ✗ Amanatides-Woo射线投射完成: 检查了${checkedBlocks}个方块，未击中任何目标，最大t:${currentT.toFixed(3)}`);
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

    // 根据DDA的side和步进方向直接确定击中面（更精确）
    private calculateHitFaceFromSide(side: number, stepX: number, stepY: number, stepZ: number): number {
        if (side === 0) {
            // X轴边界
            return stepX > 0 ? 5 : 4; // 射线向右击中左面(5) : 射线向左击中右面(4)
        } else if (side === 1) {
            // Y轴边界  
            return stepY > 0 ? 1 : 0; // 射线向上击中底面(1) : 射线向下击中顶面(0)
        } else {
            // Z轴边界
            return stepZ > 0 ? 3 : 2; // 射线向前击中后面(3) : 射线向后击中前面(2)
        }
    }

    // 保留原有的面判断方法作为备用（用于简单步进算法）
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
    
    // 便捷方法：设置和获取算法
    public static setSimpleAlgorithm(): void {
        this.setAlgorithm(RaycastAlgorithm.SIMPLE);
    }
    
    public static setDDAAlgorithm(): void {
        this.setAlgorithm(RaycastAlgorithm.DDA);
    }
    
    public static setAmanatidesWooAlgorithm(): void {
        this.setAlgorithm(RaycastAlgorithm.AMANATIDES_WOO);
    }
    
    public static getCurrentAlgorithmName(): string {
        return RaycastAlgorithm[this.currentAlgorithm];
    }
}