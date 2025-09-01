import { Node, _decorator, Sprite, tween, Vec3, UIOpacity } from "cc";
import { UIBase } from "../core/UIBase";
import { UIButton } from "./UIButton";
import { EventBus } from "../events/EventBus";
import { EventTypes } from "../events/EventTypes";

const { ccclass, property } = _decorator;

/**
 * 面板状态枚举
 */
export enum PanelState {
    /** 初始化 */
    Init = "init",
    /** 显示中 */
    Showing = "showing",
    /** 已显示 */
    Shown = "shown",
    /** 隐藏中 */
    Hiding = "hiding", 
    /** 已隐藏 */
    Hidden = "hidden"
}

/**
 * 基础面板组件 - 提供通用面板功能
 */
@ccclass('UIPanel')
export class UIPanel extends UIBase {
    @property(Node)
    backgroundNode: Node | null = null;

    @property(Node)
    contentNode: Node | null = null;

    @property(UIButton)
    closeButton: UIButton | null = null;

    @property({
        tooltip: "是否显示背景遮罩"
    })
    showMask: boolean = true;

    @property({
        tooltip: "背景遮罩透明度(0-255)"
    })
    maskOpacity: number = 180;

    @property({
        tooltip: "点击遮罩是否关闭面板"
    })
    closeOnMaskClick: boolean = true;

    @property({
        tooltip: "是否启用拖拽"
    })
    enableDrag: boolean = false;

    @property(Node)
    dragHandle: Node | null = null;

    /** 面板状态 */
    private _panelState: PanelState = PanelState.Init;
    /** 遮罩节点 */
    private _maskNode: Node | null = null;
    /** 原始位置 */
    private _originalPosition: Vec3 = Vec3.ZERO.clone();
    /** 是否正在拖拽 */
    private _isDragging: boolean = false;
    /** 拖拽开始位置 */
    private _dragStartPos: Vec3 = Vec3.ZERO.clone();

    /**
     * 获取面板状态
     */
    public get panelState(): PanelState {
        return this._panelState;
    }

    /**
     * 初始化UI
     */
    protected onInit(): void {
        this._setupComponents();
        this._createMask();
        this._bindEvents();
        
        // 保存原始位置
        this._originalPosition = this.node.position.clone();
        this._panelState = PanelState.Init;
    }

    /**
     * 设置组件
     */
    private _setupComponents(): void {
        // 自动获取组件
        if (!this.backgroundNode) {
            this.backgroundNode = this.node.getChildByName("Background") || 
                                 this.node.getChildByName("background") ||
                                 this.node.getChildByName("Bg");
        }

        if (!this.contentNode) {
            this.contentNode = this.node.getChildByName("Content") || 
                              this.node.getChildByName("content") ||
                              this.node;
        }

        if (!this.closeButton) {
            const closeNode = this.node.getChildByPath("CloseButton") || 
                             this.node.getChildByPath("close_btn") ||
                             this.node.getChildByPath("Background/CloseButton");
            if (closeNode) {
                this.closeButton = closeNode.getComponent(UIButton);
            }
        }

        if (!this.dragHandle) {
            this.dragHandle = this.node.getChildByName("DragHandle") || 
                             this.node.getChildByName("TitleBar") ||
                             this.backgroundNode;
        }
    }

    /**
     * 创建遮罩
     */
    private _createMask(): void {
        if (!this.showMask || this._maskNode) {
            return;
        }

        // 创建遮罩节点
        this._maskNode = new Node("UIPanelMask");
        this._maskNode.layer = this.node.layer;
        
        // 添加Sprite组件作为背景
        const sprite = this._maskNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.RAW;
        
        // 设置透明度
        const uiOpacity = this._maskNode.addComponent(UIOpacity);
        uiOpacity.opacity = this.maskOpacity;

        // 设置为全屏大小
        const canvas = this.node.getComponentInParents("Canvas");
        if (canvas) {
            this._maskNode.setContentSize(canvas.node.getContentSize());
        } else {
            this._maskNode.setContentSize(1280, 720); // 默认分辨率
        }

        // 添加到父节点，并设置在面板下方
        if (this.node.parent) {
            this.node.parent.insertChild(this._maskNode, this.node.getSiblingIndex());
        }
    }

    /**
     * 绑定事件
     */
    private _bindEvents(): void {
        // 绑定关闭按钮
        if (this.closeButton) {
            this.closeButton.setClickCallback(() => this.close());
        }

        // 绑定遮罩点击
        if (this._maskNode && this.closeOnMaskClick) {
            this._maskNode.on(Node.EventType.TOUCH_END, () => {
                if (!this._isDragging) {
                    this.close();
                }
            }, this);
        }

        // 绑定拖拽事件
        if (this.enableDrag && this.dragHandle) {
            this.dragHandle.on(Node.EventType.TOUCH_START, this.onDragStart, this);
            this.dragHandle.on(Node.EventType.TOUCH_MOVE, this.onDragMove, this);
            this.dragHandle.on(Node.EventType.TOUCH_END, this.onDragEnd, this);
            this.dragHandle.on(Node.EventType.TOUCH_CANCEL, this.onDragEnd, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.closeButton) {
            this.closeButton.setClickCallback(null as any);
        }

        if (this._maskNode) {
            this._maskNode.off(Node.EventType.TOUCH_END);
        }

        if (this.dragHandle) {
            this.dragHandle.off(Node.EventType.TOUCH_START, this.onDragStart, this);
            this.dragHandle.off(Node.EventType.TOUCH_MOVE, this.onDragMove, this);
            this.dragHandle.off(Node.EventType.TOUCH_END, this.onDragEnd, this);
            this.dragHandle.off(Node.EventType.TOUCH_CANCEL, this.onDragEnd, this);
        }
    }

    /**
     * 显示前回调
     */
    protected onBeforeShow(data: any): void {
        this._panelState = PanelState.Showing;
        
        // 显示遮罩
        if (this._maskNode) {
            this._maskNode.active = true;
        }
    }

    /**
     * 显示后回调
     */
    protected onAfterShow(data: any): void {
        this._panelState = PanelState.Shown;
        
        // 发送面板显示事件
        EventBus.emitEvent(EventTypes.UI.ButtonClick, {
            panelId: this.uiId,
            panel: this,
            action: "show"
        });
    }

    /**
     * 隐藏前回调
     */
    protected onBeforeHide(): void {
        this._panelState = PanelState.Hiding;
    }

    /**
     * 隐藏后回调
     */
    protected onAfterHide(): void {
        this._panelState = PanelState.Hidden;
        
        // 隐藏遮罩
        if (this._maskNode) {
            this._maskNode.active = false;
        }

        // 发送面板关闭事件
        EventBus.emitEvent(EventTypes.UI.PanelClose, {
            panelId: this.uiId,
            panel: this
        });
    }

    /**
     * 关闭面板
     */
    public close(): void {
        this.hide();
    }

    /**
     * 设置面板内容
     */
    public setContent(content: Node): void {
        if (this.contentNode && content) {
            // 清理旧内容
            this.contentNode.removeAllChildren();
            // 添加新内容
            this.contentNode.addChild(content);
        }
    }

    /**
     * 设置面板大小
     */
    public setSize(width: number, height: number): void {
        this.node.setContentSize(width, height);
        
        if (this.backgroundNode) {
            this.backgroundNode.setContentSize(width, height);
        }
    }

    /**
     * 设置面板位置
     */
    public setPosition(x: number, y: number): void {
        this.node.setPosition(x, y, this.node.position.z);
        this._originalPosition.set(x, y, this.node.position.z);
    }

    /**
     * 居中显示
     */
    public centerPanel(): void {
        this.node.setPosition(0, 0, this.node.position.z);
        this._originalPosition = this.node.position.clone();
    }

    /**
     * 拖拽开始
     */
    private onDragStart(event: any): void {
        this._isDragging = true;
        const touch = event.touch;
        const worldPos = touch.getLocation();
        this._dragStartPos = this.node.parent!.getComponent("UITransform")!.convertToNodeSpaceAR(worldPos);
    }

    /**
     * 拖拽移动
     */
    private onDragMove(event: any): void {
        if (!this._isDragging) return;

        const touch = event.touch;
        const worldPos = touch.getLocation();
        const nodePos = this.node.parent!.getComponent("UITransform")!.convertToNodeSpaceAR(worldPos);
        
        const deltaPos = nodePos.subtract(this._dragStartPos);
        this.node.setPosition(this.node.position.add(deltaPos));
        
        this._dragStartPos = nodePos;
    }

    /**
     * 拖拽结束
     */
    private onDragEnd(event: any): void {
        this._isDragging = false;
        
        // 可以在这里添加边界检查，确保面板不会拖出屏幕
        this._checkBounds();
    }

    /**
     * 检查边界
     */
    private _checkBounds(): void {
        const canvas = this.node.getComponentInParents("Canvas");
        if (!canvas) return;

        const canvasSize = canvas.node.getContentSize();
        const panelSize = this.node.getContentSize();
        
        let x = this.node.position.x;
        let y = this.node.position.y;
        
        // 边界检查
        const halfPanelWidth = panelSize.width / 2;
        const halfPanelHeight = panelSize.height / 2;
        const halfCanvasWidth = canvasSize.width / 2;
        const halfCanvasHeight = canvasSize.height / 2;
        
        x = Math.max(-halfCanvasWidth + halfPanelWidth, Math.min(halfCanvasWidth - halfPanelWidth, x));
        y = Math.max(-halfCanvasHeight + halfPanelHeight, Math.min(halfCanvasHeight - halfPanelHeight, y));
        
        // 如果位置有变化，使用动画移动到合法位置
        if (x !== this.node.position.x || y !== this.node.position.y) {
            tween(this.node)
                .to(0.2, { position: new Vec3(x, y, this.node.position.z) }, { easing: "quartOut" })
                .start();
        }
    }

    /**
     * 重置位置
     */
    public resetPosition(): void {
        tween(this.node)
            .to(0.3, { position: this._originalPosition }, { easing: "backOut" })
            .start();
    }

    /**
     * 组件销毁时调用
     */
    protected onDestroy(): void {
        super.onDestroy();
        
        // 销毁遮罩
        if (this._maskNode && this._maskNode.isValid) {
            this._maskNode.destroy();
            this._maskNode = null;
        }
    }
}