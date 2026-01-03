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
        console.log("[UILoading] onInit called");
        this._setupComponents();
        console.log("[UILoading] onInit completed, m_progress:", this.m_progress);
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        console.log("[UILoading] _setupComponents called");

        // 使用UIBase提供的辅助方法获取组件（使用类型断言）
        this.m_desc = this.getChild("desc") as fgui.GTextField;
        this.m_progress = this.getChild("progress") as fgui.GProgressBar;
        this.m_tip = this.getChild("tip") as fgui.GRichTextField;

        console.log("[UILoading] Components assigned:");
        console.log("  - m_desc:", this.m_desc);
        console.log("  - m_progress:", this.m_progress);
        console.log("  - m_tip:", this.m_tip);

        // 检查是否成功获取
        if (!this.m_desc) {
            console.error("[UILoading] Failed to get 'desc' component");
        }
        if (!this.m_progress) {
            console.error("[UILoading] Failed to get 'progress' component");
        }
        if (!this.m_tip) {
            console.error("[UILoading] Failed to get 'tip' component");
        }

        // 默认隐藏提示文本
        if (this.m_tip) {
            this.m_tip.visible = false;
        }

        console.log("[UILoading] _setupComponents completed");
    }

    /**
     * 更新进度条
     * @param value 当前值（0-100）
     * @param max 最大值（默认100）
     */
    public updateProgress(value: number, max: number = 100): void {
        console.log(`[UILoading] updateProgress called! value=${value}, max=${max}`);

        if (!this.m_progress) {
            console.warn("[UILoading] Progress bar not found, cannot update progress");
            return;
        }

        console.log(`[UILoading] Before update - value: ${this.m_progress.value}, max: ${this.m_progress.max}`);

        // FairyGUI ProgressBar 更新方式：直接设置value和max属性
        this.m_progress.max = max;
        this.m_progress.value = Math.min(value, max);

        console.log(`[UILoading] After update - value: ${this.m_progress.value}, max: ${this.m_progress.max}`);
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
