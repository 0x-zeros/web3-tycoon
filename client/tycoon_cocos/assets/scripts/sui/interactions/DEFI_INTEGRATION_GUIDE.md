# DeFi奖励前端集成指南

## 已完成的工作

### 1. 配置文件
- ✅ `sui/config/DefiConfig.ts` - DeFi协议配置

### 2. 交互类
- ✅ `sui/interactions/defi_rewards.ts` - DefiRewardInteraction类

### 3. 事件定义
- ✅ `events/EventTypes.ts` - 添加DeFi奖励事件

### 4. UI按钮
- ✅ `ui/game/UIInGame.ts` - 添加btn_defiReward按钮处理

---

## 待集成部分（GameSession或SuiManager）

需要在负责区块链交互的管理类中监听`EventTypes.Game.ClaimDefiReward`事件。

### 示例代码

```typescript
import { DefiRewardInteraction, initDefiRewardInteraction } from '../sui/interactions/defi_rewards';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';

export class GameSession {
    private defiRewardInteraction: DefiRewardInteraction | null = null;

    async init() {
        // 初始化DeFi交互模块
        await initDefiRewardInteraction();

        this.defiRewardInteraction = new DefiRewardInteraction(
            this.suiClient,
            this.tycoonPackageId
        );

        // 监听DeFi奖励事件
        this.bindDefiRewardEvents();
    }

    private bindDefiRewardEvents(): void {
        EventBus.on(EventTypes.Game.ClaimDefiReward, this._onClaimDefiReward, this);

        // UI更新监听
        EventBus.on(EventTypes.Game.DefiRewardActivated, this._onDefiRewardActivated, this);
        EventBus.on(EventTypes.Game.DefiRewardFailed, this._onDefiRewardFailed, this);
    }

    /**
     * 处理DeFi奖励领取请求
     */
    private async _onClaimDefiReward(data: any): Promise<void> {
        console.log('[GameSession] 处理DeFi奖励领取');

        try {
            // 1. 获取当前游戏和用户信息
            const gameId = this.currentGameId;
            const userAddress = this.currentUserAddress;

            if (!gameId || !userAddress) {
                throw new Error('游戏未开始或用户未连接');
            }

            // 2. 构造DeFi奖励交易
            const result = await this.defiRewardInteraction!.buildActivateDefiRewardsTx(
                gameId,
                userAddress
            );

            console.log(`[GameSession] DeFi PTB构造成功，包含协议: ${result.protocols.join(', ')}`);

            // 3. 签名并执行交易
            const txResult = await this.suiClient.signAndExecuteTransaction({
                signer: this.keypair,  // 或使用钱包签名
                transaction: result.tx,
                options: {
                    showEvents: true,
                    showEffects: true,
                    showObjectChanges: true
                }
            });

            console.log('[GameSession] DeFi奖励激活成功:', txResult.digest);

            // 4. 解析事件
            const events = txResult.events || [];
            const rewardEvents = events.filter(e =>
                e.type.includes('::defi_rewards::DefiRewardActivated')
            );

            // 5. 提取奖励信息
            let totalCash = 0;
            const protocols: string[] = [];
            let alreadyActivated = false;

            for (const event of rewardEvents) {
                const json = event.parsedJson as any;
                totalCash += json.cash_rewarded || 0;

                // 解码protocol名称（vector<u8> → string）
                const protocolBytes = json.protocol;
                const protocolName = new TextDecoder().decode(new Uint8Array(protocolBytes));
                protocols.push(protocolName);

                if (json.already_activated) {
                    alreadyActivated = true;
                }
            }

            // 6. 触发成功事件
            EventBus.emit(EventTypes.Game.DefiRewardActivated, {
                txDigest: txResult.digest,
                totalCash,
                protocols,
                multiplier: 150,
                alreadyActivated,
                events: rewardEvents
            });

        } catch (error) {
            console.error('[GameSession] DeFi奖励激活失败:', error);

            // 触发失败事件
            EventBus.emit(EventTypes.Game.DefiRewardFailed, {
                error: error.message || error.toString(),
                timestamp: Date.now()
            });
        }
    }

    /**
     * DeFi奖励激活成功
     */
    private _onDefiRewardActivated(data: any): void {
        console.log('[GameSession] DeFi奖励激活成功');

        // 显示成功提示
        const { totalCash, protocols, alreadyActivated } = data;

        let message = '';
        if (alreadyActivated) {
            message = 'DeFi奖励已激活过';
        } else if (totalCash > 0) {
            message = `DeFi奖励激活成功！\n+${totalCash} Cash\n+1.5x收益加成\n协议：${protocols.join(', ')}`;
        }

        if (message) {
            this.showToast(message);
        }

        // 刷新游戏状态（cash和buff已更新）
        this.refreshGameState();

        // 恢复按钮（通过事件通知UI）
        EventBus.emit('defi_reward_button_enable', {});
    }

    /**
     * DeFi奖励激活失败
     */
    private _onDefiRewardFailed(data: any): void {
        console.error('[GameSession] DeFi奖励激活失败:', data.error);

        let message = 'DeFi奖励激活失败';

        // 解析错误类型
        if (data.error.includes('未发现DeFi存款')) {
            message = '未检测到DeFi存款\n请先在Scallop或Navi存入USDC';
        } else if (data.error.includes('EPlayerNotInGame')) {
            message = '请先加入游戏';
        }

        this.showToast(message);

        // 恢复按钮
        EventBus.emit('defi_reward_button_enable', {});
    }
}
```

---

## UIInGame监听按钮恢复事件

```typescript
// 在bindEvents()中添加：
EventBus.on('defi_reward_button_enable', this._onDefiRewardButtonEnable, this);

// 在unbindEvents()中添加：
EventBus.off('defi_reward_button_enable', this._onDefiRewardButtonEnable, this);

// 添加处理函数：
private _onDefiRewardButtonEnable(): void {
    if (this._defiRewardBtn) {
        this._defiRewardBtn.enabled = true;
    }
}
```

---

## FairyGUI界面配置

需要在FairyGUI编辑器中：

1. **打开InGame包**
2. **在主界面添加按钮**：
   - 名称：`btn_defiReward`
   - 文本：`DeFi奖励`
   - 位置：建议放在右上角或底部功能区
   - 样式：可以添加钱币图标

3. **导出资源**到Cocos项目

---

## PTB调用流程

```
用户点击btn_defiReward
    ↓
UIInGame._onDefiRewardClick()
    ↓ emit ClaimDefiReward
GameSession._onClaimDefiReward()
    ↓
DefiRewardInteraction.checkDefiDeposits()  [检查Navi+Scallop存款]
    ↓
DefiRewardInteraction.buildActivateDefiRewardsTx()  [构造PTB]
    ↓ 包含：
    ├─ verify_navi_with_proof → activate_navi_reward
    └─ verify_scallop_with_proof → activate_scallop_reward
    ↓
signAndExecuteTransaction()  [签名并执行]
    ↓
解析DefiRewardActivated事件
    ↓ emit
UI更新 [显示+2000 cash, 1.5x buff图标]
```

---

## 调试建议

### 1. 控制台输出

每个步骤都有console.log，方便调试：
```
[UIInGame] DeFi Reward button clicked
[GameSession] 处理DeFi奖励领取
[DefiReward] 检测到Navi存款
[DefiReward] 检测到Scallop存款
[DefiReward] PTB构造完成，包含协议: Navi, Scallop
[GameSession] DeFi奖励激活成功: <txDigest>
```

### 2. 错误处理

常见错误及处理：
- `未发现DeFi存款` → 提示用户去Scallop/Navi存款
- `EPlayerNotInGame` → 提示先加入游戏
- `ENoNaviDeposit` → Navi无存款（但Scallop可能有）
- 网络错误 → 提示重试

### 3. 测试检查清单

- [ ] 按钮在FairyGUI中正确显示
- [ ] 点击按钮触发事件
- [ ] DevInspect检查成功
- [ ] PTB构造正确
- [ ] 交易执行成功
- [ ] 事件正确解析
- [ ] UI正确更新（+2000 cash, buff图标）
- [ ] 重复点击正确处理（已激活提示）

---

## 下一步

1. **在FairyGUI中添加btn_defiReward按钮**
2. **在GameSession/SuiManager中实现事件监听**（参考上面示例）
3. **测试完整流程**

---

**Status**: 前端代码框架已完成，等待FairyGUI按钮配置和GameSession集成
