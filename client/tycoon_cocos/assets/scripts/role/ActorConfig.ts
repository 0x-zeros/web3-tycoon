/**
 * ActorConfig - PaperActor配置系统
 *
 * 统一管理所有Actor的配置信息，包括：
 * - NPC配置
 * - 建筑配置
 * - 纹理路径
 * - 动画能力
 * - 默认属性
 */

import { Vec2 } from 'cc';
import { ActorType } from './PaperActor';

/**
 * Actor配置接口
 */
export interface ActorConfig {
    id: string;                    // 唯一标识，如 'web3:land_god'
    type: ActorType;               // Actor类型
    name: string;                  // 显示名称

    // 纹理配置
    textures: {
        default?: string;          // 默认纹理路径
        levels?: string[];         // 建筑的不同等级纹理
        animations?: {             // 动画帧纹理
            idle?: string[];
            walk?: string[];
            jump?: string[];
            attack?: string[];
        };
    };

    // 尺寸配置
    size: {
        width: number;             // 宽度
        height: number;            // 高度
        scale?: number;            // 缩放比例
    };

    // 动画能力配置
    animations: {
        canJump?: boolean;         // 能否跳跃
        canSay?: boolean;          // 能否说话
        canMove?: boolean;         // 能否移动
        canUpgrade?: boolean;      // 能否升级（建筑专用）
        canFloat?: boolean;        // 能否漂浮（道具专用）
        canShake?: boolean;        // 能否震动
    };

    // 其他配置
    billboardMode?: 'full' | 'yAxis' | 'off';  // Billboard模式
    defaultLevel?: number;         // 默认等级
}

/**
 * NPC配置
 */
const NPC_CONFIGS: ActorConfig[] = [
    // 土地神
    {
        id: 'web3:land_god',
        type: ActorType.NPC,
        name: '土地神',
        textures: {
            default: 'web3/actors/land_god',
            animations: {
                idle: ['land_god_idle_1', 'land_god_idle_2'],
                walk: ['land_god_walk_1', 'land_god_walk_2'],
            }
        },
        size: { width: 1, height: 1.5, scale: 1 },
        animations: {
            canJump: true,
            canSay: true,
            canMove: true,
            canShake: true
        },
        billboardMode: 'yAxis'
    },

    // 财神
    {
        id: 'web3:wealth_god',
        type: ActorType.NPC,
        name: '财神',
        textures: {
            default: 'web3/actors/wealth_god',
            animations: {
                idle: ['wealth_god_idle_1', 'wealth_god_idle_2'],
            }
        },
        size: { width: 1, height: 1.5, scale: 1 },
        animations: {
            canJump: true,
            canSay: true,
            canMove: true,
            canShake: true
        },
        billboardMode: 'yAxis'
    },

    // 福神
    {
        id: 'web3:fortune_god',
        type: ActorType.NPC,
        name: '福神',
        textures: {
            default: 'web3/actors/fortune_god',
            animations: {
                idle: ['fortune_god_idle_1', 'fortune_god_idle_2'],
            }
        },
        size: { width: 1, height: 1.5, scale: 1 },
        animations: {
            canJump: true,
            canSay: true,
            canMove: true,
            canShake: true
        },
        billboardMode: 'yAxis'
    },

    // 狗狗
    {
        id: 'web3:dog',
        type: ActorType.NPC,
        name: '狗狗',
        textures: {
            default: 'web3/actors/dog',
            animations: {
                idle: ['dog_idle_1', 'dog_idle_2'],
                walk: ['dog_walk_1', 'dog_walk_2', 'dog_walk_3', 'dog_walk_4'],
            }
        },
        size: { width: 0.8, height: 0.6, scale: 0.8 },
        animations: {
            canJump: true,
            canSay: false,  // 狗不说话，但可以叫
            canMove: true,
            canShake: true
        },
        billboardMode: 'yAxis'
    },

    // 穷神
    {
        id: 'web3:poverty_god',
        type: ActorType.NPC,
        name: '穷神',
        textures: {
            default: 'web3/actors/poverty_god',
            animations: {
                idle: ['poverty_god_idle_1', 'poverty_god_idle_2'],
            }
        },
        size: { width: 1, height: 1.5, scale: 1 },
        animations: {
            canJump: false,
            canSay: true,
            canMove: true,
            canShake: true
        },
        billboardMode: 'yAxis'
    },

    // 路障
    {
        id: 'web3:roadblock',
        type: ActorType.OBJECT,
        name: '路障',
        textures: {
            default: 'web3/actors/roadblock',
        },
        size: { width: 1, height: 0.5, scale: 1 },
        animations: {
            canJump: false,
            canSay: false,
            canMove: false,
            canShake: true
        },
        billboardMode: 'off'  // 路障不需要billboard
    },

    // 炸弹
    {
        id: 'web3:bomb',
        type: ActorType.OBJECT,
        name: '炸弹',
        textures: {
            default: 'web3/actors/bomb',
        },
        size: { width: 0.6, height: 0.6, scale: 1 },
        animations: {
            canJump: false,
            canSay: false,
            canMove: false,
            canShake: true,
            canFloat: true  // 炸弹可以漂浮
        },
        billboardMode: 'yAxis'
    }
];

/**
 * 建筑配置
 */
const BUILDING_CONFIGS: ActorConfig[] = [
    // 小型地产（1x1）
    {
        id: 'web3:property_small',
        type: ActorType.BUILDING,
        name: '小型地产',
        textures: {
            levels: [
                'web3/buildings/lv0',  // 空地
                'web3/buildings/property_small_lv1',  // 1级小屋
                'web3/buildings/property_small_lv2',  // 2级房屋
                'web3/buildings/property_small_lv3',  // 3级商铺
                'web3/buildings/property_small_lv4',  // 4级大楼
                'web3/buildings/property_small_lv5',  // 5级大楼
            ]
        },
        size: { width: 1, height: 1, scale: 1 },
        animations: {
            canUpgrade: true,
            canShake: true
        },
        billboardMode: 'off',
        defaultLevel: 0
    },

    // 土地庙（2x2）
    {
        id: 'web3:temple',
        type: ActorType.BUILDING,
        name: '土地庙',
        textures: {
            levels: [
                'web3/buildings/lv0',
                'web3/buildings/temple_lv1',
                'web3/buildings/temple_lv2',
                'web3/buildings/temple_lv3',
                'web3/buildings/temple_lv4',
                'web3/buildings/temple_lv5',
            ]
        },
        size: { width: 2, height: 2, scale: 2 },
        animations: {
            canUpgrade: true,
            canShake: true
        },
        billboardMode: 'off',
        defaultLevel: 0
    },

    // 研究所（2x2）
    {
        id: 'web3:research',
        type: ActorType.BUILDING,
        name: '研究所',
        textures: {
            levels: [
                'web3/buildings/lv0',
                'web3/buildings/research_lv1',
                'web3/buildings/research_lv2',
                'web3/buildings/research_lv3',
                'web3/buildings/research_lv4',
                'web3/buildings/research_lv5',
            ]
        },
        size: { width: 2, height: 2, scale: 2 },
        animations: {
            canUpgrade: true,
            canShake: true
        },
        billboardMode: 'off',
        defaultLevel: 0
    },

    // 石油公司（2x2）
    {
        id: 'web3:oil_company',
        type: ActorType.BUILDING,
        name: '石油公司',
        textures: {
            levels: [
                'web3/buildings/lv0',
                'web3/buildings/oil_company_lv1',
                'web3/buildings/oil_company_lv2',
                'web3/buildings/oil_company_lv3',
                'web3/buildings/oil_company_lv4',
                'web3/buildings/oil_company_lv5',
            ]
        },
        size: { width: 2, height: 2, scale: 2 },
        animations: {
            canUpgrade: true,
            canShake: true
        },
        billboardMode: 'off',
        defaultLevel: 0
    },

    // 商业中心（2x2）
    {
        id: 'web3:commercial',
        type: ActorType.BUILDING,
        name: '商业中心',
        textures: {
            levels: [
                'web3/buildings/lv0',
                'web3/buildings/commercial_lv1',
                'web3/buildings/commercial_lv2',
                'web3/buildings/commercial_lv3',
                'web3/buildings/commercial_lv4',
                'web3/buildings/commercial_lv5',
            ]
        },
        size: { width: 2, height: 2, scale: 2 },
        animations: {
            canUpgrade: true,
            canShake: true
        },
        billboardMode: 'off',
        defaultLevel: 0
    },

    // 大饭店（2x2）
    {
        id: 'web3:hotel',
        type: ActorType.BUILDING,
        name: '大饭店',
        textures: {
            levels: [
                'web3/buildings/lv0',
                'web3/buildings/hotel_lv1',
                'web3/buildings/hotel_lv2',
                'web3/buildings/hotel_lv3',
                'web3/buildings/hotel_lv4',
                'web3/buildings/hotel_lv5',
            ]
        },
        size: { width: 2, height: 2, scale: 2 },
        animations: {
            canUpgrade: true,
            canShake: true
        },
        billboardMode: 'off',
        defaultLevel: 0
    }
];

/**
 * 配置管理器
 */
export class ActorConfigManager {
    private static configs: Map<string, ActorConfig> = new Map();
    private static initialized: boolean = false;

    /**
     * 初始化配置
     */
    public static initialize() {
        if (this.initialized) return;

        // 加载所有配置
        [...NPC_CONFIGS, ...BUILDING_CONFIGS].forEach(config => {
            this.configs.set(config.id, config);
        });

        this.initialized = true;
        console.log(`[ActorConfigManager] Loaded ${this.configs.size} actor configs`);
    }

    /**
     * 获取配置
     */
    public static getConfig(actorId: string): ActorConfig | null {
        if (!this.initialized) {
            this.initialize();
        }

        return this.configs.get(actorId) || null;
    }

    /**
     * 获取所有NPC配置
     */
    public static getNPCConfigs(): ActorConfig[] {
        if (!this.initialized) {
            this.initialize();
        }

        return Array.from(this.configs.values()).filter(c => c.type === ActorType.NPC);
    }

    /**
     * 获取所有建筑配置
     */
    public static getBuildingConfigs(): ActorConfig[] {
        if (!this.initialized) {
            this.initialize();
        }

        return Array.from(this.configs.values()).filter(c => c.type === ActorType.BUILDING);
    }

    /**
     * 获取所有物体配置（包括装饰）
     */
    public static getObjectConfigs(): ActorConfig[] {
        if (!this.initialized) {
            this.initialize();
        }

        return Array.from(this.configs.values()).filter(c => c.type === ActorType.OBJECT);
    }

    /**
     * 检查是否是建筑类型
     */
    public static isBuilding(actorId: string): boolean {
        const config = this.getConfig(actorId);
        return config ? config.type === ActorType.BUILDING : false;
    }

    /**
     * 检查是否是NPC类型
     */
    public static isNPC(actorId: string): boolean {
        const config = this.getConfig(actorId);
        return config ? config.type === ActorType.NPC : false;
    }

    /**
     * 获取建筑的最大等级
     */
    public static getMaxLevel(actorId: string): number {
        const config = this.getConfig(actorId);
        if (config && config.textures.levels) {
            return config.textures.levels.length - 1;
        }
        return 0;
    }
}