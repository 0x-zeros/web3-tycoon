/**
 * 相机调试器
 * 
 * 显示相机状态信息和调试控制
 * 帮助开发者实时监控和调试相机行为
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Label, Node, director, Canvas, UITransform, Color } from 'cc';
import { CameraController } from './CameraController';
import { CameraMode } from './CameraConfig';
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

    @property({ displayName: "调试信息位置", tooltip: "调试信息显示位置" })
    public debugPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-left';

    @property({ displayName: "更新频率(秒)", tooltip: "调试信息更新频率" })
    public updateInterval: number = 0.1;

    // 调试UI节点
    private _debugPanel: Node | null = null;
    private _debugLabel: Label | null = null;
    
    // 更新计时器
    private _updateTimer: number = 0;
    
    // 相机控制器引用
    private _cameraController: CameraController | null = null;

    protected onLoad(): void {
        if (this.enableDebugDisplay) {
            this._createDebugUI();
        }
    }

    protected start(): void {
        // 获取相机控制器引用
        this._cameraController = CameraController.getInstance();
        
        if (!this._cameraController) {
            console.warn('[CameraDebugger] 无法找到CameraController实例');
            return;
        }

        // 监听相机模式变化事件
        EventBus.onEvent(EventTypes.System.CameraModeChanged, this._onCameraModeChanged, this);
        
        console.log('[CameraDebugger] 相机调试器初始化完成');
    }

    protected update(deltaTime: number): void {
        if (!this.enableDebugDisplay || !this._debugLabel || !this._cameraController) {
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
        if (!this._cameraController || !this._debugLabel) return;

        const cameraState = this._cameraController.getCameraState();
        const camera = this._cameraController.getMainCamera();
        
        // 构建调试信息字符串
        let debugText = '=== 相机调试信息 ===\n';
        debugText += `模式: ${this._getCameraModeName(cameraState.currentMode)}\n`;
        debugText += `位置: (${cameraState.position.x.toFixed(2)}, ${cameraState.position.y.toFixed(2)}, ${cameraState.position.z.toFixed(2)})\n`;
        debugText += `旋转: (${cameraState.rotation.x.toFixed(1)}°, ${cameraState.rotation.y.toFixed(1)}°, ${cameraState.rotation.z.toFixed(1)}°)\n`;
        
        if (camera) {
            debugText += `FOV: ${camera.fov.toFixed(1)}°\n`;
        }
        
        if (cameraState.target) {
            debugText += `目标: (${cameraState.target.x.toFixed(2)}, ${cameraState.target.y.toFixed(2)}, ${cameraState.target.z.toFixed(2)})\n`;
        }
        
        debugText += `过渡中: ${cameraState.isTransitioning ? '是' : '否'}\n`;
        debugText += '\n=== 快捷键 ===\n';
        debugText += 'F1: 等距视角\n';
        debugText += 'F2: 俯视视角\n';
        debugText += 'F3: 第三人称跟随\n';
        debugText += 'F4: 创建测试目标\n';
        debugText += '右键拖拽: 旋转(等距模式)\n';
        debugText += '滚轮: 缩放(俯视模式)';

        this._debugLabel.string = debugText;
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
     * 相机模式变化事件处理
     */
    private _onCameraModeChanged(data: { oldMode: CameraMode; newMode: CameraMode }): void {
        console.log(`[CameraDebugger] 相机模式变化: ${this._getCameraModeName(data.oldMode)} -> ${this._getCameraModeName(data.newMode)}`);
        
        // 立即更新一次调试信息
        this._updateDebugInfo();
    }
}