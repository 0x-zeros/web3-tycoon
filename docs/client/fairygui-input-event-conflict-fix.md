# FairyGUI与3D输入事件冲突修复备忘录

## 问题描述

**现象**：在Cocos Creator中加入FairyGUI以后，其他地方的代码完全接收不到`input.on`的mouse、touch全局事件了。

---
**技术原因**：
#### 以下是claude的分析，我自己是还没有找到确定性的原因。有空再说，终于有个能用的方案了
- FairyGUI的GRoot节点被添加到Canvas下，成为高优先级的输入事件接收者
- FairyGUI的InputProcessor在GRoot.node上注册了所有输入事件监听器
- 通过`evt.preventSwallow = false`机制阻止事件继续传播到Cocos的全局`input`系统
- 结果：任何`input.on(Input.EventType.MOUSE_DOWN/TOUCH_START, callback)`都无法收到回调



## 成功的解决方案 ✅

### 架构设计：UI3DInteractionManager

**核心思路**：在FairyGUI的GRoot.node上监听事件，通过EventBus转发给3D系统。

#### 1. 事件流程
```
用户输入 → GRoot.node → UI3DInteractionManager
    ↓ shouldPassToScene()判断  
    ├─ UI元素 → FairyGUI处理
    └─ 空白区域 → EventBus.emitEvent() (即时同步)
                    ↓
                VoxelInteractionManager.onInput3DEvent()
```

#### 2. 关键实现

**UI3DInteractionManager.ts**:
```typescript
@ccclass('UI3DInteractionManager')
export class UI3DInteractionManager extends Component {
    @property({ tooltip: "启用内置射线检测功能" })
    enableBuiltinRaycast: boolean = true;

    onEnable() {
        // 监听所有输入事件类型
        this.node.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        // ... 其他6种事件类型
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
            uiX: uiPos.x, uiY: uiPos.y,
            button: event.getButton(),
            originalEvent: originalEvent,
            timestamp: Date.now()
        };
        
        // 通过EventBus即时同步转发
        EventBus.emitEvent(eventType, eventData);
    }
}
```

**VoxelInteractionManager.ts**:
```typescript
protected onEnable() {
    // 不再直接监听input.on，改为监听EventBus
    EventBus.onEvent(EventTypes.Input3D.MouseDown, this.onInput3DMouseDown, this);
    EventBus.onEvent(EventTypes.Input3D.TouchStart, this.onInput3DTouchStart, this);
}

private onInput3DMouseDown(eventData: Input3DEventData): void {
    // 转换为原有逻辑进行处理
    const originalEvent = eventData.originalEvent as EventMouse;
    this.onMouseDown(originalEvent);
}
```

#### 3. 集成方式
```typescript
// 在UIManager._initFairyGUI()中集成
this._groot.node.addComponent(UI3DInteractionManager);
```

## 技术优势

### ✅ 完整性
- 支持所有8种输入事件类型（MOUSE 4种 + TOUCH 4种）
- 同时支持PC端和移动端

### ✅ 即时性  
- EventBus基于Cocos的EventTarget，同步执行无延迟
- 事件链路短：UI → EventBus → 3D系统

### ✅ 扩展性
- 其他3D系统可监听相同的Input3D事件
- 内置射线检测可选开启（enableBuiltinRaycast）
- 完整的调试日志系统

### ✅ 兼容性
- 保持FairyGUI原有功能不变
- 保持3D系统原有逻辑不变
- 通过事件系统解耦，互不干扰

## 核心经验教训

1. **FairyGUI的事件拦截是在node层面**，不是全局input层面
2. **preventSwallow机制无法绕过**，必须在更高层面处理
3. **EventBus转发是最优解**：简单、可靠、可扩展
4. **架构解耦的重要性**：UI系统和3D系统应该通过事件通信

## 相关文件

- `assets/scripts/ui/events/UI3DInteractionManager.ts` - 核心转发组件
- `assets/scripts/ui/events/EventTypes.ts` - 3D输入事件定义  
- `assets/scripts/voxel/interaction/VoxelInteractionManager.ts` - 3D交互处理
- `assets/scripts/ui/core/UIManager.ts` - UI管理器集成

---

**修复日期**: 2025年1月
**状态**: ✅ 已解决
**测试状态**: 通过PC端鼠标和移动端触摸测试





## 失败的修复方案（参考）

### 方案1：设置GRoot属性 ❌
```typescript
// 尝试设置GRoot不可触摸
GRoot.inst.touchable = false;
// 或设置面板透明
panel.opaque = false;
```
**结果**：所有地方点击都显示"透传"日志，但3D场景的`input.on`仍无法收到事件。

### 方案2：替换InputProcessor._captureCallback ❌ 
```typescript
inputProcessor._captureCallback = (evt) => {
    if (shouldPassThrough(target)) {
        return; // 不处理，期望透传
    }
    originalCapture.call(this, evt);
};
```
**结果**：仍然无法透传到全局input系统，事件在InputProcessor层被完全拦截。

### 方案3：重写事件处理方法并手动派发 ❌
```typescript
inputProcessor.touchBeginHandler = function(evt) {
    if (shouldPassThrough(target)) {
        evt.preventSwallow = true;
        // 手动创建Cocos事件重新派发
        const cocosEvent = new EventMouse(Input.EventType.MOUSE_DOWN);
        input._emitEvent(cocosEvent);
    }
};
```
**结果**：复杂度高，兼容性差，且无法保证所有事件类型覆盖。