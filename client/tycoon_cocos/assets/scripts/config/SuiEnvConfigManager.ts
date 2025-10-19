/**
 * Sui 环境配置管理器
 *
 * 功能：
 * - 管理 4 个网络环境配置（mainnet/testnet/devnet/localnet）
 * - 持久化用户选择到 localStorage
 * - 启动时加载保存的配置
 *
 * 使用：
 * - GameInitializer.initializeSuiManager() 时调用 loadAndGetConfig()
 * - UISuiConfig 切换网络时调用 save()
 */

import { SuiConfig, fromEnvConfig, NetworkType } from '../sui/config/SuiConfig';

// 导入 4 个环境配置
import { SuiEnvConfig as MainnetConfig } from './env.mainnet';
import { SuiEnvConfig as TestnetConfig } from './env.testnet';
import { SuiEnvConfig as DevnetConfig } from './env.devnet';
import { SuiEnvConfig as LocalnetConfig } from './env.localnet';

/**
 * 保存的配置接口
 */
interface SavedConfig {
    /** 网络类型 */
    network: NetworkType;
    /** 签名器类型 */
    signerType: 'wallet' | 'keypair';
}

/**
 * Sui 环境配置管理器（单例）
 */
export class SuiEnvConfigManager {
    private static _instance: SuiEnvConfigManager | null = null;

    /** localStorage 键名 */
    private static readonly STORAGE_KEY = 'web3_tycoon_sui_env_config';

    /** 默认配置 */
    private static readonly DEFAULT_CONFIG: SavedConfig = {
        network: 'testnet',
        signerType: 'wallet'
    };

    /**
     * 私有构造函数
     */
    private constructor() {}

    /**
     * 获取单例实例
     */
    public static get instance(): SuiEnvConfigManager {
        if (!SuiEnvConfigManager._instance) {
            SuiEnvConfigManager._instance = new SuiEnvConfigManager();
        }
        return SuiEnvConfigManager._instance;
    }

    // ============ 配置加载 ============

    /**
     * 加载保存的配置
     * @returns 保存的配置或默认配置
     */
    public load(): SavedConfig {
        try {
            const saved = localStorage.getItem(SuiEnvConfigManager.STORAGE_KEY);
            if (saved) {
                const config = JSON.parse(saved) as SavedConfig;
                console.log('[SuiEnvConfigManager] 从 localStorage 加载配置:', config);
                return config;
            }
        } catch (error) {
            console.error('[SuiEnvConfigManager] 加载配置失败:', error);
        }

        console.log('[SuiEnvConfigManager] 使用默认配置:', SuiEnvConfigManager.DEFAULT_CONFIG);
        return { ...SuiEnvConfigManager.DEFAULT_CONFIG };
    }

    /**
     * 保存配置到 localStorage
     * @param network 网络类型
     * @param signerType 签名器类型
     */
    public save(network: NetworkType, signerType: 'wallet' | 'keypair'): void {
        const config: SavedConfig = { network, signerType };

        try {
            localStorage.setItem(SuiEnvConfigManager.STORAGE_KEY, JSON.stringify(config));
            console.log('[SuiEnvConfigManager] 配置已保存:', config);
        } catch (error) {
            console.error('[SuiEnvConfigManager] 保存配置失败:', error);
        }
    }

    /**
     * 清除保存的配置
     */
    public clear(): void {
        localStorage.removeItem(SuiEnvConfigManager.STORAGE_KEY);
        console.log('[SuiEnvConfigManager] 配置已清除');
    }

    // ============ 环境配置获取 ============

    /**
     * 根据网络名称和签名器类型获取 SuiConfig
     * @param network 网络类型
     * @param signerType 签名器类型
     * @returns SuiConfig 对象
     */
    public getConfig(network: NetworkType, signerType: 'wallet' | 'keypair'): SuiConfig {
        let envConfig;

        switch (network) {
            case 'mainnet':
                envConfig = MainnetConfig;
                break;
            case 'testnet':
                envConfig = TestnetConfig;
                break;
            case 'devnet':
                envConfig = DevnetConfig;
                break;
            case 'localnet':
                envConfig = LocalnetConfig;
                break;
            default:
                console.warn(`[SuiEnvConfigManager] 未知网络: ${network}, 使用 testnet`);
                envConfig = TestnetConfig;
        }

        // 转换为 SuiConfig，并覆盖 signerType
        const config = fromEnvConfig(envConfig);
        config.signerType = signerType;

        return config;
    }

    /**
     * 加载保存的配置并返回 SuiConfig
     * （用于启动时初始化）
     *
     * @returns SuiConfig 对象
     */
    public loadAndGetConfig(): SuiConfig {
        const saved = this.load();
        return this.getConfig(saved.network, saved.signerType);
    }

    // ============ 工具方法 ============

    /**
     * 获取当前保存的配置摘要
     */
    public getSummary(): SavedConfig {
        return this.load();
    }

    /**
     * 检查是否使用默认配置
     */
    public isUsingDefaults(): boolean {
        const saved = this.load();
        return (
            saved.network === SuiEnvConfigManager.DEFAULT_CONFIG.network &&
            saved.signerType === SuiEnvConfigManager.DEFAULT_CONFIG.signerType
        );
    }
}

/**
 * 便捷的全局访问器
 */
export const suiEnvConfigManager = SuiEnvConfigManager.instance;
