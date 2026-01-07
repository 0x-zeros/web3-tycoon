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
import type { Card as PlayerCard } from "../../card/Card";
import { getCardName } from "../../sui/types/cards";
import { CardConfigManager } from "../../card/CardConfig";
import UI_Card from '../../../.out/InGame/UI_Card';

const { ccclass } = _decorator;

@ccclass('UIInGameCards')
export class UIInGameCards extends UIBase {

    /** 卡牌列表 */
    private m_cardList: fgui.GList;
    /** 当前可显示的卡牌缓存（过滤count为0的卡） */
    private m_cardsCache: PlayerCard[] = [];

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

        // 监听回合变化事件（观战模式下刷新显示新活跃玩家的卡牌）
        EventBus.on(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        EventBus.off(EventTypes.Player.CardChange, this._onCardChange, this);
        EventBus.off(EventTypes.Player.CardRemoved, this._onCardChange, this);
        EventBus.off(EventTypes.Card.GetNewCard, this._onCardChange, this);
        EventBus.off(EventTypes.Card.UseCard, this._onCardChange, this);
        EventBus.off(EventTypes.Game.TurnChanged, this._onTurnChanged, this);

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
            this.m_cardsCache = [];
            this.m_cardList.numItems = 0;
            return;
        }

        // 观战模式：显示当前活跃玩家的卡牌
        // 正常模式：显示自己的卡牌
        const player = session.isSpectatorMode()
            ? session.getActivePlayer()
            : session.getMyPlayer();

        if (!player) {
            console.warn('[UIInGameCards] Player not found', {
                isSpectator: session.isSpectatorMode(),
                mode: session.isSpectatorMode() ? 'active player' : 'my player'
            });
            this.m_cardsCache = [];
            this.m_cardList.numItems = 0;
            return;
        }

        const cards = player.getAllCards();
        this.m_cardsCache = cards.filter(card => card.count > 0);
        console.log(`[UIInGameCards] ✅ 刷新列表，卡牌数量: ${this.m_cardsCache.length}`, {
            isSpectator: session.isSpectatorMode(),
            playerIndex: player.getPlayerIndex(),
            cards: this.m_cardsCache
        });

        // ✅ 强制重新渲染：先清零再设置（修复count变化但列表长度不变时不刷新的问题）
        this.m_cardList.numItems = 0;
        this.m_cardList.numItems = this.m_cardsCache.length;
    }

    /**
     * 渲染卡牌列表项
     */
    private renderCardItem(index: number, obj: fgui.GObject): void {
        const item = obj as UI_Card;  // ✅ 使用UI_Card类型

        const session = GameInitializer.getInstance()?.getGameSession();
        const gameData = session?.getGameData();

        if (!gameData) return;

        const cardEntry = this.m_cardsCache[index];

        if (!cardEntry) return;

        // === 重要：将cardEntry数据保存到item.data，避免闭包陷阱 ===
        item.data = {
            kind: cardEntry.kind,
            count: cardEntry.count
        };

        // 从 GameData 获取卡牌定义
        const cardDef = gameData.cardRegistry.getCard(cardEntry.kind);

        if (!cardDef) {
            console.warn(`[UIInGameCards] Card definition not found for kind: ${cardEntry.kind}`);
            return;
        }

        // 设置图标
        const icon = item.getChild('icon') as fgui.GLoader;
        if (icon) {
            // 加载卡牌纹理 - 从CardConfig获取正确的iconPath
            const cardConfig = CardConfigManager.getConfig(cardEntry.kind);
            const texturePath = cardConfig ? `${cardConfig.iconPath}/texture` : null;

            if (!texturePath) {
                console.warn(`[UIInGameCards] 卡牌配置未找到: kind=${cardEntry.kind}`);
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
                    console.warn(`[UIInGameCards] 卡牌贴图未找到: ${texturePath}，使用默认图标`);
                    // 清空贴图，避免显示错误图标
                    icon.url = null;
                }
            });
        }

        // 设置标题（卡牌名称 - 使用中文）
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = getCardName(cardEntry.kind);
        }

        // ✅ 设置数量 - 兼容未绑定UI扩展的情况
        const countText = item.m_count || (item.getChild('count') as fgui.GTextField);
        if (countText) {
            countText.text = `x${cardEntry.count}`;
            countText.visible = true;
            console.log(`[UIInGameCards] 设置count[${index}]: kind=${cardEntry.kind}, count=${cardEntry.count}`);
        } else {
            console.error('[UIInGameCards] count文本未找到！');
        }

        // ✅ 清除旧的onClick handler（防止handler累积导致重复触发）
        const existingClickHandler = (item as any).__cardClickHandler as Function | undefined;
        if (existingClickHandler) {
            item.offClick(existingClickHandler, this);
        }

        // === 添加点击事件 ===
        const clickHandler = async () => {
            try {
                // 从item.data获取数据，而不是闭包cardEntry
                const cardData = item.data as { kind: number; count: number };
                if (!cardData) {
                    console.error('[UIInGameCards] Card data not found in item.data');
                    return;
                }

                // 动态导入避免循环依赖
                const { Card } = await import('../../card/Card');
                const { CardUsageManager } = await import('../../card/CardUsageManager');

                // 创建Card实例
                const card = Card.fromEntry(cardData.kind, cardData.count);

                // 增强日志：显示kind值便于调试
                console.log(`[UIInGameCards] 点击卡片: ${card.name} (kind=${card.kind})`);

                // 调用CardUsageManager
                await CardUsageManager.instance.useCard(card);
            } catch (error: any) {
                console.error('[UIInGameCards] 使用卡片失败:', error);
            }
        };
        (item as any).__cardClickHandler = clickHandler;
        item.onClick(clickHandler, this);
    }

    /**
     * 卡牌变化事件处理
     */
    private _onCardChange(data?: any): void {
        console.log('[UIInGameCards] ✅ 收到卡牌变化事件:', data);
        this.refresh();
    }

    /**
     * 回合变化事件处理（观战模式下刷新显示新活跃玩家的卡牌）
     */
    private _onTurnChanged(data?: any): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (session?.isSpectatorMode()) {
            console.log('[UIInGameCards] 观战模式 - 回合变化，刷新卡牌列表');
            this.refresh();
        }
    }
}
