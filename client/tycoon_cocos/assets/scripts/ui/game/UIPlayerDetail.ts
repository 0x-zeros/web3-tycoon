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
import { _decorator, resources, Texture2D, SpriteFrame, Size, Rect, Color } from 'cc';
import { GameInitializer } from "../../core/GameInitializer";
import { Card } from "../../card/Card";
import { getCardName } from "../../sui/types/cards";
import { CardConfigManager } from "../../card/CardConfig";
import { UINotification } from "../utils/UINotification";

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
        EventBus.on(EventTypes.Player.BuffsUpdated, this._onPlayerUpdate, this);
    }

    protected unbindEvents(): void {
        if (this.m_btnClose) {
            this.m_btnClose.offClick(this._onCloseClick, this);
        }

        EventBus.off(EventTypes.Player.CardChange, this._onCardChange, this);
        EventBus.off(EventTypes.Player.CardRemoved, this._onCardChange, this);
        EventBus.off(EventTypes.Player.MoneyChange, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Player.StatusChange, this._onPlayerUpdate, this);
        EventBus.off(EventTypes.Player.BuffsUpdated, this._onPlayerUpdate, this);

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
        }

        // 编号
        if (this.m_indexText) {
            this.m_indexText.text = `${this.m_playerIndex + 1}`;
        }

        // 玩家名称
        if (this.m_playerName) {
            this.m_playerName.text = `玩家 ${this.m_playerIndex + 1}`;
            this.m_playerName.color = this._getPlayerColor(this.m_playerIndex);
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
     */
    private renderBuffsList(buffsList: fgui.GList, player: any, session: any): void {
        const allBuffs = player.getAllBuffs();
        const currentRound = session.getRound();

        // 过滤激活的 buffs
        const activeBuffs = allBuffs.filter((buff: any) => currentRound <= buff.last_active_round);

        buffsList.numItems = activeBuffs.length;

        buffsList.itemRenderer = (index: number, obj: fgui.GObject) => {
            const buffItem = obj.asCom;
            const buff = activeBuffs[index];

            const titleLabel = buffItem.getChild('title') as fgui.GTextField;
            if (titleLabel) {
                titleLabel.text = this.getBuffDisplayName(buff.kind);
            }
        };
    }

    /**
     * 获取 Buff 中文名称
     */
    private getBuffDisplayName(buffKind: number): string {
        const buffNames: { [key: number]: string } = {
            1: '移动控制',
            2: '冻结',
            3: '免租',
            4: '停止',
            5: '转向',
            6: '飞行',
            7: '隐身',
            8: '加速',
            9: '减速',
            10: '护盾'
        };

        return buffNames[buffKind] || `Buff${buffKind}`;
    }

    /**
     * 获取玩家颜色
     */
    private _getPlayerColor(playerIndex: number): Color {
        switch (playerIndex) {
            case 0: return new Color(255, 193, 7);    // 亮黄
            case 1: return new Color(255, 82, 82);    // 亮红
            case 2: return new Color(105, 240, 174);  // 荧光绿
            case 3: return new Color(224, 64, 251);   // 荧光紫
            default: return new Color(255, 255, 255);
        }
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
    private _onPlayerUpdate(): void {
        this.refreshPlayerInfo();
    }
}
