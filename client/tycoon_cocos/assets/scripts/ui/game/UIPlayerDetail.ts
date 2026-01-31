/**
 * UIPlayerDetail - 玩家详情面板
 *
 * 功能：
 * - 显示选中玩家的详细信息（PlayerInfo）
 * - 显示该玩家持有的所有卡牌（CardList）
 * - 点击卡牌显示卡牌信息通知（不是使用卡牌）
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import * as fgui from "fairygui-cc";
import { _decorator, resources, Texture2D, SpriteFrame, Size, Rect } from 'cc';
import { GameInitializer } from "../../core/GameInitializer";
import { PlayerColors } from "../../utils/PlayerColors";
import { Card } from "../../card/Card";
import { getCardName } from "../../sui/types/cards";
import { CardConfigManager } from "../../card/CardConfig";
import { UINotification } from "../utils/UINotification";
import { EventLogService, EventLogFilter, DisplayLogItem, isDateSeparator } from "./event-log/EventLogService";
import { PlayerDisplayHelper } from "../utils/PlayerDisplayHelper";

const { ccclass } = _decorator;

@ccclass('UIPlayerDetail')
export class UIPlayerDetail extends UIBase {

    // 当前显示的玩家索引
    private m_playerIndex: number = -1;

    // 子组件
    private m_playerInfo: fgui.GComponent;
    private m_cardList: fgui.GList;
    private m_btnClose: fgui.GButton;

    // PlayerInfo 子元素
    private m_avatar: fgui.GLoader;
    private m_indexText: fgui.GTextField;
    private m_playerName: fgui.GTextField;
    private m_cash: fgui.GTextField;
    private m_status: fgui.GTextField;
    private m_buffs: fgui.GList;

    // 卡牌缓存
    private m_cardsCache: Card[] = [];

    // 事件日志组件
    private m_eventLog: fgui.GComponent | null = null;
    private m_logList: fgui.GList | null = null;
    private m_displayLogs: DisplayLogItem[] = [];

    // 日志过滤checkbox按钮
    private m_btnAllEvent: fgui.GButton | null = null;
    private m_btnAllPlayer: fgui.GButton | null = null;

    // 日志过滤配置
    private m_logFilterAllEvents: boolean = false;   // false=仅本次会话，true=所有历史事件
    private m_logFilterAllPlayers: boolean = true;   // false=仅当前玩家，true=所有玩家（默认显示所有玩家）

    // 页面控制器（用于检测当前是否在event页面）
    private m_controller: fgui.Controller | null = null;

    protected onInit(): void {
        this._setupComponents();
    }

    private _setupComponents(): void {
        // 获取 PlayerInfo 组件
        this.m_playerInfo = this.getChild('playerInfo')?.asCom;
        if (this.m_playerInfo) {
            this.m_avatar = this.m_playerInfo.getChild('avatar') as fgui.GLoader;
            this.m_indexText = this.m_playerInfo.getChild('index') as fgui.GTextField;
            this.m_playerName = this.m_playerInfo.getChild('playerName') as fgui.GTextField;
            this.m_cash = this.m_playerInfo.getChild('cash') as fgui.GTextField;
            this.m_status = this.m_playerInfo.getChild('status') as fgui.GTextField;
            this.m_buffs = this.m_playerInfo.getChild('buffs') as fgui.GList;
        }

        // 获取 CardList 组件
        const cardListComponent = this.getChild('cardList')?.asCom;
        if (cardListComponent) {
            this.m_cardList = cardListComponent.getChild('cards') as fgui.GList;
            if (this.m_cardList) {
                this.m_cardList.itemRenderer = this.renderCardItem.bind(this);
            }
        }

        // 获取关闭按钮（Button13 是组件类型，用 asCom 获取）
        this.m_btnClose = this.getButton('btn_close');
        // console.log('[UIPlayerDetail] btn_close:', this.m_btnClose ? 'found' : 'not found');

        // 获取事件日志组件
        this.m_eventLog = this.getChild('eventLog')?.asCom || null;
        if (this.m_eventLog) {
            this.m_logList = this.m_eventLog.getChild('list') as fgui.GList;
            if (this.m_logList) {
                this.m_logList.itemRenderer = this._renderLogItem.bind(this);
                const listAny = this.m_logList as any;
                if (typeof listAny.setVirtual === 'function') {
                    listAny.setVirtual();
                }
                console.log('[UIPlayerDetail] 事件日志组件初始化成功');
            }
        }

        // 获取过滤checkbox按钮
        this.m_btnAllEvent = this.getButton('btn_allEvent');
        this.m_btnAllPlayer = this.getButton('btn_allPlayer');

        // 获取页面控制器
        this.m_controller = this.getController('c1');

        // 初始化过滤按钮状态和标题
        if (this.m_btnAllEvent) {
            this.m_btnAllEvent.selected = this.m_logFilterAllEvents;
            this._updateAllEventButtonTitle();
        }
        if (this.m_btnAllPlayer) {
            this.m_btnAllPlayer.selected = this.m_logFilterAllPlayers;
            this._updateAllPlayerButtonTitle();
        }
    }

    protected bindEvents(): void {
        // 关闭按钮点击
        if (this.m_btnClose) {
            this.m_btnClose.onClick(this._onCloseClick, this);
            console.log('[UIPlayerDetail] 关闭按钮事件已绑定');
        } else {
            console.warn('[UIPlayerDetail] 关闭按钮未找到，无法绑定事件');
        }

        // 监听卡牌变化事件
        EventBus.on(EventTypes.Player.CardChange, this._onCardChange, this);
        EventBus.on(EventTypes.Player.CardRemoved, this._onCardChange, this);
        EventBus.on(EventTypes.Player.MoneyChange, this._onPlayerUpdate, this);
        EventBus.on(EventTypes.Player.StatusChange, this._onPlayerUpdate, this);
        EventBus.on(EventTypes.Player.BuffAdded, this._onPlayerUpdate, this);
        EventBus.on(EventTypes.Player.BuffRemoved, this._onPlayerUpdate, this);
        EventBus.on(EventTypes.Player.BuffsUpdated, this._onPlayerUpdate, this);
        EventBus.on(EventTypes.Game.TurnChanged, this._onPlayerUpdate, this);

        // 监听事件日志更新
        EventBus.on(EventTypes.UI.EventLogUpdated, this._onEventLogUpdated, this);

        // 过滤checkbox按钮点击
        if (this.m_btnAllEvent) {
            this.m_btnAllEvent.onClick(this._onAllEventClick, this);
        }
        if (this.m_btnAllPlayer) {
            this.m_btnAllPlayer.onClick(this._onAllPlayerClick, this);
        }
    }

    protected unbindEvents(): void {
        if (this.m_btnClose) {
            this.m_btnClose.offClick(this._onCloseClick, this);
        }
        if (this.m_btnAllEvent) {
            this.m_btnAllEvent.offClick(this._onAllEventClick, this);
        }
        if (this.m_btnAllPlayer) {
            this.m_btnAllPlayer.offClick(this._onAllPlayerClick, this);
        }

        EventBus.off(EventTypes.Player.CardChange, this._onCardChange, this);
        EventBus.off(EventTypes.Player.CardRemoved, this._onCardChange, this);
        EventBus.off(EventTypes.Player.MoneyChange, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Player.StatusChange, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Player.BuffAdded, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Player.BuffRemoved, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Player.BuffsUpdated, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Game.TurnChanged, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.UI.EventLogUpdated, this._onEventLogUpdated, this);

        super.unbindEvents();
    }

    protected onShow(data?: { playerIndex: number }): void {
        if (data && typeof data.playerIndex === 'number') {
            this.m_playerIndex = data.playerIndex;
        }
        this.refresh();
    }

    protected onRefresh(_data?: any): void {
        this.refresh();
    }

    public refresh(): void {
        if (this.m_playerIndex < 0) return;

        this.refreshPlayerInfo();
        this.refreshCardList();
        this._refreshEventLog();
    }

    /**
     * 刷新玩家信息
     */
    private refreshPlayerInfo(): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        const player = session?.getPlayerByIndex(this.m_playerIndex);

        if (!player) return;

        // 头像
        if (this.m_avatar) {
            this.loadPlayerAvatar(this.m_avatar, this.m_playerIndex);
            PlayerDisplayHelper.updatePlayerAvatar(this.m_avatar, player, player.getOwner());
        }

        // 编号
        if (this.m_indexText) {
            this.m_indexText.text = `${this.m_playerIndex + 1}`;
        }

        // 玩家名称
        if (this.m_playerName) {
            PlayerDisplayHelper.updatePlayerName(this.m_playerName, player, `玩家 ${this.m_playerIndex + 1}`, player.getOwner());
            this.m_playerName.color = PlayerColors.getColor(this.m_playerIndex);
        }

        // 现金
        if (this.m_cash) {
            this.m_cash.text = player.getCash().toString();
        }

        // 状态
        if (this.m_status) {
            if (player.isBankrupt()) {
                this.m_status.text = '破产';
            } else if (player.isInHospital()) {
                const turns = player.getInHospitalTurns();
                this.m_status.text = `住院中 (剩余${turns}回合)`;
            } else {
                this.m_status.text = '';
            }
        }

        // Buffs
        if (this.m_buffs) {
            this.renderBuffsList(this.m_buffs, player, session);
        }
    }

    /**
     * 刷新卡牌列表
     */
    private refreshCardList(): void {
        if (!this.m_cardList) return;

        const session = GameInitializer.getInstance()?.getGameSession();
        const player = session?.getPlayerByIndex(this.m_playerIndex);

        if (!player) {
            this.m_cardsCache = [];
            this.m_cardList.numItems = 0;
            return;
        }

        const cards = player.getAllCards();
        this.m_cardsCache = cards.filter(card => card.count > 0);

        // 强制重新渲染
        this.m_cardList.numItems = 0;
        this.m_cardList.numItems = this.m_cardsCache.length;

        console.log(`[UIPlayerDetail] 刷新卡牌列表，玩家${this.m_playerIndex}，卡牌数量: ${this.m_cardsCache.length}`);
    }

    /**
     * 渲染卡牌列表项
     */
    private renderCardItem(index: number, obj: fgui.GObject): void {
        const item = obj.asCom;
        const cardEntry = this.m_cardsCache[index];

        if (!cardEntry) return;

        // 保存数据到 item.data
        item.data = {
            kind: cardEntry.kind,
            count: cardEntry.count
        };

        // 设置图标
        const icon = item.getChild('icon') as fgui.GLoader;
        if (icon) {
            // 加载卡牌纹理 - 从CardConfig获取正确的iconPath
            const cardConfig = CardConfigManager.getConfig(cardEntry.kind);
            const texturePath = cardConfig ? `${cardConfig.iconPath}/texture` : null;

            if (!texturePath) {
                console.warn(`[UIPlayerDetail] 卡牌配置未找到: kind=${cardEntry.kind}`);
                icon.url = null;
                return;
            }

            resources.load(texturePath, Texture2D, (err, texture) => {
                if (!err && texture) {
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;
                    spriteFrame.originalSize = new Size(texture.width, texture.height);
                    spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                    icon.texture = spriteFrame;
                } else {
                    console.warn(`[UIPlayerDetail] 卡牌贴图未找到: ${texturePath}`);
                    icon.url = null;
                }
            });
        }

        // 设置标题
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = getCardName(cardEntry.kind);
        }

        // 设置数量
        const countText = item.getChild('count') as fgui.GTextField;
        if (countText) {
            countText.text = `x${cardEntry.count}`;
            countText.visible = true;
        }

        // 清除旧的点击 handler
        const existingClickHandler = (item as any).__cardClickHandler as Function | undefined;
        if (existingClickHandler) {
            item.offClick(existingClickHandler, this);
        }

        // 添加点击事件 - 显示卡牌信息（不是使用卡牌）
        const clickHandler = () => {
            const cardData = item.data as { kind: number; count: number };
            if (!cardData) return;

            const card = Card.fromEntry(cardData.kind, cardData.count);
            this.showCardInfo(card);
        };

        (item as any).__cardClickHandler = clickHandler;
        item.onClick(clickHandler, this);
    }

    /**
     * 显示卡牌信息通知
     */
    private showCardInfo(card: Card): void {
        const message = card.description || '暂无描述';
        UINotification.info(message, card.name, 3000, 'center');
    }

    /**
     * 加载玩家头像
     */
    private loadPlayerAvatar(loader: fgui.GLoader, playerIndex: number): void {
        const texturePath = `web3/actors/player_${playerIndex}/texture`;

        resources.load(texturePath, Texture2D, (err, texture) => {
            if (!err && texture) {
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.originalSize = new Size(texture.width, texture.height);
                spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                loader.texture = spriteFrame;
            } else {
                console.warn(`[UIPlayerDetail] Failed to load player avatar: ${texturePath}`);
            }
        });
    }

    /**
     * 渲染 Buffs 列表
     *
     * 剩余回合计算逻辑（与Move端一致）：
     * - 如果buff拥有者在本回合已行动（playerIndex < activePlayerIndex），剩余 = last_active_round - currentRound
     * - 如果buff拥有者在本回合未行动（playerIndex >= activePlayerIndex），剩余 = last_active_round - currentRound + 1
     * - 剩余回合 <= 0 时从显示中过滤掉
     */
    private renderBuffsList(buffsList: fgui.GList, player: any, session: any): void {
        const allBuffs = player.getAllBuffs() || [];
        const currentRound = session.getRound();
        const activePlayerIndex = session.getActivePlayerIndex();
        const buffOwnerIndex = player.getPlayerIndex();

        // 判断buff拥有者是否在本回合已行动
        const hasActedThisRound = buffOwnerIndex < activePlayerIndex;

        // 计算每个buff的剩余回合数，并过滤掉已失效的
        // 永久buff (last_active_round = 0xFFFF) 不会被过滤掉
        const activeBuffsWithRemaining = allBuffs
            .filter((buff: any) => buff != null)
            .map((buff: any) => {
                const isPermanent = buff.last_active_round >= 65535;
                if (isPermanent) {
                    return { buff, remaining: Infinity, isPermanent: true };
                }
                const baseRemaining = buff.last_active_round - currentRound;
                const remaining = hasActedThisRound ? baseRemaining : baseRemaining + 1;
                return { buff, remaining, isPermanent: false };
            })
            .filter((item: any) => item.remaining > 0);

        // 先设置 itemRenderer，再设置 numItems
        buffsList.itemRenderer = (index: number, obj: fgui.GObject) => {
            const buffItem = obj.asCom;
            const item = activeBuffsWithRemaining[index];

            // 防护：item可能为undefined
            if (!item) return;

            const { buff, remaining } = item;

            // 图标（使用resources加载）
            const icon = buffItem.getChild('icon') as fgui.GLoader;
            if (icon) {
                this.loadBuffIcon(icon, buff.kind);
            }

            // 名称 + 剩余回合数（永久buff只显示名称，不显示"永久"）
            const titleLabel = buffItem.getChild('title') as fgui.GTextField;
            if (titleLabel) {
                const name = this.getBuffDisplayName(buff.kind, buff.value);
                titleLabel.text = item.isPermanent ? name : `${name} ${remaining}`;
            }
        };

        buffsList.numItems = activeBuffsWithRemaining.length;
    }

    /**
     * 获取 Buff 中文名称
     * @param buffKind buff类型
     * @param buffValue buff值（用于区分摩托车/汽车），支持 number 或 bigint
     */
    private getBuffDisplayName(buffKind: number, buffValue?: number | bigint): string {
        // 特殊处理：LOCOMOTIVE buff 根据 value 显示不同名称
        if (buffKind === 6) {  // BUFF_LOCOMOTIVE
            const val = Number(buffValue ?? 0);  // 显式转换为 number 进行比较
            if (val === 3) return '汽车';
            if (val === 2) return '摩托车';
            return '机车卡';  // 默认
        }

        // Buff类型映射（对应Move端 types.move 的 BUFF_* 常量）
        const buffNames: { [key: number]: string } = {
            1: '遥控骰子',      // BUFF_MOVE_CTRL
            2: '冰冻',          // BUFF_FROZEN
            3: '免租',          // BUFF_RENT_FREE
            4: '土地神祝福',    // BUFF_LAND_BLESSING
            5: '福神幸运',      // BUFF_FORTUNE
            // 6: 已在上面特殊处理
            7: '传送',          // BUFF_TELEPORT
            8: '福神附身',      // BUFF_FORTUNE_BLESSING（购买/升级免费）
            9: '穷神诅咒',      // BUFF_RENT_DOUBLE（租金翻倍）
            10: '财神附身'      // BUFF_WEALTH_BLESSING（租金免除）
        };

        return buffNames[buffKind] || `Buff${buffKind}`;
    }

    // Buff图标SpriteFrame缓存（避免重复创建）
    private static _buffIconCache: Map<number, SpriteFrame> = new Map();

    /**
     * 加载Buff图标（带缓存和竞态保护）
     */
    private loadBuffIcon(loader: fgui.GLoader, buffKind: number): void {
        const iconMap: { [key: number]: string } = {
            1: 'buff_move_ctrl',      // 遥控骰子
            2: 'buff_frozen',         // 冰冻
            3: 'buff_rent_free',      // 免租
            4: 'buff_land_blessing',  // 土地神祝福
            5: 'buff_fortune',        // 福神幸运
            6: 'buff_locomotive',     // 机车卡
            8: 'buff_fortune',        // 福神附身 → 复用福神图标
            9: 'buff_frozen',         // 穷神诅咒 → 复用冰冻图标（负面）
            10: 'buff_rent_free'      // 财神附身 → 复用免租图标
        };

        const iconName = iconMap[buffKind];
        if (!iconName) return;

        // 标记loader当前期望的buffKind（用于竞态检查）
        (loader as any).__expectedBuffKind = buffKind;

        // 检查缓存
        const cached = UIPlayerDetail._buffIconCache.get(buffKind);
        if (cached) {
            loader.texture = cached;
            return;
        }

        const texturePath = `web3/ui/buff/${iconName}/texture`;

        resources.load(texturePath, Texture2D, (err, texture) => {
            // 竞态保护：检查loader是否仍期望这个buffKind
            if ((loader as any).__expectedBuffKind !== buffKind) return;

            if (!err && texture) {
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.originalSize = new Size(texture.width, texture.height);
                spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);

                // 缓存SpriteFrame
                UIPlayerDetail._buffIconCache.set(buffKind, spriteFrame);
                loader.texture = spriteFrame;
            }
        });
    }

    /**
     * 关闭按钮点击
     */
    private _onCloseClick(): void {
        console.log('[UIPlayerDetail] 关闭按钮点击');
        this.hide();
    }

    /**
     * 卡牌变化事件
     */
    private _onCardChange(): void {
        this.refreshCardList();
    }

    /**
     * 玩家信息更新事件
     */
    private _onPlayerUpdate(data?: any): void {
        console.log('[UIPlayerDetail] _onPlayerUpdate triggered', { isShowing: this.isShowing, data });
        if (this.isShowing) {
            this.refreshPlayerInfo();
        }
    }

    // ========================= 事件日志相关 =========================

    /**
     * 刷新事件日志列表
     */
    private _refreshEventLog(): void {
        if (!this.m_logList) return;

        const filter: EventLogFilter = {
            onlyCurrentSession: !this.m_logFilterAllEvents,
            playerIndex: this.m_logFilterAllPlayers ? undefined : this.m_playerIndex,
        };

        this.m_displayLogs = EventLogService.getInstance().getLogs(filter);

        // 更新列表（先清空，避免长度相同导致不刷新）
        this.m_logList.numItems = 0;
        this.m_logList.numItems = this.m_displayLogs.length;
        const listAny = this.m_logList as any;
        if (typeof listAny.refreshVirtualList === 'function') {
            listAny.refreshVirtualList();
        }
        if (typeof listAny.ensureBoundsCorrect === 'function') {
            listAny.ensureBoundsCorrect();
        }

        // 滚动到最新日志
        if (this.m_displayLogs.length > 0) {
            this.m_logList.scrollToView(this.m_displayLogs.length - 1, true, false);
        }
    }

    /**
     * 渲染单条日志项
     */
    private _renderLogItem(index: number, obj: fgui.GObject): void {
        try {
            const item = obj.asCom;
            const logItem = this.m_displayLogs[index];

            if (!logItem) return;

            // 获取富文本组件
            const title = item.getChild('title') as fgui.GRichTextField;
            if (!title) return;

            // 确保启用UBB解析
            title.ubbEnabled = true;

            // 判断是日期分隔符还是普通日志
            if (isDateSeparator(logItem)) {
                // 日期分隔符
                title.text = EventLogService.formatDateSeparatorText(logItem.dateString);

                // 固定高度
                item.setSize(item.width, 50, true);
            } else {
                // 普通日志
                title.text = logItem.text;

                // 自适应高度：根据文本实际高度调整item高度
                const titleAny = title as any;
                if (typeof titleAny.singleLine === 'boolean') {
                    titleAny.singleLine = false;
                }
                if (typeof titleAny.ensureSizeCorrect === 'function') {
                    titleAny.ensureSizeCorrect();
                }
                const rawTextHeight = Number(titleAny.textHeight);
                let textHeight = Number.isFinite(rawTextHeight) ? rawTextHeight : title.height;
                const fontSize = typeof titleAny.fontSize === 'number' ? titleAny.fontSize : 30;
                const leading = typeof titleAny.leading === 'number' ? titleAny.leading : 0;
                const lineCount = String(logItem.text || '').split('\n').length;
                const estimatedHeight = Math.max(1, lineCount) * (fontSize + leading);
                if (estimatedHeight > textHeight) {
                    textHeight = estimatedHeight;
                }
                const padding = 16;  // 上下padding
                const minHeight = 40;  // 最小高度
                const targetHeight = Math.max(textHeight + padding, minHeight);
                item.setSize(item.width, targetHeight, true);
                title.setSize(title.width, targetHeight - padding, true);
            }
        } catch (error) {
            console.error('[UIPlayerDetail] 渲染日志项失败:', error);
        }
    }

    /**
     * 事件日志更新回调
     */
    private _onEventLogUpdated(_data: any): void {
        // 只有当面板可见且在event页面时才刷新
        if (this.isShowing && this._isEventPageActive()) {
            this._refreshEventLog();
        }
    }

    /**
     * 检查是否在event页面
     */
    private _isEventPageActive(): boolean {
        if (!this.m_controller) return true;  // 如果没有控制器，默认刷新
        return this.m_controller.selectedIndex === 1;  // 1 = event页面
    }

    /**
     * 更新"所有事件"按钮标题
     */
    private _updateAllEventButtonTitle(): void {
        if (!this.m_btnAllEvent) return;
        this.m_btnAllEvent.title = this.m_logFilterAllEvents ? '所有事件' : '本次事件';
    }

    /**
     * 更新"所有玩家"按钮标题
     */
    private _updateAllPlayerButtonTitle(): void {
        if (!this.m_btnAllPlayer) return;
        this.m_btnAllPlayer.title = this.m_logFilterAllPlayers ? '所有玩家' : '当前玩家';
    }

    /**
     * "所有事件"按钮点击（切换是否显示历史事件）
     */
    private _onAllEventClick(): void {
        if (!this.m_btnAllEvent) return;

        // 切换选中状态
        this.m_logFilterAllEvents = !this.m_logFilterAllEvents;
        this.m_btnAllEvent.selected = this.m_logFilterAllEvents;
        this._updateAllEventButtonTitle();

        console.log('[UIPlayerDetail] 切换所有事件过滤:', this.m_logFilterAllEvents);

        if (this.m_logFilterAllEvents) {
            // 需要加载历史事件
            const service = EventLogService.getInstance();
            if (!service.isHistoryLoaded() && !service.isLoadingHistory()) {
                UINotification.info('正在从链上加载历史事件...', '加载中', 2000);
                service.loadHistoryFromChain().then(() => {
                    this._refreshEventLog();
                });
            } else {
                this._refreshEventLog();
            }
        } else {
            this._refreshEventLog();
        }
    }

    /**
     * "所有玩家"按钮点击（切换是否显示所有玩家事件）
     */
    private _onAllPlayerClick(): void {
        if (!this.m_btnAllPlayer) return;

        // 切换选中状态
        this.m_logFilterAllPlayers = !this.m_logFilterAllPlayers;
        this.m_btnAllPlayer.selected = this.m_logFilterAllPlayers;
        this._updateAllPlayerButtonTitle();

        console.log('[UIPlayerDetail] 切换所有玩家过滤:', this.m_logFilterAllPlayers);

        this._refreshEventLog();
    }

    /**
     * 设置日志过滤模式 - 所有事件
     * @param allEvents true=显示所有历史事件，false=仅本次会话
     */
    public setLogFilterAllEvents(allEvents: boolean): void {
        if (this.m_logFilterAllEvents !== allEvents) {
            this.m_logFilterAllEvents = allEvents;
            if (this.m_btnAllEvent) {
                this.m_btnAllEvent.selected = allEvents;
            }
            this._updateAllEventButtonTitle();
            this._refreshEventLog();
        }
    }

    /**
     * 设置日志过滤模式 - 所有玩家
     * @param allPlayers true=显示所有玩家，false=仅当前玩家
     */
    public setLogFilterAllPlayers(allPlayers: boolean): void {
        if (this.m_logFilterAllPlayers !== allPlayers) {
            this.m_logFilterAllPlayers = allPlayers;
            if (this.m_btnAllPlayer) {
                this.m_btnAllPlayer.selected = allPlayers;
            }
            this._updateAllPlayerButtonTitle();
            this._refreshEventLog();
        }
    }
}
