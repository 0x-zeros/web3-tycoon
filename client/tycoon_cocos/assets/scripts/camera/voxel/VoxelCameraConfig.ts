/**
 * 体素相机控制器配置
 * 
 * 定义体素世界第一人称相机的配置参数和接口
 * 适用于Minecraft风格的体素游戏相机控制
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3 } from 'cc';

/**
 * 体素相机模式枚举
 */
export enum VoxelCameraMode {
    /** 行走模式 - 有重力和碰撞检测 */
    WALKING = "walking",
    /** 飞行模式 - 自由飞行，无碰撞 */
    FLYING = "flying"
}

/**
 * 体素相机移动配置
 */
export interface VoxelCameraMovementConfig {
    /** 行走速度 */
    walkSpeed: number;
    /** 飞行速度 */
    flySpeed: number;
    /** 跳跃力度 */
    jumpForce: number;
    /** 重力加速度 */
    gravity: number;
    /** 摩擦力 */
    friction: number;
    /** 最大下落速度 */
    maxFallSpeed: number;
}

/**
 * 体素相机视角配置
 */
export interface VoxelCameraViewConfig {
    /** 鼠标灵敏度 */
    mouseSensitivity: number;
    /** 最大俯仰角度 */
    maxPitchAngle: number;
    /** 最小俯仰角度 */
    minPitchAngle: number;
    /** 视野角度 */
    fieldOfView: number;
    /** 视角平滑度 */
    viewSmoothing: number;
}

/**
 * 体素相机碰撞配置
 */
export interface VoxelCameraCollisionConfig {
    /** 启用碰撞检测 */
    enableCollision: boolean;
    /** 碰撞检测盒子大小 */
    collisionBoxSize: Vec3;
    /** 碰撞检测精度（步进数） */
    collisionSteps: number;
    /** 台阶高度（可以自动跨越的高度） */
    stepHeight: number;
    /** 墙壁滑动启用 */
    enableWallSliding: boolean;
}

/**
 * 体素相机输入配置
 */
export interface VoxelCameraInputConfig {
    /** 启用键盘输入 */
    enableKeyboardInput: boolean;
    /** 启用鼠标输入 */
    enableMouseInput: boolean;
    /** 反转Y轴 */
    invertMouseY: boolean;
    /** 模式切换按键 */
    modeToggleKey: string;
    /** 跳跃按键 */
    jumpKey: string;
    /** 冲刺按键 */
    sprintKey: string;
}

/**
 * 完整的体素相机配置
 */
export interface VoxelCameraConfig {
    /** 移动配置 */
    movement: VoxelCameraMovementConfig;
    /** 视角配置 */
    view: VoxelCameraViewConfig;
    /** 碰撞配置 */
    collision: VoxelCameraCollisionConfig;
    /** 输入配置 */
    input: VoxelCameraInputConfig;
    /** 是否启用调试模式 */
    debugMode: boolean;
}

/**
 * 默认体素相机配置
 */
export const DEFAULT_VOXEL_CAMERA_CONFIG: VoxelCameraConfig = {
    movement: {
        walkSpeed: 5.0,
        flySpeed: 20.0,
        jumpForce: 8.0,
        gravity: -20.0,
        friction: 0.9,
        maxFallSpeed: -30.0
    },
    view: {
        mouseSensitivity: 0.1,
        maxPitchAngle: 80,
        minPitchAngle: -80,
        fieldOfView: 75,
        viewSmoothing: 0.1
    },
    collision: {
        enableCollision: true,
        collisionBoxSize: new Vec3(0.8, 1.8, 0.8), // 玩家碰撞盒
        collisionSteps: 4,
        stepHeight: 0.5,
        enableWallSliding: true
    },
    input: {
        enableKeyboardInput: true,
        enableMouseInput: true,
        invertMouseY: false,
        modeToggleKey: "KeyF",
        jumpKey: "Space",
        sprintKey: "ShiftLeft"
    },
    debugMode: false
};

/**
 * 体素相机状态接口
 */
export interface VoxelCameraState {
    /** 当前模式 */
    currentMode: VoxelCameraMode;
    /** 当前位置 */
    position: Vec3;
    /** 当前速度 */
    velocity: Vec3;
    /** 是否在地面上 */
    isGrounded: boolean;
    /** 当前yaw角度 */
    yaw: number;
    /** 当前pitch角度 */
    pitch: number;
    /** 是否正在移动 */
    isMoving: boolean;
    /** 最后更新时间 */
    lastUpdateTime: number;
}

/**
 * 体素相机事件数据接口
 */
export interface VoxelCameraEventData {
    /** 事件类型 */
    type: 'mode_change' | 'position_change' | 'collision';
    /** 相机状态 */
    state: VoxelCameraState;
    /** 附加数据 */
    data?: any;
}

/**
 * 预设配置集合
 */
export const VOXEL_CAMERA_PRESETS = {
    /** 经典Minecraft风格 */
    MINECRAFT: {
        ...DEFAULT_VOXEL_CAMERA_CONFIG,
        movement: {
            walkSpeed: 4.3,
            flySpeed: 15.0,
            jumpForce: 7.5,
            gravity: -18.0,
            friction: 0.91,
            maxFallSpeed: -28.0
        }
    },
    
    /** 快速移动模式 */
    FAST: {
        ...DEFAULT_VOXEL_CAMERA_CONFIG,
        movement: {
            walkSpeed: 8.0,
            flySpeed: 30.0,
            jumpForce: 10.0,
            gravity: -15.0,
            friction: 0.95,
            maxFallSpeed: -35.0
        }
    },
    
    /** 精确控制模式 */
    PRECISE: {
        ...DEFAULT_VOXEL_CAMERA_CONFIG,
        movement: {
            walkSpeed: 2.0,
            flySpeed: 8.0,
            jumpForce: 6.0,
            gravity: -22.0,
            friction: 0.8,
            maxFallSpeed: -25.0
        },
        view: {
            mouseSensitivity: 0.05,
            maxPitchAngle: 90,
            minPitchAngle: -90,
            fieldOfView: 70,
            viewSmoothing: 0.2
        }
    }
};