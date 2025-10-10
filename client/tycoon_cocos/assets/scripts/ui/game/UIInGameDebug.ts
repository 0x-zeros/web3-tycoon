import { UIBase } from "../core/UIBase";
import { MapManager } from "../../map/MapManager";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

/**
 * 游戏内调试组件
 * 提供调试功能（显示ID等）
 */
@ccclass('UIInGameDebug')
export class UIInGameDebug extends UIBase {
    /** 显示ID按钮 */
    private m_btn_showIds: fgui.GButton;

    /** ID显示状态 */
    private _isShowingIds: boolean = false;

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
        console.log('[UIInGameDebug] Components setup');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btn_showIds) {
            this.m_btn_showIds.onClick(this._onShowIdsClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btn_showIds) {
            this.m_btn_showIds.offClick(this._onShowIdsClick, this);
        }

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

        // 确保ID标签被隐藏
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (gameMap) {
            gameMap.hideIdsWithOverlay();
        }
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIInGameDebug] Hiding debug UI");

        // 清理ID标签并重置状态
        const gameMap = MapManager.getInstance()?.getCurrentGameMap();
        if (gameMap) {
            gameMap.hideIdsWithOverlay();
        }

        // 重置显示状态
        this._isShowingIds = false;
        if (this.m_btn_showIds) {
            this.m_btn_showIds.title = "显示ID";
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
}
