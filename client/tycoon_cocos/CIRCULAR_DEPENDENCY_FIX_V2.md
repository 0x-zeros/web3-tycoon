# 循环依赖修复方案 V2（最安全版本）

## 修复策略

使用 **最小侵入式修复**：
- ✅ 抽取共享类型到独立文件
- ✅ 保留所有类型导入（不破坏类型系统）
- ✅ 只在调用处使用类型断言（`as any`）
- ✅ 使用 `declare` 声明运行时对象

---

## 修复的循环依赖（共3个）

### 循环 #1: ActorConfig ↔ PaperActor ✅

**问题**:
```
ActorConfig.ts → import { ActorType } from './PaperActor'
PaperActor.ts → import { ActorConfigManager } from './ActorConfig'
```

**解决方案**: 抽取 ActorType 枚举

**修改文件**:
1. ✅ `role/ActorTypes.ts` (新建) - 定义 ActorType 枚举
2. ✅ `role/ActorConfig.ts` - 从 ActorTypes 导入
3. ✅ `role/PaperActor.ts` - 从 ActorTypes 导入并重新导出

**改动量**: 1新建 + 2修改 = 3个文件

---

### 循环 #2: UIManager ↔ UIWallet ✅

**问题**:
```
UIManager.ts → import { UIWallet }  (需要注册)
UIWallet.ts → import { UIManager, UILayer }  (需要 getLayer)
```

**解决方案**: 抽取 UILayer + 调用处类型断言

**修改文件**:
1. ✅ `ui/core/UITypes.ts` - 添加 UILayer 枚举
2. ✅ `ui/core/UIManager.ts` - 从 UITypes 导入并重新导出 UILayer
3. ✅ `ui/game/UIWallet.ts` - 从 UITypes 导入 UILayer，使用 declare + as any 访问 UIManager

**关键修改**:
```typescript
// UIWallet.ts (第9行)
import { UILayer } from "../core/UITypes";  // ✅ 从 UITypes 导入

// UIWallet.ts (第12行)
declare const UIManager: any;  // ✅ 声明运行时对象

// UIWallet.ts (第330行)
const popupLayer = (UIManager as any).instance.getLayer(UILayer.POPUP);  // ✅ 类型断言
```

**改动量**: 3个文件

---

### 循环 #3: 核心系统大循环 ✅

**问题**:
```
UIManager → UIInGame/UIGameEnd (需要注册)
UIInGame → UIManager (exitGame)
UIInGame → GameInitializer (getGameSession)
UIGameEnd → UIManager (exitGame)
BankruptHandler → UIManager (showUI)
GameEndedHandler → UIManager (showUI)
```

**解决方案**: 调用处类型断言

**修改文件**:
1. ✅ `ui/game/UIInGame.ts` - 移除值导入，使用 declare + as any
2. ✅ `ui/game/UIGameEnd.ts` - 移除值导入，使用 declare + as any
3. ✅ `sui/events/handlers/BankruptHandler.ts` - 移除导入，使用 declare + as any
4. ✅ `sui/events/handlers/GameEndedHandler.ts` - 移除导入，使用 declare + as any

**关键修改**:
```typescript
// UIInGame.ts (第20-22行)
declare const UIManager: any;
declare const GameInitializer: any;

// UIInGame.ts (第348行)
(UIManager as any).instance?.exitGame();

// UIInGame.ts (第471行)
const session = (GameInitializer as any).getInstance()?.getGameSession();

// BankruptHandler.ts (第100行)
const uiManager = (UIManager as any).getInstance();
```

**改动量**: 4个文件

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
✅ 1. ActorConfig 不从 PaperActor 导入: 0
✅ 2. UIWallet 不从 UIManager 导入: 0  
✅ 3. UIInGame 不值导入 UIManager/GameInitializer: 0
✅ 4. Handlers 不导入 UIManager: 0
✅ 5. declare 声明数量: 6
```

---

## 技术要点

### 1. 枚举抽取（ActorType, UILayer）

**原理**: 将共享的枚举定义移到独立文件，多个模块都从这里导入。

**优点**:
- ✅ 完全打破循环
- ✅ 类型安全
- ✅ 可复用

### 2. declare + as any（调用处断言）

**原理**: 
- 不导入类型，使用 `declare` 告知 TypeScript 运行时存在
- 调用时使用 `as any` 进行类型断言

**示例**:
```typescript
// 不导入
// import { UIManager } from "../core/UIManager";

// 声明
declare const UIManager: any;

// 使用
(UIManager as any).instance.getLayer(UILayer.POPUP);
```

**优点**:
- ✅ 不破坏运行时行为（导入仍保留在其他地方）
- ✅ 只在调用点失去类型检查
- ✅ 改动最小

### 3. 重新导出（Re-export）

**原理**: UIManager 从 UITypes 导入 UILayer，然后重新导出，保持向后兼容。

**示例**:
```typescript
// UIManager.ts
import { UILayer } from "./UITypes";
export { UILayer };  // 重新导出

// 其他旧代码仍可以
import { UILayer } from "./UIManager";  // ✅ 仍然有效
```

---

## 与之前方案的对比

### 之前的失败方案
- ❌ 使用 `import type` 导入 UI 组件 → 类在运行时被擦除
- ❌ 使用字符串组件名注册 → 失去类型安全
- ❌ 从 Blackboard 获取 GameSession → 代码改动太大

### 当前成功方案
- ✅ 保留正常 import → 类在运行时存在
- ✅ 保留类引用注册 → 类型安全
- ✅ 只在调用处用 as any → 改动最小

---

## 后续操作

### 1. 清理缓存

```bash
./clean-build-cache.sh
```

### 2. 重新构建

1. 在 Cocos Creator 中重新打开项目
2. 等待编译完成
3. 执行构建测试

### 3. 预期结果

✅ 构建成功，无循环依赖错误
✅ UI 显示正常（所有类型和注册逻辑未改变）
✅ 功能正常（运行时行为完全一致）

---

## 风险评估

### 零风险
- ✅ ActorType/UILayer 抽取：纯类型迁移
- ✅ 重新导出：向后兼容

### 低风险  
- 🟢 declare + as any：只在 6 处调用点使用
- 🟢 运行时对象确实存在（UIManager/GameInitializer 是单例）

---

## 维护建议

1. **添加新 UI 时**: 从 UITypes 导入 UILayer
2. **访问 UIManager 单例**: 如果会造成循环依赖，使用 `(UIManager as any).instance`
3. **访问 GameInitializer 单例**: 如果会造成循环依赖，使用 `(GameInitializer as any).getInstance()`

---

**修复时间**: 2025-10-16  
**状态**: ✅ 修复完成，待验证
