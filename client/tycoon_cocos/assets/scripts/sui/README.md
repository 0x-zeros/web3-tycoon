# Sui集成模块

这是Web3 Tycoon游戏的Sui区块链集成模块，完全对应Move端的合约结构。

## 📁 文件结构

```
sui/
├── types/                    # 类型定义（对应Move端的struct）
│   ├── constants.ts         # 所有常量（对应types.move）
│   ├── game.ts             # Game相关类型（对应game.move）
│   ├── map.ts              # Map相关类型（对应map.move）
│   ├── cards.ts            # Card相关类型（对应cards.move）
│   ├── admin.ts            # Admin相关类型（对应admin.move）
│   └── index.ts            # 统一导出
│
├── events/                  # 事件系统
│   ├── types.ts            # 基础事件类型（对应events.move）
│   └── aggregated.ts       # 聚合事件类型（RollAndStepActionEvent等）
│
├── interactions/           # 链交互封装
│   ├── game.ts            # 游戏操作（create、join、start等）
│   ├── turn.ts            # 回合操作（roll_and_step、end_turn等）
│   └── index.ts           # 包含property、cards、admin交互
│
├── pathfinding/           # 路径查找（保持现有）
│   ├── MapGraph.ts
│   ├── BFSPathfinder.ts
│   └── PathChoiceGenerator.ts
│
└── index.ts              # 主入口，统一导出
```

## 🎮 快速开始

```typescript
import { createTycoonClient, TileKind, CardKind } from '@/scripts/sui';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// 1. 创建客户端
const client = createTycoonClient({
    network: 'testnet',
    packageId: '0xYOUR_PACKAGE_ID',
    gameDataId: '0xGAME_DATA_ID'
});

// 2. 准备密钥对
const keypair = Ed25519Keypair.generate();

// 3. 创建游戏
const { gameId, seatId } = await client.game.createGame({
    template_id: 1,
    max_players: 4,
    starting_cash: 100000n
}, keypair);

// 4. 加入游戏
const joinResult = await client.game.joinGame(gameId, keypair);

// 5. 开始游戏
await client.game.startGame(gameId, seatId, keypair);

// 6. 游戏操作
// 掷骰移动
await client.turn.rollAndStep(gameId, seatId, [], keypair);

// 购买地产
await client.property.buyProperty(gameId, seatId, keypair);

// 使用卡牌
await client.card.useCard(
    gameId,
    seatId,
    CardKind.MOVE_CTRL,
    [6], // 参数：骰子点数为6
    keypair
);

// 结束回合
await client.turn.endTurn(gameId, seatId, keypair);
```

## 📊 类型系统

### 常量定义
所有常量都在 `types/constants.ts` 中定义，与Move端完全对齐：

```typescript
import { TileKind, NpcKind, CardKind, BuffKind } from '@/scripts/sui';

// 地块类型
TileKind.PROPERTY  // 地产
TileKind.HOSPITAL  // 医院
TileKind.PRISON    // 监狱

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