/**
 * DirectionUtils - 方向计算工具
 *
 * 提供玩家和物体的方向计算功能，基于 tile 位置动态计算朝向
 *
 * @author Web3 Tycoon Team
 */

import { Vec3 } from 'cc';
import { INVALID_TILE_ID } from '../sui/types/constants';

/**
 * 根据两个位置计算方向（0-3）
 * @param from 起点位置
 * @param to 终点位置
 * @returns 方向值：0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
 */
export function calculateDirection(from: Vec3, to: Vec3): number {
    const dx = to.x - from.x;
    const dz = to.z - from.z;

    // 计算角度（atan2返回-π到π）
    // 使用atan2(dx, dz)，其中dx对应偏移量（东西向），dz对应前进量（南北向）
    const angle = Math.atan2(dx, dz);

    // 将角度转换为度数（0-360）
    let degrees = (angle * 180 / Math.PI);
    if (degrees < 0) degrees += 360;

    // 映射到4个方向
    // atan2(dx, dz):
    //   0° → +z方向（南） → direction 0
    //   90° → +x方向（东） → direction 1
    //   180° → -z方向（北） → direction 2
    //   270° → -x方向（西） → direction 3
    //
    // 四舍五入到最近的90度倍数
    const direction = Math.round(degrees / 90) % 4;

    return direction;
}

/**
 * 计算玩家的移动方向
 * @param pos 当前位置（tile ID）
 * @param lastTileId 上一个 tile ID
 * @param nextTileId 下一个 tile ID（优先）
 * @param getTileWorldCenter 获取 tile 世界坐标的函数
 * @returns 方向值（0-3），如果无法计算则返回 null
 */
export function calculatePlayerDirection(
    pos: number,
    lastTileId: number,
    nextTileId: number,
    getTileWorldCenter: (tileId: number) => Vec3 | null
): number | null {
    let fromTileId: number;
    let toTileId: number;

    // 优先使用 next_tile_id（强制移动目标）
    if (nextTileId !== INVALID_TILE_ID) {
        // 有强制目标，从当前tile朝向next_tile
        fromTileId = pos;
        toTileId = nextTileId;
    } else if (lastTileId !== INVALID_TILE_ID) {
        // 没有强制目标，从last_tile朝向当前tile
        fromTileId = lastTileId;
        toTileId = pos;
    } else {
        // 两者都无效，无法计算方向
        return null;
    }

    // 获取两个 tile 的世界坐标
    const fromPos = getTileWorldCenter(fromTileId);
    const toPos = getTileWorldCenter(toTileId);

    if (!fromPos || !toPos) {
        // 无法获取坐标，返回 null
        return null;
    }

    // 计算方向
    return calculateDirection(fromPos, toPos);
}

/**
 * 方向值转换为显示文本
 * @param direction 方向值（0-3），或 null
 * @returns 格式化的文本（如 "e →"），无效值返回 "?"
 */
export function formatDirection(direction: number | null): string {
    if (direction === null || direction === undefined) {
        return '?';
    }

    // 方向映射：0=南(+z), 1=东(+x), 2=北(-z), 3=西(-x)
    const directionMap = [
        's ↓',  // 0: 南
        'e →',  // 1: 东
        'n ↑',  // 2: 北
        'w ←'   // 3: 西
    ];

    return directionMap[direction] || '?';
}
