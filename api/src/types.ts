/**
 * 类型定义
 *
 * Workers API使用的TypeScript类型定义
 * 与客户端的metadata.ts保持一致
 */

export interface PlayerMetadata {
    address: string;
    nickname: string;
    avatar: string;
    bio?: string;
    stats: {
        gamesPlayed: number;
        gamesWon: number;
        totalEarnings: string;
    };
    preferences: {
        language: 'zh-CN' | 'en-US';
        soundEnabled: boolean;
        soundVolume: number;
    };
    createdAt: number;
    updatedAt: number;
}

export interface GameRoomMetadata {
    gameId: string;
    roomName: string;
    description: string;
    tags: string[];
    players: Array<{
        address: string;
        nickname: string;
        avatar: string;
        isReady: boolean;
    }>;
    visibility: 'public' | 'private' | 'friends-only';
    status: 'waiting' | 'playing' | 'finished';
    hostAddress: string;
    createdAt: number;
    startedAt?: number;
    endedAt?: number;
}

export interface MapMetadata {
    templateId: string;
    displayName: {
        'zh-CN': string;
        'en-US': string;
    };
    description: {
        'zh-CN': string;
        'en-US': string;
    };
    media: {
        previewImage: string;
        thumbnailImage: string;
    };
    creator: {
        address: string;
        nickname: string;
        isOfficial: boolean;
    };
    category: 'classic' | 'creative' | 'competitive';
    difficulty: 'easy' | 'medium' | 'hard';
    createdAt: number;
    playCount: number;
    rating: number;
}

export interface Env {
    METADATA_KV: KVNamespace;
    ASSETS_R2?: R2Bucket;  // 可选，需要先在Cloudflare Dashboard启用R2
    ENVIRONMENT: string;
}
