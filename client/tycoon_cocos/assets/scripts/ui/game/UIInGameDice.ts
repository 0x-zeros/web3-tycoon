/**
 * UIInGameDice - 游戏内骰子模块
 *
 * 功能：
 * - 管理骰子投掷按钮
 * - 处理骰子投掷逻辑和动画
 * - 发送骰子相关事件
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { DiceController } from "../../game/DiceController";

const { ccclass } = _decorator;

@ccclass('UIInGameDice')
export class UIInGameDice extends UIBase {

    /** 投掷骰子按钮 */
    private m_btn_roll: fgui.GButton;

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
        // dice 组件结构：dice > n2（按钮组件）
        // n2 本身是 Button 组件（extention="Button"）
        this.m_btn_roll = this.getButton('n2');

        if (this.m_btn_roll) {
            console.log('[UIInGameDice] Dice button found');
        } else {
            console.error('[UIInGameDice] Dice button (n2) not found');
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.onClick(this._onRollDiceClick, this);
        }

        // 监听骰子事件
        EventBus.on(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.on(EventTypes.Dice.RollComplete, this._onDiceComplete, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.offClick(this._onRollDiceClick, this);
        }

        EventBus.off(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.off(EventTypes.Dice.RollComplete, this._onDiceComplete, this);

        super.unbindEvents();
    }

    /**
     * 投掷骰子按钮点击
     */
    private _onRollDiceClick(): void {
        console.log("[UIInGameDice] Roll dice clicked");

        // 禁用骰子按钮，防止重复点击
        if (this.m_btn_roll) {
            this.m_btn_roll.enabled = false;
        }

        // 生成随机骰子值 (1-6)
        const diceValue = Math.floor(Math.random() * 6) + 1;
        console.log(`[UIInGameDice] 骰子点数: ${diceValue}`);

        // 使用DiceController播放骰子动画
        DiceController.instance.roll(diceValue, () => {
            console.log(`[UIInGameDice] 骰子动画完成，最终点数: ${diceValue}`);

            // 动画完成后重新启用骰子按钮
            if (this.m_btn_roll) {
                this.m_btn_roll.enabled = true;
            }

            // 发送骰子投掷完成事件
            EventBus.emit(EventTypes.Dice.RollComplete, {
                value: diceValue,
                playerId: Blackboard.instance.get("currentPlayerId"),
                source: "in_game_ui"
            });
        });

        // 发送投掷骰子事件
        EventBus.emit(EventTypes.Dice.StartRoll, {
            playerId: Blackboard.instance.get("currentPlayerId"),
            source: "in_game_ui"
        });
    }

    /**
     * 骰子开始投掷
     */
    private _onDiceStart(): void {
        if (this.m_btn_roll) {
            this.m_btn_roll.enabled = false;
        }
    }

    /**
     * 骰子投掷完成
     */
    private _onDiceComplete(data: any): void {
        console.log("[UIInGameDice] Dice roll completed:", data);
        // 按钮在回调中已重新启用
    }
}
