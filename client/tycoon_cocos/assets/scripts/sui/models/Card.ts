/**
 * Card 模型类
 * 对应 Move 端的 cards::Card 结构（卡牌元数据 - 策划数据）
 *
 * 注意：这是 CardRegistry 中的卡牌定义，不是玩家持有的卡牌
 * 玩家持有的卡牌用 CardEntry { kind, count } 记录
 *
 * Move源文件: move/tycoon/sources/cards.move
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

/**
 * 卡牌目标类型枚举 (Bit Flags)
 * 可组合：PLAYER | TILE = 3 表示需要选择玩家+地块
 */
export enum CardTargetType {
    NONE = 0,              // 0b0000 无目标
    PLAYER = 1,            // 0b0001 选择玩家
    TILE = 2,              // 0b0010 选择地块
    PLAYER_TILE = 3,       // 0b0011 先选玩家，再选地块（PLAYER | TILE）
    BUILDING = 4           // 0b0100 选择建筑
}

/**
 * 卡牌稀有度枚举
 */
export enum CardRarity {
    COMMON = 0,     // 普通
    RARE = 1,       // 稀有
    EPIC = 2,       // 史诗
    LEGENDARY = 3   // 传说
}

/**
 * Card 类
 * 对应 Move 的 cards::Card 结构
 */
export class Card {

    // ========================= Move 端对应字段 =========================

    /** 卡牌类型 */
    public readonly kind: number;

    /** 卡牌名称 */
    public readonly name: string;

    /** 卡牌描述 */
    public readonly description: string;

    /** 目标类型 */
    public readonly targetType: CardTargetType;

    /** 卡牌数值（如遥控骰的点数、免租卡持续回合数） */
    public readonly value: bigint;

    /** 稀有度 */
    public readonly rarity: CardRarity;

    // ========================= 构造函数 =========================

    constructor(
        kind: number,
        name: string,
        description: string,
        targetType: number,
        value: bigint,
        rarity: number
    ) {
        this.kind = kind;
        this.name = name;
        this.description = description;
        this.targetType = targetType as CardTargetType;
        this.value = value;
        this.rarity = rarity as CardRarity;
    }

    // ========================= 静态工厂方法 =========================

    /**
     * 从 Move fields 加载 Card
     * @param fields Move 端的 Card 对象字段
     */
    public static loadFromFields(fields: any): Card {
        return new Card(
            Number(fields.kind),
            this.decodeString(fields.name),
            this.decodeString(fields.description),
            Number(fields.target_type),
            BigInt(fields.value || 0),
            Number(fields.rarity)
        );
    }

    // ========================= 辅助方法 =========================

    /**
     * 解码 Move 的 vector<u8> 为 string
     */
    private static decodeString(bytes: any): string {
        if (typeof bytes === 'string') {
            return bytes;
        }

        if (Array.isArray(bytes)) {
            try {
                return String.fromCharCode(...bytes);
            } catch (e) {
                console.warn('[Card] Failed to decode string from bytes:', bytes);
                return '';
            }
        }

        return '';
    }

    // ========================= 查询方法（使用位运算） =========================

    /**
     * 是否需要目标
     */
    public needsTarget(): boolean {
        return this.targetType !== CardTargetType.NONE;
    }

    /**
     * 是否需要玩家目标（检测 PLAYER bit）
     */
    public needsPlayerTarget(): boolean {
        return (this.targetType & CardTargetType.PLAYER) !== 0;
    }

    /**
     * 是否需要地块目标（检测 TILE bit）
     */
    public needsTileTarget(): boolean {
        return (this.targetType & CardTargetType.TILE) !== 0;
    }

    /**
     * 是否需要建筑目标（检测 BUILDING bit）
     */
    public needsBuildingTarget(): boolean {
        return (this.targetType & CardTargetType.BUILDING) !== 0;
    }

    /**
     * 是否需要多个目标
     */
    public needsMultipleTargets(): boolean {
        const count =
            (this.needsPlayerTarget() ? 1 : 0) +
            (this.needsTileTarget() ? 1 : 0) +
            (this.needsBuildingTarget() ? 1 : 0);
        return count > 1;
    }

    /**
     * 获取目标类型名称
     */
    public getTargetTypeName(): string {
        if (this.targetType === CardTargetType.NONE) return '无目标';

        const parts: string[] = [];
        if (this.needsPlayerTarget()) parts.push('玩家');
        if (this.needsTileTarget()) parts.push('地块');
        if (this.needsBuildingTarget()) parts.push('建筑');

        return parts.length > 0 ? parts.join('+') : '未知';
    }

    /**
     * 获取稀有度名称
     */
    public getRarityName(): string {
        switch (this.rarity) {
            case CardRarity.COMMON: return '普通';
            case CardRarity.RARE: return '稀有';
            case CardRarity.EPIC: return '史诗';
            case CardRarity.LEGENDARY: return '传说';
            default: return '未知';
        }
    }

    /**
     * 获取稀有度颜色（用于UI显示）
     */
    public getRarityColor(): string {
        switch (this.rarity) {
            case CardRarity.COMMON: return '#FFFFFF';     // 白色
            case CardRarity.RARE: return '#0070DD';       // 蓝色
            case CardRarity.EPIC: return '#A335EE';       // 紫色
            case CardRarity.LEGENDARY: return '#FF8000';  // 橙色
            default: return '#CCCCCC';
        }
    }

    // ========================= 调试方法 =========================

    /**
     * 调试输出
     */
    public toString(): string {
        return `[Card] ${this.name} (${this.kind}) - ${this.description} [${this.getRarityName()}]`;
    }

    /**
     * 详细调试信息
     */
    public debugInfo(): string {
        return JSON.stringify({
            kind: this.kind,
            name: this.name,
            description: this.description,
            targetType: this.getTargetTypeName(),
            value: this.value.toString(),
            rarity: this.getRarityName()
        }, null, 2);
    }
}
