# tycoon_profiles Move Package

链上元数据存储系统，用于存储玩家、游戏、地图的展示信息。

## 概述

本包替代了原有的 Cloudflare Workers + KV 方案，将实体档案存储在 Sui 链上。

## 数据结构

### PlayerProfile (owned object)
```move
public struct PlayerProfile has key, store {
    id: UID,
    name: String,      // 昵称 (1-32 字符)
    avatar: u8,        // 头像索引 (0-255)
}
```
- 通过 object 所有权关联钱包地址
- 每个钱包最多一个 PlayerProfile

### GameProfile (shared object)
```move
public struct GameProfile has key, store {
    id: UID,
    game_id: ID,       // 关联的 Game 对象 ID
    creator: address,  // 创建者（用于权限验证）
    name: String,      // 游戏名称 (1-64 字符)
}
```

### MapProfile (shared object)
```move
public struct MapProfile has key, store {
    id: UID,
    map_id: ID,        // 关联的 MapTemplate 对象 ID
    creator: address,  // 创建者
    name: String,      // 地图名称 (1-64 字符)
    description: String, // 描述 (0-256 字符)
}
```

### ProfileRegistry (shared object)
```move
public struct ProfileRegistry has key {
    id: UID,
    game_profiles: Table<ID, ID>,  // game_id -> GameProfile ID
    map_profiles: Table<ID, ID>,   // map_id -> MapProfile ID
}
```
- 用于免 gas 的 O(1) 查询
- 客户端通过 `getDynamicFieldObject` RPC 查询 Table 内容

## 模块结构

- `registry.move` - ProfileRegistry（全局索引表）
- `player_profile.move` - PlayerProfile CRUD
- `game_profile.move` - GameProfile CRUD
- `map_profile.move` - MapProfile CRUD
- `events.move` - 事件定义（用于客户端索引）

## 使用方式

### 编译和测试
```bash
cd move/tycoon_profiles
sui move build
sui move test
```

### 部署
```bash
sui client publish --gas-budget 500000000
```

部署后需要更新客户端配置文件：
- `env.mainnet.ts`
- `env.testnet.ts`
- `env.devnet.ts`
- `env.localnet.ts`

需要配置的字段：
- `profilesPackageId` - tycoon_profiles 合约 Package ID
- `profilesRegistryId` - ProfileRegistry shared object ID

## 客户端集成

TypeScript 端使用 `ProfileService` 与合约交互：

```typescript
// 初始化（需要 registryId 用于免 gas 查询）
ProfileService.instance.initialize(packageId, registryId);

// 获取玩家档案
const profile = await ProfileService.instance.getPlayerProfile(address);

// 创建玩家档案
await ProfileService.instance.createPlayerProfile("Alice", 1);

// 创建游戏档案（需要传入 Registry）
await ProfileService.instance.createGameProfile(gameId, "My Game");

// 创建地图档案（需要传入 Registry）
await ProfileService.instance.createMapProfile(mapId, "My Map", "Description");
```

## 查询方式

| 类型 | 查询方式 | 说明 |
|------|---------|------|
| PlayerProfile | `getOwnedObjects` by address | owned object，直接通过地址查询 |
| GameProfile | Registry（优先）/ 事件回填 | 先查 Registry Table，未命中则事件回填 |
| MapProfile | Registry（优先）/ 事件回填 | 先查 Registry Table，未命中则事件回填 |

### Registry 查询流程（免 gas，O(1)）

```typescript
// 查询顺序：缓存 → 内存索引 → Registry → 事件回填
public async getGameProfile(gameId: string): Promise<GameProfile | null> {
    // 1. 检查缓存
    // 2. 检查内存索引
    // 3. 尝试 Registry 查询（免 gas，O(1)）
    // 4. 回退：事件回填（最后手段）
    // 5. 获取完整 Profile
}
```

Registry 查询使用 Sui RPC 的 `getDynamicFieldObject`：
```typescript
const result = await client.getDynamicFieldObject({
    parentId: gameProfilesTableId,
    name: {
        type: '0x2::object::ID',
        value: gameId
    }
});
```

## 事件

用于客户端建立索引（事件回填作为 Registry 查询的降级方案）：

- `PlayerProfileCreatedEvent` - 玩家档案创建
- `PlayerProfileUpdatedEvent` - 玩家档案更新
- `GameProfileCreatedEvent` - 游戏档案创建
- `GameProfileUpdatedEvent` - 游戏档案更新
- `MapProfileCreatedEvent` - 地图档案创建
- `MapProfileUpdatedEvent` - 地图档案更新

## 方案对比

| 方案 | 查询成本 | 查询复杂度 | 上限限制 |
|------|---------|-----------|---------|
| 事件回填（旧） | 免费 | O(n) 遍历 | 5000 条 |
| **Registry + Dynamic Fields** | **免费** | **O(1)** | **无** |
