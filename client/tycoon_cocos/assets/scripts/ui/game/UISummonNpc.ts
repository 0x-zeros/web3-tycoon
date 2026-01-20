/**
 * UISummonNpc - NPC选择对话框
 *
 * 用于召唤卡使用时选择要召唤的NPC类型
 * 参考 UICardShop 实现
 *
 * @author Web3 Tycoon Team
 */

import { UIBase } from "../core/UIBase";
import { UIManager } from "../core/UIManager";
import * as fgui from "fairygui-cc";
import { _decorator, resources, Texture2D, SpriteFrame, Size, Rect } from 'cc';

const { ccclass } = _decorator;

/** NPC数据 */
export interface NpcData {
    kind: number;
    name: string;
    icon: string;
}

/** NPC列表数据 */
export const NPC_LIST: NpcData[] = [
    { kind: 20, name: '路障', icon: 'web3/npc/barrier' },
    { kind: 21, name: '炸弹', icon: 'web3/npc/bomb' },
    { kind: 22, name: '恶犬', icon: 'web3/npc/dog' },
    { kind: 23, name: '土地神', icon: 'web3/npc/land_god' },
    { kind: 24, name: '财神', icon: 'web3/npc/wealth_god' },
    { kind: 25, name: '福神', icon: 'web3/npc/fortune_god' },
    { kind: 26, name: '穷神', icon: 'web3/npc/poor_god' }
];

@ccclass('UISummonNpc')
export class UISummonNpc extends UIBase {

    /** NPC列表 */
    private m_list: fgui.GList | null = null;
    /** 确定按钮 */
    private m_btnOk: fgui.GButton | null = null;
    /** 取消按钮 */
    private m_btnCancel: fgui.GButton | null = null;
    /** 数量显示文本 */
    private m_textNum: fgui.GTextField | null = null;

    /** 当前选中的NPC kind */
    private _selectedKind: number | null = null;
    /** Promise resolve回调 */
    private _resolveCallback: ((kind: number | null) => void) | null = null;

    /** 静态实例（用于Promise方式调用） */
    private static _pendingResolve: ((kind: number | null) => void) | null = null;

    /**
     * 静态方法显示NPC选择对话框
     * @returns 选中的NPC kind，取消返回null
     */
    public static async show(): Promise<number | null> {
        return new Promise((resolve) => {
            UISummonNpc._pendingResolve = resolve;
            UIManager.instance.showUI('SummonNpc', { parentUIName: 'InGame' });
        });
    }

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
    }

    /**
     * 重写show方法，设置为非全屏
     */
    public show(data?: any, isFullScreen?: boolean): void {
        super.show(data, false);
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        this.m_list = this.getList('list');
        if (this.m_list) {
            this.m_list.itemRenderer = this._renderNpcItem.bind(this);
            console.log('[UISummonNpc] NPC list setup');
        }

        this.m_btnOk = this.getButton('btn_ok');
        this.m_btnCancel = this.getButton('btn_cancel');
        this.m_textNum = this.getText('num');
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (this.m_btnOk) {
            this.m_btnOk.onClick(this._onOkClick, this);
        }
        if (this.m_btnCancel) {
            this.m_btnCancel.onClick(this._onCancelClick, this);
        }
        if (this.m_list) {
            this.m_list.on(fgui.Event.CLICK_ITEM, this._onItemClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_btnOk) {
            this.m_btnOk.offClick(this._onOkClick, this);
        }
        if (this.m_btnCancel) {
            this.m_btnCancel.offClick(this._onCancelClick, this);
        }
        if (this.m_list) {
            this.m_list.off(fgui.Event.CLICK_ITEM, this._onItemClick, this);
        }
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log('[UISummonNpc] Opening NPC selector');

        // 清空选中状态
        this._selectedKind = null;

        // 获取静态Promise resolve
        if (UISummonNpc._pendingResolve) {
            this._resolveCallback = UISummonNpc._pendingResolve;
            UISummonNpc._pendingResolve = null;
        }

        // 刷新列表
        this._refreshList();
        this._updateDisplay();
    }

    /**
     * 隐藏回调
     */
    protected async onHide(): Promise<void> {
        console.log('[UISummonNpc] Closing NPC selector');

        // 如果有未处理的resolve，返回null
        if (this._resolveCallback) {
            this._resolveCallback(null);
            this._resolveCallback = null;
        }
    }

    /**
     * 刷新NPC列表
     */
    private _refreshList(): void {
        if (!this.m_list) return;

        this.m_list.numItems = 0;
        this.m_list.numItems = NPC_LIST.length;
    }

    /**
     * 渲染NPC列表项
     */
    private _renderNpcItem(index: number, obj: fgui.GObject): void {
        const item = obj as fgui.GButton;
        if (!item) return;

        const npcData = NPC_LIST[index];
        if (!npcData) return;

        // 保存数据到item
        item.data = npcData;

        // 设置标题
        const title = item.getChild('title') as fgui.GTextField;
        if (title) {
            title.text = npcData.name;
        }

        // 设置图标
        const icon = item.getChild('icon') as fgui.GLoader;
        if (icon) {
            const texturePath = `${npcData.icon}/texture`;
            resources.load(texturePath, Texture2D, (err, texture) => {
                if (!err && texture) {
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;
                    spriteFrame.originalSize = new Size(texture.width, texture.height);
                    spriteFrame.rect = new Rect(0, 0, texture.width, texture.height);
                    icon.texture = spriteFrame;
                } else {
                    console.warn(`[UISummonNpc] NPC图标未找到: ${texturePath}`);
                }
            });
        }

        // 设置选中状态
        item.selected = this._selectedKind === npcData.kind;
    }

    /**
     * 处理列表项点击（单选）
     */
    private _onItemClick(item: fgui.GObject): void {
        const data = item.data as NpcData;
        if (!data) return;

        const button = item as fgui.GButton;
        const wasSelected = this._selectedKind === data.kind;

        if (wasSelected) {
            // 点击已选中的项，取消选中
            this._selectedKind = null;
            button.selected = false;
            console.log(`[UISummonNpc] 取消选中NPC: ${data.name}`);
        } else {
            // 选中新项，取消其他选中
            // 遍历所有item取消选中
            for (let i = 0; i < this.m_list!.numItems; i++) {
                const otherItem = this.m_list!.getChildAt(i) as fgui.GButton;
                if (otherItem && otherItem !== button) {
                    otherItem.selected = false;
                }
            }

            this._selectedKind = data.kind;
            button.selected = true;
            console.log(`[UISummonNpc] 选中NPC: ${data.name} (kind=${data.kind})`);
        }

        this._updateDisplay();
    }

    /**
     * 更新显示（数量和按钮状态）
     */
    private _updateDisplay(): void {
        const count = this._selectedKind !== null ? 1 : 0;

        if (this.m_textNum) {
            this.m_textNum.text = `${count} / 1`;
        }

        if (this.m_btnOk) {
            this.m_btnOk.enabled = count > 0;
        }
    }

    /**
     * 确定按钮点击
     */
    private _onOkClick(): void {
        if (this._selectedKind === null) {
            console.log('[UISummonNpc] 未选择NPC');
            return;
        }

        console.log(`[UISummonNpc] 确定选择NPC: kind=${this._selectedKind}`);

        // 保存回调和选中值
        const resolve = this._resolveCallback;
        const selectedKind = this._selectedKind;

        // 清除回调（避免onHide重复调用）
        this._resolveCallback = null;

        // 关闭界面
        this.hide();

        // 返回选中的NPC kind
        if (resolve) {
            resolve(selectedKind);
        }
    }

    /**
     * 取消按钮点击（纯客户端）
     */
    private _onCancelClick(): void {
        console.log('[UISummonNpc] 取消选择');

        // 保存回调
        const resolve = this._resolveCallback;

        // 清除回调（避免onHide重复调用）
        this._resolveCallback = null;

        // 关闭界面
        this.hide();

        // 返回null
        if (resolve) {
            resolve(null);
        }
    }
}
