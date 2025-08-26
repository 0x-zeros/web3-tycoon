# 地图编辑器技术设计

## 概述

地图编辑器是一个集成在Web3 Tycoon游戏中的工具，允许玩家创建、编辑和分享自定义地图。编辑器与游戏引擎共享核心组件，确保编辑器中创建的地图能够完美运行在游戏中。

## 设计原则

### 1. 一体化设计
- **共享核心**：地图编辑器和游戏使用相同的地图渲染引擎
- **实时预览**：编辑过程中可以直接预览游戏效果
- **无缝切换**：编辑模式和游戏模式之间可以快速切换

### 2. 用户友好
- **直观操作**：拖拽放置、右键编辑等直观的操作方式
- **智能提示**：自动验证地图合理性，提供改进建议
- **渐进学习**：从简单模板开始，逐步掌握高级功能

### 3. 扩展性
- **插件系统**：支持第三方扩展和自定义地块类型
- **模板系统**：提供丰富的预设模板和样式
- **版本控制**：支持地图的版本管理和回滚

## 系统架构

### 1. 核心架构
```typescript
class MapEditor {
  private renderer: MapRenderer;           // 地图渲染器
  private inputHandler: InputHandler;      // 输入处理器
  private toolManager: ToolManager;        // 工具管理器
  private mapData: EditableMapData;        // 可编辑地图数据
  private validator: MapValidator;         // 地图验证器
  private undoRedoSystem: UndoRedoSystem; // 撤销重做系统
  
  constructor() {
    this.initializeEditor();
  }
  
  public switchToPlayMode(): void {
    // 切换到游戏模式
  }
  
  public switchToEditMode(): void {
    // 切换到编辑模式
  }
}
```

### 2. 共享组件
- **地图渲染器 (MapRenderer)**：游戏和编辑器共享
- **地块系统 (TileSystem)**：统一的地块逻辑
- **资产管理 (AssetManager)**：共享的资源管理
- **物理系统 (PhysicsSystem)**：碰撞检测和交互

### 3. 编辑器专有组件
- **工具栏 (Toolbar)**：各种编辑工具
- **属性面板 (PropertyPanel)**：地块属性编辑
- **图层管理 (LayerManager)**：多图层编辑支持
- **网格系统 (GridSystem)**：对齐和吸附功能

## 数据结构设计

### 1. 可编辑地图数据
```typescript
interface EditableMapData extends GameMapData {
  // 编辑器专有数据
  editorVersion: string;
  lastModified: Date;
  author: string;
  tags: string[];
  thumbnail: string;
  
  // 编辑历史
  editHistory: EditAction[];
  
  // 图层数据
  layers: MapLayer[];
  
  // 编辑器设置
  editorSettings: {
    gridSize: number;
    snapToGrid: boolean;
    showGrid: boolean;
    cameraPosition: { x: number; y: number; zoom: number };
  };
}

interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  tiles: MapTile[];
}
```

### 2. 编辑操作
```typescript
interface EditAction {
  type: EditActionType;
  timestamp: Date;
  data: any;
  inverse?: EditAction;
}

enum EditActionType {
  ADD_TILE = 'addTile',
  REMOVE_TILE = 'removeTile',
  MOVE_TILE = 'moveTile',
  MODIFY_TILE = 'modifyTile',
  ADD_LAYER = 'addLayer',
  REMOVE_LAYER = 'removeLayer',
  MODIFY_MAP_SETTINGS = 'modifyMapSettings'
}
```

## 编辑工具系统

### 1. 基础工具
```typescript
abstract class EditorTool {
  abstract name: string;
  abstract icon: string;
  abstract cursor: string;
  
  abstract onActivate(): void;
  abstract onDeactivate(): void;
  abstract onMouseDown(event: MouseEvent): void;
  abstract onMouseMove(event: MouseEvent): void;
  abstract onMouseUp(event: MouseEvent): void;
}

// 选择工具
class SelectTool extends EditorTool {
  name = 'select';
  // 实现选择逻辑
}

// 画笔工具
class BrushTool extends EditorTool {
  name = 'brush';
  // 实现绘制逻辑
}

// 橡皮擦工具
class EraserTool extends EditorTool {
  name = 'eraser';
  // 实现删除逻辑
}
```

### 2. 高级工具
- **路径工具**：绘制连续的路径
- **区域工具**：批量编辑矩形或圆形区域
- **复制工具**：复制和粘贴地图片段
- **变换工具**：旋转、缩放、翻转地图元素

### 3. 智能工具
- **自动连接**：自动连接道路和建筑
- **模式识别**：识别和建议地图模式
- **平衡检测**：分析地图平衡性并给出建议

## 用户界面设计

### 1. 界面布局
```
┌─────────────────────────────────────────┐
│ 菜单栏 (File/Edit/View/Map/Help)        │
├─────────────────────────────────────────┤
│ 工具栏 (Select/Brush/Eraser/etc.)       │
├───────┬─────────────────────────┬───────┤
│       │                         │       │
│ 地块  │                         │ 属性  │
│ 面板  │      地图画布           │ 面板  │
│       │                         │       │
│       │                         │       │
├───────┼─────────────────────────┤       │
│ 图层  │                         │       │
│ 面板  │                         │       │
└───────┴─────────────────────────┴───────┘
```

### 2. 响应式设计
- **自适应布局**：支持不同屏幕尺寸
- **可停靠面板**：用户可以自由组织界面
- **全屏模式**：专注编辑的全屏模式
- **快捷键支持**：所有操作都有快捷键

### 3. 主题系统
- **明亮主题**：适合长时间工作
- **暗色主题**：减少眼部疲劳
- **自定义主题**：用户可以自定义颜色方案

## 核心功能实现

### 1. 拖拽系统
```typescript
class DragDropSystem {
  private isDragging = false;
  private dragData: any = null;
  private ghostElement: HTMLElement | null = null;
  
  public startDrag(data: any, sourceElement: HTMLElement): void {
    this.isDragging = true;
    this.dragData = data;
    this.createGhost(sourceElement);
  }
  
  public onDrop(targetElement: HTMLElement): void {
    if (this.canDrop(targetElement)) {
      this.executeDrop();
    }
    this.endDrag();
  }
  
  private createGhost(element: HTMLElement): void {
    // 创建拖拽时的视觉反馈
  }
}
```

### 2. 网格系统
```typescript
class GridSystem {
  private gridSize: number = 32;
  private snapToGrid: boolean = true;
  private showGrid: boolean = true;
  
  public snapToGrid(position: Point): Point {
    if (!this.snapToGrid) return position;
    
    return {
      x: Math.round(position.x / this.gridSize) * this.gridSize,
      y: Math.round(position.y / this.gridSize) * this.gridSize
    };
  }
  
  public renderGrid(context: CanvasRenderingContext2D): void {
    if (!this.showGrid) return;
    // 绘制网格线
  }
}
```

### 3. 撤销重做系统
```typescript
class UndoRedoSystem {
  private undoStack: EditAction[] = [];
  private redoStack: EditAction[] = [];
  private maxStackSize = 100;
  
  public executeAction(action: EditAction): void {
    // 执行操作
    this.applyAction(action);
    
    // 添加到撤销栈
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    
    // 清空重做栈
    this.redoStack.length = 0;
  }
  
  public undo(): boolean {
    const action = this.undoStack.pop();
    if (action && action.inverse) {
      this.applyAction(action.inverse);
      this.redoStack.push(action);
      return true;
    }
    return false;
  }
  
  public redo(): boolean {
    const action = this.redoStack.pop();
    if (action) {
      this.applyAction(action);
      this.undoStack.push(action);
      return true;
    }
    return false;
  }
}
```

## 地图验证系统

### 1. 基础验证
```typescript
class MapValidator {
  public validateMap(mapData: EditableMapData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // 检查必需元素
    this.checkRequiredElements(mapData, errors);
    
    // 检查路径连通性
    this.checkPathConnectivity(mapData, errors);
    
    // 检查游戏平衡性
    this.checkBalance(mapData, warnings);
    
    return { errors, warnings, isValid: errors.length === 0 };
  }
  
  private checkRequiredElements(mapData: EditableMapData, errors: ValidationError[]): void {
    // 检查是否有起点
    const startTiles = mapData.tiles.filter(tile => tile.type === 'start');
    if (startTiles.length === 0) {
      errors.push({
        type: 'MISSING_START_POINT',
        message: '地图必须包含至少一个起点',
        severity: 'error'
      });
    }
  }
}
```

### 2. 高级验证
- **平衡性分析**：分析地图的经济平衡
- **可玩性检查**：确保地图有足够的策略深度
- **性能分析**：检查地图复杂度是否会影响性能
- **无障碍性**：确保地图对不同能力的玩家友好

## 文件系统

### 1. 保存格式
```typescript
interface MapFile {
  version: string;
  metadata: {
    name: string;
    description: string;
    author: string;
    created: Date;
    modified: Date;
    tags: string[];
    thumbnail: string;
    gameMode: string;
    playerCount: { min: number; max: number };
  };
  mapData: EditableMapData;
  checksum: string;
}
```

### 2. 导入导出
- **本地文件**：支持保存到本地文件系统
- **云端存储**：集成云端存储服务
- **社区分享**：上传到社区地图库
- **版本控制**：支持git式的版本管理

### 3. 格式兼容
- **向后兼容**：新版本编辑器可以打开旧版本地图
- **格式转换**：支持导入其他格式的地图文件
- **导出选项**：可以导出为不同格式供其他工具使用

## 性能优化

### 1. 渲染优化
- **视口裁剪**：只渲染可见区域
- **LOD系统**：根据缩放级别调整细节
- **批量渲染**：相同类型地块批量处理
- **缓存机制**：缓存渲染结果减少重复计算

### 2. 内存管理
- **对象池**：重用频繁创建的对象
- **懒加载**：按需加载资源
- **垃圾回收**：主动清理不需要的对象
- **纹理优化**：合理管理纹理内存

### 3. 交互优化
- **防抖动**：减少频繁的更新操作
- **异步处理**：耗时操作异步执行
- **进度反馈**：长时间操作显示进度条
- **操作缓冲**：批量处理用户操作

## Web3 集成

### 1. NFT 地图
- **地图NFT化**：将地图作为NFT发布
- **版权保护**：通过区块链确保创作版权
- **交易市场**：内置地图交易市场
- **版税系统**：创作者获得持续收益

### 2. 去中心化存储
- **IPFS集成**：将地图文件存储在IPFS
- **Arweave备份**：永久存储重要地图
- **分布式同步**：多节点同步地图数据

### 3. 社区治理
- **DAO投票**：社区投票决定官方地图
- **质量评级**：基于代币的质量评价系统
- **激励机制**：优秀创作者获得代币奖励

## 扩展系统

### 1. 插件架构
```typescript
interface EditorPlugin {
  name: string;
  version: string;
  author: string;
  
  onLoad(): void;
  onUnload(): void;
  
  registerTools?(): EditorTool[];
  registerTileTypes?(): TileType[];
  registerValidators?(): Validator[];
}

class PluginManager {
  private plugins: Map<string, EditorPlugin> = new Map();
  
  public loadPlugin(plugin: EditorPlugin): void {
    this.plugins.set(plugin.name, plugin);
    plugin.onLoad();
  }
  
  public unloadPlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.onUnload();
      this.plugins.delete(name);
    }
  }
}
```

### 2. 脚本系统
- **Lua脚本**：轻量级的脚本支持
- **JavaScript API**：丰富的JS API接口
- **自定义事件**：可以定义自定义游戏事件
- **调试工具**：脚本调试和错误追踪

## 测试和质量保证

### 1. 自动化测试
- **单元测试**：核心功能的单元测试
- **集成测试**：组件间的集成测试
- **性能测试**：渲染和交互性能测试
- **兼容性测试**：不同平台和浏览器测试

### 2. 用户测试
- **可用性测试**：界面和交互的可用性
- **A/B测试**：不同设计方案的对比
- **beta测试**：真实用户环境下的测试
- **反馈收集**：用户反馈的收集和分析

这个技术设计文档提供了地图编辑器的完整架构和实现方案，确保编辑器与游戏的无缝集成，同时提供强大且易用的编辑功能。