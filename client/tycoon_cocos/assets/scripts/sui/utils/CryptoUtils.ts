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
    console.log('[CryptoUtils] Encrypt: START');
    console.log('  Plaintext length:', plaintext.length);

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
 * 使用 AES-GCM 解密字符串
 * @param ciphertext Base64 编码的密文
 * @param password 密码
 * @returns 明文
 */
export async function decryptWithPassword(ciphertext: string, password: string): Promise<string> {
    console.log('[CryptoUtils] Decrypt: START');
    console.log('  Ciphertext length:', ciphertext.length);

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
        throw error;
    }
}
