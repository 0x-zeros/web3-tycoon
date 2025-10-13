# Event Handlers 使用说明

本目录包含了所有链上事件的处理器（Handlers），用于监听和处理Sui链上的游戏事件。

## 📁 文件结构

```
handlers/
├── BuildingDecisionHandler.ts    # 建筑购买/升级事件处理器
├── RentDecisionHandler.ts        # 租金决策事件处理器
├── DecisionSkippedHandler.ts     # 跳过决策事件处理器
├── RollAndStepHandler.ts          # 掷骰移动事件处理器
└── README.md                      # 本文档
```

**注意**：Handlers 由 `SuiManager.ts` 的 `_startEventListener()` 方法统一注册和管理。

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

**Handlers 已自动注册，无需手动配置！**

所有 Handlers 在 `SuiManager.ts` 的 `_startEventListener()` 方法中自动注册：

```typescript
// 在 SuiManager.ts 中（1058-1165行）
private _startEventListener(): void {
    // 创建 EventIndexer
    this._eventIndexer = new TycoonEventIndexer({
        client: this._client!,
        packageId: this._config!.packageId,
        autoStart: true,
        pollInterval: 1000
    });

    // 注册所有事件监听
    this._eventIndexer.on<RollAndStepActionEvent>(EventType.ROLL_AND_STEP_ACTION, ...);
    this._eventIndexer.on<BuildingDecisionEvent>(EventType.BUILDING_DECISION, ...);
    this._eventIndexer.on<RentDecisionEvent>(EventType.RENT_DECISION, ...);
    this._eventIndexer.on<DecisionSkippedEvent>(EventType.DECISION_SKIPPED, ...);
}
```

**启动流程**：
1. `SuiManager.init()` - 初始化 SuiManager
2. `SuiManager.startBackgroundSync()` - 启动后台数据同步和事件监听
3. `_startEventListener()` - 自动创建 EventIndexer 并注册所有 handlers

**停止**：
```typescript
SuiManager.instance.stopEventListener();
```

## 🔄 事件流程

```
链上交易
    ↓
SuiManager._eventIndexer 轮询查询事件（每1秒）
    ↓
EventIndexer 解析事件并调用注册的handler
    ↓
Handler 更新 GameSession 数据（turn、玩家现金、建筑等）
    ↓
GameSession 触发渲染更新（通过 GameMap）
    ↓
UI 显示 notification
```

## 🔌 与 SuiManager 的集成

Handlers 在 `SuiManager.ts:1058-1165` 的 `_startEventListener()` 方法中注册：

```typescript
// 1128-1138: RollAndStepActionEvent
this._eventIndexer.on<RollAndStepActionEvent>(EventType.ROLL_AND_STEP_ACTION, ...);

// 1140-1146: BuildingDecisionEvent
this._eventIndexer.on<BuildingDecisionEvent>(EventType.BUILDING_DECISION, ...);

// 1148-1154: RentDecisionEvent
this._eventIndexer.on<RentDecisionEvent>(EventType.RENT_DECISION, ...);

// 1156-1162: DecisionSkippedEvent
this._eventIndexer.on<DecisionSkippedEvent>(EventType.DECISION_SKIPPED, ...);
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
2. **EventIndexer配置**：已在 `sui/events/indexer.ts` 中配置了事件映射
3. **单例模式**：所有Handler使用单例模式，通过 `getInstance()` 获取实例
4. **错误处理**：所有Handler都有完整的try-catch错误处理
5. **日志输出**：所有关键操作都有console日志，便于调试
6. **自动启动**：`SuiManager.startBackgroundSync()` 会自动启动EventIndexer和所有handlers

## 🐛 测试

测试时需要确保：
1. `SuiManager` 已正确初始化（`SuiManager.init()`）
2. 后台同步已启动（`SuiManager.startBackgroundSync()`）
3. EventIndexer正确连接到Sui网络（检查console日志）
4. PackageId正确配置（在 `SuiConfig` 中）
5. GameSession已正确初始化（有当前游戏）
6. 链上有相应的事件产生

**调试日志关键字**：
- `[SuiManager] BuildingDecisionEvent from chain`
- `[BuildingDecisionHandler]`
- `[RentDecisionHandler]`
- `[DecisionSkippedHandler]`
- `[GameSession] 建筑数据更新`
- `[GameMap] Building render updated`

## 📚 相关文档

- SuiManager: `../../managers/SuiManager.ts:1058-1165`
- EventIndexer: `../indexer.ts`
- 事件类型定义: `../types.ts`
- GameSession: `../../../core/GameSession.ts:777-834`
- GameMap: `../../../map/core/GameMap.ts:856-900`
- Move合约: `../../../../../../move/tycoon/sources/game.move`
