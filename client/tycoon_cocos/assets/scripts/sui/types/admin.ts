/**
 * 管理相关类型定义
 * 对应Move端的admin.move文件中的struct定义
 *
 * Move源文件: move/tycoon/sources/admin.move
 */

/**
 * 管理员权限凭证
 * 对应Move: struct AdminCap
 */
export interface AdminCap {
    /** 对象ID */
    id: string;
}

/**
 * 地图模板发布事件
 * 对应Move: struct MapTemplatePublishedEvent
 */
export interface MapTemplatePublishedEvent {
    /** 模板ID */
    template_id: string;
    /** 发布者 */
    publisher: string;
    /** 地块数量 */
    tile_count: number;
    /** 建筑数量 */
    building_count: number;
}

/**
 * 注册表创建事件
 * 对应Move: struct RegistryCreatedEvent
 */
export interface RegistryCreatedEvent {
    /** 注册表ID */
    registry_id: string;
}

/**
 * 管理操作结果
 */
export interface AdminOperationResult {
    /** 是否成功 */
    success: boolean;
    /** 操作类型 */
    operation: string;
    /** 结果消息 */
    message: string;
    /** 额外数据 */
    data?: any;
}

/**
 * 管理权限检查
 */
export interface AdminPermission {
    /** 是否有权限 */
    hasPermission: boolean;
    /** 权限类型 */
    permissionType: 'owner' | 'admin' | 'none';
    /** 权限对象 */
    adminCap?: AdminCap;
}