/**
 * Sui 签名验证工具
 *
 * 用于验证客户端签名，确保只有资源所有者才能修改数据
 */

import { verifyPersonalMessageSignature } from '@mysten/sui/verify';

/**
 * 签名请求格式
 */
export interface SignedRequest {
    /** JSON.stringify({ action, address, timestamp, data }) */
    message: string;
    /** Base64 编码的签名 */
    signature: string;
}

/**
 * 消息载荷格式
 */
export interface MessagePayload {
    /** 操作类型：create_player, update_player, create_game 等 */
    action: string;
    /** 操作者地址 */
    address: string;
    /** 时间戳（毫秒） */
    timestamp: number;
    /** 实际数据 */
    data: any;
}

/**
 * 验证结果
 */
export interface AuthResult {
    valid: boolean;
    /** 签名者地址 */
    address?: string;
    /** 解析后的消息载荷 */
    payload?: MessagePayload;
    /** 错误信息 */
    error?: string;
}

/** 签名有效期（5分钟） */
const SIGNATURE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * 验证签名并解析消息
 * @param request 签名请求
 * @param expectedAction 可选：期望的 action，用于防止跨端点重放
 */
export async function verifyAndParseSignature(
    request: SignedRequest,
    expectedAction?: string
): Promise<AuthResult> {
    try {
        // 解析消息
        let payload: MessagePayload;
        try {
            payload = JSON.parse(request.message);
        } catch (e) {
            return { valid: false, error: 'Invalid message format' };
        }

        // 验证 timestamp 存在且为有效数字
        if (typeof payload.timestamp !== 'number' || !Number.isFinite(payload.timestamp)) {
            return { valid: false, error: 'Invalid or missing timestamp' };
        }

        // 检查时间戳（防止重放攻击）
        const now = Date.now();
        if (Math.abs(now - payload.timestamp) > SIGNATURE_EXPIRY_MS) {
            return { valid: false, error: 'Message expired' };
        }

        // 验证 action 匹配（防止跨端点重放）
        if (expectedAction && payload.action !== expectedAction) {
            return { valid: false, error: `Invalid action: expected ${expectedAction}, got ${payload.action}` };
        }

        // 验证签名
        const messageBytes = new TextEncoder().encode(request.message);
        const publicKey = await verifyPersonalMessageSignature(
            messageBytes,
            request.signature
        );

        // 从公钥派生地址
        const signerAddress = publicKey.toSuiAddress();

        return {
            valid: true,
            address: signerAddress,
            payload
        };
    } catch (error) {
        return {
            valid: false,
            error: `Signature verification failed: ${(error as Error).message}`
        };
    }
}

/**
 * 检查签名者是否有权限操作该资源
 *
 * @param signerAddress 签名者地址
 * @param ownerAddress 资源所有者地址
 */
export function checkOwnership(signerAddress: string, ownerAddress: string): boolean {
    // 地址比较（不区分大小写）
    return signerAddress.toLowerCase() === ownerAddress.toLowerCase();
}

/**
 * 解析请求体为签名请求格式
 * 如果请求体不是签名格式，返回 null
 */
export function parseSignedRequest(body: any): SignedRequest | null {
    if (
        body &&
        typeof body.message === 'string' &&
        typeof body.signature === 'string'
    ) {
        return {
            message: body.message,
            signature: body.signature
        };
    }
    return null;
}
