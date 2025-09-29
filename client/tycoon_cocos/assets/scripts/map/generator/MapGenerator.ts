/**
 * 地图生成器主类 - 基于3阶段生成系统
 *
 * Phase 1: 路径生成 (PathGenerator)
 * Phase 2: 地产放置 (PropertyPlacer)
 * Phase 3: 特殊格子 (SpecialTilePlacer)
 *
 * 纯随机生成，不依赖模板
 *
 * @author Web3 Tycoon Team
 * @version 3.0.0
 */

import { Vec2 } from 'cc';
import {
    MapGeneratorParams,
    MapGenerationResult,
    TileData,
    CoordUtils
} from './MapGeneratorTypes';
import { MapGeneratorConfig } from './MapGeneratorConfig';
import { Web3TileType } from '../../voxel/Web3BlockTypes';

// 新的生成器
import { PathGenerator, PathGenerationResult } from './PathGenerator';
import { PropertyPlacer, PropertyPlacementResult, PropertyData } from './PropertyPlacer';
import { SpecialTilePlacer, SpecialTilePlacementResult } from './SpecialTilePlacer';

/**
 * 地图生成器
 */
export class MapGenerator {
    private config: MapGeneratorConfig;
    private params: MapGeneratorParams;
    private random: () => number;

    // 3阶段生成器
    private pathGenerator: PathGenerator;
    private propertyPlacer: PropertyPlacer;
    private specialTilePlacer: SpecialTilePlacer;

    constructor(config?: MapGeneratorConfig | Partial<MapGeneratorParams>) {
        if (config instanceof MapGeneratorConfig) {
            this.config = config;
        } else {
            this.config = new MapGeneratorConfig(config);
        }
        this.params = this.config.getParams();
        this.random = this.createRandomGenerator(this.params.seed);

        // 初始化生成器
        this.pathGenerator = new PathGenerator(
            this.params.mapWidth,
            this.params.mapHeight,
            this.random
        );

        this.propertyPlacer = new PropertyPlacer(
            this.params.mapWidth,
            this.params.mapHeight,
            this.random
        );

        this.specialTilePlacer = new SpecialTilePlacer(
            this.params.mapWidth,
            this.params.mapHeight,
            this.random
        );
    }

    /**
     * 创建随机数生成器
     */
    private createRandomGenerator(seed?: number): () => number {
        if (!seed) {
            seed = Date.now();
            this.params.seed = seed;
        }

        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) % 2147483647;
            return s / 2147483647;
        };
    }

    /**
     * 生成地图（纯随机，不依赖模板）
     */
    async generateMap(): Promise<MapGenerationResult> {
        console.log('[MapGenerator] 开始生成随机地图 (v3.0 - 纯随机系统)...');
        console.log(`[MapGenerator] 地图大小: ${this.params.mapWidth}x${this.params.mapHeight}`);
        console.log(`[MapGenerator] 随机种子: ${this.params.seed}`);

        // ==================== Phase 1: 路径生成 ====================
        console.log('[MapGenerator] Phase 1: 生成随机路径网络...');
        const pathResult = this.pathGenerator.generate(); // 不再需要模板

        console.log(`[MapGenerator] 生成了 ${pathResult.paths.length} 个路径格子`);
        console.log(`[MapGenerator] - 主路径: ${pathResult.mainPath.length} 格`);
        console.log(`[MapGenerator] - 拐角: ${pathResult.corners.length} 个`);

        // ==================== Phase 2: 地产放置 ====================
        console.log('[MapGenerator] Phase 2: 随机放置地产...');
        const propertyResult = this.propertyPlacer.placeProperties(pathResult.paths);

        console.log(`[MapGenerator] 放置了 ${propertyResult.properties.length} 个地产`);

        // ==================== Phase 3: 特殊格子 ====================
        console.log('[MapGenerator] Phase 3: 随机放置特殊格子...');

        // 收集所有已占用的位置（地产占用的位置）
        const occupiedPositions: Vec2[] = [];
        for (const prop of propertyResult.properties) {
            occupiedPositions.push(prop.position);
            // 如果是2x2地产，还要占用其他3个格子
            if (prop.size === '2x2') {
                occupiedPositions.push(new Vec2(prop.position.x + 1, prop.position.y));
                occupiedPositions.push(new Vec2(prop.position.x, prop.position.y + 1));
                occupiedPositions.push(new Vec2(prop.position.x + 1, prop.position.y + 1));
            }
        }

        // 找出空闲的路径tiles
        const emptyPathTiles = pathResult.paths.filter(path => {
            const key = CoordUtils.posToKey(path);
            const isOccupied = occupiedPositions.some(
                pos => CoordUtils.posToKey(pos) === key
            );
            return !isOccupied;
        });

        const specialResult = this.specialTilePlacer.placeSpecialTiles(
            emptyPathTiles,
            occupiedPositions
        );

        console.log(`[MapGenerator] 放置了 ${specialResult.totalPlaced} 个特殊格子`);
        specialResult.distribution.forEach((count, type) => {
            console.log(`[MapGenerator] - ${type}: ${count} 个`);
        });

        // ==================== 生成最终地图数据 ====================
        console.log('[MapGenerator] 生成最终地图数据...');
        const mapData = this.generateMapData(
            pathResult,
            propertyResult,
            specialResult
        );

        // 生成统计信息
        const stats = this.generateStatistics(mapData);
        console.log('[MapGenerator] 地图生成完成！');
        console.log(`[MapGenerator] 总tiles: ${mapData.tiles.length}`);
        console.log(`[MapGenerator] - 空地: ${stats.emptyCount}`);
        console.log(`[MapGenerator] - 地产: ${stats.propertyCount}`);
        console.log(`[MapGenerator] - 特殊: ${stats.specialCount}`);

        return {
            tiles: mapData.tiles,
            specialTiles: mapData.specialTiles,
            roads: pathResult.paths,
            mainRoads: pathResult.mainPath,
            sideRoads: pathResult.sidePaths.flat(),
            intersections: pathResult.intersections,
            startPosition: this.findStartPosition(mapData.tiles),
            statistics: stats,
            properties: propertyResult.properties,  // 地产数据
            width: this.params.mapWidth,
            height: this.params.mapHeight,
            mode: this.params.mode,
            seed: this.params.seed
        };
    }

    /**
     * 生成地图数据
     */
    private generateMapData(
        pathResult: PathGenerationResult,
        propertyResult: PropertyPlacementResult,
        specialResult: SpecialTilePlacementResult
    ): {
        tiles: TileData[];
        specialTiles: TileData[];
    } {
        const allTiles: TileData[] = [];
        const specialTiles: TileData[] = [];
        const processedKeys = new Set<string>();

        // 1. 处理特殊格子
        for (const special of specialResult.specialTiles) {
            const key = CoordUtils.posToKey(new Vec2(special.x, special.y));
            if (!processedKeys.has(key)) {
                allTiles.push(special);
                specialTiles.push(special);
                processedKeys.add(key);
            }
        }

        // 2. 处理剩余的空路径tiles
        for (const path of pathResult.paths) {
            const key = CoordUtils.posToKey(path);
            if (!processedKeys.has(key)) {
                // 检查是否被地产占用
                let isOccupiedByProperty = false;
                for (const prop of propertyResult.properties) {
                    if (prop.position.x === path.x && prop.position.y === path.y) {
                        isOccupiedByProperty = true;
                        break;
                    }
                    // 检查2x2地产的其他格子
                    if (prop.size === '2x2') {
                        if ((prop.position.x + 1 === path.x && prop.position.y === path.y) ||
                            (prop.position.x === path.x && prop.position.y + 1 === path.y) ||
                            (prop.position.x + 1 === path.x && prop.position.y + 1 === path.y)) {
                            isOccupiedByProperty = true;
                            break;
                        }
                    }
                }

                if (!isOccupiedByProperty) {
                    const tile: TileData = {
                        x: path.x,
                        y: path.y,
                        type: Web3TileType.EMPTY_LAND,
                        value: 0,
                        group: -1
                    };
                    allTiles.push(tile);
                    processedKeys.add(key);
                }
            }
        }

        // 3. 设置起点（第一个空地tile）
        if (allTiles.length > 0) {
            const startTile = allTiles.find(t => t.type === Web3TileType.EMPTY_LAND);
            if (startTile) {
                startTile.specialType = 'start';
            }
        }

        return { tiles: allTiles, specialTiles };
    }

    /**
     * 生成统计信息
     */
    private generateStatistics(mapData: { tiles: TileData[] }): any {
        const stats = {
            totalTiles: mapData.tiles.length,
            emptyCount: 0,
            propertyCount: 0,
            specialCount: 0,
            startCount: 0,
            propertyGroups: new Map<number, number>(),
            specialTypes: new Map<string, number>()
        };

        for (const tile of mapData.tiles) {
            switch (tile.type) {
                case Web3TileType.EMPTY_LAND:
                    stats.emptyCount++;
                    break;
                case Web3TileType.PROPERTY:
                    stats.propertyCount++;
                    if (tile.group !== undefined && tile.group >= 0) {
                        const count = stats.propertyGroups.get(tile.group) || 0;
                        stats.propertyGroups.set(tile.group, count + 1);
                    }
                    break;
                case Web3TileType.HOSPITAL:
                case Web3TileType.CHANCE:
                case Web3TileType.NEWS:
                case Web3TileType.BONUS:
                case Web3TileType.FEE:
                case Web3TileType.CARD:
                    stats.specialCount++;
                    if (tile.specialType) {
                        const count = stats.specialTypes.get(tile.specialType) || 0;
                        stats.specialTypes.set(tile.specialType, count + 1);
                    }
                    break;
            }
        }

        // 计算密度
        const totalArea = this.params.mapWidth * this.params.mapHeight;
        stats['density'] = stats.totalTiles / totalArea;
        stats['emptyDensity'] = stats.emptyCount / stats.totalTiles;
        stats['specialDensity'] = stats.specialCount / stats.totalTiles;

        return stats;
    }

    /**
     * 查找起始位置
     */
    private findStartPosition(tiles: TileData[]): Vec2 | null {
        // 优先找标记为start的格子
        const startTile = tiles.find(t => t.specialType === 'start');
        if (startTile) {
            return new Vec2(startTile.x, startTile.y);
        }

        // 如果没有，返回第一个空地
        const emptyTile = tiles.find(t => t.type === Web3TileType.EMPTY_LAND);
        if (emptyTile) {
            return new Vec2(emptyTile.x, emptyTile.y);
        }

        return null;
    }

    /**
     * 根据模板ID生成地图（为兼容性保留）
     */
    async generateFromTemplate(templateId: string): Promise<MapGenerationResult> {
        // 忽略templateId，直接生成随机地图
        console.log(`[MapGenerator] 忽略模板ID '${templateId}'，生成随机地图`);
        return this.generateMap();
    }

    /**
     * 导出地图数据为JSON
     */
    exportToJSON(result: MapGenerationResult): string {
        const exportData = {
            version: '3.0',
            generator: 'MapGenerator-Random',
            timestamp: new Date().toISOString(),
            seed: this.params.seed,
            dimensions: {
                width: this.params.mapWidth,
                height: this.params.mapHeight
            },
            tiles: result.tiles,
            specialTiles: result.specialTiles,
            properties: result.properties,
            statistics: result.statistics
        };

        return JSON.stringify(exportData, null, 2);
    }
}