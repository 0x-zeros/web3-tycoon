# DeFi奖励调试指南

## 错误信息

```
CommandArgumentError { arg_idx: 0, kind: TypeMismatch } in command 2
```

**含义**：PTB的第2个命令（verify_scallop_with_proof）的第0个参数（coin对象）类型不匹配

---

## 可能原因

### 1. Coin对象ID不正确

**检查**：查看控制台是否有这些日志：
```
[DefiReward] Scallop查询结果: 1 个coin
  Coin ID: 0x5beafa8f...
  Balance: 91882
  Type: 0x854950aa...::scallop_usdc::SCALLOP_USDC
```

如果Balance是0或没找到coin，就会导致错误。

---

### 2. 钱包地址不一致

**问题**：游戏中使用的钱包地址 ≠ 存DeFi的钱包地址

**检查**：
```typescript
// 在浏览器控制台运行
const session = window.Blackboard?.instance.get('currentGameSession');
const userAddr = session?.getMyPlayer()?.owner;
console.log('游戏中的地址:', userAddr);

// 对比存DeFi的地址
// Scallop: 0x6e6c6885e780bbfd7c81b6b3849b45881305e3ecd08340a32fef3b5f3a619be7
// Navi:    0x14eb69e6750667f87465cd2986c34ac2c4e7f863cf3bc68835c860d4c715a377
```

---

### 3. getAllCoins返回的对象已过期

**问题**：查询到的Coin ID在构造PTB和签名之间被合并或消耗了

**解决**：在PTB构造前立即查询，不要缓存

---

## 调试方案

### 方案A：检查实际数据

在`buildActivateDefiRewardsTx`开始添加：

```typescript
console.log('[DefiReward] === 开始构造PTB ===');
console.log('  Game ID:', gameId);
console.log('  User:', userAddress);

// 检查存款状态
const status = await this.checkDefiDeposits(userAddress);
console.log('[DefiReward] 存款状态:', status);

// 如果有Scallop，验证Coin对象
if (status.scallopCoinId) {
    try {
        const coinObj = await this.client.getObject({
            id: status.scallopCoinId,
            options: { showType: true, showContent: true }
        });
        console.log('[DefiReward] Scallop Coin对象:', coinObj);
    } catch (e) {
        console.error('[DefiReward] Coin对象查询失败:', e);
    }
}
```

### 方案B：分步测试

**先只测试Navi**（注释掉Scallop部分）：

```typescript
// 构造Scallop奖励调用
if (false && status.hasScallopDeposit && status.scallopCoinId) {  // 暂时禁用
    // ...
}
```

看Navi单独是否能成功。

### 方案C：使用devInspect预检查

在signAndExecute前：

```typescript
// 添加devInspect检查
tx.setSender(userAddress);
const dryRun = await this.client.devInspectTransactionBlock({
    sender: userAddress,
    transactionBlock: tx
});

console.log('[DefiReward] DevInspect结果:', dryRun);

if (dryRun.effects.status.status === 'failure') {
    console.error('[DefiReward] PTB验证失败:', dryRun.effects.status.error);
    throw new Error(`PTB无效: ${dryRun.effects.status.error}`);
}
```

---

## 快速修复建议

**立即尝试**：

### 1. 先只激活Navi

暂时禁用Scallop验证，看Navi是否能成功：

```typescript
// defi_rewards.ts 第121行
if (false) {  // 临时改为false
    // Scallop部分
}
```

### 2. 检查coinObjectId是否正确

添加验证：

```typescript
if (status.hasScallopDeposit && status.scallopCoinId) {
    // 验证对象存在
    try {
        await this.client.getObject({ id: status.scallopCoinId });
    } catch (e) {
        console.error('[DefiReward] Scallop Coin不存在:', status.scallopCoinId);
        // 跳过Scallop
        continue;
    }

    // 构造调用...
}
```

---

## 需要你提供的信息

1. **完整的控制台日志**（特别是有Scallop Coin ID的那部分）
2. **你当前使用的钱包地址**
3. **是否只测试Navi能成功？**（先禁用Scallop试试）

我根据日志帮你精确定位问题！