/**
 * Cloudflare Workers 入口文件
 *
 * Web3 Tycoon 元数据API服务
 * 提供玩家、游戏房间、地图等元数据的存储和查询
 */

import { Env } from './types';
import { handlePlayerRoutes } from './routes/players';
import { handleGameRoutes } from './routes/games';
import { setCorsHeaders, errorResponse } from './utils/cors';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // CORS预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: setCorsHeaders(new Headers())
            });
        }

        try {
            // 健康检查
            if (url.pathname === '/' || url.pathname === '/health') {
                return new Response(JSON.stringify({
                    status: 'ok',
                    service: 'web3-tycoon-api',
                    environment: env.ENVIRONMENT,
                    timestamp: Date.now()
                }), {
                    headers: setCorsHeaders(new Headers({
                        'Content-Type': 'application/json'
                    }))
                });
            }

            // 路由分发
            if (url.pathname.startsWith('/api/players')) {
                return await handlePlayerRoutes(request, env);
            }

            if (url.pathname.startsWith('/api/games')) {
                return await handleGameRoutes(request, env);
            }

            // 404
            return errorResponse('Not Found', 404);

        } catch (error) {
            console.error('Worker error:', error);
            return errorResponse(
                `Internal Server Error: ${(error as Error).message}`,
                500
            );
        }
    }
};
