# Sui Manager 集成示例

本文档展示如何在 UI 中集成 SuiManager，实现游戏的完整流程。

## 架构总览

```
用户操作 → UI组件 → SuiManager → SignerProvider → Sui链
                          ↓
                    QueryService（查询）
                    GameInteraction（交互）
                    MapAdminInteraction（地图）
```

---

## 1. 游戏列表查询（ModeSelect → MapSelect）

### UIModeSelect: "开始游戏" 按钮

```typescript
import { SuiManager } from "../../sui/managers/SuiManager";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";

/**
 * 开始游戏按钮点击
 */
private async _onStartGameClick(): Promise<void> {
    console.log("[UIModeSelect] Start game clicked");

    try {
        // 1. 检查是否已连接钱包
        if (!SuiManager.instance.isConnected) {
            UINotification.warning("请先连接钱包");
            return;
        }

        // 2. 显示加载提示
        UINotification.info("正在查询可加入的游戏...");

        // 3. 查询可加入的游戏列表
        const games = await SuiManager.instance.getAvailableGames();

        console.log(`[UIModeSelect] Found ${games.length} available games`);

        // 4. 同时查询地图模板列表
        const mapTemplates = await SuiManager.instance.getMapTemplates();

        console.log(`[UIModeSelect] Found ${mapTemplates.length} map templates`);

        // 5. 显示地图选择界面，传入数据
        EventBus.emit(EventTypes.UI.ShowMapSelect, {
            availableGames: games,
            mapTemplates: mapTemplates,
            source: "mode_select"
        });

        // 6. 隐藏当前界面
        this.hide();

    } catch (error) {
        console.error("[UIModeSelect] Failed to query games:", error);
        UINotification.error("查询游戏列表失败");
    }
}
```

---

## 2. 显示游戏列表（UIMapSelect）

### UIMapSelect: 显示游戏列表

```typescript
import { SuiManager } from "../../sui/managers/SuiManager";
import type { Game } from "../../sui/types/game";

export class UIMapSelect extends UIBase {
    private m_availableGames: Game[] = [];
    private m_mapTemplates: { id: number; name: string }[] = [];
    private m_gameList: fgui.GList | null = null;
    private m_templateList: fgui.GList | null = null;

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIMapSelect] Showing map select UI");

        // 接收数据
        if (data) {
            this.m_availableGames = data.availableGames || [];
            this.m_mapTemplates = data.mapTemplates || [];
        }

        // 显示游戏列表
        this._displayGameList();

        // 显示地图模板列表
        this._displayTemplateList();
    }

    /**
     * 显示游戏列表
     */
    private _displayGameList(): void {
        if (!this.m_gameList) return;

        this.m_gameList.numItems = this.m_availableGames.length;

        for (let i = 0; i < this.m_availableGames.length; i++) {
            const game = this.m_availableGames[i];
            const item = this.m_gameList.getChildAt(i).asCom;

            // 设置游戏信息
            const titleText = item.getChild("title") as fgui.GTextField;
            if (titleText) {
                titleText.text = `游戏 #${i + 1} (${game.players.length}/${game.players.length} 人)`;
            }

            // 设置创建时间等信息
            const infoText = item.getChild("info") as fgui.GTextField;
            if (infoText) {
                infoText.text = `地图模板: ${game.template_map_id.slice(0, 8)}...`;
            }

            // 添加点击事件
            item.onClick(() => this._onGameItemClick(game), this);
        }
    }

    /**
     * 游戏项点击 - 加入游戏
     */
    private async _onGameItemClick(game: Game): Promise<void> {
        console.log(`[UIMapSelect] Join game clicked: ${game.id}`);

        try {
            // 显示加载提示
            UINotification.info("正在加入游戏...");

            // 调用 SuiManager 加入游戏
            const result = await SuiManager.instance.joinGame(game.id);

            console.log(`[UIMapSelect] Joined game, seat: ${result.seatId}, index: ${result.playerIndex}`);

            // 显示成功通知
            UINotification.success(`已加入游戏，玩家 #${result.playerIndex + 1}`);

            // 进入等待界面（等待其他玩家）
            EventBus.emit(EventTypes.UI.ShowWaitingRoom, {
                gameId: game.id,
                seatId: result.seatId,
                playerIndex: result.playerIndex
            });

            this.hide();

        } catch (error) {
            console.error("[UIMapSelect] Failed to join game:", error);
            UINotification.error("加入游戏失败");
        }
    }
}
```

---

## 3. 创建新游戏（UIMapSelect）

### UIMapSelect: "创建游戏" 按钮

```typescript
/**
 * 创建游戏按钮点击
 */
private async _onCreateGameClick(): Promise<void> {
    console.log("[UIMapSelect] Create game clicked");

    // 检查是否选择了地图模板
    if (!this.m_selectedTemplateId) {
        UINotification.warning("请先选择地图模板");
        return;
    }

    try {
        // 显示加载提示
        UINotification.info("正在创建游戏...");

        // 调用 SuiManager 创建游戏
        const result = await SuiManager.instance.createGame({
            template_map_id: this.m_selectedTemplateId,
            max_players: 4,
            starting_cash: 0n,      // 使用默认值
            price_rise_days: 0,     // 使用默认值
            max_rounds: 0           // 无限轮次
        });

        console.log(`[UIMapSelect] Game created: ${result.gameId}`);
        console.log(`[UIMapSelect] Seat: ${result.seatId}`);

        // 显示成功通知
        UINotification.success("游戏创建成功！");

        // 进入等待界面（等待其他玩家加入）
        EventBus.emit(EventTypes.UI.ShowWaitingRoom, {
            gameId: result.gameId,
            seatId: result.seatId,
            playerIndex: 0,  // 创建者是玩家 0
            isCreator: true
        });

        this.hide();

    } catch (error) {
        console.error("[UIMapSelect] Failed to create game:", error);
        UINotification.error("创建游戏失败");
    }
}
```

---

## 4. 开始游戏（UIWaitingRoom）

### UIWaitingRoom: "开始游戏" 按钮（创建者可见）

```typescript
/**
 * 开始游戏按钮点击
 */
private async _onStartGameClick(): Promise<void> {
    console.log("[UIWaitingRoom] Start game clicked");

    if (!this.m_gameId || !this.m_mapTemplateId) {
        UINotification.error("游戏信息缺失");
        return;
    }

    try {
        // 显示加载提示
        UINotification.info("正在开始游戏...");

        // 调用 SuiManager 开始游戏
        const result = await SuiManager.instance.startGame(
            this.m_gameId,
            this.m_mapTemplateId
        );

        console.log(`[UIWaitingRoom] Game started`);
        console.log(`[UIWaitingRoom] Starting player: ${result.startingPlayer}`);

        // 显示成功通知
        UINotification.success("游戏已开始！");

        // 进入游戏界面
        EventBus.emit(EventTypes.Game.GameStart, {
            gameId: this.m_gameId,
            mapId: this.m_mapTemplateId
        });

        this.hide();

    } catch (error) {
        console.error("[UIWaitingRoom] Failed to start game:", error);
        UINotification.error("开始游戏失败");
    }
}
```

---

## 5. 发布地图模板（UIEditor）

### UIEditor: "发布地图" 按钮

```typescript
import { SuiManager } from "../../sui/managers/SuiManager";
import type { MapTemplate } from "../../sui/types/map";

/**
 * 发布地图按钮点击
 */
private async _onPublishMapClick(): Promise<void> {
    console.log("[UIEditor] Publish map clicked");

    try {
        // 1. 检查是否已连接钱包
        if (!SuiManager.instance.isConnected) {
            UINotification.warning("请先连接钱包");
            return;
        }

        // 2. 构建地图模板数据
        const mapTemplate = this._buildMapTemplateFromEditor();

        // 3. 显示加载提示
        UINotification.info("正在上传地图模板到链上...");

        // 4. 调用 SuiManager 发布地图
        const result = await SuiManager.instance.publishMapTemplate(mapTemplate);

        console.log(`[UIEditor] Map template published`);
        console.log(`[UIEditor] Template ID: ${result.templateId}`);
        console.log(`[UIEditor] Tx Hash: ${result.txHash}`);

        // 5. 显示成功通知
        UINotification.success(`地图模板已发布！\nID: ${result.templateId}`);

    } catch (error) {
        console.error("[UIEditor] Failed to publish map:", error);
        UINotification.error("发布地图失败");
    }
}

/**
 * 从编辑器构建地图模板数据
 */
private _buildMapTemplateFromEditor(): MapTemplate {
    // 从 GameMap 获取当前地图数据
    const gameMap = this.getGameMap();

    // 转换为 MapTemplate 格式
    const template: MapTemplate = {
        id: Date.now(), // 临时 ID
        schema_version: 1,
        tiles_static: gameMap.tiles_static,
        buildings_static: gameMap.buildings_static,
        hospital_ids: gameMap.hospital_ids,
        // ... 其他字段
    };

    return template;
}
```

---

## 6. 完整流程示例

### 游戏创建和加入流程

```typescript
// 步骤 1: 用户连接钱包（UIWallet）
// → SuiManager.setWalletSigner(wallet, account)

// 步骤 2: 点击"开始游戏"（UIModeSelect）
const games = await SuiManager.instance.getAvailableGames();
// → 显示游戏列表（UIMapSelect）

// 步骤 3a: 选择已有游戏加入（UIMapSelect）
const {seatId, playerIndex} = await SuiManager.instance.joinGame(gameId);
// → 进入等待室（UIWaitingRoom）

// 步骤 3b: 创建新游戏（UIMapSelect）
const {gameId, seatId} = await SuiManager.instance.createGame(config);
// → 进入等待室（UIWaitingRoom）

// 步骤 4: 等待其他玩家，然后开始（UIWaitingRoom）
const result = await SuiManager.instance.startGame(gameId, mapTemplateId);
// → 进入游戏（UIInGame）
```

---

## 7. 错误处理建议

```typescript
/**
 * 统一的错误处理包装器
 */
private async _executeSuiAction<T>(
    actionName: string,
    action: () => Promise<T>
): Promise<T | null> {
    try {
        // 检查钱包连接
        if (!SuiManager.instance.isConnected) {
            UINotification.warning("请先连接钱包");
            return null;
        }

        // 显示加载提示
        UINotification.info(`${actionName}中...`);

        // 执行操作
        const result = await action();

        // 成功提示
        UINotification.success(`${actionName}成功！`);

        return result;

    } catch (error) {
        console.error(`[UI] ${actionName}失败:`, error);

        // 错误提示
        const errorMsg = (error as Error).message || "未知错误";
        UINotification.error(`${actionName}失败: ${errorMsg}`);

        return null;
    }
}

// 使用示例
private async _onJoinGameClick(gameId: string): Promise<void> {
    const result = await this._executeSuiAction(
        "加入游戏",
        () => SuiManager.instance.joinGame(gameId)
    );

    if (result) {
        // 处理成功结果
        this._navigateToWaitingRoom(result);
    }
}
```

---

## 8. 状态监听（可选）

### 监听钱包连接状态

```typescript
import { Blackboard } from "../../events/Blackboard";

/**
 * 初始化时监听钱包状态
 */
protected onInit(): void {
    // 监听钱包连接状态
    Blackboard.instance.watch("sui_wallet_connected", this._onWalletStateChange, this);
}

private _onWalletStateChange(connected: boolean): void {
    if (connected) {
        console.log("[UI] Wallet connected, address:", SuiManager.instance.currentAddress);
        this._enableGameFeatures();
    } else {
        console.log("[UI] Wallet disconnected");
        this._disableGameFeatures();
    }
}

/**
 * UIWallet 连接成功后通知全局
 */
// 在 UIWallet._onWalletItemClick 中添加：
Blackboard.instance.set("sui_wallet_connected", true, true);

// 在 UIWallet._onDisconnectClick 中添加：
Blackboard.instance.set("sui_wallet_connected", false, true);
```

---

## 9. 实时数据同步（可选）

### 使用事件索引器实时更新游戏状态

```typescript
import { TycoonEventIndexer } from "../../sui/events/indexer";
import { EventType } from "../../sui/events/types";

/**
 * UIWaitingRoom: 监听玩家加入事件
 */
private _eventIndexer: TycoonEventIndexer | null = null;

protected onShow(data?: any): void {
    // 启动事件监听
    this._eventIndexer = new TycoonEventIndexer({
        client: SuiManager.instance.client,
        packageId: SuiManager.instance.config.packageId,
        autoStart: true
    });

    // 监听玩家加入事件
    this._eventIndexer.on(EventType.PLAYER_JOINED, (event) => {
        console.log("[UIWaitingRoom] Player joined:", event.data);

        // 更新玩家列表 UI
        this._updatePlayerList();
    });

    // 监听游戏开始事件
    this._eventIndexer.on(EventType.GAME_STARTED, (event) => {
        console.log("[UIWaitingRoom] Game started:", event.data);

        // 进入游戏
        this._enterGame();
    });
}

protected onHide(): void {
    // 停止事件监听
    if (this._eventIndexer) {
        this._eventIndexer.stop();
        this._eventIndexer = null;
    }
}
```

---

## 10. 调试工具

### 在浏览器控制台中测试

```javascript
// 1. 查看 SuiManager 状态
window.game.sui = SuiManager.instance;
console.log("已连接:", window.game.sui.isConnected);
console.log("当前地址:", window.game.sui.currentAddress);

// 2. 手动查询游戏
const games = await window.game.sui.getAvailableGames();
console.log("可加入的游戏:", games);

// 3. 查看配置
console.log("配置:", window.game.sui.config);

// 4. 测试创建游戏
const result = await window.game.sui.createGame({
    template_map_id: "0x...",
    max_players: 4
});
console.log("创建结果:", result);
```

---

## 11. 关键注意事项

### ⚠️ 钱包连接检查

**所有与链交互的操作前，都要检查钱包连接：**

```typescript
if (!SuiManager.instance.isConnected) {
    UINotification.warning("请先连接钱包");
    return;
}
```

### ⚠️ 异步操作处理

**所有 SuiManager 的方法都是异步的，需要 await：**

```typescript
// ✅ 正确
const games = await SuiManager.instance.getAvailableGames();

// ❌ 错误
const games = SuiManager.instance.getAvailableGames(); // 返回 Promise，不是数组
```

### ⚠️ 交易失败处理

**钱包用户可能会拒绝签名，需要捕获异常：**

```typescript
try {
    await SuiManager.instance.createGame(config);
} catch (error) {
    // 用户可能点击了"取消"
    if (error.message.includes("User rejected")) {
        UINotification.info("操作已取消");
    } else {
        UINotification.error(`交易失败: ${error.message}`);
    }
}
```

---

## 12. 完整的 UIModeSelect 集成示例

```typescript
import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { SuiManager } from "../../sui/managers/SuiManager";
import { UINotification } from "../utils/UINotification";
import * as fgui from "fairygui-cc";

export class UIModeSelect extends UIBase {
    private m_btn_start: fgui.GButton;
    private m_btn_editor: fgui.GButton;

    protected onInit(): void {
        this._setupComponents();
    }

    private _setupComponents(): void {
        this.m_btn_start = this.getButton("btn_start");
        this.m_btn_editor = this.getButton("btn_editor");
    }

    protected bindEvents(): void {
        this.m_btn_start?.onClick(this._onStartClick, this);
        this.m_btn_editor?.onClick(this._onEditorClick, this);
    }

    /**
     * 开始游戏（进入地图选择）
     */
    private async _onStartClick(): Promise<void> {
        if (!SuiManager.instance.isConnected) {
            UINotification.warning("请先连接钱包");
            return;
        }

        try {
            UINotification.info("正在查询游戏列表...");

            const [games, templates] = await Promise.all([
                SuiManager.instance.getAvailableGames(),
                SuiManager.instance.getMapTemplates()
            ]);

            EventBus.emit(EventTypes.UI.ShowMapSelect, {
                availableGames: games,
                mapTemplates: templates
            });

            this.hide();

        } catch (error) {
            console.error("查询失败:", error);
            UINotification.error("查询游戏列表失败");
        }
    }

    /**
     * 地图编辑器
     */
    private _onEditorClick(): void {
        EventBus.emit(EventTypes.UI.ShowMapEditor);
        this.hide();
    }
}
```

---

## 总结

✅ **核心流程**：
1. 用户连接钱包 → SuiManager.setWalletSigner()
2. 查询游戏列表 → SuiManager.getAvailableGames()
3. 创建/加入游戏 → SuiManager.createGame() / joinGame()
4. 开始游戏 → SuiManager.startGame()
5. 发布地图 → SuiManager.publishMapTemplate()

✅ **所有操作统一通过 SuiManager**，无需直接操作 SuiClient 或 Wallet

✅ **完整的错误处理和用户提示**
