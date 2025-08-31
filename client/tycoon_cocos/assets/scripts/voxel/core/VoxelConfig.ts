import { VoxelWorldConfig } from "./VoxelWorldConfig";

export enum VoxelRenderMode {
    MERGED_CHUNK = "merged",           // 合并模式：一个chunk一个mesh（性能优化）
    INDIVIDUAL_BLOCK = "individual"    // 独立模式：每个block一个独立Node（便于调试）
}

export class VoxelConfig {
    static readonly DEBUG = false;
    
    // 动态配置 - 从 VoxelWorldConfig 获取
    static get CHUNK_SIZE(): number {
        return VoxelWorldConfig.CHUNK_SIZE;
    }
    
    static get MAX_HEIGHT(): number {
        return VoxelWorldConfig.MAX_HEIGHT;
    }
    
    static get SEA_LEVEL(): number {
        return VoxelWorldConfig.SEA_LEVEL;
    }
    
    static get CREATE_CHUNK_RADIUS(): number {
        return VoxelWorldConfig.CREATE_CHUNK_RADIUS;
    }
    
    static get RENDER_CHUNK_RADIUS(): number {
        return VoxelWorldConfig.RENDER_CHUNK_RADIUS;
    }
    
    static get DELETE_CHUNK_RADIUS(): number {
        return VoxelWorldConfig.DELETE_CHUNK_RADIUS;
    }
    
    static get TERRAIN_NOISE_SCALE(): number {
        return VoxelWorldConfig.TERRAIN_NOISE_SCALE;
    }
    
    static get TERRAIN_HEIGHT_SCALE(): number {
        return VoxelWorldConfig.TERRAIN_HEIGHT_SCALE;
    }
    
    static get TERRAIN_HEIGHT_OFFSET(): number {
        return VoxelWorldConfig.TERRAIN_HEIGHT_OFFSET;
    }
    
    static get SHOW_PLANTS(): boolean {
        return VoxelWorldConfig.SHOW_PLANTS;
    }
    
    static get SHOW_CLOUDS(): boolean {
        return VoxelWorldConfig.SHOW_CLOUDS;
    }
    
    static get SHOW_TREES(): boolean {
        return VoxelWorldConfig.SHOW_TREES;
    }
    
    // 固定配置 - 不需要动态调整
    static readonly MAX_CHUNKS = 8192;
    static readonly WORKERS = 4;
    static readonly COMMIT_INTERVAL = 5;
    static readonly SHOW_LIGHTS = true;
    
    static readonly DAY_LENGTH = 600;
    static readonly CLOUD_HEIGHT_MIN = 64;
    static readonly CLOUD_HEIGHT_MAX = 72;
    
    static readonly TREE_HEIGHT_MIN = 3;
    static readonly TREE_HEIGHT_MAX = 7;
    static readonly TREE_TRUNK_HEIGHT = 7;
    static readonly TREE_LEAVES_RADIUS = 3;
    static readonly TREE_LEAVES_HEIGHT_OFFSET = 4;
    
    static readonly PLANT_NOISE_SCALE = 0.1;
    static readonly PLANT_THRESHOLD = 0.6;
    static readonly FLOWER_NOISE_SCALE = 0.05;
    static readonly FLOWER_THRESHOLD = 0.7;
    static readonly TREE_NOISE_SCALE = 1.0;
    static readonly TREE_THRESHOLD = 0.84;
    static readonly CLOUD_NOISE_SCALE = 0.01;
    static readonly CLOUD_THRESHOLD = 0.75;
    
    static readonly LIGHT_DIRECTION = { x: -1.0, y: 1.0, z: -1.0 };
    static readonly FOG_DISTANCE_DEFAULT = 150.0;
    
    static readonly FACE_COUNT = 6;
    static readonly VERTEX_PER_FACE = 4;
    static readonly TRIANGLE_PER_FACE = 2;
    static readonly VERTEX_ATTRIBUTES = 10;
}