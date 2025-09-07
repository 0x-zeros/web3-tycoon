import { VoxelMap } from '../core/VoxelTypes';

/**
 * 体素地图工具类
 * 管理 VoxelMap 数据结构的创建、访问和操作
 */
export class VoxelMapUtils {
    
    /**
     * 创建新的体素地图
     * @param dx X轴偏移
     * @param dy Y轴偏移
     * @param dz Z轴偏移
     * @param mask 位掩码
     * @returns 新的体素地图
     */
    static allocMap(dx: number, dy: number, dz: number, mask: number): VoxelMap {
        return {
            dx,
            dy,
            dz,
            mask,
            size: 0,
            data: new Map()
        };
    }

    /**
     * 释放体素地图内存
     * @param map 要释放的地图
     */
    static freeMap(map: VoxelMap): void {
        map.data.clear();
        map.size = 0;
    }

    /**
     * 复制体素地图
     * @param dst 目标地图
     * @param src 源地图
     */
    static copyMap(dst: VoxelMap, src: VoxelMap): void {
        dst.dx = src.dx;
        dst.dy = src.dy;
        dst.dz = src.dz;
        dst.mask = src.mask;
        dst.size = src.size;
        
        dst.data.clear();
        for (const [key, value] of src.data) {
            dst.data.set(key, { ...value });
        }
    }

    /**
     * 设置地图中的值
     * @param map 地图对象
     * @param x X坐标
     * @param y Y坐标
     * @param z Z坐标
     * @param value 值
     * @returns 是否成功设置
     */
    static setMap(map: VoxelMap, x: number, y: number, z: number, value: number): boolean {
        try {
            const key = this.getMapKey(x, y, z);
            
            if (value === 0) {
                // 删除值为0的条目
                if (map.data.has(key)) {
                    map.data.delete(key);
                    map.size--;
                    return true;
                }
                return false;
            } else {
                // 设置非零值
                const existed = map.data.has(key);
                map.data.set(key, { x, y, z, w: value });
                
                if (!existed) {
                    map.size++;
                }
                return true;
            }
        } catch (error) {
            console.error(`[VoxelMapUtils] setMap 错误:`, error);
            return false;
        }
    }

    /**
     * 获取地图中的值
     * @param map 地图对象
     * @param x X坐标
     * @param y Y坐标
     * @param z Z坐标
     * @returns 值，未找到返回0
     */
    static getMap(map: VoxelMap, x: number, y: number, z: number): number {
        try {
            const key = this.getMapKey(x, y, z);
            const entry = map.data.get(key);
            return entry ? entry.w : 0;
        } catch (error) {
            console.error(`[VoxelMapUtils] getMap 错误:`, error);
            return 0;
        }
    }

    /**
     * 检查地图中是否存在指定位置
     * @param map 地图对象
     * @param x X坐标
     * @param y Y坐标
     * @param z Z坐标
     * @returns 是否存在
     */
    static hasMap(map: VoxelMap, x: number, y: number, z: number): boolean {
        const key = this.getMapKey(x, y, z);
        return map.data.has(key);
    }

    /**
     * 获取地图键值
     * @param x X坐标
     * @param y Y坐标
     * @param z Z坐标
     * @returns 键值字符串
     */
    private static getMapKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }

    /**
     * 获取地图所有条目
     * @param map 地图对象
     * @returns 所有条目的数组
     */
    static getAllEntries(map: VoxelMap): Array<{x: number, y: number, z: number, value: number}> {
        const entries: Array<{x: number, y: number, z: number, value: number}> = [];
        
        for (const entry of map.data.values()) {
            entries.push({
                x: entry.x,
                y: entry.y,
                z: entry.z,
                value: entry.w
            });
        }
        
        return entries;
    }

    /**
     * 清空地图
     * @param map 地图对象
     */
    static clearMap(map: VoxelMap): void {
        map.data.clear();
        map.size = 0;
    }

    /**
     * 获取地图统计信息
     * @param map 地图对象
     * @returns 统计信息
     */
    static getMapStats(map: VoxelMap): {
        size: number;
        memoryUsage: number;
        nonZeroEntries: number;
        maxValue: number;
        minValue: number;
    } {
        let maxValue = 0;
        let minValue = Number.MAX_SAFE_INTEGER;
        let nonZeroCount = 0;
        
        for (const entry of map.data.values()) {
            if (entry.w !== 0) {
                nonZeroCount++;
                maxValue = Math.max(maxValue, entry.w);
                minValue = Math.min(minValue, entry.w);
            }
        }
        
        if (nonZeroCount === 0) {
            minValue = 0;
        }
        
        return {
            size: map.size,
            memoryUsage: map.data.size * 4 * 4, // 估算内存使用（4个数字，每个4字节）
            nonZeroEntries: nonZeroCount,
            maxValue,
            minValue
        };
    }

    /**
     * 遍历地图中的所有非零条目
     * @param map 地图对象
     * @param callback 回调函数
     */
    static forEachNonZero(
        map: VoxelMap,
        callback: (x: number, y: number, z: number, value: number) => void
    ): void {
        for (const entry of map.data.values()) {
            if (entry.w !== 0) {
                callback(entry.x, entry.y, entry.z, entry.w);
            }
        }
    }

    /**
     * 在指定区域内遍历
     * @param map 地图对象
     * @param minX 最小X坐标
     * @param minY 最小Y坐标
     * @param minZ 最小Z坐标
     * @param maxX 最大X坐标
     * @param maxY 最大Y坐标
     * @param maxZ 最大Z坐标
     * @param callback 回调函数
     */
    static forEachInRegion(
        map: VoxelMap,
        minX: number, minY: number, minZ: number,
        maxX: number, maxY: number, maxZ: number,
        callback: (x: number, y: number, z: number, value: number) => void
    ): void {
        for (const entry of map.data.values()) {
            const { x, y, z, w } = entry;
            if (x >= minX && x <= maxX && 
                y >= minY && y <= maxY && 
                z >= minZ && z <= maxZ) {
                callback(x, y, z, w);
            }
        }
    }

    /**
     * 合并两个地图
     * @param dst 目标地图
     * @param src 源地图
     * @param overwrite 是否覆盖现有值
     */
    static mergeMap(dst: VoxelMap, src: VoxelMap, overwrite: boolean = true): void {
        for (const [key, entry] of src.data) {
            if (overwrite || !dst.data.has(key)) {
                const existed = dst.data.has(key);
                dst.data.set(key, { ...entry });
                
                if (!existed) {
                    dst.size++;
                }
            }
        }
    }
}