/**
 * 地图系统类型定义
 * 
 * 定义地图、地块、路径等核心数据结构
 * 为大富翁游戏地图系统提供类型安全和数据规范
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3, Color } from 'cc';

// ========================= 基础枚举类型 =========================

/**
 * 地块类型枚举
 * 定义游戏中所有可能的地块类型
 */
export enum TileType {
    /** 起点地块 - 玩家开始位置，经过时获得薪水 */
    START = 'start',
    
    /** 地产地块 - 可购买、建设、收租的核心地块 */
    PROPERTY = 'property',
    
    /** 机会地块 - 触发随机事件，可能获得卡片 */
    CHANCE = 'chance',
    
    /** 空白地块 - 不触发任何事件的普通地块 */
    EMPTY = 'empty',
    
    /** 监狱地块 - 限制玩家行动的特殊地块 */
    JAIL = 'jail',
    
    /** 税收地块 - 政府收税地块 */
    TAX = 'tax',
    
    /** 免费停车 - 安全的休息地块 */
    FREE_PARKING = 'free_parking'
}

/**
 * 地产组枚举
 * 用于定义同色地产组，实现垄断加成效果
 */
export enum PropertyGroup {
    /** 棕色地产组 */
    BROWN = 'brown',
    /** 浅蓝地产组 */
    LIGHT_BLUE = 'light_blue',
    /** 粉色地产组 */
    PINK = 'pink',
    /** 橙色地产组 */
    ORANGE = 'orange',
    /** 红色地产组 */
    RED = 'red',
    /** 黄色地产组 */
    YELLOW = 'yellow',
    /** 绿色地产组 */
    GREEN = 'green',
    /** 深蓝地产组 */
    DARK_BLUE = 'dark_blue'
}

/**
 * 地块状态枚举
 * 定义地块的当前状态
 */
export enum TileState {
    /** 正常状态 */
    NORMAL = 'normal',
    /** 被路障阻挡 */
    BLOCKED = 'blocked',
    /** 被抵押状态（仅地产） */
    MORTGAGED = 'mortgaged',
    /** 被选中状态（用于UI高亮） */
    SELECTED = 'selected'
}

// ========================= 基础数据接口 =========================

/**
 * 3D位置信息接口
 * 用于存储地块在3D空间中的位置和朝向
 */
export interface Position3D {
    /** X轴坐标 */
    x: number;
    /** Y轴坐标（通常为0，地面高度） */
    y: number;
    /** Z轴坐标 */
    z: number;
    /** 旋转角度（度数，用于地块朝向） */
    rotation?: number;
}

/**
 * 渲染配置接口
 * 定义地块的视觉表现属性
 */
export interface RenderConfig {
    /** 地块主色调 */
    primaryColor: Color;
    /** 地块次色调（用于边框等） */
    secondaryColor?: Color;
    /** 地块材质类型（预留给后续美术替换） */
    materialType?: string;
    /** 地块特效名称（预留给特效系统） */
    effectName?: string;
    /** 是否显示网格 */
    showGrid?: boolean;
}

/**
 * 地产数据接口
 * 定义地产地块的特有属性
 */
export interface PropertyData {
    /** 地产购买价格 */
    price: number;
    /** 各等级租金数组 [空地, 1房, 2房, 3房, 4房, 酒店] */
    rent: number[];
    /** 建房费用（每栋房子的建设成本） */
    buildCost: number;
    /** 酒店建设费用 */
    hotelCost: number;
    /** 地产组（用于垄断判断） */
    group: PropertyGroup;
    /** 当前建筑等级 (0-5: 0空地, 1-4房屋, 5酒店) */
    buildingLevel: number;
    /** 地产拥有者玩家ID（null表示无主） */
    ownerId: string | null;
    /** 是否被抵押 */
    isMortgaged: boolean;
}

/**
 * 税收数据接口
 * 定义税收地块的属性
 */
export interface TaxData {
    /** 税收金额 */
    amount: number;
    /** 税收类型（固定金额或按比例） */
    type: 'fixed' | 'percentage';
    /** 税收名称 */
    taxName: string;
}

// ========================= 核心地块接口 =========================

/**
 * 地块数据接口
 * 定义单个地块的完整数据结构
 */
export interface MapTileData {
    /** 地块唯一标识符 */
    id: number;
    
    /** 地块类型 */
    type: TileType;
    
    /** 地块名称 */
    name: string;
    
    /** 地块描述 */
    description: string;
    
    /** 地块在3D空间中的位置 */
    position: Position3D;
    
    /** 下一个地块的ID（用于路径查找） */
    nextTileId: number;
    
    /** 地块当前状态 */
    state: TileState;
    
    /** 渲染配置 */
    renderConfig: RenderConfig;
    
    // ====== 可选的特定类型数据 ======
    
    /** 地产数据（仅当type为PROPERTY时有效） */
    propertyData?: PropertyData;
    
    /** 税收数据（仅当type为TAX时有效） */
    taxData?: TaxData;
    
    /** 起点薪水（仅当type为START时有效） */
    salaryAmount?: number;
    
    /** 机会事件权重（仅当type为CHANCE时有效） */
    eventWeight?: number;
    
    // ====== 扩展字段 ======
    
    /** 自定义属性（用于扩展功能） */
    customData?: { [key: string]: any };
}

// ========================= 路径和连接 =========================

/**
 * 路径连接接口
 * 定义地块之间的连接关系
 */
export interface PathConnection {
    /** 起始地块ID */
    fromTileId: number;
    /** 目标地块ID */
    toTileId: number;
    /** 路径类型（正常路径或特殊路径如传送门） */
    pathType: 'normal' | 'teleport';
    /** 路径权重（用于路径查找算法） */
    weight: number;
}

/**
 * 路径查找结果接口
 */
export interface PathResult {
    /** 路径上的地块ID数组 */
    tileIds: number[];
    /** 路径总长度 */
    totalDistance: number;
    /** 是否为有效路径 */
    isValid: boolean;
}

// ========================= 地图数据接口 =========================

/**
 * 地图元数据接口
 * 存储地图的基本信息
 */
export interface MapMetadata {
    /** 地图唯一标识符 */
    id: string;
    /** 地图名称 */
    name: string;
    /** 地图描述 */
    description: string;
    /** 地图作者 */
    author: string;
    /** 地图版本 */
    version: string;
    /** 创建时间 */
    createdAt: string;
    /** 最后修改时间 */
    updatedAt: string;
    /** 推荐玩家数 */
    recommendedPlayers: { min: number; max: number };
    /** 预计游戏时长（分钟） */
    estimatedDuration: number;
    /** 地图标签 */
    tags: string[];
}

/**
 * 地图配置接口
 * 定义地图的游戏规则配置
 */
export interface MapConfig {
    /** 起始资金 */
    startingMoney: number;
    /** 经过起点的薪水 */
    passingStartSalary: number;
    /** 停在起点的薪水 */
    landOnStartSalary: number;
    /** 最大建筑等级 */
    maxBuildingLevel: number;
    /** 破产判定金额 */
    bankruptThreshold: number;
    /** 是否启用垄断租金加倍 */
    enableMonopolyBonus: boolean;
    /** 垄断租金倍数 */
    monopolyRentMultiplier: number;
}

/**
 * 完整地图数据接口
 * 包含地图的所有信息
 */
export interface MapData {
    /** 地图元数据 */
    metadata: MapMetadata;
    
    /** 地图游戏配置 */
    config: MapConfig;
    
    /** 所有地块数据 */
    tiles: MapTileData[];
    
    /** 路径连接信息 */
    paths: PathConnection[];
    
    /** 起点地块ID */
    startTileId: number;
    
    /** 地图边界信息（用于摄像机限制） */
    bounds: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
    };
    
    // ====== Cocos Creator 相关 ======
    
    /** 预制件路径映射 */
    prefabPaths?: {
        [key in TileType]: string;
    };
    
    /** 场景配置（摄像机位置等） */
    sceneConfig?: {
        cameraPosition: Vec3;
        cameraRotation: Vec3;
        lightingConfig?: any; // 预留给灯光系统
    };
}

// ========================= 工具类型 =========================

/**
 * 地块更新数据接口
 * 用于更新地块状态时的数据传递
 */
export interface TileUpdateData {
    /** 要更新的地块ID */
    tileId: number;
    /** 新的状态 */
    newState?: TileState;
    /** 地产数据更新 */
    propertyUpdate?: Partial<PropertyData>;
    /** 渲染配置更新 */
    renderUpdate?: Partial<RenderConfig>;
}

/**
 * 地块查询条件接口
 * 用于搜索和过滤地块
 */
export interface TileQuery {
    /** 地块类型筛选 */
    type?: TileType;
    /** 地产组筛选 */
    propertyGroup?: PropertyGroup;
    /** 拥有者筛选 */
    ownerId?: string;
    /** 状态筛选 */
    state?: TileState;
    /** 是否包含建筑 */
    hasBuilding?: boolean;
}

/**
 * 地图验证结果接口
 * 用于地图数据验证
 */
export interface MapValidationResult {
    /** 是否有效 */
    isValid: boolean;
    /** 错误信息列表 */
    errors: string[];
    /** 警告信息列表 */
    warnings: string[];
    /** 验证详情 */
    details: {
        /** 地块总数 */
        totalTiles: number;
        /** 各类型地块数量 */
        tileTypeCount: { [key in TileType]: number };
        /** 路径连通性检查 */
        pathConnectivity: boolean;
    };
}

// ========================= 导出所有类型 =========================

/**
 * 导出的类型联合，方便导入使用
 */
export type {
    MapTileData,
    MapData,
    MapMetadata,
    MapConfig,
    PropertyData,
    TaxData,
    Position3D,
    RenderConfig,
    PathConnection,
    PathResult,
    TileUpdateData,
    TileQuery,
    MapValidationResult
};

/**
 * 导出的枚举联合
 */
export {
    TileType,
    PropertyGroup,
    TileState
};