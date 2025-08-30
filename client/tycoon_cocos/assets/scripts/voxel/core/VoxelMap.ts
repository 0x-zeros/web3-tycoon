import { VoxelMap, VoxelMapEntry } from "./VoxelTypes";
import { VoxelConfig } from "./VoxelConfig";

export class VoxelMapUtils {
    
    static allocMap(dx: number, dy: number, dz: number, mask: number): VoxelMap {
        return {
            dx,
            dy,
            dz,
            mask,
            size: 0,
            data: new Map<string, VoxelMapEntry>()
        };
    }

    static freeMap(map: VoxelMap): void {
        map.data.clear();
        map.size = 0;
    }

    static copyMap(dst: VoxelMap, src: VoxelMap): void {
        dst.dx = src.dx;
        dst.dy = src.dy;
        dst.dz = src.dz;
        dst.mask = src.mask;
        dst.size = src.size;
        dst.data.clear();
        
        src.data.forEach((entry, key) => {
            dst.data.set(key, { ...entry });
        });
    }

    static growMap(map: VoxelMap): void {
        const oldData = new Map(map.data);
        map.mask = (map.mask << 1) | 1;
        map.data.clear();
        map.size = 0;

        oldData.forEach((entry) => {
            this.setMap(map, entry.x + map.dx, entry.y + map.dy, entry.z + map.dz, entry.w);
        });
    }

    static setMap(map: VoxelMap, x: number, y: number, z: number, w: number): boolean {
        const localX = x - map.dx;
        const localY = y - map.dy;
        const localZ = z - map.dz;
        
        // Y 轴不使用 mask 限制，应允许 0..MAX_HEIGHT-1
        const yOutOfRange = (localY < 0) || (localY >= this.getMaxHeight());
        if (localX < 0 || localX > map.mask || 
            yOutOfRange || 
            localZ < 0 || localZ > map.mask) {
            return false;
        }

        const key = this.makeKey(localX, localY, localZ);
        
        if (w === 0) {
            if (map.data.has(key)) {
                map.data.delete(key);
                map.size--;
            }
        } else {
            if (!map.data.has(key)) {
                map.size++;
            }
            map.data.set(key, { x: localX, y: localY, z: localZ, w });
        }
        
        return true;
    }

    static getMap(map: VoxelMap, x: number, y: number, z: number): number {
        const localX = x - map.dx;
        const localY = y - map.dy;
        const localZ = z - map.dz;
        
        const yOutOfRange = (localY < 0) || (localY >= this.getMaxHeight());
        if (localX < 0 || localX > map.mask || 
            yOutOfRange || 
            localZ < 0 || localZ > map.mask) {
            return 0;
        }

        const key = this.makeKey(localX, localY, localZ);
        const entry = map.data.get(key);
        return entry ? entry.w : 0;
    }

    private static getMaxHeight(): number {
        return VoxelConfig.MAX_HEIGHT;
    }

    private static makeKey(x: number, y: number, z: number): string {
        return `${x}_${y}_${z}`;
    }

    static forEachEntry(map: VoxelMap, callback: (x: number, y: number, z: number, w: number) => void): void {
        map.data.forEach((entry) => {
            const worldX = entry.x + map.dx;
            const worldY = entry.y + map.dy;
            const worldZ = entry.z + map.dz;
            callback(worldX, worldY, worldZ, entry.w);
        });
    }

    static isEmpty(map: VoxelMap): boolean {
        return map.size === 0;
    }

    static getSize(map: VoxelMap): number {
        return map.size;
    }

    static containsEntry(map: VoxelMap, x: number, y: number, z: number): boolean {
        return this.getMap(map, x, y, z) !== 0;
    }

    static clear(map: VoxelMap): void {
        map.data.clear();
        map.size = 0;
    }

    static getBounds(map: VoxelMap): { minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number } {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        map.data.forEach((entry) => {
            const worldX = entry.x + map.dx;
            const worldY = entry.y + map.dy;
            const worldZ = entry.z + map.dz;
            
            minX = Math.min(minX, worldX);
            minY = Math.min(minY, worldY);
            minZ = Math.min(minZ, worldZ);
            maxX = Math.max(maxX, worldX);
            maxY = Math.max(maxY, worldY);
            maxZ = Math.max(maxZ, worldZ);
        });

        return { minX, minY, minZ, maxX, maxY, maxZ };
    }
}