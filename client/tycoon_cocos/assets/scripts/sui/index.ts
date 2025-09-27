/**
 * Sui集成模块统一导出
 *
 * 这是重构后的主入口文件，提供了完整的Sui区块链集成功能
 */

// ===== 导出类型定义 =====
export * from './types';

// ===== 导出事件系统 =====
export * from './events';

// ===== 导出交互功能 =====
export * from './interactions';

// ===== 导出路径查找 =====
export { MapGraph } from './pathfinding/MapGraph';
export { BFSPathfinder } from './pathfinding/BFSPathfinder';
export { PathChoiceGenerator, PathChoiceResult } from './pathfinding/PathChoiceGenerator';

// ===== 配置类型 =====
export interface TycoonConfig {
    /** 网络类型 */
    network: 'testnet' | 'mainnet' | 'devnet' | string;
    /** 包ID */
    packageId: string;
    /** GameData共享对象ID */
    gameDataId: string;
    /** WebSocket URL（可选，用于事件监听） */
    wsUrl?: string;
}

// ===== 快速开始函数 =====

import { TycoonGameClient } from './interactions';

/**
 * 创建游戏客户端
 * @param config 配置选项
 * @returns 游戏客户端实例
 */
export function createTycoonClient(config: TycoonConfig): TycoonGameClient {
    return TycoonGameClient.create({
        network: config.network,
        packageId: config.packageId,
        gameDataId: config.gameDataId
    });
}

/**
 * 默认配置（测试网）
 */
export const DEFAULT_CONFIG: TycoonConfig = {
    network: 'testnet',
    packageId: '0x0', // 需要替换为实际的包ID
    gameDataId: '0x0', // 需要替换为实际的GameData ID
};

// ===== 版本信息 =====
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();