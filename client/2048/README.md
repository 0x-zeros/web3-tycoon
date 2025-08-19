# 2048 Game - Cocos Creator

A simple 2048 game implementation using Cocos Creator 3.8+ with TypeScript.

## Features

- Classic 2048 gameplay
- Keyboard controls (WASD / Arrow keys)
- Touch/swipe controls for mobile
- Score tracking
- Game over detection
- Restart functionality

## Project Structure

```
assets/
├── scripts/
│   ├── GameManager.ts     # Main game logic
│   └── Tile.ts           # Tile component
├── scenes/
│   └── Game.scene        # Main game scene
└── prefabs/
    └── Tile.prefab       # Tile prefab
```

## How to Use

1. Open Cocos Creator 3.8+
2. Open this project folder
3. Set up the scene:
   - Open `assets/scenes/Game.scene`
   - Add a Canvas node if not present
   - Add the GameManager component to the Canvas
   - Assign the Tile prefab to the GameManager
   - Create UI elements for score display and game over message
4. Build and run

## Game Controls

- **Keyboard**: Use WASD or Arrow keys to move tiles
- **Mobile**: Swipe in any direction to move tiles
- **Restart**: Call the `restartGame()` method on GameManager

## Game Logic

The game implements the standard 2048 rules:
- Tiles slide in the chosen direction
- When two tiles with the same number touch, they merge into one
- After each move, a new tile (2 or 4) appears randomly
- Goal is to reach the 2048 tile
- Game ends when no more moves are possible

## Integration with Sui

This game is designed to be integrated with Sui Move smart contracts and TypeScript SDK for Web3 functionality. The GameManager can be extended to:
- Record scores on blockchain
- Create NFTs for achievements
- Implement play-to-earn mechanics
- Store game state on-chain

## Next Steps for Sui Integration

1. Install Sui TypeScript SDK
2. Add wallet connection functionality
3. Create Move contracts for game state/scoring
4. Implement on-chain leaderboards
5. Add NFT rewards system