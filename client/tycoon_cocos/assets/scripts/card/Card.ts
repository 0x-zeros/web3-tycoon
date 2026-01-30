/**
 * Card - 卡牌类
 * 封装kind, count + 从config获取name, icon等
 * 客户端增强版：包含使用逻辑判断、可视化配置等
 */

import { CardConfig, CardConfigManager } from './CardConfig';
import { UIInGameDice } from '../ui/game/UIInGameDice';

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

    // 目标类型 Bit Flags（与 Move 端保持一致，可组合）
    // 例如：TARGET_PLAYER | TARGET_TILE = 3 表示先选玩家再选地块
    static readonly TARGET_NONE = 0;          // 0b0000
    static readonly TARGET_PLAYER = 1;        // 0b0001
    static readonly TARGET_TILE = 2;          // 0b0010
    static readonly TARGET_BUILDING = 4;      // 0b0100

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

    /**
     * 获取卡片范围配置
     * 0=全地图，255=动态计算，其他=步数限制
     */
    get range(): number {
        return this.config?.range ?? 0;
    }

    getRarityName(): string {
        const names = ['普通', '稀有', '史诗', 'GM'];
        return names[this.rarity] || '未知';
    }

    // === 卡片类型判断方法（使用位运算） ===

    /**
     * 是否可以直接使用（不需要选择目标）
     */
    canUseDirectly(): boolean {
        // 免租卡(3)、转向卡(7)
        return this.targetType === Card.TARGET_NONE;
    }

    /**
     * 是否需要选择玩家（检测 PLAYER bit）
     */
    needsPlayerTarget(): boolean {
        return (this.targetType & Card.TARGET_PLAYER) !== 0;
    }

    /**
     * 是否需要选择tile（检测 TILE bit）
     */
    needsTileTarget(): boolean {
        return (this.targetType & Card.TARGET_TILE) !== 0;
    }

    /**
     * 是否需要选择建筑（检测 BUILDING bit）
     */
    needsBuildingTarget(): boolean {
        return (this.targetType & Card.TARGET_BUILDING) !== 0;
    }

    /**
     * 是否需要多个目标（如瞬移卡需要选玩家+地块）
     */
    needsMultipleTargets(): boolean {
        const count =
            (this.needsPlayerTarget() ? 1 : 0) +
            (this.needsTileTarget() ? 1 : 0) +
            (this.needsBuildingTarget() ? 1 : 0);
        return count > 1;
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
     * 是否是GM卡片（需要GMPass购买）
     */
    isGMCard(): boolean {
        return this.config?.gm ?? false;
    }

    /**
     * 是否是瞬移卡
     */
    isTeleportCard(): boolean {
        return this.kind === 8; // CARD_TELEPORT
    }

    /**
     * 是否是建造卡
     */
    isConstructionCard(): boolean {
        return this.kind === 13; // CARD_CONSTRUCTION
    }

    /**
     * 是否是改建卡
     */
    isRenovationCard(): boolean {
        return this.kind === 14; // CARD_RENOVATION
    }

    /**
     * 是否是召唤卡
     */
    isSummonCard(): boolean {
        return this.kind === 15; // CARD_SUMMON
    }

    /**
     * 是否是驱逐卡
     */
    isBanishCard(): boolean {
        return this.kind === 16; // CARD_BANISH
    }

    /**
     * 是否是摩托车卡
     */
    isMotorcycleCard(): boolean {
        return this.kind === 17; // CARD_MOTORCYCLE
    }

    /**
     * 是否是汽车卡
     */
    isCarCard(): boolean {
        return this.kind === 18; // CARD_CAR
    }

    /**
     * 是否是载具卡（摩托车或汽车）
     */
    isVehicleCard(): boolean {
        return this.kind === 17 || this.kind === 18;
    }

    /**
     * 获取卡片使用的最大步数/范围
     * 基于 config.range 配置：
     * - 255: 动态计算（遥控骰子根据骰子数量）
     * - 0: 全地图（用于瞬移卡等）
     * - 其他: 固定步数限制
     */
    getMaxRange(): number {
        // 255 表示动态计算（遥控骰子）
        if (this.range === 255) {
            const diceCount = UIInGameDice.getSelectedDiceCount();
            return diceCount * 6;
        }
        return this.range;
    }

    /**
     * 是否为全地图选择（range=0 且需要选择tile）
     */
    isFullMapSelection(): boolean {
        return this.range === 0 && this.needsTileTarget();
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
        const colors = ['#FFFFFF', '#00FF00', '#FF00FF', '#FFD700']; // 普通/稀有/史诗/GM(金色)
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
