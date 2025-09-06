# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game that combines classic board game mechanics with modern DeFi protocols. This is an 8-week hackathon project integrating Sui Network + Move smart contracts + Cocos Creator frontend + DeFi protocols (Bucket, Scallop, Navi).

The project is currently in Phase 1 (basic architecture) with an active Cocos Creator client prototype.

## Key Technologies

- **Blockchain**: Sui Network with Move language for smart contracts
- **Frontend**: Cocos Creator 3.8+ with TypeScript 
- **Backend**: Node.js/TypeScript for multiplayer matchmaking
- **DeFi Integration**: Bucket Protocol (data storage), Scallop Protocol (lending), Navi Protocol (liquidity mining)

## Development Commands

### Cocos Creator Client (Primary Development)
```bash
# Navigate to main Cocos project
cd client/tycoon_cocos
npm install                   # Install @tweenjs/tween.js dependency
# Development through Cocos Creator 3.8+ GUI - no build scripts
```

### Asset Generation Tool (Active)
```bash
# Navigate to asset generator
cd tools/asset-generator
npm install

# Generation commands
npm run generate              # Generate all assets (~100+ items)
npm run generate:tiles        # Map tiles and buildings  
npm run generate:ui           # UI elements and backgrounds
npm run generate:icons        # Game icons
npm run generate:dice         # Web3 dice with BTC/SUI symbols
npm run generate:cards        # Chance/Community cards
npm run generate:characters   # Player characters

# Cost-effective options
npm run generate:gpt          # Use cheaper gpt-image-1 model
npm run generate:sample       # Sample from each category
npm run generate:fast         # Quick 10-asset generation
npm run print:prompts         # Export prompts without generating

# Utility commands
npm run clean                 # Clean output and logs
npm run setup                 # Initialize directories and .env
npm test                      # Verify tool readiness
```

### Development Tools
```bash
# VSCode extension for markdown image pasting
cd tools/md-paste-image-extension  
npm install
npm run lint
npm run test
```

### Move Contract Development (Planned)
```bash
# Navigate to contracts directory (when implemented)
cd move/
# Build Move contracts
sui move build
# Test contracts  
sui move test
# Deploy to testnet
sui move publish --gas-budget 20000000
```

### Backend Services (Planned)
```bash
# Navigate to server directory (when implemented)
cd server/
npm install
npm run dev
```

## Project Structure

The repository follows this structure:
- `move/` - Move smart contracts for game logic, properties, NFTs, and DeFi integration (empty, planned)
- `server/` - Node.js backend for multiplayer matchmaking and API services (minimal, planned)
- `client/tycoon_cocos/` - **Active Cocos Creator 3.8 project** with TypeScript
- `docs/` - Comprehensive documentation including design, technical specs, and API docs
- `tools/` - Development tools (includes working VSCode markdown extension)
  - `asset-generator/` - **Active AIGC asset generation tool** with OpenAI DALL-E 3 integration
  - `md-paste-image-extension/` - Working VSCode extension for pasting images into markdown
  - `ref4AI/` - AI reference materials and documentation
- `assets/` - Game assets and shared resources

## Active Development Focus

**Primary Client**: `client/tycoon_cocos/` contains the active Cocos Creator project:
- Uses Cocos Creator 3.8.7 with TypeScript
- **Current Status**: 大富翁核心游戏系统已初步完成架构
- **地图系统**: 完整的瓦片地图实现，支持多种瓦片类型（地产、机会卡、监狱等）
- **事件系统**: 基于EventBus的跨模块通信架构
- **相机控制**: 完整的3D相机控制器，支持等距、俯视、跟随等多种视角
- **UI管理**: 基于FairyGUI的UI界面管理系统
- **角色管理**: 角色和玩家管理系统框架

## Code Conventions

Based on `.cursorrules` file:
- **Code Language**: All code must be written in English
- **Comments**: Primarily Chinese, with English for technical terms and APIs
- **Strings/Messages**: English for error messages and string literals
- **File Naming**: English with kebab_case convention
- **Documentation**: Chinese with English for technical terms (README, API docs)
- **Git Commits**: Chinese format: `类型(范围): 简洁描述`
  - Example: `feat(map): 实现地图管理器`, `fix(ui): 修复按钮响应问题`
- **Conversation**: Always use Chinese when communicating with users
- **Move Code**: Follow Sui Move best practices (when implemented)
- **TypeScript**: Follow Cocos Creator 3.x development standards

## Architecture Notes

This is a multi-layered Web3 game with:

1. **Blockchain Layer**: Sui smart contracts handle game state, property ownership, NFTs, and DeFi integrations (planned)
2. **Server Layer**: Node.js services for real-time multiplayer matching and game room management (planned)
3. **Client Layer**: Cocos Creator 3.8+ TypeScript client with game engine capabilities
4. **Integration Layer**: DeFi protocol connections for advanced game features (planned)

## Current Cocos Client Architecture

The active Cocos project (`client/tycoon_cocos/`) contains:

### Core System Architecture
```typescript
// 核心管理器组件
- GameInitializer.ts       // 统一游戏初始化管理器
- MapManager.ts            // 全局地图管理，支持多地图切换
- RoleManager.ts           // 角色和玩家管理系统
- UIManager.ts             // UI界面统一管理
- CameraController.ts      // 相机控制器（等距、俯视、跟随模式）
- EventBus.ts              // 全局事件总线（单例模式）
```

### Map System Implementation
```typescript
// 地图系统完整实现
- GameMap.ts               // 地图核心组件
- MapTile.ts               // 地图瓦片基类
- PropertyTile.ts          // 地产瓦片（可购买）
- ChanceTile.ts           // 机会卡瓦片
- StartTile.ts            // 起点瓦片
- JailTile.ts             // 监狱瓦片
- FeeTile.ts              // 收费瓦片
- CardStationTile.ts      // 卡片车站瓦片
```

### Event-Driven Architecture
- **EventBus**: 单例全局事件总线，基于Cocos Creator EventTarget
- **EventTypes**: 完整的事件类型定义和监听器配置
- **跨模块通信**: 支持组合模式的事件处理机制

### Dependencies
- `@tweenjs/tween.js`: 动画补间
- `fairygui-cc`: UI框架（FairyGUI集成）
- `lodash-es`: 工具函数库

## Development Phases

8-week hackathon development cycle (1.5 months remaining):
- **Weeks 1-2**: Basic architecture and Move contract framework ← *Current Phase*
- **Weeks 3-4**: Multiplayer system and core game mechanics  
- **Weeks 5-6**: DeFi protocol integrations
- **Weeks 7-8**: Cocos Creator client refinement and final optimizations

**Time-Critical Development Notes:**
- 该项目目前是一个黑客松的参赛项目，时间非常紧张，还剩1个半月
- 只实现最核心的功能，优先级：游戏逻辑 > 用户界面 > 区块链集成 > DeFi功能
- Git commit message 尽量写的简洁一点
- 每次做修改后，不需要直接帮我commit，我自己还需要修改

## DeFi Integration Strategy

The game integrates multiple Sui ecosystem protocols:
- **Bucket Protocol**: Decentralized game data storage and cross-device synchronization
- **Scallop Protocol**: Property NFT collateral lending system with dynamic interest rates  
- **Navi Protocol**: Token staking for liquidity mining and governance voting

## Testing and Deployment

When implementing features:
- Write comprehensive Move contract tests for all game logic
- Test multiplayer scenarios with WebSocket connections
- Validate DeFi integrations on Sui testnet before mainnet
- Ensure gas fee optimization through batched operations

## Documentation

Key documentation files to reference:
- `docs/project-overview.md` - Complete project vision and goals
- `docs/development-plan.md` - Detailed 8-week implementation timeline  
- `docs/tech/architecture.md` - Full technical architecture design
- `docs/project-structure.md` - Detailed directory organization
- `client/cocos_sui_integration.md` - Cocos Creator + Sui integration strategies

## Development Guidelines

### Current Development Context
- **Active Focus**: Cocos Creator client development and game mechanics
- **Blockchain Integration**: Planned for later phases, Move contracts not yet implemented  
- **Asset Management**: Extensive existing assets in `client/tycoon_cocos/assets/`
- **Game Logic**: Core game systems already partially implemented

### Important Notes
- Prioritize core game functionality over advanced features
- Gas fee optimization will be critical for user experience (when blockchain is integrated)
- The game should work both as single-player demo and multiplayer experience
- All blockchain interactions must be thoroughly tested on Sui devnet/testnet (future phase)
- Security is paramount for smart contract development handling player assets (future phase)

### Cocos Creator Specific Guidelines
- Use Cocos Creator 3.8+ API patterns (not legacy 2.x APIs)
- Follow TypeScript strict typing conventions
- Utilize existing asset pipeline and configuration system
- Maintain game object pooling and performance optimization patterns

### Key Development Files
- **Game Entry**: `assets/scripts/core/GameInitializer.ts` - 游戏启动和初始化
- **Map System**: `assets/scripts/map/MapManager.ts` - 地图管理和瓦片系统
- **Event System**: `assets/scripts/events/EventBus.ts` - 全局事件通信
- **Camera Control**: `assets/scripts/camera/CameraController.ts` - 3D相机控制
- **UI Framework**: `assets/scripts/ui/core/UIManager.ts` - 界面管理

### Project Configuration
- **Package Config**: `package.json` includes fairygui-cc, lodash-es, @tweenjs/tween.js
- **TypeScript Config**: `tsconfig.json` configured for Cocos Creator 3.8+
- **Cocos Creator Version**: 3.8.7 (specified in package.json)

## Keeping This File Updated

This CLAUDE.md file should be kept in sync with project changes. See `CLAUDE-UPDATE-CHECKLIST.md` for detailed update guidelines.

**Quick Update Methods:**
1. **Manual Updates**: Review and update after major project changes
2. **Claude Code /init**: Use `/init` command when project structure changes significantly
3. **Checklist**: Use the update checklist to track what needs updating

**Update Frequency:**
- After each development phase (Weeks 2, 4, 6, 8)
- When major architecture changes occur  
- When new commands or workflows are added

## Important Communication Protocol

**For Claude Code instances:**
- **ALWAYS** use Chinese (中文) when communicating with users
- Code should be in English, but explanations and discussions in Chinese
- This follows the project's `.cursorrules` configuration
- 请使用中文和我对话
- 保持 ES2015 目标，不改 tsconfig