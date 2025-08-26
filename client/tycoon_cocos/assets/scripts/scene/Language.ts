import { _decorator, Component, Node, NodeEventType, EventTouch } from 'cc';
import { _ } from '../common/lodash-compat';
import Scene from './Scene';

const { ccclass, property } = _decorator;


/**
 * 语言选择场景
 * 允许用户切换游戏语言
 */
@ccclass('Language')
export default class Language extends Scene {
    @property(Node)
    btnClose: Node = null!;

    @property([Node])
    languageNodes: Node[] = [];

    /**
     * 启用时注册事件
     */
    onEnable(): void {
        super.onEnable?.();
        
        this.btnClose.on(NodeEventType.TOUCH_END, this.close, this);

        this.languageNodes.forEach((node: Node) => {
            node.on(NodeEventType.TOUCH_END, this.changeLanguage, this);
        });

        this.updateState();
    }

    /**
     * 禁用时注销事件
     */
    onDisable(): void {
        super.onDisable?.();
        
        this.btnClose.off(NodeEventType.TOUCH_END, this.close, this);

        this.languageNodes.forEach((node: Node) => {
            node.off(NodeEventType.TOUCH_END, this.changeLanguage, this);
        });
    }

    /**
     * 检查是否为相同语言
     * @param l1 语言1
     * @param l2 语言2
     * @returns 是否相同
     */
    private isSameLanguage(l1: string, l2: string): boolean {
        return l1 === l2;
    }

    /**
     * 更新语言选择状态
     */
    private updateState(): void {
        const language = game.player.setting.language;
        
        this.languageNodes.forEach((node: Node) => {
            const toggleSprite = node.getComponent('ToggleSprite');
            if (toggleSprite) {
                if (this.isSameLanguage(node.name, language)) {
                    toggleSprite.setOn(false); // 当前选中的语言
                } else {
                    toggleSprite.setOn(true); // 未选中的语言
                }
            }
        });
    }

    /**
     * 关闭语言选择界面
     */
    private close(): void {
        game.audioManager.playEffect('click');
        game.popScene();
    }

    /**
     * 切换语言
     * @param event 触摸事件
     */
    private changeLanguage(event: EventTouch): void {
        const targetNode = event.currentTarget as Node;
        
        if (game.player.changeLanguage(targetNode.name)) {
            this.updateState();
        }
    }

    /**
     * 获取当前选中的语言
     * @returns 当前语言
     */
    getCurrentLanguage(): string {
        return game.player.setting.language;
    }

    /**
     * 获取可用语言列表
     * @returns 语言节点名称数组
     */
    getAvailableLanguages(): string[] {
        return this.languageNodes.map(node => node.name);
    }

    /**
     * 设置语言节点的可见性
     * @param languageName 语言名称
     * @param visible 是否可见
     */
    setLanguageVisibility(languageName: string, visible: boolean): void {
        const node = this.languageNodes.find(n => n.name === languageName);
        if (node) {
            node.active = visible;
        }
    }

    /**
     * 程序化设置语言
     * @param languageName 语言名称
     */
    setLanguage(languageName: string): void {
        if (game.player.changeLanguage(languageName)) {
            this.updateState();
        }
    }

    /**
     * 检查指定语言是否可用
     * @param languageName 语言名称
     * @returns 是否可用
     */
    isLanguageAvailable(languageName: string): boolean {
        return this.languageNodes.some(node => node.name === languageName);
    }

    /**
     * 重置语言选择为默认语言
     */
    resetToDefaultLanguage(): void {
        const defaultLanguage = 'zh'; // 假设中文是默认语言
        if (this.isLanguageAvailable(defaultLanguage)) {
            this.setLanguage(defaultLanguage);
        }
    }

    /**
     * 获取语言显示名称
     * @param languageName 语言代码
     * @returns 显示名称
     */
    getLanguageDisplayName(languageName: string): string {
        const displayNames: { [key: string]: string } = {
            'zh': '中文',
            'en': 'English',
            'jp': '日本語',
            'tw': '繁體中文'
        };
        
        return displayNames[languageName] || languageName;
    }
}