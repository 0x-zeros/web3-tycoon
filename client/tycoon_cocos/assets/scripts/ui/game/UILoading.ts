import { _decorator } from 'cc';
import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";

const { ccclass } = _decorator;

/**
 * Loading界面 - 全屏加载遮罩
 * 用于地图加载时显示进度
 */
@ccclass('UILoading')
export class UILoading extends UIBase {
    /** 描述文本 - "Loading......" */
    private m_desc: fgui.GTextField;
    /** 进度条组件 */
    private m_progress: fgui.GProgressBar;
    /** 提示文本（可选显示） */
    private m_tip: fgui.GRichTextField;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // 获取desc组件（必需）
        const descChild = this._panel.getChild("desc");
        if (!descChild) {
            console.error("[UILoading] Missing required child 'desc' in Loading component");
            return;
        }
        this.m_desc = descChild.asTextField;

        // 获取progress组件（必需）
        const progressChild = this._panel.getChild("progress");
        if (!progressChild) {
            console.error("[UILoading] Missing required child 'progress' in Loading component");
            return;
        }
        this.m_progress = progressChild.asProgress;

        // 获取tip组件（必需）
        const tipChild = this._panel.getChild("tip");
        if (!tipChild) {
            console.error("[UILoading] Missing required child 'tip' in Loading component");
            return;
        }
        this.m_tip = tipChild.asRichTextField;

        // 默认隐藏提示文本
        this.m_tip.visible = false;
    }

    /**
     * 更新进度条
     * @param value 当前值（0-100）
     * @param max 最大值（默认100）
     */
    public updateProgress(value: number, max: number = 100): void {
        if (!this.m_progress) return;

        this.m_progress.value = Math.min(value, max);
        this.m_progress.max = max;
    }

    /**
     * 更新描述文本
     * @param text 描述文本
     */
    public updateDescription(text: string): void {
        if (!this.m_desc) return;

        this.m_desc.text = text;
    }

    /**
     * 更新提示文本
     * @param text 提示文本（支持富文本格式）
     * @param visible 是否显示（默认true）
     */
    public updateTip(text: string, visible: boolean = true): void {
        if (!this.m_tip) return;

        this.m_tip.text = text;
        this.m_tip.visible = visible;
    }

    /**
     * 重置Loading状态
     */
    public reset(): void {
        this.updateProgress(0, 100);
        this.updateDescription("Loading......");
        this.updateTip("", false);
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UILoading] onShow called", data);

        // 如果传入了初始数据，应用它
        if (data) {
            if (data.description) {
                this.updateDescription(data.description);
            }
            if (data.progress !== undefined) {
                this.updateProgress(data.progress);
            }
            if (data.tip) {
                this.updateTip(data.tip, true);
            }
        }
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        // 重置状态，为下次显示做准备
        this.reset();
    }
}
