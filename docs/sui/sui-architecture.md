# Sui 交互架构文档

本文档详细说明 Sui 交互模块的架构设计和实现原理。

---

## 🎯 设计目标

1. **统一签名接口**：支持 Wallet 和 Keypair 两种签名方式
2. **解耦 UI 层**：UI 只调用 SuiManager，不直接操作 SuiClient
3. **智能查询**：实现游戏列表的过滤、排序逻辑
4. **类型安全**：完整的 TypeScript 类型定义
5. **易于扩展**：新增功能只需扩展交互类

---

## 🏗️ 架构层次

### Layer 1: 签名器抽象层

**目的：**统一 Wallet 和 Keypair 两种签名方式

```typescript
interface SignerProvider {
    getAddress(): string;
    signAndExecuteTransaction(tx, client): Promise<SuiTransactionBlockResponse>;
    getType(): 'wallet' | 'keypair';
}
```

**实现：**
- `WalletSigner`: 使用浏览器钱包扩展（Suiet, Sui Wallet 等）
- `KeypairSigner`: 使用本地密钥对（测试用）

**优势：**
- UI 代码无需关心签名实现
- Wallet 和 Keypair 可以无缝切换
- 支持所有 Wallet Standard 兼容的钱包

---

### Layer 2: 交互构建层

**目的：**构建交易对象，不直接执行

```typescript
class GameInteraction {
    // 新方法：返回 Transaction
    buildCreateGameTx(config, senderAddress): Transaction
    buildJoinGameTx(gameId, senderAddress): Transaction
    buildStartGameTx(gameId, mapTemplateId): Transaction

    // 旧方法：直接签名执行（已弃用）
    async createGame(config, keypair): Promise<{gameId, seatId}>
}
```

**关键变化：**
- ✅ 新方法：`build*Tx()` 返回 Transaction 对象
- ⚠️ 旧方法：保持兼容但标记为 `@deprecated`

**优势：**
- Transaction 可以被任何 SignerProvider 签名
- 支持批量交易（未来功能）
- 更好的可测试性

---

### Layer 3: 查询服务层

**目的：**封装链上数据查询逻辑

```typescript
class QueryService {
    async getGameData(): Promise<GameData>
    async getReadyGames(myAddress?, limit?): Promise<GameListItem[]>
    async getMapTemplates(): Promise<{id, name}[]>
    async getGame(gameId): Promise<Game | null>
}
```

**查询策略：**
1. 通过事件查询（GameCreatedEvent, MapTemplatePublishedEvent）
2. 提取对象 ID
3. 获取对象详情
4. 过滤和解析

**优势：**
- 封装复杂查询逻辑
- 统一错误处理
- 支持缓存（未来）

---

### Layer 4: 统一管理层

**目的：**提供高级 API，管理所有 Sui 交互

```typescript
class SuiManager {
    // 生命周期
    async init(config)

    // 签名器管理
    setWalletSigner(wallet, account)
    clearSigner()

    // 高级 API
    async createGame(config)
    async joinGame(gameId)
    async getAvailableGames()
    async publishMapTemplate(mapTemplate)

    // 状态
    get isConnected: boolean
    get currentAddress: string | null
}
```

**职责：**
1. 初始化所有子服务（QueryService, GameClient, MapAdmin）
2. 管理签名器生命周期
3. 提供高级 API（封装查询 + 交互）
4. 统一日志和错误处理

---

## 🔄 数据流

### 创建游戏流程

```
UI (UIModeSelect)
    ↓
SuiManager.createGame(config)
    ↓
GameInteraction.buildCreateGameTx(config, address)
    ↓ 返回 Transaction
SuiManager.signAndExecuteTransaction(tx)
    ↓
SignerProvider.signAndExecuteTransaction(tx, client)
    ↓
WalletSigner → 弹出钱包确认窗口
    ↓ 用户确认
Sui 链执行交易
    ↓
返回 SuiTransactionBlockResponse
    ↓
SuiManager 解析结果（提取 gameId, seatId）
    ↓ 返回
UI 获取结果
```

### 查询游戏列表流程

```
UI (UIModeSelect)
    ↓
SuiManager.getAvailableGames()
    ↓
QueryService.getReadyGames(myAddress, limit)
    ↓
client.queryEvents({ MoveEventType: GameCreatedEvent })
    ↓ 获取所有 GameCreatedEvent
提取 gameId 列表
    ↓
Promise.all(gameIds.map(id => client.getObject(id)))
    ↓ 获取所有 Game 对象
过滤 status === STATUS_READY
    ↓
标记 isMyCreation（第一个玩家是自己）
    ↓
返回 GameListItem[]
    ↓
SuiManager 排序（自己创建的优先，按时间降序）
    ↓
返回前 6 个
    ↓
UI 显示游戏列表
```

---

## 📐 设计模式

### 1. 单例模式（SuiManager）

```typescript
class SuiManager {
    private static _instance: SuiManager | null = null;

    public static get instance(): SuiManager {
        if (!SuiManager._instance) {
            SuiManager._instance = new SuiManager();
        }
        return SuiManager._instance;
    }

    private constructor() {}
}
```

**原因：**
- 全局唯一，避免重复创建 SuiClient
- 保持签名器状态
- 便于全局访问

### 2. 策略模式（SignerProvider）

```typescript
interface SignerProvider {
    signAndExecuteTransaction(tx, client): Promise<Result>
}

// 不同的签名策略
class WalletSigner implements SignerProvider { ... }
class KeypairSigner implements SignerProvider { ... }
```

**原因：**
- 运行时切换签名方式
- 符合开闭原则
- 易于测试

### 3. 门面模式（SuiManager）

SuiManager 作为门面，隐藏底层复杂性：

```typescript
// UI 只需要简单调用
const games = await SuiManager.instance.getAvailableGames();

// 内部封装了：
// 1. QueryService.getReadyGames()
// 2. 过滤 STATUS_READY
// 3. 标记 isMyCreation
// 4. 排序
// 5. 限制数量
```

**原因：**
- 简化 UI 代码
- 统一接口
- 便于维护

---

## 🔍 关键实现细节

### 1. getAvailableGames() 排序逻辑

```typescript
games.sort((a, b) => {
    // 优先级1: 自己创建的游戏
    if (a.isMyCreation && !b.isMyCreation) return -1;
    if (!a.isMyCreation && b.isMyCreation) return 1;

    // 优先级2: 创建时间（降序，最新的在前）
    return b.createdAt - a.createdAt;
});

// 只返回前 6 个
return games.slice(0, 6);
```

**逻辑：**
1. 自己创建的游戏永远排在第一位
2. 其他游戏按创建时间降序（最新的在前）
3. 最多返回 6 个游戏

### 2. 交易结果解析

```typescript
// 从 objectChanges 中提取对象 ID
private _extractObjectId(result, objectType: string): string {
    const changes = result.objectChanges || [];
    for (const change of changes) {
        if (change.type === 'created' && change.objectType?.includes(objectType)) {
            return change.objectId;
        }
    }
    throw new Error(`Failed to extract ${objectType} ID`);
}

// 从 events 中提取数据
private _extractPlayerIndex(result): number {
    const events = result.events || [];
    for (const event of events) {
        if (event.type.includes('PlayerJoinedEvent')) {
            return event.parsedJson?.player_index || 0;
        }
    }
    return 0;
}
```

### 3. 事件查询与过滤

```typescript
// QueryService.getReadyGames()
const response = await this.client.queryEvents({
    query: {
        MoveEventType: `${this.packageId}::events::GameCreatedEvent`
    },
    limit: 50,
    order: 'descending'  // 最新的在前
});

// 提取 gameId 并获取详情
for (const event of response.data) {
    const gameId = event.parsedJson.game;
    const game = await this.getGame(gameId);

    // 过滤状态
    if (game.status !== GameStatus.READY) continue;

    games.push({
        game,
        objectId: gameId,
        createdAt: Number(event.timestampMs),
        isMyCreation: game.players[0]?.owner === myAddress
    });
}
```

---

## 🧪 测试策略

### 单元测试

```typescript
// 测试 SignerProvider
describe('WalletSigner', () => {
    it('should sign transaction with wallet', async () => {
        const mockWallet = createMockWallet();
        const signer = new WalletSigner(mockWallet, account);

        const tx = new Transaction();
        const result = await signer.signAndExecuteTransaction(tx, client);

        expect(result.digest).toBeDefined();
    });
});
```

### 集成测试

```typescript
// 测试完整流程
describe('Game Creation Flow', () => {
    it('should create game and join', async () => {
        // 1. 初始化
        await SuiManager.instance.init(config);

        // 2. 设置签名器
        SuiManager.instance.setKeypairSigner(keypair);

        // 3. 创建游戏
        const {gameId} = await SuiManager.instance.createGame(config);
        expect(gameId).toBeTruthy();

        // 4. 查询游戏
        const games = await SuiManager.instance.getAvailableGames();
        expect(games.length).toBeGreaterThan(0);
    });
});
```

---

## 📝 最佳实践

### 1. UI 集成

```typescript
// ✅ 推荐：统一错误处理
private async _executeSuiAction<T>(
    actionName: string,
    action: () => Promise<T>
): Promise<T | null> {
    if (!SuiManager.instance.isConnected) {
        UINotification.warning("请先连接钱包");
        return null;
    }

    try {
        UINotification.info(`${actionName}中...`);
        const result = await action();
        UINotification.success(`${actionName}成功！`);
        return result;
    } catch (error) {
        console.error(`${actionName}失败:`, error);
        UINotification.error(`${actionName}失败`);
        return null;
    }
}
```

### 2. 状态管理

```typescript
// ✅ 推荐：使用 Blackboard 同步钱包状态
// UIWallet 中
Blackboard.instance.set("sui_wallet_connected", true, true);
Blackboard.instance.set("sui_current_address", address, true);

// 其他 UI 中
Blackboard.instance.watch("sui_wallet_connected", (connected) => {
    this._updateUIState(connected);
});
```

### 3. 配置管理

```typescript
// ✅ 推荐：环境配置分离
// config/env.localnet.ts
export const SuiEnvConfig = {
    packageId: '0x...',
    gameData: '0x...',
    network: 'localnet'
};

// config/env.testnet.ts
export const SuiEnvConfig = {
    packageId: '0x...',
    gameData: '0x...',
    network: 'testnet'
};

// config/index.ts（切换配置）
import { SuiEnvConfig } from '../../config/env.localnet';
// import { SuiEnvConfig } from '../../config/env.testnet';
```

---

## 🔧 扩展指南

### 添加新的游戏交互

**步骤 1: 在 GameInteraction 中添加方法**

```typescript
// interactions/game.ts
buildMyActionTx(gameId: string, param: string): Transaction {
    const tx = new Transaction();

    tx.moveCall({
        target: `${this.packageId}::game::my_action`,
        arguments: [
            tx.object(gameId),
            tx.pure.string(param)
        ]
    });

    return tx;
}
```

**步骤 2: 在 SuiManager 中添加高级 API**

```typescript
// managers/SuiManager.ts
public async myAction(gameId: string, param: string): Promise<{txHash: string}> {
    this._ensureInitialized();
    this._ensureSigner();

    this._log('[SuiManager] Executing my action...');

    const tx = this._gameClient!.game.buildMyActionTx(gameId, param);
    const result = await this.signAndExecuteTransaction(tx);

    return { txHash: result.digest };
}
```

**步骤 3: 在 UI 中使用**

```typescript
// ui/game/UIInGame.ts
private async _onMyActionClick(): Promise<void> {
    try {
        const result = await SuiManager.instance.myAction(gameId, "test");
        UINotification.success("操作成功");
    } catch (error) {
        UINotification.error("操作失败");
    }
}
```

---

## 📊 性能优化

### 1. 查询缓存（未来）

```typescript
class QueryService {
    private _gameCache: Map<string, {game: Game, timestamp: number}> = new Map();

    async getGame(gameId: string): Promise<Game | null> {
        // 检查缓存
        const cached = this._gameCache.get(gameId);
        if (cached && Date.now() - cached.timestamp < 5000) {
            return cached.game;
        }

        // 查询并缓存
        const game = await this._fetchGame(gameId);
        this._gameCache.set(gameId, {game, timestamp: Date.now()});
        return game;
    }
}
```

### 2. 批量查询

```typescript
// 并行查询多个游戏
const games = await Promise.all(
    gameIds.map(id => queryService.getGame(id))
);
```

### 3. 事件监听优化

```typescript
// 使用 WebSocket 实时监听（未来）
class TycoonEventIndexer {
    private ws: WebSocket;

    async subscribeToGame(gameId: string): void {
        // 订阅特定游戏的事件
        this.ws.send(JSON.stringify({
            method: 'suix_subscribeEvent',
            params: {
                filter: { game: gameId }
            }
        }));
    }
}
```

---

## ⚠️ 已知限制

### 1. 查询性能

**问题：**通过事件查询所有游戏可能较慢

**解决方案：**
- 使用索引器服务（如 Sui Indexer）
- 实现服务端缓存
- 限制查询数量（目前限制 50 个）

### 2. 游戏状态同步

**问题：**链上状态变化无法实时通知客户端

**解决方案：**
- 使用事件轮询（TycoonEventIndexer）
- 实现 WebSocket 订阅（未来）
- 定时刷新游戏状态

### 3. AdminCap 管理

**问题：**地图发布需要 AdminCap，但普通用户没有

**解决方案：**
- 检查用户是否拥有 AdminCap
- UI 中隐藏发布功能（普通用户）
- 或使用后端代理发布

---

## 🚀 未来优化

### 1. 批量交易支持

```typescript
// 构建批量交易
const tx = new Transaction();
const tx1 = gameInteraction.buildRollAndStepTx(...);
const tx2 = gameInteraction.buildEndTurnTx(...);

// 合并交易
tx.add(tx1);
tx.add(tx2);

// 一次性签名执行
await SuiManager.instance.signAndExecuteTransaction(tx);
```

### 2. 交易队列

```typescript
class TransactionQueue {
    private queue: Transaction[] = [];

    add(tx: Transaction): void {
        this.queue.push(tx);
    }

    async execute(): Promise<void> {
        // 批量执行所有交易
        for (const tx of this.queue) {
            await SuiManager.instance.signAndExecuteTransaction(tx);
        }
        this.queue = [];
    }
}
```

### 3. 离线签名

```typescript
// 构建交易
const tx = gameInteraction.buildCreateGameTx(config, address);

// 序列化交易
const txBytes = await tx.build({ client });

// 用户离线签名
const signature = await wallet.signTransaction(txBytes);

// 后续提交
await client.executeTransactionBlock({ transactionBlock: txBytes, signature });
```

---

## 📚 参考资料

- [Sui Wallet Standard](https://docs.sui.io/standards/wallet-standard)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Sui Transaction Building](https://sdk.mystenlabs.com/typescript/transaction-building)
- [集成示例](./INTEGRATION_EXAMPLE.md)

---

## 🎓 学习路径

1. **了解基础**：阅读 `types/` 下的类型定义
2. **学习交互**：阅读 `interactions/` 下的交互类
3. **掌握查询**：阅读 `services/QueryService.ts`
4. **实践集成**：参考 `INTEGRATION_EXAMPLE.md`
5. **深入架构**：阅读本文档

---

## 💡 常见问题

### Q: 为什么需要 SignerProvider？

A: 因为 Wallet 和 Keypair 的签名方式不同：
- Wallet：调用 `wallet.features['sui:signAndExecuteTransaction']`
- Keypair：调用 `client.signAndExecuteTransaction({ signer: keypair })`

SignerProvider 统一了这两种方式。

### Q: 为什么交互类要返回 Transaction 而不是直接执行？

A: 为了支持多种签名方式：
- 返回 Transaction 后，可以由任何 SignerProvider 签名
- 支持批量交易
- 支持离线签名

### Q: 为什么要有 TycoonGameClient？

A: 为了组织交互类：
- `gameClient.game.*` - 游戏交互
- `gameClient.turn.*` - 回合交互
- `gameClient.property.*` - 地产交互
- `gameClient.card.*` - 卡牌交互

### Q: QueryService 为什么通过事件查询？

A: 因为 Sui 没有内置的"查询所有某类型对象"的方法：
- 只能通过事件查询历史
- 或通过 Dynamic Fields 查询（需要特定结构）
- 或使用第三方索引器服务

---

## 📈 版本历史

### v2.0.0（当前）
- ✅ 添加 SuiManager 统一管理
- ✅ 实现 SignerProvider 抽象
- ✅ 重构交互类返回 Transaction
- ✅ 添加 QueryService 查询服务
- ✅ 实现 getAvailableGames 智能排序
- ✅ 集成 UIWallet 自动设置签名器

### v1.0.0
- ✅ 基础类型定义
- ✅ GameInteraction, TurnInteraction 等
- ✅ 事件索引器
- ✅ TycoonGameClient

---

## 👥 贡献指南

添加新功能时，请遵循以下原则：

1. **类型优先**：在 `types/` 中定义类型
2. **交互分离**：在 `interactions/` 中构建交易
3. **统一入口**：在 `SuiManager` 中提供高级 API
4. **文档完善**：更新 README 和示例

---

**文档最后更新：2025-10-06**
