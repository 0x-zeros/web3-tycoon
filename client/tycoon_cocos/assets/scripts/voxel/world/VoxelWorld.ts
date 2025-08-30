import { VoxelChunk, VoxelWorldFunc } from "../core/VoxelTypes";
import { VoxelChunkManager } from "./VoxelChunk";
import { VoxelTerrain } from "./VoxelTerrain";
import { VoxelConfig } from "../core/VoxelConfig";
import { VoxelBlockType } from "../core/VoxelBlock";
import { VoxelWorldConfig } from "../core/VoxelWorldConfig";

export class VoxelWorldManager {
    private chunks: Map<string, VoxelChunk> = new Map();
    private chunkCount: number = 0;
    private createRadius: number = VoxelConfig.CREATE_CHUNK_RADIUS;
    private renderRadius: number = VoxelConfig.RENDER_CHUNK_RADIUS;
    private deleteRadius: number = VoxelConfig.DELETE_CHUNK_RADIUS;

    constructor() {
        
    }

    private isValidWorldCoordinate(x: number, y: number, z: number): boolean {
        return Number.isInteger(y) && 
               y >= 0 && 
               y < VoxelConfig.MAX_HEIGHT &&
               Number.isInteger(x) && 
               Number.isInteger(z);
    }

    private makeChunkKey(p: number, q: number): string {
        return `${p}_${q}`;
    }

    getChunk(p: number, q: number): VoxelChunk | undefined {
        const key = this.makeChunkKey(p, q);
        return this.chunks.get(key);
    }

    createChunk(p: number, q: number): VoxelChunk {
        const key = this.makeChunkKey(p, q);
        let chunk = this.chunks.get(key);
        
        if (!chunk) {
            chunk = VoxelChunkManager.createChunk(p, q);
            this.chunks.set(key, chunk);
            this.chunkCount++;
        }
        
        return chunk;
    }

    deleteChunk(p: number, q: number): boolean {
        const key = this.makeChunkKey(p, q);
        const chunk = this.chunks.get(key);
        
        if (chunk) {
            VoxelChunkManager.freeChunk(chunk);
            this.chunks.delete(key);
            this.chunkCount--;
            return true;
        }
        
        return false;
    }

    generateChunk(p: number, q: number): VoxelChunk {
        const chunk = this.createChunk(p, q);
        
        const worldFunc: VoxelWorldFunc = (x: number, y: number, z: number, w: number) => {
            if (Math.abs(w) !== VoxelBlockType.CLOUD) {
                VoxelChunkManager.setChunkBlock(chunk, x, y, z, Math.abs(w));
            }
        };
        
        VoxelTerrain.createWorld(p, q, worldFunc);
        
        return chunk;
    }

    getBlock(x: number, y: number, z: number): VoxelBlockType {
        if (!this.isValidWorldCoordinate(x, y, z)) {
            return VoxelBlockType.EMPTY;
        }
        
        const { p, q } = VoxelChunkManager.getChunkCoords(x, z);
        const chunk = this.getChunk(p, q);
        
        if (!chunk) {
            return VoxelTerrain.getBlockTypeAt(x, y, z);
        }
        
        return VoxelChunkManager.getChunkBlock(chunk, x, y, z) as VoxelBlockType;
    }

    setBlock(x: number, y: number, z: number, blockType: VoxelBlockType): boolean {
        if (!this.isValidWorldCoordinate(x, y, z)) {
            console.warn(`[VoxelWorldManager] 无效坐标: (${x}, ${y}, ${z})`);
            return false;
        }
        
        const { p, q } = VoxelChunkManager.getChunkCoords(x, z);
        let chunk = this.getChunk(p, q);
        
        if (!chunk) {
            chunk = this.generateChunk(p, q);
        }
        
        const result = VoxelChunkManager.setChunkBlock(chunk, x, y, z, blockType);
        
        if (result) {
            this.markNeighborChunksDirty(p, q);
        }
        
        return result;
    }

    private markNeighborChunksDirty(p: number, q: number): void {
        const neighbors = VoxelChunkManager.getNeighborChunkCoords(p, q);
        
        neighbors.forEach(({ p: np, q: nq }) => {
            const neighborChunk = this.getChunk(np, nq);
            if (neighborChunk) {
                VoxelChunkManager.markChunkDirty(neighborChunk);
            }
        });
    }

    updateChunksAroundPlayer(playerX: number, playerZ: number): void {
        const { p: playerP, q: playerQ } = VoxelChunkManager.getChunkCoords(playerX, playerZ);
        
        this.deleteDistantChunks(playerP, playerQ);
        
        this.createNearbyChunks(playerP, playerQ);
    }

    private deleteDistantChunks(playerP: number, playerQ: number): void {
        const chunksToDelete: string[] = [];
        
        this.chunks.forEach((chunk, key) => {
            const isInRadius = VoxelChunkManager.isChunkInRadius(
                playerP, playerQ, chunk.p, chunk.q, this.deleteRadius
            );
            
            if (!isInRadius) {
                chunksToDelete.push(key);
            }
        });
        
        chunksToDelete.forEach(key => {
            const [p, q] = key.split('_').map(Number);
            this.deleteChunk(p, q);
        });
    }

    private createNearbyChunks(playerP: number, playerQ: number): void {
        for (let dp = -this.createRadius; dp <= this.createRadius; dp++) {
            for (let dq = -this.createRadius; dq <= this.createRadius; dq++) {
                const p = playerP + dp;
                const q = playerQ + dq;
                
                const isInRadius = VoxelChunkManager.isChunkInRadius(
                    playerP, playerQ, p, q, this.createRadius
                );
                
                if (isInRadius && !this.getChunk(p, q)) {
                    this.generateChunk(p, q);
                }
            }
        }
    }

    getRenderableChunks(playerX: number, playerZ: number): VoxelChunk[] {
        const { p: playerP, q: playerQ } = VoxelChunkManager.getChunkCoords(playerX, playerZ);
        const renderableChunks: VoxelChunk[] = [];
        
        this.chunks.forEach(chunk => {
            const isInRenderRadius = VoxelChunkManager.isChunkInRadius(
                playerP, playerQ, chunk.p, chunk.q, this.renderRadius
            );
            
            if (isInRenderRadius && !VoxelChunkManager.isChunkEmpty(chunk)) {
                renderableChunks.push(chunk);
            }
        });
        
        return renderableChunks;
    }

    getDirtyChunks(): VoxelChunk[] {
        const dirtyChunks: VoxelChunk[] = [];
        
        this.chunks.forEach(chunk => {
            if (VoxelChunkManager.isChunkDirty(chunk)) {
                dirtyChunks.push(chunk);
            }
        });
        
        return dirtyChunks;
    }

    getLoadedChunks(): VoxelChunk[] {
        return Array.from(this.chunks.values());
    }

    getChunkCount(): number {
        return this.chunkCount;
    }

    isChunkLoaded(p: number, q: number): boolean {
        return this.getChunk(p, q) !== undefined;
    }

    clear(): void {
        this.chunks.forEach(chunk => {
            VoxelChunkManager.freeChunk(chunk);
        });
        
        this.chunks.clear();
        this.chunkCount = 0;
    }

    getHeightAt(x: number, z: number): number {
        return VoxelTerrain.getHeightAt(x, z);
    }

    getBiomeAt(x: number, z: number): string {
        return VoxelTerrain.getBiomeAt(x, z);
    }

    isValidSpawnLocation(x: number, z: number): boolean {
        return VoxelTerrain.isValidSpawnLocation(x, z);
    }

    findSpawnLocation(): { x: number, y: number, z: number } {
        const maxSearchRange = Math.min(200, VoxelConfig.CHUNK_SIZE * VoxelConfig.CREATE_CHUNK_RADIUS);
        
        for (let attempts = 0; attempts < 100; attempts++) {
            const x = Math.floor(Math.random() * maxSearchRange - maxSearchRange / 2);
            const z = Math.floor(Math.random() * maxSearchRange - maxSearchRange / 2);
            
            if (this.isValidSpawnLocation(x, z)) {
                const groundHeight = this.getHeightAt(x, z);
                const y = Math.min(groundHeight + 1, VoxelConfig.MAX_HEIGHT - 2);
                
                if (this.isValidWorldCoordinate(x, y, z)) {
                    return { x, y, z };
                }
            }
        }
        
        const fallbackHeight = this.getHeightAt(0, 0);
        const fallbackY = Math.min(fallbackHeight + 1, VoxelConfig.MAX_HEIGHT - 2);
        
        return { x: 0, y: fallbackY, z: 0 };
    }

    raycast(
        startX: number, startY: number, startZ: number,
        dirX: number, dirY: number, dirZ: number,
        maxDistance: number = 100
    ): { hit: boolean, x?: number, y?: number, z?: number, blockType?: VoxelBlockType } {
        const step = 0.1;
        const steps = Math.floor(maxDistance / step);
        
        for (let i = 0; i <= steps; i++) {
            const x = Math.floor(startX + dirX * i * step);
            const y = Math.floor(startY + dirY * i * step);
            const z = Math.floor(startZ + dirZ * i * step);
            
            if (!this.isValidWorldCoordinate(x, y, z)) {
                continue;
            }
            
            const blockType = this.getBlock(x, y, z);
            
            if (blockType !== VoxelBlockType.EMPTY && blockType !== VoxelBlockType.CLOUD) {
                return { hit: true, x, y, z, blockType };
            }
        }
        
        return { hit: false };
    }

    setCreateRadius(radius: number): void {
        this.createRadius = Math.max(1, radius);
    }

    setRenderRadius(radius: number): void {
        this.renderRadius = Math.max(1, radius);
    }

    setDeleteRadius(radius: number): void {
        this.deleteRadius = Math.max(this.createRadius + 1, radius);
    }

    getStatistics() {
        return {
            totalChunks: this.chunkCount,
            loadedChunks: this.chunks.size,
            createRadius: this.createRadius,
            renderRadius: this.renderRadius,
            deleteRadius: this.deleteRadius
        };
    }
}