/**
 * UIInGamePlayer - 游戏内玩家面板模块
 *
 * 功能：
 * - 显示当前玩家信息（myPlayer）
 * - 显示所有玩家列表（playerList）
 * - 玩家头像使用 PaperActor 贴图
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

const { ccclass } = _decorator;

@ccclass('UIInGamePlayer')
export class UIInGamePlayer extends UIBase {

    // myPlayer 组件
    private m_myPlayer: fgui.GComponent;
    private m_myPlayerAvatar: fgui.GLoader;

    // playerList 组件
    private m_playerList: fgui.GList;

    protected onInit(): void {
        this._setupComponents();
    }

    private _setupComponents(): void {
        // myPlayer
        this.m_myPlayer = this.getChild('myPlayer')?.asCom;
        if (this.m_myPlayer) {
            this.m_myPlayerAvatar = this.m_myPlayer.getChild('avatar') as fgui.GLoader;
        }

        // playerList（list 名称为 "players"）
        const playerListContainer = this.getChild('playerList')?.asCom;
        if (playerListContainer) {
            this.m_playerList = playerListContainer.getChild('players') as fgui.GList;
            if (this.m_playerList) {
                this.m_playerList.itemRenderer = this.renderPlayerItem.bind(this);
            }
        }
    }

    protected bindEvents(): void {
        EventBus.on(EventTypes.Game.TurnEnd, this._onGameUpdate, this);
        EventBus.on(EventTypes.Player.MoneyChange, this._onGameUpdate, this);
        EventBus.on(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
    }

    protected unbindEvents(): void {
        EventBus.off(EventTypes.Game.TurnEnd, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.MoneyChange, this._onGameUpdate, this);
        EventBus.off(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
        super.unbindEvents();
    }

    protected onShow(data?: any): void {
        this.refresh();
    }

    protected onRefresh(data?: any): void {
        this.refresh();
    }

    public refresh(): void {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) return;

        this.refreshMyPlayer(session);
        this.refreshPlayerList(session);
    }

    private refreshMyPlayer(session: any): void {
        const myPlayer = session.getMyPlayer();
        if (!myPlayer || !this.m_myPlayerAvatar) return;

        const playerIndex = myPlayer.getPlayerIndex();
        this.loadPlayerAvatar(this.m_myPlayerAvatar, playerIndex);
    }

    private refreshPlayerList(session: any): void {
        if (!this.m_playerList) return;

        const players = session.getAllPlayers();
        this.m_playerList.numItems = players.length;

        // 初始化时选中当前回合玩家
        const activeIdx = session.getActivePlayerIndex();
        this.m_playerList.selectedIndex = activeIdx;

        console.log('[UIInGamePlayer] Player list refreshed', {
            count: players.length,
            selectedIndex: activeIdx
        });
    }

    private renderPlayerItem(index: number, obj: fgui.GObject): void {
        const item = obj.asCom;
        const session = GameInitializer.getInstance()?.getGameSession();
        const player = session?.getPlayerByIndex(index);

        if (!player) return;

        // 头像
        const avatar = item.getChild('avatar') as fgui.GLoader;
        if (avatar) {
            this.loadPlayerAvatar(avatar, index);
        }

        // 名字（可选）
        const name = item.getChild('name') as fgui.GTextField;
        if (name) {
            name.text = `玩家 ${index + 1}`;
        }

        // 金钱（可选）
        const money = item.getChild('money') as fgui.GTextField;
        if (money) {
            money.text = player.getCash().toString();
        }

        // 状态（可选）
        const status = item.getChild('status') as fgui.GTextField;
        if (status) {
            if (player.isBankrupt()) {
                status.text = '破产';
            } else if (player.isInPrison()) {
                const turns = player.getInPrisonTurns();
                status.text = `服刑中 (剩余${turns}回合)`;
            } else if (player.isInHospital()) {
                const turns = player.getInHospitalTurns();
                status.text = `住院中 (剩余${turns}回合)`;
            } else {
                status.text = '';
            }
        }

        // 当前回合标记（通过背景高亮）
        const activeIdx = session?.getActivePlayerIndex();
        const isActiveTurn = (index === activeIdx);

        // 如果 item 有 controller，使用 controller 控制选中状态
        const ctrl = item.getController('selected');
        if (ctrl) {
            ctrl.selectedIndex = isActiveTurn ? 1 : 0;
        }

        // 如果 item 有 bg，调整透明度
        const bg = item.getChild('bg') as fgui.GGraph;
        if (bg) {
            bg.alpha = isActiveTurn ? 1.0 : 0.6;
        }
    }

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
                console.warn(`[UIInGamePlayer] Failed to load player avatar: ${texturePath}`);
            }
        });
    }

    private _onGameUpdate(): void {
        this.refresh();
    }

    /**
     * 回合变化处理（选中当前回合玩家）
     */
    private _onTurnChanged(data: { newPlayerIndex: number }): void {
        if (this.m_playerList) {
            // 选中当前回合的玩家
            this.m_playerList.selectedIndex = data.newPlayerIndex;
            console.log('[UIInGamePlayer] 选中玩家:', data.newPlayerIndex);
        }

        // 刷新列表（更新高亮状态）
        this.refresh();
    }
}
