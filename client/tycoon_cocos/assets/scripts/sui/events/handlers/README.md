# Event Handlers 使用说明

本目录包含了所有链上事件的处理器（Handlers），用于监听和处理Sui链上的游戏事件。

## 📁 文件结构

```
handlers/
├── BuildingDecisionHandler.ts    # 建筑购买/升级事件处理器
├── RentDecisionHandler.ts        # 租金决策事件处理器
├── DecisionSkippedHandler.ts     # 跳过决策事件处理器
├── RollAndStepHandler.ts          # 掷骰移动事件处理器（已有）
├── registerHandlers.ts            # 注册所有handlers的函数
├── index.ts                       # 统一导出
└── README.md                      # 本文档
```

## 🎯 Handler职责

### BuildingDecisionHandler
处理建筑购买/升级决策事件（`BuildingDecisionEvent`）

**功能**：
- 更新 GameSession 的 turn（使用 `event.turn + 1`）
- 扣除玩家现金
- 更新建筑数据（owner、level）
- 触发建筑渲染更新
- 显示 notification（包含自动决策标识）

### RentDecisionHandler
处理租金决策事件（`RentDecisionEvent`）

**功能**：
- 更新 GameSession 的 turn（使用 `event.turn + 1`）
- **使用免租卡**：删除玩家卡牌，触发卡牌飞出动画
- **支付现金**：更新支付者和接收者的现金
- 显示 notification（包含自动决策标识）

### DecisionSkippedHandler
处理跳过决策事件（`DecisionSkippedEvent`）

**功能**：
- 更新 GameSession 的 turn（使用 `event.turn + 1`）
- 获取关联建筑信息
- 显示 notification（说明跳过的决策类型）

## 🚀 使用方法

### 1. 在游戏初始化时注册handlers

在 SuiManager 或游戏启动代码中：

```typescript
import { createEventIndexer } from './sui/events/indexer';
import { registerEventHandlers } from './sui/events/handlers';

// 创建EventIndexer
const indexer = createEventIndexer({
    network: 'testnet',
    packageId: '0x...', // 你的package ID
    autoStart: true
});

// 注册所有handlers
registerEventHandlers(indexer);
```

### 2. 在游戏退出时清理

```typescript
import { cleanupEventHandlers } from './sui/events/handlers';

// 游戏退出时
cleanupEventHandlers();
```

### 3. 单独使用某个Handler（可选）

如果需要单独使用某个handler：

```typescript
import { BuildingDecisionHandler } from './sui/events/handlers';

const handler = BuildingDecisionHandler.getInstance();
handler.initialize();

// 手动处理事件
await handler.handleEvent(eventMetadata);
```

## 🔄 事件流程

```
链上交易
    ↓
EventIndexer 轮询查询事件
    ↓
EventIndexer 解析事件并调用注册的handler
    ↓
Handler 更新 GameSession 数据
    ↓
GameSession 触发渲染更新
    ↓
UI 显示 notification
```

## ⚡ Turn更新规则

**所有决策事件都遵循统一的turn更新规则**：

```typescript
// Move端在 advance_turn() 之前发送事件
// 事件包含的是执行前的 round/turn
// 客户端需要 +1 才能同步到执行后的状态

session.setRound(event.round);
session.setTurn(event.turn + 1);  // ← 注意这里的 +1
```

这个规则适用于：
- BuildingDecisionEvent
- RentDecisionEvent
- DecisionSkippedEvent
- RollAndStepActionEvent
- EndTurnEvent
- SkipTurnEvent

## 📝 开发注意事项

1. **事件类型定义**：所有事件类型在 `sui/events/types.ts` 中定义
2. **EventIndexer配置**：已在 `sui/events/indexer.ts` 中配置了这3个事件
3. **单例模式**：所有Handler使用单例模式，通过 `getInstance()` 获取实例
4. **错误处理**：所有Handler都有完整的try-catch错误处理
5. **日志输出**：所有关键操作都有console日志，便于调试

## 🐛 测试

测试时需要确保：
1. EventIndexer正确连接到Sui网络
2. PackageId正确配置
3. GameSession已正确初始化
4. 链上有相应的事件产生

## 📚 相关文档

- EventIndexer文档: `../indexer.ts`
- 事件类型定义: `../types.ts`
- GameSession文档: `../../../core/GameSession.ts`
- Move合约: `../../../../../../move/tycoon/sources/game.move`
