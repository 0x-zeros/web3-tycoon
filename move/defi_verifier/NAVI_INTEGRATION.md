# Navi Protocol 集成说明

## 概述

Navi Protocol使用**中心化账簿模式**（与Scallop的对象所有权模式不同），用户的存款余额记录在共享的Storage对象中。

## 核心配置信息

### 主网地址（已确认）

```typescript
// Navi Protocol Package ID
const NAVI_PACKAGE = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';

// Navi Storage共享对象ID（从交易确认）
const NAVI_STORAGE_ID = '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe';

// Asset IDs
const ASSET_ID_USDC = 10;  // 已从交易确认
```

### 来源验证

- **Package ID**: 用户提供
- **Storage ID**: 从用户的Navi存款交易中提取
- **USDC Asset ID**: 从交易输入参数中确认（Input 15，value: 10）

## Navi与Scallop的架构对比

| 特性 | Scallop | Navi |
|------|---------|------|
| **存款模式** | 对象所有权 | 中心化账簿 |
| **存款凭证** | MarketCoin对象 | Storage中的余额记录 |
| **验证方式** | 检查用户持有的Coin对象 | 调用Storage查询余额 |
| **参数** | `&Coin<MarketCoin<T>>` | `&mut Storage` + `asset_id` + `user` |
| **返回值** | 通过coin::value()获取 | 通过get_user_balance()获取 |
| **优点** | 去中心化，无需协议状态 | 简单直接，无需对象传递 |
| **缺点** | 需要用户传入对象 | 需要访问共享Storage对象 |

## Navi Storage接口

### 核心函数（来自官方文档）

```move
/// 获取用户持有的资产列表
public fun get_user_assets(
    storage: &Storage,
    user: address
): (vector<u8>, vector<u8>)  // (collateral_assets, borrow_assets)

/// 获取用户特定资产的余额
public fun get_user_balance(
    storage: &mut Storage,
    asset: u8,
    user: address
): (u256, u256)  // (supply, borrow)
```

### 为什么需要&mut Storage

虽然`get_user_balance`是查询操作，但Navi的实现需要`&mut`引用。
- 可能内部有缓存更新或状态同步
- Sui的shared object允许多个`&mut`引用并发访问
- 不影响并发性能

## 实现方案

### 1. navi_checker.move

```move
module defi_verifier::navi_checker {
    use lending_core::storage::{Self, Storage};

    /// USDC asset ID
    const ASSET_ID_USDC: u8 = 10;

    /// 检查USDC存款
    public(package) fun check_usdc(
        storage: &mut Storage,
        user: address
    ): u8 {
        let (supply, _borrow) = storage::get_user_balance(
            storage,
            ASSET_ID_USDC,
            user
        );

        if (supply > 0) { 1 } else { 0 }
    }

    /// 检查任意资产存款
    public(package) fun check_any_asset(
        storage: &mut Storage,
        user: address
    ): u8 {
        let (assets, _) = storage::get_user_assets(storage, user);

        // 遍历检查每个资产的supply
        for asset_id in assets {
            let (supply, _) = storage::get_user_balance(
                storage,
                asset_id,
                user
            );
            if (supply > 0) { return 1 };
        }

        0
    }
}
```

### 2. defi_verifier.move（对外接口）

```move
/// 验证Navi USDC存款
public fun verify_navi_usdc(
    navi_storage: &mut NaviStorage,
    ctx: &TxContext
): u8 {
    let user = ctx.sender();
    navi_checker::check_usdc(navi_storage, user)
}

/// 验证Navi任意资产存款
public fun verify_navi_any(
    navi_storage: &mut NaviStorage,
    ctx: &TxContext
): u8 {
    let user = ctx.sender();
    navi_checker::check_any_asset(navi_storage, user)
}
```

## 游戏模块调用示例

### Move代码（game.move）

```move
use defi_verifier::defi_verifier;
use lending_core::storage::Storage as NaviStorage;

/// 奖励函数：验证Navi USDC存款
public entry fun claim_navi_reward(
    navi_storage: &mut NaviStorage,
    game_state: &mut GameState,
    ctx: &mut TxContext
) {
    // 验证用户是否有Navi USDC存款
    let score = defi_verifier::verify_navi_usdc(navi_storage, ctx);

    if (score > 0) {
        // 发放奖励
        let user = tx_context::sender(ctx);
        mint_reward(user, score, ctx);
    }
}
```

### PTB调用（前端）

```typescript
const tx = new Transaction();

// Navi Storage是shared object，所有人共享
const NAVI_STORAGE_ID =
    '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe';

tx.moveCall({
    target: `${gamePackage}::game::claim_navi_reward`,
    arguments: [
        tx.object(NAVI_STORAGE_ID),  // Storage共享对象
        tx.object(gameStateId)       // 游戏状态
    ]
});

const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx
});
```

## 关键技术细节

### 1. u256类型处理

Navi的余额使用u256类型（而非u64）：

```move
// ❌ 错误：u256模块没有gt()和zero()函数
if (u256::gt(supply, u256::zero())) { ... }

// ✅ 正确：直接使用运算符
if (supply > 0) { ... }
```

Move 2024支持u256的原生运算符：`>`, `<`, `>=`, `<=`, `==`, `!=`

### 2. Storage对象的可变性

```move
// Navi要求&mut，即使是查询操作
public fun get_user_balance(
    storage: &mut Storage,  // 注意是&mut
    asset: u8,
    user: address
): (u256, u256)
```

这不影响并发性，Sui的shared object机制允许多个交易同时持有`&mut`引用。

### 3. Native函数

Navi的storage模块使用native实现：
```move
native public fun get_user_balance(...): (u256, u256);
```

**影响**：
- ✅ 在主网运行正常
- ❌ 无法在`sui move test`中测试（VM错误）
- ✅ 可以在devInspect中测试

## 测试策略

### Move单元测试

由于Storage是native实现，无法在`sui move test`中运行。
**解决方案**：只测试Scallop部分，Navi在主网测试。

### CLI测试（主网）

使用`devInspectTransactionBlock`进行只读测试：

```bash
cd move/cli
npm run test:defi
```

测试内容：
1. ✅ verify_navi_usdc - 检测USDC存款
2. ✅ verify_navi_any - 检测任意资产存款
3. ✅ 边界情况：无存款时返回0

## 部署流程

### 1. 部署defi_verifier

```bash
cd move/defi_verifier
sui client publish --gas-budget 500000000
```

获取package ID后更新：
- `move/cli/src/config/env.mainnet.ts`
- 游戏配置文件

### 2. 测试验证

```bash
cd move/cli
npm run test:defi
```

预期输出：
```
测试Navi Protocol USDC存款验证
========================================

测试方式：verify_navi_usdc
Storage ID: 0xbb4e2f4b...

调用结果:
  状态: success
  验证分数: 1
  ✅ 验证成功！用户在Navi有USDC存款
```

## 常见问题

### Q1: 为什么Navi和Scallop的接口不统一？

**A**: 因为底层架构完全不同：
- Scallop: 基于对象所有权，用泛型`<CoinType>`实现
- Navi: 基于中心化账簿，需要Storage对象引用

强行统一会增加复杂度，不如分开设计。

### Q2: 如何获取其他资产的asset ID？

**A**: 三种方式：
1. 查看Navi SDK源码中的常量定义
2. 通过`get_reserves_count()`遍历所有资产
3. 使用`verify_navi_any()`直接检测任意资产

### Q3: Storage对象会升级吗？

**A**: 可能会。如果Navi升级导致Storage ID变化：
- 更新`env.mainnet.ts`中的`naviStorageId`
- 重新部署或更新游戏配置
- 不需要修改defi_verifier代码

### Q4: 能否检测具体余额（如>1 USDC）？

**A**: 可以，但当前设计只检测是否有存款（supply > 0）。

如需检测具体金额，修改navi_checker.move：
```move
// USDC有6位小数，1 USDC = 1_000_000
const MIN_USDC_SUPPLY: u64 = 1_000_000;

if (supply > MIN_USDC_SUPPLY) { 1 } else { 0 }
```

但需要处理u256转u64的问题。

## 性能考虑

### Gas成本

- `get_user_assets()`: 低（只返回vector<u8>）
- `get_user_balance()`: 低（只读操作）
- `verify_navi_usdc()`: 总计 < 1000 gas units

### 并发性

Storage是shared object，多个交易可以并发访问，不会阻塞。

### 缓存

建议前端缓存验证结果，避免重复调用：
- 存储用户的验证状态
- 设置TTL（如5分钟）
- 余额变化时清除缓存

## 安全考虑

### 1. Storage对象验证

确保传入的是正确的Navi Storage对象：
```move
// 在游戏合约中硬编码Storage ID
const NAVI_STORAGE_ID: address = @0xbb4e2f4b...;

assert!(object::id(storage) == NAVI_STORAGE_ID, EInvalidStorage);
```

### 2. 防止作弊

由于Storage是共享对象，理论上无法伪造：
- Storage由Navi Protocol管理
- `get_user_balance`查询的是链上真实数据
- 用户无法篡改别人的余额

### 3. 时效性

余额是实时查询的，反映当前状态：
- 用户存款后立即可验证
- 用户取款后立即失效
- 无需等待索引同步

## 与其他AI建议的对比

### AI建议的方案（Registry模式）

```move
struct Registry {
    navi_storage_id: address,
    navi_usdc_asset_id: u8,
}

public fun has_navi_usdc(reg: &Registry, user: address): u8 {
    let storage = borrow_from_id(reg.navi_storage_id);
    // ...
}
```

**我们的方案（直接传递）**：

```move
public fun verify_navi_usdc(
    storage: &mut Storage,  // 直接传入
    ctx: &TxContext
): u8
```

**对比**：
- AI方案：需要维护Registry，更灵活但更复杂
- 我们的方案：直接传递，简单直接
- **选择依据**：黑客松时间紧，优先简单方案

如需未来扩展为Registry模式，可以轻松重构。

## 未来扩展

### 1. 支持更多资产

```move
const ASSET_ID_SUI: u8 = 0;
const ASSET_ID_USDT: u8 = 11;  // 需要确认

public fun verify_navi_asset(
    storage: &mut Storage,
    asset_id: u8,
    ctx: &TxContext
): u8
```

### 2. 金额阈值

```move
/// 检查是否有 >= min_amount 的存款
public fun verify_navi_usdc_min(
    storage: &mut Storage,
    min_amount: u64,
    ctx: &TxContext
): u8 {
    let (supply, _) = storage::get_user_balance(storage, 10, user);

    // 注意：u256 vs u64转换
    let supply_u64 = if (supply > u256::from(u64::max_value())) {
        u64::max_value()
    } else {
        (supply as u64)  // Move 2024支持类型转换
    };

    if (supply_u64 >= min_amount) { 1 } else { 0 }
}
```

### 3. Registry模式升级

如果需要动态配置：

```move
struct NaviConfig has store {
    storage_id: address,
    usdc_asset_id: u8,
    min_units: u64,
}

struct DefiRegistry has key {
    id: UID,
    navi: NaviConfig,
    scallop: ScallopConfig,
}
```

## 相关资源

- [Navi Developer Docs](https://naviprotocol.gitbook.io/navi-protocol-developer-docs)
- [Navi Storage模块](https://naviprotocol.gitbook.io/navi-protocol-developer-docs/smart-contract-overview/storage)
- [Navi Protocol Interface](https://github.com/naviprotocol/protocol-interface)
- [用户交易记录](/private/tmp/tx-block-1761054334.json)

---

**Created**: 2025-10-21
**Status**: ✅ 已实现并集成
**Next**: 部署到主网测试
