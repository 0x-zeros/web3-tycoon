/**
 * UIInGameInfo - 游戏信息模块
 *
 * 功能：
 * - daysElapsed：显示轮次（GameSession._round）
 * - weekday：根据轮次计算星期几
 * - priceIndex：根据轮次和物价提升天数计算物价指数
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { GameInitializer } from "../../core/GameInitializer";
import { IdFormatter } from "../utils/IdFormatter";
import { UINotification } from "../utils/UINotification";

const { ccclass } = _decorator;

@ccclass('UIInGameInfo')
export class UIInGameInfo extends UIBase {

    private m_gameId: fgui.GTextField;
    private m_daysElapsed: fgui.GTextField;
    private m_weekday: fgui.GTextField;
    private m_priceIndex: fgui.GTextField;

    protected onInit(): void {
        this._setupComponents();
    }

    private _setupComponents(): void {
        // gameInfo 组件
        this.m_gameId = this.getText('gameid');
        if (!this.m_gameId) {
            console.warn('[UIInGameInfo] gameId text component not found');
        }

        this.m_daysElapsed = this.getText('daysElapsed');
        if (!this.m_daysElapsed) {
            console.warn('[UIInGameInfo] daysElapsed text component not found');
        }

        this.m_weekday = this.getText('weekday');
        if (!this.m_weekday) {
            console.warn('[UIInGameInfo] weekday text component not found');
        }

        this.m_priceIndex = this.getText('priceIndex');
        if (!this.m_priceIndex) {
            console.warn('[UIInGameInfo] priceIndex text component not found');
        }
    }

    protected bindEvents(): void {
        // 关键：数据加载完成时首次刷新
        EventBus.on(EventTypes.Game.SessionLoaded, this._onSessionLoaded, this);

        // 关键：轮次变化时刷新（天数/星期/物价都依赖 round）
        EventBus.on(EventTypes.Game.RoundChanged, this._onRoundChanged, this);

        // 兼容：回合结束时刷新
        EventBus.on(EventTypes.Game.TurnEnd, this._onTurnEnd, this);
    }

    protected unbindEvents(): void {
        EventBus.off(EventTypes.Game.SessionLoaded, this._onSessionLoaded, this);
        EventBus.off(EventTypes.Game.RoundChanged, this._onRoundChanged, this);
        EventBus.off(EventTypes.Game.TurnEnd, this._onTurnEnd, this);
        super.unbindEvents();
    }

    protected onShow(data?: any): void {
        this.refresh();
    }

    protected onRefresh(data?: any): void {
        this.refresh();
    }

    public refresh(): void {
        const initializer = GameInitializer.getInstance();
        if (!initializer) {
            console.warn('[UIInGameInfo] GameInitializer not found');
            return;
        }

        const session = initializer.getGameSession();
        if (!session) {
            console.warn('[UIInGameInfo] GameSession not ready yet');
            return;
        }

        // 关键检查：通过 gameId 判断数据是否加载完成
        const gameId = session.getGameId();
        if (!gameId) {
            console.warn('[UIInGameInfo] GameSession data not loaded (gameId is empty)');
            return;
        }

        // 数据已就绪，开始更新 UI
        const round = session.getRound();
        const priceRiseDays = session.getPriceRiseDays();

        // Game ID（short address 格式）
        if (this.m_gameId) {
            const shortGameId = IdFormatter.shortenAddress(gameId);
            this.m_gameId.text = shortGameId;
        }

        // 天数（轮次，+1 因为 round 是 0-based）
        if (this.m_daysElapsed) {
            this.m_daysElapsed.text = `${round + 1}天`;
        }

        // 星期几（1-7 循环，1=周一）
        if (this.m_weekday) {
            const weekdayNum = ((round) % 7) + 1;
            const weekdayName = this.getWeekdayName(weekdayNum);
            this.m_weekday.text = weekdayName;
        }

        // 物价指数（每 priceRiseDays 天提升）
        if (this.m_priceIndex) {
            const priceIndex = Math.floor((round + 1) / priceRiseDays) + 1;
            this.m_priceIndex.text = `物价指数: ${priceIndex}`;
        }

        console.log('[UIInGameInfo] Refreshed successfully', {
            round,
            weekday: ((round) % 7) + 1,
            priceIndex: Math.floor((round + 1) / priceRiseDays) + 1
        });
    }

    private getWeekdayName(num: number): string {
        const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return names[num] || '';
    }

    /**
     * 检测物价指数变化并显示通知
     * @param data RoundChanged 事件数据 { oldRound, newRound }
     */
    private _checkAndNotifyPriceIndexChange(data: any): void {
        if (!data || data.oldRound === undefined || data.newRound === undefined) {
            return;
        }

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            return;
        }

        const priceRiseDays = session.getPriceRiseDays();
        if (priceRiseDays <= 0) {
            return;  // 防御性检查
        }

        // 计算旧物价指数和新物价指数
        const oldIndex = Math.floor((data.oldRound + 1) / priceRiseDays) + 1;
        const newIndex = Math.floor((data.newRound + 1) / priceRiseDays) + 1;

        // 检测物价指数是否提升
        if (newIndex > oldIndex) {
            // 显示物价指数上涨通知
            UINotification.warning(
                `物价指数上涨！${oldIndex} → ${newIndex}\n所有建筑的购买和升级价格已提高`,
                '物价提升',
                4000,  // 显示4秒
                'center'  // 居中显示
            );

            console.log(`[UIInGameInfo] 物价指数上涨: ${oldIndex} -> ${newIndex}`);
        }
    }

    private _onSessionLoaded(data: any): void {
        console.log('[UIInGameInfo] SessionLoaded event received');
        this.refresh();
    }

    private _onRoundChanged(data: any): void {
        console.log('[UIInGameInfo] RoundChanged event received');

        // 检测物价指数是否上涨
        this._checkAndNotifyPriceIndexChange(data);

        // 刷新UI显示
        this.refresh();
    }

    private _onTurnEnd(): void {
        console.log('[UIInGameInfo] TurnEnd event received');
        this.refresh();
    }
}
