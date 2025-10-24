/**
 * 加密工具
 * 使用 Web Crypto API 实现 AES-GCM 加密
 * 参考 MetaMask 的 @metamask/browser-passworder 实现
 *
 * 环境兼容性：
 * - 浏览器环境：使用 Web Crypto API（最安全）
 * - Cocos Editor 环境：降级为 Base64 编码（仅开发调试）
 */

// 检测 Web Crypto API 是否可用
const HAS_WEB_CRYPTO = typeof crypto !== 'undefined' && crypto.subtle !== undefined;

if (!HAS_WEB_CRYPTO) {
    console.warn('[CryptoUtils] Web Crypto API not available (Cocos Editor environment)');
    console.warn('[CryptoUtils] Falling back to Base64 encoding (DEV ONLY, NOT SECURE)');
}

/**
 * 使用 AES-GCM 加密字符串（浏览器）或 Base64 编码（Editor）
 * @param plaintext 明文
 * @param password 密码
 * @returns Base64 编码的密文
 */
export async function encryptWithPassword(plaintext: string, password: string): Promise<string> {
    console.log('[CryptoUtils] Encrypt: START');
    console.log('  Plaintext length:', plaintext.length);
    console.log('  Environment:', HAS_WEB_CRYPTO ? 'Browser (secure)' : 'Editor (base64)');

    // ✅ Cocos Editor 环境：降级为 Base64（开发调试可接受）
    if (!HAS_WEB_CRYPTO) {
        console.warn('[CryptoUtils] Using Base64 encoding (NOT ENCRYPTED)');
        const result = btoa(unescape(encodeURIComponent(plaintext)));
        console.log('[CryptoUtils] Encrypt: SUCCESS (base64)');
        return result;
    }

    // ✅ 浏览器环境：使用 Web Crypto API（生产环境）
    try {
        const enc = new TextEncoder();

        // 1. 从密码派生密钥（PBKDF2）
        console.log('[CryptoUtils] Encrypt: Step 1 - Importing password key');
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        console.log('  Password key imported');

        // 2. 生成 salt 和派生 AES 密钥
        console.log('[CryptoUtils] Encrypt: Step 2 - Deriving AES key');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        console.log('  Salt length:', salt.length);

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        console.log('  AES key derived');

        // 3. 生成 IV 并加密
        console.log('[CryptoUtils] Encrypt: Step 3 - Encrypting');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        console.log('  IV length:', iv.length);

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(plaintext)
        );
        console.log('  Encrypted byteLength:', encrypted.byteLength);

        // 4. 组合数据：salt(16) + iv(12) + ciphertext
        console.log('[CryptoUtils] Encrypt: Step 4 - Combining data');
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        console.log('  Combined length:', combined.length);

        // 5. Base64 编码
        console.log('[CryptoUtils] Encrypt: Step 5 - Base64 encoding');
        const result = btoa(String.fromCharCode(...combined));
        console.log('  Result length:', result.length);

        console.log('[CryptoUtils] Encrypt: SUCCESS');
        return result;

    } catch (error) {
        console.error('[CryptoUtils] Encrypt: FAILED');
        console.error('  Error:', error);
        throw error;
    }
}

/**
 * 使用 AES-GCM 解密字符串（浏览器）或 Base64 解码（Editor）
 * @param ciphertext Base64 编码的密文
 * @param password 密码
 * @returns 明文
 */
export async function decryptWithPassword(ciphertext: string, password: string): Promise<string> {
    console.log('[CryptoUtils] Decrypt: START');
    console.log('  Ciphertext length:', ciphertext.length);
    console.log('  Environment:', HAS_WEB_CRYPTO ? 'Browser (secure)' : 'Editor (base64)');

    // ✅ Cocos Editor 环境：降级为 Base64
    if (!HAS_WEB_CRYPTO) {
        console.warn('[CryptoUtils] Using Base64 decoding (NOT ENCRYPTED)');
        const result = decodeURIComponent(escape(atob(ciphertext)));
        console.log('[CryptoUtils] Decrypt: SUCCESS (base64)');
        return result;
    }

    // ✅ 浏览器环境：使用 Web Crypto API
    try {
        const enc = new TextEncoder();
        const dec = new TextDecoder();

        // 1. Base64 解码
        console.log('[CryptoUtils] Decrypt: Step 1 - Base64 decoding');
        const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        console.log('  Combined length:', combined.length);

        // 2. 分离 salt, iv, ciphertext
        console.log('[CryptoUtils] Decrypt: Step 2 - Separating data');
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);
        console.log('  Salt length:', salt.length);
        console.log('  IV length:', iv.length);
        console.log('  Encrypted length:', encrypted.length);

        // 3. 从密码派生密钥
        console.log('[CryptoUtils] Decrypt: Step 3 - Importing password key');
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        console.log('  Password key imported');

        console.log('[CryptoUtils] Decrypt: Step 4 - Deriving AES key');
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        console.log('  AES key derived');

        // 4. 解密
        console.log('[CryptoUtils] Decrypt: Step 5 - Decrypting');
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        console.log('  Decrypted byteLength:', decrypted.byteLength);

        const result = dec.decode(decrypted);
        console.log('  Result length:', result.length);

        console.log('[CryptoUtils] Decrypt: SUCCESS');
        return result;

    } catch (error) {
        console.error('[CryptoUtils] Decrypt: FAILED');
        console.error('  Error:', error);
        console.error('  Error type:', error instanceof Error ? error.constructor.name : typeof error);

        // 判断错误类型，给出明确提示
        if (error instanceof Error) {
            const errorName = error.name;
            const errorMsg = error.message;

            console.error('  Error name:', errorName);
            console.error('  Error message:', errorMsg);

            // OperationError 通常表示密码错误（AES-GCM 解密失败）
            if (errorName === 'OperationError') {
                const passwordError = new Error('密码错误：无法解密数据。请检查密码是否正确。');
                passwordError.name = 'PasswordError';
                console.error('[CryptoUtils] → 解密失败，很可能是密码不正确');
                console.error('[CryptoUtils] → 提示：请通过 Sui 配置界面修改密码');
                throw passwordError;
            }

            // 其他错误（如 Base64 解码失败）可能是数据损坏
            if (errorMsg.includes('atob') || errorMsg.includes('base64')) {
                const dataError = new Error('数据损坏：存储的加密数据格式错误。');
                dataError.name = 'DataCorruptionError';
                console.error('[CryptoUtils] → 数据格式错误，可能已损坏');
                console.error('[CryptoUtils] → 提示：可能需要清除本地数据');
                throw dataError;
            }
        }

        // 未知错误，原样抛出
        throw error;
    }
}
