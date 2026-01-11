/**
 * PlayerColors - 玩家颜色统一管理
 *
 * 唯一的玩家颜色定义来源，供所有UI组件和渲染系统使用
 */
import { Color } from 'cc';

// 玩家颜色定义（HEX 为唯一真实来源）
const PLAYER_COLORS_HEX = [
    '#FFC107',  // 玩家0 - 亮黄
    '#FF5252',  // 玩家1 - 亮红
    '#69F0AE',  // 玩家2 - 荧光绿
    '#E040FB',  // 玩家3 - 荧光紫
];

const DEFAULT_COLOR_HEX = '#FFFFFF';
const UNKNOWN_OWNER_COLOR_HEX = '#FFD700';  // 金色，用于异常 owner 值
const UNOWNED_COLOR_HEX = '#424242';

/**
 * HEX 颜色转 RGB 数组
 */
function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [255, 255, 255];
}

export class PlayerColors {
    /**
     * 获取玩家颜色（HEX格式）
     * @param playerIndex 玩家索引 (0-3)
     * @returns HEX颜色字符串，如 '#FFC107'
     */
    static getHex(playerIndex: number): string {
        if (playerIndex >= 0 && playerIndex < PLAYER_COLORS_HEX.length) {
            return PLAYER_COLORS_HEX[playerIndex];
        }
        return DEFAULT_COLOR_HEX;
    }

    /**
     * 获取玩家颜色（Cocos Color对象）
     * @param playerIndex 玩家索引 (0-3)
     * @returns Cocos Color对象
     */
    static getColor(playerIndex: number): Color {
        const hex = this.getHex(playerIndex);
        return new Color(...hexToRgb(hex));
    }

    /**
     * 获取建筑所有者颜色（HEX格式）
     * 支持特殊值 255 表示无主建筑
     * @param owner 所有者索引 (0-3) 或 255 表示无主
     * @returns HEX颜色字符串
     */
    static getBuildingOwnerHex(owner: number): string {
        if (owner === 255) {
            return UNOWNED_COLOR_HEX;
        }
        if (owner >= 0 && owner < PLAYER_COLORS_HEX.length) {
            return PLAYER_COLORS_HEX[owner];
        }
        return UNKNOWN_OWNER_COLOR_HEX;  // 金色标识异常值
    }

    /**
     * 获取建筑所有者颜色（Cocos Color对象）
     * @param owner 所有者索引 (0-3) 或 255 表示无主
     * @returns Cocos Color对象
     */
    static getBuildingOwnerColor(owner: number): Color {
        return new Color(...hexToRgb(this.getBuildingOwnerHex(owner)));
    }
}
