/**
 * 相机配置系统
 * 
 * 定义相机各种模式的配置参数和接口
 * 为不同游戏场景提供合适的相机视角配置
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec3, _decorator } from 'cc';

const { ccclass, property } = _decorator;

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
@ccclass('IsometricConfig')
export class IsometricConfig {
    @property({ displayName: "相机距离", tooltip: "相机距离目标点的距离" })
    public distance: number = 20;

    @property({ displayName: "相机高度", tooltip: "相机高度偏移" })
    public height: number = 0;

    @property({ displayName: "俯视角度", tooltip: "俯视角度（度数）" })
    public angle: number = -45;

    @property({ displayName: "视野角度", tooltip: "相机FOV" })
    public fov: number = 45;

    @property({ displayName: "水平旋转角度", tooltip: "水平旋转角度（用于调整观察方向）" })
    public yawAngle: number = -45;

    @property({ displayName: "允许鼠标旋转", tooltip: "是否允许鼠标拖拽旋转" })
    public allowRotation: boolean = true;

    @property({ displayName: "旋转速度", tooltip: "鼠标拖拽旋转速度" })
    public rotationSpeed: number = 2.0;
}

/**
 * 俯视视角配置
 */
@ccclass('TopDownConfig')
export class TopDownConfig {
    @property({ displayName: "相机高度", tooltip: "俯视相机高度" })
    public height: number = 30;

    @property({ displayName: "视野角度", tooltip: "相机FOV" })
    public fov: number = 60;

    @property({ displayName: "允许缩放", tooltip: "是否允许滚轮缩放" })
    public allowZoom: boolean = true;

    @property({ displayName: "最小高度", tooltip: "缩放最小高度限制" })
    public minHeight: number = 15;

    @property({ displayName: "最大高度", tooltip: "缩放最大高度限制" })
    public maxHeight: number = 50;

    @property({ displayName: "缩放速度", tooltip: "滚轮缩放速度" })
    public zoomSpeed: number = 5.0;
}

/**
 * 第三人称跟随配置
 */
@ccclass('FollowConfig')
export class FollowConfig {
    @property({ displayName: "跟随距离", tooltip: "相机跟随目标的距离" })
    public distance: number = 10;

    @property({ displayName: "相机高度", tooltip: "相机高度偏移" })
    public height: number = 8;

    @property({ displayName: "平滑速度", tooltip: "平滑跟随速度" })
    public smoothSpeed: number = 5.0;

    @property({ displayName: "前瞻距离", tooltip: "相机会稍微看向目标前方的距离" })
    public lookAheadDistance: number = 3.0;

    @property({ displayName: "垂直角度偏移", tooltip: "垂直角度偏移" })
    public pitchOffset: number = -15;

    @property({ displayName: "自动调整高度", tooltip: "是否自动调整高度" })
    public autoAdjustHeight: boolean = true;

    @property({ displayName: "最小距离", tooltip: "最小跟随距离" })
    public minDistance: number = 5;

    @property({ displayName: "最大距离", tooltip: "最大跟随距离" })
    public maxDistance: number = 20;
}

/**
 * 相机边界限制配置
 */
@ccclass('CameraBounds')
export class CameraBounds {
    @property({ displayName: "最小位置", tooltip: "相机移动的最小位置限制" })
    public min: Vec3 = new Vec3(-50, 0, -50);

    @property({ displayName: "最大位置", tooltip: "相机移动的最大位置限制" })
    public max: Vec3 = new Vec3(50, 100, 50);

    @property({ displayName: "启用边界限制", tooltip: "是否启用边界限制" })
    public enabled: boolean = false;
}

/**
 * 相机过渡配置
 */
@ccclass('TransitionConfig')
export class TransitionConfig {
    @property({ displayName: "位置过渡时间", tooltip: "位置过渡持续时间（秒）" })
    public positionDuration: number = 1.0;

    @property({ displayName: "旋转过渡时间", tooltip: "旋转过渡持续时间（秒）" })
    public rotationDuration: number = 0.8;

    @property({ displayName: "缓动类型", tooltip: "缓动类型" })
    public easing: string = 'quartOut';
}

/**
 * 完整的相机配置
 */
@ccclass('CameraConfig')
export class CameraConfig {
    @property({ type: IsometricConfig, displayName: "等距视角配置", tooltip: "等距视角模式的相关参数" })
    public isometric: IsometricConfig = new IsometricConfig();

    @property({ type: TopDownConfig, displayName: "俯视视角配置", tooltip: "俯视视角模式的相关参数" })
    public topDown: TopDownConfig = new TopDownConfig();

    @property({ type: FollowConfig, displayName: "跟随模式配置", tooltip: "第三人称跟随模式的相关参数" })
    public follow: FollowConfig = new FollowConfig();

    @property({ type: CameraBounds, displayName: "边界限制配置", tooltip: "相机移动边界限制的相关参数" })
    public bounds: CameraBounds = new CameraBounds();

    @property({ type: TransitionConfig, displayName: "过渡动画配置", tooltip: "相机切换过渡动画的相关参数" })
    public transition: TransitionConfig = new TransitionConfig();

    @property({ displayName: "调试模式", tooltip: "是否启用调试模式显示" })
    public debugMode: boolean = true;
}

/**
 * 默认相机配置
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = (() => {
    const config = new CameraConfig();
    
    // 等距视角配置
    config.isometric.distance = 20;
    config.isometric.height = 0;
    config.isometric.angle = -45; // -45度俯视
    config.isometric.fov = 45;
    config.isometric.yawAngle = -45; // -45度水平旋转
    config.isometric.allowRotation = true;
    config.isometric.rotationSpeed = 2.0;
    
    // 俯视视角配置
    config.topDown.height = 30;
    config.topDown.fov = 60;
    config.topDown.allowZoom = true;
    config.topDown.minHeight = 15;
    config.topDown.maxHeight = 50;
    config.topDown.zoomSpeed = 5.0;
    
    // 跟随模式配置
    config.follow.distance = 10;
    config.follow.height = 8;
    config.follow.smoothSpeed = 5.0;
    config.follow.lookAheadDistance = 3.0;
    config.follow.pitchOffset = -15;
    config.follow.autoAdjustHeight = true;
    config.follow.minDistance = 5;
    config.follow.maxDistance = 20;
    
    // 边界配置
    config.bounds.min = new Vec3(-50, 0, -50);
    config.bounds.max = new Vec3(50, 100, 50);
    config.bounds.enabled = false;
    
    // 过渡配置
    config.transition.positionDuration = 1.0;
    config.transition.rotationDuration = 0.8;
    config.transition.easing = 'quartOut';
    
    // 调试模式
    config.debugMode = true;
    
    return config;
})();

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