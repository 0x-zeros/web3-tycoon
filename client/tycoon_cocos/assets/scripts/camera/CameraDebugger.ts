/**
 * 相机调试器
 * 
 * 显示相机状态信息和调试控制
 * 帮助开发者实时监控和调试相机行为
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Label, Node, director, Canvas, UITransform, Color, input, Input, EventKeyboard, KeyCode, Vec3 } from 'cc';
import { CameraController } from './CameraController';
import { CameraMode } from './CameraConfig';
import { CameraManager, CameraControllerType } from './CameraManager';
import { VoxelCameraMode } from './voxel/VoxelCameraConfig';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';

const { ccclass, property } = _decorator;

/**
 * 相机调试器组件
 * 显示相机实时状态信息和提供调试快捷键提示
 */
@ccclass('CameraDebugger')
export class CameraDebugger extends Component {

    @property({ displayName: "启用调试显示", tooltip: "是否显示调试信息" })
    public enableDebugDisplay: boolean = true;

    @property({ displayName: "启用键盘切换", tooltip: "是否允许通过键盘快捷键切换相机" })
    public enableKeyboardSwitching: boolean = true;
    
    @property({ displayName: "启用相机演示", tooltip: "是否启用自动相机切换演示" })
    public enableCameraDemo: boolean = false;

    @property({ displayName: "调试信息位置", tooltip: "调试信息显示位置" })
    public debugPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-left';

    @property({ displayName: "更新频率(秒)", tooltip: "调试信息更新频率" })
    public updateInterval: number = 0.1;

    // 调试UI节点
    private _debugPanel: Node | null = null;
    private _debugLabel: Label | null = null;
    
    // 更新计时器
    private _updateTimer: number = 0;
    
    // 相机系统引用
    private _cameraController: CameraController | null = null;
    private _cameraManager: CameraManager | null = null;

    protected onLoad(): void {
        if (this.enableDebugDisplay) {
            this._createDebugUI();
        }
    }

    protected start(): void {
        // 获取相机系统引用
        this._cameraController = CameraController.getInstance();
        this._cameraManager = CameraManager.getInstance();
        
        if (!this._cameraManager) {
            console.warn('[CameraDebugger] 无法找到CameraManager实例');
            return;
        }

        // 监听相机模式变化事件
        EventBus.onEvent(EventTypes.System.CameraModeChanged, this._onCameraModeChanged, this);
        
        console.log('[CameraDebugger] 相机调试器初始化完成');
        
        // 自动演示相机切换
        if (this.enableCameraDemo) {
            this.scheduleOnce(() => {
                this.demonstrateCameraSwitching();
            }, 2.0);
        }
    }

    protected onEnable(): void {
        if (this.enableKeyboardSwitching) {
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        }
    }

    protected onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    protected update(deltaTime: number): void {
        if (!this.enableDebugDisplay || !this._debugLabel || !this._cameraManager) {
            return;
        }

        // 按设定频率更新调试信息
        this._updateTimer += deltaTime;
        if (this._updateTimer >= this.updateInterval) {
            this._updateDebugInfo();
            this._updateTimer = 0;
        }
    }

    protected onDestroy(): void {
        // 清理调试UI
        if (this._debugPanel) {
            this._debugPanel.destroy();
        }

        // 移除事件监听
        EventBus.offEvent(EventTypes.System.CameraModeChanged, this._onCameraModeChanged, this);
    }

    // ========================= 公共方法 =========================

    /**
     * 切换调试显示状态
     */
    public toggleDebugDisplay(): void {
        this.enableDebugDisplay = !this.enableDebugDisplay;
        
        if (this._debugPanel) {
            this._debugPanel.active = this.enableDebugDisplay;
        }
    }

    /**
     * 设置调试显示位置
     */
    public setDebugPosition(position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): void {
        this.debugPosition = position;
        this._updateDebugPanelPosition();
    }

    /**
     * 切换到主游戏相机并设置模式
     */
    public switchToMainGameCamera(mode: CameraMode = CameraMode.ISOMETRIC): void {
        if (!this._cameraManager) return;

        const success = this._cameraManager.switchToController(CameraControllerType.MAIN_GAME);
        if (success) {
            this._cameraManager.setMainGameCameraMode(mode);
            console.log(`[CameraDebugger] 切换到主游戏相机 - ${mode}`);
        }
    }

    /**
     * 切换到体素相机并设置模式
     */
    public switchToVoxelCamera(mode: VoxelCameraMode = VoxelCameraMode.WALKING): void {
        if (!this._cameraManager) return;

        const success = this._cameraManager.switchToController(CameraControllerType.VOXEL_WORLD);
        if (success) {
            this._cameraManager.setVoxelCameraMode(mode);
            console.log(`[CameraDebugger] 切换到体素相机 - ${mode}`);
        }
    }

    /**
     * 在两种相机控制器间切换
     */
    public toggleCameraController(): void {
        if (!this._cameraManager) return;

        const currentType = this._cameraManager.getActiveControllerType();
        
        if (currentType === CameraControllerType.MAIN_GAME) {
            this.switchToVoxelCamera();
        } else {
            this.switchToMainGameCamera();
        }
    }

    /**
     * 根据游戏场景自动切换相机
     */
    public switchCameraForGameScene(sceneType: 'monopoly' | 'voxel' | 'strategy'): void {
        if (!this._cameraManager) return;

        const success = this._cameraManager.switchCameraByGameMode(sceneType);
        if (success) {
            console.log(`[CameraDebugger] 为 ${sceneType} 场景切换相机成功`);
        }
    }

    /**
     * 获取当前相机状态信息
     */
    public getCurrentCameraInfo(): void {
        if (!this._cameraManager) return;

        const activeController = this._cameraManager.getActiveController();
        const activeType = this._cameraManager.getActiveControllerType();
        const registeredTypes = this._cameraManager.getRegisteredControllerTypes();
        
        console.log('[CameraDebugger] 当前相机信息:');
        console.log(`  - 活跃控制器类型: ${activeType}`);
        console.log(`  - 活跃控制器: ${activeController ? '存在' : '不存在'}`);
        console.log(`  - 已注册控制器: [${registeredTypes.join(', ')}]`);
    }

    /**
     * 演示完整的相机切换流程
     */
    public async demonstrateCameraSwitching(): Promise<void> {
        if (!this._cameraManager) return;

        console.log('[CameraDebugger] 开始相机切换演示...');

        // 1. 主游戏相机 - 等距视角
        this.switchToMainGameCamera(CameraMode.ISOMETRIC);
        await this.delay(2000);

        // 2. 主游戏相机 - 俯视图
        this.switchToMainGameCamera(CameraMode.TOP_DOWN);
        await this.delay(2000);

        // 3. 体素相机 - 行走模式
        this.switchToVoxelCamera(VoxelCameraMode.WALKING);
        await this.delay(2000);

        // 4. 体素相机 - 飞行模式
        this.switchToVoxelCamera(VoxelCameraMode.FLYING);
        await this.delay(2000);

        console.log('[CameraDebugger] 相机切换演示完成');
    }

    // ========================= 私有方法 =========================

    /**
     * 创建调试UI
     */
    private _createDebugUI(): void {
        // 获取Canvas节点
        const scene = director.getScene();
        if (!scene) return;

        const canvas = scene.getChildByName('Canvas');
        if (!canvas) {
            console.warn('[CameraDebugger] 无法找到Canvas节点');
            return;
        }

        // 创建调试面板
        this._debugPanel = new Node('CameraDebugPanel');
        this._debugPanel.addComponent(UITransform);
        
        // 创建调试标签
        const labelNode = new Node('DebugLabel');
        labelNode.addComponent(UITransform);
        this._debugLabel = labelNode.addComponent(Label);
        
        // 配置标签样式
        this._debugLabel.string = '相机调试信息';
        this._debugLabel.fontSize = 12;
        this._debugLabel.color = Color.WHITE;
        this._debugLabel.overflow = Label.Overflow.NONE;
        
        // 设置UI层级
        this._debugPanel.layer = canvas.layer;
        labelNode.layer = canvas.layer;
        
        // 建立父子关系
        this._debugPanel.addChild(labelNode);
        canvas.addChild(this._debugPanel);
        
        // 设置位置
        this._updateDebugPanelPosition();
        
        console.log('[CameraDebugger] 调试UI创建完成');
    }

    /**
     * 更新调试面板位置
     */
    private _updateDebugPanelPosition(): void {
        if (!this._debugPanel) return;

        const transform = this._debugPanel.getComponent(UITransform);
        if (!transform) return;

        // 根据设定位置调整锚点和位置
        switch (this.debugPosition) {
            case 'top-left':
                transform.setAnchorPoint(0, 1);
                this._debugPanel.setPosition(-400, 300, 0);
                break;
            case 'top-right':
                transform.setAnchorPoint(1, 1);
                this._debugPanel.setPosition(400, 300, 0);
                break;
            case 'bottom-left':
                transform.setAnchorPoint(0, 0);
                this._debugPanel.setPosition(-400, -300, 0);
                break;
            case 'bottom-right':
                transform.setAnchorPoint(1, 0);
                this._debugPanel.setPosition(400, -300, 0);
                break;
        }
    }

    /**
     * 更新调试信息
     */
    private _updateDebugInfo(): void {
        if (!this._cameraManager || !this._debugLabel) return;

        const activeController = this._cameraManager.getActiveController();
        const activeType = this._cameraManager.getActiveControllerType();
        const camera = this._cameraManager.getMainCamera();
        
        // 构建调试信息字符串
        let debugText = '=== 相机调试信息 ===\n';
        debugText += `控制器类型: ${this._getControllerTypeName(activeType)}\n`;
        
        if (camera) {
            const pos = camera.node.getWorldPosition();
            const rotation = camera.node.getWorldRotation();
            const rot = new Vec3();
            rotation.getEulerAngles(rot);
            debugText += `位置: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n`;
            debugText += `旋转: (${(rot.x * 180 / Math.PI).toFixed(1)}°, ${(rot.y * 180 / Math.PI).toFixed(1)}°, ${(rot.z * 180 / Math.PI).toFixed(1)}°)\n`;
            debugText += `FOV: ${camera.fov.toFixed(1)}°\n`;
        }
        
        // 根据当前控制器类型显示不同信息
        if (activeType === CameraControllerType.MAIN_GAME && this._cameraController) {
            const cameraState = this._cameraController.getCameraState();
            debugText += `主游戏模式: ${this._getCameraModeName(cameraState.currentMode)}\n`;
            if (cameraState.target) {
                debugText += `目标: (${cameraState.target.x.toFixed(2)}, ${cameraState.target.y.toFixed(2)}, ${cameraState.target.z.toFixed(2)})\n`;
            }
            debugText += `过渡中: ${cameraState.isTransitioning ? '是' : '否'}\n`;
        } else if (activeType === CameraControllerType.VOXEL_WORLD) {
            const voxelController = activeController as any;
            if (voxelController && voxelController.getCurrentMode) {
                debugText += `体素模式: ${this._getVoxelModeName(voxelController.getCurrentMode())}\n`;
            }
        }
        
        debugText += '\n=== 快捷键 ===\n';
        debugText += '1: 主游戏-等距视角\n';
        debugText += '2: 主游戏-俯视图\n';
        debugText += '3: 主游戏-第三人称\n';
        debugText += '4: 体素-行走模式\n';
        debugText += '5: 体素-飞行模式\n';
        debugText += 'M: 切换控制器\n';
        debugText += 'D: 演示切换';

        this._debugLabel.string = debugText;
    }

    /**
     * 键盘按键处理
     */
    private onKeyDown(event: EventKeyboard): void {
        if (!this._cameraManager) return;

        switch (event.keyCode) {
            case KeyCode.DIGIT_1:
                this.switchToMainGameCamera(CameraMode.ISOMETRIC);
                break;
            case KeyCode.DIGIT_2:
                this.switchToMainGameCamera(CameraMode.TOP_DOWN);
                break;
            case KeyCode.DIGIT_3:
                this.switchToMainGameCamera(CameraMode.THIRD_PERSON_FOLLOW);
                break;
            case KeyCode.DIGIT_4:
                this.switchToVoxelCamera(VoxelCameraMode.WALKING);
                break;
            case KeyCode.DIGIT_5:
                this.switchToVoxelCamera(VoxelCameraMode.FLYING);
                break;
            case KeyCode.KEY_M:
                this.toggleCameraController();
                break;
            case KeyCode.KEY_D:
                if (this.enableCameraDemo) {
                    this.demonstrateCameraSwitching();
                }
                break;
        }
    }

    /**
     * 工具函数：延迟
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取控制器类型名称
     */
    private _getControllerTypeName(type: CameraControllerType): string {
        switch (type) {
            case CameraControllerType.MAIN_GAME:
                return '主游戏相机';
            case CameraControllerType.VOXEL_WORLD:
                return '体素相机';
            default:
                return '未知类型';
        }
    }

    /**
     * 获取相机模式名称
     */
    private _getCameraModeName(mode: CameraMode): string {
        switch (mode) {
            case CameraMode.ISOMETRIC:
                return '等距视角';
            case CameraMode.TOP_DOWN:
                return '俯视视角';
            case CameraMode.THIRD_PERSON_FOLLOW:
                return '第三人称跟随';
            default:
                return '未知模式';
        }
    }
    
    /**
     * 获取体素相机模式名称
     */
    private _getVoxelModeName(mode: VoxelCameraMode): string {
        switch (mode) {
            case VoxelCameraMode.WALKING:
                return '行走模式';
            case VoxelCameraMode.FLYING:
                return '飞行模式';
            default:
                return '未知模式';
        }
    }

    /**
     * 相机模式变化事件处理
     */
    private _onCameraModeChanged(data: { controllerType: string, controller: any }): void {
        console.log(`[CameraDebugger] 相机控制器变化: ${this._getControllerTypeName(data.controllerType as CameraControllerType)}`);
        
        // 立即更新一次调试信息
        this._updateDebugInfo();
    }
}