/**
 * RPC 配置管理器
 * 管理 RPC 限速模式和自定义 RPC URL
 */

/**
 * RPC 配置接口
 */
export interface RpcConfig {
    /** 模式：default（默认快速）或 ratelimit（限速）*/
    mode: 'default' | 'ratelimit';
    /** 自定义 RPC URL（可选）*/
    customRpcUrl?: string;
}

/**
 * 轮询间隔配置（毫秒）
 */
const INTERVALS = {
    default: {
        eventIndexer: 1000,   // 1 秒（快速响应）
        dataPolling: 2000,    // 2 秒
    },
    ratelimit: {
        eventIndexer: 5000,   // 5 秒（降低 80%，避免 429）
        dataPolling: 10000,   // 10 秒
    }
};

/**
 * RPC 配置管理器（单例）
 */
export class RpcConfigManager {
    private static readonly STORAGE_KEY = 'sui_rpc_config';
    private static config: RpcConfig = { mode: 'default' };
    private static loaded: boolean = false;

    /**
     * 从 localStorage 加载配置
     */
    public static load(): void {
        if (this.loaded) return;

        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.config = {
                    mode: parsed.mode || 'default',
                    customRpcUrl: parsed.customRpcUrl
                };
                console.log('[RpcConfig] Loaded from localStorage:', this.config);
            } else {
                console.log('[RpcConfig] No stored config, using defaults');
            }
        } catch (error) {
            console.error('[RpcConfig] Failed to load config:', error);
        }

        this.loaded = true;
    }

    /**
     * 保存配置到 localStorage
     */
    private static save(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
            console.log('[RpcConfig] Saved to localStorage:', this.config);
        } catch (error) {
            console.error('[RpcConfig] Failed to save config:', error);
        }
    }

    /**
     * 设置模式
     * @param mode 'default' 或 'ratelimit'
     */
    public static setMode(mode: 'default' | 'ratelimit'): void {
        this.load();
        this.config.mode = mode;
        this.save();
        console.log('[RpcConfig] Mode set to:', mode);
    }

    /**
     * 设置自定义 RPC URL
     * @param url RPC URL（空字符串表示清除）
     */
    public static setCustomRpc(url: string | undefined): void {
        this.load();
        this.config.customRpcUrl = url;
        this.save();
        console.log('[RpcConfig] Custom RPC set to:', url || 'none');
    }

    /**
     * 获取当前模式
     */
    public static getMode(): 'default' | 'ratelimit' {
        this.load();
        return this.config.mode;
    }

    /**
     * 获取自定义 RPC URL
     */
    public static getCustomRpcUrl(): string | undefined {
        this.load();
        return this.config.customRpcUrl;
    }

    /**
     * 获取 EventIndexer 轮询间隔
     */
    public static getEventIndexerInterval(): number {
        this.load();
        return INTERVALS[this.config.mode].eventIndexer;
    }

    /**
     * 获取 DataPolling 轮询间隔
     */
    public static getDataPollingInterval(): number {
        this.load();
        return INTERVALS[this.config.mode].dataPolling;
    }

    /**
     * 获取完整配置（调试用）
     */
    public static getConfig(): RpcConfig {
        this.load();
        return { ...this.config };
    }

    /**
     * 重置为默认配置
     */
    public static reset(): void {
        this.config = { mode: 'default' };
        this.save();
        console.log('[RpcConfig] Reset to defaults');
    }
}
