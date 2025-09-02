# 3D 游戏 UI 与系统通信设计文档（Cocos Creator + FairyGUI）

## 1️⃣ 核心设计原则
1. **低耦合、清晰分层**
   - UI 内部逻辑只处理交互和显示，不嵌入复杂业务逻辑。
   - 游戏主系统负责核心逻辑（GameManager、AudioManager、战斗系统等）。
2. **统一通信**
   - **直接调用**：核心逻辑接口。
   - **EventBus**：一次性事件 / 消息通知。
   - **Blackboard**：长期状态、UI 自动绑定数据。
3. **UI 系统集中管理**
   - UI Manager 负责加载、切换、层级管理、资源管理。
   - FairyGUI UI 控件通过 UI Root Script 处理内部交互。

---

## 2️⃣ 模块划分与职责

### 2.1 游戏主系统逻辑（GameManager 等）
- 核心逻辑与数据计算。
- 对外暴露接口供 UI 直接调用。
- 更新 Blackboard 数据（血量、金币、背包等）。
- 触发 EventBus 事件（玩家死亡、敌人击杀等）。

### 2.2 UI Manager（系统级）
- **职责**：
  1. UI 加载 / 卸载。
  2. UI 层级管理：Base / Panel / Overlay / System。
  3. 弹窗管理（MessageBox、Toast 等）。
  4. UI 资源缓存 / 释放策略（暂时全缓存）。
- **接口示例**：
```ts
UIManager.open(uiName: string, layer: UILayer): void
UIManager.close(uiName: string): void
UIManager.getUI<T>(uiName: string): T
```

### 2.3 UI Root Script（挂在 UI root node）
	•	职责：
	1.	控件事件处理（按钮、滑动条等）。
	2.	调用游戏逻辑接口（直接调用）。
	3.	发事件通知 EventBus（UI → 游戏逻辑 / UI → UI）。
	4.	监听 Blackboard 数据自动刷新 UI。
```ts
btnLogin.onClick(() => {
    EventBus.emitEvent(EventTypes.UI.LoginSubmit, { username, password });
});
Blackboard.watch("playerName", name => { nameLabel.text = name; }, this);
```

### 2.4 EventBus（全局事件系统）
	•	职责：
	•	事件发布 / 订阅机制，跨 UI 或逻辑模块通信。
	•	设计点：
	•	全局单例。
	•	支持参数传递。
	•	自动解绑目标，防止内存泄漏。
```ts


// EventBus.ts
import { EventTarget, _decorator, Component } from "cc";

class EventBusClass extends EventTarget {
    private static _instance: EventBusClass;
    public static get instance() {
        if (!this._instance) this._instance = new EventBusClass();
        return this._instance;
    }

    // 包一层 emit/on，方便扩展日志
    emitEvent<T>(event: string, arg?: T) {
        this.emit(event, arg);
    }

    onEvent<T>(event: string, callback: (arg: T) => void, target?: any) {
        this.on(event, callback, target);
    }

    offEvent<T>(event: string, callback: (arg: T) => void, target?: any) {
        this.off(event, callback, target);
    }
}

export const EventBus = EventBusClass.instance;




export const EventTypes = {
    UI: {
        StartGame: "ui_startGame",
        OpenBag: "ui_openBag"
    },
    Game: {
        PlayerDead: "game_playerDead",
        EnemyKilled: "game_enemyKilled"
    }
}


// 逻辑发事件
EventBus.emitEvent(EventTypes.Game.PlayerDead, { id: 123 });

// UI 监听
EventBus.onEvent<{ id: number }>(EventTypes.Game.PlayerDead, (data) => {
    console.log("敌人死亡:", data.id);
}, this);



```


### 2.5 blackboard 参考代码
```ts
// blackboard.ts
import { EventTarget } from "cc";

export class Blackboard extends EventTarget {
    private static _instance: Blackboard;
    public static get instance() {
        if (!this._instance) this._instance = new Blackboard();
        return this._instance;
    }

    private _data: Record<string, any> = {};

    set(key: string, value: any) {
        this._data[key] = value;
        this.emit(key, value);
    }

    get<T>(key: string): T {
        return this._data[key];
    }

    watch<T>(key: string, callback: (val: T) => void, target?: any) {
        this.on(key, callback, target);
    }
}


//使用
// 游戏逻辑
Blackboard.instance.set("playerHp", 80);

// UI
Blackboard.instance.watch<number>("playerHp", (hp) => {
    this.hpLabel.string = hp.toString();
}, this);

```

## fairygui 相关链接：

https://fairygui.com/

例子：
https://www.fairygui.com/cocos-demo/

sdk 源码和例子：
https://github.com/fairygui/FairyGUI-cocoscreator?utm_source=chatgpt.com


安装：
npm install --save fairygui-cc

