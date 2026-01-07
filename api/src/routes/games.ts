/**
 * 游戏房间API路由
 */

import { Env, GameRoomMetadata } from '../types';
import { jsonResponse, errorResponse } from '../utils/cors';

/**
 * 处理游戏房间相关路由
 */
export async function handleGameRoutes(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // GET /api/games - 列出游戏房间
    if (method === 'GET' && path === '/api/games') {
        return await listGames(url, env);
    }

    // GET /api/games/:gameId - 获取单个游戏房间
    if (method === 'GET') {
        const match = path.match(/^\/api\/games\/(.+)$/);
        if (match) {
            const gameId = match[1];
            return await getGame(gameId, env);
        }
    }

    // POST /api/games - 创建游戏房间
    if (method === 'POST' && path === '/api/games') {
        try {
            const body = await request.json() as Partial<GameRoomMetadata> & { gameId: string };
            return await createGame(body, env);
        } catch (error) {
            return errorResponse('Invalid JSON body', 400);
        }
    }

    // PUT /api/games/:gameId - 更新游戏房间
    if (method === 'PUT') {
        const match = path.match(/^\/api\/games\/(.+)$/);
        if (match) {
            const gameId = match[1];
            try {
                const body = await request.json() as Partial<GameRoomMetadata>;
                return await updateGame(gameId, body, env);
            } catch (error) {
                return errorResponse('Invalid JSON body', 400);
            }
        }
    }

    return errorResponse('Bad Request', 400);
}

/**
 * 获取游戏房间
 */
async function getGame(gameId: string, env: Env): Promise<Response> {
    const key = `game:${gameId}`;

    try {
        const data = await env.METADATA_KV.get(key, 'json');

        if (!data) {
            return errorResponse('Game not found', 404);
        }

        return jsonResponse(data);
    } catch (error) {
        console.error('Error getting game:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 创建游戏房间
 */
async function createGame(
    input: Partial<GameRoomMetadata> & { gameId: string },
    env: Env
): Promise<Response> {
    const { gameId, ...metadata } = input;
    const key = `game:${gameId}`;

    try {
        // 检查是否已存在
        const existing = await env.METADATA_KV.get(key);
        if (existing) {
            return errorResponse('Game already exists', 409);
        }

        // 创建游戏房间
        const game: GameRoomMetadata = {
            gameId,
            roomName: metadata.roomName || 'Untitled Game',
            description: metadata.description || '',
            tags: metadata.tags || [],
            players: metadata.players || [],
            visibility: metadata.visibility || 'public',
            status: 'waiting',
            hostAddress: metadata.hostAddress!,
            createdAt: Date.now()
        };

        // 保存到KV
        await env.METADATA_KV.put(key, JSON.stringify(game));

        // 更新状态索引（用于列表查询）
        await updateGameIndex(game, env);

        return jsonResponse(game, 201);
    } catch (error) {
        console.error('Error creating game:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 更新游戏房间
 */
async function updateGame(
    gameId: string,
    updates: Partial<GameRoomMetadata>,
    env: Env
): Promise<Response> {
    const key = `game:${gameId}`;

    try {
        // 获取现有数据
        const existing = await env.METADATA_KV.get(key, 'json') as GameRoomMetadata | null;

        if (!existing) {
            return errorResponse('Game not found', 404);
        }

        // 合并更新
        const game: GameRoomMetadata = {
            ...existing,
            ...updates,
            gameId,  // ID不允许修改
            createdAt: existing.createdAt  // 创建时间不允许修改
        };

        // 如果状态变化，更新特殊字段
        if (updates.status === 'playing' && !existing.startedAt) {
            game.startedAt = Date.now();
        }
        if (updates.status === 'finished' && !existing.endedAt) {
            game.endedAt = Date.now();
        }

        // 保存
        await env.METADATA_KV.put(key, JSON.stringify(game));

        // 更新索引
        await updateGameIndex(game, env);

        return jsonResponse(game);
    } catch (error) {
        console.error('Error updating game:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 列出游戏房间
 */
async function listGames(url: URL, env: Env): Promise<Response> {
    const status = url.searchParams.get('status') as 'waiting' | 'playing' | 'finished' | null;
    const host = url.searchParams.get('host');
    const limitStr = url.searchParams.get('limit');
    const offsetStr = url.searchParams.get('offset');

    const limit = limitStr ? parseInt(limitStr) : 20;
    const offset = offsetStr ? parseInt(offsetStr) : 0;

    try {
        // 获取索引键
        const indexKey = status ? `games_by_status:${status}` : 'games_all';
        const gameIdsJson = await env.METADATA_KV.get(indexKey);

        let gameIds: string[] = gameIdsJson ? JSON.parse(gameIdsJson) : [];

        // 按host过滤
        if (host) {
            const filteredIds: string[] = [];
            for (const gameId of gameIds) {
                const gameData = await env.METADATA_KV.get(`game:${gameId}`, 'json') as GameRoomMetadata | null;
                if (gameData && gameData.hostAddress === host) {
                    filteredIds.push(gameId);
                }
            }
            gameIds = filteredIds;
        }

        // 分页
        const total = gameIds.length;
        const paginatedIds = gameIds.slice(offset, offset + limit);

        // 获取游戏数据
        const games: GameRoomMetadata[] = [];
        for (const gameId of paginatedIds) {
            const gameData = await env.METADATA_KV.get(`game:${gameId}`, 'json') as GameRoomMetadata | null;
            if (gameData) {
                games.push(gameData);
            }
        }

        return jsonResponse({
            games,
            total,
            limit,
            offset
        });
    } catch (error) {
        console.error('Error listing games:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 更新游戏索引
 * 用于快速查询不同状态的游戏
 */
async function updateGameIndex(game: GameRoomMetadata, env: Env): Promise<void> {
    // 更新状态索引
    const statusKey = `games_by_status:${game.status}`;
    const statusGamesJson = await env.METADATA_KV.get(statusKey);
    const statusGames: string[] = statusGamesJson ? JSON.parse(statusGamesJson) : [];

    if (!statusGames.includes(game.gameId)) {
        statusGames.push(game.gameId);
        await env.METADATA_KV.put(statusKey, JSON.stringify(statusGames));
    }

    // 更新全局索引
    const allGamesJson = await env.METADATA_KV.get('games_all');
    const allGames: string[] = allGamesJson ? JSON.parse(allGamesJson) : [];

    if (!allGames.includes(game.gameId)) {
        allGames.push(game.gameId);
        await env.METADATA_KV.put('games_all', JSON.stringify(allGames));
    }
}
