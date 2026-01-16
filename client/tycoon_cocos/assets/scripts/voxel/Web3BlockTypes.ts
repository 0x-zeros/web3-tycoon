/**
 * Web3大富翁游戏方块类型定义
 */

// 地块类型枚举（0-99）
export enum Web3TileType {
    EMPTY_LAND = 0,      // 空地/路径
    LOTTERY = 1,         // 乐透
    HOSPITAL = 2,        // 医院
    CHANCE = 3,          // 机会
    BONUS = 4,           // 奖励
    FEE = 5,             // 费用
    CARD = 6,            // 卡片
    NEWS = 7,            // 新闻
    CARD_SHOP = 8,       // 卡片商店
}

// NPC和路面物体枚举（100-199）
export enum Web3ObjectType {
    LAND_GOD = 100,        // 土地神
    WEALTH_GOD = 101,      // 财神
    FORTUNE_GOD = 102,     // 福神
    DOG = 103,             // 狗狗
    POVERTY_GOD = 104,     // 穷神
    ROADBLOCK = 105,       // 路障
    BOMB = 106,            // 炸弹
}

// Building（建筑）枚举（200-255）
export enum Web3BuildingType {
    BUILDING_1X1 = 200,    // 小型建筑（1x1）
    BUILDING_2X2 = 201,    // 大型建筑（2x2）
}

// 建筑功能类型（购买后选择，不影响地图生成）
export enum BuildingFunctionType {
    TEMPLE = 301,          // 土地庙
    RESEARCH = 302,        // 研究所
    OIL_COMPANY = 303,     // 石油公司
    COMMERCIAL = 304,      // 商业中心
    HOTEL = 305,           // 大饭店
}

// Decoration（装饰）枚举（300-399）
export enum Web3DecorationType {
    DANDELION = 300,       // 蒲公英
    POPPY = 301,           // 虞粟
    SHORT_GRASS = 302,     // 矮草
    FERN = 303,            // 蕨
    GLOW_LICHEN = 304,     // 荧光地衣
    GLOW_BERRIES = 305,    // 发光浆果
}

// Web3方块信息接口
export interface Web3BlockInfo {
    id: string;           // 方块ID，如 'web3:empty_land'
    name: string;         // 显示名称
    category: 'tile' | 'object' | 'building' | 'decoration';  // 类别：地块、物体、建筑或装饰
    typeId: number;       // 类型ID（0-399）
    description?: string; // 描述
    size?: 1 | 2;        // 尺寸（仅building使用）
}

// Web3方块定义
export const WEB3_BLOCKS: Web3BlockInfo[] = [
    // ========== 地块类型 (0-99) ==========
    {
        id: 'web3:empty_land',
        name: '空地',
        category: 'tile',
        typeId: Web3TileType.EMPTY_LAND,
        description: '空地块，无法购买'
    },
    {
        id: 'web3:lottery',
        name: '乐透',
        category: 'tile',
        typeId: Web3TileType.LOTTERY,
        description: '乐透格子，触发抽奖'
    },
    {
        id: 'web3:hospital',
        name: '医院',
        category: 'tile',
        typeId: Web3TileType.HOSPITAL,
        description: '停留N回合'
    },
    {
        id: 'web3:chance',
        name: '机会',
        category: 'tile',
        typeId: Web3TileType.CHANCE,
        description: '触发随机事件'
    },
    {
        id: 'web3:bonus',
        name: '奖励',
        category: 'tile',
        typeId: Web3TileType.BONUS,
        description: '获得金钱奖励'
    },
    {
        id: 'web3:fee',
        name: '费用',
        category: 'tile',
        typeId: Web3TileType.FEE,
        description: '支付费用'
    },
    {
        id: 'web3:card',
        name: '卡片',
        category: 'tile',
        typeId: Web3TileType.CARD,
        description: '获得随机卡片'
    },
    {
        id: 'web3:news',
        name: '新闻',
        category: 'tile',
        typeId: Web3TileType.NEWS,
        description: '触发全局新闻事件'
    },
    {
        id: 'web3:card_shop',
        name: '卡片商店',
        category: 'tile',
        typeId: Web3TileType.CARD_SHOP,
        description: '打开卡片商店购买卡片'
    },

    // ========== NPC和路面物体 (100-255) ==========
    {
        id: 'web3:land_god',
        name: '土地神',
        category: 'object',
        typeId: Web3ObjectType.LAND_GOD,
        description: '增益型NPC'
    },
    {
        id: 'web3:wealth_god',
        name: '财神',
        category: 'object',
        typeId: Web3ObjectType.WEALTH_GOD,
        description: '增益型NPC'
    },
    {
        id: 'web3:fortune_god',
        name: '福神',
        category: 'object',
        typeId: Web3ObjectType.FORTUNE_GOD,
        description: '增益型NPC'
    },
    {
        id: 'web3:dog',
        name: '狗狗',
        category: 'object',
        typeId: Web3ObjectType.DOG,
        description: '干扰型NPC'
    },
    {
        id: 'web3:poverty_god',
        name: '穷神',
        category: 'object',
        typeId: Web3ObjectType.POVERTY_GOD,
        description: '干扰型NPC'
    },
    {
        id: 'web3:roadblock',
        name: '路障',
        category: 'object',
        typeId: Web3ObjectType.ROADBLOCK,
        description: '阻挡移动的路面物体'
    },
    {
        id: 'web3:bomb',
        name: '炸弹',
        category: 'object',
        typeId: Web3ObjectType.BOMB,
        description: '爆炸伤害的路面物体'
    },

    // ========== Building建筑类型 (200-255) ==========
    {
        id: 'web3:building_1x1',
        name: '小型建筑',
        category: 'building',
        typeId: Web3BuildingType.BUILDING_1X1,
        description: '1x1的基础建筑（lv0）',
        size: 1
    },
    {
        id: 'web3:building_2x2',
        name: '大型建筑',
        category: 'building',
        typeId: Web3BuildingType.BUILDING_2X2,
        description: '2x2的基础建筑（lv0）',
        size: 2
    },

    // ========== 装饰类型 (300-399) ==========
    {
        id: 'web3:deco_dandelion',
        name: '蒲公英',
        category: 'decoration',
        typeId: Web3DecorationType.DANDELION,
        description: '装饰用的蒲公英'
    },
    {
        id: 'web3:deco_poppy',
        name: '虞美人',
        category: 'decoration',
        typeId: Web3DecorationType.POPPY,
        description: '装饰用的虞美人花'
    },
    {
        id: 'web3:deco_short_grass',
        name: '矮草',
        category: 'decoration',
        typeId: Web3DecorationType.SHORT_GRASS,
        description: '装饰用的矮草'
    },
    {
        id: 'web3:deco_fern',
        name: '蕨类',
        category: 'decoration',
        typeId: Web3DecorationType.FERN,
        description: '装饰用的蕨类植物'
    },
    {
        id: 'web3:deco_glow_lichen',
        name: '荧光地衣',
        category: 'decoration',
        typeId: Web3DecorationType.GLOW_LICHEN,
        description: '装饰用的发光地衣'
    },
    {
        id: 'web3:deco_glow_berries',
        name: '发光浆果',
        category: 'decoration',
        typeId: Web3DecorationType.GLOW_BERRIES,
        description: '装饰用的发光浆果'
    }
];

// 获取所有Web3方块ID
export function getAllWeb3BlockIds(): string[] {
    return WEB3_BLOCKS.map(block => block.id);
}

// 获取地块类型方块
export function getWeb3TileBlocks(): Web3BlockInfo[] {
    return WEB3_BLOCKS.filter(block => block.category === 'tile');
}

// 获取物体类型方块
export function getWeb3ObjectBlocks(): Web3BlockInfo[] {
    return WEB3_BLOCKS.filter(block => block.category === 'object');
}

// 获取Building类型方块
export function getWeb3BuildingBlocks(): Web3BlockInfo[] {
    return WEB3_BLOCKS.filter(block => block.category === 'building');
}


// 获取装饰类型方块
export function getWeb3DecorationBlocks(): Web3BlockInfo[] {
    return WEB3_BLOCKS.filter(block => block.category === 'decoration');
}

// 根据ID获取方块信息
export function getWeb3BlockById(id: string): Web3BlockInfo | undefined {
    return WEB3_BLOCKS.find(block => block.id === id);
}

// 根据typeId获取方块信息
export function getWeb3BlockByTypeId(typeId: number): Web3BlockInfo | undefined {
    return WEB3_BLOCKS.find(block => block.typeId === typeId);
}

// 根据blockId获取Web3方块信息
export function getWeb3BlockByBlockId(blockId: string): Web3BlockInfo | undefined {
    return WEB3_BLOCKS.find(block => block.id === blockId);
}

// 判断是否为物体类型（支持blockId字符串或typeId数字）
export function isWeb3Object(blockIdOrTypeId: string | number): boolean {
    if (typeof blockIdOrTypeId === 'string') {
        const block = getWeb3BlockByBlockId(blockIdOrTypeId);
        return block ? block.category === 'object' : false;
    } else {
        // typeId 100-199 是物体类型（避免与200-255的Property重叠）
        return blockIdOrTypeId >= 100 && blockIdOrTypeId <= 199;
    }
}

// 判断是否为地块类型（支持blockId字符串或typeId数字）
export function isWeb3Tile(blockIdOrTypeId: string | number): boolean {
    if (typeof blockIdOrTypeId === 'string') {
        const block = getWeb3BlockByBlockId(blockIdOrTypeId);
        return block ? block.category === 'tile' : false;
    } else {
        // typeId 0-99 是地块类型
        return blockIdOrTypeId >= 0 && blockIdOrTypeId <= 99;
    }
}

// 判断是否为Building类型（支持blockId字符串或typeId数字）
export function isWeb3Building(blockIdOrTypeId: string | number): boolean {
    if (typeof blockIdOrTypeId === 'string') {
        const block = getWeb3BlockByBlockId(blockIdOrTypeId);
        return block ? block.category === 'building' : false;
    } else {
        // typeId 200-255 是Building类型
        return blockIdOrTypeId >= 200 && blockIdOrTypeId <= 255;
    }
}


// 获取Building的尺寸
export function getBuildingSize(blockId: string): number {
    const block = getWeb3BlockByBlockId(blockId);
    return block?.size || 1;
}

