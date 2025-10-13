/**
 * 注册所有Event Handlers到EventIndexer
 *
 * 在游戏初始化时调用此函数，将所有handler注册到indexer
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import type { TycoonEventIndexer } from '../indexer';
import { EventType } from '../types';
import { BuildingDecisionHandler } from './BuildingDecisionHandler';
import { RentDecisionHandler } from './RentDecisionHandler';
import { DecisionSkippedHandler } from './DecisionSkippedHandler';
import { RollAndStepHandler } from './RollAndStepHandler';

/**
 * 注册所有Event Handlers
 *
 * @param indexer EventIndexer实例
 */
export function registerEventHandlers(indexer: TycoonEventIndexer): void {
    console.log('[registerHandlers] 开始注册Event Handlers');

    // 1. 初始化所有handlers
    const buildingDecisionHandler = BuildingDecisionHandler.getInstance();
    const rentDecisionHandler = RentDecisionHandler.getInstance();
    const decisionSkippedHandler = DecisionSkippedHandler.getInstance();
    const rollAndStepHandler = RollAndStepHandler.getInstance();

    buildingDecisionHandler.initialize();
    rentDecisionHandler.initialize();
    decisionSkippedHandler.initialize();
    rollAndStepHandler.initialize();

    // 2. 注册决策事件handlers到indexer
    indexer.on(EventType.BUILDING_DECISION, (metadata) => {
        buildingDecisionHandler.handleEvent(metadata);
    });

    indexer.on(EventType.RENT_DECISION, (metadata) => {
        rentDecisionHandler.handleEvent(metadata);
    });

    indexer.on(EventType.DECISION_SKIPPED, (metadata) => {
        decisionSkippedHandler.handleEvent(metadata);
    });

    // 3. 注册RollAndStep事件handler
    indexer.on(EventType.ROLL_AND_STEP_ACTION, (metadata) => {
        rollAndStepHandler.handleEvent(metadata);
    });

    console.log('[registerHandlers] Event Handlers 注册完成', {
        handlers: [
            'BuildingDecisionHandler',
            'RentDecisionHandler',
            'DecisionSkippedHandler',
            'RollAndStepHandler'
        ]
    });
}

/**
 * 清理所有Event Handlers
 */
export function cleanupEventHandlers(): void {
    console.log('[registerHandlers] 清理Event Handlers');

    BuildingDecisionHandler.getInstance().destroy();
    RentDecisionHandler.getInstance().destroy();
    DecisionSkippedHandler.getInstance().destroy();
    RollAndStepHandler.getInstance().destroy();

    console.log('[registerHandlers] Event Handlers 已清理');
}
