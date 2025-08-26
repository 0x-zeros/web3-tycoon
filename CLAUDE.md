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

### Move Contract Development
```bash
# Navigate to contracts directory
cd move/
# Build Move contracts
sui move build
# Test contracts  
sui move test
# Deploy to testnet
sui move publish --gas-budget 20000000
```

### Cocos Creator Client
```bash
# Navigate to main Cocos project
cd client/tycoon_cocos
# Install dependencies
npm install
# Open in Cocos Creator 3.8+
# Or run development commands through Creator's interface
```

### Backend Services
```bash
# Navigate to server directory
cd server/
# Install dependencies (when implemented)
npm install
# Start matchmaking server (when implemented)
npm run dev
```

### Development Tools
```bash
# VSCode extension for markdown image pasting
cd tools/md-paste-image-extension  
npm install
npm run lint
npm run test

# Map editor (when it exists)
cd tools/map-editor
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
  - `md-paste-image-extension/` - Working VSCode extension for pasting images into markdown
  - `map-editor/` - Planned map editing tool
- `assets/` - Game assets and shared resources

## Active Development Focus

**Primary Client**: `client/tycoon_cocos/` contains the active Cocos Creator project:
- Uses Cocos Creator 3.8.7 with TypeScript
- Contains game scenes, scripts, assets, and configurations
- Includes shooting game mechanics that can be adapted for Web3 Tycoon
- Has complete asset pipeline with textures, animations, and audio

## Code Conventions

Based on `.cursorrules` file:
- **Code Language**: All code must be written in English
- **Comments**: Primarily Chinese, with English for technical terms
- **Strings/Messages**: English for error messages and string literals
- **File Naming**: English with kebab_case convention
- **Git Commits**: Chinese format: `类型: 简短描述`
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
- **Core Scripts**: `Game.ts`, `Player.ts`, `PlayScene.ts` for main game logic
- **Configuration**: `assets/data/config.ts` and `assets/data/types.ts` for game settings
- **Assets Pipeline**: Organized textures, animations, audio, and prefabs
- **Scene Management**: Multiple game scenes with proper TypeScript organization
- **Dependencies**: Uses `@tweenjs/tween.js` for animations

## Development Phases

8-week development cycle as documented in `docs/development-plan.md`:
- **Weeks 1-2**: Basic architecture and Move contract framework ← *Current Phase*
- **Weeks 3-4**: Multiplayer system and core game mechanics  
- **Weeks 5-6**: DeFi protocol integrations
- **Weeks 7-8**: Cocos Creator client refinement and final optimizations

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