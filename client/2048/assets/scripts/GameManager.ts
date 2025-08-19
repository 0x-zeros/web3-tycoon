import { _decorator, Component, Node, Prefab, instantiate, Vec3, Label, sys } from 'cc';
const { ccclass, property } = _decorator;

interface Tile {
    value: number;
    node: Node;
    row: number;
    col: number;
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property(Prefab)
    tilePrefab: Prefab = null!;

    @property(Node)
    gameBoard: Node = null!;

    @property(Label)
    scoreLabel: Label = null!;

    @property(Label)
    gameOverLabel: Label = null!;

    private gridSize = 4;
    private tileSize = 100;
    private gap = 10;
    private grid: (Tile | null)[][] = [];
    private score = 0;
    private gameOver = false;

    start() {
        this.initializeGrid();
        this.addRandomTile();
        this.addRandomTile();
        this.updateUI();
        this.setupInput();
    }

    private initializeGrid() {
        this.grid = [];
        for (let row = 0; row < this.gridSize; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                this.grid[row][col] = null;
            }
        }
    }

    private addRandomTile() {
        const emptyCells: { row: number; col: number }[] = [];
        
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (!this.grid[row][col]) {
                    emptyCells.push({ row, col });
                }
            }
        }

        if (emptyCells.length === 0) return;

        const randomIndex = Math.floor(Math.random() * emptyCells.length);
        const { row, col } = emptyCells[randomIndex];
        const value = Math.random() < 0.9 ? 2 : 4;

        this.createTile(row, col, value);
    }

    private createTile(row: number, col: number, value: number) {
        const tileNode = instantiate(this.tilePrefab);
        const position = this.getTilePosition(row, col);
        
        tileNode.setPosition(position);
        this.gameBoard.addChild(tileNode);

        // Set tile value display
        const label = tileNode.getComponentInChildren(Label);
        if (label) {
            label.string = value.toString();
        }

        const tile: Tile = {
            value,
            node: tileNode,
            row,
            col
        };

        this.grid[row][col] = tile;
    }

    private getTilePosition(row: number, col: number): Vec3 {
        const startX = -(this.gridSize - 1) * (this.tileSize + this.gap) / 2;
        const startY = (this.gridSize - 1) * (this.tileSize + this.gap) / 2;
        
        const x = startX + col * (this.tileSize + this.gap);
        const y = startY - row * (this.tileSize + this.gap);
        
        return new Vec3(x, y, 0);
    }

    private setupInput() {
        this.node.on(Node.EventType.KEY_DOWN, this.onKeyDown, this);
        
        // Touch input for mobile
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    private touchStart: Vec3 = new Vec3();
    
    private onTouchStart(event: any) {
        this.touchStart = event.getLocation();
    }

    private onTouchEnd(event: any) {
        const touchEnd = event.getLocation();
        const diff = touchEnd.subtract(this.touchStart);
        const threshold = 50;

        if (Math.abs(diff.x) > Math.abs(diff.y)) {
            if (diff.x > threshold) {
                this.move('right');
            } else if (diff.x < -threshold) {
                this.move('left');
            }
        } else {
            if (diff.y > threshold) {
                this.move('up');
            } else if (diff.y < -threshold) {
                this.move('down');
            }
        }
    }

    private onKeyDown(event: any) {
        if (this.gameOver) return;

        switch (event.keyCode) {
            case 87: // W
            case 38: // Up Arrow
                this.move('up');
                break;
            case 83: // S
            case 40: // Down Arrow
                this.move('down');
                break;
            case 65: // A
            case 37: // Left Arrow
                this.move('left');
                break;
            case 68: // D
            case 39: // Right Arrow
                this.move('right');
                break;
        }
    }

    private move(direction: 'up' | 'down' | 'left' | 'right') {
        let moved = false;
        const newGrid: (Tile | null)[][] = [];
        
        // Initialize new grid
        for (let i = 0; i < this.gridSize; i++) {
            newGrid[i] = new Array(this.gridSize).fill(null);
        }

        if (direction === 'left' || direction === 'right') {
            for (let row = 0; row < this.gridSize; row++) {
                const rowTiles = this.getRowTiles(row, direction === 'right');
                const mergedRow = this.mergeTiles(rowTiles);
                
                for (let col = 0; col < mergedRow.length; col++) {
                    if (mergedRow[col]) {
                        const targetCol = direction === 'right' ? this.gridSize - 1 - col : col;
                        newGrid[row][targetCol] = mergedRow[col];
                        
                        if (mergedRow[col]!.row !== row || mergedRow[col]!.col !== targetCol) {
                            moved = true;
                        }
                        
                        mergedRow[col]!.row = row;
                        mergedRow[col]!.col = targetCol;
                    }
                }
            }
        } else {
            for (let col = 0; col < this.gridSize; col++) {
                const colTiles = this.getColTiles(col, direction === 'down');
                const mergedCol = this.mergeTiles(colTiles);
                
                for (let row = 0; row < mergedCol.length; row++) {
                    if (mergedCol[row]) {
                        const targetRow = direction === 'down' ? this.gridSize - 1 - row : row;
                        newGrid[targetRow][col] = mergedCol[row];
                        
                        if (mergedCol[row]!.row !== targetRow || mergedCol[row]!.col !== col) {
                            moved = true;
                        }
                        
                        mergedCol[row]!.row = targetRow;
                        mergedCol[row]!.col = col;
                    }
                }
            }
        }

        if (moved) {
            this.grid = newGrid;
            this.updateTilePositions();
            this.addRandomTile();
            this.updateUI();
            this.checkGameOver();
        }
    }

    private getRowTiles(row: number, reverse: boolean): (Tile | null)[] {
        const tiles: (Tile | null)[] = [];
        for (let col = 0; col < this.gridSize; col++) {
            tiles.push(this.grid[row][col]);
        }
        return reverse ? tiles.reverse() : tiles;
    }

    private getColTiles(col: number, reverse: boolean): (Tile | null)[] {
        const tiles: (Tile | null)[] = [];
        for (let row = 0; row < this.gridSize; row++) {
            tiles.push(this.grid[row][col]);
        }
        return reverse ? tiles.reverse() : tiles;
    }

    private mergeTiles(tiles: (Tile | null)[]): (Tile | null)[] {
        const filtered = tiles.filter(tile => tile !== null) as Tile[];
        const merged: Tile[] = [];
        
        let i = 0;
        while (i < filtered.length) {
            if (i < filtered.length - 1 && filtered[i].value === filtered[i + 1].value) {
                // Merge tiles
                const newValue = filtered[i].value * 2;
                this.score += newValue;
                
                // Remove the second tile
                filtered[i + 1].node.destroy();
                
                // Update first tile
                filtered[i].value = newValue;
                const label = filtered[i].node.getComponentInChildren(Label);
                if (label) {
                    label.string = newValue.toString();
                }
                
                merged.push(filtered[i]);
                i += 2;
            } else {
                merged.push(filtered[i]);
                i++;
            }
        }
        
        // Fill with nulls
        while (merged.length < this.gridSize) {
            merged.push(null);
        }
        
        return merged;
    }

    private updateTilePositions() {
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const tile = this.grid[row][col];
                if (tile) {
                    const position = this.getTilePosition(row, col);
                    tile.node.setPosition(position);
                }
            }
        }
    }

    private updateUI() {
        if (this.scoreLabel) {
            this.scoreLabel.string = `Score: ${this.score}`;
        }
    }

    private checkGameOver() {
        // Check for empty cells
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (!this.grid[row][col]) {
                    return; // Game not over
                }
            }
        }

        // Check for possible merges
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const current = this.grid[row][col];
                if (!current) continue;

                // Check right neighbor
                if (col < this.gridSize - 1 && this.grid[row][col + 1]?.value === current.value) {
                    return; // Game not over
                }

                // Check bottom neighbor
                if (row < this.gridSize - 1 && this.grid[row + 1][col]?.value === current.value) {
                    return; // Game not over
                }
            }
        }

        this.gameOver = true;
        if (this.gameOverLabel) {
            this.gameOverLabel.node.active = true;
        }
    }

    public restartGame() {
        // Clear existing tiles
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const tile = this.grid[row][col];
                if (tile) {
                    tile.node.destroy();
                }
            }
        }

        this.score = 0;
        this.gameOver = false;
        if (this.gameOverLabel) {
            this.gameOverLabel.node.active = false;
        }

        this.initializeGrid();
        this.addRandomTile();
        this.addRandomTile();
        this.updateUI();
    }
}