# Web3 Tycoon MVP 开发计划

## 项目概述

### 背景
- **项目性质**：黑客松参赛项目
- **开发时长**：2周（14天）
- **目标**：实现可演示的大富翁游戏MVP
- **技术栈**：Cocos Creator 3.8+ + TypeScript

### 核心目标
1. 实现基础的大富翁游戏循环
2. 简单的地图系统（JSON硬编码）
3. 基础卡片系统（5种卡片）
4. 使用3D基础几何体快速原型
5. 为后续美术替换预留接口

## 功能范围定义

### 核心功能（必做）
- [x] 基础地图系统：20个地块环形布局
- [x] 地块类型：起点、地产、机会、空白、监狱
- [x] 玩家系统：2-4人游戏，回合制
- [x] 地产交易：购买、升级、收租
- [x] 卡片系统：5种基础卡片
- [x] 3D渲染：基础几何体 + 45度摄像机
- [x] 基础UI：玩家信息、骰子、卡片栏

### 卡片功能
1. **遥控骰子** - 控制下次骰子点数（1-6）
2. **路障卡** - 在指定位置放置路障，阻止通过
3. **传送卡** - 传送到指定地块
4. **拆除卡** - 拆除一个建筑降级
5. **免租卡** - 下次踩到别人地产免付租金

### 简化策略（不做）
- ❌ 地图编辑器
- ❌ Web3集成（后期添加）
- ❌ 复杂地块（银行、商店）
- ❌ AI玩家
- ❌ 网络对战
- ❌ 存档系统
- ❌ 复杂动画效果

## 2周详细开发计划

### 第一周：核心系统建立

#### Day 1-2：数据结构和类型定义
**目标**：建立完整的数据基础
- [ ] 创建地图数据类型定义（MapTypes.ts）
- [ ] 创建卡片数据类型定义（CardTypes.ts）
- [ ] 创建游戏核心类型定义（GameTypes.ts）
- [ ] 设计地图JSON数据格式
- [ ] 硬编码20个地块的测试地图
- [ ] 定义5种卡片的数据结构

**产出**：
```typescript
interface MapData {
  id: string;
  name: string;
  tiles: MapTileData[];
  paths: PathConnection[];
}

interface CardData {
  id: string;
  name: string;
  type: CardType;
  description: string;
  usage: CardUsage;
}
```

#### Day 3-4：地图渲染系统
**目标**：实现基础的3D地图显示
- [ ] 创建地块基类（MapTile.ts）
- [ ] 实现地图管理器（MapManager.ts）
- [ ] 使用Cocos 3D基础几何体渲染地块
  - Plane作为地块底座
  - Cube表示建筑物
  - 材质颜色区分地产组
- [ ] 设置45度俯视摄像机
- [ ] 创建20个地块的环形布局

**技术要点**：
- 使用cc.MeshRenderer渲染3D几何体
- 通过cc.Material设置颜色
- 地块位置计算：环形路径布局算法

#### Day 5-7：交互系统
**目标**：实现基础的摄像机控制和地块交互
- [ ] 摄像机控制系统
  - 鼠标滚轮缩放
  - 右键拖拽旋转
  - 边界限制
- [ ] 地块点击检测
  - 射线检测实现
  - 地块高亮显示
  - 信息提示UI
- [ ] 卡片使用的目标选择系统

**技术要点**：
- 使用cc.Camera的射线检测
- cc.geometry.Ray 射线与地块相交检测
- UI显示使用cc.Canvas组件

### 第二周：游戏逻辑实现

#### Day 8-9：玩家移动系统
**目标**：实现完整的玩家移动和回合制
- [ ] 玩家对象系统
  - Capsule作为玩家棋子
  - 玩家状态管理（金钱、位置、卡片）
  - 多玩家轮流机制
- [ ] 骰子系统
  - 随机数生成（1-6）
  - 骰子动画效果
  - 遥控骰子卡片集成
- [ ] 移动控制
  - 沿路径移动动画
  - 路障阻挡逻辑
  - 移动完成后的地块交互

**技术要点**：
- 使用cc.tween实现移动动画
- 路径查找算法（简化为固定路径）
- 状态机管理玩家状态

#### Day 10-11：地产和卡片系统
**目标**：实现完整的游戏规则
- [ ] 地产交易系统
  - 购买无主地产
  - 建筑升级（用Cube堆叠表示）
  - 租金计算和支付
  - 地产组垄断加成
- [ ] 卡片系统实现
  - 卡片获取逻辑
  - 5种卡片的具体实现
  - 卡片使用时机和目标选择
  - 卡片效果处理

**卡片实现详情**：
```typescript
// 遥控骰子：弹窗选择1-6点数
// 路障卡：点击地块放置Cylinder模型
// 传送卡：点击目标地块直接移动
// 拆除卡：点击敌方建筑，Cube高度-1
// 免租卡：设置玩家状态，下次免租
```

#### Day 12-13：UI系统和整合
**目标**：完整的用户界面和游戏体验
- [ ] 主要UI组件
  - 玩家信息面板（头像、金钱、资产）
  - 卡片栏UI（最多3张卡片）
  - 骰子按钮和动画
  - 地产信息弹窗
  - 回合指示器
- [ ] 游戏流程控制
  - 回合制状态机
  - 胜利条件判定
  - 游戏结束界面
- [ ] 数据整合和调试

**UI布局参考大富翁11**：
```
左上：回合/天数信息
右上：设置按钮
右侧：玩家信息面板
底部：卡片栏
中下：骰子按钮
```

#### Day 14：测试和优化
**目标**：确保MVP质量和可演示性
- [ ] 功能完整性测试
  - 完整游戏流程测试
  - 所有卡片功能验证
  - 多玩家游戏测试
- [ ] 性能优化
  - 渲染性能检查
  - 内存使用优化
- [ ] Bug修复
  - 已知问题解决
  - 边界情况处理
- [ ] 演示准备
  - 演示脚本准备
  - 关键功能展示路径

## 技术架构设计

### 目录结构
```
client/tycoon_cocos/assets/scripts/
├── map/                    # 地图系统
│   ├── types/             # 类型定义
│   │   ├── MapTypes.ts
│   │   ├── CardTypes.ts
│   │   └── GameTypes.ts
│   ├── core/              # 核心类
│   │   ├── MapTile.ts
│   │   ├── MapManager.ts
│   │   └── GameManager.ts
│   └── tiles/             # 地块实现
│       ├── StartTile.ts
│       ├── PropertyTile.ts
│       ├── ChanceTile.ts
│       ├── EmptyTile.ts
│       └── JailTile.ts
├── card/                   # 卡片系统
│   ├── Card.ts
│   ├── CardManager.ts
│   └── cards/
│       ├── DiceControlCard.ts
│       ├── BarrierCard.ts
│       ├── TeleportCard.ts
│       ├── DemolishCard.ts
│       └── FreeRentCard.ts
├── player/                 # 玩家系统
│   ├── Player.ts
│   ├── PlayerManager.ts
│   └── PlayerController.ts
└── ui/                     # UI系统
    ├── GameUI.ts
    ├── PlayerPanel.ts
    └── CardPanel.ts
```

### 数据文件
```
client/tycoon_cocos/assets/data/
├── maps/
│   └── test_map.json      # 测试地图数据
├── cards/
│   └── cards.json         # 卡片配置数据
└── config/
    └── game_config.json   # 游戏配置
```

## 关键技术要点

### 1. 3D渲染使用基础几何体
```typescript
// 地块：使用Plane + 不同材质颜色
// 建筑：使用Cube，高度表示等级
// 玩家：使用Capsule
// 路障：使用Cylinder
```

### 2. 地图数据结构设计
```typescript
interface MapTileData {
  id: number;              // 地块ID
  type: TileType;          // 地块类型
  position: Vec3;          // 3D坐标
  next?: number;           // 下一个地块ID（路径）
  group?: string;          // 地产组（用于颜色和垄断）
  price?: number;          // 购买价格
  rent?: number[];         // 租金等级
  name: string;            // 地块名称
}
```

### 3. 卡片系统设计
```typescript
enum CardType {
  INSTANT = 'instant',     // 即时生效
  PASSIVE = 'passive',     // 被动触发
  PLACEMENT = 'placement'  // 放置型
}

interface CardEffect {
  type: string;            // 效果类型
  value: any;              // 效果数值
  target?: string;         // 作用目标
}
```

## 验收标准

### 功能验收
- [ ] 能够完成一局完整的游戏（2-4人）
- [ ] 所有5种卡片功能正常
- [ ] 地产购买、升级、收租逻辑正确
- [ ] 摄像机控制流畅
- [ ] UI交互无明显bug

### 性能验收
- [ ] 游戏运行帧率稳定在30FPS以上
- [ ] 地图加载时间小于3秒
- [ ] 内存使用合理（不超过200MB）

### 可演示性验收
- [ ] 5分钟内能展示完整游戏循环
- [ ] 所有核心功能都有明显的视觉反馈
- [ ] 操作流畅，无明显卡顿

## 风险控制

### 高风险项目
1. **Cocos 3D API不熟悉**
   - 缓解：使用最基础的3D功能，预留注释供调试
   - 备选：如果3D有问题，降级到2D实现

2. **时间压力大**
   - 缓解：每日检查进度，及时调整功能范围
   - 备选：砍掉部分卡片功能或地块类型

3. **游戏平衡性问题**
   - 缓解：使用经典大富翁的数值设定
   - 备选：快速调整数值配置

### 中风险项目
1. **UI系统复杂性**
   - 缓解：使用最简单的UI布局
   - 备选：减少UI元素，专注核心功能

2. **多玩家状态管理**
   - 缓解：使用简单的状态机
   - 备选：先实现单机版本

## 开发规范

### 代码规范
- 所有接口和类必须有完整的中文注释
- TypeScript严格模式
- 函数命名使用驼峰命名法
- 常量使用大写+下划线

### 注释规范
```typescript
/**
 * 地块基类
 * 所有地块类型的父类，定义地块的基础属性和行为
 */
export abstract class MapTile {
  /**
   * 地块唯一标识符
   */
  public readonly id: number;
  
  /**
   * 当玩家停留在此地块时触发
   * @param player 停留的玩家对象
   * @returns 是否继续执行后续逻辑
   */
  public abstract onPlayerStop(player: Player): boolean;
}
```

### Git提交规范
- feat: 新功能
- fix: Bug修复
- refactor: 重构
- docs: 文档更新
- test: 测试相关

## 后续扩展规划

### Week 3-4（如果有时间）
- 地图编辑器基础版本
- 更多地块类型
- 音效和特效
- Web3钱包连接

### 长期规划
- 完整的地图编辑器
- NFT地图系统
- DeFi协议集成
- 多平台发布

---

**项目负责人**：开发者
**文档版本**：v1.0
**最后更新**：2025-08-26