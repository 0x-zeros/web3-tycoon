/**
 * 相机管理器
 * 
 * 统一管理游戏中的所有相机控制器
 * 提供相机切换、状态管理和统一访问接口
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Camera, Node, director } from 'cc';
import { BaseCameraController, ICameraController } from './BaseCameraController';
import { CameraController } from './CameraController';
import { CameraMode } from './CameraConfig';
import { VoxelCameraController } from './voxel/VoxelCameraController';
import { VoxelCameraMode } from './voxel/VoxelCameraConfig';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';

const { ccclass, property } = _decorator;

/**
 * 相机控制器类型枚举
 */
export enum CameraControllerType {
    /** 主游戏相机控制器 */
    MAIN_GAME = 'main_game',
    /** 体素世界相机控制器 */
    VOXEL_WORLD = 'voxel_world',
    /** 自定义相机控制器 */
    CUSTOM = 'custom'
}

/**
 * 相机管理器配置
 */
export interface CameraManagerConfig {
    /** 默认相机控制器类型 */
    defaultControllerType: CameraControllerType;
    /** 是否自动切换相机 */
    autoSwitchCamera: boolean;
    /** 是否启用调试模式 */
    debugMode: boolean;
    /** 相机切换过渡时间 */
    transitionDuration: number;
}

/**
 * 相机管理器
 * 单例模式，统一管理所有相机控制器
 */
@ccclass('CameraManager')
export class CameraManager extends Component {

    @property({ displayName: "相机管理器配置", tooltip: "相机管理器的配置参数" })
    public config: CameraManagerConfig = {
        defaultControllerType: CameraControllerType.MAIN_GAME,
        autoSwitchCamera: true,
        debugMode: true,
        transitionDuration: 1.0
    };

    @property({ type: Node, displayName: "主相机节点", tooltip: "主相机所在的节点" })
    public mainCameraNode: Node | null = null;

    // 单例实例
    private static _instance: CameraManager | null = null;

    // 相机控制器注册表
    private _controllers: Map<CameraControllerType, ICameraController> = new Map();

    // 当前活跃的相机控制器
    private _activeController: ICameraController | null = null;
    private _activeControllerType: CameraControllerType = CameraControllerType.MAIN_GAME;

    // 主相机引用
    private _mainCamera: Camera | null = null;

    /**
     * 获取单例实例
     */
    public static getInstance(): CameraManager | null {
        return CameraManager._instance;
    }

    /**
     * 获取主相机实例 - 兼容旧的访问方式
     */
    public static getMainCamera(): Camera | null {
        const instance = CameraManager.getInstance();
        return instance ? instance.getMainCamera() : null;
    }

    protected onLoad(): void {
        // 设置单例
        if (CameraManager._instance === null) {
            CameraManager._instance = this;
            director.addPersistRootNode(this.node);
        } else {
            console.warn('[CameraManager] 多个CameraManager实例，销毁重复实例');
            this.destroy();
            return;
        }

        // 初始化主相机
        this._setupMainCamera();
        
        // 注册默认相机控制器
        this._registerDefaultControllers();

        console.log('[CameraManager] 相机管理器初始化完成');
    }

    protected start(): void {
        // 设置默认相机控制器
        this.switchToController(this.config.defaultControllerType);

        // 注册事件监听
        this._setupEventListeners();

        console.log(`[CameraManager] 当前相机控制器: ${this._activeControllerType}`);
    }

    protected onDestroy(): void {
        if (CameraManager._instance === this) {
            CameraManager._instance = null;
        }

        // 清理所有相机控制器
        this._controllers.clear();
        
        // 移除事件监听
        this._removeEventListeners();
    }

    // ========================= 公共接口方法 =========================

    /**
     * 获取主相机
     */
    public getMainCamera(): Camera | null {
        return this._mainCamera;
    }

    /**
     * 注册相机控制器
     */
    public registerController(type: CameraControllerType, controller: ICameraController): void {
        this._controllers.set(type, controller);
        this.debugLog(`注册相机控制器: ${type}`);
    }

    /**
     * 取消注册相机控制器
     */
    public unregisterController(type: CameraControllerType): void {
        if (this._controllers.has(type)) {
            this._controllers.delete(type);
            this.debugLog(`取消注册相机控制器: ${type}`);
        }
    }

    /**
     * 切换到指定相机控制器
     */
    public switchToController(type: CameraControllerType): boolean {
        const controller = this._controllers.get(type);
        if (!controller) {
            console.error(`[CameraManager] 相机控制器不存在: ${type}`);
            return false;
        }

        // 如果已经是当前控制器，不需要切换
        if (this._activeController === controller) {
            return true;
        }

        // 禁用当前控制器
        if (this._activeController) {
            this._activeController.setEnabled(false);
        }

        // 启用新控制器
        this._activeController = controller;
        this._activeControllerType = type;
        this._activeController.setEnabled(true);

        this.debugLog(`切换到相机控制器: ${type}`);

        // 发送相机切换事件
        EventBus.emit(EventTypes.System.CameraModeChanged, {
            controllerType: type,
            controller: controller
        });

        return true;
    }

    /**
     * 获取当前活跃的相机控制器
     */
    public getActiveController(): ICameraController | null {
        return this._activeController;
    }

    /**
     * 获取当前活跃的相机控制器类型
     */
    public getActiveControllerType(): CameraControllerType {
        return this._activeControllerType;
    }

    /**
     * 根据游戏模式自动切换相机
     */
    public switchCameraByGameMode(gameMode: string): boolean {
        let targetType: CameraControllerType;

        switch (gameMode) {
            case 'voxel':
            case 'minecraft':
            case 'block_building':
                targetType = CameraControllerType.VOXEL_WORLD;
                break;
            case 'monopoly':
            case 'board_game':
            case 'strategy':
            default:
                targetType = CameraControllerType.MAIN_GAME;
                break;
        }

        return this.switchToController(targetType);
    }

    /**
     * 设置主游戏相机模式
     */
    public setMainGameCameraMode(mode: CameraMode): void {
        const mainController = this._controllers.get(CameraControllerType.MAIN_GAME) as unknown as CameraController;
        if (mainController && mainController.setMode) {
            mainController.setMode(mode);
        }
    }

    /**
     * 设置体素相机模式
     */
    public setVoxelCameraMode(mode: VoxelCameraMode): void {
        const voxelController = this._controllers.get(CameraControllerType.VOXEL_WORLD) as unknown as VoxelCameraController;
        if (voxelController && voxelController.setMode) {
            voxelController.setMode(mode);
        }
    }

    /**
     * 获取所有已注册的相机控制器类型
     */
    public getRegisteredControllerTypes(): CameraControllerType[] {
        return Array.from(this._controllers.keys());
    }

    // ========================= 私有方法 =========================

    /**
     * 设置主相机
     */
    private _setupMainCamera(): void {
        if (this.mainCameraNode) {
            this._mainCamera = this.mainCameraNode.getComponent(Camera);
        }

        // 如果没有设置，自动查找
        if (!this._mainCamera) {
            const cameraNode = this.node.scene?.getChildByName('Main Camera');
            if (cameraNode) {
                this._mainCamera = cameraNode.getComponent(Camera);
            }
        }

        if (!this._mainCamera) {
            console.error('[CameraManager] 无法找到主相机！');
        } else {
            console.log('[CameraManager] 主相机设置完成');
        }
    }

    /**
     * 注册默认相机控制器
     */
    private _registerDefaultControllers(): void {
        // 尝试从场景中找到相机控制器组件
        const scene = director.getScene();
        if (!scene) return;

        // 查找主游戏相机控制器
        const mainController = scene.getComponentInChildren(CameraController);
        if (mainController) {
            this.registerController(CameraControllerType.MAIN_GAME, mainController as unknown as ICameraController);
        }

        // 查找体素相机控制器
        const voxelController = scene.getComponentInChildren(VoxelCameraController);
        if (voxelController) {
            this.registerController(CameraControllerType.VOXEL_WORLD, voxelController as unknown as ICameraController);
        }
    }

    /**
     * 设置事件监听器
     */
    private _setupEventListeners(): void {
        // 监听游戏模式变化事件
        EventBus.on(EventTypes.Game.GameStart, this._onGameModeChange, this);
    }

    /**
     * 移除事件监听器
     */
    private _removeEventListeners(): void {
        EventBus.off(EventTypes.Game.GameStart, this._onGameModeChange, this);
    }

    /**
     * 游戏模式变化事件处理
     */
    private _onGameModeChange(data: { mode: string }): void {
        if (this.config.autoSwitchCamera && data.mode) {
            this.switchCameraByGameMode(data.mode);
        }
    }

    /**
     * 调试日志输出
     */
    private debugLog(message: string): void {
        if (this.config.debugMode) {
            console.log(`[CameraManager] ${message}`);
        }
    }
}

/**
 * 全局CameraManager访问器
 * 保持向后兼容性
 */
export const cameraManager = {
    get instance(): CameraManager | null {
        return CameraManager.getInstance();
    },
    
    getMainCamera(): Camera | null {
        return CameraManager.getMainCamera();
    },

    switchToMainGameCamera(): boolean {
        const manager = CameraManager.getInstance();
        return manager ? manager.switchToController(CameraControllerType.MAIN_GAME) : false;
    },

    switchToVoxelCamera(): boolean {
        const manager = CameraManager.getInstance();
        return manager ? manager.switchToController(CameraControllerType.VOXEL_WORLD) : false;
    }
};