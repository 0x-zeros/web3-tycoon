/**
 * Web3大富翁游戏方块类型定义
 */

// 地块类型枚举（0-99）
export enum Web3TileType {
    EMPTY_LAND = 0,    // 空地
    PROPERTY = 1,      // 地产
    HOSPITAL = 2,      // 医院
    CHANCE = 3,        // 机会
    BONUS = 4,         // 奖励
    FEE = 5,           // 费用
    CARD = 6,          // 卡片
    NEWS = 7,          // 新闻
}

// NPC和路面物体枚举（100-255）
export enum Web3ObjectType {
    LAND_GOD = 100,        // 土地神
    WEALTH_GOD = 101,      // 财神
    FORTUNE_GOD = 102,     // 福神
    DOG = 103,             // 狗狗
    POVERTY_GOD = 104,     // 穷神
    ROADBLOCK = 105,       // 路障
    BOMB = 106,            // 炸弹
}

// Web3方块信息接口
export interface Web3BlockInfo {
    id: string;           // 方块ID，如 'web3:empty_land'
    name: string;         // 显示名称
    category: 'tile' | 'object';  // 类别：地块或物体
    typeId: number;       // 类型ID（0-255）
    description?: string; // 描述
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
        id: 'web3:property',
        name: '地产',
        category: 'tile',
        typeId: Web3TileType.PROPERTY,
        description: '可购买并升级的地产'
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
        // typeId >= 100 是物体类型
        return blockIdOrTypeId >= 100 && blockIdOrTypeId <= 255;
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
