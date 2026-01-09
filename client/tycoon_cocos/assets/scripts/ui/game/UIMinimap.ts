/**
 * UIMinimap - 小地图UI组件
 *
 * 管理minimap UI的显示/隐藏，
 * 将RenderTexture绑定到GLoader显示小地图内容。
 */

import { _decorator, find, Camera, RenderTexture, SpriteFrame } from 'cc';
import { UIBase } from '../core/UIBase';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { MinimapCameraController } from '../../camera/MinimapCameraController';
import * as fgui from 'fairygui-cc';

const { ccclass } = _decorator;

@ccclass('UIMinimap')
export class UIMinimap extends UIBase {

    // FairyGUI组件引用
    private _btnClose: fgui.GButton | null = null;
    private _minimapLoader: fgui.GLoader | null = null;

    // 相机和RenderTexture
    private _minimapCamera: Camera | null = null;
    private _cameraController: MinimapCameraController | null = null;
    private _renderTexture: RenderTexture | null = null;
    private _spriteFrame: SpriteFrame | null = null;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupMinimapCamera();
    }

    /**
     * 设置FairyGUI组件引用
     */
    private _setupComponents(): void {
        // 获取关闭按钮
        this._btnClose = this.getButton('btn_close');
        if (this._btnClose) {
            this._btnClose.onClick(this._onCloseClick, this);
        }

        // 获取GLoader
        this._minimapLoader = this.getLoader('minimap_loader');
        if (!this._minimapLoader) {
            console.warn('[UIMinimap] minimap_loader not found');
        }

        console.log('[UIMinimap] Components initialized');
    }

    /**
     * 设置小地图相机
     */
    private _setupMinimapCamera(): void {
        // 查找Minimap Camera节点
        const minimapCameraNode = find('Minimap Camera');
        if (!minimapCameraNode) {
            console.error('[UIMinimap] Minimap Camera node not found in scene');
            return;
        }

        // 获取Camera组件
        this._minimapCamera = minimapCameraNode.getComponent(Camera);
        if (!this._minimapCamera) {
            console.error('[UIMinimap] Camera component not found on Minimap Camera node');
            return;
        }

        // 获取或添加控制器组件
        this._cameraController = minimapCameraNode.getComponent(MinimapCameraController);
        if (!this._cameraController) {
            this._cameraController = minimapCameraNode.addComponent(MinimapCameraController);
        }

        // 获取RenderTexture
        this._renderTexture = this._minimapCamera.targetTexture;
        if (!this._renderTexture) {
            console.error('[UIMinimap] RenderTexture not set on Minimap Camera');
            return;
        }

        // 绑定RenderTexture到GLoader
        this._bindRenderTextureToLoader();

        console.log('[UIMinimap] Minimap camera setup complete');
    }

    /**
     * 将RenderTexture绑定到GLoader
     */
    private _bindRenderTextureToLoader(): void {
        if (!this._renderTexture || !this._minimapLoader) {
            return;
        }

        // 创建SpriteFrame包装RenderTexture
        this._spriteFrame = new SpriteFrame();
        this._spriteFrame.texture = this._renderTexture;

        // 设置到GLoader
        this._minimapLoader.texture = this._spriteFrame;

        console.log('[UIMinimap] RenderTexture bound to GLoader');
    }

    /**
     * 显示回调
     */
    protected onShow(_data?: any): void {
        console.log('[UIMinimap] Showing minimap');

        // 激活相机
        if (this._cameraController) {
            this._cameraController.activate();
            this._cameraController.updatePosition();
        }

        // 确保GLoader显示RenderTexture
        if (this._minimapLoader && this._spriteFrame) {
            this._minimapLoader.texture = this._spriteFrame;
        }
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log('[UIMinimap] Hiding minimap');

        // 停用相机节省性能
        if (this._cameraController) {
            this._cameraController.deactivate();
        }
    }

    /**
     * 关闭按钮点击
     */
    private _onCloseClick(): void {
        console.log('[UIMinimap] Close button clicked');

        // 同步panel.visible状态（与UIInGame.toggleMinimap保持一致）
        if (this._panel) {
            this._panel.visible = false;
        }

        // 隐藏自己
        this.hide();

        // 发送事件同步按钮状态
        EventBus.emit(EventTypes.UI.MinimapClosed);
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 监听地图加载完成事件，更新相机位置
        EventBus.on(EventTypes.Map.MapLoaded, this._onMapLoaded, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this._btnClose) {
            this._btnClose.offClick(this._onCloseClick, this);
        }

        EventBus.off(EventTypes.Map.MapLoaded, this._onMapLoaded, this);

        super.unbindEvents();
    }

    /**
     * 地图加载完成事件
     */
    private _onMapLoaded(_data: any): void {
        // 地图加载后重新计算相机位置
        if (this._cameraController && this.isShowing) {
            this._cameraController.updatePosition();
        }
    }

    /**
     * 销毁回调
     */
    protected onDestroy(): void {
        // 清理GLoader的texture引用
        if (this._minimapLoader) {
            this._minimapLoader.texture = null;
        }

        // 销毁SpriteFrame
        if (this._spriteFrame) {
            this._spriteFrame.destroy();
            this._spriteFrame = null;
        }

        super.onDestroy();
    }
}
