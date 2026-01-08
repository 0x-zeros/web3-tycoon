# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game that combines classic board game mechanics with modern DeFi protocols. The active Cocos Creator client prototype is in ongoing development.

**Primary Development Focus**: The active Cocos Creator 3.8.7 TypeScript client in `client/tycoon_cocos/` serves as the main deliverable, with blockchain integration planned for later phases.

## Key Technologies

- **Frontend**: Cocos Creator 3.8.7 with TypeScript
- **Asset Generation**: OpenAI DALL-E 3 / GPT-Image-1 with custom AIGC pipeline
- **Planned Blockchain**: Sui Network + Move language for smart contracts
- **Planned Backend**: Node.js/TypeScript for multiplayer matchmaking  
- **Planned DeFi**: Bucket Protocol (data storage), Scallop Protocol (lending), Navi Protocol (liquidity mining)

## Development Commands

### Cocos Creator Client (Primary)
```bash
# Navigate to main project
cd client/tycoon_cocos
npm install                   # Install dependencies: @tweenjs/tween.js, fairygui-cc, lodash-es

# Development through Cocos Creator 3.8+ GUI
# Open project in Cocos Creator 3.8.7 - no build scripts needed
# Use Creator interface for compilation, builds, and deployment
```

### Asset Generation Tool
```bash
# Navigate to asset generator
cd tools/asset-generator
npm install

# Generate game assets
npm run generate              # All assets (~100+ items)
npm run generate:tiles        # Map tiles and buildings  
npm run generate:ui           # UI elements and backgrounds
npm run generate:icons        # Game icons
npm run generate:dice         # Web3 dice with BTC/SUI symbols

# Cost-effective options
npm run generate:gpt          # Use cheaper gpt-image-1 model
npm run generate:sample       # Sample from each category
npm run print:prompts         # Export prompts without generating
```

### Supporting Tools
```bash
# VS Code markdown extension
cd tools/md-paste-image-extension
npm run lint && npm run test

# Clean asset outputs
cd tools/asset-generator  
npm run clean
```

## Code Architecture

### Core System Architecture

The project uses a modular architecture with clear separation of concerns:

```typescript
// Core initialization and management
GameInitializer.ts          // 统一游戏初始化管理器，控制启动流程
MapManager.ts               // 地图管理和瓦片系统核心组件
RoleManager.ts              // 角色和玩家管理系统
UIManager.ts                // 基于FairyGUI的UI界面统一管理
CameraController.ts         // 多模式相机控制（等距、俯视、跟随）
EventBus.ts                 // 全局事件总线，支持跨模块通信
```

### Event-Driven Architecture

```typescript
// Singleton event bus for cross-component communication
EventBus.instance.emit('tile-interaction', data);
EventBus.instance.on('player-move', handler);

// Event types defined in EventTypes.ts with full TypeScript support
// Component hierarchy: Tile → MapManager → GameInitializer → UI
```

### Camera System Architecture

```typescript
// Multi-mode camera with smooth transitions
CameraController.setMode(CameraMode.ISOMETRIC);   // 等距视角
CameraController.setMode(CameraMode.TOP_DOWN);    // 俯视视角
CameraController.setMode(CameraMode.FOLLOW);      // 跟随模式

// WASD keyboard controls + mouse interactions
// Configurable via CameraConfig decorators
```

### Map System Architecture

The map system uses a tile-based architecture with JSON configuration:

```typescript
// Map data flow: JSON → MapManager → Individual Tiles
// Located in: assets/resources/data/maps/test_map.json
interface MapConfig {
    mapId: string;
    mapSize: { width: number; height: number; tileCount: number };
    gameRules: { startingMoney: number; passingStartBonus: number };
    tiles: TileData[];        // 20 tiles with positions and properties
    propertyGroups: PropertyGroup[]; // Color-coded property groups
}
```

### Event-Driven Communication

```typescript
// Events bubble up: Tile → MapManager → Game → UI
this.node.emit('tile-event', { type: 'property-purchase', data, source });

// Global event system for cross-component communication
game.eventTarget.dispatchEvent(new CustomEvent('game-state-change'));
```

## Key Files and Configuration

### Project Structure
```
assets/
├── scripts/
│   ├── core/                 # GameInitializer.ts - 游戏启动和初始化
│   ├── camera/               # CameraController.ts - 3D相机控制系统  
│   ├── events/               # EventBus.ts - 全局事件总线
│   ├── map/                  # MapManager.ts - 地图和瓦片管理
│   ├── ui/core/              # UIManager.ts - 基于FairyGUI的界面管理
│   ├── role/                 # RoleManager.ts - 角色和玩家系统
│   └── utils/                # 工具函数和辅助类
├── resources/
│   ├── data/                 # JSON配置文件和游戏数据
│   ├── prefabs/              # 预制体资源
│   └── ui/                   # FairyGUI界面资源
└── texture/                  # 贴图和图像资源
```

### Dependencies and Configuration
- **`package.json`** - 项目依赖：fairygui-cc, @tweenjs/tween.js, lodash-es
- **`tsconfig.json`** - TypeScript配置，extends Cocos Creator base config
- **`FGUIProject/`** - FairyGUI独立项目，UI界面设计和导出

### Asset Generation Configuration  
- **`tools/asset-generator/assets_config.js`** - 100+ AIGC prompt templates
- **`tools/asset-generator/.env`** - OpenAI API configuration
- Art style: Studio Ghibli with 温暖水彩画风, Web3 elements (BTC/SUI icons)

## Current Implementation Status

### ✅ Completed Systems
- **Cocos Creator Project** - Fully functional 3.8.7 setup with TypeScript
- **Map System MVP** - MapManager with complete 20-tile test map
- **Card System Framework** - TypeScript interfaces and base classes  
- **AIGC Pipeline** - Asset generation with 100+ curated prompts
- **Game Object Architecture** - Component hierarchy and event system

### 🔄 Active Development
- **Game Logic** - Property ownership, rent calculation, player turns
- **UI System** - Game interface, property cards, player status  
- **Player Movement** - Pathfinding and animation on the board
- **Card Interactions** - Chance/Community cards with Web3 themes

### ⏳ Planned Integration (Later Phases)
- **Sui Smart Contracts** - Move language for game logic and NFTs
- **Multiplayer Backend** - Node.js for real-time game rooms
- **DeFi Features** - Integration with Bucket, Scallop, Navi protocols

## Development Workflow

### Primary Development Path
1. **Open in Cocos Creator 3.8.7** - Load project via Creator GUI
2. **Core development files**:
   - `assets/scripts/core/GameInitializer.ts` - 游戏启动逻辑
   - `assets/scripts/map/MapManager.ts` - 地图系统开发  
   - `assets/scripts/camera/CameraController.ts` - 相机控制功能
   - `assets/scripts/events/EventBus.ts` - 事件系统扩展
3. **UI development** - Use FGUIProject for interface design, export to `assets/resources/ui/`
4. **Test and debug** - Preview in Creator, use built-in debugging tools

### Code Conventions
- **Language**: Code in English, comments in Chinese for domain context
- **Files**: English naming with kebab_case convention  
- **Components**: Use Cocos Creator @ccclass decorators and Component inheritance
- **Events**: Utilize EventBus.instance for cross-component communication
- **UI**: FairyGUI integration via UIManager for all interface elements
- **Camera**: Use CameraController for all camera operations and mode switches
- **TypeScript**: Strict typing enabled, leverage provided interfaces

### Integration Points
- **Initialization Flow**: GameInitializer → ConfigLoader → Manager initialization
- **Event Communication**: EventBus.instance handles all cross-component events
- **UI Integration**: FGUIProject design → Export → UIManager loading
- **Camera Control**: CameraController.setMode() for view switching
- **Asset Pipeline**: AIGC tool → Cocos Creator import → Resource management

## Special Considerations

### Web3 Integration (Future)
- Property ownership will be represented as Sui NFTs
- Game state stored on Sui blockchain via Move contracts  
- DeFi features enable property lending/borrowing mechanics

### Performance Guidelines  
- Use object pooling (`game.pool`) for frequently created/destroyed objects
- Leverage existing texture atlases and sprite sheets
- Follow Cocos Creator 3.x performance best practices

### Art Asset Integration
- Generated assets use 1024x1024 resolution
- Ghibli art style maintains visual consistency
- BTC and SUI coin icons replace traditional Monopoly symbols

### Development Context
- 只实现最核心的功能，避免过度工程化
- git commit message 尽量写的简洁一点
- 每次做修改后，不需要直接帮我commit，我自己还需要修改
- 请使用中文和我对话