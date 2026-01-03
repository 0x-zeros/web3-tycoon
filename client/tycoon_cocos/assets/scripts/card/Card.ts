/**
 * Card - 卡牌类
 * 封装kind, count + 从config获取name, icon等
 * 客户端增强版：包含使用逻辑判断、可视化配置等
 */

import { CardConfig, CardConfigManager } from './CardConfig';

/**
 * 卡片可视化配置
 */
export interface CardVisualConfig {
    iconPath: string;
    rarityColor: string;
    glowEffect: boolean;
    animationType: string;
}

export class Card {
    public readonly kind: number;
    public readonly count: number;
    private config: CardConfig | null;

    // 卡片放置范围（NPC类卡片）
    public readonly placementRange: number = 10;

    // 目标类型常量（与Move端保持一致）
    static readonly TARGET_NONE = 0;
    static readonly TARGET_PLAYER = 1;
    static readonly TARGET_TILE = 2;

    constructor(kind: number, count: number) {
        this.kind = kind;
        this.count = count;
        this.config = CardConfigManager.getConfig(kind);

        // 调试日志：检测kind-config不匹配
        if (this.config && this.config.kind !== kind) {
            console.error(`[Card] ⚠️ Kind mismatch! this.kind=${kind}, config.kind=${this.config.kind}, config.name=${this.config.name}`);
        }
    }

    static fromEntry(kind: number, count: number): Card {
        return new Card(kind, count);
    }

    // === 基础属性获取 ===

    get name(): string {
        return this.config?.name || `未知卡牌(${this.kind})`;
    }

    get description(): string {
        return this.config?.description || '';
    }

    get iconPath(): string {
        return this.config?.iconPath || 'web3/cards/default';
    }

    get rarity(): number {
        return this.config?.rarity || 0;
    }

    get targetType(): number {
        return this.config?.targetType || 0;
    }

    getRarityName(): string {
        const names = ['普通', '稀有', '史诗'];
        return names[this.rarity] || '未知';
    }

    // === 卡片类型判断方法 ===

    /**
     * 是否可以直接使用（不需要选择目标）
     */
    canUseDirectly(): boolean {
        // 免租卡(3)、转向卡(7)
        return this.targetType === Card.TARGET_NONE;
    }

    /**
     * 是否需要选择玩家
     */
    needsPlayerTarget(): boolean {
        // 冰冻卡(4)
        return this.targetType === Card.TARGET_PLAYER;
    }

    /**
     * 是否需要选择tile
     */
    needsTileTarget(): boolean {
        // 遥控骰子(0)、路障(1)、炸弹(2)、恶犬(5)、净化卡(6)
        return this.targetType === Card.TARGET_TILE;
    }

    /**
     * 是否是遥控骰子
     */
    isRemoteControlCard(): boolean {
        return this.kind === 0; // CARD_MOVE_CTRL
    }

    /**
     * 是否是净化卡（特殊逻辑：需要计算路径）
     */
    isCleanseCard(): boolean {
        return this.kind === 6; // CARD_CLEANSE
    }

    /**
     * 是否是简单NPC放置卡（路障、炸弹、恶犬）
     */
    isSimpleNpcCard(): boolean {
        // CARD_BARRIER(1), CARD_BOMB(2), CARD_DOG(5)
        return [1, 2, 5].includes(this.kind);
    }

    /**
     * 获取卡片使用的最大步数/范围
     */
    getMaxRange(): number {
        if (this.isRemoteControlCard()) {
            return 12; // 遥控骰子最大12步
        } else if (this.isCleanseCard()) {
            return 10; // 净化卡10步
        } else if (this.isSimpleNpcCard()) {
            return 10; // NPC放置卡10步范围
        }
        return 0;
    }

    /**
     * 获取放置范围（用于tile选择范围计算）
     */
    getPlacementRange(): number {
        return this.placementRange;
    }

    // === 可视化相关 ===

    /**
     * 获取稀有度颜色
     */
    getRarityColor(): string {
        const colors = ['#FFFFFF', '#00FF00', '#FF00FF']; // 普通/稀有/史诗
        return colors[this.rarity] || '#FFFFFF';
    }

    /**
     * 获取卡片可视化配置
     */
    getVisualConfig(): CardVisualConfig {
        return {
            iconPath: this.iconPath,
            rarityColor: this.getRarityColor(),
            glowEffect: this.rarity >= 2,
            animationType: this.getAnimationType()
        };
    }

    /**
     * 获取动画类型
     */
    private getAnimationType(): string {
        if (this.isRemoteControlCard()) return 'dice';
        if (this.isCleanseCard()) return 'cleanse';
        if (this.isSimpleNpcCard()) return 'npc';
        if (this.needsPlayerTarget()) return 'freeze';
        return 'default';
    }
}
