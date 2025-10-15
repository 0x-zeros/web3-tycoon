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
        this.m_daysElapsed = this.getText('daysElapsed');
        this.m_weekday = this.getText('weekday');
        this.m_priceIndex = this.getText('priceIndex');
    }

    protected bindEvents(): void {
        // 监听回合变化
        EventBus.on(EventTypes.Game.TurnEnd, this._onTurnEnd, this);
    }

    protected unbindEvents(): void {
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
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) return;

        const round = session.getRound();
        const priceRiseDays = session.getPriceRiseDays();
        const gameId = session.getGameId();

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
    }

    private getWeekdayName(num: number): string {
        const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return names[num] || '';
    }

    private _onTurnEnd(): void {
        this.refresh();
    }
}
