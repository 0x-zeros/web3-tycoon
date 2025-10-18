# UI系统开发笔记

## 核心技术要点

### 1. FairyGUI集成方案

**安装方式**：
```bash
npm install --save fairygui-cc
```

**重要提醒**：只有使用npm安装fairygui-cc成功，其他各种拷贝文件的方式都不行。

**核心设计理念**：
- 组合模式：UIBase持有`fgui.GComponent`引用，不继承
- 避免过度封装，直接使用FairyGUI原生API
- 保留EventBus和Blackboard补充FairyGUI功能

### 2. 系统架构设计

**模块划分**：
```
UI系统
├── UIManager - FairyGUI管理器（系统级）
├── UIBase - 组合模式基类
├── EventBus - 全局事件通信
├── Blackboard - 响应式数据绑定
└── UILoader - 包管理
```

**通信机制**：
- **直接调用**：核心逻辑接口
- **EventBus**：一次性事件/消息通知
- **Blackboard**：长期状态、UI自动绑定数据

### 3. 初始化问题解决

**问题**：编辑器预览模式下FairyGUI初始化失败
```
Error: Call GRoot.create first!
```

**解决方案**：
```typescript
private _initFairyGUI(): void {
    try {
        // 检查场景和Canvas是否准备好
        const scene = director.getScene();
        if (!scene) {
            throw new Error("场景未准备好，无法初始化FairyGUI");
        }
        
        const canvas = scene.getComponentInChildren(Canvas);
        if (!canvas) {
            throw new Error("场景中找不到Canvas组件，FairyGUI需要Canvas才能工作");
        }
        
        // 使用 try-catch 包装 GRoot.create()
        try {
            fgui.GRoot.create();
            this._groot = fgui.GRoot.inst;
        } catch (createError) {
            console.error("[UIManager] FairyGUI GRoot.create() failed:", createError);
            throw new Error(`FairyGUI GRoot.create() 失败: ${createError}`);
        }
    } catch (error) {
        console.error("[UIManager] FairyGUI初始化失败:", error);
        throw error;
    }
}
```

**关键要求**：
- 场景中必须有名为"Canvas"的节点
- 该节点必须包含Canvas组件
- 等待场景完全加载后再初始化

### 4. 输入事件冲突解决

**问题**：FairyGUI拦截了所有输入事件，3D系统无法接收

**解决方案**：UI3DInteractionManager事件转发
```typescript
@ccclass('UI3DInteractionManager')
export class UI3DInteractionManager extends Component {
    onEnable() {
        // 监听所有输入事件类型
        this.node.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    private shouldPassToScene(event): boolean {
        const target = GRoot.inst.touchTarget;
        // 点击到UI元素 = false，空白区域 = true
        return !target || target === GRoot.inst;
    }

    private emit3DInputEvent(eventType: string, originalEvent): void {
        const eventData: Input3DEventData = {
            type: eventType,
            screenX: pos.x, screenY: pos.y,
            originalEvent: originalEvent,
            timestamp: Date.now()
        };
        
        // 通过EventBus即时同步转发
        EventBus.emitEvent(eventType, eventData);
    }
}
```

**集成方式**：
```typescript
// 在UIManager._initFairyGUI()中集成
this._groot.node.addComponent(UI3DInteractionManager);
```

## 开发经验总结

### 1. 最佳实践

**UI设计**：
- 充分利用FairyGUI编辑器设计UI
- 合理组织包结构，按功能模块分包
- 使用Controller控制UI状态
- 使用Transition制作UI动画

**代码组织**：
- 使用组合模式，不过度封装FairyGUI功能
- 保留EventBus/Blackboard，补充FairyGUI事件系统
- 启用UI缓存，优化频繁显示的界面
- 及时清理事件，避免内存泄漏

### 2. 性能优化

**UI缓存**：
```typescript
// 频繁显示的UI启用缓存
UIManager.instance.registerUI("HUD", {
    packageName: "Game",
    componentName: "HUD",
    cache: true  // 缓存UI实例
}, UIInGame);
```

**包管理**：
```typescript
// 预加载常用包
await UILoader.preloadPackages(["Common", "Game"]);

// 及时卸载不用的包
UILoader.unloadPackage("Tutorial");
```

### 3. 常见问题

**初始化失败**：
- 确保场景中有名为"Canvas"的节点
- 确保Canvas节点包含Canvas组件
- 等待场景完全加载后再初始化

**输入事件冲突**：
- 使用UI3DInteractionManager转发事件
- 通过EventBus实现UI和3D系统通信
- 避免直接监听全局input事件

**内存泄漏**：
- 及时调用unbindEvents()清理事件
- 使用Blackboard的watch机制自动清理
- 合理使用UI缓存策略

### 4. 调试技巧

**启用调试模式**：
```typescript
initUISystem({ debug: true });
```

**查看系统状态**：
```typescript
console.log("活动UI:", UIManager.instance.getActiveUIs());
console.log("已加载包:", UILoader.getLoadedPackages());
console.log("事件系统:", EventBus.getDebugInfo());
console.log("数据系统:", Blackboard.instance.getDebugInfo());
```

## 技术架构对比

| 功能 | 原系统 | FairyGUI系统 |
|------|--------|-------------|
| UI组件 | 自定义UIButton/UIPanel/UIDialog | 使用FairyGUI原生组件 |
| UI基类 | 继承Component | 组合模式持有GComponent |
| 资源管理 | 手动Prefab加载 | UIPackage自动管理 |
| 动画系统 | Tween.js | FairyGUI Transition |
| 窗口管理 | 自定义层级 | FairyGUI Window系统 |
| 事件系统 | 保留EventBus | 保留+FairyGUI事件 |
| 数据绑定 | 保留Blackboard | 保留响应式绑定 |

## 参考资源

**官方文档**：
- FairyGUI官网：https://fairygui.com/
- Cocos Creator示例：https://www.fairygui.com/cocos-demo/
- GitHub源码：https://github.com/fairygui/FairyGUI-cocoscreator

**技术要点**：
- 使用npm安装fairygui-cc是唯一可靠方式
- 场景中必须有Canvas节点才能初始化
- 通过事件转发解决输入冲突问题
- 组合模式比继承模式更灵活

这套基于FairyGUI的UI系统既保持了FairyGUI的强大功能，又提供了便捷的管理层和事件系统，为项目提供了专业的UI解决方案。
