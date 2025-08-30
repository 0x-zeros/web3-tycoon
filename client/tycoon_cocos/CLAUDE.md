# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game that combines classic board game mechanics with modern DeFi protocols. This is an 8-week hackathon project currently in Phase 1 (basic architecture) with an active Cocos Creator client prototype.

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
npm install                   # Install @tweenjs/tween.js dependency

# Development through Cocos Creator 3.8+ GUI
# No build scripts - uses Creator interface for compilation and builds
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

### Component-Based Game System (Cocos Creator)

The game follows a hierarchical component architecture:

```typescript
// Global game state
window.game = {
    config: config,           // From assets/data/config.ts
    player: new Player(),     // Player data management
    asset: new Asset(),       // Resource loading
    pool: new Pool(),         // Object pooling
    eventTarget: EventTarget  // Global event system
};

// Main controllers
@ccclass('Game') extends Component      // Global initialization
@ccclass('MapManager') extends Component // Map and tile management  
@ccclass('Player') extends Component    // Player logic and movement
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

## Key Configuration Files

### Game Configuration
- **`assets/data/config.ts`** - Global game settings and project configuration
- **`assets/data/types.ts`** - TypeScript interfaces for GameJsonData and ConfigData
- **`assets/resources/data/maps/test_map.json`** - Complete 20-tile test map with properties

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
1. **Use Cocos Creator 3.8+ IDE** for main game development
2. **Test with existing map data** (`test_map.json`) 
3. **Generate assets as needed** using AIGC tool
4. **Iterate on TypeScript game logic** within Creator environment

### Code Conventions
- **Language**: Code in English, comments in Chinese for domain context
- **Files**: English naming with kebab_case convention
- **Types**: Use provided interfaces from `assets/data/types.ts`
- **Events**: Follow component hierarchy for event bubbling
- **Assets**: Import generated assets from `tools/asset-generator/output/`

### Integration Points
- **Map Loading**: JSON configuration → MapManager component
- **Event Flow**: Tile interactions → MapManager → Game controller  
- **Asset Pipeline**: AIGC tool → Cocos Creator import
- **Global State**: Access via `window.game` object

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
- 该项目目前是一个黑客松的参赛项目，时间非常紧张，还剩1个半月。所以只实现最核心的功能
- git commit message 尽量写的简洁一点
- 每次做修改后，不需要直接帮我commit，我自己还需要修改

This project demonstrates a well-architected hackathon approach: solid client foundation with AIGC-assisted development, clear separation of concerns, and phased blockchain integration strategy.
- 请使用中文和我对话