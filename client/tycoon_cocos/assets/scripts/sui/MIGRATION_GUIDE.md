# Tycoon事件系统迁移指南

## 概述

新的Tycoon事件系统完全对齐Move端的聚合事件模式，替代了之前的细粒度事件系统。

## 主要变化

### 1. 事件结构变化

**之前：** 30+个独立事件（PropertyPurchased, RentPaid等）
**现在：** 2个核心聚合事件 + 8个基础事件

#### 核心聚合事件：
- `RollAndStepActionEvent` - 包含完整的移动序列和所有副作用
- `UseCardActionEvent` - 包含卡牌使用的所有效果

#### 基础事件：
- `GameCreatedEvent` - 游戏创建
- `PlayerJoinedEvent` - 玩家加入
- `GameStartedEvent` - 游戏开始
- `GameEndedEvent` - 游戏结束
- `TurnStartEvent` - 回合开始
- `EndTurnEvent` - 回合结束
- `SkipTurnEvent` - 跳过回合
- `BankruptEvent` - 玩家破产

### 2. 数据类型变化

- 使用 `bigint` 替代 `number` 处理u64类型
- 使用 `undefined` 表示Move的Option类型
- 嵌套结构完整保留Move端的层次关系

## 快速开始

### 1. 初始化事件系统

```typescript
import { tycoonEventIndexer, tycoonEventProcessor } from './sui';

// 初始化索引器
tycoonEventIndexer.initialize({
    packageId: '0x...', // 你的包ID
    network: 'testnet',
    debug: true
});

// 配置处理器
tycoonEventProcessor.configure({
    enableAnimations: true,
    animationSpeed: 1.0
});

// 开始索引
await tycoonEventIndexer.startIndexing();
```

### 2. 监听事件

```typescript
import { EventBus } from '../events/EventBus';
import { TycoonEventType } from './sui';

// 监听所有事件
EventBus.on('tycoon:event', (event) => {
    console.log('收到事件:', event.type, event.data);
});

// 监听特定事件
EventBus.on(`tycoon:event:${TycoonEventType.RollAndStepAction}`, (event) => {
    // 处理移动事件
    handleMovement(event);
});
```

### 3. 处理聚合事件

```typescript
function handleMovement(event: RollAndStepActionEvent) {
    // 遍历每个步骤
    for (const step of event.steps) {
        // 处理移动
        movePlayer(step.from_tile, step.to_tile);

        // 处理停留效果
        if (step.stop_effect) {
            switch (step.stop_effect.stop_type) {
                case STOP_TYPE.PROPERTY_TOLL:
                    // 支付租金
                    payRent(step.stop_effect.amount);
                    break;
                case STOP_TYPE.PROPERTY_UNOWNED:
                    // 显示购买选项
                    showBuyOption(step.stop_effect.tile_id);
                    break;
            }
        }

        // 处理NPC交互
        if (step.npc_event) {
            handleNpcInteraction(step.npc_event);
        }
    }

    // 处理现金变动
    for (const cashChange of event.cash_changes) {
        updatePlayerCash(cashChange);
    }
}
```

## 迁移步骤

### 1. 更新导入

```typescript
// 旧代码
import { PropertyPurchasedEvent, RentPaidEvent } from './SuiEventTypes';

// 新代码
import {
    RollAndStepActionEvent,
    StopEffect,
    STOP_TYPE
} from './sui';
```

### 2. 更新事件处理逻辑

```typescript
// 旧代码 - 监听多个独立事件
EventBus.on('PropertyPurchased', onPropertyPurchased);
EventBus.on('RentPaid', onRentPaid);
EventBus.on('PlayerMoved', onPlayerMoved);

// 新代码 - 从聚合事件中提取信息
EventBus.on('tycoon:event:RollAndStepActionEvent', (event) => {
    // 所有信息都在一个事件中
    for (const step of event.steps) {
        if (step.stop_effect?.stop_type === STOP_TYPE.PROPERTY_TOLL) {
            // 这里包含了原来RentPaid事件的信息
            const rentAmount = step.stop_effect.amount;
            const owner = step.stop_effect.owner;
        }
    }
});
```

### 3. 使用常量替代硬编码值

```typescript
// 旧代码
if (tileType === 1) { // 地产
    // ...
}

// 新代码
import { TILE_KIND } from './sui/TycoonEventConstants';

if (tileType === TILE_KIND.PROPERTY) {
    // ...
}
```

## 关键概念

### StepEffect（步骤效果）

每个移动步骤包含：
- `from_tile` / `to_tile` - 起止位置
- `pass_draws` - 经过时抽取的卡牌
- `npc_event` - NPC交互（可选）
- `stop_effect` - 停留效果（可选）

### StopEffect（停留效果）

停留在地块上的效果：
- `stop_type` - 停留类型（租金、医院、监狱等）
- `amount` - 相关金额
- `owner` - 地块所有者（可选）
- `card_gains` - 获得的卡牌

### CashDelta（现金变动）

每次现金变动包含：
- `player` - 玩家地址
- `is_debit` - 是否支出
- `amount` - 金额
- `reason` - 原因（租金、购买、奖金等）

## 调试技巧

1. **启用调试日志**
```typescript
tycoonEventIndexer.initialize({ debug: true });
tycoonEventProcessor.configure({ debug: true });
```

2. **查看事件统计**
```typescript
const stats = tycoonEventIndexer.getEventStats();
console.log('事件统计:', stats);
```

3. **模拟事件**
参考 `TycoonEventExample.ts` 中的 `simulateMovementEvent()` 方法

## 常见问题

### Q: 如何处理bigint类型？
A: 显示时使用 `.toString()`，计算时直接使用bigint运算符

### Q: Option类型如何处理？
A: 检查是否为 `undefined`
```typescript
if (event.winner !== undefined) {
    // 有获胜者
}
```

### Q: 如何从聚合事件中提取特定信息？
A: 使用事件处理器的辅助方法或遍历事件数据结构

## 完整示例

参考 `TycoonEventExample.ts` 获取完整的集成示例。

## 支持

如有问题，请查看：
- Move端事件定义：`move/tycoon/sources/events.move`
- TypeScript类型定义：`TycoonEventTypes.ts`
- 常量定义：`TycoonEventConstants.ts`