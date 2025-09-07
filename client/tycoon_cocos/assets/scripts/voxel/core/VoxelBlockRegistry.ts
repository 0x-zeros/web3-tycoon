/**
 * 现代体素方块注册表
 * 采用字符串ID系统，支持调色板压缩架构
 * 基于Minecraft 1.13+设计模式
 */

export type MinecraftBlockId = 
    | 'minecraft:air'
    | 'minecraft:stone'
    | 'minecraft:dirt'
    | 'minecraft:grass_block'
    | 'minecraft:sand'
    | 'minecraft:cobblestone'
    | 'minecraft:oak_log'
    | 'minecraft:oak_planks'
    | 'minecraft:oak_leaves'
    | 'minecraft:glass'
    | 'minecraft:dandelion'
    | 'minecraft:poppy'
    | 'minecraft:grass'
    | 'minecraft:fern'
    | 'minecraft:bedrock'
    | 'minecraft:water'
    | 'minecraft:lava'
    | 'minecraft:glowstone'
    | 'minecraft:torch';

export enum BlockCategory {
    BUILDING = 'building',
    NATURAL = 'natural', 
    DECORATION = 'decoration',
    REDSTONE = 'redstone',
    TRANSPORTATION = 'transportation',
    MISCELLANEOUS = 'miscellaneous',
    LIQUID = 'liquid'
}

export enum BlockRenderType {
    CUBE = 'cube',              // 普通立方体
    CROSS = 'cross',            // 交叉植物
    TRANSPARENT = 'transparent', // 透明方块
    CUTOUT = 'cutout',          // 裁切（如叶子）
    LIQUID = 'liquid',          // 液体
    EMISSIVE = 'emissive'       // 发光方块
}

export interface BlockProperties {
    hardness: number;           // 硬度
    transparent: boolean;       // 是否透明
    luminance: number;          // 发光等级 (0-15)
    flammable: boolean;         // 是否可燃
    solid: boolean;             // 是否为实心方块
    waterlogged: boolean;       // 是否可以被水淹没
    gravity: boolean;           // 是否受重力影响
}

export interface BlockDefinition {
    id: string;                 // 方块ID，如 "minecraft:stone"
    displayName: string;        // 显示名称
    category: BlockCategory;    // 方块分类
    renderType: BlockRenderType; // 渲染类型
    properties: BlockProperties; // 方块属性
    textures: {                 // 纹理路径
        all?: string;           // 所有面使用同一纹理
        top?: string;           // 顶面纹理
        bottom?: string;        // 底面纹理
        side?: string;          // 侧面纹理
        north?: string;         // 北面纹理
        south?: string;         // 南面纹理
        east?: string;          // 东面纹理
        west?: string;          // 西面纹理
    };
    model?: string;             // 模型路径（可选）
}

export interface BlockInfo {
    id: string;
    displayName: string;
    category: BlockCategory;
    icon: string;
    properties: BlockProperties;
}

/**
 * 全局方块注册表
 * 单例模式，管理所有方块定义
 */
export class VoxelBlockRegistry {
    private static instance: VoxelBlockRegistry | null = null;
    
    private blocks: Map<string, BlockDefinition> = new Map();
    private idToString: string[] = [];          // 内部数字ID到字符串的映射
    private stringToId: Map<string, number> = new Map(); // 字符串到内部ID的映射
    private globalIdCounter: number = 0;
    private initialized: boolean = false;
    
    private constructor() {
        // 私有构造函数，单例模式
    }
    
    static getInstance(): VoxelBlockRegistry {
        if (!VoxelBlockRegistry.instance) {
            VoxelBlockRegistry.instance = new VoxelBlockRegistry();
        }
        return VoxelBlockRegistry.instance;
    }
    
    /**
     * 初始化方块注册表
     */
    initialize(): void {
        if (this.initialized) return;
        
        console.log('[VoxelBlockRegistry] 初始化现代方块注册表...');
        this.registerBuiltinBlocks();
        this.initialized = true;
        console.log(`[VoxelBlockRegistry] 初始化完成，注册了 ${this.blocks.size} 个方块`);
    }
    
    /**
     * 注册内置方块
     */
    private registerBuiltinBlocks(): void {
        // 空气
        this.register({
            id: 'minecraft:air',
            displayName: '空气',
            category: BlockCategory.MISCELLANEOUS,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 0,
                transparent: true,
                luminance: 0,
                flammable: false,
                solid: false,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/air' }
        });
        
        // 石头
        this.register({
            id: 'minecraft:stone',
            displayName: '石头',
            category: BlockCategory.BUILDING,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 1.5,
                transparent: false,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/stone' }
        });
        
        // 泥土
        this.register({
            id: 'minecraft:dirt',
            displayName: '泥土',
            category: BlockCategory.NATURAL,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 0.5,
                transparent: false,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/dirt' }
        });
        
        // 草方块
        this.register({
            id: 'minecraft:grass_block',
            displayName: '草方块',
            category: BlockCategory.NATURAL,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 0.6,
                transparent: false,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: {
                top: 'minecraft:block/grass_block_top',
                bottom: 'minecraft:block/dirt',
                side: 'minecraft:block/grass_block_side'
            }
        });
        
        // 沙子
        this.register({
            id: 'minecraft:sand',
            displayName: '沙子',
            category: BlockCategory.NATURAL,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 0.5,
                transparent: false,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: true
            },
            textures: { all: 'minecraft:block/sand' }
        });
        
        // 鹅卵石
        this.register({
            id: 'minecraft:cobblestone',
            displayName: '鹅卵石',
            category: BlockCategory.BUILDING,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 2.0,
                transparent: false,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/cobblestone' }
        });
        
        // 橡木原木
        this.register({
            id: 'minecraft:oak_log',
            displayName: '橡木原木',
            category: BlockCategory.NATURAL,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 2.0,
                transparent: false,
                luminance: 0,
                flammable: true,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: {
                top: 'minecraft:block/oak_log_top',
                bottom: 'minecraft:block/oak_log_top',
                side: 'minecraft:block/oak_log'
            }
        });
        
        // 橡木木板
        this.register({
            id: 'minecraft:oak_planks',
            displayName: '橡木木板',
            category: BlockCategory.BUILDING,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: 2.0,
                transparent: false,
                luminance: 0,
                flammable: true,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/oak_planks' }
        });
        
        // 橡木叶子
        this.register({
            id: 'minecraft:oak_leaves',
            displayName: '橡木叶子',
            category: BlockCategory.DECORATION,
            renderType: BlockRenderType.CUTOUT,
            properties: {
                hardness: 0.2,
                transparent: true,
                luminance: 0,
                flammable: true,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/oak_leaves' }
        });
        
        // 玻璃
        this.register({
            id: 'minecraft:glass',
            displayName: '玻璃',
            category: BlockCategory.BUILDING,
            renderType: BlockRenderType.TRANSPARENT,
            properties: {
                hardness: 0.3,
                transparent: true,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/glass' }
        });
        
        // 蒲公英
        this.register({
            id: 'minecraft:dandelion',
            displayName: '蒲公英',
            category: BlockCategory.DECORATION,
            renderType: BlockRenderType.CROSS,
            properties: {
                hardness: 0,
                transparent: true,
                luminance: 0,
                flammable: true,
                solid: false,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/dandelion' }
        });
        
        // 虞粟
        this.register({
            id: 'minecraft:poppy',
            displayName: '虞粟',
            category: BlockCategory.DECORATION,
            renderType: BlockRenderType.CROSS,
            properties: {
                hardness: 0,
                transparent: true,
                luminance: 0,
                flammable: true,
                solid: false,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/poppy' }
        });
        
        // 草
        this.register({
            id: 'minecraft:grass',
            displayName: '草',
            category: BlockCategory.DECORATION,
            renderType: BlockRenderType.CROSS,
            properties: {
                hardness: 0,
                transparent: true,
                luminance: 0,
                flammable: true,
                solid: false,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/grass' }
        });
        
        // 萤石
        this.register({
            id: 'minecraft:glowstone',
            displayName: '萤石',
            category: BlockCategory.BUILDING,
            renderType: BlockRenderType.EMISSIVE,
            properties: {
                hardness: 0.3,
                transparent: false,
                luminance: 15,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/glowstone' }
        });
        
        // 基岩
        this.register({
            id: 'minecraft:bedrock',
            displayName: '基岩',
            category: BlockCategory.BUILDING,
            renderType: BlockRenderType.CUBE,
            properties: {
                hardness: -1,  // 不可破坏
                transparent: false,
                luminance: 0,
                flammable: false,
                solid: true,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/bedrock' }
        });
        
        // 水
        this.register({
            id: 'minecraft:water',
            displayName: '水',
            category: BlockCategory.LIQUID,
            renderType: BlockRenderType.LIQUID,
            properties: {
                hardness: 100,  // 特殊值表示液体
                transparent: true,
                luminance: 0,
                flammable: false,
                solid: false,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/water_still' }
        });
        
        // 火把
        this.register({
            id: 'minecraft:torch',
            displayName: '火把',
            category: BlockCategory.DECORATION,
            renderType: BlockRenderType.CROSS,
            properties: {
                hardness: 0,
                transparent: true,
                luminance: 14,
                flammable: false,
                solid: false,
                waterlogged: false,
                gravity: false
            },
            textures: { all: 'minecraft:block/torch' }
        });
    }
    
    /**
     * 注册新方块
     */
    register(definition: BlockDefinition): number {
        if (this.blocks.has(definition.id)) {
            console.warn(`[VoxelBlockRegistry] 方块已存在: ${definition.id}`);
            return this.stringToId.get(definition.id)!;
        }
        
        const globalId = this.globalIdCounter++;
        this.blocks.set(definition.id, definition);
        this.idToString[globalId] = definition.id;
        this.stringToId.set(definition.id, globalId);
        
        console.log(`[VoxelBlockRegistry] 注册方块: ${definition.id} -> globalId:${globalId}`);
        return globalId;
    }
    
    /**
     * 获取方块定义
     */
    getBlock(blockId: string): BlockDefinition | null {
        if (!this.initialized) this.initialize();
        return this.blocks.get(blockId) || null;
    }
    
    /**
     * 检查方块是否存在
     */
    exists(blockId: string): boolean {
        if (!this.initialized) this.initialize();
        return this.blocks.has(blockId);
    }
    
    /**
     * 获取所有方块ID
     */
    getAllBlockIds(): string[] {
        if (!this.initialized) this.initialize();
        return Array.from(this.blocks.keys());
    }
    
    /**
     * 获取所有方块信息
     */
    getAllBlocks(): BlockInfo[] {
        if (!this.initialized) this.initialize();
        const blocks: BlockInfo[] = [];
        
        for (const [id, definition] of this.blocks) {
            blocks.push({
                id,
                displayName: definition.displayName,
                category: definition.category,
                icon: this.getBlockIcon(id),
                properties: definition.properties
            });
        }
        
        return blocks;
    }
    
    /**
     * 根据分类获取方块
     */
    getBlocksByCategory(category: BlockCategory): BlockInfo[] {
        return this.getAllBlocks().filter(block => block.category === category);
    }
    
    /**
     * 搜索方块
     */
    searchBlocks(query: string): BlockInfo[] {
        const lowerQuery = query.toLowerCase();
        return this.getAllBlocks().filter(block => 
            block.displayName.toLowerCase().includes(lowerQuery) ||
            block.id.toLowerCase().includes(lowerQuery)
        );
    }
    
    /**
     * 获取方块图标路径
     */
    getBlockIcon(blockId: string): string {
        const block = this.getBlock(blockId);
        if (!block) return '';
        
        // 优先使用all纹理，否则使用top纹理，最后使用side纹理
        return block.textures.all || 
               block.textures.top || 
               block.textures.side || 
               'minecraft:block/missing_texture';
    }
    
    /**
     * 内部方法：根据globalId获取方块ID
     * 仅供系统内部使用，不对外暴露
     */
    getBlockIdByGlobalId(globalId: number): string {
        return this.idToString[globalId] || 'minecraft:air';
    }
    
    /**
     * 内部方法：根据方块ID获取globalId
     * 仅供系统内部使用，不对外暴露
     */
    getGlobalIdByBlockId(blockId: string): number {
        return this.stringToId.get(blockId) || 0; // 0对应minecraft:air
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            totalBlocks: this.blocks.size,
            categories: this.getCategoryCounts(),
            renderTypes: this.getRenderTypeCounts()
        };
    }
    
    private getCategoryCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const block of this.blocks.values()) {
            counts[block.category] = (counts[block.category] || 0) + 1;
        }
        return counts;
    }
    
    private getRenderTypeCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const block of this.blocks.values()) {
            counts[block.renderType] = (counts[block.renderType] || 0) + 1;
        }
        return counts;
    }
    
    /**
     * 清理注册表（测试用）
     */
    clear(): void {
        this.blocks.clear();
        this.idToString = [];
        this.stringToId.clear();
        this.globalIdCounter = 0;
        this.initialized = false;
    }
}

// 导出单例实例
export const BlockRegistry = VoxelBlockRegistry.getInstance();

// 导出便捷函数
export function getBlock(blockId: string): BlockDefinition | null {
    return BlockRegistry.getBlock(blockId);
}

export function blockExists(blockId: string): boolean {
    return BlockRegistry.exists(blockId);
}

export function getAllBlocks(): BlockInfo[] {
    return BlockRegistry.getAllBlocks();
}

export function getBlocksByCategory(category: BlockCategory): BlockInfo[] {
    return BlockRegistry.getBlocksByCategory(category);
}

// 初始化注册表
BlockRegistry.initialize();