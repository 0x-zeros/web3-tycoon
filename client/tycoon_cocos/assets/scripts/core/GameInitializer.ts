/**
 * 游戏初始化管理器
 * 
 * 负责游戏启动时的系统初始化和配置加载
 * 统一管理各个系统的初始化顺序和依赖关系
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, director, Node, game, resources, Prefab, instantiate } from 'cc';
import { ConfigLoader, ConfigType } from '../config/ConfigLoader';
import { RoleManager } from '../role/RoleManager';
import { SkillManager } from '../skill/SkillManager';
import { UIManager } from '../ui/core/UIManager';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { fromEntries } from '../utils/object-utils';
import { MapManager } from '../map/MapManager';

const { ccclass, property } = _decorator;

/**
 * 初始化阶段枚举
 */
export enum InitializationPhase {
    NONE = 'none',
    CONFIG_LOADING = 'config_loading',
    MANAGERS_INIT = 'managers_init',
    SYSTEMS_INIT = 'systems_init',
    GAME_READY = 'game_ready',
    FAILED = 'failed'
}

/**
 * 初始化结果接口
 */
export interface InitializationResult {
    success: boolean;
    phase: InitializationPhase;
    error?: string;
    loadTime?: number;
    details?: { [key: string]: any };
}

/**
 * gameWorld or gameManager
 * 游戏初始化管理器
 * 单例模式，控制游戏的整体初始化流程
 */
@ccclass('GameInitializer')
export class GameInitializer extends Component {
    @property({ displayName: "配置加载器节点", type: Node, tooltip: "ConfigLoader组件所在节点" })
    public configLoaderNode: Node | null = null;

    @property({ displayName: "角色管理器节点", type: Node, tooltip: "RoleManager组件所在节点" })
    public roleManagerNode: Node | null = null;

    @property({ displayName: "技能管理器节点", type: Node, tooltip: "SkillManager组件所在节点" })
    public skillManagerNode: Node | null = null;

    @property({ displayName: "显示加载进度", tooltip: "是否在控制台显示加载进度" })
    public showProgress: boolean = true;

    @property({ displayName: "启用性能监测", tooltip: "是否启用初始化性能监测" })
    public enableProfiling: boolean = true;

    @property({ displayName: "地图容器节点", type: Node, tooltip: "地图预制体将加载到此节点下" })
    public mapContainer: Node | null = null;

    @property({ displayName: "地图管理器节点", type: Node, tooltip: "MapManager组件所在节点" })
    public mapManagerNode: Node | null = null;

    // 单例实例
    private static _instance: GameInitializer | null = null;

    // 当前初始化阶段
    private currentPhase: InitializationPhase = InitializationPhase.NONE;

    // 系统管理器引用
    private configLoader: ConfigLoader | null = null;
    private roleManager: RoleManager | null = null;
    private skillManager: SkillManager | null = null;
    private mapManager: MapManager | null = null;

    // 初始化性能数据
    private initStartTime: number = 0;
    private phaseStartTime: number = 0;
    private performanceLog: Map<string, number> = new Map();


    /**
     * 获取单例实例
     */
    public static getInstance(): GameInitializer | null {
        return GameInitializer._instance;
    }

    protected onLoad(): void {
        // 设置单例
        if (GameInitializer._instance === null) {
            GameInitializer._instance = this;
            director.addPersistRootNode(this.node);
        } else {
            this.destroy();
            return;
        }
    }

    protected async start(): Promise<void> {
        // 自动开始初始化
        const initResult = await this.initializeGame();
        
        if (initResult.success) {
            // 初始化UI系统并显示模式选择界面
            await UIManager.initializeGameUI();
            console.log('UI系统初始化完成，显示模式选择界面');
        } else {
            console.error('游戏初始化失败:', initResult.error);
        }
    }

    protected onDestroy(): void {
        if (GameInitializer._instance === this) {
            GameInitializer._instance = null;
        }
    }

    /**
     * 初始化游戏
     */
    public async initializeGame(): Promise<InitializationResult> {
        console.log('开始游戏初始化...');
        this.initStartTime = Date.now();
        
        try {
            // 阶段1: 加载配置文件
            let result = await this.loadConfigurations();
            if (!result.success) {
                return this.handleInitializationError('配置加载失败', result.error);
            }

            // 阶段2: 初始化管理器
            result = await this.initializeManagers();
            if (!result.success) {
                return this.handleInitializationError('管理器初始化失败', result.error);
            }

            // 阶段3: 初始化游戏系统
            result = await this.initializeSystems();
            if (!result.success) {
                return this.handleInitializationError('系统初始化失败', result.error);
            }

            // 初始化完成
            this.currentPhase = InitializationPhase.GAME_READY;
            const totalTime = Date.now() - this.initStartTime;

            console.log(`游戏初始化完成! 总耗时: ${totalTime}ms`);
            this.logPerformanceData();

            return {
                success: true,
                phase: InitializationPhase.GAME_READY,
                loadTime: totalTime,
                details: fromEntries(this.performanceLog)
            };

        } catch (error) {
            return this.handleInitializationError('初始化过程中发生异常', error.toString());
        }
    }

    /**
     * 阶段1: 加载配置文件
     */
    private async loadConfigurations(): Promise<InitializationResult> {
        this.enterPhase(InitializationPhase.CONFIG_LOADING, '加载配置文件...');

        try {
            // 获取配置加载器
            if (this.configLoaderNode) {
                this.configLoader = this.configLoaderNode.getComponent(ConfigLoader);
            }
            
            if (!this.configLoader) {
                return {
                    success: false,
                    phase: InitializationPhase.CONFIG_LOADING,
                    error: '无法找到ConfigLoader组件'
                };
            }

            // 加载必需配置
            const loadResult = await this.configLoader.loadRequiredConfigs();
            if (!loadResult.success) {
                return {
                    success: false,
                    phase: InitializationPhase.CONFIG_LOADING,
                    error: loadResult.error
                };
            }

            this.recordPhaseTime('配置加载');
            return {
                success: true,
                phase: InitializationPhase.CONFIG_LOADING,
                loadTime: loadResult.loadTime
            };

        } catch (error) {
            return {
                success: false,
                phase: InitializationPhase.CONFIG_LOADING,
                error: `配置加载异常: ${error}`
            };
        }
    }

    /**
     * 阶段2: 初始化管理器
     */
    private async initializeManagers(): Promise<InitializationResult> {
        this.enterPhase(InitializationPhase.MANAGERS_INIT, '初始化管理器...');

        try {
            // 初始化技能管理器
            if (this.skillManagerNode) {
                this.skillManager = this.skillManagerNode.getComponent(SkillManager);
                if (this.skillManager) {
                    const skillsLoaded = await this.skillManager.loadSkillConfigs();
                    if (!skillsLoaded) {
                        return {
                            success: false,
                            phase: InitializationPhase.MANAGERS_INIT,
                            error: '技能配置加载失败'
                        };
                    }
                    console.log('技能管理器初始化完成');
                }
            }

            // 初始化角色管理器
            if (this.roleManagerNode) {
                this.roleManager = this.roleManagerNode.getComponent(RoleManager);
                if (this.roleManager) {
                    console.log('角色管理器初始化完成');
                }
            }

            // 初始化地图管理器
            if (this.mapManagerNode) {
                this.mapManager = this.mapManagerNode.getComponent(MapManager);
                if (this.mapManager) {
                    console.log('地图管理器初始化完成');
                }
            }

            this.recordPhaseTime('管理器初始化');
            return {
                success: true,
                phase: InitializationPhase.MANAGERS_INIT
            };

        } catch (error) {
            return {
                success: false,
                phase: InitializationPhase.MANAGERS_INIT,
                error: `管理器初始化异常: ${error}`
            };
        }
    }

    /**
     * 阶段3: 初始化游戏系统
     */
    private async initializeSystems(): Promise<InitializationResult> {
        this.enterPhase(InitializationPhase.SYSTEMS_INIT, '初始化游戏系统...');

        try {
            // 初始化事件系统
            this.initializeEventSystem();

            // 设置全局访问器
            this.setupGlobalAccessors();

            // 注册游戏事件监听器
            this.registerEventListeners();

            this.recordPhaseTime('系统初始化');
            return {
                success: true,
                phase: InitializationPhase.SYSTEMS_INIT
            };

        } catch (error) {
            return {
                success: false,
                phase: InitializationPhase.SYSTEMS_INIT,
                error: `系统初始化异常: ${error}`
            };
        }
    }

    /**
     * 获取当前初始化阶段
     */
    public getCurrentPhase(): InitializationPhase {
        return this.currentPhase;
    }

    /**
     * 检查游戏是否已准备就绪
     */
    public isGameReady(): boolean {
        return this.currentPhase === InitializationPhase.GAME_READY;
    }

    /**
     * 获取系统管理器
     */
    public getConfigLoader(): ConfigLoader | null {
        return this.configLoader;
    }

    public getRoleManager(): RoleManager | null {
        return this.roleManager;
    }

    public getSkillManager(): SkillManager | null {
        return this.skillManager;
    }

    /**
     * 重新初始化游戏
     */
    public async reinitialize(): Promise<InitializationResult> {
        console.log('重新初始化游戏...');
        
        // 重置状态
        this.currentPhase = InitializationPhase.NONE;
        this.performanceLog.clear();
        
        // 清除配置缓存
        if (this.configLoader) {
            this.configLoader.clearCache();
        }

        return await this.initializeGame();
    }

    // 私有辅助方法

    /**
     * 进入新的初始化阶段
     */
    private enterPhase(phase: InitializationPhase, message: string): void {
        this.currentPhase = phase;
        this.phaseStartTime = Date.now();
        
        if (this.showProgress) {
            console.log(`[${phase.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 记录阶段耗时
     */
    private recordPhaseTime(phaseName: string): void {
        if (this.enableProfiling) {
            const phaseTime = Date.now() - this.phaseStartTime;
            this.performanceLog.set(phaseName, phaseTime);
        }
    }

    /**
     * 处理初始化错误
     */
    private handleInitializationError(message: string, error?: string): InitializationResult {
        this.currentPhase = InitializationPhase.FAILED;
        const fullError = error ? `${message}: ${error}` : message;
        
        console.error(`[INIT ERROR] ${fullError}`);
        
        return {
            success: false,
            phase: InitializationPhase.FAILED,
            error: fullError,
            loadTime: Date.now() - this.initStartTime
        };
    }

    /**
     * 初始化事件系统
     */
    private initializeEventSystem(): void {
        // 这里可以初始化全局事件系统
        console.log('事件系统初始化完成');
    }

    /**
     * 设置全局访问器
     */
    private setupGlobalAccessors(): void {
        // 设置window.game对象的新属性
        if (typeof window !== 'undefined') {
            if (!window.game) {
                window.game = {} as any;
            }
            
            window.game.roleManager = this.roleManager;
            window.game.skillManager = this.skillManager;
            window.game.configLoader = this.configLoader;
            window.game.mapManager = this.mapManager;
            window.game.initializer = this;
        }
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 注册全局游戏事件监听器
        // 使用EventBus替代直接的addEventListener
        EventBus.on(EventTypes.Role.Created, this.onPlayerCreated, this);
        EventBus.on(EventTypes.NPC.Created, this.onNPCCreated, this);

        // 注册游戏开始事件监听器
        EventBus.on(EventTypes.Game.GameStart, this.onGameStart, this);
    }

    /**
     * 角色创建事件处理
     */
    private onPlayerCreated(data: any): void {
        console.log('角色创建:', data);
    }

    /**
     * NPC创建事件处理
     */
    private onNPCCreated(data: any): void {
        console.log('NPC创建:', data);
    }

    /**
     * 输出性能数据
     */
    private logPerformanceData(): void {
        if (this.enableProfiling && this.performanceLog.size > 0) {
            console.log('=== 初始化性能数据 ===');
            for (const [phase, time] of this.performanceLog) {
                console.log(`${phase}: ${time}ms`);
            }
            console.log('=====================');
        }
    }

    /**
     * 游戏开始事件处理
     */
    private async onGameStart(data: any): Promise<void> {
        console.log('[GameInitializer] 🎮 GameStart listener called:', data);
        console.log('[GameInitializer] Current game state:', {
            hasMapManager: !!this.mapManager
        });
        
        try {
            // 检查是否已经有地图信息（由MapManager处理）
            if (data.mapId) {
                console.log(`[GameInitializer] 游戏将在地图 ${data.mapId} 上开始`);
            } else {
                console.warn('[GameInitializer] 游戏开始事件缺少地图信息');
            }
            
            // 显示游戏内UI
            // TODO: 这里需要根据实际的UIManager API来显示游戏内界面
            console.log('准备显示游戏内UI');
            
        } catch (error) {
            console.error('游戏启动失败:', error);
        }
    }

}

/**
 * 全局GameInitializer访问器
 */
export const gameInitializer = {
    get instance(): GameInitializer | null {
        return GameInitializer.getInstance();
    }
};