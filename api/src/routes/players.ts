/**
 * 玩家API路由
 */

import { Env, PlayerMetadata } from '../types';
import { jsonResponse, errorResponse } from '../utils/cors';

/**
 * 处理玩家相关路由
 */
export async function handlePlayerRoutes(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // GET /api/players/:address
    if (method === 'GET') {
        const match = url.pathname.match(/^\/api\/players\/(.+)$/);
        if (match) {
            const address = match[1];
            return await getPlayer(address, env);
        }
    }

    // POST /api/players
    if (method === 'POST') {
        try {
            const body = await request.json() as Partial<PlayerMetadata> & { address: string };
            return await createOrUpdatePlayer(body, env);
        } catch (error) {
            return errorResponse('Invalid JSON body', 400);
        }
    }

    // PUT /api/players/:address
    if (method === 'PUT') {
        const match = url.pathname.match(/^\/api\/players\/(.+)$/);
        if (match) {
            const address = match[1];
            try {
                const body = await request.json() as Partial<PlayerMetadata>;
                return await updatePlayer(address, body, env);
            } catch (error) {
                return errorResponse('Invalid JSON body', 400);
            }
        }
    }

    return errorResponse('Bad Request', 400);
}

/**
 * 获取玩家元数据
 */
async function getPlayer(address: string, env: Env): Promise<Response> {
    const key = `player:${address}`;

    try {
        const data = await env.METADATA_KV.get(key, 'json');

        if (!data) {
            return errorResponse('Player not found', 404);
        }

        return jsonResponse(data);
    } catch (error) {
        console.error('Error getting player:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 创建或更新玩家元数据
 */
async function createOrUpdatePlayer(
    input: Partial<PlayerMetadata> & { address: string },
    env: Env
): Promise<Response> {
    const { address, ...metadata } = input;
    const key = `player:${address}`;

    try {
        // 获取现有数据
        const existing = await env.METADATA_KV.get(key, 'json') as PlayerMetadata | null;

        // 默认值
        const defaultStats = { gamesPlayed: 0, gamesWon: 0, totalEarnings: '0' };
        const defaultPreferences = { language: 'zh-CN' as const, soundEnabled: true, soundVolume: 80 };

        // 深度合并数据（嵌套对象合并而非替换）
        const player: PlayerMetadata = {
            address,
            nickname: metadata.nickname ?? existing?.nickname ?? '',
            avatar: metadata.avatar ?? existing?.avatar ?? '',
            bio: metadata.bio ?? existing?.bio,
            // 深度合并 stats
            stats: {
                ...(existing?.stats || defaultStats),
                ...(metadata.stats || {})
            },
            // 深度合并 preferences
            preferences: {
                ...(existing?.preferences || defaultPreferences),
                ...(metadata.preferences || {})
            },
            createdAt: existing?.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        // 保存到KV
        await env.METADATA_KV.put(key, JSON.stringify(player));

        return jsonResponse(player, existing ? 200 : 201);
    } catch (error) {
        console.error('Error creating/updating player:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 更新玩家元数据
 */
async function updatePlayer(
    address: string,
    updates: Partial<PlayerMetadata>,
    env: Env
): Promise<Response> {
    const key = `player:${address}`;

    try {
        // 获取现有数据
        const existing = await env.METADATA_KV.get(key, 'json') as PlayerMetadata | null;

        if (!existing) {
            return errorResponse('Player not found', 404);
        }

        // 深度合并更新（嵌套对象合并而非替换）
        const player: PlayerMetadata = {
            ...existing,
            // 顶层字段直接覆盖
            nickname: updates.nickname ?? existing.nickname,
            avatar: updates.avatar ?? existing.avatar,
            bio: updates.bio ?? existing.bio,
            // 深度合并 stats
            stats: {
                ...existing.stats,
                ...(updates.stats || {})
            },
            // 深度合并 preferences
            preferences: {
                ...existing.preferences,
                ...(updates.preferences || {})
            },
            address,  // 地址不允许修改
            createdAt: existing.createdAt,  // 创建时间不允许修改
            updatedAt: Date.now()
        };

        // 保存
        await env.METADATA_KV.put(key, JSON.stringify(player));

        return jsonResponse(player);
    } catch (error) {
        console.error('Error updating player:', error);
        return errorResponse('Internal server error', 500);
    }
}
