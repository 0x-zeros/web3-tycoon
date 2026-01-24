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

## 模块结构

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

部署后需要更新客户端配置文件中的 `profilesPackageId`：
- `env.mainnet.ts`
- `env.testnet.ts`
- `env.devnet.ts`
- `env.localnet.ts`

## 客户端集成

TypeScript 端使用 `ProfileService` 与合约交互：

```typescript
// 获取玩家档案
const profile = await ProfileService.instance.getPlayerProfile(address);

// 创建玩家档案
await ProfileService.instance.createPlayerProfile("Alice", 1);

// 更新玩家昵称
await ProfileService.instance.updatePlayerName(profileId, "Bob");
```

## 查询方式

| 类型 | 查询方式 | 说明 |
|------|---------|------|
| PlayerProfile | `getOwnedObjects` by address | owned object，直接通过地址查询 |
| GameProfile | 事件索引 + 对象查询 | shared object，需要先通过事件建立 game_id → profile_id 映射 |
| MapProfile | 事件索引 + 对象查询 | shared object，需要先通过事件建立 map_id → profile_id 映射 |

## 事件

用于客户端建立索引：

- `PlayerProfileCreatedEvent` - 玩家档案创建
- `PlayerProfileUpdatedEvent` - 玩家档案更新
- `GameProfileCreatedEvent` - 游戏档案创建
- `GameProfileUpdatedEvent` - 游戏档案更新
- `MapProfileCreatedEvent` - 地图档案创建
- `MapProfileUpdatedEvent` - 地图档案更新
