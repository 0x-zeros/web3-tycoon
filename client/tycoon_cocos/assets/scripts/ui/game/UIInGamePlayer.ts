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
import { _decorator, resources, Texture2D, SpriteFrame, Size, Rect, Color } from 'cc';
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
        EventBus.on(EventTypes.Player.CashChange, this._onGameUpdate, this);
        EventBus.on(EventTypes.Player.StatusChange, this._onGameUpdate, this);
        EventBus.on(EventTypes.Player.BuffAdded, this._onGameUpdate, this);
        EventBus.on(EventTypes.Player.BuffRemoved, this._onGameUpdate, this);
        EventBus.on(EventTypes.Player.BuffsUpdated, this._onGameUpdate, this);
        EventBus.on(EventTypes.Game.TurnChanged, this._onTurnChanged, this);
    }

    protected unbindEvents(): void {
        EventBus.off(EventTypes.Game.TurnEnd, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.MoneyChange, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.CashChange, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.StatusChange, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.BuffAdded, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.BuffRemoved, this._onGameUpdate, this);
        EventBus.off(EventTypes.Player.BuffsUpdated, this._onGameUpdate, this);
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

        // 玩家编号
        const indexText = item.getChild('index') as fgui.GTextField;
        if (indexText) {
            indexText.text = `${index + 1}`;
        }

        // 玩家名称（颜色与建筑 Owner 颜色一致，便于识别）
        const playerName = item.getChild('playerName') as fgui.GTextField;
        if (playerName) {
            playerName.text = `玩家 ${index + 1}`;
            playerName.color = this._getPlayerColor(index);
        }

        // 现金
        const cash = item.getChild('cash') as fgui.GTextField;
        if (cash) {
            cash.text = player.getCash().toString();
        }

        // 状态（可选）
        const status = item.getChild('status') as fgui.GTextField;
        if (status) {
            if (player.isBankrupt()) {
                status.text = '破产';
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

        // Buffs列表
        const buffsList = item.getChild('buffs') as fgui.GList;
        if (buffsList) {
            this.renderBuffsList(buffsList, player, session);
        }

        // 清除旧的点击 handler
        const existingClickHandler = (item as any).__playerClickHandler as Function | undefined;
        if (existingClickHandler) {
            item.offClick(existingClickHandler, this);
        }

        // 添加点击事件 - 显示玩家详情面板
        const clickHandler = () => {
            EventBus.emit(EventTypes.UI.ShowPlayerDetail, { playerIndex: index });
        };
        (item as any).__playerClickHandler = clickHandler;
        item.onClick(clickHandler, this);
    }

    /**
     * 渲染玩家的Buffs列表
     */
    private renderBuffsList(buffsList: fgui.GList, player: any, session: any): void {
        const allBuffs = player.getAllBuffs();
        const currentRound = session.getRound();

        // 过滤激活的buffs
        const activeBuffs = allBuffs.filter(buff => currentRound <= buff.last_active_round);

        // 设置列表项数量
        buffsList.numItems = activeBuffs.length;

        // 设置列表项渲染器
        buffsList.itemRenderer = (index: number, obj: fgui.GObject) => {
            const buffItem = obj.asCom;
            const buff = activeBuffs[index];

            // 获取title label
            const titleLabel = buffItem.getChild('title') as fgui.GTextField;
            if (titleLabel) {
                titleLabel.text = this.getBuffDisplayName(buff.kind);
            }
        };
    }

    /**
     * 获取Buff的中文显示名称
     */
    private getBuffDisplayName(buffKind: number): string {
        // Buff类型映射（参考Move合约types.move中的BUFF_*常量）
        const buffNames: { [key: number]: string } = {
            1: '移动控制',    // BUFF_MOVE_CTRL
            2: '冻结',        // BUFF_FROZEN
            3: '免租',        // BUFF_RENT_FREE
            4: '停止',        // BUFF_STOP
            5: '转向',        // BUFF_TURN
            6: '飞行',        // BUFF_FLY
            7: '隐身',        // BUFF_STEALTH
            8: '加速',        // BUFF_SPEED_UP
            9: '减速',        // BUFF_SPEED_DOWN
            10: '护盾'        // BUFF_SHIELD
        };

        return buffNames[buffKind] || `Buff${buffKind}`;
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
     * 获取玩家颜色（与建筑 Owner 颜色保持一致）
     * 颜色定义参考 NumberTextureGenerator.getBuildingOwnerColor
     */
    private _getPlayerColor(playerIndex: number): Color {
        switch (playerIndex) {
            case 0: return new Color(255, 193, 7);    // #FFC107 亮黄
            case 1: return new Color(255, 82, 82);    // #FF5252 亮红
            case 2: return new Color(105, 240, 174);  // #69F0AE 荧光绿
            case 3: return new Color(224, 64, 251);   // #E040FB 荧光紫
            default: return new Color(255, 255, 255); // 白色（默认）
        }
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
