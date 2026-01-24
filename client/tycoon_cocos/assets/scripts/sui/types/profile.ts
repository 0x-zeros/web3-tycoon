/**
 * 链上 Profile 类型定义
 *
 * 对应 Move 合约 tycoon_profiles 包的数据结构
 * 这些 Profile 存储在 Sui 链上，用于 UI 展示
 */

/**
 * 玩家档案
 * 对应 Move 的 PlayerProfile 结构
 * - owned object，通过所有权关联钱包地址
 */
export interface PlayerProfile {
    /** Profile 对象 ID */
    id: string;
    /** 玩家昵称 (1-32 字符) */
    name: string;
    /** 头像索引 (0-255) */
    avatar: number;
}

/**
 * 游戏档案
 * 对应 Move 的 GameProfile 结构
 * - shared object，关联 Game 对象
 */
export interface GameProfile {
    /** Profile 对象 ID */
    id: string;
    /** 关联的 Game 对象 ID */
    game_id: string;
    /** 创建者地址 */
    creator: string;
    /** 游戏名称 (1-64 字符) */
    name: string;
}

/**
 * 地图档案
 * 对应 Move 的 MapProfile 结构
 * - shared object，关联 MapTemplate 对象
 */
export interface MapProfile {
    /** Profile 对象 ID */
    id: string;
    /** 关联的 MapTemplate 对象 ID */
    map_id: string;
    /** 创建者地址 */
    creator: string;
    /** 地图名称 (1-64 字符) */
    name: string;
    /** 地图描述 (0-256 字符) */
    description: string;
}

/**
 * 链上 Profile 事件类型（用于索引）
 */
export interface PlayerProfileCreatedEvent {
    profile_id: string;
    owner: string;
}

export interface GameProfileCreatedEvent {
    profile_id: string;
    game_id: string;
    creator: string;
}

export interface MapProfileCreatedEvent {
    profile_id: string;
    map_id: string;
    creator: string;
}
