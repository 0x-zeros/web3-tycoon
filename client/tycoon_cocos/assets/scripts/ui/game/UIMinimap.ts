/**
 * UIMinimap - 小地图UI组件
 *
 * 管理minimap UI的显示/隐藏，
 * 将RenderTexture绑定到GLoader显示小地图内容。
 */

import { _decorator, find, Camera, RenderTexture, SpriteFrame, Size, Rect } from 'cc';
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
        if (this._renderTexture) {
            // 绑定RenderTexture到GLoader
            this._bindRenderTextureToLoader();
        } else if (this._minimapLoader) {
            // RenderTexture移除后，使用相机直接渲染输出
            this._minimapLoader.visible = false;
            console.log('[UIMinimap] RenderTexture not set, using direct camera output');
        }

        console.log('[UIMinimap] Minimap camera setup complete');
    }

    /**
     * 将RenderTexture绑定到GLoader
     */
    private _bindRenderTextureToLoader(): void {
        if (!this._minimapCamera) {
            console.error('[UIMinimap] Minimap camera is null');
            return;
        }

        if (!this._minimapLoader) {
            console.error('[UIMinimap] minimapLoader is null');
            return;
        }

        this._renderTexture = this._minimapCamera.targetTexture;
        if (!this._renderTexture) {
            return;
        }

        const fallbackWidth = Math.round(this._minimapLoader.width);
        const fallbackHeight = Math.round(this._minimapLoader.height);
        const width = this._renderTexture.width || fallbackWidth;
        const height = this._renderTexture.height || fallbackHeight;

        if (width <= 0 || height <= 0) {
            console.warn('[UIMinimap] RenderTexture size is invalid, skip binding');
            return;
        }

        console.log(`[UIMinimap] RenderTexture info: ${width}x${height}`);

        if (!this._spriteFrame) {
            this._spriteFrame = new SpriteFrame();
            this._spriteFrame.packable = false;
        }

        this._spriteFrame.texture = this._renderTexture;
        this._spriteFrame.originalSize = new Size(width, height);
        this._spriteFrame.rect = new Rect(0, 0, width, height);
        // RenderTexture Y flip - 根据实际显示调整
        this._spriteFrame.flipUVY = false;

        this._minimapLoader.fill = fgui.LoaderFillType.ScaleFree;
        this._minimapLoader.texture = this._spriteFrame;

        console.log(`[UIMinimap] Bound RenderTexture to GLoader, size: ${width}x${height}`);
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

        // 确保RenderTexture在相机激活后绑定到GLoader
        if (this._minimapCamera?.targetTexture) {
            this._bindRenderTextureToLoader();
            this.scheduleOnce(() => {
                this._bindRenderTextureToLoader();
            }, 0);
        } else if (this._minimapLoader) {
            this._minimapLoader.visible = false;
        }

        // 调试：打印相机状态
        if (this._minimapCamera) {
            console.log(`[UIMinimap] Camera enabled: ${this._minimapCamera.enabled}, node active: ${this._minimapCamera.node.active}`);
            console.log(`[UIMinimap] Camera targetTexture: ${this._minimapCamera.targetTexture ? 'set' : 'null'}`);
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
        // 重新绑定关闭按钮事件
        if (this._btnClose) {
            this._btnClose.onClick(this._onCloseClick, this);
        }

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
