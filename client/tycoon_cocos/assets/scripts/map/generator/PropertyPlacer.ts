/**
 * 地产放置器
 *
 * 负责在道路网络基础上放置地产
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import {
    MapGeneratorParams,
    PropertyData,
    RoadNetworkData,
    CoordUtils
} from './MapGeneratorTypes';
import { Web3PropertyType } from '../../voxel/Web3BlockTypes';

/**
 * 地产放置器
 */
export class PropertyPlacer {
    private params: MapGeneratorParams;
    private random: () => number;
    private roadSet: Set<string>;
    private occupiedSet: Set<string> = new Set();
    private properties: PropertyData[] = [];

    constructor(params: MapGeneratorParams) {
        this.params = params;
        this.random = this.createRandomGenerator(params.seed);
        this.roadSet = new Set();
    }

    /**
     * 创建随机数生成器
     */
    private createRandomGenerator(seed?: number): () => number {
        if (!seed) {
            return Math.random;
        }

        let s = seed ? seed + 1000 : 1000; // 偏移种子，避免与道路生成重复
        return () => {
            s = (s * 1664525 + 1013904223) % 2147483647;
            return s / 2147483647;
        };
    }

    /**
     * 放置地产
     */
    placeProperties(roadNetwork: RoadNetworkData): PropertyData[] {
        this.properties = [];
        this.occupiedSet.clear();

        // 初始化道路集合
        this.roadSet = new Set(roadNetwork.roads.map(r => CoordUtils.posToKey(r)));

        // 查找所有可放置地产的位置
        const availablePositions = this.findAvailablePositions();

        // 计算目标地产数量
        const totalNonRoadTiles = this.params.mapWidth * this.params.mapHeight - roadNetwork.roads.length;
        const targetPropertyCount = Math.floor(totalNonRoadTiles * this.params.propertyRatio);
        const target2x2Count = Math.floor(targetPropertyCount * this.params.property2x2Ratio);
        const target1x1Count = targetPropertyCount - target2x2Count * 4; // 2x2占4格

        // 先放置2x2地产
        this.place2x2Properties(availablePositions, target2x2Count);

        // 再放置1x1地产
        this.place1x1Properties(availablePositions, target1x1Count);

        return this.properties;
    }

    /**
     * 查找所有可放置地产的位置
     */
    private findAvailablePositions(): Vec2[] {
        const positions: Vec2[] = [];

        for (let x = 0; x < this.params.mapWidth; x++) {
            for (let y = 0; y < this.params.mapHeight; y++) {
                const pos = new Vec2(x, y);
                const key = CoordUtils.posToKey(pos);

                // 跳过道路和已占用位置
                if (this.roadSet.has(key) || this.occupiedSet.has(key)) {
                    continue;
                }

                // 必须邻近道路
                if (this.isAdjacentToRoad(pos)) {
                    positions.push(pos);
                }
            }
        }

        // 随机打乱顺序
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        return positions;
    }

    /**
     * 放置2x2地产
     */
    private place2x2Properties(availablePositions: Vec2[], targetCount: number): void {
        let placedCount = 0;

        for (const pos of availablePositions) {
            if (placedCount >= targetCount) break;

            // 检查是否可以放置2x2地产
            if (this.canPlace2x2Property(pos)) {
                const property: PropertyData = {
                    gridPos: pos.clone(),
                    blockId: 'web3:property_2x2',  // 使用通用的2x2地产类型
                    size: 2,
                    priceCoefficient: 1.0, // 稍后由交通分析计算
                    streetId: 0, // 稍后由街区分割分配
                    colorGroup: '' // 稍后分配
                };

                this.properties.push(property);
                this.markOccupied(pos, 2);
                placedCount++;
            }
        }
    }

    /**
     * 放置1x1地产
     */
    private place1x1Properties(availablePositions: Vec2[], targetCount: number): void {
        let placedCount = 0;

        for (const pos of availablePositions) {
            if (placedCount >= targetCount) break;

            const key = CoordUtils.posToKey(pos);

            // 跳过已占用位置
            if (this.occupiedSet.has(key)) continue;

            // 检查最小间距
            if (!this.checkMinSpacing(pos, 1)) continue;

            const property: PropertyData = {
                gridPos: pos.clone(),
                blockId: 'web3:property_1x1',  // 使用新的1x1地产名称
                size: 1,
                priceCoefficient: 1.0, // 稍后由交通分析计算
                streetId: 0, // 稍后由街区分割分配
                colorGroup: '' // 稍后分配
            };

            this.properties.push(property);
            this.markOccupied(pos, 1);
            placedCount++;
        }
    }

    /**
     * 检查是否可以放置2x2地产
     */
    private canPlace2x2Property(pos: Vec2): boolean {
        // 检查2x2区域是否都可用
        for (let dx = 0; dx < 2; dx++) {
            for (let dy = 0; dy < 2; dy++) {
                const checkPos = new Vec2(pos.x + dx, pos.y + dy);

                // 检查边界
                if (!CoordUtils.isInBounds(checkPos, this.params.mapWidth, this.params.mapHeight)) {
                    return false;
                }

                const key = CoordUtils.posToKey(checkPos);

                // 检查是否被占用
                if (this.roadSet.has(key) || this.occupiedSet.has(key)) {
                    return false;
                }
            }
        }

        // 检查是否至少有一个格子邻近道路
        let hasRoadAccess = false;
        for (let dx = 0; dx < 2; dx++) {
            for (let dy = 0; dy < 2; dy++) {
                const checkPos = new Vec2(pos.x + dx, pos.y + dy);
                if (this.isAdjacentToRoad(checkPos)) {
                    hasRoadAccess = true;
                    break;
                }
            }
        }

        if (!hasRoadAccess) return false;

        // 检查最小间距
        return this.checkMinSpacing(pos, 2);
    }

    /**
     * 检查最小间距
     */
    private checkMinSpacing(pos: Vec2, size: number): boolean {
        const spacing = this.params.minPropertySpacing;

        // 检查周围是否有其他地产
        for (let dx = -spacing; dx <= size + spacing - 1; dx++) {
            for (let dy = -spacing; dy <= size + spacing - 1; dy++) {
                // 跳过自身区域
                if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;

                const checkPos = new Vec2(pos.x + dx, pos.y + dy);
                const key = CoordUtils.posToKey(checkPos);

                // 如果周围有其他地产，间距不足
                if (this.isProperty(key)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 检查是否为地产
     */
    private isProperty(key: string): boolean {
        return this.properties.some(p => {
            if (p.size === 1) {
                return CoordUtils.posToKey(p.gridPos) === key;
            } else {
                // 2x2地产
                for (let dx = 0; dx < 2; dx++) {
                    for (let dy = 0; dy < 2; dy++) {
                        const checkPos = new Vec2(p.gridPos.x + dx, p.gridPos.y + dy);
                        if (CoordUtils.posToKey(checkPos) === key) {
                            return true;
                        }
                    }
                }
                return false;
            }
        });
    }

    /**
     * 标记占用
     */
    private markOccupied(pos: Vec2, size: number): void {
        for (let dx = 0; dx < size; dx++) {
            for (let dy = 0; dy < size; dy++) {
                const occupiedPos = new Vec2(pos.x + dx, pos.y + dy);
                this.occupiedSet.add(CoordUtils.posToKey(occupiedPos));
            }
        }
    }

    /**
     * 检查是否邻近道路
     */
    private isAdjacentToRoad(pos: Vec2): boolean {
        const neighbors = CoordUtils.getNeighbors(pos);
        return neighbors.some(n => this.roadSet.has(CoordUtils.posToKey(n)));
    }

    /**
     * 更新地产价格系数
     */
    updatePriceCoefficients(trafficHotnessMap: Map<string, number>): void {
        for (const property of this.properties) {
            // 计算地产中心位置的热度
            let totalHotness = 0;
            let count = 0;

            for (let dx = 0; dx < property.size; dx++) {
                for (let dy = 0; dy < property.size; dy++) {
                    const checkPos = new Vec2(property.gridPos.x + dx, property.gridPos.y + dy);
                    const key = CoordUtils.posToKey(checkPos);
                    const hotness = trafficHotnessMap.get(key) || 0;
                    totalHotness += hotness;
                    count++;
                }
            }

            const avgHotness = count > 0 ? totalHotness / count : 0;

            // 将热度映射到价格系数 (0.5 - 2.0)
            property.priceCoefficient = 0.5 + avgHotness * 1.5;
        }
    }

    /**
     * 分配颜色组
     */
    assignColorGroups(streets: any[]): void {
        // 颜色组列表（类似大富翁的颜色分组）
        const colorGroups = [
            'brown', 'lightblue', 'pink', 'orange',
            'red', 'yellow', 'green', 'darkblue'
        ];

        // 为每个街区分配颜色组
        for (let i = 0; i < streets.length && i < colorGroups.length; i++) {
            const street = streets[i];
            const color = colorGroups[i % colorGroups.length];

            // 更新街区内所有地产的颜色组
            for (const property of this.properties) {
                if (property.streetId === street.id) {
                    property.colorGroup = color;
                }
            }
        }
    }
}