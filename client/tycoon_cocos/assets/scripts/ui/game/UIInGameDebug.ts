import { UIBase } from "../core/UIBase";
import { MapManager } from "../../map/MapManager";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { GameInitializer } from "../../core/GameInitializer";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 游戏内调试组件
 * 提供调试功能（显示ID、round/turn等）
 */
@ccclass('UIInGameDebug')
export class UIInGameDebug extends UIBase {
    /** 显示ID按钮 */
    private m_btn_showIds: fgui.GButton;

    /** 显示地块类型按钮 */
    private m_btn_showTileType: fgui.GButton;

    /** Round/Turn 显示标签 */
    private m_label_roundTurn: fgui.GTextField;

    /** ID显示状态 */
    private _isShowingIds: boolean = false;

    /** 地块类型显示状态 */
    private _isShowingTileTypes: boolean = false;

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
        this.m_btn_showIds = this.getButton('btn_showIds');
        this.m_btn_showTileType = this.getButton('btn_showTileType');
        this.m_label_roundTurn = this.getText('roundTurn');

        console.log('[UIInGameDebug] Components setup', {
            btn_showIds: !!this.m_btn_showIds,
            btn_showTileType: !!this.m_btn_showTileType,
            label_roundTurn: !!this.m_label_roundTurn
        });
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btn_showIds) {
            this.m_btn_showIds.onClick(this._onShowIdsClick, this);
        }

        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.onClick(this._onShowTileTypeClick, this);
        }

        // 监听回合变化
        EventBus.on(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
        EventBus.on(EventTypes.Game.RoundChanged, this._onRoundChanged, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btn_showIds) {
            this.m_btn_showIds.offClick(this._onShowIdsClick, this);
        }

        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.offClick(this._onShowTileTypeClick, this);
        }

        EventBus.off(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
        EventBus.off(EventTypes.Game.RoundChanged, this._onRoundChanged, this);

        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIInGameDebug] Showing debug UI");

        // 初始化ID显示状态为隐藏
        this._isShowingIds = false;
        if (this.m_btn_showIds) {
            this.m_btn_showIds.title = "显示ID";
        }

        // 初始化地块类型显示状态为隐藏
        this._isShowingTileTypes = false;
        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.title = "显示类型";
        }

        // 确保ID标签和地块类型被隐藏
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (gameMap) {
            gameMap.hideIdsWithOverlay();
            gameMap.clearTileTypeOverlays();
        }

        // 刷新 Round/Turn 显示
        this._refreshRoundTurnDisplay();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIInGameDebug] Hiding debug UI");

        // 清理ID标签和地块类型并重置状态
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (gameMap) {
            gameMap.hideIdsWithOverlay();
            gameMap.clearTileTypeOverlays();
        }

        // 重置显示状态
        this._isShowingIds = false;
        if (this.m_btn_showIds) {
            this.m_btn_showIds.title = "显示ID";
        }

        this._isShowingTileTypes = false;
        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.title = "显示类型";
        }
    }

    /**
     * 显示/隐藏ID按钮点击事件（3D Overlay）
     */
    private async _onShowIdsClick(): Promise<void> {
        console.log("[UIInGameDebug] Button clicked");

        // 直接获取当前 GameMap 组件
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();

        if (!gameMap) {
            console.error('[UIInGameDebug] No GameMap found!');
            return;
        }

        this._isShowingIds = !this._isShowingIds;

        if (this._isShowingIds) {
            // 显示ID（3D Overlay）
            await gameMap.showIdsWithOverlay();

            // 更新按钮文本
            if (this.m_btn_showIds) {
                this.m_btn_showIds.title = "隐藏ID";
            }
        } else {
            // 隐藏ID（3D Overlay）
            gameMap.hideIdsWithOverlay();

            // 更新按钮文本
            if (this.m_btn_showIds) {
                this.m_btn_showIds.title = "显示ID";
            }
        }

        console.log(`[UIInGameDebug] IDs ${this._isShowingIds ? 'shown' : 'hidden'}`);
    }

    /**
     * 显示/隐藏地块类型按钮点击事件
     */
    private async _onShowTileTypeClick(): Promise<void> {
        console.log("[UIInGameDebug] Tile type button clicked");

        // 直接获取当前 GameMap 组件
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();

        if (!gameMap) {
            console.error('[UIInGameDebug] No GameMap found!');
            return;
        }

        this._isShowingTileTypes = !this._isShowingTileTypes;

        if (this._isShowingTileTypes) {
            // 显示地块类型
            await gameMap.showTileTypeOverlays();

            // 更新按钮文本
            if (this.m_btn_showTileType) {
                this.m_btn_showTileType.title = "隐藏类型";
            }
        } else {
            // 隐藏地块类型
            gameMap.clearTileTypeOverlays();

            // 更新按钮文本
            if (this.m_btn_showTileType) {
                this.m_btn_showTileType.title = "显示类型";
            }
        }

        console.log(`[UIInGameDebug] Tile types ${this._isShowingTileTypes ? 'shown' : 'hidden'}`);
    }

    /**
     * 回合变化处理（刷新显示）
     */
    private _onTurnChanged(): void {
        this._refreshRoundTurnDisplay();
    }

    /**
     * 轮次变化处理（刷新显示）
     */
    private _onRoundChanged(): void {
        this._refreshRoundTurnDisplay();
    }

    /**
     * 刷新 Round/Turn 显示
     */
    private _refreshRoundTurnDisplay(): void {
        if (!this.m_label_roundTurn) return;

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            this.m_label_roundTurn.text = 'round: -\nturn: -';
            return;
        }

        const round = session.getRound();
        const turn = session.getTurn();

        this.m_label_roundTurn.text = `round: ${round}\nturn: ${turn}`;
    }
}
