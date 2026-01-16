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

// targetType: 0=无, 1=玩家, 2=地块, 3=玩家+地块, 4=建筑
const CARD_CONFIGS: CardConfig[] = [
    // 普通卡片 (0-7)
    { kind: 0, name: '遥控骰子', description: '控制下一次移动到指定位置', targetType: 2, value: 3, rarity: 0, iconPath: 'web3/cards/move_ctrl' },
    { kind: 1, name: '路障卡', description: '在地块上放置路障', targetType: 2, value: 0, rarity: 0, iconPath: 'web3/cards/barrier' },
    { kind: 2, name: '炸弹卡', description: '在地块上放置炸弹', targetType: 2, value: 0, rarity: 1, iconPath: 'web3/cards/bomb' },
    { kind: 3, name: '免租卡', description: '本回合避免支付租金', targetType: 0, value: 1, rarity: 1, iconPath: 'web3/cards/rent_free' },
    { kind: 4, name: '冰冻卡', description: '冻结一个玩家一回合', targetType: 1, value: 1, rarity: 2, iconPath: 'web3/cards/freeze' },
    { kind: 5, name: '狗狗卡', description: '在地块上放置恶犬', targetType: 2, value: 0, rarity: 1, iconPath: 'web3/cards/dog' },
    { kind: 6, name: '机器娃娃', description: '清除一段路上的所有NPC', targetType: 2, value: 0, rarity: 0, iconPath: 'web3/cards/cleanse' },
    { kind: 7, name: '转向卡', description: '改变移动方向', targetType: 0, value: 0, rarity: 0, iconPath: 'web3/cards/turn' },

    // GM卡片 (8-16，需要GMPass购买)
    { kind: 8, name: '瞬移卡', description: '传送玩家到指定地块', targetType: 3, value: 0, rarity: 3, iconPath: 'web3/cards/teleport' },        // 3=玩家+地块
    { kind: 9, name: '奖励卡（小）', description: '给予玩家1万金币', targetType: 1, value: 10000, rarity: 3, iconPath: 'web3/cards/bonus_s' },
    { kind: 10, name: '奖励卡（大）', description: '给予玩家10万金币', targetType: 1, value: 100000, rarity: 3, iconPath: 'web3/cards/bonus_l' },
    { kind: 11, name: '费用卡（小）', description: '扣除玩家1万金币', targetType: 1, value: 10000, rarity: 3, iconPath: 'web3/cards/fee_s' },
    { kind: 12, name: '费用卡（大）', description: '扣除玩家10万金币', targetType: 1, value: 100000, rarity: 3, iconPath: 'web3/cards/fee_l' },
    { kind: 13, name: '建造卡', description: '升级建筑一级', targetType: 4, value: 0, rarity: 3, iconPath: 'web3/cards/construction' },           // 4=建筑
    { kind: 14, name: '改建卡', description: '更换大建筑类型', targetType: 4, value: 0, rarity: 3, iconPath: 'web3/cards/renovation' },           // 4=建筑
    { kind: 15, name: '召唤卡', description: '在地块上放置指定NPC', targetType: 2, value: 0, rarity: 3, iconPath: 'web3/cards/summon' },
    { kind: 16, name: '驱逐卡', description: '移除地块上的NPC', targetType: 2, value: 0, rarity: 3, iconPath: 'web3/cards/banish' }
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

        const config = this.configs.get(kind);

        // ⚠️ 验证：确保返回的config.kind和请求的kind一致
        if (config && config.kind !== kind) {
            console.error(`[CardConfigManager] ⚠️ Config mismatch! Requested kind=${kind}, but got config.kind=${config.kind}, name=${config.name}`);
            return null;
        }

        return config || null;
    }

    static getAllConfigs(): CardConfig[] {
        if (!this.initialized) this.initialize();
        return Array.from(this.configs.values());
    }
}
