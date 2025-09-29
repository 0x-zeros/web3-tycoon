/**
 * 地图生成器主类 - 基于3阶段生成系统
 *
 * Phase 1: 路径生成 (PathGenerator)
 * Phase 2: 地产放置 (PropertyPlacer)
 * Phase 3: 特殊格子 (SpecialTilePlacer)
 *
 * @author Web3 Tycoon Team
 * @version 2.0.0
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

// 模板类型（仅用于构造默认随机模板）
import { MapTemplateSpec } from './templates/TemplateTypes';

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
     * 生成地图
     */
    async generateMap(): Promise<MapGenerationResult> {
        console.log('[MapGenerator] 开始生成地图 (v2.0 - 3阶段系统)...');
        console.log(this.config.getDebugInfo());

        // 构造简化的默认模板（不依赖外部模板库）
        const template = this.buildDefaultTemplate();
        console.log(`[MapGenerator] 使用默认随机模板: ${template.name}`);

        // ==================== Phase 1: 路径生成 ====================
        console.log('[MapGenerator] Phase 1: 生成路径网络...');
        const pathResult = this.pathGenerator.generateFromTemplate(template);

        // 验证路径间距
        if (!this.pathGenerator.validateSpacing(pathResult.paths, 2)) {
            console.warn('[MapGenerator] 路径间距验证失败，尝试修复...');
            // 可以在这里添加修复逻辑
        }

        console.log(`[MapGenerator] 生成了 ${pathResult.paths.length} 个路径格子`);
        console.log(`[MapGenerator] - 主路径: ${pathResult.mainPath.length} 格`);
        console.log(`[MapGenerator] - 拐角: ${pathResult.corners.length} 个`);
        console.log(`[MapGenerator] - 交叉点: ${pathResult.intersections.length} 个`);

        // ==================== Phase 2: 地产放置 ====================
        console.log('[MapGenerator] Phase 2: 放置地产...');
        const propertyResult = this.propertyPlacer.placeProperties(
            pathResult.paths,
            template,
            pathResult.corners,
            pathResult.intersections
        );

        console.log(`[MapGenerator] 放置了 ${propertyResult.properties.length} 个地产`);
        console.log(`[MapGenerator] - 地产组: ${propertyResult.propertyGroups.length} 组`);
        console.log(`[MapGenerator] - 转换tiles: ${propertyResult.convertedTiles.length} 个`);

        // ==================== Phase 3: 特殊格子 ====================
        console.log('[MapGenerator] Phase 3: 放置特殊格子...');

        // 收集所有已占用的位置
        const occupiedPositions: Vec2[] = [
            ...propertyResult.properties.map(p => p.position),
            ...propertyResult.convertedTiles
        ];

        // 找出空闲的路径tiles（未被地产占用）
        const emptyPathTiles = pathResult.paths.filter(path => {
            const key = CoordUtils.posToKey(path);
            const isOccupied = occupiedPositions.some(
                pos => CoordUtils.posToKey(pos) === key
            );
            return !isOccupied;
        });

        const specialResult = this.specialTilePlacer.placeSpecialTiles(
            emptyPathTiles,
            template,
            occupiedPositions
        );

        console.log(`[MapGenerator] 放置了 ${specialResult.totalPlaced} 个特殊格子`);
        specialResult.distribution.forEach((count, type) => {
            console.log(`[MapGenerator] - ${type}: ${count} 个`);
        });

        // 验证分布平衡性
        if (!this.specialTilePlacer.validateDistribution(specialResult.specialTiles)) {
            console.warn('[MapGenerator] 特殊格子分布不均衡');
        }

        // ==================== 生成最终地图数据 ====================
        console.log('[MapGenerator] 生成最终地图数据...');
        const mapData = this.generateMapData(
            pathResult,
            propertyResult,
            specialResult,
            template
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
            properties: propertyResult.properties,  // 添加地产数据
            width: this.params.mapWidth,
            height: this.params.mapHeight,
            mode: this.params.mode,
            seed: this.params.seed
        };
    }

    /**
     * 构造一个简化的默认模板（单环 + 适量地产/特殊格）
     */
    private buildDefaultTemplate(): MapTemplateSpec {
        // 外环四角基于地图宽高边距生成
        const margin = 5;
        const w = this.params.mapWidth;
        const h = this.params.mapHeight;
        return {
            id: 'default_random',
            name: '随机棋盘',
            layout: 'single_ring',
            tileCount: 40,
            pathConfig: {
                rings: {
                    outer: [
                        new Vec2(margin, margin),
                        new Vec2(w - margin, margin),
                        new Vec2(w - margin, h - margin),
                        new Vec2(margin, h - margin)
                    ]
                }
            },
            propertyConfig: {
                groups: [
                    { color: 'group1', count: 3, size: '1x1', preferredZone: 'straight' },
                    { color: 'group2', count: 3, size: '1x1', preferredZone: 'straight' },
                    { color: 'group3', count: 2, size: '2x2', preferredZone: 'corner' },
                    { color: 'group4', count: 2, size: '2x2', preferredZone: 'corner' }
                ],
                totalRatio: 0.5,
                placement: 'mixed'
            },
            specialTiles: [
                { type: 'chance', count: 3, distribution: 'even' },
                { type: 'bonus', count: 2, distribution: 'even' },
                { type: 'news', count: 2, distribution: 'random' },
                { type: 'hospital', count: 1, distribution: 'random' }
            ]
        };
    }

    /**
     * 生成地图数据
     */
    private generateMapData(
        pathResult: PathGenerationResult,
        propertyResult: PropertyPlacementResult,
        specialResult: SpecialTilePlacementResult,
        template: MapTemplateSpec
    ): {
        tiles: TileData[];
        specialTiles: TileData[];
    } {
        const allTiles: TileData[] = [];
        const specialTiles: TileData[] = [];
        const processedKeys = new Set<string>();

        // 1. 处理地产tiles
        const propertyTiles = this.propertyPlacer.generateTileData(
            pathResult.paths,
            propertyResult.properties,
            propertyResult.convertedTiles
        );

        for (const tile of propertyTiles) {
            const key = CoordUtils.posToKey(new Vec2(tile.x, tile.y));
            if (!processedKeys.has(key)) {
                allTiles.push(tile);
                processedKeys.add(key);
            }
        }

        // 2. 处理特殊格子
        for (const special of specialResult.specialTiles) {
            const key = CoordUtils.posToKey(new Vec2(special.x, special.y));
            if (!processedKeys.has(key)) {
                const tile: TileData = {
                    x: special.x,
                    y: special.y,
                    type: special.type,
                    specialType: special.specialType,
                    value: special.value,
                    group: -1
                };
                allTiles.push(tile);
                specialTiles.push(tile);
                processedKeys.add(key);
            }
        }

        // 3. 处理剩余的空路径tiles
        for (const path of pathResult.paths) {
            const key = CoordUtils.posToKey(path);
            if (!processedKeys.has(key)) {
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

        // 起点不设置特殊类型（使用空地或后续由游戏逻辑选定）

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

        // 计算多样性指数
        const totalSpecial = stats.specialCount;
        let diversity = 0;
        if (totalSpecial > 0) {
            stats.specialTypes.forEach(count => {
                const p = count / totalSpecial;
                if (p > 0) {
                    diversity -= p * Math.log(p);
                }
            });
        }
        stats['diversityIndex'] = diversity;

        // 计算密度
        const totalArea = this.params.mapWidth * this.params.mapHeight;
        stats['density'] = stats.totalTiles / totalArea;
        stats['propertyDensity'] = stats.propertyCount / stats.totalTiles;
        stats['specialDensity'] = stats.specialCount / stats.totalTiles;

        return stats;
    }

    /**
     * 查找起始位置
     */
    private findStartPosition(tiles: TileData[]): Vec2 | null {
        const startTile = null; // 未设置特殊起点
        // 返回第一个空地作为起点候选
        const emptyTile = tiles.find(t => t.type === Web3TileType.EMPTY_LAND);
        if (emptyTile) {
            return new Vec2(emptyTile.x, emptyTile.y);
        }

        return null;
    }

    // 模板列表功能已移除

    /**
     * 根据模板ID生成地图
     */
    async generateFromTemplate(templateId: string): Promise<MapGenerationResult> {
        // 模板功能已移除，忽略传入ID，按默认随机生成
        return this.generateMap();
    }

    /**
     * 导出地图数据为JSON
     */
    exportToJSON(result: MapGenerationResult): string {
        const exportData = {
            version: '2.0',
            generator: 'MapGenerator-3Phase',
            timestamp: new Date().toISOString(),
            seed: this.params.seed,
            template: 'default_random',
            dimensions: {
                width: this.params.mapWidth,
                height: this.params.mapHeight
            },
            tiles: result.tiles,
            specialTiles: result.specialTiles,
            statistics: result.statistics
        };

        return JSON.stringify(exportData, null, 2);
    }
}
