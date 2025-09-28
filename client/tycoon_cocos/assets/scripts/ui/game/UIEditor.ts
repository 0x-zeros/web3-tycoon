import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { MapManager } from "../../map/MapManager";
import { UIMapElement } from "./UIMapElement";
import * as fgui from "fairygui-cc";
import { _decorator, find } from 'cc';
import { GameMap } from "../../map/core/GameMap";
import { MapGenerationMode } from "../../map/generator/MapGeneratorTypes";

const { ccclass } = _decorator;

/**
 * 编辑器UI界面 - 管理地图编辑器相关的UI功能
 */
@ccclass('UIEditor')
export class UIEditor extends UIBase {
    
    /** 地图元素按钮 */
    private m_btn_mapElement: fgui.GButton;
    
    /** 清除所有地块按钮 */
    private m_btn_clearAll: fgui.GButton;

    /** 生成地图按钮 */
    private m_btn_generateMap: fgui.GButton;

    /** 生成Classic地图按钮 */
    private m_btn_generateClassic: fgui.GButton;

    /** 生成Brawl地图按钮 */
    private m_btn_generateBrawl: fgui.GButton;

    /** 当前选中的tile显示 */
    private m_tile: fgui.GComponent;
    
    /** tile的标题文本 */
    private m_tileTitle: fgui.GTextField;
    
    /** tile的图标 */
    private m_tileIcon: fgui.GLoader;
    
    /** 地图元素UI引用 */
    private m_mapElementUI: UIMapElement;
    
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
        // 获取地图元素按钮
        this.m_btn_mapElement = this.getChild('btn_mapElement') as fgui.GButton;

        // 获取清除所有地块按钮
        this.m_btn_clearAll = this.getChild('btn_clearAll') as fgui.GButton;

        // 尝试获取生成地图相关按钮（如果UI中有的话）
        this.m_btn_generateMap = this.getChild('btn_generateMap') as fgui.GButton;
        this.m_btn_generateClassic = this.getChild('btn_generateClassic') as fgui.GButton;
        this.m_btn_generateBrawl = this.getChild('btn_generateBrawl') as fgui.GButton;

        // 如果没有专门的按钮，可以创建临时的测试按钮
        if (!this.m_btn_generateMap && !this.m_btn_generateClassic && !this.m_btn_generateBrawl) {
            console.log('[UIEditor] 生成地图按钮未找到，使用键盘快捷键：G-生成Classic地图，B-生成Brawl地图');
        }

        // 获取tile组件及其子组件
        this.m_tile = this.getChild('tile').asCom;
        if (this.m_tile) {
            this.m_tileTitle = this.m_tile.getChild("title") as fgui.GTextField;
            this.m_tileIcon = this.m_tile.getChild("tileIcon") as fgui.GLoader;
            
            // 初始时隐藏tile（没有选中任何地块）
            this.m_tile.visible = false;
        }
        
        console.log('[UIEditor] Components setup completed');
    }
    
    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 可以在这里设置其他默认值
    }
    
    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定地图元素按钮点击事件
        if (this.m_btn_mapElement) {
            this.m_btn_mapElement.onClick(this._onMapElementClick, this);
        }

        // 绑定清除所有地块按钮点击事件
        if (this.m_btn_clearAll) {
            this.m_btn_clearAll.onClick(this._onClearAllClick, this);
        }

        // 绑定生成地图按钮点击事件
        if (this.m_btn_generateMap) {
            this.m_btn_generateMap.onClick(this._onGenerateMapClick, this);
        }
        if (this.m_btn_generateClassic) {
            this.m_btn_generateClassic.onClick(this._onGenerateClassicClick, this);
        }
        if (this.m_btn_generateBrawl) {
            this.m_btn_generateBrawl.onClick(this._onGenerateBrawlClick, this);
        }

        // 绑定tile点击事件
        if (this.m_tile) {
            this.m_tile.onClick(this._onTileClick, this);
        }

        // 监听地图元素选中事件
        EventBus.on(EventTypes.UI.MapElementSelected, this._onMapElementSelected, this);

        // 添加键盘快捷键支持
        this._setupKeyboardShortcuts();
    }
    
    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        // 解绑按钮事件
        if (this.m_btn_mapElement) {
            this.m_btn_mapElement.offClick(this._onMapElementClick, this);
        }
        
        // 解绑清除所有地块按钮事件
        if (this.m_btn_clearAll) {
            this.m_btn_clearAll.offClick(this._onClearAllClick, this);
        }
        
        // 解绑tile点击事件
        if (this.m_tile) {
            this.m_tile.offClick(this._onTileClick, this);
        }
        
        // 解绑地图元素选中事件
        EventBus.off(EventTypes.UI.MapElementSelected, this._onMapElementSelected, this);
        
        // 调用父类解绑
        super.unbindEvents();
    }
    
    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIEditor] Showing editor UI");
        this.updateEditorVisibility();
        this.m_mapElementUI?.hide()
    }
    
    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIEditor] Hiding editor UI");
    }
    
    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this.updateEditorVisibility();
        this.m_mapElementUI?.hide()
    }
    
    /**
     * 更新editor可见性
     * 根据GameMap的编辑模式决定是否显示
     */
    public updateEditorVisibility(): void {
        const isEditMode = MapManager.getInstance().getCurrentMapEditMode();
        this.node.active = isEditMode;
    }
    
    /**
     * 设置地图元素UI引用
     * @param mapElementUI UIMapElement实例
     */
    public setMapElementUI(mapElementUI: UIMapElement): void {
        this.m_mapElementUI = mapElementUI;
    }
    
    /**
     * 地图元素按钮点击事件
     * 触发显示/隐藏地图元素选择界面
     */
    private _onMapElementClick(): void {
        console.log("[UIEditor] Map element button clicked");
        this._toggleMapElementUI();
    }
    
    /**
     * Tile点击事件
     * 触发toggle地图元素UI显示
     */
    private _onTileClick(): void {
        console.log("[UIEditor] Tile clicked");
        this._toggleMapElementUI();
    }
    
    /**
     * Toggle地图元素UI显示
     * 供m_btn_mapElement和m_tile共同使用
     */
    private _toggleMapElementUI(): void {
        if (!this.m_mapElementUI) {
            console.warn("[UIEditor] MapElement UI not found");
            return;
        }
        
        // 检查UI是否已显示，如果显示则隐藏，如果隐藏则显示
        if (this.m_mapElementUI.isShowing) {
            this.m_mapElementUI.hide();
            console.log("[UIEditor] MapElement UI hidden");
        } else {
            this.m_mapElementUI.show();
            console.log("[UIEditor] MapElement UI shown");
        }
    }
    
    /**
     * 地图元素选中事件处理
     * 更新当前选中的tile显示
     */
    private _onMapElementSelected(data: any): void {
        if (this.m_tile) {
            // 显示tile（有选中地块时）
            this.m_tile.visible = true;
            
            // 保存blockId到data属性
            this.m_tile.data = data.blockId;
            
            // 更新tile的标题
            if (this.m_tileTitle) {
                this.m_tileTitle.text = data.blockName || "";
            }
            
            // 更新tile的图标
            if (this.m_tileIcon && data.spriteFrame) {
                // 使用传递过来的spriteFrame设置图标
                this.m_tileIcon.texture = data.spriteFrame;
            }
            
            console.log(`[UIEditor] Tile selected: ${data.blockName}`);
        }
    }
    
    /**
     * 获取当前选中的方块信息
     */
    public getSelectedBlock(): { blockId: string; blockName: string } | null {
        if (this.m_tile && this.m_tile.visible) {
            return {
                blockId: this.m_tile.data as string || "",
                blockName: this.m_tileTitle?.text || ""
            };
        }
        return null;
    }
    
    /**
     * 清除选中的方块
     */
    public clearSelectedBlock(): void {
        if (this.m_tile) {
            this.m_tile.visible = false;
            this.m_tile.data = null;
        }
        if (this.m_tileTitle) {
            this.m_tileTitle.text = "";
        }
        if (this.m_tileIcon) {
            this.m_tileIcon.texture = null;
        }
    }
    
    /**
     * 清除所有地块按钮点击事件
     * 清空当前GameMap中所有放置的地块和Object
     */
    private _onClearAllClick(): void {
        console.log("[UIEditor] Clear all button clicked");

        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                // 调用GameMap的清除所有地块方法
                mapInfo.component.clearAllPlacedBlocks();

                // 清除当前选中的地块
                this.clearSelectedBlock();

                // 发送清除完成事件
                EventBus.emit(EventTypes.Map.AllBlocksCleared);

                console.log("[UIEditor] All blocks cleared");
            }
        }
    }

    /**
     * 生成地图按钮点击事件（通用）
     */
    private _onGenerateMapClick(): void {
        console.log("[UIEditor] Generate map button clicked");
        this._generateMap(MapGenerationMode.CLASSIC);
    }

    /**
     * 生成Classic地图按钮点击事件
     */
    private _onGenerateClassicClick(): void {
        console.log("[UIEditor] Generate Classic map button clicked");
        this._generateMap(MapGenerationMode.CLASSIC);
    }

    /**
     * 生成Brawl地图按钮点击事件
     */
    private _onGenerateBrawlClick(): void {
        console.log("[UIEditor] Generate Brawl map button clicked");
        this._generateMap(MapGenerationMode.BRAWL);
    }

    /**
     * 生成地图
     * @param mode 生成模式
     */
    private async _generateMap(mode: MapGenerationMode): Promise<void> {
        console.log(`[UIEditor] Generating ${mode} map...`);

        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                const gameMap = mapInfo.component;

                // 生成地图
                try {
                    await gameMap.generateNewMap(mode, {
                        seed: Date.now(),
                        trafficSimulationRounds: 500  // 减少模拟轮数以加快生成速度
                    });
                    console.log(`[UIEditor] ${mode} map generated successfully`);
                } catch (error) {
                    console.error('[UIEditor] Failed to generate map:', error);
                }
            }
        }
    }

    /**
     * 设置键盘快捷键
     */
    private _setupKeyboardShortcuts(): void {
        // 监听键盘事件
        document.addEventListener('keydown', (event) => {
            // 只在编辑模式下响应
            if (!MapManager.getInstance()?.getCurrentMapEditMode()) {
                return;
            }

            switch(event.key.toLowerCase()) {
                case 'g':
                    // G键 - 生成Classic地图
                    if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                        this._generateMap(MapGenerationMode.CLASSIC);
                    }
                    break;
                case 'b':
                    // B键 - 生成Brawl地图
                    if (!event.ctrlKey && !event.shiftKey && !event.altKey) {
                        this._generateMap(MapGenerationMode.BRAWL);
                    }
                    break;
            }
        });
    }

}