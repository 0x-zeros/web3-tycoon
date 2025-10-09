/**
 * Keystore 配置管理
 * 用于管理 keypair 的 storageKey 和 password
 *
 * 安全策略：
 * - storageKey: 持久化到 localStorage（可切换账号）
 * - password: 仅内存缓存（刷新页面后恢复默认值）
 */

const CONFIG_STORAGE_KEY = 'web3_tycoon_keystore_config_key';
const DEFAULT_STORAGE_KEY = 'dev0';
const DEFAULT_PASSWORD = 'password0';

/**
 * Keystore 配置单例
 */
export class KeystoreConfig {
    private static _instance: KeystoreConfig | null = null;

    // storageKey: 持久化
    private _storageKey: string = DEFAULT_STORAGE_KEY;

    // password: 仅内存（不持久化）
    private _password: string = DEFAULT_PASSWORD;

    private constructor() {
        // 从 localStorage 加载 storageKey
        this.loadStorageKey();
    }

    /**
     * 获取单例实例
     */
    public static get instance(): KeystoreConfig {
        if (!KeystoreConfig._instance) {
            KeystoreConfig._instance = new KeystoreConfig();
        }
        return KeystoreConfig._instance;
    }

    // ============ Storage Key 管理 ============

    /**
     * 获取 storageKey（如 'dev0', 'dev1'）
     */
    public getStorageKey(): string {
        return this._storageKey;
    }

    /**
     * 设置 storageKey（持久化到 localStorage）
     */
    public setStorageKey(key: string): void {
        this._storageKey = key || DEFAULT_STORAGE_KEY;
        this.saveStorageKey();
        console.log('[KeystoreConfig] Storage key updated:', this._storageKey);
    }

    /**
     * 获取完整的 localStorage key
     * @returns 如 'web3_tycoon_sui_dev0'
     */
    public getFullStorageKey(): string {
        return `web3_tycoon_sui_${this._storageKey}`;
    }

    /**
     * 加载 storageKey
     */
    private loadStorageKey(): void {
        const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (saved) {
            this._storageKey = saved;
            console.log('[KeystoreConfig] Loaded storage key from localStorage:', this._storageKey);
        } else {
            console.log('[KeystoreConfig] Using default storage key:', this._storageKey);
        }
    }

    /**
     * 保存 storageKey
     */
    private saveStorageKey(): void {
        localStorage.setItem(CONFIG_STORAGE_KEY, this._storageKey);
    }

    // ============ Password 管理 ============

    /**
     * 获取密码（仅内存缓存）
     */
    public getPassword(): string {
        return this._password;
    }

    /**
     * 设置密码（仅内存缓存，不持久化）
     * @param password 密码
     */
    public setPassword(password: string): void {
        this._password = password || DEFAULT_PASSWORD;
        console.log('[KeystoreConfig] Password updated (memory only)');
    }

    /**
     * 清除密码（恢复默认值）
     */
    public clearPassword(): void {
        this._password = DEFAULT_PASSWORD;
        console.log('[KeystoreConfig] Password cleared (reset to default)');
    }

    // ============ 工具方法 ============

    /**
     * 重置所有配置
     */
    public reset(): void {
        this._storageKey = DEFAULT_STORAGE_KEY;
        this._password = DEFAULT_PASSWORD;
        localStorage.removeItem(CONFIG_STORAGE_KEY);
        console.log('[KeystoreConfig] Reset to defaults');
    }

    /**
     * 获取配置摘要
     */
    public getSummary(): {
        storageKey: string;
        fullStorageKey: string;
        hasPassword: boolean;
    } {
        return {
            storageKey: this._storageKey,
            fullStorageKey: this.getFullStorageKey(),
            hasPassword: this._password !== ''
        };
    }
}
