import { Web3TileType, Web3ObjectType, Web3PropertyType } from '../Web3BlockTypes';

// 保留兼容性的方块类型枚举（旧系统）
export enum VoxelBlockType {
    EMPTY = 0,
    GRASS = 1,
    SAND = 2,
    STONE = 3,
    BRICK = 4,
    WOOD = 5,
    CEMENT = 6,
    DIRT = 7,
    PLANK = 8,
    SNOW = 9,
    GLASS = 10,
    COBBLE = 11,
    LIGHT_STONE = 12,
    DARK_STONE = 13,
    CHEST = 14,
    LEAVES = 15,
    CLOUD = 16,
    TALL_GRASS = 17,
    YELLOW_FLOWER = 18,
    RED_FLOWER = 19,
    PURPLE_FLOWER = 20,
    SUN_FLOWER = 21,
    WHITE_FLOWER = 22,
    BLUE_FLOWER = 23,
    COLOR_00 = 32,
    COLOR_01 = 33,
    COLOR_02 = 34,
    COLOR_03 = 35,
    COLOR_04 = 36,
    COLOR_05 = 37,
    COLOR_06 = 38,
    COLOR_07 = 39,
    COLOR_08 = 40,
    COLOR_09 = 41,
    COLOR_10 = 42,
    COLOR_11 = 43,
    COLOR_12 = 44,
    COLOR_13 = 45,
    COLOR_14 = 46,
    COLOR_15 = 47,
    COLOR_16 = 48,
    COLOR_17 = 49,
    COLOR_18 = 50,
    COLOR_19 = 51,
    COLOR_20 = 52,
    COLOR_21 = 53,
    COLOR_22 = 54,
    COLOR_23 = 55,
    COLOR_24 = 56,
    COLOR_25 = 57,
    COLOR_26 = 58,
    COLOR_27 = 59,
    COLOR_28 = 60,
    COLOR_29 = 61,
    COLOR_30 = 62,
    COLOR_31 = 63
}

// 新的方块定义接口
export interface BlockDefinition {
    id: string;                    // 方块ID，如 "minecraft:stone"
    displayName: string;           // 显示名称
    isPlant: boolean;              // 是否为植物
    isObstacle: boolean;           // 是否为障碍物
    isDestructable: boolean;       // 是否可破坏
    lightLevel: number;            // 发光等级 (0-15)
    hardness: number;              // 硬度
    renderType: BlockRenderType;   // 渲染类型
    properties?: { [key: string]: any }; // 自定义属性
}

export enum BlockRenderType {
    SOLID = 'solid',               // 不透明实体方块
    CUTOUT = 'cutout',             // 裁切透明（如叶子、玻璃）
    TRANSLUCENT = 'translucent',   // 半透明（如水、冰）
    LIQUID = 'liquid'              // 液体
}

export interface VoxelBlockProperties {
    isPlant: boolean;
    isObstacle: boolean;
    isDestructable: boolean;
    textureTop: number;
    textureBottom: number;
    textureSide: number;
    lightLevel: number;
}

// 新的方块注册表类（支持字符串ID）
export class BlockRegistry {
    private static blockDefinitions: Map<string, BlockDefinition> = new Map();
    private static legacyMapping: Map<VoxelBlockType, string> = new Map(); // 旧系统映射
    private static initialized: boolean = false;

    static initialize(): void {
        if (this.initialized) return;
        
        console.log('[BlockRegistry] 初始化方块注册表...');
        
        // 注册基础方块
        this.registerMinecraftBlocks();

        // 注册 Web3 方块
        this.registerWeb3Blocks();
        
        // 建立旧系统兼容映射
        this.createLegacyMapping();
        
        this.initialized = true;
        console.log(`[BlockRegistry] 初始化完成，共注册 ${this.blockDefinitions.size} 个方块`);
    }

    private static registerMinecraftBlocks(): void {
        // 空气
        this.register({
            id: 'minecraft:air',
            displayName: '空气',
            isPlant: false,
            isObstacle: false,
            isDestructable: false,
            lightLevel: 0,
            hardness: 0,
            renderType: BlockRenderType.TRANSLUCENT
        });

        // 石头
        this.register({
            id: 'minecraft:stone',
            displayName: '石头',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 1.5,
            renderType: BlockRenderType.SOLID
        });

        // 泥土
        this.register({
            id: 'minecraft:dirt',
            displayName: '泥土',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0.5,
            renderType: BlockRenderType.SOLID
        });

        // 草方块
        this.register({
            id: 'minecraft:grass_block',
            displayName: '草方块',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0.6,
            renderType: BlockRenderType.SOLID
        });

        // 沙子
        this.register({
            id: 'minecraft:sand',
            displayName: '沙子',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0.5,
            renderType: BlockRenderType.SOLID
        });

        // 鹅卵石
        this.register({
            id: 'minecraft:cobblestone',
            displayName: '鹅卵石',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 2.0,
            renderType: BlockRenderType.SOLID
        });

        // 橡木原木
        this.register({
            id: 'minecraft:oak_log',
            displayName: '橡木原木',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 2.0,
            renderType: BlockRenderType.SOLID
        });

        // 橡木木板
        this.register({
            id: 'minecraft:oak_planks',
            displayName: '橡木木板',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 2.0,
            renderType: BlockRenderType.SOLID
        });

        // 橡木叶子
        this.register({
            id: 'minecraft:oak_leaves',
            displayName: '橡木叶子',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0.2,
            renderType: BlockRenderType.CUTOUT
        });

        // 玻璃
        this.register({
            id: 'minecraft:glass',
            displayName: '玻璃',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0.3,
            renderType: BlockRenderType.TRANSLUCENT
        });

        // 蒲公英（植物）
        this.register({
            id: 'minecraft:dandelion',
            displayName: '蒲公英',
            isPlant: true,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });

        // 虞粟（植物）
        this.register({
            id: 'minecraft:poppy',
            displayName: '虞粟',
            isPlant: true,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });

        // 矮草（植物）
        this.register({
            id: 'minecraft:short_grass',
            displayName: '草',
            isPlant: true,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });

        // 蕨（植物）
        this.register({
            id: 'minecraft:fern',
            displayName: '蕨',
            isPlant: true,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 0,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });

        // ========== 发光方块 ==========
        
        // 萤石
        this.register({
            id: 'minecraft:glowstone',
            displayName: '萤石',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 0.3,
            renderType: BlockRenderType.SOLID
        });

        // 火把
        this.register({
            id: 'minecraft:torch',
            displayName: '火把',
            isPlant: false,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 14,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });

        // 灯笼
        this.register({
            id: 'minecraft:lantern',
            displayName: '灯笼',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 3.5,
            renderType: BlockRenderType.SOLID
        });

        // 海晶灯
        this.register({
            id: 'minecraft:sea_lantern',
            displayName: '海晶灯',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 0.3,
            renderType: BlockRenderType.SOLID
        });

        // 南瓜灯
        this.register({
            id: 'minecraft:jack_o_lantern',
            displayName: '南瓜灯',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 1.0,
            renderType: BlockRenderType.SOLID
        });

        // 红石灯
        this.register({
            id: 'minecraft:redstone_lamp',
            displayName: '红石灯',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 0.3,
            renderType: BlockRenderType.SOLID
        });

        // 营火
        this.register({
            id: 'minecraft:campfire',
            displayName: '营火',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 2.0,
            renderType: BlockRenderType.SOLID
        });

        // 端烛
        this.register({
            id: 'minecraft:end_rod',
            displayName: '末地烛',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 14,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });

        // 信标
        this.register({
            id: 'minecraft:beacon',
            displayName: '信标',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 15,
            hardness: 3.0,
            renderType: BlockRenderType.SOLID
        });

        // 蜂蜜块（弱发光）
        this.register({
            id: 'minecraft:honey_block',
            displayName: '蜂蜜块',
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            lightLevel: 3,
            hardness: 0,
            renderType: BlockRenderType.TRANSLUCENT
        });

        // 荧光地衣
        this.register({
            id: 'minecraft:glow_lichen',
            displayName: '荧光地衣',
            isPlant: true,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 7,
            hardness: 0.2,
            renderType: BlockRenderType.CUTOUT
        });

        // 发光浆果
        this.register({
            id: 'minecraft:glow_berries',
            displayName: '发光浆果',
            isPlant: true,
            isObstacle: false,
            isDestructable: true,
            lightLevel: 14,
            hardness: 0,
            renderType: BlockRenderType.CUTOUT
        });
    
    }

/**
 * 注册所有 Web3 方块到方块注册表
 */
 private static registerWeb3Blocks(): void {
    console.log('[Web3BlockTypes] 开始注册 Web3 方块...');
    
    // ========== 地块类型 (Tiles) ==========
    
    // 空地
    this.register({
        id: 'web3:empty_land',
        displayName: '空地',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.SOLID,
        properties: {
            typeId: Web3TileType.EMPTY_LAND,
            category: 'tile',
            description: '空地块，无法购买'
        }
    });
    
    // 地产
    this.register({
        id: 'web3:property',
        displayName: '地产',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.SOLID,
        properties: {
            typeId: Web3TileType.PROPERTY,
            category: 'tile',
            description: '可购买并升级的地产'
        }
    });
    
    // 医院
    this.register({
        id: 'web3:hospital',
        displayName: '医院',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.SOLID,
        properties: {
            typeId: Web3TileType.HOSPITAL,
            category: 'tile',
            description: '停留N回合'
        }
    });
    
    // 机会
    this.register({
        id: 'web3:chance',
        displayName: '机会',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3TileType.CHANCE,
            category: 'tile',
            description: '触发随机事件'
        }
    });
    
    // 奖励
    this.register({
        id: 'web3:bonus',
        displayName: '奖励',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.SOLID,
        properties: {
            typeId: Web3TileType.BONUS,
            category: 'tile',
            description: '获得金钱奖励'
        }
    });
    
    // 费用
    this.register({
        id: 'web3:fee',
        displayName: '费用',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.SOLID,
        properties: {
            typeId: Web3TileType.FEE,
            category: 'tile',
            description: '支付费用'
        }
    });
    
    // 卡片
    this.register({
        id: 'web3:card',
        displayName: '卡片',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.SOLID,
        properties: {
            typeId: Web3TileType.CARD,
            category: 'tile',
            description: '获得随机卡片'
        }
    });
    
    // 新闻
    this.register({
        id: 'web3:news',
        displayName: '新闻',
        isPlant: false,
        isObstacle: true,
        isDestructable: false,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3TileType.NEWS,
            category: 'tile',
            description: '触发全局新闻事件'
        }
    });
    
    // ========== NPC和路面物体 (Objects) ==========
    
    // 土地神
    this.register({
        id: 'web3:land_god',
        displayName: '土地神',
        isPlant: true,  // 物体类型类似植物渲染
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.LAND_GOD,
            category: 'object',
            description: '增益型NPC'
        }
    });
    
    // 财神
    this.register({
        id: 'web3:wealth_god',
        displayName: '财神',
        isPlant: true,
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.WEALTH_GOD,
            category: 'object',
            description: '增益型NPC'
        }
    });
    
    // 福神
    this.register({
        id: 'web3:fortune_god',
        displayName: '福神',
        isPlant: true,
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.FORTUNE_GOD,
            category: 'object',
            description: '增益型NPC'
        }
    });
    
    // 狗狗
    this.register({
        id: 'web3:dog',
        displayName: '狗狗',
        isPlant: true,
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.DOG,
            category: 'object',
            description: '干扰型NPC'
        }
    });
    
    // 穷神
    this.register({
        id: 'web3:poverty_god',
        displayName: '穷神',
        isPlant: true,
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.POVERTY_GOD,
            category: 'object',
            description: '干扰型NPC'
        }
    });
    
    // 路障
    this.register({
        id: 'web3:roadblock',
        displayName: '路障',
        isPlant: true,
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.ROADBLOCK,
            category: 'object',
            description: '阻挡移动的路面物体'
        }
    });
    
    // 炸弹
    this.register({
        id: 'web3:bomb',
        displayName: '炸弹',
        isPlant: true,
        isObstacle: false,
        isDestructable: true,
        lightLevel: 0,
        hardness: 0,
        renderType: BlockRenderType.CUTOUT,
        properties: {
            typeId: Web3ObjectType.BOMB,
            category: 'object',
            description: '爆炸伤害的路面物体'
        }
    });
    
    // ========== Property（地产）类型 (Properties) ==========

    // 小型地产（1x1）
    this.register({
        id: 'web3:property_small',
        displayName: '小型地产',
        isPlant: false,
        isObstacle: true,
        isDestructable: true,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3PropertyType.PROPERTY_1X1,
            category: 'property',
            description: '1x1的可购买地产'
        }
    });

    // 土地庙（2x2）
    this.register({
        id: 'web3:temple',
        displayName: '土地庙',
        isPlant: false,
        isObstacle: true,
        isDestructable: true,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3PropertyType.TEMPLE_2X2,
            category: 'property',
            description: '2x2的土地庙，影响周围地块租金'
        }
    });

    // 研究所（2x2）
    this.register({
        id: 'web3:research',
        displayName: '研究所',
        isPlant: false,
        isObstacle: true,
        isDestructable: true,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3PropertyType.RESEARCH_2X2,
            category: 'property',
            description: '2x2的研究所'
        }
    });

    // 石油公司（2x2）
    this.register({
        id: 'web3:oil_company',
        displayName: '石油公司',
        isPlant: false,
        isObstacle: true,
        isDestructable: true,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3PropertyType.OIL_2X2,
            category: 'property',
            description: '2x2的石油公司'
        }
    });

    // 商业中心（2x2）
    this.register({
        id: 'web3:commercial',
        displayName: '商业中心',
        isPlant: false,
        isObstacle: true,
        isDestructable: true,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3PropertyType.COMMERCIAL_2X2,
            category: 'property',
            description: '2x2的商业中心'
        }
    });

    // 大饭店（2x2）
    this.register({
        id: 'web3:hotel',
        displayName: '大饭店',
        isPlant: false,
        isObstacle: true,
        isDestructable: true,
        lightLevel: 0,
        hardness: 1.0,
        renderType: BlockRenderType.TRANSLUCENT,
        properties: {
            typeId: Web3PropertyType.HOTEL_2X2,
            category: 'property',
            description: '2x2的大饭店'
        }
    });

    console.log('[Web3BlockTypes] 成功注册 21 个 Web3 方块');
}


    private static createLegacyMapping(): void {
        // 建立旧枚举到新ID的映射
        this.legacyMapping.set(VoxelBlockType.EMPTY, 'minecraft:air');
        this.legacyMapping.set(VoxelBlockType.STONE, 'minecraft:stone');
        this.legacyMapping.set(VoxelBlockType.DIRT, 'minecraft:dirt');
        this.legacyMapping.set(VoxelBlockType.GRASS, 'minecraft:grass_block');
        this.legacyMapping.set(VoxelBlockType.SAND, 'minecraft:sand');
        this.legacyMapping.set(VoxelBlockType.COBBLE, 'minecraft:cobblestone');
        this.legacyMapping.set(VoxelBlockType.WOOD, 'minecraft:oak_log');
        this.legacyMapping.set(VoxelBlockType.PLANK, 'minecraft:oak_planks');
        this.legacyMapping.set(VoxelBlockType.LEAVES, 'minecraft:oak_leaves');
        this.legacyMapping.set(VoxelBlockType.GLASS, 'minecraft:glass');
        this.legacyMapping.set(VoxelBlockType.YELLOW_FLOWER, 'minecraft:dandelion');
        this.legacyMapping.set(VoxelBlockType.RED_FLOWER, 'minecraft:poppy');
        this.legacyMapping.set(VoxelBlockType.TALL_GRASS, 'minecraft:short_grass');
    }

    /**
     * 注册方块定义
     */
    static register(definition: BlockDefinition): void {
        this.blockDefinitions.set(definition.id, definition);
        console.log(`[BlockRegistry] 注册方块: ${definition.id} (${definition.displayName})`);
    }

    /**
     * 获取方块定义
     */
    static getBlock(blockId: string): BlockDefinition | undefined {
        if (!this.initialized) this.initialize();
        return this.blockDefinitions.get(blockId);
    }

    /**
     * 获取所有已注册的方块ID
     */
    static getAllBlockIds(): string[] {
        if (!this.initialized) this.initialize();
        return Array.from(this.blockDefinitions.keys());
    }

    /**
     * 旧系统兼容：从枚举转换为ID
     */
    static fromLegacyType(legacyType: VoxelBlockType): string {
        if (!this.initialized) this.initialize();
        return this.legacyMapping.get(legacyType) || 'minecraft:air';
    }

    /**
     * 旧系统兼容：从 ID 转换为枚举
     */
    static toLegacyType(blockId: string): VoxelBlockType {
        if (!this.initialized) this.initialize();
        for (const [type, id] of this.legacyMapping) {
            if (id === blockId) return type;
        }
        return VoxelBlockType.EMPTY;
    }

    /**
     * 检查方块是否存在
     */
    static exists(blockId: string): boolean {
        if (!this.initialized) this.initialize();
        return this.blockDefinitions.has(blockId);
    }

    /**
     * 获取方块属性方法（新API）
     */
    static isPlant(blockId: string): boolean {
        const block = this.getBlock(blockId);
        return block ? block.isPlant : false;
    }

    static isObstacle(blockId: string): boolean {
        const block = this.getBlock(blockId);
        return block ? block.isObstacle : false;
    }

    static isTransparent(blockId: string): boolean {
        const block = this.getBlock(blockId);
        if (!block) return true;
        // SOLID 类型的方块不透明，其他类型都是透明的
        return block.renderType !== BlockRenderType.SOLID;
    }

    static isDestructable(blockId: string): boolean {
        const block = this.getBlock(blockId);
        return block ? block.isDestructable : false;
    }

    static getLightLevel(blockId: string): number {
        const block = this.getBlock(blockId);
        return block ? block.lightLevel : 0;
    }

    static getHardness(blockId: string): number {
        const block = this.getBlock(blockId);
        return block ? block.hardness : 0;
    }

    static getRenderType(blockId: string): BlockRenderType {
        const block = this.getBlock(blockId);
        return block ? block.renderType : BlockRenderType.SOLID;
    }
}

// 旧的 VoxelBlockRegistry （保留兼容性）
export class VoxelBlockRegistry {
    private static blockProperties: Map<VoxelBlockType, VoxelBlockProperties> = new Map();
    private static _initialized: boolean = false;
    
    private static readonly items: VoxelBlockType[] = [
        VoxelBlockType.GRASS,
        VoxelBlockType.SAND,
        VoxelBlockType.STONE,
        VoxelBlockType.BRICK,
        VoxelBlockType.WOOD,
        VoxelBlockType.CEMENT,
        VoxelBlockType.DIRT,
        VoxelBlockType.PLANK,
        VoxelBlockType.SNOW,
        VoxelBlockType.GLASS,
        VoxelBlockType.COBBLE,
        VoxelBlockType.LIGHT_STONE,
        VoxelBlockType.DARK_STONE,
        VoxelBlockType.CHEST,
        VoxelBlockType.LEAVES
    ];

    private static readonly plants: Set<VoxelBlockType> = new Set([
        VoxelBlockType.TALL_GRASS,
        VoxelBlockType.YELLOW_FLOWER,
        VoxelBlockType.RED_FLOWER,
        VoxelBlockType.PURPLE_FLOWER,
        VoxelBlockType.SUN_FLOWER,
        VoxelBlockType.WHITE_FLOWER,
        VoxelBlockType.BLUE_FLOWER
    ]);

    // static { this.initializeBlocks(); }
    public static initialize(): void {
        this.ensureInitialized();
    }

    private static ensureInitialized(): void {
        if (this._initialized) return;
        this.initializeBlocks();
        this._initialized = true;
    }

    private static initializeBlocks(): void {
        this.blockProperties.set(VoxelBlockType.EMPTY, {
            isPlant: false,
            isObstacle: false,
            isDestructable: false,
            textureTop: 0,
            textureBottom: 0,
            textureSide: 0,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.GRASS, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 0,
            textureBottom: 2,
            textureSide: 1,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.SAND, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 18,
            textureBottom: 18,
            textureSide: 18,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.STONE, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 32,
            textureBottom: 32,
            textureSide: 32,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.WOOD, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 21,
            textureBottom: 21,
            textureSide: 20,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.LEAVES, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 22,
            textureBottom: 22,
            textureSide: 22,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.GLASS, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 49,
            textureBottom: 49,
            textureSide: 49,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.CLOUD, {
            isPlant: false,
            isObstacle: false,
            isDestructable: false,
            textureTop: 14,
            textureBottom: 14,
            textureSide: 14,
            lightLevel: 0
        });

        this.blockProperties.set(VoxelBlockType.LIGHT_STONE, {
            isPlant: false,
            isObstacle: true,
            isDestructable: true,
            textureTop: 35,
            textureBottom: 35,
            textureSide: 35,
            lightLevel: 10
        });

        this.plants.forEach(plantType => {
            this.blockProperties.set(plantType, {
                isPlant: true,
                isObstacle: false,
                    isDestructable: true,
                textureTop: plantType,
                textureBottom: plantType,
                textureSide: plantType,
                lightLevel: 0
            });
        });
    }

    static isPlant(blockType: VoxelBlockType): boolean {
        this.ensureInitialized();
        const props = this.blockProperties.get(blockType);
        return props ? props.isPlant : false;
    }

    static isObstacle(blockType: VoxelBlockType): boolean {
        this.ensureInitialized();
        const props = this.blockProperties.get(blockType);
        return props ? props.isObstacle : false;
    }

    static isTransparent(blockType: VoxelBlockType): boolean {
        this.ensureInitialized();
        // 对于旧系统，简单地判断是否为特定类型
        // 玻璃和叶子是透明的
        return blockType === VoxelBlockType.GLASS || blockType === VoxelBlockType.LEAVES;
    }

    static isDestructable(blockType: VoxelBlockType): boolean {
        this.ensureInitialized();
        const props = this.blockProperties.get(blockType);
        return props ? props.isDestructable : false;
    }

    static getTextureIndex(blockType: VoxelBlockType, faceIndex: number): number {
        this.ensureInitialized();
        const props = this.blockProperties.get(blockType);
        if (!props) return 0;

        switch (faceIndex) {
            case 0: return props.textureTop;    // top
            case 1: return props.textureBottom; // bottom
            default: return props.textureSide;  // sides
        }
    }

    static getLightLevel(blockType: VoxelBlockType): number {
        this.ensureInitialized();
        const props = this.blockProperties.get(blockType);
        return props ? props.lightLevel : 0;
    }

    static getItems(): VoxelBlockType[] {
        this.ensureInitialized();
        return [...this.items];
    }

    static getItemCount(): number {
        this.ensureInitialized();
        return this.items.length;
    }

    static isValidBlockType(blockType: number): blockType is VoxelBlockType {
        this.ensureInitialized();
        return this.blockProperties.has(blockType as VoxelBlockType);
    }

    static getBlockProperties(blockType: VoxelBlockType): VoxelBlockProperties | undefined {
        this.ensureInitialized();
        return this.blockProperties.get(blockType);
    }

    static registerCustomBlock(blockType: VoxelBlockType, properties: VoxelBlockProperties): void {
        this.ensureInitialized();
        this.blockProperties.set(blockType, properties);
    }
}

// 初始化方块注册表
BlockRegistry.initialize();
VoxelBlockRegistry.initialize();
