/**
 * UIGameEnd - 游戏结束界面
 *
 * 功能：
 * - 显示游戏结束信息（赢家、轮次、结束原因）
 * - 点击 btn_end 退出游戏
 *
 * FairyGUI组件：GameEnd.xml
 * - title: GTextField - 游戏结束消息
 * - btn_end: GButton - 确认按钮
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIBase } from "../core/UIBase";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

// 通过单例访问 UIManager（避免循环依赖）
declare const UIManager: any;

const { ccclass } = _decorator;

/**
 * 游戏结束数据接口
 */
export interface GameEndData {
    /** 赢家地址（可能为null） */
    winner: string | null;
    /** 赢家名称 */
    winnerName: string;
    /** 结束原因代码 */
    reason: number;
    /** 结束原因文本 */
    reasonText: string;
    /** 轮次 */
    round: number;
    /** 回合 */
    turn: number;
}

@ccclass('UIGameEnd')
export class UIGameEnd extends UIBase {

    private _titleText: fgui.GTextField | null = null;
    private _btnEnd: fgui.GButton | null = null;

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
        this._btnEnd = this.getButton('btn_end');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this._btnEnd) {
            this._btnEnd.onClick(this._onEndClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this._btnEnd) {
            this._btnEnd.offClick(this._onEndClick, this);
        }
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: GameEndData): void {
        if (!data) {
            console.warn('[UIGameEnd] No data provided');
            return;
        }

        // 构建游戏结束消息
        const message = this._buildMessage(data);

        // 设置文本
        if (this._titleText) {
            this._titleText.text = message;
        }

        console.log('[UIGameEnd] 显示游戏结束界面', data);
    }

    /**
     * 构建游戏结束消息
     */
    private _buildMessage(data: GameEndData): string {
        const lines: string[] = [];

        lines.push('游戏结束！');
        lines.push('');

        // 赢家信息
        if (data.winner) {
            lines.push(`🏆 获胜者：${data.winnerName}`);
        } else {
            lines.push('无获胜者');
        }

        lines.push('');

        // 结束原因
        lines.push(`结束原因：${data.reasonText}`);

        // 轮次信息
        lines.push(`游戏轮次：第 ${data.round} 轮`);
        lines.push(`当前回合：第 ${data.turn} 回合`);

        return lines.join('\n');
    }

    /**
     * btn_end 点击事件
     * 调用 UIManager.exitGame() 退出游戏
     */
    private _onEndClick(): void {
        console.log('[UIGameEnd] btn_end clicked, exiting game');

        // 隐藏自己
        this.hide();

        // 调用 UIManager 统一退出方法
        const uiManager = UIManager.instance;
        if (uiManager) {
            uiManager.exitGame();
        } else {
            console.error('[UIGameEnd] UIManager not found');
        }
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log('[UIGameEnd] 隐藏游戏结束界面');
    }
}
