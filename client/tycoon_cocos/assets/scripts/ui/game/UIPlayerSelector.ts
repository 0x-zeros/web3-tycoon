/**
 * UIPlayerSelector - 玩家选择器
 *
 * 使用 FairyGUI PlayerSelect 组件选择目标玩家
 * 用于冰冻卡等需要选择目标玩家的卡片
 *
 * @author Web3 Tycoon Team
 */

import * as fgui from 'fairygui-cc';
import { GameInitializer } from '../../core/GameInitializer';
import { UIMessage } from '../utils/UIMessage';
import { resources, Texture2D, SpriteFrame, Size, Rect } from 'cc';

/**
 * 玩家选择器
 */
export class UIPlayerSelector {
    private panel: fgui.GComponent | null = null;
    private playerList: fgui.GList | null = null;
    private btnOk: fgui.GButton | null = null;
    private btnCancel: fgui.GButton | null = null;
    private selectedIndex: number = -1;
    private resolveCallback: ((index: number | null) => void) | null = null;

    /**
     * 显示玩家选择对话框
     * @param excludeMyself 是否排除自己（冰冻卡不排除，可以对自己使用）
     * @returns 选中的玩家索引，取消返回null
     */
    async showPlayerSelection(excludeMyself: boolean = false): Promise<number | null> {
        const session = GameInitializer.getInstance()?.getGameSession();
        if (!session) {
            console.error('[UIPlayerSelector] GameSession未初始化');
            return null;
        }

        const allPlayers = session.getAllPlayers();
        const myPlayerIndex = session.getMyPlayerIndex();

        const selectablePlayers = allPlayers
            .map((player, index) => ({ player, index }))
            .filter(({ index }) => !excludeMyself || index !== myPlayerIndex);

        if (selectablePlayers.length === 0) {
            await UIMessage.warning('没有可选择的玩家');
            return null;
        }

        console.log('[UIPlayerSelector] 可选玩家数:', selectablePlayers.length);

        // 创建并显示弹窗
        return new Promise((resolve) => {
            this.resolveCallback = resolve;
            this.showDialog(selectablePlayers);
        });
    }

    /**
     * 显示FairyGUI对话框
     */
    private showDialog(players: Array<{ player: any; index: number }>): void {
        // 创建 PlayerSelect 组件
        this.panel = fgui.UIPackage.createObject('InGame', 'PlayerSelect').asCom;
        fgui.GRoot.inst.addChild(this.panel);
        this.panel.makeFullScreen();

        // 获取组件引用
        this.playerList = this.panel.getChild('list') as fgui.GList;
        this.btnOk = this.panel.getChild('btn_ok') as fgui.GButton;
        this.btnCancel = this.panel.getChild('btn_cancel') as fgui.GButton;

        // 设置列表
        if (this.playerList) {
            this.playerList.itemRenderer = this.renderPlayerItem.bind(this);
            this.playerList.on(fgui.Event.CLICK_ITEM, this.onItemClick, this);
            this.playerList.numItems = players.length;
            this.playerList.data = players; // 存储数据
        }

        // 绑定按钮
        if (this.btnOk) {
            this.btnOk.onClick(this.onOkClick, this);
            this.btnOk.enabled = false; // 初始禁用，选中后启用
        }

        if (this.btnCancel) {
            this.btnCancel.onClick(this.onCancelClick, this);
        }

        console.log('[UIPlayerSelector] 对话框已显示，玩家数:', players.length);
    }

    /**
     * 渲染玩家列表项
     */
    private renderPlayerItem(index: number, obj: fgui.GObject): void {
        const item = obj.asCom;
        const players = this.playerList?.data as Array<{ player: any; index: number }>;
        if (!players) return;

        const { player, index: playerIndex } = players[index];

        // 设置头像
        const avatar = item.getChild('avatar') as fgui.GLoader;
        if (avatar) {
            this.loadPlayerAvatar(avatar, playerIndex);
        }

        // 设置名称
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = `玩家${playerIndex + 1}号`;
        }

        // 存储玩家索引到item
        item.data = playerIndex;
    }

    /**
     * 加载玩家头像
     */
    private loadPlayerAvatar(loader: fgui.GLoader, playerIndex: number): void {
        const avatarPath = `textures/player/capy${(playerIndex % 3) + 1}`;
        resources.load(avatarPath, Texture2D, (err, texture) => {
            if (!err && texture) {
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.originalSize = new Size(texture.width, texture.height);
                spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                loader.texture = spriteFrame;
            } else {
                console.warn(`[UIPlayerSelector] 加载头像失败: ${avatarPath}`);
            }
        });
    }

    /**
     * 列表项点击
     */
    private onItemClick(item: fgui.GObject): void {
        this.selectedIndex = item.data as number;
        console.log('[UIPlayerSelector] 选中玩家:', this.selectedIndex);

        // 启用确定按钮
        if (this.btnOk) {
            this.btnOk.enabled = true;
        }
    }

    /**
     * 确定按钮点击
     */
    private onOkClick(): void {
        console.log('[UIPlayerSelector] 确认选择:', this.selectedIndex);
        this.close(this.selectedIndex);
    }

    /**
     * 取消按钮点击
     */
    private onCancelClick(): void {
        console.log('[UIPlayerSelector] 取消选择');
        this.close(null);
    }

    /**
     * 关闭对话框
     */
    private close(result: number | null): void {
        // 移除监听
        if (this.playerList) {
            this.playerList.off(fgui.Event.CLICK_ITEM, this.onItemClick, this);
        }
        if (this.btnOk) {
            this.btnOk.offClick(this.onOkClick, this);
        }
        if (this.btnCancel) {
            this.btnCancel.offClick(this.onCancelClick, this);
        }

        // 销毁面板
        if (this.panel) {
            fgui.GRoot.inst.removeChild(this.panel);
            this.panel.dispose();
            this.panel = null;
        }

        // 返回结果
        if (this.resolveCallback) {
            this.resolveCallback(result);
            this.resolveCallback = null;
        }

        this.selectedIndex = -1;
    }
}
