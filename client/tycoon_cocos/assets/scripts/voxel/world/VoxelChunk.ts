import { VoxelChunk, VoxelMap } from "../core/VoxelTypes";
import { VoxelMapUtils } from "../core/VoxelMap";
import { VoxelConfig } from "../core/VoxelConfig";

export class VoxelChunkManager {
    
    static createChunk(p: number, q: number): VoxelChunk {
        const mapSize = VoxelConfig.CHUNK_SIZE;
        const mask = mapSize - 1;
        
        return {
            map: VoxelMapUtils.allocMap(p * mapSize, 0, q * mapSize, mask),
            lights: VoxelMapUtils.allocMap(p * mapSize, 0, q * mapSize, mask),
            p,
            q,
            faces: 0,
            dirty: true,
            miny: VoxelConfig.MAX_HEIGHT,
            maxy: 0,
            node: null
        };
    }

    static freeChunk(chunk: VoxelChunk): void {
        VoxelMapUtils.freeMap(chunk.map);
        VoxelMapUtils.freeMap(chunk.lights);
        
        if (chunk.node) {
            chunk.node.destroy();
            chunk.node = null;
        }
        
        chunk.faces = 0;
        chunk.dirty = false;
        chunk.miny = VoxelConfig.MAX_HEIGHT;
        chunk.maxy = 0;
    }

    static copyChunk(dst: VoxelChunk, src: VoxelChunk): void {
        VoxelMapUtils.copyMap(dst.map, src.map);
        VoxelMapUtils.copyMap(dst.lights, src.lights);
        
        dst.p = src.p;
        dst.q = src.q;
        dst.faces = src.faces;
        dst.dirty = src.dirty;
        dst.miny = src.miny;
        dst.maxy = src.maxy;
    }

    static getChunkBlock(chunk: VoxelChunk, x: number, y: number, z: number): number {
        return VoxelMapUtils.getMap(chunk.map, x, y, z);
    }

    static setChunkBlock(chunk: VoxelChunk, x: number, y: number, z: number, w: number): boolean {
        const result = VoxelMapUtils.setMap(chunk.map, x, y, z, w);
        
        if (result) {
            chunk.dirty = true;
            
            if (w > 0) {
                chunk.miny = Math.min(chunk.miny, y);
                chunk.maxy = Math.max(chunk.maxy, y);
            } else {
                this.updateChunkBounds(chunk);
            }
        }
        
        return result;
    }

    static getChunkLight(chunk: VoxelChunk, x: number, y: number, z: number): number {
        return VoxelMapUtils.getMap(chunk.lights, x, y, z);
    }

    static setChunkLight(chunk: VoxelChunk, x: number, y: number, z: number, light: number): boolean {
        const result = VoxelMapUtils.setMap(chunk.lights, x, y, z, light);
        
        if (result) {
            chunk.dirty = true;
        }
        
        return result;
    }

    private static updateChunkBounds(chunk: VoxelChunk): void {
        let minY = VoxelConfig.MAX_HEIGHT;
        let maxY = 0;
        
        VoxelMapUtils.forEachEntry(chunk.map, (x, y, z, w) => {
            if (w > 0) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        });
        
        chunk.miny = minY;
        chunk.maxy = maxY;
    }

    static isChunkEmpty(chunk: VoxelChunk): boolean {
        return VoxelMapUtils.isEmpty(chunk.map);
    }

    static getChunkSize(chunk: VoxelChunk): number {
        return VoxelMapUtils.getSize(chunk.map);
    }

    static markChunkDirty(chunk: VoxelChunk): void {
        chunk.dirty = true;
    }

    static isChunkDirty(chunk: VoxelChunk): boolean {
        return chunk.dirty;
    }

    static clearChunkDirtyFlag(chunk: VoxelChunk): void {
        chunk.dirty = false;
    }

    static getChunkBounds(chunk: VoxelChunk): { 
        minX: number, 
        minY: number, 
        minZ: number, 
        maxX: number, 
        maxY: number, 
        maxZ: number 
    } {
        return VoxelMapUtils.getBounds(chunk.map);
    }

    static getChunkWorldPosition(chunk: VoxelChunk): { x: number, z: number } {
        return {
            x: chunk.p * VoxelConfig.CHUNK_SIZE,
            z: chunk.q * VoxelConfig.CHUNK_SIZE
        };
    }

    static getChunkCoords(worldX: number, worldZ: number): { p: number, q: number } {
        return {
            p: Math.floor(worldX / VoxelConfig.CHUNK_SIZE),
            q: Math.floor(worldZ / VoxelConfig.CHUNK_SIZE)
        };
    }

    static getLocalCoords(worldX: number, worldY: number, worldZ: number): { x: number, y: number, z: number } {
        const chunkSize = VoxelConfig.CHUNK_SIZE;
        return {
            x: ((worldX % chunkSize) + chunkSize) % chunkSize,
            y: worldY,
            z: ((worldZ % chunkSize) + chunkSize) % chunkSize
        };
    }

    static getWorldCoords(chunk: VoxelChunk, localX: number, localY: number, localZ: number): { x: number, y: number, z: number } {
        return {
            x: chunk.p * VoxelConfig.CHUNK_SIZE + localX,
            y: localY,
            z: chunk.q * VoxelConfig.CHUNK_SIZE + localZ
        };
    }

    static isValidChunkCoord(coord: number): boolean {
        const chunkSize = VoxelConfig.CHUNK_SIZE;
        return coord >= 0 && coord < chunkSize;
    }

    static forEachBlock(chunk: VoxelChunk, callback: (x: number, y: number, z: number, w: number) => void): void {
        VoxelMapUtils.forEachEntry(chunk.map, callback);
    }

    static getAdjacentChunkCoords(p: number, q: number): { p: number, q: number }[] {
        return [
            { p: p - 1, q: q - 1 }, { p: p, q: q - 1 }, { p: p + 1, q: q - 1 },
            { p: p - 1, q: q },     { p: p, q: q },     { p: p + 1, q: q },
            { p: p - 1, q: q + 1 }, { p: p, q: q + 1 }, { p: p + 1, q: q + 1 }
        ];
    }

    static getNeighborChunkCoords(p: number, q: number): { p: number, q: number }[] {
        return [
            { p: p - 1, q: q },
            { p: p + 1, q: q },
            { p: p, q: q - 1 },
            { p: p, q: q + 1 }
        ];
    }

    static calculateChunkDistance(p1: number, q1: number, p2: number, q2: number): number {
        const dp = p1 - p2;
        const dq = q1 - q2;
        return Math.sqrt(dp * dp + dq * dq);
    }

    static isChunkInRadius(centerP: number, centerQ: number, p: number, q: number, radius: number): boolean {
        const distance = this.calculateChunkDistance(centerP, centerQ, p, q);
        return distance <= radius;
    }
}