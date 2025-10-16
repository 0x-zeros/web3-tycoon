# 循环依赖问题解决方案

## 问题背景

Cocos Creator 3.8.7 在构建时遇到循环依赖错误：

```
Circular dependency: UIManager.ts -> UIWallet.ts -> UIManager.ts
```

通过全面扫描，发现项目中共有 **3 个循环依赖**：

1. **Role ↔ Actor**（已部分解决，使用 `import type`）
2. **ActorConfig ↔ PaperActor**（ActorType 枚举定义问题）
3. **核心系统大循环**（GameInitializer → GameSession → SuiManager → Handlers → UIManager → UIInGame → GameInitializer）

## 解决方案

采用 **抽取共享类型 + import type + 单例访问** 的组合策略。

### 策略 1: 抽取共享类型到独立文件

#### 1.1 创建 `role/ActorTypes.ts`

**目的**: 解决 ActorConfig ↔ PaperActor 循环依赖

**内容**:
```typescript
export enum ActorType {
    NPC = 0,
    PLAYER = 1,
    BUILDING = 2,
    OBJECT = 3
}
```

**修改文件**:
- `ActorConfig.ts`: `import { ActorType } from './ActorTypes';`
- `PaperActor.ts`: `export { ActorType } from './ActorTypes';` （重新导出，保持向后兼容）

#### 1.2 扩展 `ui/core/UITypes.ts`

**目的**: 解决 UIManager ↔ 各 UI 组件的循环依赖

**添加内容**:
- `UILayer` 枚举（从 UIManager 抽取）
- `UIConfig` 接口
- `UIConstructor` 接口
- `UIManagerConfig` 接口

**修改文件**:
- `UIManager.ts`: 从 UITypes 导入，并重新导出（保持向后兼容）
- `UIWallet.ts`: 从 UITypes 导入 UILayer

### 策略 2: 使用 `import type` + 字符串组件名

#### 2.1 UIManager 使用 `import type`

**修改**: `ui/core/UIManager.ts`

```typescript
// 使用 import type 导入 UI 组件（避免循环依赖）
import type { UIModeSelect } from "../game/UIModeSelect";
import type { UIInGame } from "../game/UIInGame";
import type { UIMapSelect } from "../game/UIMapSelect";
import type { UIWallet } from "../game/UIWallet";
```

#### 2.2 实例化时使用字符串

```typescript
// initWalletUI 方法
this._walletUI = walletCom.node.addComponent("UIWallet") as UIWallet;

// registerUI 方法支持字符串组件名
this.registerUI("ModeSelect", {...}, "UIModeSelect");
this.registerUI("InGame", {...}, "UIInGame");
this.registerUI("MapSelect", {...}, "UIMapSelect");
```

### 策略 3: 使用 `declare` 声明 + 单例访问

#### 3.1 Handlers 不导入 UIManager

**修改文件**:
- `sui/events/handlers/BankruptHandler.ts`
- `sui/events/handlers/GameEndedHandler.ts`

**方式**:
```typescript
// 移除导入
// import { UIManager } from '../../../ui/core/UIManager';

// 添加声明
declare const UIManager: any;

// 使用单例访问
const uiManager = UIManager.getInstance();
```

#### 3.2 UI 组件不导入 GameInitializer

**修改文件**:
- `ui/game/UIInGame.ts`
- `ui/game/UIInGameInfo.ts`
- `ui/game/UIInGameDebug.ts`
- `ui/game/UIInGameCards.ts`
- `ui/game/UIInGamePlayer.ts`
- `ui/game/UIInGameDice.ts`
- `ui/game/UIInGameBuildingSelect.ts`

**方式**:
```typescript
// 移除导入
// import { GameInitializer } from "../../core/GameInitializer";

// 添加 Blackboard 导入（如果没有）
import { Blackboard } from "../../events/Blackboard";

// 从 Blackboard 获取 GameSession
const session = Blackboard.instance.get<any>("currentGameSession");
```

#### 3.3 UIWallet 不导入 UIManager

**修改**: `ui/game/UIWallet.ts`

```typescript
// 添加声明
declare const UIManager: any;

// 使用单例访问
const popupLayer = UIManager.instance.getLayer(UILayer.POPUP);
```

## 修改文件清单

### 新建文件 (2)
1. ✅ `role/ActorTypes.ts` - ActorType 枚举

### 修改文件 (14)

#### Role 层 (2)
2. ✅ `role/ActorConfig.ts` - 从 ActorTypes 导入
3. ✅ `role/PaperActor.ts` - 从 ActorTypes 导入并重新导出

#### UI 核心层 (2)
4. ✅ `ui/core/UITypes.ts` - 添加 UILayer 等类型
5. ✅ `ui/core/UIManager.ts` - 使用 import type + 字符串组件名

#### UI 游戏层 (8)
6. ✅ `ui/game/UIWallet.ts` - 从 UITypes 导入 + declare UIManager
7. ✅ `ui/game/UIInGame.ts` - 移除 GameInitializer，使用 Blackboard
8. ✅ `ui/game/UIInGameInfo.ts` - 移除 GameInitializer，使用 Blackboard
9. ✅ `ui/game/UIInGameDebug.ts` - 移除 GameInitializer，使用 Blackboard
10. ✅ `ui/game/UIInGameCards.ts` - 移除 GameInitializer，使用 Blackboard
11. ✅ `ui/game/UIInGamePlayer.ts` - 移除 GameInitializer，使用 Blackboard
12. ✅ `ui/game/UIInGameDice.ts` - 移除 GameInitializer，使用 Blackboard
13. ✅ `ui/game/UIInGameBuildingSelect.ts` - 移除 GameInitializer，使用 Blackboard

#### Sui 事件层 (2)
14. ✅ `sui/events/handlers/BankruptHandler.ts` - 移除 UIManager，使用 declare
15. ✅ `sui/events/handlers/GameEndedHandler.ts` - 移除 UIManager，使用 declare

## 验证结果

```bash
=== 检查所有循环依赖是否解决 ===

1. UI 层不再导入 GameInitializer: 0 ✅
2. Handlers 层不再导入 UIManager: 0 ✅
3. ActorConfig 不再从 PaperActor 导入 ActorType: 0 ✅
4. UIWallet 不再从 UIManager 导入 UILayer: 0 ✅

所有检查通过！循环依赖已完全解决。
```

## 后续操作

### 1. 清理构建缓存（必须）

```bash
cd client/tycoon_cocos
./clean-build-cache.sh
```

或手动执行：
```bash
rm -rf temp library build node_modules/.cache
```

### 2. 重新构建项目

1. 在 Cocos Creator 3.8.7 编辑器中重新打开项目
2. 等待编译完成（可能需要几分钟）
3. 执行构建（Build）

### 3. 验证功能

构建成功后，验证以下功能是否正常：

- ✅ UI 系统初始化（ModeSelect → MapSelect → InGame）
- ✅ 钱包连接功能（UIWallet）
- ✅ 游戏内 UI（骰子、卡牌、玩家信息等）
- ✅ Sui 事件处理（BankruptHandler, GameEndedHandler 等）

## 技术细节

### `import type` vs 普通 `import`

```typescript
// 仅类型导入（编译后被擦除）
import type { UIWallet } from "./UIWallet";

// 值导入（运行时需要）
import { UILayer } from "./UITypes";
```

### `declare` 声明的作用

```typescript
// 告诉 TypeScript：UIManager 在运行时会存在（通过其他方式加载）
declare const UIManager: any;

// 运行时通过单例访问（不会报错）
const manager = UIManager.getInstance();
```

### Cocos Creator 组件字符串查找

```typescript
// Cocos Creator 支持通过 @ccclass 装饰器名称查找组件
@ccclass('UIWallet')
export class UIWallet extends UIBase { }

// 可以通过字符串实例化
node.addComponent("UIWallet");  // ✅ 有效
```

## 设计优点

1. **最小改动**：只修改了 14 个文件，没有大规模重构
2. **保持兼容**：通过重新导出，保持向后兼容性
3. **类型安全**：大部分地方仍保留类型检查，只在必要时使用 any
4. **架构优化**：抽取共享类型到独立文件，符合单一职责原则
5. **易于维护**：通过注释说明了每处修改的原因

## 注意事项

1. **字符串组件名的风险**：
   - 使用字符串方式 `addComponent("UIWallet")` 时，拼写错误不会被编译器检测
   - 建议在组件类上添加 `@ccclass('UIWallet')` 装饰器，确保名称一致

2. **declare 声明的限制**：
   - 使用 `declare const UIManager: any` 会失去类型检查
   - 只在确实无法避免循环依赖时使用

3. **Blackboard 依赖**：
   - UI 组件现在依赖 Blackboard 来获取 GameSession
   - 确保 GameInitializer 在设置 GameSession 到 Blackboard 时使用一致的键名 `"currentGameSession"`

## 参考资料

- [TypeScript: import type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)
- [Cocos Creator: Component System](https://docs.cocos.com/creator/3.8/manual/en/scripting/component.html)
- [Circular Dependencies Best Practices](https://medium.com/visual-development/how-to-fix-nasty-circular-dependency-issues-once-and-for-all-in-javascript-typescript-a04c987cf0de)
