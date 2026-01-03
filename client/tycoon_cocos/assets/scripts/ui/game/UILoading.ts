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
    /** 进度条的bar子对象（用于手动控制宽度） */
    private m_progressBar: fgui.GObject;
    /** 进度条的初始宽度（用于计算百分比） */
    private m_progressBarMaxWidth: number = 0;
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

        // 获取进度条的bar子对象（用于手动控制宽度）
        if (this.m_progress) {
            this.m_progressBar = this.m_progress.getChild("bar");
            if (this.m_progressBar) {
                // 保存bar的初始宽度（作为100%的宽度）
                this._syncProgressBarMaxWidth();
                console.log("[UILoading] Progress bar子对象获取成功, max width:", this.m_progressBarMaxWidth);
            } else {
                console.error("[UILoading] Failed to get 'bar' child from progress component");
            }
        }

        console.log("[UILoading] Components assigned:");
        console.log("  - m_desc:", this.m_desc);
        console.log("  - m_progress:", this.m_progress);
        console.log("  - m_progressBar:", this.m_progressBar);
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

        // 更新进度条的value和max属性
        this.m_progress.max = max;
        this.m_progress.value = Math.min(value, max);

        // 手动更新bar子对象的宽度（因为LoadingProgressBar.xml的<ProgressBar/>未配置bar属性）
        if (this.m_progressBar && this.m_progressBarMaxWidth <= 0) {
            this._syncProgressBarMaxWidth();
        }

        if (this.m_progressBar && this.m_progressBarMaxWidth > 0) {
            const percentage = max > 0 ? value / max : 0;
            const newWidth = this.m_progressBarMaxWidth * percentage;
            this.m_progressBar.width = newWidth;
            console.log(`[UILoading] Progress bar width updated: ${newWidth.toFixed(0)}/${this.m_progressBarMaxWidth} (${(percentage * 100).toFixed(1)}%)`);
        } else {
            console.warn("[UILoading] Cannot update bar width - bar object or max width not available");
        }
    }

    /**
     * 更新描述文本
     * @param text 描述文本
     */
    public updateDescription(text: string): void {
        console.log(`[UILoading] updateDescription called! text="${text}"`);

        if (!this.m_desc) {
            console.warn("[UILoading] Description text field not found");
            return;
        }

        console.log(`[UILoading] Before update - desc.text: "${this.m_desc.text}"`);
        this.m_desc.text = text;
        console.log(`[UILoading] After update - desc.text: "${this.m_desc.text}"`);
        console.log(`[UILoading] desc.visible: ${this.m_desc.visible}`);
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
        // 手动重置bar宽度为0
        if (this.m_progressBar) {
            this.m_progressBar.width = 0;
        }

        this.updateProgress(0, 100);
        this.updateDescription("Loading......");
        this.updateTip("", false);
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UILoading] onShow called", data);
        console.log("[UILoading] _panel:", this._panel);
        console.log("[UILoading] _panel.visible:", this._panel?.visible);
        console.log("[UILoading] _panel.alpha:", this._panel?.alpha);
        console.log("[UILoading] _panel.parent:", this._panel?.parent);
        console.log("[UILoading] _panel.sortingOrder:", this._panel?.sortingOrder);

        // 确保面板可见
        if (this._panel) {
            this._panel.visible = true;
            this._panel.alpha = 1;
            console.log("[UILoading] Set panel visible=true, alpha=1");
        }

        // 确保bar初始宽度为0
        if (this.m_progressBar) {
            this.m_progressBar.width = 0;
            this._syncProgressBarMaxWidth();
            console.log("[UILoading] Reset progress bar width to 0");
        }

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

    private _syncProgressBarMaxWidth(): void {
        if (!this.m_progressBar) {
            return;
        }

        const progressWidth = this.m_progress ? this.m_progress.width : 0;
        const maxWidth = Math.max(this.m_progressBar.width, progressWidth);
        if (maxWidth > 0) {
            this.m_progressBarMaxWidth = maxWidth;
        }
    }
}
