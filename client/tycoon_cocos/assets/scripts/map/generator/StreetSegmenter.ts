/**
 * 街区分割器
 *
 * 将地图分割为不同的街区，用于地产分组和垄断判定
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import {
    RoadNetworkData,
    PropertyData,
    StreetData,
    CoordUtils
} from './MapGeneratorTypes';

/**
 * 街区分割器
 */
export class StreetSegmenter {
    private mapWidth: number;
    private mapHeight: number;
    private roadSet: Set<string>;
    private streets: StreetData[] = [];

    constructor(mapWidth: number, mapHeight: number) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.roadSet = new Set();
    }

    /**
     * 分割街区
     */
    segment(roadNetwork: RoadNetworkData, properties: PropertyData[]): StreetData[] {
        this.streets = [];
        this.roadSet = new Set(roadNetwork.roads.map(r => CoordUtils.posToKey(r)));

        // 找到所有非道路的连通区域
        const regions = this.findConnectedRegions();

        // 将区域转换为街区
        this.convertRegionsToStreets(regions, properties);

        // 合并过小的街区
        this.mergeSmallStreets();

        // 分配颜色组
        this.assignColorGroups();

        return this.streets;
    }

    /**
     * 找到所有连通区域（非道路区域）
     */
    private findConnectedRegions(): Vec2[][] {
        const visited = new Set<string>();
        const regions: Vec2[][] = [];

        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                const pos = new Vec2(x, y);
                const key = CoordUtils.posToKey(pos);

                // 跳过道路和已访问的位置
                if (this.roadSet.has(key) || visited.has(key)) {
                    continue;
                }

                // 使用洪水填充找到连通区域
                const region = this.floodFill(pos, visited);
                if (region.length > 0) {
                    regions.push(region);
                }
            }
        }

        return regions;
    }

    /**
     * 洪水填充算法
     */
    private floodFill(start: Vec2, visited: Set<string>): Vec2[] {
        const region: Vec2[] = [];
        const queue: Vec2[] = [start];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const key = CoordUtils.posToKey(current);

            // 检查是否已访问或是道路
            if (visited.has(key) || this.roadSet.has(key)) {
                continue;
            }

            // 检查边界
            if (!CoordUtils.isInBounds(current, this.mapWidth, this.mapHeight)) {
                continue;
            }

            visited.add(key);
            region.push(current);

            // 添加四向邻居
            const neighbors = CoordUtils.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = CoordUtils.posToKey(neighbor);
                if (!visited.has(neighborKey) && !this.roadSet.has(neighborKey)) {
                    queue.push(neighbor);
                }
            }
        }

        return region;
    }

    /**
     * 将区域转换为街区
     */
    private convertRegionsToStreets(regions: Vec2[][], properties: PropertyData[]): void {
        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];

            // 计算区域中心
            const centerPos = this.calculateCenter(region);

            // 找到区域内的地产
            const streetProperties = this.findPropertiesInRegion(region, properties);

            // 创建街区数据
            const street: StreetData = {
                id: i,
                tiles: region,
                properties: streetProperties,
                colorGroup: '', // 稍后分配
                centerPos: centerPos
            };

            // 更新地产的街区ID
            for (const property of streetProperties) {
                property.streetId = i;
            }

            this.streets.push(street);
        }
    }

    /**
     * 计算区域中心
     */
    private calculateCenter(region: Vec2[]): Vec2 {
        if (region.length === 0) {
            return new Vec2(0, 0);
        }

        let sumX = 0;
        let sumY = 0;

        for (const pos of region) {
            sumX += pos.x;
            sumY += pos.y;
        }

        return new Vec2(
            Math.floor(sumX / region.length),
            Math.floor(sumY / region.length)
        );
    }

    /**
     * 找到区域内的地产
     */
    private findPropertiesInRegion(region: Vec2[], properties: PropertyData[]): PropertyData[] {
        const regionSet = new Set(region.map(r => CoordUtils.posToKey(r)));
        const streetProperties: PropertyData[] = [];

        for (const property of properties) {
            // 检查地产是否在区域内
            let isInRegion = false;

            if (property.size === 1) {
                // 1x1地产
                if (regionSet.has(CoordUtils.posToKey(property.gridPos))) {
                    isInRegion = true;
                }
            } else {
                // 2x2地产，检查是否有任何部分在区域内
                for (let dx = 0; dx < 2; dx++) {
                    for (let dy = 0; dy < 2; dy++) {
                        const checkPos = new Vec2(property.gridPos.x + dx, property.gridPos.y + dy);
                        if (regionSet.has(CoordUtils.posToKey(checkPos))) {
                            isInRegion = true;
                            break;
                        }
                    }
                    if (isInRegion) break;
                }
            }

            if (isInRegion) {
                streetProperties.push(property);
            }
        }

        return streetProperties;
    }

    /**
     * 合并过小的街区
     */
    private mergeSmallStreets(): void {
        const minStreetSize = 5; // 最小街区大小
        const smallStreets = this.streets.filter(s => s.tiles.length < minStreetSize);

        for (const smallStreet of smallStreets) {
            // 找到最近的大街区
            let nearestStreet: StreetData | null = null;
            let minDistance = Infinity;

            for (const otherStreet of this.streets) {
                if (otherStreet === smallStreet || otherStreet.tiles.length < minStreetSize) {
                    continue;
                }

                const distance = CoordUtils.manhattanDistance(smallStreet.centerPos, otherStreet.centerPos);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestStreet = otherStreet;
                }
            }

            // 合并到最近的大街区
            if (nearestStreet) {
                nearestStreet.tiles.push(...smallStreet.tiles);
                nearestStreet.properties.push(...smallStreet.properties);

                // 更新地产的街区ID
                for (const property of smallStreet.properties) {
                    property.streetId = nearestStreet.id;
                }

                // 重新计算中心
                nearestStreet.centerPos = this.calculateCenter(nearestStreet.tiles);
            }
        }

        // 移除已合并的小街区
        this.streets = this.streets.filter(s => s.tiles.length >= minStreetSize);

        // 重新编号街区ID
        for (let i = 0; i < this.streets.length; i++) {
            const street = this.streets[i];
            const oldId = street.id;
            street.id = i;

            // 更新地产的街区ID
            for (const property of street.properties) {
                if (property.streetId === oldId) {
                    property.streetId = i;
                }
            }
        }
    }

    /**
     * 分配颜色组
     */
    private assignColorGroups(): void {
        // 颜色组列表（类似大富翁的颜色分组）
        const colorGroups = [
            'brown', 'lightblue', 'pink', 'orange',
            'red', 'yellow', 'green', 'darkblue'
        ];

        // 根据街区大小和地产数量排序
        const sortedStreets = [...this.streets].sort((a, b) => {
            // 优先考虑地产数量
            const propDiff = b.properties.length - a.properties.length;
            if (propDiff !== 0) return propDiff;
            // 其次考虑街区大小
            return b.tiles.length - a.tiles.length;
        });

        // 分配颜色组
        for (let i = 0; i < sortedStreets.length; i++) {
            const street = sortedStreets[i];
            const colorIndex = i % colorGroups.length;
            street.colorGroup = colorGroups[colorIndex];

            // 更新街区内所有地产的颜色组
            for (const property of street.properties) {
                property.colorGroup = street.colorGroup;
            }
        }
    }

    /**
     * 获取街区统计信息
     */
    getStatistics(): {
        totalStreets: number;
        averageStreetSize: number;
        largestStreet: number;
        smallestStreet: number;
        averagePropertiesPerStreet: number;
    } {
        if (this.streets.length === 0) {
            return {
                totalStreets: 0,
                averageStreetSize: 0,
                largestStreet: 0,
                smallestStreet: 0,
                averagePropertiesPerStreet: 0
            };
        }

        const streetSizes = this.streets.map(s => s.tiles.length);
        const propertyCounts = this.streets.map(s => s.properties.length);

        return {
            totalStreets: this.streets.length,
            averageStreetSize: streetSizes.reduce((a, b) => a + b, 0) / this.streets.length,
            largestStreet: Math.max(...streetSizes),
            smallestStreet: Math.min(...streetSizes),
            averagePropertiesPerStreet: propertyCounts.reduce((a, b) => a + b, 0) / this.streets.length
        };
    }
}