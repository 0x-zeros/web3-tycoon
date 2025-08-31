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
    
    raycast(
        origin: Vec3, 
        direction: Vec3, 
        maxDistance: number,
        voxelData: VoxelRayData
    ): VoxelHitResult {
        const normalizedDir = direction.clone().normalize();
        const steps = Math.floor(maxDistance * 32);
        const stepSize = maxDistance / steps;
        
        for (let i = 0; i < steps; i++) {
            const currentPos = origin.clone().add(normalizedDir.clone().multiplyScalar(i * stepSize));
            const blockPos = this.worldToBlockPosition(currentPos);
            
            let blockType: VoxelBlockType;
            
            if (voxelData.getBlockAt) {
                blockType = voxelData.getBlockAt(blockPos.x, blockPos.y, blockPos.z);
            } else {
                blockType = this.getBlockFromMap(blockPos, voxelData.voxelMap);
            }
            
            if (blockType !== VoxelBlockType.EMPTY) {
                const face = this.calculateHitFace(currentPos, blockPos);
                const normal = this.getFaceNormal(face);
                const worldPos = this.blockToWorldPosition(blockPos);
                
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