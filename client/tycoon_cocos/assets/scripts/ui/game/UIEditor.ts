import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { MapManager } from "../../map/MapManager";
import { UIMapElement } from "./UIMapElement";
import { UIMessage, MessageBoxIcon } from "../utils/UIMessage";
import { UINotification } from "../utils/UINotification";
import { SuiManager } from "../../sui/managers/SuiManager";
import { exportGameMapToMapTemplate } from "../../map/utils/MapTemplateExporter";
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

    /** 显示地块类型按钮 */
    private m_btn_showTileType: fgui.GButton;

    /** 计算建筑入口按钮 */
    private m_btn_calcBuildingEntrance: fgui.GButton;

    /** 发布到 Move 按钮 */
    private m_btn_toMoveMap: fgui.GButton;

    /** ID显示状态 */
    private _isShowingIds: boolean = false;

    /** 地块类型显示状态 */
    private _isShowingTileTypes: boolean = false;

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
        this.m_btn_showTileType = this.getChild('btn_showTileType') as fgui.GButton;
        this.m_btn_calcBuildingEntrance = this.getChild('btn_calcBuildingEntrance') as fgui.GButton;
        this.m_btn_toMoveMap = this.getChild('btn_toMoveMap') as fgui.GButton;

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
        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.onClick(this._onShowTileTypeClick, this);
        }
        if (this.m_btn_calcBuildingEntrance) {
            this.m_btn_calcBuildingEntrance.onClick(this._onCalcBuildingEntranceClick, this);
        }
        if (this.m_btn_toMoveMap) {
            this.m_btn_toMoveMap.onClick(this._onPublishMapClick, this);
        }

        // 绑定tile点击事件
        if (this.m_tile) {
            this.m_tile.onClick(this._onTileClick, this);
        }

        // 监听地图元素选中事件
        EventBus.on(EventTypes.UI.MapElementSelected, this._onMapElementSelected, this);
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
        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.offClick(this._onShowTileTypeClick, this);
        }
        if (this.m_btn_calcBuildingEntrance) {
            this.m_btn_calcBuildingEntrance.offClick(this._onCalcBuildingEntranceClick, this);
        }
        if (this.m_btn_toMoveMap) {
            this.m_btn_toMoveMap.offClick(this._onPublishMapClick, this);
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

        // 初始化地块类型显示状态为显示（因为编辑器加载时默认显示）
        this._isShowingTileTypes = true;
        if (this.m_btn_showTileType) {
            this.m_btn_showTileType.title = "隐藏类型";
        }

        // 确保ID标签被隐藏（但不清除地块类型，因为默认显示）
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                mapInfo.component.hideIds();
                // mapInfo.component.clearTileTypeOverlays();  // ✅ 不清除，保持默认显示
            }
        }
    }
    
    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIEditor] Hiding editor UI");

        // 清理ID标签和地块类型并重置状态
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                mapInfo.component.hideIds();
                mapInfo.component.clearTileTypeOverlays();
            }
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
            this.m_mapElementUI.show(undefined, false);  // 不全屏显示，避免阻挡整个屏幕
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
     * 计算建筑入口按钮点击事件
     */
    private async _onCalcBuildingEntranceClick(): Promise<void> {
        console.log("[UIEditor] Calculate building entrance button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                const success = mapInfo.component.calculateBuildingEntrances();

                if (success) {
                    // 获取建筑统计信息
                    const buildingCount = mapInfo.component.getBuildingCount();

                    // 显示成功提示
                    await UIMessage.success(
                        `建筑入口计算完成！\n\n` +
                        `已处理 ${buildingCount} 个建筑的入口关联`,
                        "计算成功"
                    );

                    console.log("[UIEditor] ✓ Building entrances calculated successfully");
                } else {
                    // 显示失败警告（包含常见问题提示）
                    await UIMessage.warning(
                        `建筑入口计算失败\n\n` +
                        `可能原因：\n` +
                        `• 入口tile数量不正确\n` +
                        `  (1x1建筑需要1个，2x2建筑需要2个)\n` +
                        `• 入口tile类型必须为EMPTY_LAND\n` +
                        `• 建筑朝向设置有误\n\n` +
                        `请检查<color=#ffaa00>控制台</color>的详细警告信息`,
                        "验证失败"
                    );

                    console.error("[UIEditor] ✗ Calculation failed - check warnings above");
                }
            }
        }
    }

    /**
     * 发布地图到 Move 按钮点击
     */
    private async _onPublishMapClick(): Promise<void> {
        console.log("[UIEditor] Publish map to Move clicked");

        try {
            // Step 1: 检查钱包连接
            if (!SuiManager.instance.isConnected) {
                await UIMessage.warning(
                    "请先连接钱包\n\n" +
                    "需要钱包签名才能发布地图到链上",
                    "未连接钱包"
                );
                return;
            }

            // Step 2: 获取 GameMap
            const mapManager = MapManager.getInstance();
            if (!mapManager) {
                await UIMessage.error("地图管理器未初始化", "错误");
                return;
            }

            const mapInfo = mapManager.getCurrentMapInfo();
            if (!mapInfo || !mapInfo.component) {
                await UIMessage.error("当前没有加载的地图", "错误");
                return;
            }

            const gameMap = mapInfo.component;

            // Step 3: 验证地图（强制执行完整计算）
            console.log('[UIEditor] Validating map...');
            const entrancesValid = gameMap.calculateBuildingEntrances();

            if (!entrancesValid) {
                await UIMessage.error(
                    "建筑入口验证失败！\n\n" +
                    "请检查控制台中的警告信息\n\n" +
                    "常见问题：\n" +
                    "• 建筑周围缺少空地 tile\n" +
                    "• 入口 tile 的类型不是 EMPTY_LAND\n" +
                    "• 1x1 建筑应有 1 个入口\n" +
                    "• 2x2 建筑应有 2 个入口\n\n" +
                    "修复后地图会自动保存，然后重新点击此按钮",
                    "验证失败"
                );
                return;
            }

            console.log('[UIEditor] ✓ Map validation passed');

            // Step 4: 导出 MapTemplate
            console.log('[UIEditor] Exporting map template...');
            const mapTemplate = exportGameMapToMapTemplate(gameMap, '0');  // templateId=0，Move 端自动生成
            console.log('[UIEditor] ✓ Map template exported');

            // Step 5: 显示确认对话框
            const confirmMessage =
                `确认发布地图到 Sui 链上？\n\n` +
                `✓ 地块数量: ${mapTemplate.tiles_static.size}\n` +
                `✓ 建筑数量: ${mapTemplate.buildings_static.size}\n` +
                `✓ 医院数量: ${mapTemplate.hospital_ids.length}\n\n` +
                `注意：\n` +
                `• 发布后无法修改\n` +
                `• 需要消耗 Gas 费用\n` +
                `• 数据已通过完整验证\n\n` +
                `确认继续？`;

            const confirmed = await UIMessage.confirm({
                message: confirmMessage,
                title: "确认发布",
                confirmText: "确认",
                cancelText: "取消"
            });

            if (!confirmed) {
                console.log('[UIEditor] User cancelled');
                return;
            }

            // Step 6: 发布到链上
            UINotification.info("正在发布地图到链上，请在钱包中确认...");

            const result = await SuiManager.instance.publishMapTemplate(mapTemplate);

            console.log('[UIEditor] ✓ Map published successfully');
            console.log('  Template ID:', result.templateId);
            console.log('  Tx Hash:', result.txHash);

            // Step 7: 显示成功消息（双按钮）
            const explorerUrl = SuiManager.instance.getExplorer(result.txHash, 'txblock');

            await UIMessage.show({
                title: "发布成功",
                message:
                    `地图发布成功！\n\n` +
                    `模板 ID: ${result.templateId}\n` +
                    `交易哈希: ${result.txHash}\n\n` +  // ✅ 完整显示
                    `✓ 数据已写入区块链\n` +
                    `✓ 玩家现在可以使用此地图创建游戏`,
                icon: MessageBoxIcon.SUCCESS,
                buttons: {
                    primary: {
                        text: "返回创建游戏",
                        callback: () => {
                            try {
                                // 返回 UIMapSelect 并选中刚发布的模板
                                this._returnToMapSelectWithTemplate(result.templateId);
                            } catch (error) {
                                console.error('[UIEditor] Primary callback error:', error);
                            }
                        }
                    },
                    secondary: {
                        text: "查看详情",
                        visible: true,
                        callback: () => {
                            try {
                                // 打开 Explorer
                                UINotification.info("正在打开区块链浏览器...");
                                SuiManager.instance.openUrl(explorerUrl);
                            } catch (error) {
                                console.error('[UIEditor] Secondary callback error:', error);
                            }
                        }
                    },
                    btn_3: {
                        text: "创建游戏",
                        visible: true,
                        callback: async () => {
                            console.log('[UIEditor] Creating game with template:', result.templateId);

                            try {
                                // 1. 先隐藏编辑器（卸载地图）
                                EventBus.emit(EventTypes.Game.RequestMapChange, {
                                    toMapId: null
                                });

                                // 2. ✅ 立即显示 UIMapSelect（Game List tab）
                                EventBus.emit(EventTypes.UI.ShowMapSelect, {
                                    category: 0  // ✅ 0 = Game List tab
                                });

                                // 3. 创建游戏
                                await SuiManager.instance.createGameWithTemplate(result.templateId);

                                // createGameWithTemplate 会：
                                // - 显示创建成功 MessageBox
                                // - 触发 GameCreatedEvent
                                //
                                // GameCreatedEvent 会触发：
                                // - SuiManager 查询并设置 _currentGame
                                // - UIMapSelect._onMoveGameCreated()
                                //   └→ showGameDetail(gameId)
                                //        ├→ controller = 0（已设置）
                                //        ├→ 选中游戏
                                //        └→ 显示 GameDetail

                            } catch (error) {
                                console.error('[UIEditor] Create game error:', error);

                                // 创建失败也要显示 UIMapSelect
                                EventBus.emit(EventTypes.UI.ShowMapSelect, {
                                    category: 0
                                });
                            }
                        }
                    },
                    close: {
                        visible: false
                    }
                }
            });

        } catch (error) {
            console.error('[UIEditor] Failed to publish map:', error);

            const errorMsg = error instanceof Error ? error.message : String(error);
            await UIMessage.error(
                `发布失败\n\n` +
                `${errorMsg}\n\n` +
                `详细错误信息已输出到控制台`,
                "发布失败"
            );
        } finally {
            // ✅ 确保按钮重新启用（无论成功或失败）
            if (this.m_btn_toMoveMap) {
                this.m_btn_toMoveMap.enabled = true;
                console.log('[UIEditor] Publish button re-enabled');
            }
        }
    }

    /**
     * 返回到 UIMapSelect 并选中刚发布的模板
     * @param templateId 模板 ID
     */
    private _returnToMapSelectWithTemplate(templateId: string): void {
        console.log('[UIEditor] Returning to UIMapSelect');
        console.log('  Template ID:', templateId);

        // 1. 请求卸载当前地图（如果有）
        EventBus.emit(EventTypes.Game.RequestMapChange, {
            toMapId: null
        });

        // 2. 显示 UIMapSelect，切换到 map_id tab，并选中模板
        EventBus.emit(EventTypes.UI.ShowMapSelect, {
            category: 1,  // ✅ 1 = map_id tab
            selectTemplateId: templateId  // ✅ 已经是 string
        });

        console.log('[UIEditor] Returning to map selection with template selected');
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
    private async _onAssignIdClick(): Promise<void> {
        console.log("[UIEditor] Assign ID button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                try {
                    // 调用GameMap的分配ID方法
                    mapInfo.component.assignIds();

                    // 获取统计信息
                    const tileCount = mapInfo.component.getTileCount();
                    const buildingCount = mapInfo.component.getBuildingCount();
                    const totalTiles = mapInfo.component.getTotalTileCount();
                    const totalBuildings = mapInfo.component.getTotalBuildingCount();

                    // 显示成功提示
                    await UIMessage.success(
                        `编号分配完成！\n\n` +
                        `• Tiles: ${tileCount}/${totalTiles}\n` +
                        `• Buildings: ${buildingCount}/${totalBuildings}`,
                        "分配成功"
                    );

                    console.log("[UIEditor] IDs assigned successfully");
                } catch (error) {
                    // 显示错误提示
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    await UIMessage.error(
                        `编号分配失败：\n${errorMsg}`,
                        "操作失败"
                    );
                    console.error("[UIEditor] Assign ID failed:", error);
                }
            }
        }
    }

    /**
     * 显示/隐藏ID按钮点击事件（同时控制2D Label和3D Overlay）
     */
    private async _onShowIdsClick(): Promise<void> {
        console.log("[UIEditor] Show IDs button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                this._isShowingIds = !this._isShowingIds;

                if (this._isShowingIds) {
                    // 显示ID
                    // mapInfo.component.showIds();                        // 2D Label - 已注释
                    await mapInfo.component.showIdsWithOverlay();       // 3D Overlay

                    // 更新按钮文本
                    if (this.m_btn_showIds) {
                        this.m_btn_showIds.title = "隐藏ID";
                    }
                } else {
                    // 隐藏ID
                    // mapInfo.component.hideIds();                        // 2D Label - 已注释
                    mapInfo.component.hideIdsWithOverlay();             // 3D Overlay

                    // 更新按钮文本
                    if (this.m_btn_showIds) {
                        this.m_btn_showIds.title = "显示ID";
                    }
                }

                console.log(`[UIEditor] IDs ${this._isShowingIds ? 'shown' : 'hidden'} (3D Overlay only)`);
            }
        }
    }

    /**
     * 显示/隐藏地块类型按钮点击事件
     */
    private async _onShowTileTypeClick(): Promise<void> {
        console.log("[UIEditor] Show tile type button clicked");
        const mapManager = MapManager.getInstance();
        if (mapManager) {
            const mapInfo = mapManager.getCurrentMapInfo();
            if (mapInfo && mapInfo.component) {
                this._isShowingTileTypes = !this._isShowingTileTypes;

                if (this._isShowingTileTypes) {
                    // 显示地块类型
                    await mapInfo.component.showTileTypeOverlays();

                    // 更新按钮文本
                    if (this.m_btn_showTileType) {
                        this.m_btn_showTileType.title = "隐藏类型";
                    }
                } else {
                    // 隐藏地块类型
                    mapInfo.component.clearTileTypeOverlays();

                    // 更新按钮文本
                    if (this.m_btn_showTileType) {
                        this.m_btn_showTileType.title = "显示类型";
                    }
                }

                console.log(`[UIEditor] Tile types ${this._isShowingTileTypes ? 'shown' : 'hidden'}`);
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
