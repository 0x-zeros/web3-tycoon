# Sui 交互模块

完整的 Sui 链上交互管理系统，支持钱包签名和查询服务。

## 📁 文件结构

```
sui/
├── config/                  # 配置管理
│   ├── SuiConfig.ts        # 配置接口和工具
│   └── index.ts            # 加载 env.localnet.ts
│
├── signers/                # 签名器抽象
│   ├── SignerProvider.ts  # 统一签名接口
│   ├── WalletSigner.ts    # 浏览器钱包签名（推荐）
│   ├── KeypairSigner.ts   # 本地密钥对签名（测试）
│   └── index.ts
│
├── managers/               # 核心管理器
│   ├── SuiManager.ts      # 统一管理器（单例）
│   └── index.ts
│
├── services/               # 查询服务
│   ├── QueryService.ts    # 链上数据查询
│   └── index.ts
│
├── interactions/           # 交互封装
│   ├── game.ts            # 游戏交互（create/join/start）
│   ├── turn.ts            # 回合交互（roll/step）
│   ├── mapAdmin.ts        # 地图管理（publish）
│   └── index.ts
│
├── types/                  # 类型定义（对应Move端的struct）
│   ├── constants.ts        # 所有常量（对应types.move）
│   ├── game.ts            # Game相关类型（对应game.move）
│   ├── map.ts             # Map相关类型（对应map.move）
│   ├── cards.ts           # Card相关类型（对应cards.move）
│   ├── admin.ts           # Admin相关类型（对应admin.move）
│   └── index.ts           # 统一导出
│
├── events/                 # 事件索引
│   ├── indexer.ts         # 事件监听器
│   ├── types.ts           # 事件类型
│   └── aggregated.ts      # 聚合事件
│
├── utils/                  # 工具函数
│   └── mapBcsEncoder.ts   # BCS 编码
│
├── pathfinding/           # 路径查找
│   ├── MapGraph.ts
│   ├── BFSPathfinder.ts
│   └── PathChoiceGenerator.ts
│
├── INTEGRATION_EXAMPLE.md  # 集成示例文档
└── README.md              # 本文件
```

## 🚀 快速开始

### 新架构（推荐使用）

```typescript
import { SuiManager } from '@/scripts/sui/managers/SuiManager';
import { UINotification } from '@/scripts/ui/utils/UINotification';

// 1. 初始化（GameInitializer 中自动完成）
// await SuiManager.instance.init(CURRENT_SUI_CONFIG, { debug: true });

// 2. 连接钱包（UIWallet 中自动完成）
// SuiManager.instance.setWalletSigner(wallet, account);

// 3. 查询可加入的游戏
const games = await SuiManager.instance.getAvailableGames();
console.log(`找到 ${games.length} 个可加入的游戏`);

// 4. 创建游戏
const {gameId, seatId} = await SuiManager.instance.createGame({
    template_map_id: '0x...',
    max_players: 4
});
console.log(`游戏创建成功: ${gameId}`);

// 5. 加入游戏
const {seatId, playerIndex} = await SuiManager.instance.joinGame(gameId);
console.log(`已加入游戏，玩家 #${playerIndex}`);

// 6. 开始游戏
await SuiManager.instance.startGame(gameId, mapTemplateId);
console.log("游戏已开始");

// 7. 发布地图
const {templateId} = await SuiManager.instance.publishMapTemplate(mapTemplate);
console.log(`地图发布成功，ID: ${templateId}`);
```

### 旧 API（仍然可用）

```typescript
import { TycoonGameClient } from '@/scripts/sui';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// 使用 Keypair 直接签名
const client = TycoonGameClient.create({
    network: 'testnet',
    packageId: '0x...',
    gameDataId: '0x...'
});

const keypair = Ed25519Keypair.generate();
const result = await client.game.createGame(config, keypair);
```

---

## 🏗️ 架构设计

### 统一签名接口

```
SignerProvider (接口)
    ├── WalletSigner       → 浏览器钱包扩展（推荐）
    └── KeypairSigner      → 本地密钥对（测试）
```

**优势：**
- UI 代码无需关心签名实现细节
- 可以无缝切换签名方式
- 支持 Wallet Standard 的所有钱包

### 交互层设计

```
UI 层
  ↓ 调用
SuiManager（高级 API）
  ↓ 使用
├── QueryService（查询）
├── GameInteraction（游戏交互）
├── MapAdminInteraction（地图管理）
└── SignerProvider（签名）
  ↓ 执行
Sui 链
```

### SuiManager 核心功能

```typescript
class SuiManager {
    // === 初始化 ===
    async init(config: SuiConfig)

    // === 签名器管理 ===
    setWalletSigner(wallet, account)
    setKeypairSigner(keypair)
    clearSigner()

    // === 游戏交互 ===
    async createGame(config): Promise<{gameId, seatId}>
    async joinGame(gameId): Promise<{seatId, playerIndex}>
    async startGame(gameId, mapTemplateId)

    // === 查询服务 ===
    async getAvailableGames(): Promise<Game[]>
    async getMapTemplates()
    async getGameData()

    // === 地图管理 ===
    async publishMapTemplate(mapTemplate)

    // === 状态访问 ===
    get isConnected: boolean
    get currentAddress: string | null
    get currentSeat: Seat | null
}
```

---

## 📊 类型系统

### 常量定义
所有常量都在 `types/constants.ts` 中定义，与Move端完全对齐：

```typescript
import { TileKind, NpcKind, CardKind, BuffKind } from '@/scripts/sui';

// 地块类型
TileKind.PROPERTY  // 地产
TileKind.HOSPITAL  // 医院
TileKind.CHANCE    // 机会

// NPC类型
NpcKind.BARRIER    // 路障
NpcKind.BOMB       // 炸弹
NpcKind.DOG        // 狗

// 特殊常量
NO_OWNER = 255     // 无主（u8 max）
NO_PROPERTY = 65535 // 非地产（u16 max）
```

### 核心数据结构

#### Tile/Property分离架构
最新的Move端采用了Tile和Property分离的架构：
- **Tile**: 纯导航节点，只包含NPC信息
- **Property**: 经济实体，包含owner和level

```typescript
// 地块（导航用）
interface Tile {
    npc_on: number;  // 只有NPC信息
}

// 地产（经济实体）
interface Property {
    owner: number;   // NO_OWNER=255表示无主
    level: number;   // 0-5级
}
```

## 🎯 事件系统

支持两种事件类型：

### 基础事件
```typescript
import { EventType, GameCreatedEvent } from '@/scripts/sui';

// 监听游戏创建
client.on(EventType.GAME_CREATED, (event: GameCreatedEvent) => {
    console.log('游戏创建:', event.game);
});
```

### 聚合事件
```typescript
import { RollAndStepActionEvent } from '@/scripts/sui';

// 掷骰移动的完整事件
const result = await client.turn.rollAndStep(gameId, seatId, [], keypair);
const event: RollAndStepActionEvent = result.event;

// 分析移动路径
for (const step of event.steps) {
    console.log(`步骤 ${step.step_index}: ${step.from_tile} -> ${step.to_tile}`);

    if (step.npc_event) {
        console.log(`遇到NPC: ${step.npc_event.kind}`);
    }

    if (step.stop_effect) {
        console.log(`停留效果: ${step.stop_effect.stop_type}`);
    }
}
```

## 🛣️ 路径选择

对于有分叉的地图，需要提供路径选择：

```typescript
import { PathChoiceGenerator, MapGraph } from '@/scripts/sui';

// 创建地图图结构
const mapGraph = new MapGraph(mapTemplate);

// 生成路径选择
const generator = new PathChoiceGenerator(mapGraph);
const pathChoices = generator.generatePathChoices(
    currentPos,
    diceValue,
    direction
);

// 提交选择
await client.turn.rollAndStep(
    gameId,
    seatId,
    pathChoices, // [tile1, tile2, ...]
    keypair
);
```

## 🔧 管理功能

发布地图模板（需要AdminCap）：

```typescript
const templateId = await client.admin.publishMapTemplate(
    adminCapId,
    {
        name: "测试地图",
        description: "8格测试地图",
        tiles: [...],           // 地块定义
        properties: [...],       // 地产定义
        starting_tile: 0,
        min_players: 2,
        max_players: 4
    },
    keypair
);
```

## 📝 注意事项

1. **网络配置**: 确保正确配置了`packageId`和`gameDataId`
2. **Gas费用**: 所有交易需要支付Gas费用，确保账户有足够的SUI
3. **类型安全**: 所有类型都与Move端严格对应，使用TypeScript获得完整的类型检查
4. **向后兼容**: 保留了旧的导出以确保兼容性，后续可以逐步迁移

## 🔄 迁移指南

如果你在使用旧的API，可以按以下方式迁移：

```typescript
// 旧代码
import { TycoonEventIndexer } from '@/scripts/sui';

// 新代码
import { createTycoonClient } from '@/scripts/sui';
const client = createTycoonClient(config);
```

旧的API仍然可用，但建议尽快迁移到新的结构化API。