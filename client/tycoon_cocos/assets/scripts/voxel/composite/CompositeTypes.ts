/**
 * CompositeVoxelActor 类型定义
 *
 * 组合式体素 Actor 系统的核心类型
 * 通过组合多个 block + overlay + transform 来表现复杂对象
 *
 * @author Web3 Tycoon Team
 */

import { Vec3 } from 'cc';
import { OverlayConfig } from '../overlay/OverlayTypes';

/**
 * Block 组件配置
 * 定义单个 block 的渲染参数
 */
export interface BlockComponent {
    /** Block ID（如 "web3:hospital", "web3:chance" 等） */
    blockId: string;

    /** 相对位置（相对于根节点，默认 0,0,0） */
    position?: Vec3;

    /** 缩放（默认 1,1,1） */
    scale?: Vec3;

    /** 旋转（欧拉角，单位：度，默认 0,0,0） */
    rotation?: Vec3;

    /** Overlay 配置列表（可选，用于添加贴花、图标等） */
    overlays?: OverlayConfig[];

    /** 是否可见（默认 true） */
    visible?: boolean;
}

/**
 * 组合配置
 * 定义整个组合体的结构
 */
export interface CompositeConfig {
    /** Block 组件列表（至少1个） */
    components: BlockComponent[];

    /** 整体基础缩放（可选，应用到根节点） */
    baseScale?: Vec3;

    /** 整体基础旋转（可选，应用到根节点） */
    baseRotation?: Vec3;

    /** 整体基础位置偏移（可选，应用到根节点） */
    basePosition?: Vec3;
}

/**
 * 渲染结果
 */
export interface RenderResult {
    /** 是否成功 */
    success: boolean;

    /** 渲染的 block 节点数量 */
    blockCount: number;

    /** 错误信息（如果失败） */
    error?: string;
}
