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
import { getDefaultClassicTemplate } from './templates/TemplateLibrary';
import { TemplateBuilder } from './templates/TemplateBuilder';
import { RuleBasedPropertyPlacer } from './templates/RuleBasedPropertyPlacer';
import { MapGenerationMode } from './MapGeneratorTypes';

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

        // 1. 生成道路网络（Classic 走模板，Brawl 走旧随机）
        console.log('[MapGenerator] 生成道路网络...');
        let roadNetwork: any;
        let templateBuilt: any = null;
        if (this.params.mode === MapGenerationMode.CLASSIC) {
            const builder = new TemplateBuilder(this.params.mapWidth, this.params.mapHeight, this.random);
            templateBuilt = builder.build(getDefaultClassicTemplate());

            // 将模板构建结果转为 RoadNetworkData（重用已有分析流程）
            const connectivity = new Map<string, Vec2[]>();
            const roadSet = new Set(templateBuilt.roads.map((r: Vec2) => CoordUtils.posToKey(r)));
            for (const p of templateBuilt.roads as Vec2[]) {
                const neigh = CoordUtils.getNeighbors(p).filter(n => roadSet.has(CoordUtils.posToKey(n)));
                connectivity.set(CoordUtils.posToKey(p), neigh);
            }
            const intersections: Vec2[] = [];
            for (const [key, neigh] of connectivity.entries()) if (neigh.length >= 3) intersections.push(CoordUtils.keyToPos(key));
            roadNetwork = {
                roads: templateBuilt.roads,
                mainRoads: templateBuilt.roads, // 简化：全部视作主路
                sideRoads: [],
                intersections,
                connectivity
            };
        } else {
            roadNetwork = new RoadNetwork(this.params).generate();
        }
        console.log(`[MapGenerator] 生成了 ${roadNetwork.roads.length} 个道路地块`);

        // 2. 放置地产（Classic 使用规则包，否则用旧版）
        console.log('[MapGenerator] 放置地产...');
        let properties: any[] = [];
        let legacyPlacer: PropertyPlacer | null = null;
        if (this.params.mode === MapGenerationMode.CLASSIC && templateBuilt) {
            const quotas = getDefaultClassicTemplate().quotas || {};
            const bigCfg = quotas.big2x2 || { count: [3, 5], minStraight: 7, minSpacing: 6 };
            const stride = (quotas.smallLand?.stride as [number, number]) || [2, 3];
            const bigCount = Math.max(3, Math.min(8, this.randomCount(bigCfg.count || [3, 5])));
            const placer = new RuleBasedPropertyPlacer(this.random, roadNetwork.roads);
            properties = placer.place(templateBuilt.rings, {
                mapWidth: this.params.mapWidth,
                mapHeight: this.params.mapHeight,
                stride,
                minStraight: bigCfg.minStraight || 7,
                big2x2Count: bigCount,
                minBigSpacing: bigCfg.minSpacing || 6
            });
        } else {
            legacyPlacer = new PropertyPlacer(this.params);
            properties = legacyPlacer.placeProperties(roadNetwork);
        }
        console.log(`[MapGenerator] 放置了 ${properties.length} 个地产`);

        // 3. 交通分析
        console.log('[MapGenerator] 分析交通流量...');
        const trafficAnalyzer = new TrafficAnalyzer(this.params);
        const trafficAnalysis = trafficAnalyzer.analyze(roadNetwork);

        // 更新地产价格系数
        if (this.params.mode === MapGenerationMode.CLASSIC && properties) {
            this.updatePropertyCoefficients(properties, trafficAnalysis.hotnessMap);
        } else {
            legacyPlacer?.updatePriceCoefficients(trafficAnalysis.hotnessMap);
        }
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

    private updatePropertyCoefficients(properties: any[], hotnessMap: Map<string, number>) {
        for (const property of properties) {
            let totalHotness = 0; let count = 0;
            for (let dx = 0; dx < property.size; dx++) {
                for (let dy = 0; dy < property.size; dy++) {
                    const checkPos = new Vec2(property.gridPos.x + dx, property.gridPos.y + dy);
                    const key = CoordUtils.posToKey(checkPos);
                    const hot = hotnessMap.get(key) || 0;
                    totalHotness += hot; count++;
                }
            }
            const avg = count > 0 ? totalHotness / count : 0;
            property.priceCoefficient = 0.5 + avg * 1.5; // 与旧逻辑保持一致区间
        }
    }

    private randomCount(range: [number, number]): number {
        const [a, b] = range; return Math.floor(this.random() * (b - a + 1)) + a;
    }

    /**
     * 生成地块数据
     * 仅输出可行走路径（道路）上的tile，避免铺满整张地图。
     */
    private generateTiles(roadNetwork: any, _properties: any[]): TileData[] {
        const tiles: TileData[] = [];

        for (const pos of roadNetwork.roads as Vec2[]) {
            const tile: TileData = {
                gridPos: pos,
                blockId: 'web3:empty_land', // 行走路径默认显示为空地/路面
                typeId: Web3TileType.EMPTY_LAND,
                isRoad: true,
                trafficHotness: 0
            };
            tiles.push(tile);
        }

        return tiles;
    }

    /**
     * 放置特殊地块
     */
    private placeSpecialTiles(roadNetwork: any, _properties: any[]): SpecialTileData[] {
        const specialTiles: SpecialTileData[] = [];

        // 将特殊地块直接放置在行走路径上（大富翁风格）
        const roadPositions: Vec2[] = roadNetwork.roads as Vec2[];

        // 目标数量：按路径长度的比例计算
        const totalPath = roadPositions.length;
        const targetSpecialCount = Math.min(
            Math.max(2, Math.floor(totalPath * this.params.specialTileRatio)),
            totalPath
        );

        // 可用的特殊类型
        const specialTypeMap: { [key: string]: number } = {
            'web3:bonus': Web3TileType.BONUS,
            'web3:hospital': Web3TileType.HOSPITAL,
            'web3:chance': Web3TileType.CHANCE,
            'web3:card': Web3TileType.CARD,
            'web3:fee': Web3TileType.FEE,
            'web3:news': Web3TileType.NEWS
        };
        const specialTypes = this.params.specialTileTypes.filter(t => t in specialTypeMap);
        if (specialTypes.length === 0) return specialTiles;

        // 打乱路径上的候选点，避免集中
        const candidates = [...roadPositions];
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        // 简单的最小间隔规则：避免相邻格就放特殊格
        const chosen = new Set<string>();
        const minNeighborGap = 2;

        const isFarEnough = (pos: Vec2): boolean => {
            for (const cKey of chosen.values()) {
                const cPos = CoordUtils.keyToPos(cKey);
                if (CoordUtils.manhattanDistance(pos, cPos) < minNeighborGap) return false;
            }
            return true;
        };

        for (const pos of candidates) {
            if (specialTiles.length >= targetSpecialCount) break;
            if (!isFarEnough(pos)) continue;

            const typeIndex = Math.floor(this.random() * specialTypes.length);
            const blockId = specialTypes[typeIndex];

            specialTiles.push({
                gridPos: pos,
                blockId,
                typeId: specialTypeMap[blockId]
            });
            chosen.add(CoordUtils.posToKey(pos));
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
