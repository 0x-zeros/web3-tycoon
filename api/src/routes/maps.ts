/**
 * 地图元数据API路由
 */

import { Env, MapMetadata } from '../types';
import { jsonResponse, errorResponse } from '../utils/cors';
import { verifyAndParseSignature, checkOwnership, parseSignedRequest } from '../utils/auth';

/**
 * 处理地图相关路由
 */
export async function handleMapRoutes(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // GET /api/maps - 列出地图
    if (method === 'GET' && path === '/api/maps') {
        return await listMaps(url, env);
    }

    // GET /api/maps/:templateId - 获取单个地图
    if (method === 'GET') {
        const match = path.match(/^\/api\/maps\/(.+)$/);
        if (match) {
            const templateId = match[1];
            return await getMap(templateId, env);
        }
    }

    // POST /api/maps - 创建地图元数据（需要签名验证）
    if (method === 'POST' && path === '/api/maps') {
        try {
            const body = await request.json();
            const signedRequest = parseSignedRequest(body);

            if (!signedRequest) {
                return errorResponse('Signature required', 401);
            }

            // 验证签名（指定 action 防止跨端点重放）
            const auth = await verifyAndParseSignature(signedRequest, 'create_map');
            if (!auth.valid) {
                return errorResponse(auth.error || 'Invalid signature', 401);
            }

            // 从 payload 获取数据
            const payload = auth.payload!;
            const mapData = payload.data as Partial<MapMetadata> & { templateId: string };

            // 检查：签名者 === creator.address
            const creatorAddress = mapData.creator?.address || payload.address;
            if (!checkOwnership(auth.address!, creatorAddress)) {
                return errorResponse('creator.address must match signer', 403);
            }

            return await createMap({
                ...mapData,
                creator: {
                    ...(mapData.creator || {}),
                    address: auth.address!  // 使用签名者地址作为 creator.address
                }
            }, env);
        } catch (error) {
            return errorResponse('Invalid JSON body', 400);
        }
    }

    // PUT /api/maps/:templateId - 更新地图元数据（需要签名验证，只有创建者可修改）
    if (method === 'PUT') {
        const match = path.match(/^\/api\/maps\/(.+)$/);
        if (match) {
            const templateId = match[1];
            try {
                const body = await request.json();
                const signedRequest = parseSignedRequest(body);

                if (!signedRequest) {
                    return errorResponse('Signature required', 401);
                }

                // 验证签名（指定 action 防止跨端点重放）
                const auth = await verifyAndParseSignature(signedRequest, 'update_map');
                if (!auth.valid) {
                    return errorResponse(auth.error || 'Invalid signature', 401);
                }

                // 获取现有地图，检查权限
                const existing = await env.METADATA_KV.get(`map:${templateId}`, 'json') as MapMetadata | null;
                if (!existing) {
                    return errorResponse('Map not found', 404);
                }

                // 检查：签名者 === 地图的 creator.address
                if (!checkOwnership(auth.address!, existing.creator.address)) {
                    return errorResponse('Only creator can modify map', 403);
                }

                return await updateMap(templateId, auth.payload!.data, env);
            } catch (error) {
                return errorResponse('Invalid JSON body', 400);
            }
        }
    }

    return errorResponse('Bad Request', 400);
}

/**
 * 获取地图元数据
 */
async function getMap(templateId: string, env: Env): Promise<Response> {
    const key = `map:${templateId}`;

    try {
        const data = await env.METADATA_KV.get(key, 'json');

        if (!data) {
            return errorResponse('Map not found', 404);
        }

        return jsonResponse(data);
    } catch (error) {
        console.error('Error getting map:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 创建地图元数据
 */
async function createMap(
    input: Partial<MapMetadata> & { templateId: string },
    env: Env
): Promise<Response> {
    const { templateId, ...metadata } = input;
    const key = `map:${templateId}`;

    try {
        // 验证必填字段
        if (!metadata.creator?.address) {
            return errorResponse('creator.address is required', 400);
        }

        // 检查是否已存在
        const existing = await env.METADATA_KV.get(key);
        if (existing) {
            return errorResponse('Map already exists', 409);
        }

        // 创建地图元数据
        const map: MapMetadata = {
            templateId,
            displayName: metadata.displayName || { 'zh-CN': 'Untitled Map', 'en-US': 'Untitled Map' },
            description: metadata.description || { 'zh-CN': '', 'en-US': '' },
            media: metadata.media || { previewImage: '', thumbnailImage: '' },
            creator: metadata.creator,
            category: metadata.category || 'classic',
            difficulty: metadata.difficulty || 'medium',
            createdAt: Date.now(),
            playCount: 0,
            rating: 0
        };

        // 保存到KV
        await env.METADATA_KV.put(key, JSON.stringify(map));

        // 更新索引
        await updateMapIndex(map, env);

        return jsonResponse(map, 201);
    } catch (error) {
        console.error('Error creating map:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 更新地图元数据
 */
async function updateMap(
    templateId: string,
    updates: Partial<MapMetadata>,
    env: Env
): Promise<Response> {
    const key = `map:${templateId}`;

    try {
        // 获取现有数据
        const existing = await env.METADATA_KV.get(key, 'json') as MapMetadata | null;

        if (!existing) {
            return errorResponse('Map not found', 404);
        }

        // 深度合并更新
        const map: MapMetadata = {
            ...existing,
            displayName: {
                ...existing.displayName,
                ...(updates.displayName || {})
            },
            description: {
                ...existing.description,
                ...(updates.description || {})
            },
            media: {
                ...existing.media,
                ...(updates.media || {})
            },
            creator: {
                ...existing.creator,
                ...(updates.creator || {})
            },
            category: updates.category ?? existing.category,
            difficulty: updates.difficulty ?? existing.difficulty,
            playCount: updates.playCount ?? existing.playCount,
            rating: updates.rating ?? existing.rating,
            templateId,  // ID不允许修改
            createdAt: existing.createdAt  // 创建时间不允许修改
        };

        // 保存
        await env.METADATA_KV.put(key, JSON.stringify(map));

        return jsonResponse(map);
    } catch (error) {
        console.error('Error updating map:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 列出地图
 */
async function listMaps(url: URL, env: Env): Promise<Response> {
    const creator = url.searchParams.get('creator');
    const category = url.searchParams.get('category') as 'classic' | 'creative' | 'competitive' | null;
    const limitStr = url.searchParams.get('limit');
    const offsetStr = url.searchParams.get('offset');

    const limit = limitStr ? parseInt(limitStr) : 20;
    const offset = offsetStr ? parseInt(offsetStr) : 0;

    try {
        // 获取索引
        let indexKey = 'maps_all';
        if (creator) {
            indexKey = `maps_by_creator:${creator}`;
        } else if (category) {
            indexKey = `maps_by_category:${category}`;
        }

        const mapIdsJson = await env.METADATA_KV.get(indexKey);
        let mapIds: string[] = mapIdsJson ? JSON.parse(mapIdsJson) : [];

        // 如果使用全局索引但需要过滤
        if (indexKey === 'maps_all' && (creator || category)) {
            const filteredIds: string[] = [];
            for (const mapId of mapIds) {
                const mapData = await env.METADATA_KV.get(`map:${mapId}`, 'json') as MapMetadata | null;
                if (mapData) {
                    if (creator && mapData.creator.address !== creator) continue;
                    if (category && mapData.category !== category) continue;
                    filteredIds.push(mapId);
                }
            }
            mapIds = filteredIds;
        }

        // 分页
        const total = mapIds.length;
        const paginatedIds = mapIds.slice(offset, offset + limit);

        // 获取地图数据
        const maps: MapMetadata[] = [];
        for (const mapId of paginatedIds) {
            const mapData = await env.METADATA_KV.get(`map:${mapId}`, 'json') as MapMetadata | null;
            if (mapData) {
                maps.push(mapData);
            }
        }

        return jsonResponse({
            maps,
            total,
            limit,
            offset
        });
    } catch (error) {
        console.error('Error listing maps:', error);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * 更新地图索引
 */
async function updateMapIndex(map: MapMetadata, env: Env): Promise<void> {
    // 更新全局索引
    const allMapsJson = await env.METADATA_KV.get('maps_all');
    const allMaps: string[] = allMapsJson ? JSON.parse(allMapsJson) : [];

    if (!allMaps.includes(map.templateId)) {
        allMaps.push(map.templateId);
        await env.METADATA_KV.put('maps_all', JSON.stringify(allMaps));
    }

    // 更新创建者索引
    const creatorKey = `maps_by_creator:${map.creator.address}`;
    const creatorMapsJson = await env.METADATA_KV.get(creatorKey);
    const creatorMaps: string[] = creatorMapsJson ? JSON.parse(creatorMapsJson) : [];

    if (!creatorMaps.includes(map.templateId)) {
        creatorMaps.push(map.templateId);
        await env.METADATA_KV.put(creatorKey, JSON.stringify(creatorMaps));
    }

    // 更新分类索引
    const categoryKey = `maps_by_category:${map.category}`;
    const categoryMapsJson = await env.METADATA_KV.get(categoryKey);
    const categoryMaps: string[] = categoryMapsJson ? JSON.parse(categoryMapsJson) : [];

    if (!categoryMaps.includes(map.templateId)) {
        categoryMaps.push(map.templateId);
        await env.METADATA_KV.put(categoryKey, JSON.stringify(categoryMaps));
    }
}
