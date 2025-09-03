# FairyGUI UI系统实现文档

## 📁 文件结构

```
assets/scripts/ui/
├── core/                    # 核心框架
│   ├── UITypes.ts          # UI类型定义和枚举
│   ├── UIBase.ts           # UI基类，采用组合模式持有FairyGUI组件
│   └── UIManager.ts        # UI管理器，FairyGUI的封装层
├── events/                 # 事件系统  
│   ├── EventTypes.ts       # 事件类型定义，统一管理所有事件
│   ├── EventBus.ts         # 事件总线，全局事件通信机制
│   └── Blackboard.ts       # 黑板系统，响应式数据共享
├── game/                   # 游戏UI界面
│   ├── UIModeSelect.ts     # 模式选择界面
│   └── UIInGame.ts         # 游戏内HUD界面
├── utils/                  # 工具类
│   ├── UIHelper.ts         # UI辅助工具，提供常用UI操作
│   └── UILoader.ts         # FairyGUI资源加载器，专门用于包管理
└── index.ts                # 统一入口，导出所有UI相关类
```

## 🎯 核心功能特性

### FairyGUI集成
- **无缝集成**: 完全基于FairyGUI构建，充分利用其强大功能
- **组合模式**: UIBase持有GComponent引用，不继承避免过度封装
- **包管理**: 专业的UIPackage加载和管理机制
- **窗口系统**: 支持FairyGUI原生的Window系统

### UI管理器 (UIManager)
- **FairyGUI封装**: 初始化GRoot，管理设计分辨率
- **包加载**: 异步加载UIPackage，支持批量加载
- **生命周期**: 完整的UI显示/隐藏/销毁管理
- **缓存系统**: 可选的UI实例缓存复用

### UIBase组合模式
- **持有引用**: 持有fgui.GComponent而不继承
- **便捷访问**: 提供getButton、getText等便捷方法
- **生命周期**: onInit、onShow、onHide等回调
- **事件绑定**: 自动管理EventBus和Blackboard监听

### 事件与数据系统
- **EventBus**: 全局事件总线，跨模块通信
- **Blackboard**: 响应式数据绑定，自动UI更新
- **事件类型**: 统一的事件类型定义

## 🚀 快速开始

### 1. 系统初始化

```typescript
import { UIManager } from "./ui";

// 方式1: 基础初始化
await UIManager.initUISystem({
    debug: true,
    enableCache: true,
    designResolution: { width: 1136, height: 640 }
});

// 方式2: 完整初始化（推荐）
await UIManager.initializeGameUI(); // 自动预加载包、注册UI、显示初始界面
```

### 2. 注册和显示UI

```typescript
import { UIManager, UIModeSelect } from "./ui";

// 注册UI配置
UIManager.instance.registerUI("ModeSelect", {
    packageName: "Common",        // FairyGUI包名
    componentName: "ModeSelect",  // 组件名
    cache: true,                  // 是否缓存
    isWindow: false,              // 是否作为窗口显示
    modal: false                  // 是否模态
}, UIModeSelect);

// 或使用便捷方法
UIManager.instance.registerModeSelectUI("Common", "ModeSelect");

// 显示UI
const ui = await UIManager.instance.showUI<UIModeSelect>("ModeSelect");
// 或使用便捷方法
const ui = await UIManager.instance.showModeSelect();
```

### 3. 包管理

```typescript
import { UIManager } from "./ui";

// 加载单个包
await UIManager.instance.loadPackage("Common");

// 预加载包（便捷方法）
await UIManager.preloadUIPackages(["Common", "Game"]);

// 检查包状态
console.log("已加载:", UIManager.instance.getLoadedPackages());
console.log("包状态:", UIManager.instance.getStats());
```

## 🎨 创建自定义UI界面

### 1. 继承UIBase

```typescript
import { UIBase } from "./ui/core/UIBase";
import { EventBus } from "./ui/events/EventBus";
import { Blackboard } from "./ui/events/Blackboard";
import * as fgui from "fairygui-cc";

export class UICustom extends UIBase {
    private _startBtn: fgui.GButton | null = null;
    private _titleText: fgui.GTextField | null = null;

    // 初始化组件引用
    protected onInit(): void {
        this._startBtn = this.getButton("btnStart");
        this._titleText = this.getText("txtTitle");
        
        // 设置默认值
        if (this._titleText) {
            this._titleText.text = "欢迎";
        }
    }

    // 绑定事件
    protected bindEvents(): void {
        if (this._startBtn) {
            this._startBtn.onClick(this._onStartClick, this);
        }
        
        // 监听数据变化
        Blackboard.instance.watch("playerName", this._onPlayerNameChange, this);
    }

    // 解绑事件
    protected unbindEvents(): void {
        if (this._startBtn) {
            this._startBtn.offClick(this._onStartClick, this);
        }
        
        // 父类会自动清理EventBus和Blackboard监听
        super.unbindEvents();
    }

    private _onStartClick(): void {
        EventBus.emitEvent("game_start", { source: "custom_ui" });
    }

    private _onPlayerNameChange(name: string): void {
        if (this._titleText) {
            this._titleText.text = `欢迎, ${name}`;
        }
    }
}
```

### 2. 注册和使用

```typescript
// 注册UI
UIManager.instance.registerUI("Custom", {
    packageName: "Game",
    componentName: "CustomPanel"
}, UICustom);

// 显示UI
const customUI = await UIManager.instance.showUI<UICustom>("Custom", {
    playerName: "玩家1"
});
```

## 🔧 高级功能

### 1. FairyGUI组件便捷访问

```typescript
export class UIAdvanced extends UIBase {
    protected onInit(): void {
        // 获取各种FairyGUI组件
        const button = this.getButton("btnConfirm");
        const text = this.getText("txtLabel");
        const image = this.getImage("imgIcon");
        const list = this.getList("listItems");
        const progress = this.getProgressBar("progressHp");
        const slider = this.getSlider("sliderVolume");
        
        // 获取控制器和动画
        const controller = this.getController("ctrlState");
        const transition = this.getTransition("animShow");
        
        // 直接访问FairyGUI面板
        console.log("面板大小:", this.panel.width, this.panel.height);
    }
}
```

### 2. 窗口模式显示

```typescript
// 注册为窗口UI
UIManager.instance.registerUI("Dialog", {
    packageName: "Common",
    componentName: "ConfirmDialog",
    isWindow: true,    // 作为窗口显示
    modal: true        // 模态窗口
}, UIDialog);

// FairyGUI会自动处理窗口显示逻辑
await UIManager.instance.showUI("Dialog");
```

### 3. 事件和数据绑定

```typescript
import { EventTypes } from "./ui/events/EventTypes";

// 发送事件
EventBus.emitEvent(EventTypes.Game.GameStart, { mode: "single" });
EventBus.emitEvent(EventTypes.Player.MoneyChange, { money: 1000 });

// 监听事件
EventBus.onEvent(EventTypes.UI.ButtonClick, (data) => {
    console.log("按钮点击:", data);
}, this);

// 数据绑定
Blackboard.instance.set("playerMoney", 1000);
Blackboard.instance.watch("playerMoney", (newMoney) => {
    this.updateMoneyDisplay(newMoney);
}, this);
```

### 4. 资源管理

```typescript
// 创建UI对象
const obj = UIManager.instance.createObject("Game", "ItemIcon");

// 异步创建（自动加载包）
const obj2 = await UIManager.instance.createObjectAsync("Game", "ItemIcon");

// 检查资源
if (UIManager.instance.hasResource("Game", "ItemIcon")) {
    console.log("资源存在");
}

// 卸载包
UIManager.instance.unloadPackage("Game");
```

## 📋 最佳实践

### 1. UI生命周期管理
- 在 `onInit()` 中获取组件引用和设置初值
- 在 `bindEvents()` 中绑定FairyGUI和系统事件
- 在 `unbindEvents()` 中清理事件（父类自动清理系统事件）
- 在 `onShow()` 中更新显示数据

### 2. 内存管理
- 启用UI缓存 `cache: true` 复用频繁显示的UI
- 使用UIManager管理FairyGUI包的加载卸载
- 及时调用 `unbindEvents()` 避免内存泄漏
- 对于一次性UI设置 `cache: false`

### 3. 事件通信
- 优先使用 `EventBus` 进行跨模块通信
- 使用 `Blackboard` 进行数据共享和UI自动更新
- 避免直接持有其他UI的引用
- 使用 `EventTypes` 常量避免字符串硬编码

### 4. FairyGUI集成
- 充分利用FairyGUI编辑器设计UI
- 使用Controller控制UI状态
- 使用Transition制作UI动画
- 合理组织FairyGUI包结构

## 🐛 调试和诊断

### 1. 启用调试模式

```typescript
// 初始化时启用调试
await UIManager.initUISystem({ debug: true });

// 或单独启用各模块调试
EventBus.setDebug(true);
Blackboard.instance.setDebug(true);
```

### 2. 获取系统状态

```typescript
// 获取UI管理器状态
const activeUIs = UIManager.instance.getActiveUIs();
console.log("当前显示的UI:", activeUIs);

// 获取包加载状态
const stats = UIManager.instance.getStats();
console.log("包加载状态:", stats);

// 获取事件系统状态
const eventInfo = EventBus.getDebugInfo();
console.log("事件系统:", eventInfo);

// 获取数据系统状态
const dataInfo = Blackboard.instance.getDebugInfo();
console.log("数据系统:", dataInfo);
```

### 3. 常见问题排查

```typescript
// 检查包是否加载
if (!UIManager.instance.isPackageLoaded("Common")) {
    console.error("包未加载");
}

// 检查UI是否注册
const ui = UIManager.instance.getUI("ModeSelect");
if (!ui) {
    console.error("UI未注册或未显示");
}

// 检查FairyGUI组件
if (!this.getButton("btnStart")) {
    console.error("FairyGUI组件不存在");
}
```

## 🔄 系统清理

```typescript
// 在游戏退出时清理UI系统
UIManager.cleanupUISystem();
```

## 📦 使用示例

完整的使用示例可参考 `UIManager.initializeGameUI()` 函数：

```typescript
// 一键初始化整个UI系统
await UIManager.initializeGameUI();

// 系统会自动：
// 1. 初始化UIManager和FairyGUI
// 2. 预加载UI包
// 3. 注册UI界面
// 4. 显示初始界面
```

---

这个UI系统完全基于FairyGUI构建，既保持了FairyGUI的强大功能，又提供了便捷的管理层，为Web3 Tycoon提供了企业级的UI解决方案。