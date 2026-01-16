/**
 * UICardShop - 卡片商店UI
 *
 * 功能：
 * - 显示所有17种卡片（kind 0-16）
 * - 普通卡片(0-7) 100/张，GM卡片(8-16) 500/张
 * - 购物车最多6张（总数）
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
import type { GMPass } from "../../sui/types/game";

const { ccclass } = _decorator;

/** 普通卡片价格 */
const NORMAL_CARD_PRICE = 100;
/** GM卡片价格 */
const GM_CARD_PRICE = 500;
/** 购物车最大数量 */
const MAX_CART_TOTAL = 6;
/** GM卡片起始kind */
const GM_CARD_START_KIND = 8;

interface CartItem {
    kind: number;
    count: number;
}

@ccclass('UICardShop')
export class UICardShop extends UIBase {

    /** 卡片列表 */
    private m_cardList: fgui.GList | null = null;
    /** 购买按钮 */
    private m_btnBuy: fgui.GButton | null = null;
    /** 取消按钮 */
    private m_btnCancel: fgui.GButton | null = null;
    /** 总数显示文本 */
    private m_textTotal: fgui.GTextField | null = null;
    /** 总价显示文本 */
    private m_textPrice: fgui.GTextField | null = null;

    /** 购物车 kind -> count */
    private _cart: Map<number, number> = new Map();
    /** 当前游戏的GMPass（null表示没有） */
    private _gmPass: GMPass | null = null;
    /** 所有卡片配置（缓存） */
    private _allCards: CardConfig[] = [];
    /** 当前玩家现金 */
    private _playerCash: bigint = 0n;

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
        // 卡片列表
        this.m_cardList = this.getList('cardList');
        if (this.m_cardList) {
            this.m_cardList.itemRenderer = this._renderCardItem.bind(this);
            console.log('[UICardShop] Card list setup');
        }

        // 购买按钮
        this.m_btnBuy = this.getButton('btnBuy');
        // 取消按钮
        this.m_btnCancel = this.getButton('btnCancel');
        // 总数文本
        this.m_textTotal = this.getText('textTotal');
        // 总价文本
        this.m_textPrice = this.getText('textPrice');

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
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected async onShow(data?: any): Promise<void> {
        console.log('[UICardShop] Opening card shop');

        // 清空购物车
        this._cart.clear();

        // 查询GMPass
        await this._queryGMPass();

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
        try {
            const session = GameInitializer.getInstance()?.getGameSession();
            if (!session) {
                console.warn('[UICardShop] GameSession not found');
                this._gmPass = null;
                return;
            }

            const gameId = session.getGameId();
            const myPlayer = session.getMyPlayer();
            if (!gameId || !myPlayer) {
                console.warn('[UICardShop] Game ID or player not found');
                this._gmPass = null;
                return;
            }

            const address = myPlayer.getAddress();
            const assetService = SuiManager.instance.getAssetService();

            if (!assetService) {
                console.warn('[UICardShop] AssetService not available');
                this._gmPass = null;
                return;
            }

            this._gmPass = await assetService.getPlayerGMPass(address, gameId);
            console.log('[UICardShop] GMPass query result:', this._gmPass ? 'found' : 'not found');

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
        this.m_cardList.numItems = this._allCards.length;
    }

    /**
     * 渲染卡片列表项
     */
    private _renderCardItem(index: number, obj: fgui.GObject): void {
        const item = obj.asCom;
        if (!item) return;

        const cardConfig = this._allCards[index];
        if (!cardConfig) return;

        const kind = cardConfig.kind;
        const isGMCard = kind >= GM_CARD_START_KIND;
        const price = isGMCard ? GM_CARD_PRICE : NORMAL_CARD_PRICE;
        const canBuyGM = isGMCard ? (this._gmPass !== null) : true;

        // 保存数据到item
        item.data = { kind, price, isGMCard };

        // 设置图标
        const icon = item.getChild('icon') as fgui.GLoader;
        if (icon) {
            const texturePath = `${cardConfig.iconPath}/texture`;
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

        // 设置名称
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = cardConfig.name;
        }

        // 设置价格
        const priceText = item.getChild('price') as fgui.GTextField;
        if (priceText) {
            priceText.text = `$${price}`;
        }

        // 设置数量
        const countInCart = this._cart.get(kind) || 0;
        const countText = item.getChild('count') as fgui.GTextField;
        if (countText) {
            countText.text = `${countInCart}`;
        }

        // GM卡片标记
        const gmLabel = item.getChild('gmLabel');
        if (gmLabel) {
            gmLabel.visible = isGMCard;
        }

        // 不可购买标记（GM卡片但无GMPass）
        const lockedOverlay = item.getChild('locked');
        if (lockedOverlay) {
            lockedOverlay.visible = isGMCard && !canBuyGM;
        }

        // +按钮
        const btnAdd = item.getChild('btnAdd') as fgui.GButton;
        if (btnAdd) {
            // 清除旧的handler
            const oldAddHandler = (btnAdd as any).__addHandler;
            if (oldAddHandler) {
                btnAdd.offClick(oldAddHandler, this);
            }

            const addHandler = () => this._onAddCard(kind);
            (btnAdd as any).__addHandler = addHandler;
            btnAdd.onClick(addHandler, this);

            // 禁用条件：购物车满 或 GM卡无权限
            btnAdd.enabled = this._canAddMore() && canBuyGM;
        }

        // -按钮
        const btnRemove = item.getChild('btnRemove') as fgui.GButton;
        if (btnRemove) {
            const oldRemoveHandler = (btnRemove as any).__removeHandler;
            if (oldRemoveHandler) {
                btnRemove.offClick(oldRemoveHandler, this);
            }

            const removeHandler = () => this._onRemoveCard(kind);
            (btnRemove as any).__removeHandler = removeHandler;
            btnRemove.onClick(removeHandler, this);

            // 禁用条件：当前卡片数量为0
            btnRemove.enabled = countInCart > 0;
        }
    }

    /**
     * 获取购物车总数
     */
    private _getTotalCount(): number {
        let total = 0;
        for (const count of this._cart.values()) {
            total += count;
        }
        return total;
    }

    /**
     * 计算购物车总价
     */
    private _getTotalPrice(): number {
        let total = 0;
        for (const [kind, count] of this._cart.entries()) {
            const isGMCard = kind >= GM_CARD_START_KIND;
            const price = isGMCard ? GM_CARD_PRICE : NORMAL_CARD_PRICE;
            total += price * count;
        }
        return total;
    }

    /**
     * 检查是否还能添加更多卡片
     */
    private _canAddMore(): boolean {
        return this._getTotalCount() < MAX_CART_TOTAL;
    }

    /**
     * 更新总数和总价显示
     */
    private _updateTotalDisplay(): void {
        const total = this._getTotalCount();
        const price = this._getTotalPrice();

        if (this.m_textTotal) {
            this.m_textTotal.text = `已选: ${total}/${MAX_CART_TOTAL}`;
        }
        if (this.m_textPrice) {
            this.m_textPrice.text = `总价: $${price}`;
        }

        // 更新购买按钮状态
        if (this.m_btnBuy) {
            const canAfford = BigInt(price) <= this._playerCash;
            this.m_btnBuy.enabled = total > 0 && canAfford;

            if (total > 0 && !canAfford) {
                this.m_btnBuy.title = '余额不足';
            } else {
                this.m_btnBuy.title = '购买';
            }
        }
    }

    /**
     * 添加卡片到购物车
     */
    private _onAddCard(kind: number): void {
        if (!this._canAddMore()) {
            console.log('[UICardShop] 购物车已满');
            return;
        }

        const isGMCard = kind >= GM_CARD_START_KIND;
        if (isGMCard && !this._gmPass) {
            console.log('[UICardShop] 没有GMPass，无法添加GM卡片');
            return;
        }

        const current = this._cart.get(kind) || 0;
        this._cart.set(kind, current + 1);

        console.log(`[UICardShop] 添加卡片 kind=${kind}, 当前数量=${current + 1}`);

        this._refreshList();
        this._updateTotalDisplay();
    }

    /**
     * 从购物车移除卡片
     */
    private _onRemoveCard(kind: number): void {
        const current = this._cart.get(kind) || 0;
        if (current <= 0) return;

        if (current === 1) {
            this._cart.delete(kind);
        } else {
            this._cart.set(kind, current - 1);
        }

        console.log(`[UICardShop] 移除卡片 kind=${kind}, 当前数量=${current - 1}`);

        this._refreshList();
        this._updateTotalDisplay();
    }

    /**
     * 购买按钮点击
     */
    private async _onBuyClick(): Promise<void> {
        const totalCount = this._getTotalCount();
        if (totalCount === 0) {
            console.log('[UICardShop] 购物车为空');
            return;
        }

        const totalPrice = this._getTotalPrice();
        if (BigInt(totalPrice) > this._playerCash) {
            console.log('[UICardShop] 余额不足');
            EventBus.emit(EventTypes.UI.ShowToast, { message: '余额不足' });
            return;
        }

        console.log('[UICardShop] 开始购买，购物车内容:', Array.from(this._cart.entries()));

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

            if (!gameId || !mySeat) {
                throw new Error('Game ID or Seat not found');
            }

            // 按卡片类型分批购买
            let successCount = 0;
            let failCount = 0;

            for (const [kind, count] of this._cart.entries()) {
                if (count <= 0) continue;

                const isGMCard = kind >= GM_CARD_START_KIND;

                let result;
                if (isGMCard) {
                    if (!this._gmPass) {
                        console.warn(`[UICardShop] 跳过GM卡片 kind=${kind}，无GMPass`);
                        failCount++;
                        continue;
                    }
                    result = await CardInteraction.buyGMCard(
                        gameId,
                        mySeat.id,
                        this._gmPass.id,
                        kind,
                        count
                    );
                } else {
                    result = await CardInteraction.buyCard(
                        gameId,
                        mySeat.id,
                        kind,
                        count
                    );
                }

                if (result.success) {
                    console.log(`[UICardShop] 购买成功: kind=${kind}, count=${count}`);
                    successCount++;
                } else {
                    console.error(`[UICardShop] 购买失败: kind=${kind}, error=${result.message}`);
                    failCount++;
                }
            }

            // 显示结果
            if (failCount === 0) {
                EventBus.emit(EventTypes.UI.ShowToast, { message: '购买成功' });
                // 发送卡片变化事件
                EventBus.emit(EventTypes.Player.CardChange, {});
                // 关闭商店
                this.hide();
            } else if (successCount > 0) {
                EventBus.emit(EventTypes.UI.ShowToast, { message: `部分购买成功 (${successCount}成功, ${failCount}失败)` });
                EventBus.emit(EventTypes.Player.CardChange, {});
            } else {
                EventBus.emit(EventTypes.UI.ShowToast, { message: '购买失败' });
            }

        } catch (error: any) {
            console.error('[UICardShop] 购买出错:', error);
            EventBus.emit(EventTypes.UI.ShowToast, { message: error.message || '购买失败' });
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
     * 取消按钮点击
     */
    private _onCancelClick(): void {
        console.log('[UICardShop] 取消购买');
        this.hide();
    }
}
