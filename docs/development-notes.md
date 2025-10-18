# 开发备忘录

## 项目概述

**项目目标**：参考大富翁10、11等历代大富翁游戏，在Sui链上制作一款Web3游戏
- **后端**：Move编程（运行在Sui链上）
- **客户端**：Cocos Creator引擎（TypeScript）
- **开发周期**：2个月黑客松项目
- **美术素材**：AI生成（demo版）

## 技术架构要点

### 1. 多人联网设计

**玩家类型**：
- **真实玩家**：通过钱包连接，进行链上操作
- **PC玩家**：自动操作的角色，初期完全随机即可

**Gas费考虑**：
- 测试网：Gas费不用担心
- 正式游戏：考虑去掉Gas费，或玩家付费请AI组局
- 计划所有后端逻辑都用Move实现，不只是NFT

### 2. Sui性能与Gas费

**性能考虑**：
- Sui性能是否能胜任遍历地图的计算？
- 一局游戏Gas费如果达到1 SUI可能无法接受

**解决方案**：
- 先开发测试，如果不行考虑其他链或游戏类型
- 实时战斗RPC类游戏可能更不适合

### 3. DeFi协议集成

**黑客松赛道**：
- **Sui赛道**：必选
- **Bucket**：数据存储和同步
- **Scallop**：借贷协议集成
- **Navi**：流动性挖矿

**集成思路**：
- 增加用户交互性和日活
- 提升项目成功概率

## 开发经验总结

### 1. Cocos Creator开发问题

**Claude Code生成问题**：
- Sonnet和Opus生成的Node、Sprite在Cocos中都有问题
- 估计是样本太少，不是代码问题

**解决方案**：
1. 手动建空白场景，包含Light和Camera
2. 搭建UI、场景root node等架构
3. Claude Code写TS代码，使用动态生成方式
4. 后续考虑生成Cocos MCP

### 2. 卡片系统设计

**核心概念**：
- 整个卡片系统实际上是一个技能系统
- 支持多种效果类型和组合

**技术实现**：
- 模块化设计，便于扩展
- 支持效果组合和冲突解决
- 完整的生命周期管理

### 3. 地图流程设计

**UI设计**：
- 选中的tile在角落显示
- 编辑器模式toggle（键盘快捷键）
- 在mode select、map select上加功能

**GameMap流程**：
1. **编辑模式**：开启grid，处理game_ground_clicked事件
2. **正常模式**：根据json配置和move数据加载现有map
3. **保存机制**：先存为json，后续publish为move数据或walrus数据

## 数据流实现

### 1. 完整数据流架构

**创建游戏流程**：
```
玩家点击"创建游戏" → SuiManager.createGame() → 链上GameCreatedEvent
→ SuiManager._addNewGameToCache() → emit Move.GameCreated
→ UIMapSelect.showGameDetail() → GameDetail显示
```

**加入游戏流程**：
```
玩家点击"加入游戏" → SuiManager.joinGame() → 链上PlayerJoinedEvent
→ SuiManager._onPlayerJoined() → emit Sui.GamesListUpdated + Move.PlayerJoined
→ UIGameList.refresh() + UIGameDetail.showGame()
```

**开始游戏流程**：
```
玩家点击"开始游戏" → SuiManager.startGame() → 链上GameStartedEvent
→ SuiManager._onGameStarted() → _loadGameScene()
→ emit Game.GameStart → UIInGame._onGameStart()
→ GameMap.loadFromChainData() → 渲染3D场景
```

### 2. 关键优化点

**性能优化**：
- GameCreated：从查询50个游戏 → 只查询1个新游戏
- PlayerJoined：增量更新，不重新查询完整Game
- GameStarted：区分玩家/观察者，玩家才加载场景

**场景管理**：
- 完整的生命周期管理：卸载旧场景 → 创建新实例 → 初始化组件 → 加载数据 → 添加到场景树 → 更新状态

## 发布策略

### 1. 初始发布方案

**GitHub Pages发布**：
- 免费托管服务
- 直接从GitHub仓库自动部署
- 支持自定义域名
- 适合静态网站托管

**后续考虑**：
- 后续再看walrus发布方案
- 根据项目需求选择合适的发布平台

### 2. 多链支持思考

**技术可行性**：
- 是否可以使用Solana链的签名证明在Sui的签名？
- 这样用户就不用学习Sui，只要会Solana操作也可以玩

**Sui特性**：
- Sui本身支持Account Abstraction
- 重点在于简化Web2登录onboarding
- 支持zkLogin、Gas Sponsor等

### 3. 发布策略

**GitHub Pages发布**：
- 免费托管服务
- 直接从GitHub仓库自动部署
- 支持自定义域名
- 适合静态网站托管

**后续考虑**：
- 后续再看walrus发布方案
- 根据项目需求选择合适的发布平台

## 小游戏扩展

### 1. 预测涨跌小游戏

**设计思路**：
- 预测涨跌的小游戏（都能上链）
- UI组件：BTC、SUI价格牌（突出氛围感）

### 2. 借贷聚合器

**功能设计**：
- 集成多个DeFi协议
- 提供最优借贷方案
- 增加用户交互性

## 后期优化思路

### 1. 预同步机制

**技术方案**：
- 使用客户端P2P或服务器方式进行预同步
- 比链上confirm tx更早显示掷骰子等操作
- 如果fail，再回滚客户端显示

**适用场景**：
- 此类型游戏可能不需要实时同步
- 但可以提供更好的用户体验

### 2. 架构优化

**可执行目标**：
- 客户端（带内置本地服务器能力）
- 专用服务器

**参考案例**：
- 研究autoChess在没有服务端的情况下如何组队或对战

## 开发注意事项

### 1. 技术选型

**引擎选择**：
- Cocos Creator v3.8
- 用户手册：https://docs.cocos.com/creator/3.8/manual/zh/
- API文档：https://docs.cocos.com/creator/3.8/api/zh/

**开发方式**：
- 所有Node和Component都用TS代码动态生成
- 不要修改game scene
- 游戏主入口命名为GameManager
- 使用引擎自带的internal资源

### 2. 项目结构

**文件组织**：
- 保持清晰的模块划分
- 使用TypeScript类型安全
- 遵循Cocos Creator最佳实践

**代码质量**：
- 使用中文注释
- 保持代码可读性
- 及时重构和优化

## 总结

这个开发备忘录记录了Web3 Tycoon项目开发过程中的关键决策、技术难点、解决方案和经验总结。通过系统性的整理，为后续开发提供了重要的参考依据，确保项目能够按照既定目标顺利推进。

重点关注：
1. **技术架构**：Sui链集成、DeFi协议、多人联网
2. **开发经验**：Cocos Creator问题解决、数据流设计
3. **性能优化**：Gas费控制、查询优化、场景管理
4. **扩展功能**：小游戏、多链支持、发布策略
