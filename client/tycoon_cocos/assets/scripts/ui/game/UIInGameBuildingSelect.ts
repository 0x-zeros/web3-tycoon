/**
 * UIInGameBuildingSelect - 游戏内建筑类型选择模块
 *
 * 功能：
 * - 监听 BuildingDecisionEvent，判断是否为 2x2 建筑 lv0→lv1 的情况
 * - 显示建筑类型选择界面（初始隐藏）
 * - 列表显示 5 种 2x2 建筑类型（TEMPLE 默认选中，其他禁用）
 * - 提供"升级"和"跳过"两个操作按钮
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
import { SuiManager } from "../../sui/managers/SuiManager";
import { UINotification } from "../utils/UINotification";
import { BuildingType, BuildingSize, DecisionType } from "../../sui/types/constants";

const { ccclass } = _decorator;

/**
 * 建筑类型信息
 */
interface BuildingTypeInfo {
    type: BuildingType;      // 建筑类型枚举值
    name: string;            // 中文名称
    enabled: boolean;        // 是否可选
    status: string;          // 状态文本
}

@ccclass('UIInGameBuildingSelect')
export class UIInGameBuildingSelect extends UIBase {

    /** 建筑类型列表 */
    private m_buildingList: fgui.GList;

    /** 升级按钮 */
    private m_btnUpgrade: fgui.GButton;

    /** 跳过按钮 */
    private m_btnSkip: fgui.GButton;

    /** 当前选中的建筑类型 */
    private m_selectedBuildingType: BuildingType = BuildingType.TEMPLE;

    /** 建筑类型数据（5种2x2建筑） */
    private readonly m_buildingTypes: BuildingTypeInfo[] = [
        { type: BuildingType.TEMPLE, name: "土地庙", enabled: true, status: "" },
        { type: BuildingType.RESEARCH, name: "研究所", enabled: false, status: "当前版本暂未支持" },
        { type: BuildingType.OIL, name: "石油公司", enabled: false, status: "当前版本暂未支持" },
        { type: BuildingType.COMMERCIAL, name: "商业中心", enabled: false, status: "当前版本暂未支持" },
        { type: BuildingType.HOTEL, name: "大饭店", enabled: false, status: "当前版本暂未支持" }
    ];

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupButtons();

        // 初始隐藏
        this._setVisible(false);
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // 获取建筑列表
        this.m_buildingList = this.getList('list');

        if (this.m_buildingList) {
            this.m_buildingList.itemRenderer = this.renderBuildingItem.bind(this);
            console.log('[UIInGameBuildingSelect] Building list setup');
        } else {
            console.error('[UIInGameBuildingSelect] Building list not found');
        }

        // 获取按钮
        this.m_btnUpgrade = this.getButton('btn_upgrade');
        this.m_btnSkip = this.getButton('btn_skip');

        if (!this.m_btnUpgrade || !this.m_btnSkip) {
            console.error('[UIInGameBuildingSelect] Buttons not found');
        }
    }

    /**
     * 设置按钮事件
     */
    private _setupButtons(): void {
        if (this.m_btnUpgrade) {
            this.m_btnUpgrade.onClick(this.onUpgradeClicked, this);
        }

        if (this.m_btnSkip) {
            this.m_btnSkip.onClick(this.onSkipClicked, this);
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 监听决策待处理事件（原来的 Move.BuildingDecision 从未被 emit）
        EventBus.on(EventTypes.Game.DecisionPending, this._onDecisionPending, this);
        EventBus.on(EventTypes.Game.SessionReset, this._onSessionReset, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        EventBus.off(EventTypes.Game.DecisionPending, this._onDecisionPending, this);
        EventBus.off(EventTypes.Game.SessionReset, this._onSessionReset, this);
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        if (!this._shouldShowForCurrentDecision()) {
            console.log("[UIInGameBuildingSelect] No valid pending decision, hiding");
            this._setVisible(false);
            this._isShowing = false;
            return;
        }

        this._setVisible(true);
        console.log("[UIInGameBuildingSelect] Showing building select");
        this.refresh();
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this.refresh();
    }

    /**
     * 刷新建筑列表
     */
    public refresh(): void {
        if (!this.m_buildingList) {
            console.warn('[UIInGameBuildingSelect] Building list not initialized');
            return;
        }

        // 设置列表项数量
        this.m_buildingList.numItems = this.m_buildingTypes.length;

        // 设置默认选中 TEMPLE
        this.m_buildingList.selectedIndex = 0;
        this.m_selectedBuildingType = BuildingType.TEMPLE;

        console.log(`[UIInGameBuildingSelect] Refreshed with ${this.m_buildingTypes.length} building types`);
    }

    /**
     * 渲染建筑类型列表项
     */
    private renderBuildingItem(index: number, obj: fgui.GObject): void {
        const item = obj.asButton;
        if (!item) {
            console.warn('[UIInGameBuildingSelect] Item is not a button');
            return;
        }

        const buildingInfo = this.m_buildingTypes[index];
        if (!buildingInfo) {
            console.warn(`[UIInGameBuildingSelect] Building info not found at index ${index}`);
            return;
        }

        // 设置标题（建筑名称）
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = buildingInfo.name;
        }

        // 设置状态文本
        const status = item.getChild('status') as fgui.GTextField;
        if (status) {
            status.text = buildingInfo.status;
            status.visible = buildingInfo.status !== "";
        }

        // 设置按钮可用性
        item.enabled = buildingInfo.enabled;

        // 监听选中事件
        item.onClick(() => {
            if (buildingInfo.enabled) {
                this.m_selectedBuildingType = buildingInfo.type;
                console.log(`[UIInGameBuildingSelect] Selected building type: ${buildingInfo.name} (${buildingInfo.type})`);
            }
        });
    }

    /**
     * 处理待决策事件
     * 当收到 DecisionPending 事件时，判断是否为 2x2 建筑 lv0→lv1 升级
     */
    private _onDecisionPending(data: any): void {
        console.log('[UIInGameBuildingSelect] DecisionPending event received', data);

        const session = data.session || GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.warn('[UIInGameBuildingSelect] GameSession not found');
            return;
        }

        // 检查是否满足 2x2 lv0 升级条件
        if (this._shouldShowForCurrentDecision()) {
            console.log('[UIInGameBuildingSelect] Showing building type selection for 2x2 upgrade');
            this.show(undefined, false);
        }
    }

    /**
     * 判断当前是否需要显示建筑类型选择
     */
    private _shouldShowForCurrentDecision(): boolean {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            return false;
        }

        const pendingDecision = session.getPendingDecision();
        if (!pendingDecision || pendingDecision.type !== DecisionType.UPGRADE_PROPERTY) {
            return false;
        }

        if (!session.isMyTurn()) {
            return false;
        }

        const building = session.getBuildingByTileId(pendingDecision.tileId);
        if (!building) {
            return false;
        }

        return building.size === BuildingSize.SIZE_2X2 && building.level === 0;
    }

    /**
     * Session 重置时强制隐藏
     */
    private _onSessionReset(): void {
        this._setVisible(false);
    }

    /**
     * 设置面板可见性（避免影响事件监听）
     */
    private _setVisible(visible: boolean): void {
        if (this.panel) {
            this.panel.visible = visible;
        } else {
            this.node.active = visible;
        }
    }

    /**
     * 升级按钮点击处理
     */
    private async onUpgradeClicked(): Promise<void> {
        console.log('[UIInGameBuildingSelect] Upgrade button clicked');

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            UINotification.error("游戏会话未找到");
            return;
        }

        // 禁用按钮，防止重复点击
        if (this.m_btnUpgrade) {
            this.m_btnUpgrade.enabled = false;
        }
        if (this.m_btnSkip) {
            this.m_btnSkip.enabled = false;
        }

        try {
            UINotification.info(`正在升级为${this._getBuildingTypeName(this.m_selectedBuildingType)}...`);

            // 获取必要参数
            const gameId = session.getGameId();
            const seatId = session.getMySeat()?.id;
            const templateMapId = session.getTemplateMapId();

            if (!seatId) {
                throw new Error('座位信息未找到');
            }

            // 构建升级交易
            const tx = SuiManager.instance.gameClient.game.buildUpgradeBuildingTx(
                gameId,
                seatId,
                templateMapId,
                this.m_selectedBuildingType
            );

            // 签名并执行
            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[UIInGameBuildingSelect] Upgrade transaction success', result.digest);
            UINotification.success("升级成功！");

            // 隐藏界面
            this.hide();

        } catch (error) {
            console.error('[UIInGameBuildingSelect] Upgrade failed:', error);
            UINotification.error(`升级失败: ${error.message || error}`);

            // 重新启用按钮
            if (this.m_btnUpgrade) {
                this.m_btnUpgrade.enabled = true;
            }
            if (this.m_btnSkip) {
                this.m_btnSkip.enabled = true;
            }
        }
    }

    /**
     * 跳过按钮点击处理
     */
    private async onSkipClicked(): Promise<void> {
        console.log('[UIInGameBuildingSelect] Skip button clicked');

        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            UINotification.error("游戏会话未找到");
            return;
        }

        // 禁用按钮，防止重复点击
        if (this.m_btnUpgrade) {
            this.m_btnUpgrade.enabled = false;
        }
        if (this.m_btnSkip) {
            this.m_btnSkip.enabled = false;
        }

        try {
            UINotification.info("正在跳过升级...");

            // 获取必要参数
            const gameId = session.getGameId();
            const seatId = session.getMySeat()?.id;
            const templateMapId = session.getTemplateMapId();

            if (!seatId) {
                throw new Error('座位信息未找到');
            }

            // 构建跳过交易
            const tx = SuiManager.instance.gameClient.game.buildSkipBuildingDecisionTx(
                gameId,
                seatId,
                templateMapId
            );

            // 签名并执行
            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[UIInGameBuildingSelect] Skip transaction success', result.digest);
            UINotification.success("已跳过升级");

            // 隐藏界面
            this.hide();

        } catch (error) {
            console.error('[UIInGameBuildingSelect] Skip failed:', error);
            UINotification.error(`跳过失败: ${error.message || error}`);

            // 重新启用按钮
            if (this.m_btnUpgrade) {
                this.m_btnUpgrade.enabled = true;
            }
            if (this.m_btnSkip) {
                this.m_btnSkip.enabled = true;
            }
        }
    }

    /**
     * 获取建筑类型的中文名称
     */
    private _getBuildingTypeName(type: BuildingType): string {
        const info = this.m_buildingTypes.find(b => b.type === type);
        return info?.name || "未知建筑";
    }

    /**
     * 隐藏界面并重置状态
     */
    public override hide(): void {
        this._setVisible(false);
        this._isShowing = false;

        // 重新启用按钮
        if (this.m_btnUpgrade) {
            this.m_btnUpgrade.enabled = true;
        }
        if (this.m_btnSkip) {
            this.m_btnSkip.enabled = true;
        }

        // 重置选中状态
        this.m_selectedBuildingType = BuildingType.TEMPLE;
        if (this.m_buildingList) {
            this.m_buildingList.selectedIndex = 0;
        }
    }
}
