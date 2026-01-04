import { UIBase } from "../core/UIBase";
import { MapManager } from "../../map/MapManager";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { GameInitializer } from "../../core/GameInitializer";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import * as DirectionUtils from "../../utils/DirectionUtils";

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

    /** Debug信息显示标签 */
    private m_label_debugInfo: fgui.GTextField;

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
        this.m_label_debugInfo = this.getText('debugInfo');

        console.log('[UIInGameDebug] Components setup', {
            btn_showIds: !!this.m_btn_showIds,
            btn_showTileType: !!this.m_btn_showTileType,
            label_roundTurn: !!this.m_label_roundTurn,
            label_debugInfo: !!this.m_label_debugInfo
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

        // 监听玩家位置变化（用于更新方向显示）
        EventBus.on(EventTypes.Player.PositionChanged, this._onPlayerPositionChanged, this);

        // 监听玩家状态变化（用于更新方向显示，当next_tile_id变化时）
        EventBus.on(EventTypes.Player.StatusChange, this._onPlayerStatusChange, this);
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
        EventBus.off(EventTypes.Player.PositionChanged, this._onPlayerPositionChanged, this);
        EventBus.off(EventTypes.Player.StatusChange, this._onPlayerStatusChange, this);

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

        // 初始化地块类型显示状态为显示（因为地图加载时默认显示）
        this._isShowingTileTypes = true;
        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.title = "隐藏类型";
        }

        // 确保ID标签被隐藏（但不清除地块类型，因为默认显示）
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (gameMap) {
            gameMap.hideIdsWithOverlay();
            // gameMap.clearTileTypeOverlays();  // ✅ 不清除，保持默认显示
        }

        // 刷新 Round/Turn 显示
        this._refreshRoundTurnDisplay();

        // 刷新 Debug Info 显示
        this._refreshDebugInfo();
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

    /**
     * 玩家位置变化处理（刷新方向显示）
     */
    private _onPlayerPositionChanged(data: any): void {
        // 只关心 myPlayer 的位置变化
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) return;

        const myPlayer = session.getMyPlayer();
        if (!myPlayer || data.playerIndex !== myPlayer.getPlayerIndex()) {
            return;
        }

        this._refreshDebugInfo();
    }

    /**
     * 玩家状态变化处理（刷新方向显示，当next_tile_id变化时）
     */
    private _onPlayerStatusChange(data: any): void {
        console.log('[UIInGameDebug] _onPlayerStatusChange received:', data);

        // 只关心 next_tile_id 变化
        if (data.statusType !== 'next_tile_id') return;

        console.log('[UIInGameDebug] next_tile_id changed, refreshing debug info');

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) return;

        const myPlayer = session.getMyPlayer();
        if (!myPlayer || data.playerIndex !== myPlayer.getPlayerIndex()) {
            return;
        }

        this._refreshDebugInfo();
    }

    /**
     * 刷新 Debug Info 显示（显示玩家方向）
     */
    private _refreshDebugInfo(): void {
        if (!this.m_label_debugInfo) return;

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            this.m_label_debugInfo.text = 'player: -';
            return;
        }

        const myPlayer = session.getMyPlayer();
        if (!myPlayer) {
            this.m_label_debugInfo.text = 'player: not found';
            return;
        }

        // 使用 DirectionUtils 动态计算方向
        const direction = DirectionUtils.calculatePlayerDirection(
            myPlayer.getPos(),
            myPlayer.getLastTileId(),
            myPlayer.getNextTileId(),
            (tileId) => session.getTileWorldCenter(tileId)
        );

        const directionText = DirectionUtils.formatDirection(direction);

        this.m_label_debugInfo.text = `direction: ${directionText}`;
    }
}
