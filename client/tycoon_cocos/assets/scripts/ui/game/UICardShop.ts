/**
 * UICardShop - 卡片商店UI
 *
 * 功能：
 * - 显示所有17种卡片（kind 0-16）
 * - 普通卡片(0-7) 100/张，GM卡片(8-16) 500/张
 * - 有GMPass时，GM卡片显示1张和10张两个版本供选择
 * - 根据是否持有GMPass决定能否购买GM卡片
 *
 * @author Web3 Tycoon Team
 */

import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import * as fgui from "fairygui-cc";
import { _decorator, resources, Texture2D, SpriteFrame, Size, Rect } from 'cc';
import { GameInitializer } from "../../core/GameInitializer";
import { CardConfigManager, CardConfig } from "../../card/CardConfig";
import { CardInteraction } from "../../sui/interactions/CardInteraction";
import { SuiManager } from "../../sui/managers/SuiManager";
import { UINotification } from "../utils/UINotification";
import type { GMPass } from "../../sui/types/game";

const { ccclass } = _decorator;

/** GM卡片起始kind */
const GM_CARD_START_KIND = 8;

/** 卡片商店显示项 */
interface DisplayCardItem {
    kind: number;       // 卡片类型
    count: number;      // 数量（1 或 10）
    config: CardConfig; // 卡片配置
}

@ccclass('UICardShop')
export class UICardShop extends UIBase {

    /** 卡片列表 */
    private m_cardList: fgui.GList | null = null;
    /** 购买按钮 */
    private m_btnBuy: fgui.GButton | null = null;
    /** 取消按钮 */
    private m_btnCancel: fgui.GButton | null = null;
    /** 数量显示文本（显示总卡片数） */
    private m_textNum: fgui.GTextField | null = null;
    /** 总价显示文本 */
    private m_textPrice: fgui.GTextField | null = null;

    /** 已选中的显示项集合（使用引用比较） */
    private _selectedItems: Set<DisplayCardItem> = new Set();
    /** 当前游戏的GMPass（null表示没有） */
    private _gmPass: GMPass | null = null;
    /** 所有卡片配置（缓存） */
    private _allCards: CardConfig[] = [];
    /** 当前显示的卡片列表（包含1张和10张版本） */
    private _displayCards: DisplayCardItem[] = [];
    /** 当前玩家现金 */
    private _playerCash: bigint = 0n;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
    }

    /**
     * 重写show方法，设置为非全屏
     * 注意：居中对齐由 UIBase.addChildUI 处理
     */
    public show(data?: any, isFullScreen?: boolean): void {
        // 强制设置为非全屏
        super.show(data, false);
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        // 卡片列表
        this.m_cardList = this.getList('list');
        if (this.m_cardList) {
            this.m_cardList.itemRenderer = this._renderCardItem.bind(this);
            console.log('[UICardShop] Card list setup');
        }

        // 购买按钮
        this.m_btnBuy = this.getButton('btn_buy');
        // 取消按钮
        this.m_btnCancel = this.getButton('btn_cancel');
        // 数量文本 (显示 "X / 6")
        this.m_textNum = this.getText('num');
        // 总价文本
        this.m_textPrice = this.getText('totalPrice');

        // 初始化卡片配置
        CardConfigManager.initialize();
        this._allCards = CardConfigManager.getAllConfigs();
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btnBuy) {
            this.m_btnBuy.onClick(this._onBuyClick, this);
        }
        if (this.m_btnCancel) {
            this.m_btnCancel.onClick(this._onCancelClick, this);
        }
        // 监听list点击事件
        if (this.m_cardList) {
            this.m_cardList.on(fgui.Event.CLICK_ITEM, this._onItemClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btnBuy) {
            this.m_btnBuy.offClick(this._onBuyClick, this);
        }
        if (this.m_btnCancel) {
            this.m_btnCancel.offClick(this._onCancelClick, this);
        }
        if (this.m_cardList) {
            this.m_cardList.off(fgui.Event.CLICK_ITEM, this._onItemClick, this);
        }
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected async onShow(data?: any): Promise<void> {
        console.log('[UICardShop] Opening card shop');

        // 清空已选中的卡片
        this._selectedItems.clear();

        // 查询GMPass
        await this._queryGMPass();

        // 构建显示列表
        this._displayCards = [];

        if (this._gmPass) {
            // 有 GMPass：显示所有卡片，GM卡片显示1张和10张两个版本
            for (const config of this._allCards) {
                // 1张版本
                this._displayCards.push({ kind: config.kind, count: 1, config });
                // GM卡片额外添加10张版本
                if (config.gm) {
                    this._displayCards.push({ kind: config.kind, count: 10, config });
                }
            }
            console.log('[UICardShop] GMPass detected, showing all cards with 10-pack option for GM cards');
        } else {
            // 无 GMPass：只显示普通卡片 (gm=false)，每种1张
            for (const config of this._allCards) {
                if (!config.gm) {
                    this._displayCards.push({ kind: config.kind, count: 1, config });
                }
            }
            console.log('[UICardShop] No GMPass, showing normal cards only');
        }

        // 获取玩家现金
        this._updatePlayerCash();

        // 刷新列表
        this._refreshList();
        this._updateTotalDisplay();
    }

    /**
     * 查询当前玩家的GMPass
     */
    private async _queryGMPass(): Promise<void> {
        const session = GameInitializer.getInstance()?.getGameSession();
        const gameId = session?.getGameId();
        const myPlayer = session?.getMyPlayer();

        if (!gameId || !myPlayer) {
            this._gmPass = null;
            console.log('[UICardShop] Missing gameId or player, GMPass not available');
            return;
        }

        try {
            // 使用 AssetService 查询 GMPass
            const address = myPlayer.getOwner();
            const assetService = SuiManager.instance.assetService;

            if (assetService) {
                this._gmPass = await assetService.getPlayerGMPass(address, gameId);
                console.log('[UICardShop] GMPass query result:', this._gmPass ? 'Found' : 'Not found');
            } else {
                this._gmPass = null;
                console.log('[UICardShop] AssetService not available');
            }
        } catch (error) {
            console.error('[UICardShop] Failed to query GMPass:', error);
            this._gmPass = null;
        }
    }

    /**
     * 更新玩家现金
     */
    private _updatePlayerCash(): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        const myPlayer = session?.getMyPlayer();
        this._playerCash = myPlayer?.getCash() ?? 0n;
    }

    /**
     * 刷新卡片列表
     */
    private _refreshList(): void {
        if (!this.m_cardList) return;

        this.m_cardList.numItems = 0;
        this.m_cardList.numItems = this._displayCards.length;
    }

    /**
     * 渲染卡片列表项
     */
    private _renderCardItem(index: number, obj: fgui.GObject): void {
        const item = obj as fgui.GButton;
        if (!item) return;

        const displayItem = this._displayCards[index];
        if (!displayItem) return;

        const { kind, count, config } = displayItem;
        const isGMCard = config.gm;
        const canBuyGM = isGMCard ? (this._gmPass !== null) : true;

        // 保存 DisplayCardItem 引用到 item.data
        item.data = displayItem;

        // 设置图标
        const icon = item.getChild('icon') as fgui.GLoader;
        if (icon) {
            const texturePath = `${config.iconPath}/texture`;
            resources.load(texturePath, Texture2D, (err, texture) => {
                if (!err && texture) {
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;
                    spriteFrame.originalSize = new Size(texture.width, texture.height);
                    spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                    icon.texture = spriteFrame;
                }
            });
        }

        // 设置名称（10张版本显示"x10"后缀）
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = count > 1 ? `${config.name} x${count}` : config.name;
        }

        // 设置价格（显示总价 = 单价 × 数量）
        const priceText = item.getChild('price') as fgui.GTextField;
        if (priceText) {
            priceText.text = `$${config.price * count}`;
        }

        // 设置选中状态（使用引用比较）
        const isSelected = this._selectedItems.has(displayItem);
        item.selected = isSelected;

        // GM卡片无权限时设置为灰显
        item.grayed = isGMCard && !canBuyGM;
    }

    /**
     * 获取已选卡片总数量（计入count）
     */
    private _getTotalCount(): number {
        let total = 0;
        for (const item of this._selectedItems) {
            total += item.count;
        }
        return total;
    }

    /**
     * 计算已选卡片总价（单价 × 数量）
     */
    private _getTotalPrice(): number {
        let total = 0;
        for (const item of this._selectedItems) {
            total += item.config.price * item.count;
        }
        return total;
    }

    /**
     * 更新数量和总价显示
     */
    private _updateTotalDisplay(): void {
        const count = this._getTotalCount();
        const price = this._getTotalPrice();

        if (this.m_textNum) {
            this.m_textNum.text = `${count}`;
        }
        if (this.m_textPrice) {
            this.m_textPrice.text = `${price}`;
        }

        // 更新购买按钮状态
        if (this.m_btnBuy) {
            const canAfford = BigInt(price) <= this._playerCash;
            this.m_btnBuy.enabled = count > 0 && canAfford;

            if (count > 0 && !canAfford) {
                this.m_btnBuy.title = '余额不足';
            } else {
                this.m_btnBuy.title = '购买';
            }
        }
    }

    /**
     * 处理卡片点击（切换选中状态）
     */
    private _onItemClick(item: fgui.GObject): void {
        const displayItem = item.data as DisplayCardItem;
        if (!displayItem) return;

        const { kind, count, config } = displayItem;
        const isGMCard = config.gm;
        const isSelected = this._selectedItems.has(displayItem);
        const button = item as fgui.GButton;

        if (isSelected) {
            // 取消选中
            this._selectedItems.delete(displayItem);
            button.selected = false;
            console.log(`[UICardShop] 取消选中卡片 kind=${kind} x${count}`);
        } else {
            // 尝试选中
            if (isGMCard && !this._gmPass) {
                console.log('[UICardShop] 没有GMPass，无法选择GM卡片');
                button.selected = false;
                return;
            }
            this._selectedItems.add(displayItem);
            button.selected = true;
            console.log(`[UICardShop] 选中卡片 kind=${kind} x${count}`);
        }

        this._updateTotalDisplay();
    }

    /**
     * 购买按钮点击
     * 简化逻辑：有 GMPass 调用 buyGMCards（可购买所有卡），无 GMPass 调用 buyCards（只能购买普通卡）
     */
    private async _onBuyClick(): Promise<void> {
        const totalCount = this._getTotalCount();
        if (totalCount === 0) {
            console.log('[UICardShop] 未选择任何卡片');
            return;
        }

        const totalPrice = this._getTotalPrice();
        if (BigInt(totalPrice) > this._playerCash) {
            console.log('[UICardShop] 余额不足');
            UINotification.warning('余额不足', undefined, undefined, 'center');
            return;
        }

        // 构建 purchases 数组，每种卡片重复 count 次
        const purchases: number[] = [];
        for (const item of this._selectedItems) {
            for (let i = 0; i < item.count; i++) {
                purchases.push(item.kind);
            }
        }
        console.log('[UICardShop] 开始购买，已选卡片:', purchases);

        // 禁用购买按钮防止重复点击
        if (this.m_btnBuy) {
            this.m_btnBuy.enabled = false;
            this.m_btnBuy.title = '购买中...';
        }

        try {
            const session = GameInitializer.getInstance()?.getGameSession();
            if (!session) {
                throw new Error('GameSession not found');
            }

            const gameId = session.getGameId();
            const mySeat = session.getMySeat();
            const mapTemplate = session.getMapTemplate();
            const mapTemplateId = mapTemplate?.id;
            const gameDataId = SuiManager.instance.config?.gameDataId;

            if (!gameId || !mySeat || !mapTemplateId || !gameDataId) {
                throw new Error('Game ID, Seat, MapTemplate or GameData not found');
            }

            let result;

            if (this._gmPass) {
                // 有 GMPass：调用 buyGMCards，可购买所有卡片
                console.log('[UICardShop] Using buyGMCards (has GMPass)');
                result = await CardInteraction.buyGMCards(
                    gameId,
                    mySeat.id,
                    this._gmPass.id,
                    gameDataId,
                    purchases,
                    mapTemplateId
                );
            } else {
                // 无 GMPass：调用 buyCards，只能购买普通卡片
                console.log('[UICardShop] Using buyCards (no GMPass)');
                result = await CardInteraction.buyCards(
                    gameId,
                    mySeat.id,
                    gameDataId,
                    purchases,
                    mapTemplateId
                );
            }

            if (result.success) {
                console.log('[UICardShop] 卡片购买成功');
                UINotification.success('购买成功', undefined, undefined, 'center');
                this.hide();
            } else {
                console.error('[UICardShop] 卡片购买失败:', result.message);
                UINotification.error(result.message || '购买失败', undefined, undefined, 'center');
            }

        } catch (error: any) {
            console.error('[UICardShop] 购买出错:', error);
            UINotification.error(error.message || '购买失败', undefined, undefined, 'center');
        } finally {
            // 恢复购买按钮
            if (this.m_btnBuy) {
                this.m_btnBuy.enabled = true;
                this.m_btnBuy.title = '购买';
            }
            this._updateTotalDisplay();
        }
    }

    /**
     * 取消按钮点击 - 跳过卡片商店
     */
    private async _onCancelClick(): Promise<void> {
        console.log('[UICardShop] 跳过卡片商店');

        // 禁用取消按钮防止重复点击
        if (this.m_btnCancel) {
            this.m_btnCancel.enabled = false;
        }

        try {
            const session = GameInitializer.getInstance()?.getGameSession();
            if (!session) {
                throw new Error('GameSession not found');
            }

            const gameId = session.getGameId();
            const mySeat = session.getMySeat();
            const mapTemplate = session.getMapTemplate();
            const mapTemplateId = mapTemplate?.id;
            const gameDataId = SuiManager.instance.config?.gameDataId;

            if (!gameId || !mySeat || !mapTemplateId || !gameDataId) {
                throw new Error('Game ID, Seat, MapTemplate or GameData not found');
            }

            const result = await CardInteraction.skipCardShop(
                gameId,
                mySeat.id,
                gameDataId,
                mapTemplateId
            );

            if (result.success) {
                console.log('[UICardShop] 跳过成功');
                this.hide();
            } else {
                console.error('[UICardShop] 跳过失败:', result.message);
                UINotification.error(result.message || '操作失败', undefined, undefined, 'center');
            }

        } catch (error: any) {
            console.error('[UICardShop] 跳过出错:', error);
            UINotification.error(error.message || '操作失败', undefined, undefined, 'center');
        } finally {
            // 恢复取消按钮
            if (this.m_btnCancel) {
                this.m_btnCancel.enabled = true;
            }
        }
    }
}
