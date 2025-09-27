/**
 * 事件模块统一导出
 */

// 导出事件类型
export * from './types';
export * from './aggregated';

// 导出事件处理
export {
    TycoonEventIndexer,
    createEventIndexer,
    type IndexerConfig,
    type EventCallback
} from './indexer';

export {
    TycoonEventProcessor,
    eventProcessor,
    GameEffectType,
    type GameEffect,
    type GameStateChange
} from './processor';

export {
    SuiEventCursor,
    createEventCursor,
    type EventCursor
} from './cursor';