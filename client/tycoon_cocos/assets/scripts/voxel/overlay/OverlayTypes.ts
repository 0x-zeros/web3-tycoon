/**
 * Overlay系统类型定义
 *
 * 用于在block上叠加额外的视觉效果（箭头、装饰、文字等）
 *
 * @author Web3 Tycoon Team
 */

import { Texture2D, Color } from 'cc';

/**
 * 面枚举（6个面）
 */
export enum OverlayFace {
    UP = 'up',       // +Y 顶面
    DOWN = 'down',   // -Y 底面
    NORTH = 'north', // -Z
    SOUTH = 'south', // +Z
    WEST = 'west',   // -X
    EAST = 'east'    // +X
}

/**
 * Overlay配置接口
 */
export interface OverlayConfig {
    /** Overlay纹理 */
    texture: Texture2D;

    /** 要渲染的面（默认只渲染top）*/
    faces?: OverlayFace[];

    /** 颜色tint（默认白色，不影响纹理）*/
    color?: Color;

    /** 透明度（0-1，默认1.0）*/
    alpha?: number;

    /** Z-fight防护膨胀值（默认0.001）
     * 多层overlay时递增：0.001, 0.002, 0.003...
     */
    inflate?: number;

    /** 层级索引（用于多层overlay，默认0）*/
    layerIndex?: number;

    /** 使用的shader technique索引（0=opaque, 1=transparent；默认1）*/
    techniqueIndex?: number;
}
