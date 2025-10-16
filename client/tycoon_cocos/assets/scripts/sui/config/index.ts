/**
 * Sui 配置模块入口
 * 根据环境加载相应的配置
 */

import { SuiConfig, fromEnvConfig } from './SuiConfig';
import { SuiEnvConfig } from '../../config/env.localnet';

/**
 * 当前使用的 Sui 配置
 * 可根据需要切换到不同的环境配置文件
 */
export const CURRENT_SUI_CONFIG: SuiConfig = fromEnvConfig(SuiEnvConfig);

// 导出配置接口和工具函数
export * from './SuiConfig';
