/**
 * 行走偏好系统 - 核心类型定义
 *
 * 定义玩家在地图上移动时的路径选择策略
 * 用于掷骰子时计算行走路径
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

/**
 * 行走偏好枚举
 */
export enum WalkingPreference {
    /**
     * Rotor-Router（探索模式）
     * 描述：自动依次换出口，久而久之能走遍整个地图
     * - 每个路口记得上次走的方向，下次会换一个出口
     * - 可保证所有格子最终都能到达，不会卡死
     * - 表现稳定，适合"掷骰即走"的主流程
     */
    ROTOR_ROUTER = 'rotor_router',

    /**
     * Right-hand Rule（右手法则）
     * 描述：遇到分叉总是先向右拐，一路贴墙前进
     * - 在每个岔路口优先右转，再直行，再左转
     * - 路线有规律、偏向固定环路，感觉更像"有性格的棋子"
     * - 简单直观，适合喜欢确定路径的玩家
     */
    RIGHT_HAND_RULE = 'right_hand_rule'
}

/**
 * 方向枚举（对应 MapTemplate 的 w/n/e/s）
 *
 * Cocos 左手坐标系：
 * - X轴：右为正（East）
 * - Z轴：前为正（South）
 *
 * 地图四方向：
 * - West (W): x-1 方向
 * - North (N): z-1 方向
 * - East (E): x+1 方向
 * - South (S): z+1 方向
 */
export enum Direction {
    WEST = 0,
    NORTH = 1,
    EAST = 2,
    SOUTH = 3
}

/**
 * 方向名称映射
 */
export const DirectionNames: Record<Direction, string> = {
    [Direction.WEST]: 'W',
    [Direction.NORTH]: 'N',
    [Direction.EAST]: 'E',
    [Direction.SOUTH]: 'S'
};

/**
 * 方向的反方向
 */
export const OppositeDirection: Record<Direction, Direction> = {
    [Direction.WEST]: Direction.EAST,
    [Direction.NORTH]: Direction.SOUTH,
    [Direction.EAST]: Direction.WEST,
    [Direction.SOUTH]: Direction.NORTH
};

/**
 * 顺时针下一个方向（用于 Rotor-Router）
 */
export const NextDirectionCW: Record<Direction, Direction> = {
    [Direction.WEST]: Direction.NORTH,
    [Direction.NORTH]: Direction.EAST,
    [Direction.EAST]: Direction.SOUTH,
    [Direction.SOUTH]: Direction.WEST
};

/**
 * 右转方向映射（用于 Right-hand Rule）
 * 当前前进方向 → 右转后的方向
 */
export const RightTurnDirection: Record<Direction, Direction> = {
    [Direction.WEST]: Direction.NORTH,   // 向西走，右转后向北
    [Direction.NORTH]: Direction.EAST,   // 向北走，右转后向东
    [Direction.EAST]: Direction.SOUTH,   // 向东走，右转后向南
    [Direction.SOUTH]: Direction.WEST    // 向南走，右转后向西
};

/**
 * 左转方向映射（用于 Right-hand Rule）
 */
export const LeftTurnDirection: Record<Direction, Direction> = {
    [Direction.WEST]: Direction.SOUTH,
    [Direction.NORTH]: Direction.WEST,
    [Direction.EAST]: Direction.NORTH,
    [Direction.SOUTH]: Direction.EAST
};

/**
 * Rotor-Router 历史记录接口
 * 记录每个路口上次选择的出口方向
 */
export interface RotorRouterHistory {
    /** tile_id → 上次选择的方向 */
    lastDirection: Map<number, Direction>;
}

/**
 * 创建空的 Rotor-Router 历史记录
 */
export function createRotorRouterHistory(): RotorRouterHistory {
    return {
        lastDirection: new Map()
    };
}

/**
 * 路径计算结果接口
 */
export interface PathResult {
    /** 完整路径（tile_id 数组） */
    path: number[];
    /** 是否成功计算完整路径 */
    success: boolean;
    /** 实际步数（可能小于请求的步数，如果遇到死胡同） */
    actualSteps: number;
    /** 错误信息（如果失败） */
    error?: string;
}

/**
 * 无效的 tile_id（对应 Move 端的 INVALID_TILE_ID）
 */
export const INVALID_TILE_ID = 65535;

/**
 * 路径计算配置
 */
export interface PathCalculationConfig {
    /** 起始 tile */
    startTile: number;
    /** 需要走的步数 */
    steps: number;
    /** 行走偏好 */
    preference: WalkingPreference;
    /** 上一步的 tile_id（避免第一步回头，65535 表示无限制） */
    lastTile?: number;
    /** 下一步强制目标 tile（65535 表示无强制，用于转向卡等） */
    nextTileId?: number;
    /** Rotor-Router 历史记录（可选，用于保持状态） */
    rotorHistory?: RotorRouterHistory;
}
