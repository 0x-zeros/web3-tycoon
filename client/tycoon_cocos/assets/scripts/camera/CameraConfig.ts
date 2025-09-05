/**
 * 相机配置系统
 * 
 * 定义相机各种模式的配置参数和接口
 * 为不同游戏场景提供合适的相机视角配置
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3 } from 'cc';

/**
 * 相机模式枚举
 */
export enum CameraMode {
    /** 未初始化 */
    NONE = 'none',
    /** 等距视角 - 45度俯视角，适合棋盘游戏 */
    ISOMETRIC = 'isometric',
    /** 俯视视角 - 90度垂直俯视，清晰查看整个地图 */
    TOP_DOWN = 'top_down',
    /** 第三人称跟随 - 跟随目标，动态视角 */
    THIRD_PERSON_FOLLOW = 'third_person_follow'
}

/**
 * 等距视角配置
 */
export interface IsometricConfig {
    /** 相机距离目标点的距离 */
    distance: number;
    /** 相机高度 */
    height: number;
    /** 俯视角度（度数） */
    angle: number;
    /** 视野角度 */
    fov: number;
    /** 水平旋转角度（用于调整观察方向） */
    yawAngle: number;
    /** 是否允许鼠标旋转 */
    allowRotation: boolean;
    /** 旋转速度 */
    rotationSpeed: number;
}

/**
 * 俯视视角配置
 */
export interface TopDownConfig {
    /** 相机高度 */
    height: number;
    /** 视野角度 */
    fov: number;
    /** 是否允许缩放 */
    allowZoom: boolean;
    /** 最小高度限制 */
    minHeight: number;
    /** 最大高度限制 */
    maxHeight: number;
    /** 缩放速度 */
    zoomSpeed: number;
}

/**
 * 第三人称跟随配置
 */
export interface FollowConfig {
    /** 跟随距离 */
    distance: number;
    /** 相机高度偏移 */
    height: number;
    /** 平滑跟随速度 */
    smoothSpeed: number;
    /** 前瞻距离（相机会稍微看向目标前方） */
    lookAheadDistance: number;
    /** 垂直角度偏移 */
    pitchOffset: number;
    /** 是否自动调整高度 */
    autoAdjustHeight: boolean;
    /** 最小跟随距离 */
    minDistance: number;
    /** 最大跟随距离 */
    maxDistance: number;
}

/**
 * 相机边界限制配置
 */
export interface CameraBounds {
    /** 最小位置 */
    min: Vec3;
    /** 最大位置 */
    max: Vec3;
    /** 是否启用边界限制 */
    enabled: boolean;
}

/**
 * 相机过渡配置
 */
export interface TransitionConfig {
    /** 位置过渡持续时间 */
    positionDuration: number;
    /** 旋转过渡持续时间 */
    rotationDuration: number;
    /** 缓动类型 */
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * 完整的相机配置
 */
export interface CameraConfig {
    /** 等距视角配置 */
    isometric: IsometricConfig;
    /** 俯视视角配置 */
    topDown: TopDownConfig;
    /** 第三人称跟随配置 */
    follow: FollowConfig;
    /** 边界限制配置 */
    bounds: CameraBounds;
    /** 过渡动画配置 */
    transition: TransitionConfig;
    /** 是否启用调试模式 */
    debugMode: boolean;
}

/**
 * 默认相机配置
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
    isometric: {
        distance: 20,
        height: 0,
        angle: -45, //-45度俯视 //俯仰角 X ≈ 45°（比暗黑的 26° 高，突出棋盘格）。
        fov: 45,
        yawAngle: -45, //-45度水平旋转
        allowRotation: true,
        rotationSpeed: 2.0
    },
    topDown: {
        height: 30,
        fov: 60,
        allowZoom: true,
        minHeight: 15,
        maxHeight: 50,
        zoomSpeed: 5.0
    },
    follow: {
        distance: 10,
        height: 8,
        smoothSpeed: 5.0,
        lookAheadDistance: 3.0,
        pitchOffset: -15,
        autoAdjustHeight: true,
        minDistance: 5,
        maxDistance: 20
    },
    bounds: {
        min: new Vec3(-50, 0, -50),
        max: new Vec3(50, 100, 50),
        enabled: false
    },
    transition: {
        positionDuration: 1.0,
        rotationDuration: 0.8,
        easing: 'ease-out'
    },
    debugMode: true
};

/**
 * 相机状态信息接口
 */
export interface CameraState {
    /** 当前模式 */
    currentMode: CameraMode;
    /** 当前位置 */
    position: Vec3;
    /** 当前旋转 */
    rotation: Vec3;
    /** 当前跟随目标 */
    target: Vec3 | null;
    /** 是否正在过渡中 */
    isTransitioning: boolean;
    /** 最后更新时间 */
    lastUpdateTime: number;
}