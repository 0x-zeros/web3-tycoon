/**
 * UIPlayerProfile - 玩家资料面板
 *
 * 功能：
 * - 显示当前玩家名称
 * - 支持修改玩家名称
 * - 调用链上合约更新 Profile
 */

import { _decorator } from 'cc';
import * as fgui from 'fairygui-cc';
import { UIBase } from '../core/UIBase';
import { ProfileService } from '../../sui/services/ProfileService';
import { SuiManager } from '../../sui/managers/SuiManager';
import { PlayerProfile } from '../../sui/types/profile';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';

const { ccclass } = _decorator;

@ccclass('UIPlayerProfile')
export class UIPlayerProfile extends UIBase {
    // FairyGUI 组件引用
    private nameInput!: fgui.GTextInput;
    private btnUpdate!: fgui.GButton;
    private btnCancel!: fgui.GButton;

    // 当前 Profile 数据
    private currentProfile: PlayerProfile | null = null;
    private originalName: string = '';

    // 是否正在提交
    private isSubmitting: boolean = false;

    /**
     * UI 包名和组件名
     */
    protected static override getPackageName(): string {
        return 'Common';
    }

    protected static override getComponentName(): string {
        return 'PlayerProfile';
    }

    /**
     * 初始化（绑定组件）
     */
    protected onInit(): void {
        console.log('[UIPlayerProfile] Initializing...');

        // 绑定 FairyGUI 组件
        this.nameInput = this.getChild('name') as fgui.GTextInput;
        this.btnUpdate = this.getButton('btn_update')!;
        this.btnCancel = this.getButton('btn_cancel')!;

        // 绑定按钮事件
        this.btnUpdate?.onClick(this.onUpdateClick, this);
        this.btnCancel?.onClick(this.onCancelClick, this);

        console.log('[UIPlayerProfile] Initialized');
    }

    /**
     * 显示面板时加载当前玩家 Profile
     */
    protected override async onShow(_data?: any): Promise<void> {
        console.log('[UIPlayerProfile] onShow');

        // 重置状态
        this.isSubmitting = false;

        // 加载当前玩家的 Profile
        await this.loadCurrentProfile();
    }

    /**
     * 加载当前玩家的 Profile
     */
    private async loadCurrentProfile(): Promise<void> {
        const address = SuiManager.instance.currentAddress;
        if (!address) {
            console.warn('[UIPlayerProfile] 未连接钱包');
            this.currentProfile = null;
            this.originalName = '';
            this.nameInput.text = '';
            return;
        }

        try {
            this.currentProfile = await ProfileService.instance.getPlayerProfile(address);
            if (this.currentProfile) {
                this.nameInput.text = this.currentProfile.name;
                this.originalName = this.currentProfile.name;
                console.log('[UIPlayerProfile] 加载 Profile 成功:', this.currentProfile.name);
            } else {
                this.nameInput.text = '';
                this.originalName = '';
                console.log('[UIPlayerProfile] 玩家无 Profile，显示空白');
            }
        } catch (error) {
            console.error('[UIPlayerProfile] 加载 Profile 失败:', error);
            this.currentProfile = null;
            this.originalName = '';
            this.nameInput.text = '';
        }
    }

    /**
     * 更新按钮点击
     */
    private async onUpdateClick(): Promise<void> {
        if (this.isSubmitting) {
            console.log('[UIPlayerProfile] 正在提交中，忽略点击');
            return;
        }

        const newName = this.nameInput.text.trim();

        // 验证：空白不提交
        if (!newName) {
            console.log('[UIPlayerProfile] 名字为空，不提交');
            return;
        }

        // 验证：与原名一致不提交
        if (newName === this.originalName) {
            console.log('[UIPlayerProfile] 名字未改变，直接关闭');
            this.hidePanel();
            return;
        }

        this.isSubmitting = true;

        try {
            if (this.currentProfile) {
                // 更新现有 Profile
                console.log('[UIPlayerProfile] 更新玩家名称:', newName);
                await ProfileService.instance.updatePlayerName(this.currentProfile.id, newName);
            } else {
                // 创建新 Profile
                console.log('[UIPlayerProfile] 创建新 Profile:', newName);
                await ProfileService.instance.createPlayerProfile(newName, 0);
            }

            console.log('[UIPlayerProfile] 操作成功');
            this.hidePanel();

        } catch (error) {
            console.error('[UIPlayerProfile] 操作失败:', error);
            // 可以在这里显示错误提示
        } finally {
            this.isSubmitting = false;
        }
    }

    /**
     * 取消按钮点击
     */
    private onCancelClick(): void {
        console.log('[UIPlayerProfile] 取消');
        this.hidePanel();
    }

    /**
     * 隐藏面板
     */
    private hidePanel(): void {
        if (this._panel) {
            this._panel.visible = false;
        }
        // 发送关闭事件，用于同步按钮状态
        EventBus.emit(EventTypes.UI.PlayerProfileClosed);
    }

    /**
     * 解绑事件
     */
    protected override unbindEvents(): void {
        if (this.btnUpdate) {
            this.btnUpdate.offClick(this.onUpdateClick, this);
        }
        if (this.btnCancel) {
            this.btnCancel.offClick(this.onCancelClick, this);
        }
        super.unbindEvents();
    }
}
