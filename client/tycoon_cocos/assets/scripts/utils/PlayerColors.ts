/**
 * PlayerColors - 玩家颜色统一管理
 *
 * 唯一的玩家颜色定义来源，供所有UI组件和渲染系统使用
 */
import { Color } from 'cc';

// 玩家颜色定义（HEX格式）
const PLAYER_COLORS_HEX = [
    '#FFC107',  // 玩家0 - 亮黄
    '#FF5252',  // 玩家1 - 亮红
    '#69F0AE',  // 玩家2 - 荧光绿
    '#E040FB',  // 玩家3 - 荧光紫
];

// 玩家颜色定义（RGB格式，预计算避免重复转换）
const PLAYER_COLORS_RGB: [number, number, number][] = [
    [255, 193, 7],    // 玩家0 - 亮黄
    [255, 82, 82],    // 玩家1 - 亮红
    [105, 240, 174],  // 玩家2 - 荧光绿
    [224, 64, 251],   // 玩家3 - 荧光紫
];

const DEFAULT_COLOR_HEX = '#FFFFFF';
const DEFAULT_COLOR_RGB: [number, number, number] = [255, 255, 255];
const UNOWNED_COLOR_HEX = '#424242';

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
        if (playerIndex >= 0 && playerIndex < PLAYER_COLORS_RGB.length) {
            const [r, g, b] = PLAYER_COLORS_RGB[playerIndex];
            return new Color(r, g, b);
        }
        return new Color(...DEFAULT_COLOR_RGB);
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
        return this.getHex(owner);
    }

    /**
     * 获取建筑所有者颜色（Cocos Color对象）
     * @param owner 所有者索引 (0-3) 或 255 表示无主
     * @returns Cocos Color对象
     */
    static getBuildingOwnerColor(owner: number): Color {
        if (owner === 255) {
            return new Color(66, 66, 66); // #424242
        }
        return this.getColor(owner);
    }
}
