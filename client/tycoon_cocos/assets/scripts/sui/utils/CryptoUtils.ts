/**
 * 加密工具
 * 使用 Web Crypto API 实现 AES-GCM 加密
 * 参考 MetaMask 等钱包的加密方式
 */

/**
 * 使用 AES-GCM 加密字符串
 * @param plaintext 明文
 * @param password 密码
 * @returns Base64 编码的密文（包含 salt + iv + ciphertext）
 */
export async function encryptWithPassword(plaintext: string, password: string): Promise<string> {
    const enc = new TextEncoder();

    // 1. 从密码派生密钥（PBKDF2）
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // 2. 生成 salt 和派生 AES 密钥
    const salt = crypto.getRandomValues(new Uint8Array(16));
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

    // 3. 生成 IV 并加密
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(plaintext)
    );

    // 4. 组合数据：salt(16) + iv(12) + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // 5. Base64 编码
    return btoa(String.fromCharCode(...combined));
}

/**
 * 使用 AES-GCM 解密字符串
 * @param ciphertext Base64 编码的密文
 * @param password 密码
 * @returns 明文
 */
export async function decryptWithPassword(ciphertext: string, password: string): Promise<string> {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    // 1. Base64 解码
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

    // 2. 分离 salt, iv, ciphertext
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    // 3. 从密码派生密钥
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

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

    // 4. 解密
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
    );

    return dec.decode(decrypted);
}
