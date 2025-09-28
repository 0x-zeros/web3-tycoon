/**
 * 地图生成器主类
 *
 * 协调各个子系统，生成完整的Web3大富翁地图
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import {
    MapGeneratorParams,
    MapGenerationResult,
    TileData,
    SpecialTileData,
    CoordUtils
} from './MapGeneratorTypes';
import { MapGeneratorConfig } from './MapGeneratorConfig';
import { RoadNetwork } from './RoadNetwork';
import { PropertyPlacer } from './PropertyPlacer';
import { TrafficAnalyzer } from './TrafficAnalyzer';
import { StreetSegmenter } from './StreetSegmenter';
import { Web3TileType } from '../../voxel/Web3BlockTypes';

/**
 * 地图生成器
 */
export class MapGenerator {
    private config: MapGeneratorConfig;
    private params: MapGeneratorParams;
    private random: () => number;

    constructor(config?: MapGeneratorConfig | Partial<MapGeneratorParams>) {
        if (config instanceof MapGeneratorConfig) {
            this.config = config;
        } else {
            this.config = new MapGeneratorConfig(config);
        }
        this.params = this.config.getParams();
        this.random = this.createRandomGenerator(this.params.seed);
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
        console.log('[MapGenerator] 开始生成地图...');
        console.log(this.config.getDebugInfo());

        // 1. 生成道路网络
        console.log('[MapGenerator] 生成道路网络...');
        const roadNetwork = new RoadNetwork(this.params).generate();
        console.log(`[MapGenerator] 生成了 ${roadNetwork.roads.length} 个道路地块`);

        // 2. 放置地产
        console.log('[MapGenerator] 放置地产...');
        const propertyPlacer = new PropertyPlacer(this.params);
        const properties = propertyPlacer.placeProperties(roadNetwork);
        console.log(`[MapGenerator] 放置了 ${properties.length} 个地产`);

        // 3. 交通分析
        console.log('[MapGenerator] 分析交通流量...');
        const trafficAnalyzer = new TrafficAnalyzer(this.params);
        const trafficAnalysis = trafficAnalyzer.analyze(roadNetwork);

        // 更新地产价格系数
        propertyPlacer.updatePriceCoefficients(trafficAnalysis.hotnessMap);
        console.log(`[MapGenerator] 识别了 ${trafficAnalysis.hotSpots.length} 个热点区域`);

        // 4. 街区分割
        console.log('[MapGenerator] 分割街区...');
        const streetSegmenter = new StreetSegmenter(this.params.mapWidth, this.params.mapHeight);
        const streets = streetSegmenter.segment(roadNetwork, properties);
        console.log(`[MapGenerator] 分割为 ${streets.length} 个街区`);

        // 5. 生成地块数据
        console.log('[MapGenerator] 生成地块数据...');
        const tiles = this.generateTiles(roadNetwork, properties);

        // 6. 放置特殊地块
        console.log('[MapGenerator] 放置特殊地块...');
        const specialTiles = this.placeSpecialTiles(roadNetwork, properties);
        console.log(`[MapGenerator] 放置了 ${specialTiles.length} 个特殊地块`);

        // 7. 计算统计信息
        const statistics = this.calculateStatistics(tiles, properties, specialTiles, trafficAnalysis);

        // 构建最终结果
        const result: MapGenerationResult = {
            width: this.params.mapWidth,
            height: this.params.mapHeight,
            seed: this.params.seed!,
            mode: this.params.mode,
            tiles,
            properties,
            specialTiles,
            roadNetwork,
            streets,
            trafficAnalysis,
            statistics
        };

        console.log('[MapGenerator] 地图生成完成！');
        this.logStatistics(statistics);

        return result;
    }

    /**
     * 生成地块数据
     */
    private generateTiles(roadNetwork: any, properties: any[]): TileData[] {
        const tiles: TileData[] = [];
        const roadSet = new Set(roadNetwork.roads.map((r: Vec2) => CoordUtils.posToKey(r)));
        const propertySet = new Set<string>();

        // 标记地产占用的位置
        for (const property of properties) {
            for (let dx = 0; dx < property.size; dx++) {
                for (let dy = 0; dy < property.size; dy++) {
                    const pos = new Vec2(property.gridPos.x + dx, property.gridPos.y + dy);
                    propertySet.add(CoordUtils.posToKey(pos));
                }
            }
        }

        // 生成所有地块
        for (let x = 0; x < this.params.mapWidth; x++) {
            for (let y = 0; y < this.params.mapHeight; y++) {
                const pos = new Vec2(x, y);
                const key = CoordUtils.posToKey(pos);

                let tile: TileData;

                if (roadSet.has(key)) {
                    // 道路地块
                    tile = {
                        gridPos: pos,
                        blockId: 'web3:empty_land',
                        typeId: Web3TileType.EMPTY_LAND,
                        isRoad: true
                    };
                } else if (propertySet.has(key)) {
                    // 地产占用的地块（使用property tile）
                    tile = {
                        gridPos: pos,
                        blockId: 'web3:property',
                        typeId: Web3TileType.PROPERTY,
                        isRoad: false
                    };
                } else {
                    // 空地
                    tile = {
                        gridPos: pos,
                        blockId: 'web3:empty_land',
                        typeId: Web3TileType.EMPTY_LAND,
                        isRoad: false
                    };
                }

                // 添加交通热度信息
                const trafficKey = CoordUtils.posToKey(pos);
                tile.trafficHotness = this.params.trafficSimulationRounds > 0
                    ? (roadNetwork.roads.findIndex((r: Vec2) => r.equals(pos)) >= 0 ? 0.5 : 0)
                    : 0;

                tiles.push(tile);
            }
        }

        return tiles;
    }

    /**
     * 放置特殊地块
     */
    private placeSpecialTiles(roadNetwork: any, properties: any[]): SpecialTileData[] {
        const specialTiles: SpecialTileData[] = [];
        const occupiedSet = new Set<string>();

        // 标记道路和地产占用的位置
        for (const road of roadNetwork.roads) {
            occupiedSet.add(CoordUtils.posToKey(road));
        }
        for (const property of properties) {
            for (let dx = 0; dx < property.size; dx++) {
                for (let dy = 0; dy < property.size; dy++) {
                    const pos = new Vec2(property.gridPos.x + dx, property.gridPos.y + dy);
                    occupiedSet.add(CoordUtils.posToKey(pos));
                }
            }
        }

        // 计算目标特殊地块数量
        const totalTiles = this.params.mapWidth * this.params.mapHeight;
        const targetSpecialCount = Math.floor(totalTiles * this.params.specialTileRatio);

        // 特殊地块类型映射
        const specialTypeMap: { [key: string]: number } = {
            'web3:bonus': Web3TileType.BONUS,
            'web3:hospital': Web3TileType.HOSPITAL,
            'web3:chance': Web3TileType.CHANCE,
            'web3:card': Web3TileType.CARD,
            'web3:fee': Web3TileType.FEE,
            'web3:news': Web3TileType.NEWS
        };

        // 找到所有可放置位置（邻近道路的空地）
        const availablePositions: Vec2[] = [];
        for (let x = 0; x < this.params.mapWidth; x++) {
            for (let y = 0; y < this.params.mapHeight; y++) {
                const pos = new Vec2(x, y);
                const key = CoordUtils.posToKey(pos);

                if (occupiedSet.has(key)) continue;

                // 检查是否邻近道路
                const neighbors = CoordUtils.getNeighbors(pos);
                const hasRoadNeighbor = neighbors.some(n =>
                    roadNetwork.roads.some((r: Vec2) => r.equals(n))
                );

                if (hasRoadNeighbor) {
                    availablePositions.push(pos);
                }
            }
        }

        // 随机打乱位置
        for (let i = availablePositions.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
        }

        // 放置特殊地块
        const specialTypes = this.params.specialTileTypes.filter(t => t in specialTypeMap);
        let placedCount = 0;

        for (const pos of availablePositions) {
            if (placedCount >= targetSpecialCount) break;

            // 随机选择特殊地块类型
            const typeIndex = Math.floor(this.random() * specialTypes.length);
            const blockId = specialTypes[typeIndex];

            specialTiles.push({
                gridPos: pos,
                blockId: blockId,
                typeId: specialTypeMap[blockId]
            });

            occupiedSet.add(CoordUtils.posToKey(pos));
            placedCount++;
        }

        return specialTiles;
    }

    /**
     * 计算统计信息
     */
    private calculateStatistics(tiles: TileData[], properties: any[], specialTiles: SpecialTileData[], trafficAnalysis: any): any {
        const property1x1Count = properties.filter((p: any) => p.size === 1).length;
        const property2x2Count = properties.filter((p: any) => p.size === 2).length;

        // 计算平均交通热度
        let totalHotness = 0;
        let hotnessCount = 0;
        for (const hotness of trafficAnalysis.hotnessMap.values()) {
            totalHotness += hotness;
            hotnessCount++;
        }

        return {
            totalTiles: tiles.length,
            roadCount: tiles.filter(t => t.isRoad).length,
            propertyCount: properties.length,
            property1x1Count,
            property2x2Count,
            specialTileCount: specialTiles.length,
            averageTrafficHotness: hotnessCount > 0 ? totalHotness / hotnessCount : 0
        };
    }

    /**
     * 输出统计信息
     */
    private logStatistics(stats: any): void {
        console.log('========== 地图生成统计 ==========');
        console.log(`总地块数: ${stats.totalTiles}`);
        console.log(`道路地块: ${stats.roadCount} (${(stats.roadCount / stats.totalTiles * 100).toFixed(1)}%)`);
        console.log(`地产总数: ${stats.propertyCount}`);
        console.log(`  - 1x1地产: ${stats.property1x1Count}`);
        console.log(`  - 2x2地产: ${stats.property2x2Count}`);
        console.log(`特殊地块: ${stats.specialTileCount}`);
        console.log(`平均交通热度: ${stats.averageTrafficHotness.toFixed(3)}`);
        console.log('==================================');
    }

    /**
     * 获取预设配置生成器
     */
    static createWithPreset(preset: 'small' | 'medium' | 'large' | 'classic' | 'brawl'): MapGenerator {
        const config = MapGeneratorConfig.getPresetConfig(preset);
        return new MapGenerator(config);
    }
}