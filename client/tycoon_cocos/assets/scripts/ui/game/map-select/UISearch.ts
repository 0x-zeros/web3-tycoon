/**
 * 搜索子模块
 * 管理 Search.xml 组件，提供过滤功能
 * - category=0: Game 列表过滤（gameid, mapid, player）
 * - category=1: Map 列表过滤（mapid）
 */

import { UIBase } from "../../core/UIBase";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';

const { ccclass } = _decorator;

@ccclass('UISearch')
export class UISearch extends UIBase {
    // 组件引用
    private m_gameidInput: fgui.GTextInput | null = null;
    private m_mapidInput: fgui.GTextInput | null = null;
    private m_playerInput: fgui.GTextInput | null = null;
    private m_btnNoFilter: fgui.GButton | null = null;
    private m_categoryController: fgui.Controller | null = null;

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
        // 获取输入框
        this.m_gameidInput = this.getChild('gameid') as fgui.GTextInput;
        this.m_mapidInput = this.getChild('mapid') as fgui.GTextInput;
        this.m_playerInput = this.getChild('player') as fgui.GTextInput;

        // 获取按钮
        this.m_btnNoFilter = this.getButton('btn_noFilter');

        // 获取 controller
        this.m_categoryController = this.getController('category');

        console.log('[UISearch] Components setup');
        console.log('  m_gameidInput:', !!this.m_gameidInput);
        console.log('  m_mapidInput:', !!this.m_mapidInput);
        console.log('  m_playerInput:', !!this.m_playerInput);
        console.log('  m_btnNoFilter:', !!this.m_btnNoFilter);
        console.log('  m_categoryController:', !!this.m_categoryController);
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 实时过滤：监听输入框变化
        this.m_gameidInput?.on(fgui.Event.TEXT_CHANGE, this._onInputChange, this);
        this.m_mapidInput?.on(fgui.Event.TEXT_CHANGE, this._onInputChange, this);
        this.m_playerInput?.on(fgui.Event.TEXT_CHANGE, this._onInputChange, this);

        // 清除按钮
        this.m_btnNoFilter?.onClick(this._onNoFilterClick, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        this.m_gameidInput?.off(fgui.Event.TEXT_CHANGE, this._onInputChange, this);
        this.m_mapidInput?.off(fgui.Event.TEXT_CHANGE, this._onInputChange, this);
        this.m_playerInput?.off(fgui.Event.TEXT_CHANGE, this._onInputChange, this);

        this.m_btnNoFilter?.offClick(this._onNoFilterClick, this);

        super.unbindEvents();
    }

    /**
     * 同步 controller（供父组件调用）
     * @param index 0=game_id, 1=map_id, 2+=隐藏搜索
     */
    public syncController(index: number): void {
        // Search 组件只有 0 和 1 两个页面，category >= 2 时隐藏
        if (index >= 2) {
            this._panel.visible = false;
            console.log(`[UISearch] Hidden (category=${index})`);
            return;
        }

        this._panel.visible = true;
        if (this.m_categoryController) {
            this.m_categoryController.selectedIndex = index;
            console.log(`[UISearch] Controller synced to: ${index}`);
        }
    }

    /**
     * 获取当前 category
     */
    public get currentCategory(): number {
        return this.m_categoryController?.selectedIndex ?? 0;
    }

    /**
     * 输入框变化
     */
    private _onInputChange(): void {
        const category = this.currentCategory;
        console.log(`[UISearch] Input changed, category: ${category}`);

        if (category === 0) {
            // Game 列表过滤
            EventBus.emit(EventTypes.Search.GameFilterChanged, {
                gameid: this.m_gameidInput?.text ?? '',
                mapid: this.m_mapidInput?.text ?? '',
                player: this.m_playerInput?.text ?? ''
            });
        } else if (category === 1) {
            // Map 列表过滤
            EventBus.emit(EventTypes.Search.MapFilterChanged, {
                mapid: this.m_mapidInput?.text ?? ''
            });
        }
    }

    /**
     * 清除过滤按钮点击
     * 只清空当前 category 显示的输入框
     */
    private _onNoFilterClick(): void {
        const category = this.currentCategory;
        console.log(`[UISearch] Clear filter clicked, category: ${category}`);

        if (category === 0) {
            // Game 列表：清空 gameid, mapid, player
            if (this.m_gameidInput) this.m_gameidInput.text = '';
            if (this.m_mapidInput) this.m_mapidInput.text = '';
            if (this.m_playerInput) this.m_playerInput.text = '';
        } else if (category === 1) {
            // Map 列表：只清空 mapid
            if (this.m_mapidInput) this.m_mapidInput.text = '';
        }

        // 发送清除事件
        EventBus.emit(EventTypes.Search.FilterCleared, { category });
    }
}
