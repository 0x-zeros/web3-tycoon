export enum VoxelWorldMode {
    NORMAL = "normal",           // 标准: 32x32 区块, 256高度
    SMALL_FLAT = "small_flat",   // 小平坦: 8x8 区块, 32高度
    TINY_DEBUG = "tiny_debug",   // 调试: 4x4 区块, 16高度
}

export interface VoxelWorldConfiguration {
    CHUNK_SIZE: number;
    MAX_HEIGHT: number;
    CREATE_CHUNK_RADIUS: number;
    RENDER_CHUNK_RADIUS: number;
    DELETE_CHUNK_RADIUS: number;
    TERRAIN_HEIGHT_SCALE: number;
    TERRAIN_HEIGHT_OFFSET: number;
    SEA_LEVEL: number;
    TERRAIN_NOISE_SCALE: number;
    SHOW_TREES: boolean;
    SHOW_PLANTS: boolean;
    SHOW_CLOUDS: boolean;
}

export class VoxelWorldConfig {
    private static mode: VoxelWorldMode = VoxelWorldMode.SMALL_FLAT;
    
    private static configurations: Map<VoxelWorldMode, VoxelWorldConfiguration> = new Map([
        [VoxelWorldMode.NORMAL, {
            CHUNK_SIZE: 32,
            MAX_HEIGHT: 256,
            CREATE_CHUNK_RADIUS: 10,
            RENDER_CHUNK_RADIUS: 10,
            DELETE_CHUNK_RADIUS: 14,
            TERRAIN_HEIGHT_SCALE: 32,
            TERRAIN_HEIGHT_OFFSET: 16,
            SEA_LEVEL: 12,
            TERRAIN_NOISE_SCALE: 0.01,
            SHOW_TREES: true,
            SHOW_PLANTS: true,
            SHOW_CLOUDS: true
        }],
        
        [VoxelWorldMode.SMALL_FLAT, {
            CHUNK_SIZE: 8,
            MAX_HEIGHT: 32,
            CREATE_CHUNK_RADIUS: 3,
            RENDER_CHUNK_RADIUS: 3,
            DELETE_CHUNK_RADIUS: 5,
            TERRAIN_HEIGHT_SCALE: 4,    // 很平坦
            TERRAIN_HEIGHT_OFFSET: 8,
            SEA_LEVEL: 6,
            TERRAIN_NOISE_SCALE: 0.02,  // 较大的噪声尺度
            SHOW_TREES: false,          // 小世界不显示树木
            SHOW_PLANTS: true,
            SHOW_CLOUDS: false          // 小世界不显示云朵
        }],
        
        [VoxelWorldMode.TINY_DEBUG, {
            CHUNK_SIZE: 4,
            MAX_HEIGHT: 16,
            CREATE_CHUNK_RADIUS: 2,
            RENDER_CHUNK_RADIUS: 2,
            DELETE_CHUNK_RADIUS: 3,
            TERRAIN_HEIGHT_SCALE: 2,
            TERRAIN_HEIGHT_OFFSET: 4,
            SEA_LEVEL: 3,
            TERRAIN_NOISE_SCALE: 0.05,
            SHOW_TREES: false,
            SHOW_PLANTS: false,
            SHOW_CLOUDS: false
        }]
    ]);
    
    static setMode(mode: VoxelWorldMode): void {
        this.mode = mode;
        console.log(`[VoxelWorldConfig] 切换到世界模式: ${mode}`);
    }
    
    static getMode(): VoxelWorldMode {
        return this.mode;
    }
    
    static getConfig(): VoxelWorldConfiguration {
        const config = this.configurations.get(this.mode);
        if (!config) {
            console.warn(`[VoxelWorldConfig] 未知的世界模式: ${this.mode}, 使用默认配置`);
            return this.configurations.get(VoxelWorldMode.SMALL_FLAT)!;
        }
        return config;
    }
    
    static get CHUNK_SIZE(): number {
        return this.getConfig().CHUNK_SIZE;
    }
    
    static get MAX_HEIGHT(): number {
        return this.getConfig().MAX_HEIGHT;
    }
    
    static get CREATE_CHUNK_RADIUS(): number {
        return this.getConfig().CREATE_CHUNK_RADIUS;
    }
    
    static get RENDER_CHUNK_RADIUS(): number {
        return this.getConfig().RENDER_CHUNK_RADIUS;
    }
    
    static get DELETE_CHUNK_RADIUS(): number {
        return this.getConfig().DELETE_CHUNK_RADIUS;
    }
    
    static get TERRAIN_HEIGHT_SCALE(): number {
        return this.getConfig().TERRAIN_HEIGHT_SCALE;
    }
    
    static get TERRAIN_HEIGHT_OFFSET(): number {
        return this.getConfig().TERRAIN_HEIGHT_OFFSET;
    }
    
    static get SEA_LEVEL(): number {
        return this.getConfig().SEA_LEVEL;
    }
    
    static get TERRAIN_NOISE_SCALE(): number {
        return this.getConfig().TERRAIN_NOISE_SCALE;
    }
    
    static get SHOW_TREES(): boolean {
        return this.getConfig().SHOW_TREES;
    }
    
    static get SHOW_PLANTS(): boolean {
        return this.getConfig().SHOW_PLANTS;
    }
    
    static get SHOW_CLOUDS(): boolean {
        return this.getConfig().SHOW_CLOUDS;
    }
    
    static getWorldInfo(): string {
        const config = this.getConfig();
        const chunkBlocks = config.CHUNK_SIZE * config.CHUNK_SIZE * config.MAX_HEIGHT;
        return `世界模式: ${this.mode}
区块大小: ${config.CHUNK_SIZE}x${config.CHUNK_SIZE}x${config.MAX_HEIGHT} (${chunkBlocks} 方块)
渲染半径: ${config.RENDER_CHUNK_RADIUS} 区块
地形高度: ${config.SEA_LEVEL} - ${config.TERRAIN_HEIGHT_OFFSET + config.TERRAIN_HEIGHT_SCALE}`;
    }
}