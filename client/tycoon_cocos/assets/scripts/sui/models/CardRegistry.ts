/**
 * CardRegistry 模型类
 * 对应 Move 端的 cards::CardRegistry 结构
 *
 * 职责：
 * - 存储所有卡牌的元数据定义（策划数据）
 * - 提供卡牌查询和过滤功能
 *
 * Move源文件: move/tycoon/sources/cards.move
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Card, CardRarity } from './Card';

/**
 * CardRegistry 类
 * 对应 Move 的 cards::CardRegistry 结构
 */
export class CardRegistry {

    // ========================= Move 端对应字段 =========================

    /** 注册表 ID */
    public readonly id: string;

    /** 卡牌列表（vector<Card>，索引即为 kind） */
    public readonly cards: Card[];

    // ========================= 构造函数 =========================

    constructor(id: string, cards: Card[]) {
        this.id = id;
        this.cards = cards;
    }

    // ========================= 静态工厂方法 =========================

    /**
     * 从 Move fields 加载 CardRegistry
     * @param fields Move 端的 CardRegistry 对象字段
     */
    public static loadFromFields(fields: any): CardRegistry {
        console.log('[CardRegistry] 从 fields 加载数据', fields);

        const id = fields.id?.id || fields.id || '';

        // 解析 cards vector
        const cardsData = fields.cards || [];
        const cards: Card[] = [];

        for (const cardData of cardsData) {
            try {
                // cardData 可能是 { fields: {...} } 或直接是字段对象
                const cardFields = cardData.fields || cardData;
                const card = Card.loadFromFields(cardFields);
                cards.push(card);
            } catch (error) {
                console.error('[CardRegistry] Failed to load card:', error);
            }
        }

        console.log(`[CardRegistry] 加载了 ${cards.length} 张卡牌`);

        return new CardRegistry(id, cards);
    }

    // ========================= 查询方法 =========================

    /**
     * 根据 kind 获取卡牌
     * @param kind 卡牌类型
     */
    public getCard(kind: number): Card | null {
        // cards 是 vector，索引即为 kind
        if (kind >= 0 && kind < this.cards.length) {
            return this.cards[kind];
        }
        return null;
    }

    /**
     * 检查是否有指定卡牌
     */
    public hasCard(kind: number): boolean {
        return kind >= 0 && kind < this.cards.length;
    }

    /**
     * 获取所有卡牌
     */
    public getAllCards(): Card[] {
        return [...this.cards];
    }

    /**
     * 根据稀有度过滤卡牌
     */
    public getCardsByRarity(rarity: CardRarity): Card[] {
        return this.cards.filter(card => card.rarity === rarity);
    }

    /**
     * 获取需要目标的卡牌
     */
    public getCardsNeedingTarget(): Card[] {
        return this.cards.filter(card => card.needsTarget());
    }

    /**
     * 获取卡牌总数
     */
    public getCardCount(): number {
        return this.cards.length;
    }

    /**
     * 根据名称搜索卡牌
     */
    public searchCardByName(name: string): Card[] {
        const lowerName = name.toLowerCase();
        return this.cards.filter(card =>
            card.name.toLowerCase().includes(lowerName)
        );
    }

    // ========================= 调试方法 =========================

    /**
     * 打印所有卡牌信息
     */
    public printAllCards(): void {
        console.log(`[CardRegistry] 共 ${this.cards.length} 张卡牌:`);
        this.cards.forEach((card, index) => {
            console.log(`  [${index}] ${card.toString()}`);
        });
    }

    /**
     * 调试输出
     */
    public debugInfo(): string {
        return JSON.stringify({
            id: this.id,
            cardCount: this.cards.length,
            cardsByRarity: {
                common: this.getCardsByRarity(CardRarity.COMMON).length,
                rare: this.getCardsByRarity(CardRarity.RARE).length,
                epic: this.getCardsByRarity(CardRarity.EPIC).length,
                legendary: this.getCardsByRarity(CardRarity.LEGENDARY).length
            }
        }, null, 2);
    }
}
