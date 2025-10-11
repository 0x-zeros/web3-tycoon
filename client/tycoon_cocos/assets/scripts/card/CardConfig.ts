/**
 * CardConfig - 卡牌配置系统
 * 参考 Move 端的 init_basic_cards
 */

export interface CardConfig {
    kind: number;
    name: string;
    description: string;
    targetType: number;  // 0=无, 1=玩家, 2=地块, 3=玩家或地块
    value: number;
    rarity: number;      // 0=common, 1=rare, 2=epic
    iconPath: string;
}

const CARD_CONFIGS: CardConfig[] = [
    { kind: 0, name: '遥控骰子', description: '控制下一次骰子点数', targetType: 0, value: 3, rarity: 0, iconPath: 'web3/cards/move_ctrl' },
    { kind: 1, name: '路障卡', description: '在地块上放置路障', targetType: 2, value: 0, rarity: 0, iconPath: 'web3/cards/barrier' },
    { kind: 2, name: '炸弹卡', description: '在地块上放置炸弹', targetType: 2, value: 0, rarity: 1, iconPath: 'web3/cards/bomb' },
    { kind: 3, name: '免租卡', description: '本回合避免支付租金', targetType: 0, value: 1, rarity: 1, iconPath: 'web3/cards/rent_free' },
    { kind: 4, name: '冰冻卡', description: '冻结一个玩家一回合', targetType: 1, value: 1, rarity: 2, iconPath: 'web3/cards/freeze' },
    { kind: 5, name: '恶犬卡', description: '在地块上放置恶犬', targetType: 2, value: 0, rarity: 1, iconPath: 'web3/cards/dog' },
    { kind: 6, name: '净化卡', description: '移除地块上的NPC', targetType: 2, value: 0, rarity: 0, iconPath: 'web3/cards/cleanse' },
    { kind: 7, name: '转向卡', description: '改变移动方向', targetType: 0, value: 0, rarity: 0, iconPath: 'web3/cards/turn' }
];

export class CardConfigManager {
    private static configs: Map<number, CardConfig> = new Map();
    private static initialized: boolean = false;

    static initialize() {
        if (this.initialized) return;
        CARD_CONFIGS.forEach(config => {
            this.configs.set(config.kind, config);
        });
        this.initialized = true;
    }

    static getConfig(kind: number): CardConfig | null {
        if (!this.initialized) this.initialize();
        return this.configs.get(kind) || null;
    }

    static getAllConfigs(): CardConfig[] {
        if (!this.initialized) this.initialize();
        return Array.from(this.configs.values());
    }
}
