/**
 * 类型定义统一导出
 */

// 导出所有常量
export * from './constants';

// 导出游戏核心类型
export * from './game';

// 导出地图类型
export * from './map';

// 导出卡牌类型
export * from './cards';

// 导出管理类型
export * from './admin';

// 导出GameData类型（来自tycoon.move）
export interface GameData {
    /** 对象ID */
    id: string;
    /** 地图注册表 */
    map_registry: string;
    /** 卡牌注册表 */
    card_registry: string;
    /** 掉落配置 */
    drop_config: string;

    // 全局游戏数值配置
    /** 起始现金 */
    starting_cash: bigint;
    /** 升级倍率（废弃） */
    upgrade_multipliers: number[];
    /** 租金倍率（废弃） */
    toll_multipliers: number[];

    // 新数值系统配置（×100存储）
    /** 小地产租金倍率 */
    rent_multipliers: number[];
    /** 土地庙加成倍率 */
    temple_multipliers: number[];
    /** 小地产升级价格表 */
    property_upgrade_costs: bigint[];
    /** 大地产租金倍率 */
    large_property_multipliers: number[];
    /** 大地产升级价格 */
    large_property_costs: bigint[];
    /** NPC生成权重配置 */
    npc_spawn_weights: number[];
}