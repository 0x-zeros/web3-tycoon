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
import { UIManager } from '../ui/core/UIManager';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';
import { Blackboard } from '../events/Blackboard';
import { fromEntries } from '../utils/object-utils';
import { MapManager } from '../map/MapManager';
import { SuiManager } from '../sui/managers/SuiManager';
import { SuiEnvConfigManager } from '../config/SuiEnvConfigManager';
import { GameSession } from './GameSession';
import { DiceController } from '../game/DiceController';
import { EventLogService } from '../ui/game/event-log/EventLogService';
import { ProfileService } from '../sui/services/ProfileService';
import { ProfileEventHandler } from '../sui/events/handlers/ProfileEventHandler';
import * as TWEEN from '@tweenjs/tween.js';

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
    private mapManager: MapManager | null = null;

    // GameSession 实例
    private gameSession: GameSession | null = null;

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
     * 每帧更新
     * 用于驱动 TWEEN 动画
     */
    protected update(deltaTime: number): void {
        // 更新 Tween 动画
        TWEEN.update();
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

            // 创建 GameSession 实例
            this.gameSession = new GameSession();
            console.log('GameSession 初始化完成');

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

            // ✅ 异步初始化 SuiManager（不阻塞 UI 显示）
            // 在后台完成 Sui 网络连接和数据预加载
            this.initializeSuiManager().catch(error => {
                console.error('[GameInitializer] SuiManager initialization failed:', error);
            });

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
     * 初始化 Sui Manager
     */
    private async initializeSuiManager(): Promise<void> {
        console.log('[GameInitializer] Initializing SuiManager...');

        try {
            // 加载保存的配置（从 localStorage）
            const savedConfig = SuiEnvConfigManager.instance.loadAndGetConfig();
            console.log('[GameInitializer] Using saved config:', {
                network: savedConfig.network,
                signerType: savedConfig.signerType
            });

            await SuiManager.instance.init(savedConfig, {
                debug: true  // 开发阶段启用调试日志
            });

            console.log('[GameInitializer] SuiManager initialized successfully');
            console.log('  Network:', savedConfig.network);
            console.log('  PackageID:', savedConfig.packageId);
            console.log('  GameDataID:', savedConfig.gameDataId);

            // 初始化 ProfileService 和 ProfileEventHandler（如果配置了 profilesPackageId）
            if (savedConfig.profilesPackageId) {
                ProfileService.instance.initialize(savedConfig.profilesPackageId);
                console.log('  ProfilesPackageID:', savedConfig.profilesPackageId);

                // 初始化并启动 ProfileEventHandler（独立监听 tycoon_profiles 包事件）
                await ProfileEventHandler.getInstance().initialize(savedConfig.profilesPackageId);
                ProfileEventHandler.getInstance().start();
                console.log('  ProfileEventHandler: 已启动');
            } else {
                console.log('  ProfilesPackageID: 未配置（跳过 ProfileService 和 ProfileEventHandler 初始化）');
            }

            // 启动后台数据同步（不等待完成）
            SuiManager.instance.startBackgroundSync().catch(error => {
                console.error('[GameInitializer] Background sync failed:', error);
            });

            console.log('[GameInitializer] Background data sync started');

        } catch (error) {
            console.error('[GameInitializer] Failed to initialize SuiManager:', error);
            throw error;
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
            const globalWindow = window as any;
            if (!globalWindow.game) {
                globalWindow.game = {};
            }

            globalWindow.game.roleManager = this.roleManager;
            globalWindow.game.configLoader = this.configLoader;
            globalWindow.game.mapManager = this.mapManager;
            globalWindow.game.initializer = this;

            // GameSession（调试用）
            globalWindow.game.session = this.gameSession;

            // Sui 相关（调试用）
            globalWindow.game.sui = SuiManager.instance;
            globalWindow.game.blackboard = Blackboard.instance;

            console.log('[GameInitializer] Global accessors set up');
            console.log('  Available in console:');
            console.log('    window.game.session    - GameSession');
            console.log('    window.game.sui        - SuiManager');
            console.log('    window.game.blackboard - Blackboard');
            console.log('    window.game.mapManager - MapManager');
        }
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        // 注册全局游戏事件监听器
        // 使用EventBus替代直接的addEventListener
        // 移除冗余的角色与NPC创建事件监听，以及GameStart重复监听

        // 注册 Move 链上游戏开始事件监听器
        EventBus.on(EventTypes.Move.GameStarted, this.onMoveGameStarted, this);
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
     * Move 链上游戏开始事件处理
     * 从 SuiManager 加载 Game 数据到 GameSession
     */
    private async onMoveGameStarted(data: any): Promise<void> {
        console.log('[GameInitializer] Move GameStarted event received:', data);

        try {
            // 检查是否是玩家或观战者
            const isSpectator = data.isSpectator === true;
            if (!data.isPlayer && !isSpectator) {
                console.log('[GameInitializer] 不是玩家也不是观战者，跳过 GameSession 加载');
                return;
            }

            // 从事件数据获取 game, template, gameData
            const game = data.game;
            const template = data.template;
            const gameData = data.gameData;

            if (!game || !template || !gameData) {
                console.error('[GameInitializer] 事件数据不完整', { game: !!game, template: !!template, gameData: !!gameData });
                return;
            }

            // 加载到 GameSession（观战模式传递 isSpectator 参数）
            if (this.gameSession) {
                await this.gameSession.loadFromMoveGame(game, template, gameData, isSpectator);
                console.log('[GameInitializer] GameSession 数据加载完成', { isSpectator });

                // 设置到 Blackboard（供 UI 组件访问）
                Blackboard.instance.set("currentGameSession", this.gameSession);
                console.log('[GameInitializer] GameSession 设置到 Blackboard');

                // 设置EventLogService会话（供事件日志功能使用）
                EventLogService.getInstance().setSession(this.gameSession);
                console.log('[GameInitializer] EventLogService 会话已设置');

                // 初始化 DiceController（确保观战者也能看到骰子动画）
                try {
                    await DiceController.instance.initialize();
                    console.log('[GameInitializer] DiceController 初始化完成', { isSpectator });
                } catch (error) {
                    console.error('[GameInitializer] DiceController 初始化失败:', error);
                }
            } else {
                console.error('[GameInitializer] GameSession 未初始化');
            }

        } catch (error) {
            console.error('[GameInitializer] Failed to load GameSession:', error);
        }
    }

    /**
     * 获取 GameSession 实例
     */
    public getGameSession(): GameSession | null {
        return this.gameSession;
    }

    /**
     * 获取 ProfileService 实例
     */
    public getProfileService(): ProfileService {
        return ProfileService.instance;
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