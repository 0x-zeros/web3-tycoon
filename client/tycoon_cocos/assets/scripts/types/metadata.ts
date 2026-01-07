/**
 * 元数据类型定义
 *
 * 定义链下存储的所有元数据接口
 * 这些数据不影响游戏规则，仅用于UI展示和用户体验提升
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

/**
 * 玩家元数据
 * 存储玩家的展示信息和偏好设置
 */
export interface PlayerMetadata {
    /** Sui地址（关联键） */
    address: string;

    /** 昵称（3-20字符） */
    nickname: string;

    /** 头像URL（Cloudflare R2） */
    avatar: string;

    /** 个人简介 */
    bio?: string;

    /** 统计数据（仅供展示，不影响游戏规则） */
    stats: {
        gamesPlayed: number;
        gamesWon: number;
        totalEarnings: string;  // BigInt字符串
    };

    /** 用户偏好设置 */
    preferences: {
        language: 'zh-CN' | 'en-US';
        soundEnabled: boolean;
        soundVolume: number;  // 0-100
    };

    /** 创建时间 */
    createdAt: number;

    /** 更新时间 */
    updatedAt: number;
}

/**
 * 游戏房间元数据
 * 存储游戏房间的展示信息
 */
export interface GameRoomMetadata {
    /** Game对象ID（关联键） */
    gameId: string;

    /** 房间名称 */
    roomName: string;

    /** 房间描述 */
    description: string;

    /** 标签 */
    tags: string[];

    /** 玩家展示信息（冗余存储，避免多次查询） */
    players: Array<{
        address: string;
        nickname: string;
        avatar: string;
        isReady: boolean;
    }>;

    /** 可见性 */
    visibility: 'public' | 'private' | 'friends-only';

    /** 状态 */
    status: 'waiting' | 'playing' | 'finished';

    /** 房主地址 */
    hostAddress: string;

    /** 创建时间 */
    createdAt: number;

    /** 开始时间 */
    startedAt?: number;

    /** 结束时间 */
    endedAt?: number;
}

/**
 * 地图元数据
 * 存储地图的展示信息
 */
export interface MapMetadata {
    /** MapTemplate对象ID（关联键） */
    templateId: string;

    /** 多语言显示名称 */
    displayName: {
        'zh-CN': string;
        'en-US': string;
    };

    /** 多语言描述 */
    description: {
        'zh-CN': string;
        'en-US': string;
    };

    /** 预览图 */
    media: {
        previewImage: string;     // 1920x1080
        thumbnailImage: string;   // 320x180
    };

    /** 创建者信息 */
    creator: {
        address: string;
        nickname: string;
        isOfficial: boolean;
    };

    /** 分类 */
    category: 'classic' | 'creative' | 'competitive';

    /** 难度 */
    difficulty: 'easy' | 'medium' | 'hard';

    /** 创建时间 */
    createdAt: number;

    /** 游玩次数 */
    playCount: number;

    /** 评分 */
    rating: number;  // 0-5
}

/**
 * 卡牌展示元数据
 * 存储卡牌的视觉资源和文本描述
 */
export interface CardDisplayMetadata {
    /** 卡牌ID（对应链上Card ID） */
    cardId: number;

    /** 多语言显示名称 */
    displayName: {
        'zh-CN': string;
        'en-US': string;
    };

    /** 多语言描述 */
    description: {
        'zh-CN': string;
        'en-US': string;
    };

    /** UI资源 */
    iconUrl: string;          // 卡牌图标
    illustrationUrl: string;  // 卡牌插画
}

/**
 * 创建玩家请求
 */
export interface CreatePlayerRequest {
    address: string;
    nickname: string;
    avatar?: string;
    bio?: string;
    preferences?: Partial<PlayerMetadata['preferences']>;
}

/**
 * 更新玩家请求
 */
export interface UpdatePlayerRequest {
    nickname?: string;
    avatar?: string;
    bio?: string;
    preferences?: Partial<PlayerMetadata['preferences']>;
}

/**
 * 创建游戏房间请求
 */
export interface CreateGameRoomRequest {
    gameId: string;
    roomName: string;
    description: string;
    tags?: string[];
    visibility?: 'public' | 'private' | 'friends-only';
    hostAddress: string;
}

/**
 * 更新游戏房间请求
 */
export interface UpdateGameRoomRequest {
    roomName?: string;
    description?: string;
    tags?: string[];
    visibility?: 'public' | 'private' | 'friends-only';
    status?: 'waiting' | 'playing' | 'finished';
}

/**
 * 列出游戏房间请求
 */
export interface ListGamesRequest {
    status?: 'waiting' | 'playing' | 'finished';
    host?: string;
    limit?: number;
    offset?: number;
}

/**
 * 列出游戏房间响应
 */
export interface ListGamesResponse {
    games: GameRoomMetadata[];
    total: number;
    limit: number;
    offset: number;
}

/**
 * 列出地图请求
 */
export interface ListMapsRequest {
    creator?: string;
    category?: 'classic' | 'creative' | 'competitive';
    limit?: number;
    offset?: number;
}

/**
 * 列出地图响应
 */
export interface ListMapsResponse {
    maps: MapMetadata[];
    total: number;
    limit: number;
    offset: number;
}
