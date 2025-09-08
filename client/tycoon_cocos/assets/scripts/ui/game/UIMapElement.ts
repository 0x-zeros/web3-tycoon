import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { GButton, GObject } from "fairygui-cc";

const { ccclass } = _decorator;

/**
 * 地图元素界面 - 玩家选择地图元素
 */
@ccclass('UIMapElement')
export class UIMapElement extends UIBase {


    private m_tiles:fgui.GList;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupDefaultValues();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {

        this.m_tiles = this.getList("tiles");
        this.m_tiles.itemRenderer = this.renderListItem.bind(this);
        this.m_tiles.numItems = 25;

        console.log("MapElement tiles: ", this.m_tiles.numChildren);
    }

    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {

    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件

        //todo close button?
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {

        //todo close button?

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        
        //ui onEnable 里调用的
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        

    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {

    }

    //items 处理
    private renderListItem(index: number, obj: GObject): void {
    
        const tile = obj.asCom as GButton;
        tile.title = ""+index;
    }
    

    //
    public hide(): void {
        this.node.active = false;
        console.log("[UIMapElement] hide");
    }

    public show(): void {
        this.node.active = true;
        console.log("[UIMapElement] show");
    }
}