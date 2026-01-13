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
import { PlayerDisplayHelper } from "../utils/PlayerDisplayHelper";
import { PlayerColors } from "../../utils/PlayerColors";

const { ccclass } = _decorator;

@ccclass('UIInGamePlayer')
export class UIInGamePlayer extends UIBase {

    // myPlayer 组件
    private m_myPlayer: fgui.GComponent;
    private m_myPlayerAvatar: fgui.GLoader;
    private m_status: fgui.GTextField;

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
            this.m_status = this.m_myPlayer.getChild('status') as fgui.GTextField;
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
        const isSpectator = session.isSpectatorMode();

        // 观战模式：显示当前活跃玩家
        // 正常模式：显示自己
        const player = isSpectator
            ? session.getActivePlayer()
            : session.getMyPlayer();

        // 更新状态标签
        if (this.m_status) {
            this.m_status.text = isSpectator ? '观战中' : '';
            this.m_status.visible = isSpectator;
        }

        if (!player) {
            if (this.m_myPlayerAvatar) {
                this.m_myPlayerAvatar.visible = false;
            }
            return;
        }

        if (!this.m_myPlayerAvatar) return;

        // 确保头像可见
        this.m_myPlayerAvatar.visible = true;

        const playerIndex = player.getPlayerIndex();
        this.loadPlayerAvatar(this.m_myPlayerAvatar, playerIndex);
        PlayerDisplayHelper.updatePlayerAvatar(this.m_myPlayerAvatar, player, player.getOwner());

        console.log('[UIInGamePlayer] Refresh myPlayer', {
            isSpectator,
            playerIndex,
            statusVisible: this.m_status?.visible
        });
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
            PlayerDisplayHelper.updatePlayerAvatar(avatar, player, player.getOwner());
        }

        // 玩家编号
        const indexText = item.getChild('index') as fgui.GTextField;
        if (indexText) {
            indexText.text = `${index + 1}`;
        }

        // 玩家名称（颜色与建筑 Owner 颜色一致，便于识别）
        const playerName = item.getChild('playerName') as fgui.GTextField;
        if (playerName) {
            PlayerDisplayHelper.updatePlayerName(playerName, player, `玩家 ${index + 1}`, player.getOwner());
            playerName.color = PlayerColors.getColor(index);
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

            // 图标（使用resources加载）
            const icon = buffItem.getChild('icon') as fgui.GLoader;
            if (icon) {
                this.loadBuffIcon(icon, buff.kind);
            }

            // 名称 + 剩余回合数
            const titleLabel = buffItem.getChild('title') as fgui.GTextField;
            if (titleLabel) {
                const name = this.getBuffDisplayName(buff.kind);
                const remainingRounds = buff.last_active_round - currentRound + 1;
                titleLabel.text = `${name} ${remainingRounds}`;
            }
        };
    }

    /**
     * 获取Buff的中文显示名称
     */
    private getBuffDisplayName(buffKind: number): string {
        // Buff类型映射（对应Move端 types.move 的 BUFF_* 常量）
        const buffNames: { [key: number]: string } = {
            1: '遥控骰子',      // BUFF_MOVE_CTRL
            2: '冰冻',          // BUFF_FROZEN
            3: '免租',          // BUFF_RENT_FREE
            4: '土地神祝福',    // BUFF_LAND_BLESSING
            5: '福神幸运',      // BUFF_FORTUNE
            6: '机车卡'         // BUFF_LOCOMOTIVE
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
            6: 'buff_locomotive'      // 机车卡
        };

        const iconName = iconMap[buffKind];
        if (!iconName) return;

        // 标记loader当前期望的buffKind（用于竞态检查）
        (loader as any).__expectedBuffKind = buffKind;

        // 检查缓存
        const cached = UIInGamePlayer._buffIconCache.get(buffKind);
        if (cached) {
            loader.texture = cached;
            return;
        }

        const texturePath = `web3/ui/buff/${iconName}`;

        resources.load(texturePath, Texture2D, (err, texture) => {
            // 竞态保护：检查loader是否仍期望这个buffKind
            if ((loader as any).__expectedBuffKind !== buffKind) return;

            if (!err && texture) {
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.originalSize = new Size(texture.width, texture.height);
                spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);

                // 缓存SpriteFrame
                UIInGamePlayer._buffIconCache.set(buffKind, spriteFrame);
                loader.texture = spriteFrame;
            }
        });
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
