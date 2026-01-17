/**
 * 游戏核心类型定义
 * 对应Move端的game.move文件中的struct定义
 *
 * Move源文件: move/tycoon/sources/game.move
 */

import { NO_OWNER } from './constants';

/**
 * Buff条目
 * 对应Move: struct BuffEntry
 */
export interface BuffEntry {
    /** Buff类型（对应types.move的BUFF_*常量） */
    kind: number;
    /** 最后一个激活轮次（包含：当current_round <= last_active_round时有效） */
    last_active_round: number;
    /** 携带的值（如遥控骰子的点数） */
    value: bigint;
    /** 关联的NPC spawn索引（0xFFFF表示非NPC产生） */
    spawn_index: number;
}

/**
 * 玩家数据
 * 对应Move: struct Player
 */
export interface Player {
    /** 玩家地址 */
    owner: string;
    /** 当前位置（地块ID） */
    pos: number;
    /** 现金余额 */
    cash: bigint;
    /** 是否破产 */
    bankrupt: boolean;
    /** 剩余医院回合数 */
    in_hospital_turns: number;
    /** 上一步的tile_id（用于避免回头） */
    last_tile_id: number;
    /** 下一步强制目标tile（65535=无强制，用于转向卡等） */
    next_tile_id: number;
    /** 拥有的土地庙等级列表（用于租金加成计算） */
    temple_levels: number[];
    /** 活跃的Buff列表 */
    buffs: BuffEntry[];
    /** 持有的卡牌（vector<CardEntry>） */
    cards: CardEntry[];
}

/**
 * 卡牌条目（玩家持有的卡牌）
 * 对应Move: struct CardEntry
 */
export interface CardEntry {
    kind: number;
    count: number;
}

/**
 * NPC实例
 * 对应Move: struct NpcInst
 */
export interface NpcInst {
    /** NPC所在tile */
    tile_id: number;
    /** NPC类型（对应types.move的NPC_*常量） */
    kind: number;
    /** 是否可消耗（炸弹消耗，路障不消耗） */
    consumable: boolean;
    /** 生成池索引（0xFFFF表示玩家放置） */
    spawn_index: number;
}

/**
 * NPC生成条目
 * 对应Move: struct NpcSpawnEntry
 */
export interface NpcSpawnEntry {
    /** NPC类型 */
    kind: number;
    /** 生成权重 */
    weight: number;
    /** 当前数量 */
    count: number;
}

/**
 * 座位（玩家凭证）
 * 对应Move: struct Seat
 */
export interface Seat {
    /** 座位ID */
    id: string;
    /** 游戏ID */
    game_id: string;
    /** 玩家地址 */
    player: string;
    /** 玩家索引（0-based） */
    player_index: number;
}

/**
 * GMPass - GM模式权限凭证
 * 持有者可以在卡片商店购买高级卡片
 * 对应Move: struct GMPass
 */
export interface GMPass {
    /** GMPass ID */
    id: string;
    /** 绑定的游戏ID */
    game_id: string;
    /** 持有者地址 */
    player: string;
}

/**
 * 建筑数据（新的Tile/Building分离架构）
 * 对应Move: struct Building
 * 注意：这是经济实体，与地块（Tile）分离
 */
export interface Building {
    /** 所有者索引（NO_OWNER=255表示无主） */
    owner: number;
    /** 建筑等级（0-5） */
    level: number;
    /** 建筑类型（BUILDING_NONE/TEMPLE/RESEARCH等） */
    building_type: number;
}

/**
 * 地块数据（新的Tile/Property分离架构）
 * 对应Move: struct Tile
 * 注意：这是导航节点，只包含NPC信息
 */
export interface Tile {
    /** 地块上的NPC索引（65535表示无NPC，其他值为game.npc_on的index） */
    npc_on: number;
}

/**
 * 游戏实例
 * 对应Move: struct Game
 */
export interface Game {
    /** 游戏ID */
    id: string;
    /** 游戏状态（0=准备，1=进行中，2=已结束） */
    status: number;
    /** 地图模板ID */
    template_map_id: string;

    /** 玩家列表 */
    players: Player[];

    // 回合状态
    /** 当前轮次 */
    round: number;
    /** 轮内回合（0到player_count-1） */
    turn: number;
    /** 当前活跃玩家索引 */
    active_idx: number;
    /** 是否已掷骰 */
    has_rolled: boolean;

    // 游戏元素
    /** 地块列表（导航用） */
    tiles: Tile[];
    /** 建筑列表（经济实体） */
    buildings: Building[];
    /** NPC实例列表（索引存储在tiles[].npc_on） */
    npc_on: NpcInst[];

    // NPC管理
    /** NPC生成池 */
    npc_spawn_pool: NpcSpawnEntry[];

    // 配置
    /** 初始现金（游戏创建时设定，不变） */
    starting_cash: bigint;
    /** 最大回合数（0表示无限期） */
    max_rounds: number;
    /** 物价提升天数 */
    price_rise_days: number;

    // 额外状态
    /** 胜利者地址（游戏结束时） */
    winner?: string;

    // 待决策状态
    /** 待决策类型（0=无，1=买地，2=升级，3=租金决策） */
    pending_decision: number;
    /** 决策相关的地块ID */
    decision_tile: number;
    /** 决策金额 */
    decision_amount: bigint;

    /** 游戏设置位字段（bit0=GM模式） */
    settings: number;
}

/**
 * 游戏查询结果
 */
export interface GameView {
    game: Game;
    /** 当前玩家信息 */
    current_player?: Player;
    /** 是否是你的回合 */
    is_my_turn: boolean;
    /** 是否可以执行操作 */
    can_act: boolean;
}

/**
 * 玩家统计信息
 */
export interface PlayerStats {
    /** 玩家地址 */
    player: string;
    /** 现金余额 */
    cash: bigint;
    /** 拥有的地产数量 */
    property_count: number;
    /** 地产总价值 */
    property_value: bigint;
    /** 是否破产 */
    is_bankrupt: boolean;
    /** 排名 */
    rank: number;
}

/**
 * 游戏创建配置
 */
export interface GameCreateConfig {
    /** 地图模板ID */
    template_map_id: string;
    /** 最大玩家数 */
    max_players: number;
    /** 起始现金（0使用默认值） */
    starting_cash?: bigint;
    /** 物价提升天数（0使用默认值） */
    price_rise_days?: number;
    /** 最大轮数（0表示无限） */
    max_rounds?: number;
    /** 游戏设置位字段（0x01=GM模式） */
    settings?: number;
}

/**
 * 辅助函数
 */

/**
 * 判断建筑是否有主人
 */
export function hasOwner(building: Building): boolean {
    return building.owner !== NO_OWNER;
}

/**
 * 判断玩家是否在医院
 */
export function isInHospital(player: Player): boolean {
    return player.in_hospital_turns > 0;
}

/**
 * 判断玩家是否可以行动
 */
export function canAct(player: Player): boolean {
    return !player.bankrupt && !isInHospital(player);
}

/**
 * 获取玩家持有的卡牌数量
 */
export function getCardCount(player: Player, cardKind: number): number {
    return player.cards.get(cardKind) || 0;
}

/**
 * 判断玩家是否有特定的Buff
 */
export function hasBuffActive(player: Player, buffKind: number, currentTurn: bigint): boolean {
    return player.buffs.some(buff =>
        buff.kind === buffKind && currentTurn < buff.first_inactive_turn
    );
}

// ===== 游戏设置常量 =====

/** GM模式设置位 */
export const SETTING_GM_MODE = 0x01;

/**
 * 检查游戏设置中是否包含指定标志
 */
export function hasSetting(settings: number, flag: number): boolean {
    return (settings & flag) !== 0;
}

/**
 * 判断游戏是否启用了GM模式
 */
export function isGmMode(game: Game): boolean {
    return hasSetting(game.settings, SETTING_GM_MODE);
}