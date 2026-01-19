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
import { UINotification } from "../utils/UINotification";
import type { GMPass } from "../../sui/types/game";

const { ccclass } = _decorator;

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
    /** 当前显示的卡片列表（根据GMPass过滤） */
    private _displayCards: CardConfig[] = [];
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
        this._selectedKinds.clear();

        // 查询GMPass
        await this._queryGMPass();

        // 根据 GMPass 过滤卡片
        if (this._gmPass) {
            // 有 GMPass：显示所有卡片 (0-16)
            this._displayCards = this._allCards;
            console.log('[UICardShop] GMPass detected, showing all cards');
        } else {
            // 无 GMPass：只显示普通卡片 (gm=false)
            this._displayCards = this._allCards.filter(c => !c.gm);
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

        const cardConfig = this._displayCards[index];
        if (!cardConfig) return;

        const kind = cardConfig.kind;
        const isGMCard = cardConfig.gm;  // 使用 CardConfig 中的 gm 标志
        const price = cardConfig.price;   // 使用 CardConfig 中的价格
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
            const cardConfig = CardConfigManager.getConfig(kind);
            if (cardConfig) {
                total += cardConfig.price;
            }
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

        const purchases = Array.from(this._selectedKinds);
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
