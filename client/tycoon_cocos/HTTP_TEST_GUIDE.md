# HTTP层测试指南

## 快速测试步骤

### 方法1：浏览器控制台测试（推荐）

1. **在Cocos Creator中运行游戏**
   - 打开Cocos Creator 3.8.7
   - 打开项目：`client/tycoon_cocos`
   - 按F5预览游戏

2. **打开浏览器开发者工具**
   - 按F12打开控制台
   - 切换到Console标签页

3. **运行测试命令**

   ```javascript
   // 完整测试（包括玩家、游戏房间、缓存）
   await window.testMetadata()

   // 单独测试HTTP客户端
   await window.testHttp()

   // 单独测试缓存管理器
   await window.testCache()
   ```

4. **查看测试结果**
   - 控制台会显示详细的测试过程和结果
   - ✅ 表示测试通过
   - ❌ 表示测试失败

### 方法2：手动API调用测试

在控制台中直接调用API：

```javascript
// 获取元数据服务
const service = window.game.initializer.getMetadataService()

// 创建玩家
const player = await service.createOrUpdatePlayer('0xtest', {
    nickname: '我的昵称',
    bio: '我的简介'
})
console.log(player)

// 获取玩家
const p = await service.getPlayer('0xtest')
console.log(p)

// 创建游戏房间
const game = await service.createGameRoom({
    gameId: '0xgame123',
    roomName: '我的游戏房间',
    description: '房间描述',
    hostAddress: '0xtest',
    tags: ['测试']
})
console.log(game)

// 列出游戏房间
const games = await service.listGameRooms({ status: 'waiting' })
console.log(games)
```

### 方法3：检查缓存功能

```javascript
// 获取缓存管理器
const cache = window.game.initializer.getCacheManager()

// 查看缓存统计
console.log(cache.getStats())

// 清除玩家缓存
cache.clearPlayerCache('0xtest')

// 清除所有元数据缓存
cache.clearAllCache()
```

## 预期结果

### testMetadata() 测试输出示例

```
=== 开始测试元数据服务 ===

📝 测试1：创建玩家...
✅ 创建玩家成功: {address: "0x12345...", nickname: "测试玩家", ...}

📝 测试2：获取玩家...
✅ 获取玩家成功: {address: "0x12345...", nickname: "测试玩家", ...}

📝 测试3：更新玩家...
✅ 更新玩家成功: {address: "0x12345...", nickname: "更新后的昵称", ...}

📝 测试4：创建游戏房间...
✅ 创建游戏房间成功: {gameId: "0xabc...", roomName: "测试房间", ...}

📝 测试5：获取游戏房间...
✅ 获取游戏房间成功: {gameId: "0xabc...", roomName: "测试房间", ...}

📝 测试6：列出游戏房间...
✅ 列出游戏房间成功: {games: [...], total: 5, ...}

📝 测试7：测试缓存...
首次获取（无缓存）: 150ms
第二次获取（有缓存）: 0.5ms

📝 测试8：获取不存在的玩家...
✅ 正确返回null

=== ✅ 所有测试通过！ ===
```

## 常见问题排查

### 1. 测试函数未定义

**问题**：`Uncaught ReferenceError: testMetadata is not defined`

**解决**：
- 确保游戏已完全加载（等待几秒）
- 检查控制台是否有初始化错误
- 刷新页面重试

### 2. 网络错误

**问题**：`Network error` 或 `Request timeout`

**解决**：
- 检查网络连接
- 确认API地址正确：https://web3-tycoon-api.zeros-null.workers.dev
- 查看Network标签页的请求详情

### 3. CORS错误

**问题**：`CORS policy: No 'Access-Control-Allow-Origin' header`

**解决**：
- 这不应该发生，Workers已配置CORS
- 如果出现，检查API是否正常部署
- 访问 https://web3-tycoon-api.zeros-null.workers.dev/health 确认API可用

### 4. 404错误

**问题**：`HTTP 404: Player not found`

**解决**：
- 这是正常的，表示玩家不存在
- 先调用`createOrUpdatePlayer()`创建玩家

## 调试技巧

### 1. 查看详细日志

打开控制台，所有HTTP请求都会有日志：

```
[MetadataService] 获取玩家元数据成功: 0x123
[CacheManager] 缓存已设置: player_0x123, TTL: 300000ms
[CacheManager] 玩家元数据命中缓存: 0x123
```

### 2. 监控网络请求

在开发者工具的Network标签页：
- 查看所有API请求
- 检查请求/响应数据
- 查看请求耗时

### 3. 检查localStorage

在控制台运行：

```javascript
// 查看所有缓存键
Object.keys(localStorage).filter(k => k.startsWith('cache_'))

// 查看特定缓存
JSON.parse(localStorage.getItem('cache_player_0xtest'))

// 清除所有缓存
Object.keys(localStorage)
    .filter(k => k.startsWith('cache_'))
    .forEach(k => localStorage.removeItem(k))
```

## 下一步

测试通过后，可以开始：
1. 集成到UI界面（玩家设置昵称）
2. 创建游戏房间界面
3. 显示玩家昵称在游戏内

## API文档

完整的API文档请查看：
- 客户端：`client/tycoon_cocos/assets/scripts/http/MetadataService.ts`
- 服务端：`api/README.md`

## 在线测试

也可以直接使用curl测试API：

```bash
# 健康检查
curl https://web3-tycoon-api.zeros-null.workers.dev/health

# 创建玩家
curl -X POST https://web3-tycoon-api.zeros-null.workers.dev/api/players \
  -H "Content-Type: application/json" \
  -d '{"address":"0xtest","nickname":"测试"}'

# 获取玩家
curl https://web3-tycoon-api.zeros-null.workers.dev/api/players/0xtest
```
