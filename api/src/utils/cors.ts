/**
 * CORS工具函数
 */

/**
 * 设置CORS头部
 */
export function setCorsHeaders(headers: Headers): Headers {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
    return headers;
}

/**
 * 创建JSON响应
 */
export function jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: setCorsHeaders(new Headers({
            'Content-Type': 'application/json'
        }))
    });
}

/**
 * 创建错误响应
 */
export function errorResponse(message: string, status: number = 500): Response {
    return jsonResponse({ error: message }, status);
}
