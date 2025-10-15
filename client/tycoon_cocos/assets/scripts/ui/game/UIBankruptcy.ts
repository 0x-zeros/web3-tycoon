/**
 * UIBankruptcy - 破产通知界面
 *
 * 功能：
 * - 显示玩家破产信息
 * - 5秒后自动消失
 *
 * FairyGUI组件：Bankruptcy.xml
 * - title: GTextField - 破产消息
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 破产通知数据接口
 */
export interface BankruptcyData {
    /** 破产玩家名称 */
    playerName: string;
    /** 债权人名称 */
    creditorName: string;
    /** 欠款金额 */
    debt: number | bigint;
}

@ccclass('UIBankruptcy')
export class UIBankruptcy extends UIBase {

    private _titleText: fgui.GTextField | null = null;

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
        this._titleText = this.getText('title');
    }

    /**
     * 显示回调
     */
    protected onShow(data?: BankruptcyData): void {
        if (!data) {
            console.warn('[UIBankruptcy] No data provided');
            return;
        }

        // 构建破产消息
        const message = this._buildMessage(data);

        // 设置文本
        if (this._titleText) {
            this._titleText.text = message;
        }

        console.log('[UIBankruptcy] 显示破产通知', data);
    }

    /**
     * 构建破产消息
     */
    private _buildMessage(data: BankruptcyData): string {
        const lines: string[] = [];

        lines.push(`${data.playerName} 破产！`);
        lines.push('');

        if (data.debt > 0) {
            lines.push(`欠款金额：${data.debt.toString()}`);
        }

        if (data.creditorName) {
            lines.push(`债权人：${data.creditorName}`);
        }

        return lines.join('\n');
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log('[UIBankruptcy] 隐藏破产通知');
    }
}
