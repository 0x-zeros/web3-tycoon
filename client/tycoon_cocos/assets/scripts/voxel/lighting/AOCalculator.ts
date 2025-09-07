import { Vec3 } from 'cc';
import { BlockRegistry } from '../core/VoxelBlock';

/**
 * 环境光遮蔽 (AO) 计算器
 * 基于 Minecraft 风格的 AO 算法
 */
export class AOCalculator {
    
    /**
     * 计算面顶点的环境光遮蔽值
     * @param facePositions 面的四个顶点位置（世界坐标）
     * @param faceNormal 面的法线向量
     * @param getBlockAt 获取方块函数
     * @returns 四个顶点的AO值数组 (0-1，0为完全遮蔽)
     */
    static calculateFaceAO(
        facePositions: Vec3[],
        faceNormal: Vec3,
        getBlockAt: (x: number, y: number, z: number) => string
    ): number[] {
        
        const aoValues: number[] = [];
        
        // 为每个顶点计算AO
        for (let i = 0; i < 4; i++) {
            const vertexPos = facePositions[i];
            const ao = this.calculateVertexAO(vertexPos, faceNormal, getBlockAt);
            aoValues.push(ao);
        }
        
        return aoValues;
    }

    /**
     * 计算单个顶点的环境光遮蔽
     * @param vertexPos 顶点世界坐标
     * @param faceNormal 面法线
     * @param getBlockAt 获取方块函数
     * @returns AO值 (0-1)
     */
    private static calculateVertexAO(
        vertexPos: Vec3,
        faceNormal: Vec3,
        getBlockAt: (x: number, y: number, z: number) => string
    ): number {
        
        // 获取影响这个顶点的相邻方块位置
        const adjacentPositions = this.getAdjacentPositions(vertexPos, faceNormal);
        
        let occludedCount = 0;
        const totalPositions = adjacentPositions.length;
        
        // 检查每个相邻位置是否被遮挡
        for (const pos of adjacentPositions) {
            const blockX = Math.floor(pos.x);
            const blockY = Math.floor(pos.y);
            const blockZ = Math.floor(pos.z);
            
            const blockId = getBlockAt(blockX, blockY, blockZ);
            
            // 检查方块是否不透明（遮挡光线）
            if (blockId && blockId !== 'minecraft:air' && !BlockRegistry.isTransparent(blockId)) {
                occludedCount++;
            }
        }
        
        // 计算AO值：遮挡越多，AO越暗
        const occlusionRatio = occludedCount / totalPositions;
        const aoValue = 1.0 - (occlusionRatio * 0.7); // 最多降低70%的亮度
        
        return Math.max(0.3, aoValue); // 确保最低亮度为30%
    }

    /**
     * 获取影响顶点的相邻方块位置
     * @param vertexPos 顶点位置
     * @param faceNormal 面法线
     * @returns 相邻位置数组
     */
    private static getAdjacentPositions(vertexPos: Vec3, faceNormal: Vec3): Vec3[] {
        const positions: Vec3[] = [];
        
        // 根据面的方向确定需要检查的相邻方块
        const normal = faceNormal.clone().normalize();
        
        // 获取垂直于法线的两个方向向量
        const tangent1 = this.getTangentVector(normal);
        const tangent2 = Vec3.cross(new Vec3(), normal, tangent1).normalize();
        
        const checkDistance = 0.6; // 检查距离
        
        // 检查8个方向的相邻方块
        const directions = [
            // 主要方向
            tangent1.clone().multiplyScalar(checkDistance),
            tangent1.clone().multiplyScalar(-checkDistance),
            tangent2.clone().multiplyScalar(checkDistance),
            tangent2.clone().multiplyScalar(-checkDistance),
            
            // 对角方向
            Vec3.add(new Vec3(), tangent1, tangent2).normalize().multiplyScalar(checkDistance),
            Vec3.add(new Vec3(), tangent1, tangent2.clone().multiplyScalar(-1)).normalize().multiplyScalar(checkDistance),
            Vec3.add(new Vec3(), tangent1.clone().multiplyScalar(-1), tangent2).normalize().multiplyScalar(checkDistance),
            Vec3.add(new Vec3(), tangent1.clone().multiplyScalar(-1), tangent2.clone().multiplyScalar(-1)).normalize().multiplyScalar(checkDistance)
        ];
        
        // 添加所有检查位置
        for (const dir of directions) {
            const checkPos = Vec3.add(new Vec3(), vertexPos, dir);
            positions.push(checkPos);
        }
        
        return positions;
    }

    /**
     * 获取垂直于法线的切线向量
     * @param normal 法线向量
     * @returns 切线向量
     */
    private static getTangentVector(normal: Vec3): Vec3 {
        // 选择一个不平行于法线的向量来构造切线
        let tangent: Vec3;
        
        if (Math.abs(normal.x) > Math.abs(normal.y)) {
            // 使用Y轴作为参考
            tangent = new Vec3(-normal.z, 0, normal.x);
        } else {
            // 使用X轴作为参考
            tangent = new Vec3(0, -normal.z, normal.y);
        }
        
        return tangent.normalize();
    }

    /**
     * 简化的AO计算（用于性能要求高的场景）
     * @param centerPos 中心位置
     * @param normal 法线
     * @param getBlockAt 获取方块函数
     * @returns AO值 (0-1)
     */
    static calculateSimpleAO(
        centerPos: Vec3,
        normal: Vec3,
        getBlockAt: (x: number, y: number, z: number) => string
    ): number {
        
        // 只检查6个主要方向
        const directions = [
            new Vec3(1, 0, 0), new Vec3(-1, 0, 0),   // X轴
            new Vec3(0, 1, 0), new Vec3(0, -1, 0),   // Y轴
            new Vec3(0, 0, 1), new Vec3(0, 0, -1)    // Z轴
        ];
        
        let occludedCount = 0;
        
        for (const dir of directions) {
            const checkPos = Vec3.add(new Vec3(), centerPos, dir);
            const blockX = Math.floor(checkPos.x);
            const blockY = Math.floor(checkPos.y);
            const blockZ = Math.floor(checkPos.z);
            
            const blockId = getBlockAt(blockX, blockY, blockZ);
            if (blockId && blockId !== 'minecraft:air' && !BlockRegistry.isTransparent(blockId)) {
                occludedCount++;
            }
        }
        
        const occlusionRatio = occludedCount / directions.length;
        return Math.max(0.4, 1.0 - occlusionRatio * 0.6);
    }

    /**
     * 批量计算多个面的AO
     * @param faces 面数据数组
     * @param getBlockAt 获取方块函数
     * @returns 每个面的AO值数组
     */
    static calculateBatchAO(
        faces: Array<{ positions: Vec3[], normal: Vec3 }>,
        getBlockAt: (x: number, y: number, z: number) => string
    ): number[][] {
        
        const results: number[][] = [];
        
        for (const face of faces) {
            const aoValues = this.calculateFaceAO(face.positions, face.normal, getBlockAt);
            results.push(aoValues);
        }
        
        return results;
    }

    /**
     * 获取AO调试信息
     * @param vertexPos 顶点位置
     * @param faceNormal 面法线
     * @param getBlockAt 获取方块函数
     * @returns 调试信息
     */
    static getAODebugInfo(
        vertexPos: Vec3,
        faceNormal: Vec3,
        getBlockAt: (x: number, y: number, z: number) => string
    ): {
        vertexPos: Vec3,
        aoValue: number,
        occludingBlocks: Array<{pos: Vec3, blockId: string}>,
        totalChecked: number
    } {
        
        const adjacentPositions = this.getAdjacentPositions(vertexPos, faceNormal);
        const occludingBlocks: Array<{pos: Vec3, blockId: string}> = [];
        
        for (const pos of adjacentPositions) {
            const blockX = Math.floor(pos.x);
            const blockY = Math.floor(pos.y);
            const blockZ = Math.floor(pos.z);
            
            const blockId = getBlockAt(blockX, blockY, blockZ);
            if (blockId && blockId !== 'minecraft:air' && !BlockRegistry.isTransparent(blockId)) {
                occludingBlocks.push({ pos: pos.clone(), blockId });
            }
        }
        
        const aoValue = this.calculateVertexAO(vertexPos, faceNormal, getBlockAt);
        
        return {
            vertexPos: vertexPos.clone(),
            aoValue,
            occludingBlocks,
            totalChecked: adjacentPositions.length
        };
    }
}