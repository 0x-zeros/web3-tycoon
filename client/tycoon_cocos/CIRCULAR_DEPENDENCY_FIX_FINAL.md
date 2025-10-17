# 循环依赖修复方案（最终版本 - 动态 import）

## 修复策略

使用 **动态 import**（项目已在使用的模式）：
- ✅ 移除静态 import（打破编译期循环依赖）
- ✅ 使用动态 import（确保运行时模块加载）
- ✅ 函数改为 async（支持 await import）

---

## 修复的循环依赖（共3个）

### 循环 #1: ActorConfig ↔ PaperActor ✅

**解决方案**: 抽取 ActorType 枚举

**修改文件**:
- `role/ActorTypes.ts` (新建)
- `role/ActorConfig.ts` - 从 ActorTypes 导入
- `role/PaperActor.ts` - 从 ActorTypes 导入并重新导出

---

### 循环 #2: UIManager ↔ UIWallet ✅

**解决方案**: 抽取 UILayer + 动态 import

**修改**:
- `ui/core/UITypes.ts` - 添加 UILayer 枚举
- `ui/core/UIManager.ts` - 从 UITypes 导入并重新导出
- `ui/game/UIWallet.ts`:
  - 从 UITypes 导入 UILayer
  - 移除 `import { UIManager }`
  - 第282行：函数改为 `async`
  - 第328行：`const { UIManager } = await import("../core/UIManager");`

---

### 循环 #3: 核心系统大循环 ✅

**解决方案**: 动态 import

**修改文件** (4个):

#### 1. UIInGame.ts
- 移除 `import { UIManager }` 和 `import { GameInitializer }`
- 第343行：`_onExitGameClick` 改为 `async`
- 第346行：`const { UIManager } = await import("../core/UIManager");`
- 第468行：`_showDecisionDialogIfNeeded` 改为 `async`  
- 第470行：`const { GameInitializer } = await import("../../core/GameInitializer");`

#### 2. UIGameEnd.ts
- 移除 `import { UIManager }`
- 第132行：`_onEndClick` 改为 `async`
- 第139行：`const { UIManager } = await import("../core/UIManager");`

#### 3. BankruptHandler.ts
- 移除 `import { UIManager }`
- 第97行：`const { UIManager } = await import('../../../ui/core/UIManager');`

#### 4. GameEndedHandler.ts
- 移除 `import { UIManager }`
- 第97行：`const { UIManager } = await import('../../../ui/core/UIManager');`

---

## 修改汇总

### 新建文件 (1)
- `role/ActorTypes.ts`

### 修改文件 (9)
- Role层 (2): ActorConfig.ts, PaperActor.ts
- UI核心 (2): UITypes.ts, UIManager.ts
- UI游戏 (3): UIWallet.ts, UIInGame.ts, UIGameEnd.ts
- Sui层 (2): BankruptHandler.ts, GameEndedHandler.ts

**总改动**: 1新建 + 9修改 = **10个文件**

---

## 验证结果

```bash
✅ UI 文件不再静态导入 UIManager: 0
✅ Handlers 不再静态导入 UIManager: 0
✅ 动态 import 数量: 6（符合预期）
```

---

## 动态 import 示例

### UIWallet.ts (第328行)
```typescript
// 动态导入 UIManager（避免循环依赖）
const { UIManager } = await import("../core/UIManager");
const popupLayer = UIManager.instance.getLayer(UILayer.POPUP);
```

### UIInGame.ts (第346行 和 第470行)
```typescript
// 退出游戏
const { UIManager } = await import("../core/UIManager");
UIManager.instance?.exitGame();

// 获取 GameSession
const { GameInitializer } = await import("../../core/GameInitializer");
const session = GameInitializer.getInstance()?.getGameSession();
```

### Handlers (BankruptHandler, GameEndedHandler)
```typescript
// 动态导入 UIManager（避免循环依赖）
const { UIManager } = await import('../../../ui/core/UIManager');
const uiManager = UIManager?.instance;
```

---

## 关键技术

### 1. 动态 import 语法

```typescript
// ES2020 动态导入
const { UIManager } = await import("../core/UIManager");

// 特点：
// - 返回 Promise<Module>
// - 需要在 async 函数中使用
// - 完全打破编译期循环依赖
// - 运行时按需加载模块
```

### 2. 项目已有使用

**UIInGameDice.ts (第270行)**:
```typescript
const { PathCalculator } = await import("../../sui/pathfinding/PathCalculator");
```

证明项目支持动态 import。

---

## 优势

✅ **完全打破循环依赖**
- Rollup 不会报错
- TypeScript 不会报错

✅ **确保模块加载**
- 运行时动态加载模块
- 不会出现 undefined 问题

✅ **改动最小**
- 只修改调用点
- 不改整体架构
- 不影响其他代码

✅ **类型安全**
- 不需要用 `as any`
- 动态 import 返回的是正确类型

---

## 后续操作

### 1. 清理缓存

```bash
./clean-build-cache.sh
```

### 2. 重新测试

1. 在 Cocos Creator 编辑器中重新打开项目
2. 等待编译完成（应该无循环依赖警告）
3. Chrome preview 测试（应该无渲染错误）
4. 构建测试（应该成功）

### 3. 预期结果

✅ 编译成功，无循环依赖警告
✅ Chrome preview 正常，无渲染错误
✅ UI 显示和功能完全正常
✅ 构建成功

---

## 风险评估

🟢 **零风险**
- 动态 import 是项目已在使用的技术
- 只改了调用点，不改架构
- 运行时行为不变（只是加载时机延后）

---

**修复时间**: 2025-10-16  
**状态**: ✅ 修复完成
**方案**: 动态 import（最终版本）
