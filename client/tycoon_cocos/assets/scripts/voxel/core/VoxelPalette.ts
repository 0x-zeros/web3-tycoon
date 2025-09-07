/**
 * 体素调色板压缩系统
 * 为每个Chunk维护局部方块调色板，大幅减少内存占用
 * 基于现代体素游戏的调色板压缩技术
 */

export type StorageType = 'uint4' | 'uint8' | 'uint16';

export interface PaletteStats {
    entries: number;            // 调色板条目数
    storageType: StorageType;   // 存储类型
    memoryUsage: number;        // 内存占用（字节）
    compressionRatio: number;   // 压缩比
}

/**
 * Chunk级调色板
 * 每个Chunk维护自己的方块调色板，只存储该Chunk实际使用的方块类型
 */
export class ChunkPalette {
    private entries: string[] = [];                    // 调色板条目（方块ID列表）
    private indexMap: Map<string, number> = new Map(); // 方块ID到索引的快速映射
    private dirty: boolean = false;                    // 是否需要重新计算存储类型
    private storageType: StorageType = 'uint4';        // 当前存储类型
    
    constructor() {
        // 空气总是第一个条目（索引0）
        this.addEntry('minecraft:air');
    }
    
    /**
     * 获取或添加方块到调色板，返回局部索引
     */
    getOrAddIndex(blockId: string): number {
        // 快速路径：检查是否已存在
        const existingIndex = this.indexMap.get(blockId);
        if (existingIndex !== undefined) {
            return existingIndex;
        }
        
        // 添加新条目
        return this.addEntry(blockId);
    }
    
    /**
     * 添加新条目到调色板
     */
    private addEntry(blockId: string): number {
        const index = this.entries.length;
        this.entries.push(blockId);
        this.indexMap.set(blockId, index);
        this.dirty = true;
        
        // 检查是否需要升级存储类型
        this.updateStorageType();
        
        return index;
    }
    
    /**
     * 根据索引获取方块ID
     */
    getBlockId(index: number): string {
        if (index >= 0 && index < this.entries.length) {
            return this.entries[index];
        }
        return 'minecraft:air'; // 默认返回空气
    }
    
    /**
     * 获取调色板大小
     */
    size(): number {
        return this.entries.length;
    }
    
    /**
     * 获取所有条目
     */
    getEntries(): string[] {
        return [...this.entries]; // 返回副本
    }
    
    /**
     * 获取当前存储类型
     */
    getStorageType(): StorageType {
        if (this.dirty) {
            this.updateStorageType();
        }
        return this.storageType;
    }
    
    /**
     * 更新存储类型
     */
    private updateStorageType(): void {
        const entryCount = this.entries.length;
        
        if (entryCount <= 16) {
            this.storageType = 'uint4';    // 4位，支持16种方块
        } else if (entryCount <= 256) {
            this.storageType = 'uint8';    // 8位，支持256种方块
        } else {
            this.storageType = 'uint16';   // 16位，支持65536种方块
        }
        
        this.dirty = false;
    }
    
    /**
     * 获取每个方块所需的位数
     */
    getBitsPerEntry(): number {
        switch (this.getStorageType()) {
            case 'uint4': return 4;
            case 'uint8': return 8;
            case 'uint16': return 16;
            default: return 8;
        }
    }
    
    /**
     * 创建适当的TypedArray用于存储
     */
    createStorageArray(length: number): Uint8Array | Uint16Array {
        switch (this.getStorageType()) {
            case 'uint4':
                // 4位存储，两个条目共享一个字节
                return new Uint8Array(Math.ceil(length / 2));
            case 'uint8':
                return new Uint8Array(length);
            case 'uint16':
                return new Uint16Array(length);
            default:
                return new Uint8Array(length);
        }
    }
    
    /**
     * 写入数据到存储数组
     */
    writeToStorage(storage: Uint8Array | Uint16Array, index: number, value: number): void {
        switch (this.getStorageType()) {
            case 'uint4':
                // 4位打包存储
                const byteIndex = Math.floor(index / 2);
                const isHighNibble = index % 2 === 1;
                const storageUint8 = storage as Uint8Array;
                
                if (isHighNibble) {
                    // 高4位
                    storageUint8[byteIndex] = (storageUint8[byteIndex] & 0x0F) | ((value & 0x0F) << 4);
                } else {
                    // 低4位
                    storageUint8[byteIndex] = (storageUint8[byteIndex] & 0xF0) | (value & 0x0F);
                }
                break;
                
            case 'uint8':
                (storage as Uint8Array)[index] = value;
                break;
                
            case 'uint16':
                (storage as Uint16Array)[index] = value;
                break;
        }
    }
    
    /**
     * 从存储数组读取数据
     */
    readFromStorage(storage: Uint8Array | Uint16Array, index: number): number {
        switch (this.getStorageType()) {
            case 'uint4':
                // 4位打包存储
                const byteIndex = Math.floor(index / 2);
                const isHighNibble = index % 2 === 1;
                const storageUint8 = storage as Uint8Array;
                
                if (isHighNibble) {
                    // 高4位
                    return (storageUint8[byteIndex] >> 4) & 0x0F;
                } else {
                    // 低4位
                    return storageUint8[byteIndex] & 0x0F;
                }
                
            case 'uint8':
                return (storage as Uint8Array)[index];
                
            case 'uint16':
                return (storage as Uint16Array)[index];
                
            default:
                return 0;
        }
    }
    
    /**
     * 检查是否包含指定方块
     */
    contains(blockId: string): boolean {
        return this.indexMap.has(blockId);
    }
    
    /**
     * 获取统计信息
     */
    getStats(): PaletteStats {
        const entries = this.entries.length;
        const storageType = this.getStorageType();
        
        // 计算内存占用
        let bytesPerEntry = 1; // 默认1字节
        switch (storageType) {
            case 'uint4': bytesPerEntry = 0.5; break;
            case 'uint8': bytesPerEntry = 1; break;
            case 'uint16': bytesPerEntry = 2; break;
        }
        
        const paletteOverhead = entries * 64; // 每个字符串大约64字节
        const dataSize = 16 * 16 * 256 * bytesPerEntry; // 假设chunk大小为16x16x256
        const memoryUsage = paletteOverhead + dataSize;
        
        // 计算压缩比（相对于使用4字节存储每个方块）
        const uncompressedSize = 16 * 16 * 256 * 4;
        const compressionRatio = uncompressedSize / memoryUsage;
        
        return {
            entries,
            storageType,
            memoryUsage: Math.round(memoryUsage),
            compressionRatio: Math.round(compressionRatio * 100) / 100
        };
    }
    
    /**
     * 优化调色板（移除未使用的条目）
     * 需要配合Chunk使用统计
     */
    optimize(usageCounts: Map<number, number>): Map<number, number> {
        const newEntries: string[] = [];
        const newIndexMap = new Map<string, number>();
        const oldToNewMapping = new Map<number, number>();
        
        // 空气总是保持在索引0
        newEntries.push('minecraft:air');
        newIndexMap.set('minecraft:air', 0);
        oldToNewMapping.set(0, 0);
        
        let newIndex = 1;
        
        // 添加被使用的条目（跳过索引0的空气）
        for (let oldIndex = 1; oldIndex < this.entries.length; oldIndex++) {
            const count = usageCounts.get(oldIndex) || 0;
            if (count > 0) {
                const blockId = this.entries[oldIndex];
                newEntries.push(blockId);
                newIndexMap.set(blockId, newIndex);
                oldToNewMapping.set(oldIndex, newIndex);
                newIndex++;
            }
        }
        
        // 更新调色板
        if (newEntries.length < this.entries.length) {
            this.entries = newEntries;
            this.indexMap = newIndexMap;
            this.dirty = true;
            console.log(`[ChunkPalette] 优化完成：${this.entries.length} -> ${newEntries.length} 条目`);
        }
        
        return oldToNewMapping;
    }
    
    /**
     * 克隆调色板
     */
    clone(): ChunkPalette {
        const cloned = new ChunkPalette();
        cloned.entries = [...this.entries];
        cloned.indexMap = new Map(this.indexMap);
        cloned.storageType = this.storageType;
        cloned.dirty = this.dirty;
        return cloned;
    }
    
    /**
     * 重置调色板
     */
    reset(): void {
        this.entries = ['minecraft:air'];
        this.indexMap.clear();
        this.indexMap.set('minecraft:air', 0);
        this.storageType = 'uint4';
        this.dirty = false;
    }
    
    /**
     * 序列化调色板（用于网络传输或存储）
     */
    serialize(): {
        entries: string[];
        storageType: StorageType;
    } {
        return {
            entries: [...this.entries],
            storageType: this.getStorageType()
        };
    }
    
    /**
     * 从序列化数据创建调色板
     */
    static deserialize(data: {
        entries: string[];
        storageType: StorageType;
    }): ChunkPalette {
        const palette = new ChunkPalette();
        palette.entries = [...data.entries];
        palette.indexMap.clear();
        
        // 重建索引映射
        data.entries.forEach((blockId, index) => {
            palette.indexMap.set(blockId, index);
        });
        
        palette.storageType = data.storageType;
        palette.dirty = false;
        
        return palette;
    }
}

/**
 * 调色板管理器
 * 提供全局的调色板操作和统计功能
 */
export class PaletteManager {
    private static totalPalettes = 0;
    private static totalMemoryUsage = 0;
    
    static registerPalette(palette: ChunkPalette): void {
        this.totalPalettes++;
        this.totalMemoryUsage += palette.getStats().memoryUsage;
    }
    
    static unregisterPalette(palette: ChunkPalette): void {
        this.totalPalettes = Math.max(0, this.totalPalettes - 1);
        this.totalMemoryUsage = Math.max(0, this.totalMemoryUsage - palette.getStats().memoryUsage);
    }
    
    static getGlobalStats() {
        return {
            totalPalettes: this.totalPalettes,
            totalMemoryUsage: this.totalMemoryUsage,
            averageMemoryPerPalette: this.totalPalettes > 0 ? 
                Math.round(this.totalMemoryUsage / this.totalPalettes) : 0
        };
    }
    
    /**
     * 创建单一方块调色板（优化：只包含一种方块的chunk）
     */
    static createSingleBlockPalette(blockId: string): ChunkPalette {
        const palette = new ChunkPalette();
        if (blockId !== 'minecraft:air') {
            palette.getOrAddIndex(blockId);
        }
        return palette;
    }
}