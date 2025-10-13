/**
 * Event Handlers 统一导出
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

// 导出所有Handler类
export { BuildingDecisionHandler, buildingDecisionHandler } from './BuildingDecisionHandler';
export { RentDecisionHandler, rentDecisionHandler } from './RentDecisionHandler';
export { DecisionSkippedHandler, decisionSkippedHandler } from './DecisionSkippedHandler';
export { RollAndStepHandler, rollAndStepHandler } from './RollAndStepHandler';

// 导出注册函数
export { registerEventHandlers, cleanupEventHandlers } from './registerHandlers';
