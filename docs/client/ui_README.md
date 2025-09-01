# UI系统实现文档

## 📁 文件结构

```
assets/scripts/ui/
├── core/                    # 核心框架
│   ├── UITypes.ts          # UI类型定义和枚举
│   ├── UIBase.ts           # UI基类，所有UI界面的基类
│   └── UIManager.ts        # UI管理器，单例管理UI生命周期
├── events/                 # 事件系统  
│   ├── EventTypes.ts       # 事件类型定义，统一管理所有事件
│   ├── EventBus.ts         # 事件总线，全局事件通信机制
│   └── Blackboard.ts       # 黑板系统，响应式数据共享
├── components/             # 基础UI组件
│   ├── UIButton.ts         # 扩展按钮，支持防重复点击、音效、动画
│   ├── UIPanel.ts          # 基础面板，支持遮罩、拖拽
│   └── UIDialog.ts         # 对话框组件，支持多种类型
├── game/                   # 游戏UI界面
│   ├── MainMenuUI.ts       # 主菜单界面
│   └── GameHUD.ts          # 游戏HUD界面，显示玩家信息
├── utils/                  # 工具类
│   ├── UIHelper.ts         # UI辅助工具，提供常用UI操作
│   └── UILoader.ts         # 资源加载器，智能缓存和批量加载
└── index.ts                # 统一入口，导出所有UI相关类
```

## 🎯 核心功能特性

### UI管理器 (UIManager)
- **单例模式**: 全局统一管理所有UI界面
- **层级管理**: 5层UI层级（背景/普通/弹窗/顶层/系统）
- **生命周期**: 完整的显示/隐藏/销毁管理
- **对象池**: 内存优化的UI复用机制
- **独占显示**: 支持同层UI互斥显示

### 事件系统
- **EventBus**: 全局事件总线，跨模块通信
- **EventTypes**: 统一的事件类型定义
- **自动解绑**: 防止内存泄漏的目标对象自动解绑

### 黑板系统 (Blackboard)
- **响应式数据**: 数据变化自动通知UI更新
- **持久化存储**: 支持数据本地存储
- **深度监听**: 支持对象内部变化监听
- **立即触发**: 支持监听时立即获取当前值

### 基础组件
- **UIButton**: 防重复点击、音效、点击动画
- **UIPanel**: 背景遮罩、拖拽功能、边界检查
- **UIDialog**: 多种对话框类型、静态便捷方法

### 工具类
- **UIHelper**: 坐标转换、动画效果、数值格式化
- **UILoader**: 资源加载、智能缓存、批量加载

## 🚀 快速开始

### 1. 系统初始化

```typescript
import { initUISystem } from "./ui/index";

// 在游戏启动时初始化UI系统
initUISystem({
    debug: true,                    // 启用调试模式
    enablePool: true,              // 启用对象池
    poolMaxSize: 5,                // 对象池最大数量
    defaultAnimationDuration: 0.3   // 默认动画时长
});
```

### 2. 注册UI界面

```typescript
import { UIManager, UILayer } from "./ui/index";
import { MainMenuUI } from "./ui/game/MainMenuUI";

// 注册主菜单UI
UIManager.instance.registerUI("MainMenu", {
    prefabPath: "prefabs/ui/MainMenuUI",  // 预制体路径
    layer: UILayer.Normal,                // UI层级
    cache: true,                          // 启用缓存
    showAnimation: UIAnimationType.Scale, // 显示动画
    hideAnimation: UIAnimationType.Fade   // 隐藏动画
}, MainMenuUI);
```

### 3. 显示和隐藏UI

```typescript
// 显示UI
const ui = await UIManager.instance.showUI("MainMenu", {
    data: { playerName: "玩家1" },        // 传递数据
    animation: UIAnimationType.Scale,      // 显示动画
    onComplete: () => console.log("显示完成")
});

// 隐藏UI
await UIManager.instance.hideUI("MainMenu", {
    animation: UIAnimationType.Fade,       // 隐藏动画
    onComplete: () => console.log("隐藏完成")
});
```

### 4. 事件通信

```typescript
import { EventBus, EventTypes } from "./ui/index";

// 发送事件
EventBus.emitEvent(EventTypes.UI.StartGame, { 
    gameMode: "single_player" 
});

// 监听事件
EventBus.onEvent(EventTypes.Game.PlayerMove, (data) => {
    console.log("玩家移动:", data);
}, this);

// 取消监听
EventBus.offTarget(this); // 取消目标对象的所有监听
```

### 5. 数据绑定

```typescript
import { Blackboard } from "./ui/index";

// 设置数据
Blackboard.instance.set("playerMoney", 1000);
Blackboard.instance.set("playerLevel", 5, true); // 持久化存储

// 监听数据变化
Blackboard.instance.watch("playerMoney", (newValue, oldValue) => {
    console.log(`金钱从 ${oldValue} 变为 ${newValue}`);
    // 更新UI显示
    this.updateMoneyDisplay(newValue);
}, this);

// 立即触发监听（如果数据已存在）
Blackboard.instance.watchImmediate("playerHp", (hp) => {
    this.updateHpBar(hp);
}, this);
```

## 🎨 创建自定义UI界面

### 1. 继承UIBase

```typescript
import { UIBase } from "./ui/core/UIBase";
import { UIButton } from "./ui/components/UIButton";

@ccclass('CustomUI')
export class CustomUI extends UIBase {
    @property(UIButton)
    confirmButton: UIButton | null = null;

    // 初始化UI（只调用一次）
    protected onInit(): void {
        // 设置默认值
        if (this.confirmButton) {
            this.confirmButton.text = "确认";
            this.confirmButton.buttonId = "confirm";
        }
    }

    // 绑定事件
    protected bindEvents(): void {
        if (this.confirmButton) {
            this.confirmButton.setClickCallback(() => this.onConfirmClick());
        }
        
        // 监听数据变化
        Blackboard.instance.watch("gameData", this.onGameDataChange, this);
    }

    // 解绑事件
    protected unbindEvents(): void {
        if (this.confirmButton) {
            this.confirmButton.setClickCallback(null);
        }
        Blackboard.instance.unwatchTarget(this);
    }

    // 显示前回调
    protected onBeforeShow(data: any): void {
        console.log("UI即将显示:", data);
        // 更新UI内容
        this.updateUI(data);
    }

    // 显示后回调
    protected onAfterShow(data: any): void {
        console.log("UI显示完成");
        // 播放显示动画等
    }

    // 按钮点击处理
    private onConfirmClick(): void {
        EventBus.emitEvent(EventTypes.UI.ButtonClick, {
            buttonId: "confirm",
            source: this.uiId
        });
        this.hide(); // 隐藏UI
    }
}
```

### 2. 注册和使用

```typescript
// 注册UI
UIManager.instance.registerUI("CustomUI", {
    prefabPath: "prefabs/ui/CustomUI",
    layer: UILayer.Popup,
    cache: true
}, CustomUI);

// 显示UI
const customUI = await UIManager.instance.showUI("CustomUI", {
    data: { title: "自定义标题", message: "自定义内容" }
});
```

## 🔧 高级功能

### 1. 自定义动画

```typescript
import { UIHelper } from "./ui/utils/UIHelper";

// 节点弹跳动画
await UIHelper.bounceNode(this.titleNode, 0.2, 0.8);

// 数字计数动画
await UIHelper.animateNumber(0, 1000, 2.0, (value) => {
    this.scoreLabel.string = value.toString();
});

// 摇摆动画
await UIHelper.shakeNode(this.errorNode, 15, 0.6);
```

### 2. 资源预加载

```typescript
import { UILoader } from "./ui/utils/UILoader";

// 预加载UI资源
const assetPaths = [
    "prefabs/ui/MainMenuUI",
    "prefabs/ui/GameHUD", 
    "textures/ui/background",
    "audio/ui/button_click"
];

await UILoader.preloadUIAssets(assetPaths, (finished, total) => {
    const progress = (finished / total) * 100;
    console.log(`加载进度: ${progress}%`);
});
```

### 3. 批量操作

```typescript
// 批量隐藏UI
await UIManager.instance.hideAllUI(UILayer.Popup, ["ImportantDialog"]);

// 批量加载精灵帧
const result = await UILoader.loadSpriteFrameBatch([
    "textures/icons/coin",
    "textures/icons/gem", 
    "textures/icons/star"
]);

console.log(`成功: ${result.successCount}, 失败: ${result.failureCount}`);
```

## 📋 最佳实践

### 1. UI生命周期管理
- 在 `onInit()` 中进行一次性初始化
- 在 `bindEvents()` 和 `unbindEvents()` 中管理事件监听
- 在 `onBeforeShow()` 中更新UI数据
- 在 `onAfterHide()` 中清理临时状态

### 2. 内存管理
- 使用 `UIManager` 的对象池功能复用UI
- 及时调用 `EventBus.offTarget(this)` 解绑事件
- 使用 `Blackboard.instance.unwatchTarget(this)` 解绑数据监听
- 对于一次性UI设置 `cache: false`

### 3. 事件通信
- 优先使用 `EventBus` 进行跨模块通信
- 使用 `Blackboard` 进行数据共享和响应式更新
- 避免直接持有其他UI的引用
- 使用事件类型常量避免字符串硬编码

### 4. 性能优化
- 启用UI缓存减少重复加载
- 使用对象池复用频繁创建的UI
- 合理设置UI层级避免不必要的渲染
- 预加载常用UI资源

## 🐛 调试和诊断

### 1. 启用调试模式

```typescript
// 初始化时启用调试
initUISystem({ debug: true });

// 或运行时启用
EventBus.setDebug(true);
Blackboard.instance.setDebug(true);
```

### 2. 获取系统状态

```typescript
// 获取当前显示的UI
const activeUIs = UIManager.instance.getActiveUIs();
console.log("当前显示的UI:", activeUIs);

// 获取事件总线调试信息
const eventInfo = EventBus.getDebugInfo();
console.log("事件总线状态:", eventInfo);

// 获取黑板数据
const blackboardInfo = Blackboard.instance.getDebugInfo();
console.log("黑板数据:", blackboardInfo);

// 获取资源加载器缓存信息
const cacheInfo = UILoader.getCacheInfo();
console.log("资源缓存:", cacheInfo);
```

## 🔄 系统清理

```typescript
import { cleanupUISystem } from "./ui/index";

// 在游戏退出时清理UI系统
cleanupUISystem();
```

---

这个UI系统为Web3 Tycoon提供了企业级的UI管理能力，完全兼容Cocos Creator 3.8，支持现代化的事件驱动架构和响应式数据绑定。