/**
 * 地图数据类型定义
 * 
 * 定义地图保存和加载所需的数据结构
 * 支持编辑器模式和游戏模式的地图数据
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Web3TileType, Web3ObjectType, Web3BuildingType } from '../../voxel/Web3BlockTypes';

/**
 * 地块数据
 */
export interface TileData {
    /** 方块ID，如 "web3:property_tile" */
    blockId: string;
    /** 类型ID (Web3TileType) */
    typeId: number;
    /** 网格位置 */
    position: {
        x: number;
        z: number;
    };
    /** 扩展数据 */
    data?: {
        /** Tile编号（u16最大值65535表示无效） */
        tileId?: number;
        /** 拥有者 */
        owner?: string;
        /** 建筑等级 (0-4: 空地,小屋,洋房,大楼,地标) */
        level?: number;
        /** 地产价格 */
        price?: number;
        /** 租金设置 */
        rent?: number[];
        /** 是否被抵押 */
        mortgaged?: boolean;
        /** 自定义数据 */
        custom?: any;
    };
}

/**
 * 物体数据
 */
export interface ObjectData {
    /** 方块ID，如 "web3:land_god" */
    blockId: string;
    /** 类型ID (Web3ObjectType) */
    typeId: number;
    /** 网格位置 */
    position: {
        x: number;
        z: number;
    };
    /** 扩展数据 */
    data?: {
        /** 当前动画 */
        animation?: string;
        /** 状态 */
        state?: string;
        /** 拥有者（如果是玩家放置的） */
        owner?: string;
        /** 剩余回合数（如路障） */
        remainingTurns?: number;
        /** 自定义数据 */
        custom?: any;
    };
}

/**
 * 游戏规则配置
 */
export interface GameRules {
    /** 起始金钱 */
    startingMoney?: number;
    /** 经过起点奖励 */
    passingBonus?: number;
    /** 踩到起点奖励 */
    landingBonus?: number;
    /** 最大玩家数 */
    maxPlayers?: number;
    /** 最小玩家数 */
    minPlayers?: number;
    /** 最大回合数 */
    maxTurns?: number;
    /** 建筑成本配置 */
    buildingCosts?: {
        house?: number;
        hotel?: number;
    };
    /** 抵押比率 */
    mortgageRatio?: number;
    /** 租金倍率 */
    rentMultipliers?: {
        monopoly?: number;
        house?: number;
        hotel?: number;
    };
}

/**
 * 地图元数据
 */
export interface MapMetadata {
    /** 地图ID */
    mapId: string;
    /** 地图名称 */
    mapName: string;
    /** 地图描述 */
    description?: string;
    /** 版本号 */
    version: string;
    /** 创建时间戳 */
    createTime: number;
    /** 更新时间戳 */
    updateTime: number;
    /** 作者 */
    author?: string;
    /** 标签 */
    tags?: string[];
    /** 缩略图路径 */
    thumbnail?: string;
}

/**
 * 建筑数据（原Property数据）
 */
export interface BuildingData {
    /** 方块ID，如 "web3:building_1x1" */
    blockId: string;
    /** 类型ID (Web3BuildingType) */
    typeId: number;
    /** 建筑尺寸（1x1或2x2） */
    size: 1 | 2;
    /** 网格位置（左下角） */
    position: {
        x: number;
        z: number;
    };
    /** 朝向(0-3)，对应Y轴旋转 0°, 90°, 180°, 270° */
    direction?: number;
    /** 建筑ID */
    buildingId?: number;
    /** 拥有者 */
    owner?: string;
    /** 建筑等级 */
    level?: number;
    /** 建筑价格 */
    price?: number;
    /** 租金设置 */
    rent?: number[];
    /** 是否被抵押 */
    mortgaged?: boolean;
}


/**
 * 完整的地图保存数据
 */
export interface MapSaveData extends MapMetadata {
    /** 游戏模式 */
    gameMode: 'edit' | 'play';

    /** 地图尺寸信息 */
    mapSize?: {
        width: number;
        height: number;
        gridSize?: number;
    };

    /** 地块数据数组 (y=0层) */
    tiles: TileData[];

    /** 物体数据数组 (y=1层) */
    objects: ObjectData[];

    /** 建筑数据数组 */
    buildings?: BuildingData[];

    /** Property-Tile关联映射 */
    propertyTileLinks?: { [tileKey: string]: string };

    /** 游戏规则（可选，用于游戏模式） */
    gameRules?: GameRules;

    /** 扩展数据（预留） */
    extra?: {
        /** 摄像机默认位置 */
        cameraPosition?: { x: number; y: number; z: number };
        /** 摄像机默认旋转 */
        cameraRotation?: { x: number; y: number; z: number };
        /** 环境设置 */
        environment?: {
            skybox?: string;
            lighting?: string;
            fogEnabled?: boolean;
        };
        /** 自定义数据 */
        custom?: any;
    };
}

/**
 * 地图加载选项
 */
export interface MapLoadOptions {
    /** 是否加载游戏规则 */
    loadGameRules?: boolean;
    /** 是否加载扩展数据 */
    loadExtra?: boolean;
    /** 是否清空现有地图 */
    clearExisting?: boolean;
    /** 加载回调 */
    onProgress?: (progress: number) => void;
}

/**
 * 地图保存选项
 */
export interface MapSaveOptions {
    /** 是否包含游戏规则 */
    includeGameRules?: boolean;
    /** 是否包含扩展数据 */
    includeExtra?: boolean;
    /** 是否压缩JSON */
    compress?: boolean;
    /** 保存路径（如果不指定则使用默认路径） */
    savePath?: string;
}

/**
 * 地图验证结果
 */
export interface MapValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 错误信息 */
    errors?: string[];
    /** 警告信息 */
    warnings?: string[];
    /** 统计信息 */
    stats?: {
        tileCount: number;
        objectCount: number;
        propertyCount: number;
        npcCount: number;
    };
}

/**
 * 工具函数：创建空地图数据
 */
export function createEmptyMapData(mapId: string, mapName: string): MapSaveData {
    return {
        mapId,
        mapName,
        version: '1.0.0',
        createTime: Date.now(),
        updateTime: Date.now(),
        gameMode: 'edit',
        tiles: [],
        objects: []
    };
}

/**
 * 工具函数：验证地图数据
 */
export function validateMapData(data: MapSaveData): MapValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 基本验证
    if (!data.mapId) errors.push('Missing mapId');
    if (!data.mapName) errors.push('Missing mapName');
    if (!data.version) errors.push('Missing version');
    if (!Array.isArray(data.tiles)) errors.push('tiles must be an array');
    if (!Array.isArray(data.objects)) errors.push('objects must be an array');
    
    // 验证地块数据
    const tilePositions = new Set<string>();
    for (const tile of data.tiles) {
        const key = `${tile.position.x}_${tile.position.z}`;
        if (tilePositions.has(key)) {
            warnings.push(`Duplicate tile at position (${tile.position.x}, ${tile.position.z})`);
        }
        tilePositions.add(key);
    }
    
    // 验证物体数据
    const objectPositions = new Set<string>();
    for (const obj of data.objects) {
        const key = `${obj.position.x}_${obj.position.z}`;
        if (objectPositions.has(key)) {
            warnings.push(`Duplicate object at position (${obj.position.x}, ${obj.position.z})`);
        }
        objectPositions.add(key);
    }
    
    // 统计信息
    const propertyCount = data.tiles.filter(t => t.typeId === Web3TileType.PROPERTY_TILE).length;
    const npcCount = data.objects.filter(o => 
        o.typeId >= Web3ObjectType.LAND_GOD && 
        o.typeId <= Web3ObjectType.POVERTY_GOD
    ).length;
    
    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        stats: {
            tileCount: data.tiles.length,
            objectCount: data.objects.length,
            propertyCount,
            npcCount
        }
    };
}
