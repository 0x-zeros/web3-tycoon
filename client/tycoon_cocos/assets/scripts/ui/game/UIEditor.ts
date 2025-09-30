import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { MapManager } from "../../map/MapManager";
import { UIMapElement } from "./UIMapElement";
import * as fgui from "fairygui-cc";
import { _decorator, find, input, Input, KeyCode } from 'cc';
import { GameMap } from "../../map/core/GameMap";

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

    /** 下载按钮 */
    private m_btn_download: fgui.GButton;

    /** 分配ID按钮 */
    private m_btn_assignId: fgui.GButton;

    /** 显示ID按钮 */
    private m_btn_showIds: fgui.GButton;

    /** 转换为地产Tile按钮 */
    private m_btn_toPropertyTile: fgui.GButton;

    /** ID显示状态 */
    private _isShowingIds: boolean = false;

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

        // 获取下载和功能按钮
        this.m_btn_download = this.getChild('btn_download') as fgui.GButton;
        this.m_btn_assignId = this.getChild('btn_assignId') as fgui.GButton;
        this.m_btn_showIds = this.getChild('btn_showIds') as fgui.GButton;
        this.m_btn_toPropertyTile = this.getChild('btn_toPropertyTile') as fgui.GButton;

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

    // 模板选择器已移除
    
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

        // 绑定功能按钮点击事件
        if (this.m_btn_download) {
            this.m_btn_download.onClick(this._onDownloadClick, this);
        }
        if (this.m_btn_assignId) {
            this.m_btn_assignId.onClick(this._onAssignIdClick, this);
        }
        if (this.m_btn_showIds) {
            this.m_btn_showIds.onClick(this._onShowIdsClick, this);
        }
        if (this.m_btn_toPropertyTile) {
            this.m_btn_toPropertyTile.onClick(this._onToPropertyTileClick, this);
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

        // 解绑功能按钮事件
        if (this.m_btn_download) {
            this.m_btn_download.offClick(this._onDownloadClick, this);
        }
        if (this.m_btn_assignId) {
            this.m_btn_assignId.offClick(this._onAssignIdClick, this);
        }
        if (this.m_btn_showIds) {
            this.m_btn_showIds.offClick(this._onShowIdsClick, this);
        }
        if (this.m_btn_toPropertyTile) {
            this.m_btn_toPropertyTile.offClick(this._onToPropertyTileClick, this);
        }

        // 解绑tile点击事件
        if (this.m_tile) {
            this.m_tile.offClick(this._onTileClick, this);
        }

        // 解绑地图元素选中事件
        EventBus.off(EventTypes.UI.MapElementSelected, this._onMapElementSelected, this);

        // 键盘事件已移除
        // input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);

        // 调用父类解绑
        super.unbindEvents();
    }
    
    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIEditor] Showing editor UI");
        this.updateEditorVisibility();
        this.m_mapElementUI?.hide();

        // 初始化ID显示状态为隐藏
        this._isShowingIds = false;
        if (this.m_btn_showIds) {
            this.m_btn_showIds.title = "显示ID";
        }

        // 确保ID标签被隐藏
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                mapInfo.component.hideIds();
            }
        }
    }
    
    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIEditor] Hiding editor UI");

        // 清理ID标签并重置状态
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                mapInfo.component.hideIds();
            }
        }

        // 重置显示状态
        this._isShowingIds = false;
        if (this.m_btn_showIds) {
            this.m_btn_showIds.title = "显示ID";
        }
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

            // 更新tile的标题，包含ID信息
            if (this.m_tileTitle) {
                let title = data.blockName || "";

                // 添加ID信息
                if (data.tileId !== undefined && data.tileId !== 65535) {
                    title += ` [T${data.tileId}]`;
                } else if (data.buildingId !== undefined && data.buildingId !== 65535) {
                    title += ` [B${data.buildingId}]`;
                }

                this.m_tileTitle.text = title;
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
     * 转换为地产Tile按钮点击事件
     */
    private _onToPropertyTileClick(): void {
        console.log("[UIEditor] Convert to property tile button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                const success = mapInfo.component.convertBuildingsToPropertyTiles();
                if (success) {
                    console.log("[UIEditor] ✓ Buildings converted to property tiles successfully");
                } else {
                    console.error("[UIEditor] ✗ Conversion failed - check warnings above");
                }
            }
        }
    }

    /**
     * 下载按钮点击事件
     */
    private _onDownloadClick(): void {
        console.log("[UIEditor] Download button clicked");
        this._downloadCurrentMap();
    }

    /**
     * 分配ID按钮点击事件
     */
    private _onAssignIdClick(): void {
        console.log("[UIEditor] Assign ID button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                // 调用GameMap的分配ID方法
                mapInfo.component.assignIds();
                console.log("[UIEditor] IDs assigned to tiles and properties");
            }
        }
    }

    /**
     * 显示/隐藏ID按钮点击事件
     */
    private _onShowIdsClick(): void {
        console.log("[UIEditor] Show IDs button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                this._isShowingIds = !this._isShowingIds;

                if (this._isShowingIds) {
                    mapInfo.component.showIds();
                    // 更新按钮文本
                    if (this.m_btn_showIds) {
                        this.m_btn_showIds.title = "隐藏ID";
                    }
                } else {
                    mapInfo.component.hideIds();
                    // 更新按钮文本
                    if (this.m_btn_showIds) {
                        this.m_btn_showIds.title = "显示ID";
                    }
                }

                console.log(`[UIEditor] IDs ${this._isShowingIds ? 'shown' : 'hidden'}`);
            }
        }
    }

    /**
     * 从 localStorage 读取当前地图 MapSaveData 并触发浏览器下载
     */
    private async _downloadCurrentMap(): Promise<void> {
        try {
            const mgr = MapManager.getInstance();
            const info = mgr?.getCurrentMapInfo();
            if (!info) {
                console.warn('[UIEditor] No current map info');
                return;
            }

            const gameMap: GameMap = info.component;
            const mapId = info.mapId;
            const saveKey = `map_${mapId}`;

            let jsonStr = localStorage.getItem(saveKey);
            if (!jsonStr) {
                // 若未保存，先立即保存一次
                await gameMap.saveImmediate();
                jsonStr = localStorage.getItem(saveKey);
            }

            if (!jsonStr) {
                console.warn('[UIEditor] No MapSaveData found in localStorage:', saveKey);
                return;
            }

            // // 解析模板名（优先取下拉框选中的模板名，其次用保存数据里的 mapName，最后用 mapId）
            // let templateName = '';
            // if (this.m_combo_template && this.m_combo_template.value && this.m_combo_template.value !== 'random') {
            //     const text = this.m_combo_template.text || '';
            //     templateName = text.replace(/\s*\(.+\)$/, ''); // 去掉括号内容
            // }

            // try {
            //     const data = JSON.parse(jsonStr);
            //     if (!templateName) {
            //         templateName = data?.mapName || '';
            //     }
            // } catch { /* ignore parse errors for filename */ }

            // if (!templateName) templateName = mapId;

            // const ts = new Date();
            // const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
            // const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;

            // 规范化文件名中的特殊字符
            //const safeName = templateName.replace(/[\\/:*?"<>|\s]+/g, '_');
            //const filename = `map_${safeName}_${stamp}.json`;
            const filename = `${mapId}.json`;

            // 触发下载
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            console.log(`[UIEditor] Download triggered: ${filename}`);
        } catch (e) {
            console.error('[UIEditor] Download failed:', e);
        }
    }

}
