# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web3 Tycoon is a Sui blockchain-based Monopoly game that combines classic board game mechanics with modern DeFi protocols. This is an 8-week hackathon project integrating Sui Network + Move smart contracts + Cocos Creator frontend + DeFi protocols (Bucket, Scallop, Navi).

## Key Technologies

- **Blockchain**: Sui Network with Move language for smart contracts
- **Frontend**: Cocos Creator (game engine) with TypeScript 
- **Backend**: Node.js/TypeScript for multiplayer matchmaking
- **DeFi Integration**: Bucket Protocol (data storage), Scallop Protocol (lending), Navi Protocol (liquidity mining)

## Development Commands

Currently this project is in the early planning phase with mostly documentation. Based on the planned architecture:

### Move Contract Development
```bash
# Navigate to contracts directory (when it exists)
cd move/
# Build Move contracts
sui move build
# Test contracts  
sui move test
# Deploy to testnet
sui move publish --gas-budget 20000000
```

### Frontend Development (Console Demo)
```bash
# Navigate to client console demo (when it exists)
cd client/console-demo
# Install dependencies
npm install
# Run development server
npm run dev
```

### Backend Services
```bash
# Navigate to server directory (when it exists) 
cd server/
# Install dependencies
npm install
# Start matchmaking server
npm run dev
```

### Tools
```bash
# Map editor (when it exists)
cd tools/map-editor
npm install
npm run dev

# VSCode extension for markdown image pasting
cd tools/md-paste-image-extension  
npm install
npm run lint
npm run test
```

## Project Structure

The repository follows this structure:
- `move/` - Move smart contracts for game logic, properties, NFTs, and DeFi integration
- `server/` - Node.js backend for multiplayer matchmaking and API services
- `client/` - Frontend applications including console demo and future Cocos Creator project
- `docs/` - Comprehensive documentation including design, technical specs, and API docs
- `tools/` - Development tools like map editor and asset generators
- `assets/` - Game assets and resources

## Code Conventions

Based on .cursorrules file:
- All code must be written in English
- Code comments primarily in Chinese, mixed with English for technical terms
- String literals and error messages in English
- Move code follows Sui Move best practices
- TypeScript code follows Cocos Creator development standards
- Use English for file naming with kebab_case convention
- Git commit messages must be in Chinese using format: `类型: 简短描述`

## Architecture Notes

This is a multi-layered Web3 game with:

1. **Blockchain Layer**: Sui smart contracts handle game state, property ownership, NFTs, and DeFi integrations
2. **Server Layer**: Node.js services for real-time multiplayer matching and game room management  
3. **Client Layer**: Multiple client types - console demo for rapid prototyping, Cocos Creator for full game experience
4. **Integration Layer**: DeFi protocol connections for advanced game features like property lending and liquidity mining

## Development Phases

The project follows a planned 8-week development cycle:
- Weeks 1-2: Basic architecture and Move contract framework
- Weeks 3-4: Multiplayer system and core game mechanics  
- Weeks 5-6: DeFi protocol integrations
- Weeks 7-8: Cocos Creator client and final optimizations

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

## Important Notes

- This project prioritizes core game functionality over advanced features
- Gas fee optimization is critical for user experience  
- The game should work both as single-player demo and multiplayer experience
- All blockchain interactions should be thoroughly tested on Sui devnet/testnet
- Security is paramount for smart contract development handling player assets

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