import { _decorator, Component, Vec3 } from "cc";
import { VoxelBlockType } from "../core/VoxelBlock";

const { ccclass, property } = _decorator;

export interface VoxelCollisionConfig {
    playerPadding: number;
    playerHeight: number;
    playerRadius: number;
}

@ccclass('VoxelCollisionSystem')
export class VoxelCollisionSystem extends Component {

    @property
    playerPadding: number = 0.25;

    @property
    playerHeight: number = 1.8;

    @property
    playerRadius: number = 0.3;

    public checkCollision(
        playerPos: Vec3, 
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType
    ): boolean {
        const positions = this.getCollisionCheckPositions(playerPos);
        
        for (const pos of positions) {
            const blockPos = this.worldToBlockPosition(pos);
            const blockType = getBlockAt(blockPos.x, blockPos.y, blockPos.z);
            
            if (this.isBlockSolid(blockType)) {
                return true;
            }
        }
        
        return false;
    }

    public checkMovementCollision(
        currentPos: Vec3,
        targetPos: Vec3,
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType
    ): Vec3 {
        if (!this.checkCollision(targetPos, getBlockAt)) {
            return targetPos;
        }

        const movement = targetPos.clone().subtract(currentPos);
        const separateMovement = this.trySeparateAxisMovement(currentPos, movement, getBlockAt);
        
        return separateMovement || currentPos;
    }

    private getCollisionCheckPositions(playerPos: Vec3): Vec3[] {
        const positions: Vec3[] = [];
        const { playerPadding, playerHeight, playerRadius } = this;
        
        const baseY = playerPos.y - playerHeight * 0.5;
        const topY = playerPos.y + playerHeight * 0.5;
        
        const yLevels = [
            baseY,
            baseY + 0.5,
            playerPos.y,
            topY - 0.5,
            topY
        ];
        
        for (const y of yLevels) {
            positions.push(
                new Vec3(playerPos.x - playerRadius, y, playerPos.z - playerRadius),
                new Vec3(playerPos.x + playerRadius, y, playerPos.z - playerRadius),
                new Vec3(playerPos.x - playerRadius, y, playerPos.z + playerRadius),
                new Vec3(playerPos.x + playerRadius, y, playerPos.z + playerRadius),
                
                new Vec3(playerPos.x, y, playerPos.z - playerRadius),
                new Vec3(playerPos.x, y, playerPos.z + playerRadius),
                new Vec3(playerPos.x - playerRadius, y, playerPos.z),
                new Vec3(playerPos.x + playerRadius, y, playerPos.z)
            );
        }
        
        return positions;
    }

    private trySeparateAxisMovement(
        currentPos: Vec3,
        movement: Vec3,
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType
    ): Vec3 | null {
        const xMovement = new Vec3(movement.x, 0, 0);
        const yMovement = new Vec3(0, movement.y, 0);
        const zMovement = new Vec3(0, 0, movement.z);

        const movements = [xMovement, yMovement, zMovement];
        let finalPos = currentPos.clone();

        for (const mov of movements) {
            if (mov.length() > 0.001) {
                const testPos = finalPos.clone().add(mov);
                if (!this.checkCollision(testPos, getBlockAt)) {
                    finalPos.add(mov);
                }
            }
        }

        return finalPos.equals(currentPos) ? null : finalPos;
    }

    private worldToBlockPosition(worldPos: Vec3): Vec3 {
        return new Vec3(
            Math.floor(worldPos.x),
            Math.floor(worldPos.y),
            Math.floor(worldPos.z)
        );
    }

    private isBlockSolid(blockType: VoxelBlockType): boolean {
        return blockType !== VoxelBlockType.EMPTY && 
               blockType !== VoxelBlockType.WATER;
    }

    public checkGroundContact(
        playerPos: Vec3,
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType
    ): boolean {
        const checkPositions = [
            new Vec3(playerPos.x - this.playerRadius, playerPos.y - this.playerHeight * 0.5 - 0.1, playerPos.z - this.playerRadius),
            new Vec3(playerPos.x + this.playerRadius, playerPos.y - this.playerHeight * 0.5 - 0.1, playerPos.z - this.playerRadius),
            new Vec3(playerPos.x - this.playerRadius, playerPos.y - this.playerHeight * 0.5 - 0.1, playerPos.z + this.playerRadius),
            new Vec3(playerPos.x + this.playerRadius, playerPos.y - this.playerHeight * 0.5 - 0.1, playerPos.z + this.playerRadius),
            new Vec3(playerPos.x, playerPos.y - this.playerHeight * 0.5 - 0.1, playerPos.z)
        ];

        for (const pos of checkPositions) {
            const blockPos = this.worldToBlockPosition(pos);
            const blockType = getBlockAt(blockPos.x, blockPos.y, blockPos.z);
            if (this.isBlockSolid(blockType)) {
                return true;
            }
        }

        return false;
    }

    public getCollisionInfo(
        playerPos: Vec3,
        getBlockAt: (x: number, y: number, z: number) => VoxelBlockType
    ): { hasCollision: boolean; collidingBlocks: Vec3[]; nearestBlock?: Vec3 } {
        const collidingBlocks: Vec3[] = [];
        const positions = this.getCollisionCheckPositions(playerPos);
        
        for (const pos of positions) {
            const blockPos = this.worldToBlockPosition(pos);
            const blockType = getBlockAt(blockPos.x, blockPos.y, blockPos.z);
            
            if (this.isBlockSolid(blockType)) {
                const blockPosKey = `${blockPos.x},${blockPos.y},${blockPos.z}`;
                if (!collidingBlocks.some(b => `${b.x},${b.y},${b.z}` === blockPosKey)) {
                    collidingBlocks.push(blockPos);
                }
            }
        }
        
        let nearestBlock: Vec3 | undefined;
        if (collidingBlocks.length > 0) {
            let minDistance = Infinity;
            for (const block of collidingBlocks) {
                const distance = Vec3.distance(playerPos, block);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestBlock = block;
                }
            }
        }
        
        return {
            hasCollision: collidingBlocks.length > 0,
            collidingBlocks,
            nearestBlock
        };
    }
}