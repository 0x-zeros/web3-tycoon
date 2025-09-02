# FairyGUI UI系统技术文档

## 📁 项目结构

基于FairyGUI的UI系统，采用组合模式设计，充分利用FairyGUI的强大功能。

```
assets/scripts/ui/
├── core/                    # 核心框架
│   ├── UITypes.ts          # UI类型定义和枚举
│   ├── UIBase.ts           # UI基类，采用组合模式持有FairyGUI组件
│   └── UIManager.ts        # UI管理器，FairyGUI的封装层
├── events/                 # 事件系统（保留）
│   ├── EventTypes.ts       # 事件类型定义，统一管理所有事件
│   ├── EventBus.ts         # 事件总线，全局事件通信机制
│   └── Blackboard.ts       # 黑板系统，响应式数据共享
├── game/                   # 游戏UI界面
│   ├── UIModeSelect.ts     # 模式选择界面（继承UIBase）
│   └── UIInGame.ts         # 游戏内HUD界面（继承UIBase）
├── utils/                  # 工具类
│   ├── UIHelper.ts         # UI辅助工具，提供常用UI操作
│   └── UILoader.ts         # FairyGUI资源加载器，专门用于包管理
└── index.ts                # 统一入口，导出所有UI相关类和便捷方法
```

## 🎯 核心设计理念

### 1. 组合模式 vs 继承模式
- **UIBase不继承GComponent**，而是持有`fgui.GComponent`引用
- **避免过度封装**，直接使用FairyGUI原生API
- **灵活性更高**，可以访问FairyGUI的所有功能

### 2. FairyGUI原生功能
- 使用FairyGUI的**UIPackage**管理资源包
- 使用FairyGUI的**GRoot**作为UI根节点
- 使用FairyGUI的**Window**系统管理弹窗
- 使用FairyGUI的**Controller**和**Transition**

### 3. 保留的价值模块
- **EventBus**: 全局事件通信，补充FairyGUI事件系统
- **Blackboard**: 响应式数据绑定，自动UI更新
- **UIHelper**: 通用UI工具函数
- **UILoader**: FairyGUI包管理的便捷封装

## 🚀 快速开始

### 1. 系统初始化

```typescript
import { initUISystem, initializeGameUI } from "./ui/index";

// 基础初始化
initUISystem({
    debug: true,
    enableCache: true,
    designResolution: { width: 1136, height: 640 }
});

// 完整初始化（推荐）
await initializeGameUI(); // 自动完成包加载、UI注册、界面显示
```

### 2. 创建UI界面

```typescript
import { UIBase } from "./ui/core/UIBase";
import * as fgui from "fairygui-cc";

export class UICustom extends UIBase {
    private _button: fgui.GButton | null = null;

    protected onInit(): void {
        // 通过便捷方法获取FairyGUI组件
        this._button = this.getButton("btnConfirm");
        
        // 或直接访问panel
        const text = this.panel.getChild("txtTitle").asTextField;
    }

    protected bindEvents(): void {
        if (this._button) {
            // 使用FairyGUI原生事件
            this._button.onClick(this._onButtonClick, this);
        }
    }

    private _onButtonClick(): void {
        // 通过EventBus发送事件
        EventBus.emitEvent("custom_action", { data: "test" });
    }
}
```

### 3. 注册和显示UI

```typescript
// 注册UI配置
UIManager.instance.registerUI("Custom", {
    packageName: "Game",        // FairyGUI包名
    componentName: "CustomPanel", // 组件名
    cache: true,                // 是否缓存
    isWindow: false             // 是否作为窗口显示
}, UICustom);

// 显示UI
const ui = await UIManager.instance.showUI<UICustom>("Custom");
```

## 🔧 核心组件详解

### UIManager - FairyGUI管理器

负责FairyGUI的初始化和UI生命周期管理：

```typescript
// 初始化FairyGUI
UIManager.instance.init({
    designResolution: { width: 1136, height: 640 }
});

// 加载FairyGUI包
await UIManager.instance.loadPackage("Common");

// 显示UI（自动创建GComponent和UIBase实例）
await UIManager.instance.showUI("ModeSelect");
```

### UIBase - 组合模式基类

持有FairyGUI组件引用，提供生命周期和便捷方法：

```typescript
export class UIExample extends UIBase {
    protected onInit(): void {
        // 便捷方法获取各类组件
        const btn = this.getButton("btnStart");
        const txt = this.getText("txtTitle");
        const img = this.getImage("imgIcon");
        const list = this.getList("listItems");
        const progress = this.getProgressBar("progressHP");
        const controller = this.getController("ctrlState");
        const transition = this.getTransition("animShow");
        
        // 直接访问FairyGUI面板
        this.panel.width = 500;
        this.panel.height = 300;
    }
}
```

### UILoader - 包管理

专门管理FairyGUI包的加载：

```typescript
// 加载单个包
await UILoader.loadPackage("Common");

// 批量加载
const result = await UILoader.loadPackageBatch(["Common", "Game"]);

// 预加载（静默，不抛错）
await UILoader.preloadPackages(["Common", "Game"]);

// 创建UI对象
const obj = UILoader.createObject("Game", "ItemIcon");

// 异步创建（自动加载包）
const obj = await UILoader.createObjectAsync("Game", "ItemIcon");
```

## 📋 使用模式

### 1. 基础UI界面

```typescript
export class UIModeSelect extends UIBase {
    private _singleBtn: fgui.GButton | null = null;
    private _multiBtn: fgui.GButton | null = null;

    protected onInit(): void {
        this._singleBtn = this.getButton("btnSingle");
        this._multiBtn = this.getButton("btnMulti");
    }

    protected bindEvents(): void {
        this._singleBtn?.onClick(this._onSingleClick, this);
        this._multiBtn?.onClick(this._onMultiClick, this);
        
        // 监听系统事件
        EventBus.onEvent("network_change", this._onNetworkChange, this);
        Blackboard.instance.watch("playerData", this._onDataChange, this);
    }

    protected onShow(data?: any): void {
        // 更新UI显示
        this._updateButtonStates();
    }

    private _onSingleClick(): void {
        EventBus.emitEvent("game_start", { mode: "single" });
    }
}
```

### 2. HUD界面

```typescript
export class UIInGame extends UIBase {
    private _moneyText: fgui.GTextField | null = null;
    private _hpBar: fgui.GProgressBar | null = null;
    private _rollBtn: fgui.GButton | null = null;

    protected onInit(): void {
        this._moneyText = this.getText("txtMoney");
        this._hpBar = this.getProgressBar("progressHP");
        this._rollBtn = this.getButton("btnRoll");
    }

    protected bindEvents(): void {
        // 监听数据变化，自动更新UI
        Blackboard.instance.watch("playerMoney", (money) => {
            if (this._moneyText) {
                this._moneyText.text = this._formatMoney(money);
            }
        }, this);

        Blackboard.instance.watch("playerHP", (hp, maxHP) => {
            if (this._hpBar) {
                this._hpBar.value = (hp / maxHP) * 100;
            }
        }, this);
    }
}
```

### 3. 弹窗界面

```typescript
// 注册为窗口模式
UIManager.instance.registerUI("ConfirmDialog", {
    packageName: "Common",
    componentName: "ConfirmDialog",
    isWindow: true,    // 作为窗口显示
    modal: true        // 模态窗口
}, UIConfirmDialog);

// FairyGUI自动处理窗口显示逻辑
await UIManager.instance.showUI("ConfirmDialog");
```

## 🎨 FairyGUI功能利用

### 1. Controller控制状态

```typescript
protected onInit(): void {
    const stateCtrl = this.getController("ctrlState");
    if (stateCtrl) {
        stateCtrl.selectedIndex = 1; // 切换状态
        stateCtrl.onChanged(() => {
            console.log("状态改变:", stateCtrl.selectedPage);
        });
    }
}
```

### 2. Transition动画

```typescript
protected onShow(): void {
    const showAnim = this.getTransition("animShow");
    if (showAnim) {
        showAnim.play(); // 播放入场动画
    }
}

private _playHideAnimation(): Promise<void> {
    return new Promise((resolve) => {
        const hideAnim = this.getTransition("animHide");
        if (hideAnim) {
            hideAnim.play(() => resolve());
        } else {
            resolve();
        }
    });
}
```

### 3. 列表和虚拟列表

```typescript
protected onInit(): void {
    const list = this.getList("listItems");
    if (list) {
        list.itemRenderer = this._renderListItem.bind(this);
        list.setVirtual(); // 启用虚拟列表
        list.numItems = 1000; // 设置数据量
    }
}

private _renderListItem(index: number, item: fgui.GObject): void {
    const data = this._getItemData(index);
    const itemComp = item.asCom;
    itemComp.getChild("txtName").text = data.name;
    itemComp.getChild("imgIcon").url = data.iconUrl;
}
```

## 📊 性能优化

### 1. UI缓存

```typescript
// 频繁显示的UI启用缓存
UIManager.instance.registerUI("HUD", {
    packageName: "Game",
    componentName: "HUD",
    cache: true  // 缓存UI实例
}, UIInGame);
```

### 2. 包管理

```typescript
// 预加载常用包
await UILoader.preloadPackages(["Common", "Game"]);

// 及时卸载不用的包
UILoader.unloadPackage("Tutorial");
```

### 3. 事件清理

```typescript
protected unbindEvents(): void {
    // UIBase会自动清理EventBus和Blackboard监听
    super.unbindEvents();
    
    // 只需清理FairyGUI事件
    this._button?.offClick(this._onClick, this);
}
```

## 🐛 调试和诊断

```typescript
// 启用调试模式
initUISystem({ debug: true });

// 查看系统状态
console.log("活动UI:", UIManager.instance.getActiveUIs());
console.log("已加载包:", UILoader.getLoadedPackages());
console.log("事件系统:", EventBus.getDebugInfo());
console.log("数据系统:", Blackboard.instance.getDebugInfo());
```

## 🔄 与原系统对比

| 功能 | 原系统 | FairyGUI系统 |
|------|--------|-------------|
| UI组件 | 自定义UIButton/UIPanel/UIDialog | 使用FairyGUI原生组件 |
| UI基类 | 继承Component | 组合模式持有GComponent |
| 资源管理 | 手动Prefab加载 | UIPackage自动管理 |
| 动画系统 | Tween.js | FairyGUI Transition |
| 窗口管理 | 自定义层级 | FairyGUI Window系统 |
| 事件系统 | 保留EventBus | 保留+FairyGUI事件 |
| 数据绑定 | 保留Blackboard | 保留响应式绑定 |

## 🎯 最佳实践

1. **充分利用FairyGUI编辑器**设计UI，减少代码工作量
2. **合理组织包结构**，按功能模块分包
3. **使用组合模式**，不过度封装FairyGUI功能
4. **保留EventBus/Blackboard**，补充FairyGUI事件系统
5. **启用UI缓存**，优化频繁显示的界面
6. **及时清理事件**，避免内存泄漏

---

这个基于FairyGUI的UI系统既保持了FairyGUI的强大功能，又提供了便捷的管理层和事件系统，为Web3 Tycoon提供了专业的UI解决方案。