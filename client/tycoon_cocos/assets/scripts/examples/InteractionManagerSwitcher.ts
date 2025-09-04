/**
 * 交互管理器切换测试
 * 
 * 用于测试 InteractionManager 和 VoxelInteractionManager 之间的正确切换
 * 确保 enable/disable 时相机和事件监听能够正确处理
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, input, Input, EventKeyboard, KeyCode } from 'cc';
import { InteractionManager } from '../interaction/InteractionManager';
import { VoxelInteractionManager } from '../voxel/interaction/VoxelInteractionManager';
import { CameraManager } from '../camera/CameraManager';

const { ccclass, property } = _decorator;

@ccclass('InteractionManagerSwitcher')
export class InteractionManagerSwitcher extends Component {

    @property({ type: InteractionManager, displayName: "主游戏交互管理器" })
    public mainInteractionManager: InteractionManager | null = null;

    @property({ type: VoxelInteractionManager, displayName: "体素交互管理器" })
    public voxelInteractionManager: VoxelInteractionManager | null = null;

    @property({ displayName: "启用键盘切换", tooltip: "是否允许通过键盘快捷键切换管理器" })
    public enableKeyboardSwitching: boolean = true;

    @property({ displayName: "默认管理器", tooltip: "启动时的默认管理器" })
    public defaultManager: 'main' | 'voxel' = 'main';

    @property({ displayName: "调试模式", tooltip: "显示调试信息" })
    public debugMode: boolean = true;

    private _currentManager: 'main' | 'voxel' | null = null;
    private _cameraManager: CameraManager | null = null;

    protected onLoad(): void {
        // 获取相机管理器实例
        this._cameraManager = CameraManager.getInstance();
        
        if (!this._cameraManager) {
            console.error('[InteractionManagerSwitcher] 无法获取CameraManager实例');
            return;
        }

        // 自动查找管理器组件（如果没有手动设置）
        if (!this.mainInteractionManager) {
            this.mainInteractionManager = this.getComponent(InteractionManager);
        }
        if (!this.voxelInteractionManager) {
            this.voxelInteractionManager = this.getComponent(VoxelInteractionManager);
        }

        this.debugLog('交互管理器切换器已初始化');
    }

    protected start(): void {
        // 设置默认管理器
        this.switchToManager(this.defaultManager);

        this.debugLog(`切换器启动完成，当前管理器: ${this._currentManager}`);
        this.printInstructions();
    }

    protected onEnable(): void {
        if (this.enableKeyboardSwitching) {
            input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        }
    }

    protected onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    // ========================= 公共接口方法 =========================

    /**
     * 切换到指定的管理器
     */
    public switchToManager(managerType: 'main' | 'voxel'): boolean {
        if (this._currentManager === managerType) {
            this.debugLog(`已经是 ${managerType} 管理器，无需切换`);
            return true;
        }

        // 禁用当前管理器
        this._disableCurrentManager();

        // 启用新管理器
        const success = this._enableManager(managerType);
        if (success) {
            this._currentManager = managerType;
            this.debugLog(`✅ 成功切换到 ${managerType} 管理器`);
        } else {
            this.debugLog(`❌ 切换到 ${managerType} 管理器失败`);
        }

        return success;
    }

    /**
     * 切换到主游戏管理器
     */
    public switchToMainManager(): boolean {
        return this.switchToManager('main');
    }

    /**
     * 切换到体素管理器
     */
    public switchToVoxelManager(): boolean {
        return this.switchToManager('voxel');
    }

    /**
     * 获取当前活跃的管理器类型
     */
    public getCurrentManager(): 'main' | 'voxel' | null {
        return this._currentManager;
    }

    /**
     * 打印当前状态信息
     */
    public printStatus(): void {
        console.log('=== 交互管理器状态 ===');
        console.log(`当前管理器: ${this._currentManager}`);
        
        if (this.mainInteractionManager) {
            console.log(`主游戏管理器: ${this.mainInteractionManager.enabled ? '启用' : '禁用'}`);
        }
        if (this.voxelInteractionManager) {
            console.log(`体素管理器: ${this.voxelInteractionManager.enabled ? '启用' : '禁用'}`);
        }

        if (this._cameraManager) {
            const activeType = this._cameraManager.getActiveControllerType();
            console.log(`当前相机控制器: ${activeType}`);
        }
        console.log('======================');
    }

    // ========================= 私有方法 =========================

    /**
     * 禁用当前管理器
     */
    private _disableCurrentManager(): void {
        if (!this._currentManager) return;

        if (this._currentManager === 'main' && this.mainInteractionManager) {
            this.mainInteractionManager.enabled = false;
            this.debugLog('已禁用主游戏管理器');
        } else if (this._currentManager === 'voxel' && this.voxelInteractionManager) {
            this.voxelInteractionManager.enabled = false;
            this.debugLog('已禁用体素管理器');
        }
    }

    /**
     * 启用指定管理器
     */
    private _enableManager(managerType: 'main' | 'voxel'): boolean {
        if (managerType === 'main') {
            if (!this.mainInteractionManager) {
                console.error('[InteractionManagerSwitcher] 主游戏管理器不存在');
                return false;
            }
            this.mainInteractionManager.enabled = true;
            this.debugLog('已启用主游戏管理器');
            return true;

        } else if (managerType === 'voxel') {
            if (!this.voxelInteractionManager) {
                console.error('[InteractionManagerSwitcher] 体素管理器不存在');
                return false;
            }
            this.voxelInteractionManager.enabled = true;
            this.debugLog('已启用体素管理器');
            return true;
        }

        return false;
    }

    /**
     * 键盘按键处理
     */
    private onKeyDown(event: EventKeyboard): void {
        switch (event.keyCode) {
            case KeyCode.KEY_Q:
                this.switchToMainManager();
                break;
            case KeyCode.KEY_E:
                this.switchToVoxelManager();
                break;
            case KeyCode.KEY_TAB:
                // 在两种管理器间切换
                if (this._currentManager === 'main') {
                    this.switchToVoxelManager();
                } else {
                    this.switchToMainManager();
                }
                break;
            case KeyCode.KEY_I:
                this.printStatus();
                break;
        }
    }

    /**
     * 打印使用说明
     */
    private printInstructions(): void {
        console.log('=== 交互管理器切换器使用说明 ===');
        console.log('Q: 切换到主游戏管理器');
        console.log('E: 切换到体素管理器'); 
        console.log('Tab: 在两种管理器间切换');
        console.log('I: 打印当前状态');
        console.log('================================');
    }

    /**
     * 调试日志输出
     */
    private debugLog(message: string): void {
        if (this.debugMode) {
            console.log(`[InteractionManagerSwitcher] ${message}`);
        }
    }
}