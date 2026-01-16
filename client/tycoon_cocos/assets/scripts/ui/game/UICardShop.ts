/**
 * UICardShop - 卡片商店UI
 *
 * 功能：
 * - 显示所有17种卡片（kind 0-16）
 * - 普通卡片(0-7) 100/张，GM卡片(8-16) 500/张
 * - 使用list多选模式，最多选6种不同卡片
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
/** 最大选择数量 */
const MAX_CART_TOTAL = 6;
/** GM卡片起始kind */
const GM_CARD_START_KIND = 8;

@ccclass('UICardShop')
export class UICardShop extends UIBase {

    /** 卡片列表 */
    private m_cardList: fgui.GList | null = null;
    /** 购买按钮 */
    private m_btnBuy: fgui.GButton | null = null;
    /** 取消按钮 */
    private m_btnCancel: fgui.GButton | null = null;
    /** 数量显示文本 (显示 "X / 6") */
    private m_textNum: fgui.GTextField | null = null;
    /** 总价显示文本 */
    private m_textPrice: fgui.GTextField | null = null;

    /** 已选中的卡片kind集合（每种卡片最多1张） */
    private _selectedKinds: Set<number> = new Set();
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
        this._selectedKinds.clear();

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
        const item = obj as fgui.GButton;
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

        // 设置选中状态
        const isSelected = this._selectedKinds.has(kind);
        item.selected = isSelected;

        // GM卡片无权限时设置为灰显
        item.grayed = isGMCard && !canBuyGM;
    }

    /**
     * 获取已选卡片数量
     */
    private _getTotalCount(): number {
        return this._selectedKinds.size;
    }

    /**
     * 计算已选卡片总价
     */
    private _getTotalPrice(): number {
        let total = 0;
        for (const kind of this._selectedKinds) {
            const isGMCard = kind >= GM_CARD_START_KIND;
            const price = isGMCard ? GM_CARD_PRICE : NORMAL_CARD_PRICE;
            total += price;
        }
        return total;
    }

    /**
     * 更新数量和总价显示
     */
    private _updateTotalDisplay(): void {
        const count = this._selectedKinds.size;
        const price = this._getTotalPrice();

        if (this.m_textNum) {
            this.m_textNum.text = `${count} / ${MAX_CART_TOTAL}`;
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
        const data = item.data as { kind: number; price: number; isGMCard: boolean };
        if (!data) return;

        const kind = data.kind;
        const isGMCard = data.isGMCard;
        const isSelected = this._selectedKinds.has(kind);
        const button = item as fgui.GButton;

        if (isSelected) {
            // 取消选中
            this._selectedKinds.delete(kind);
            button.selected = false;
            console.log(`[UICardShop] 取消选中卡片 kind=${kind}`);
        } else {
            // 尝试选中
            if (this._selectedKinds.size >= MAX_CART_TOTAL) {
                console.log('[UICardShop] 已达最大选择数量');
                // 恢复未选中状态
                button.selected = false;
                return;
            }
            if (isGMCard && !this._gmPass) {
                console.log('[UICardShop] 没有GMPass，无法选择GM卡片');
                // 恢复未选中状态
                button.selected = false;
                return;
            }
            this._selectedKinds.add(kind);
            button.selected = true;
            console.log(`[UICardShop] 选中卡片 kind=${kind}`);
        }

        this._updateTotalDisplay();
    }

    /**
     * 购买按钮点击
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
            EventBus.emit(EventTypes.UI.ShowToast, { message: '余额不足' });
            return;
        }

        console.log('[UICardShop] 开始购买，已选卡片:', Array.from(this._selectedKinds));

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
            const mapTemplateId = session.getMapTemplateId();

            if (!gameId || !mySeat || !mapTemplateId) {
                throw new Error('Game ID, Seat or MapTemplate not found');
            }

            // 遍历已选卡片，每种购买1张
            let successCount = 0;
            let failCount = 0;

            for (const kind of this._selectedKinds) {
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
                        1,  // 每种卡片购买1张
                        mapTemplateId
                    );
                } else {
                    result = await CardInteraction.buyCard(
                        gameId,
                        mySeat.id,
                        kind,
                        1,  // 每种卡片购买1张
                        mapTemplateId
                    );
                }

                if (result.success) {
                    console.log(`[UICardShop] 购买成功: kind=${kind}`);
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
