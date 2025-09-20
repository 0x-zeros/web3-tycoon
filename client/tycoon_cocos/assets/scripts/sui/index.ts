/**
 * Sui Tycoon事件系统导出
 * 统一导出所有Tycoon相关的事件模块
 */

// 类型定义
export * from './TycoonEventTypes';
export * from './TycoonEventConstants';

// 核心功能
export { tycoonEventIndexer, TycoonEventIndexer } from './TycoonEventIndexer';
export { tycoonEventProcessor, TycoonEventProcessor, GameEffectType } from './TycoonEventProcessor';

// 基础索引器（如需要直接使用）
export { suiEventIndexer, SuiEventIndexer } from './SuiEventIndexer';
export { SuiEventCursor } from './SuiEventCursor';

// 示例组件
export { TycoonEventExample } from './TycoonEventExample';

// 旧的事件类型（保持兼容，后续可以移除）
export * from './SuiEventTypes';
export { SuiEventIndexerExample } from './SuiEventIndexerExample';