/**
 * 配置文件加载器
 * 
 * 统一管理游戏配置文件的加载和解析
 * 支持JSON格式配置文件的异步加载和缓存
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, resources, JsonAsset } from 'cc';
import { RoleData, NPCData, PlayerData } from '../role/RoleTypes';
import { SkillConfig } from '../skill/SkillTypes';

const { ccclass } = _decorator;

/**
 * 配置文件类型枚举
 */
export enum ConfigType {
    ROLES = 'roles',
    SKILLS = 'skills',
    NPCS = 'npcs',
    PLAYERS = 'players',
    MAPS = 'maps',
    CARDS = 'cards'
}

/**
 * 配置文件信息接口
 */
export interface ConfigInfo {
    /** 配置类型 */
    type: ConfigType;
    /** 文件路径（相对于resources目录） */
    path: string;
    /** 是否必需 */
    required: boolean;
    /** 版本号 */
    version?: string;
}

/**
 * 配置文件集合接口
 */
export interface GameConfigs {
    roles?: RoleData[];
    skills?: SkillConfig[];
    npcs?: NPCData[];
    players?: PlayerData[];
    maps?: any[];
    cards?: any[];
}

/**
 * 配置加载结果接口
 */
export interface ConfigLoadResult {
    /** 是否成功 */
    success: boolean;
    /** 错误消息 */
    error?: string;
    /** 加载的配置数据 */
    data?: any;
    /** 加载时间（毫秒） */
    loadTime?: number;
}

/**
 * 配置文件加载器
 * 单例模式，统一管理所有配置文件的加载
 */
@ccclass('ConfigLoader')
export class ConfigLoader extends Component {
    // 单例实例
    private static _instance: ConfigLoader | null = null;

    // 配置文件信息
    private configInfos: Map<ConfigType, ConfigInfo> = new Map();
    
    // 配置数据缓存
    private configCache: Map<ConfigType, any> = new Map();
    
    // 加载状态
    private loadingStates: Map<ConfigType, boolean> = new Map();
    
    // 加载队列
    private loadQueue: ConfigType[] = [];
    
    // 是否初始化完成
    private initialized: boolean = false;

    /**
     * 获取单例实例
     */
    public static getInstance(): ConfigLoader | null {
        return ConfigLoader._instance;
    }

    protected onLoad(): void {
        // 设置单例
        if (ConfigLoader._instance === null) {
            ConfigLoader._instance = this;
        } else {
            this.destroy();
            return;
        }

        this.initializeConfigInfos();
    }

    protected onDestroy(): void {
        if (ConfigLoader._instance === this) {
            ConfigLoader._instance = null;
        }
    }

    /**
     * 初始化配置文件信息
     */
    private initializeConfigInfos(): void {
        // 注册配置文件信息
        this.registerConfig(ConfigType.ROLES, 'data/configs/roles', true);
        this.registerConfig(ConfigType.SKILLS, 'data/configs/skills', true);
        this.registerConfig(ConfigType.NPCS, 'data/configs/npcs', true);
        this.registerConfig(ConfigType.PLAYERS, 'data/configs/players', false);
        this.registerConfig(ConfigType.MAPS, 'data/configs/maps', false);
        this.registerConfig(ConfigType.CARDS, 'data/configs/cards', false);

        this.initialized = true;
    }

    /**
     * 注册配置文件
     */
    public registerConfig(type: ConfigType, path: string, required: boolean = false, version?: string): void {
        this.configInfos.set(type, {
            type,
            path,
            required,
            version
        });
    }

    /**
     * 加载单个配置文件
     */
    public async loadConfig(type: ConfigType, forceReload: boolean = false): Promise<ConfigLoadResult> {
        // 检查是否已在加载中
        if (this.loadingStates.get(type)) {
            return {
                success: false,
                error: `配置文件 ${type} 正在加载中`
            };
        }

        // 检查缓存
        if (!forceReload && this.configCache.has(type)) {
            return {
                success: true,
                data: this.configCache.get(type)
            };
        }

        const configInfo = this.configInfos.get(type);
        if (!configInfo) {
            return {
                success: false,
                error: `未找到配置文件信息: ${type}`
            };
        }

        const startTime = Date.now();
        this.loadingStates.set(type, true);

        try {
            const data = await this.loadJsonAsset(configInfo.path);
            const loadTime = Date.now() - startTime;

            // 验证数据
            const validationResult = this.validateConfigData(type, data);
            if (!validationResult.success) {
                return {
                    success: false,
                    error: validationResult.error,
                    loadTime
                };
            }

            // 缓存数据
            this.configCache.set(type, data);

            console.log(`配置文件加载成功: ${type}, 耗时: ${loadTime}ms`);
            
            return {
                success: true,
                data,
                loadTime
            };

        } catch (error) {
            const loadTime = Date.now() - startTime;
            const errorMsg = `加载配置文件失败: ${type}, 错误: ${error}`;
            console.error(errorMsg);
            
            return {
                success: false,
                error: errorMsg,
                loadTime
            };
        } finally {
            this.loadingStates.set(type, false);
        }
    }

    /**
     * 批量加载配置文件
     */
    public async loadConfigs(types: ConfigType[], forceReload: boolean = false): Promise<Map<ConfigType, ConfigLoadResult>> {
        const results = new Map<ConfigType, ConfigLoadResult>();
        const loadPromises: Promise<void>[] = [];

        for (const type of types) {
            const promise = this.loadConfig(type, forceReload).then(result => {
                results.set(type, result);
            });
            loadPromises.push(promise);
        }

        await Promise.all(loadPromises);
        return results;
    }

    /**
     * 加载所有必需的配置文件
     */
    public async loadRequiredConfigs(forceReload: boolean = false): Promise<ConfigLoadResult> {
        if (!this.initialized) {
            return {
                success: false,
                error: '配置加载器未初始化'
            };
        }

        const requiredTypes: ConfigType[] = [];
        for (const [type, info] of this.configInfos) {
            if (info.required) {
                requiredTypes.push(type);
            }
        }

        const startTime = Date.now();
        const results = await this.loadConfigs(requiredTypes, forceReload);
        const loadTime = Date.now() - startTime;

        // 检查是否有加载失败的必需文件
        const failures: string[] = [];
        for (const [type, result] of results) {
            if (!result.success) {
                failures.push(`${type}: ${result.error}`);
            }
        }

        if (failures.length > 0) {
            return {
                success: false,
                error: `必需配置文件加载失败:\n${failures.join('\n')}`,
                loadTime
            };
        }

        console.log(`所有必需配置文件加载成功, 总耗时: ${loadTime}ms`);
        return {
            success: true,
            loadTime
        };
    }

    /**
     * 获取配置数据
     */
    public getConfig<T = any>(type: ConfigType): T | null {
        return this.configCache.get(type) || null;
    }

    /**
     * 获取所有配置数据
     */
    public getAllConfigs(): GameConfigs {
        return {
            roles: this.getConfig(ConfigType.ROLES),
            skills: this.getConfig(ConfigType.SKILLS),
            npcs: this.getConfig(ConfigType.NPCS),
            players: this.getConfig(ConfigType.PLAYERS),
            maps: this.getConfig(ConfigType.MAPS),
            cards: this.getConfig(ConfigType.CARDS)
        };
    }

    /**
     * 清除配置缓存
     */
    public clearCache(type?: ConfigType): void {
        if (type) {
            this.configCache.delete(type);
        } else {
            this.configCache.clear();
        }
    }

    /**
     * 检查配置是否已加载
     */
    public isConfigLoaded(type: ConfigType): boolean {
        return this.configCache.has(type);
    }

    /**
     * 获取加载状态
     */
    public getLoadingState(type: ConfigType): boolean {
        return this.loadingStates.get(type) || false;
    }

    /**
     * 重新加载配置文件
     */
    public async reloadConfig(type: ConfigType): Promise<ConfigLoadResult> {
        this.clearCache(type);
        return await this.loadConfig(type, true);
    }

    /**
     * 获取配置文件统计信息
     */
    public getStats(): {
        registered: number;
        loaded: number;
        cached: number;
        loading: number;
    } {
        let loadingCount = 0;
        for (const loading of this.loadingStates.values()) {
            if (loading) loadingCount++;
        }

        return {
            registered: this.configInfos.size,
            loaded: this.configCache.size,
            cached: this.configCache.size,
            loading: loadingCount
        };
    }

    // 私有辅助方法

    /**
     * 加载JSON资源
     */
    private loadJsonAsset(path: string): Promise<any> {
        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, asset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(asset.json);
                }
            });
        });
    }

    /**
     * 验证配置数据
     */
    private validateConfigData(type: ConfigType, data: any): { success: boolean; error?: string } {
        if (!data) {
            return {
                success: false,
                error: '配置数据为空'
            };
        }

        // 基本格式检查
        switch (type) {
            case ConfigType.ROLES:
            case ConfigType.NPCS:
            case ConfigType.PLAYERS:
            case ConfigType.SKILLS:
                if (!Array.isArray(data)) {
                    return {
                        success: false,
                        error: `配置数据应为数组格式: ${type}`
                    };
                }
                break;
        }

        // 具体格式检查
        switch (type) {
            case ConfigType.SKILLS:
                return this.validateSkillsConfig(data);
            case ConfigType.ROLES:
                return this.validateRolesConfig(data);
            default:
                // 其他类型暂时不做详细验证
                break;
        }

        return { success: true };
    }

    /**
     * 验证技能配置数据
     */
    private validateSkillsConfig(data: any[]): { success: boolean; error?: string } {
        for (let i = 0; i < data.length; i++) {
            const skill = data[i];
            if (!skill.id || !skill.name || !skill.type) {
                return {
                    success: false,
                    error: `技能配置数据不完整: 索引 ${i}, 缺少必需字段 id/name/type`
                };
            }
        }
        return { success: true };
    }

    /**
     * 验证角色配置数据
     */
    private validateRolesConfig(data: any[]): { success: boolean; error?: string } {
        for (let i = 0; i < data.length; i++) {
            const role = data[i];
            if (!role.roleId || !role.roleType) {
                return {
                    success: false,
                    error: `角色配置数据不完整: 索引 ${i}, 缺少必需字段 roleId/roleType`
                };
            }
        }
        return { success: true };
    }
}

/**
 * 全局ConfigLoader访问器
 */
export const configLoader = {
    get instance(): ConfigLoader | null {
        return ConfigLoader.getInstance();
    }
};