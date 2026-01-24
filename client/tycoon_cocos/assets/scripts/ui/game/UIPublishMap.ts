/**
 * 发布地图确认对话框
 *
 * 提供地图发布确认功能，支持可选的地图名称输入
 */

import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

@ccclass('UIPublishMap')
export class UIPublishMap extends UIBase {
    // 组件引用
    private m_btnOk: fgui.GButton | null = null;
    private m_btnCancel: fgui.GButton | null = null;
    private m_inputName: fgui.GTextInput | null = null;
    private m_message: fgui.GTextField | null = null;

    // 回调
    private _onConfirm: ((name: string) => void) | null = null;
    private _onCancel: (() => void) | null = null;

    /**
     * 初始化子 UI（由父 UI 调用）
     * @param panel FairyGUI 组件
     */
    public initSubUI(panel: fgui.GComponent): void {
        this._panel = panel;
        this._setupComponents();
        this._bindButtonEvents();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        if (!this._panel) return;

        this.m_btnOk = this.getButton('btn_ok');
        this.m_btnCancel = this.getButton('btn_cancel');
        this.m_inputName = this._panel.getChild('name') as fgui.GTextInput;
        this.m_message = this.getText('message');
    }

    /**
     * 绑定按钮事件
     */
    private _bindButtonEvents(): void {
        this.m_btnOk?.onClick(this._onOkClick, this);
        this.m_btnCancel?.onClick(this._onCancelClick, this);
    }

    /**
     * 解绑按钮事件
     */
    public unbindButtonEvents(): void {
        this.m_btnOk?.offClick(this._onOkClick, this);
        this.m_btnCancel?.offClick(this._onCancelClick, this);
    }

    /**
     * 显示发布确认对话框
     * @param message 显示的消息内容
     * @param onConfirm 确认回调，参数为用户输入的地图名称
     * @param onCancel 取消回调
     */
    public showConfirm(
        message: string,
        onConfirm: (name: string) => void,
        onCancel?: () => void
    ): void {
        this._onConfirm = onConfirm;
        this._onCancel = onCancel ?? null;

        // 设置消息内容
        if (this.m_message) {
            this.m_message.text = message;
        }

        // 清空名称输入框
        if (this.m_inputName) {
            this.m_inputName.text = '';
        }

        // 显示对话框
        if (this._panel) {
            this._panel.visible = true;
            // 居中显示
            this._panel.center();
        }
    }

    /**
     * 隐藏对话框
     */
    public hideDialog(): void {
        if (this._panel) {
            this._panel.visible = false;
        }
    }

    /**
     * 确认按钮点击
     */
    private _onOkClick(): void {
        const name = this.m_inputName?.text?.trim() || '';
        this.hideDialog();
        this._onConfirm?.(name);
        this._clearCallbacks();
    }

    /**
     * 取消按钮点击
     */
    private _onCancelClick(): void {
        this.hideDialog();
        this._onCancel?.();
        this._clearCallbacks();
    }

    /**
     * 清理回调引用
     */
    private _clearCallbacks(): void {
        this._onConfirm = null;
        this._onCancel = null;
    }
}
