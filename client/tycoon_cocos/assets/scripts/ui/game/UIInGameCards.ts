/**
 * UIInGameCards - 游戏内卡牌列表模块
 *
 * 功能：
 * - 显示当前玩家持有的所有卡牌
 * - 列表项：icon（卡牌贴图）+ title（卡牌名字）+ count（数量）
 * - 数据来源：GameSession.getActivePlayer().getAllCards()
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
import { getCardName } from "../../sui/types/cards";

const { ccclass } = _decorator;

@ccclass('UIInGameCards')
export class UIInGameCards extends UIBase {

    /** 卡牌列表 */
    private m_cardList: fgui.GList;

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
        // 获取 cards 组件中的 list（名称为 "cards"）
        this.m_cardList = this.getList('cards');

        if (this.m_cardList) {
            this.m_cardList.itemRenderer = this.renderCardItem.bind(this);
            console.log('[UIInGameCards] Card list setup');
        } else {
            console.error('[UIInGameCards] Card list not found');
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 监听卡牌变化事件
        EventBus.on(EventTypes.Player.CardChange, this._onCardChange, this);  // ✅ 监听 Player.addCard() 触发的事件
        EventBus.on(EventTypes.Player.CardRemoved, this._onCardChange, this);  // ✅ 监听 Player.removeCard() 触发的事件
        EventBus.on(EventTypes.Card.GetNewCard, this._onCardChange, this);
        EventBus.on(EventTypes.Card.UseCard, this._onCardChange, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        EventBus.off(EventTypes.Player.CardChange, this._onCardChange, this);
        EventBus.off(EventTypes.Player.CardRemoved, this._onCardChange, this);
        EventBus.off(EventTypes.Card.GetNewCard, this._onCardChange, this);
        EventBus.off(EventTypes.Card.UseCard, this._onCardChange, this);

        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIInGameCards] Showing cards");
        this.refresh();
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this.refresh();
    }

    /**
     * 刷新卡牌列表
     */
    public refresh(): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.warn('[UIInGameCards] GameSession not found');
            this.m_cardList.numItems = 0;
            return;
        }

        const player = session.getMyPlayer();
        if (!player) {
            console.warn('[UIInGameCards] My player not found');
            this.m_cardList.numItems = 0;
            return;
        }

        const cards = player.getAllCards();
        this.m_cardList.numItems = cards.length;

        console.log(`[UIInGameCards] Refreshed with ${cards.length} cards`);
    }

    /**
     * 渲染卡牌列表项
     */
    private renderCardItem(index: number, obj: fgui.GObject): void {
        const item = obj.asCom;

        const session = GameInitializer.getInstance()?.getGameSession();
        const player = session?.getMyPlayer();
        const gameData = session?.getGameData();

        if (!player || !gameData) return;

        const cards = player.getAllCards();
        const cardEntry = cards[index];

        if (!cardEntry) return;

        // 从 GameData 获取卡牌定义
        const cardDef = gameData.cardRegistry.getCard(cardEntry.kind);

        if (!cardDef) {
            console.warn(`[UIInGameCards] Card definition not found for kind: ${cardEntry.kind}`);
            return;
        }

        // 设置图标
        const icon = item.getChild('icon') as fgui.GLoader;
        if (icon) {
            // 加载卡牌纹理
            const texturePath = `web3/cards/${cardEntry.kind}/texture`;
            resources.load(texturePath, Texture2D, (err, texture) => {
                if (!err && texture) {
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;
                    spriteFrame.originalSize = new Size(texture.width, texture.height);
                    spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                    icon.texture = spriteFrame;
                } else {
                    console.warn(`[UIInGameCards] Failed to load card texture: ${texturePath}`);
                }
            });
        }

        // 设置标题（卡牌名称 - 使用中文）
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = getCardName(cardEntry.kind);
        }

        // 设置数量
        const count = item.getChild('count') as fgui.GTextField;
        if (count) {
            count.text = `x${cardEntry.count}`;
        }
    }

    /**
     * 卡牌变化事件处理
     */
    private _onCardChange(data?: any): void {
        console.log('[UIInGameCards] Card changed, refreshing');
        this.refresh();
    }
}
