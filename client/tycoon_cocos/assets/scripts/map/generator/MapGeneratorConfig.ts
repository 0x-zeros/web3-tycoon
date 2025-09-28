/**
 * 地图生成器配置
 *
 * 提供地图生成的预设配置和验证功能
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import {
    MapGeneratorParams,
    MapGenerationMode,
    CLASSIC_MODE_PARAMS,
    DEFAULT_GENERATOR_PARAMS
} from './MapGeneratorTypes';

/**
 * 地图生成器配置类
 */
export class MapGeneratorConfig {
    private params: MapGeneratorParams;

    constructor(params?: Partial<MapGeneratorParams>) {
        // 合并默认参数
        this.params = { ...DEFAULT_GENERATOR_PARAMS };

        if (params) {
            this.applyParams(params);
        }
    }

    /**
     * 应用参数
     */
    private applyParams(params: Partial<MapGeneratorParams>): void {
        // 根据模式应用预设
        if (params.mode === MapGenerationMode.CLASSIC) {
            Object.assign(this.params, CLASSIC_MODE_PARAMS);
        }

        // 应用自定义参数
        Object.assign(this.params, params);

        // 验证参数
        this.validateParams();
    }

    /**
     * 验证参数
     */
    private validateParams(): void {
        const p = this.params;

        // 地图尺寸验证
        if (p.mapWidth < 20 || p.mapWidth > 100) {
            console.warn('地图宽度应在20-100之间，已调整');
            p.mapWidth = Math.max(20, Math.min(100, p.mapWidth));
        }

        if (p.mapHeight < 20 || p.mapHeight > 100) {
            console.warn('地图高度应在20-100之间，已调整');
            p.mapHeight = Math.max(20, Math.min(100, p.mapHeight));
        }

        // 道路密度验证
        if (p.roadDensity < 0.1 || p.roadDensity > 0.4) {
            console.warn('道路密度应在0.1-0.4之间，已调整');
            p.roadDensity = Math.max(0.1, Math.min(0.4, p.roadDensity));
        }

        // 地产比例验证
        if (p.propertyRatio < 0.1 || p.propertyRatio > 0.5) {
            console.warn('地产比例应在0.1-0.5之间，已调整');
            p.propertyRatio = Math.max(0.1, Math.min(0.5, p.propertyRatio));
        }

        if (p.property2x2Ratio < 0 || p.property2x2Ratio > 0.5) {
            console.warn('2x2地产比例应在0-0.5之间，已调整');
            p.property2x2Ratio = Math.max(0, Math.min(0.5, p.property2x2Ratio));
        }

        // 特殊地块比例验证
        if (p.specialTileRatio < 0 || p.specialTileRatio > 0.2) {
            console.warn('特殊地块比例应在0-0.2之间，已调整');
            p.specialTileRatio = Math.max(0, Math.min(0.2, p.specialTileRatio));
        }

        // 交通模拟轮数验证
        if (p.trafficSimulationRounds < 100 || p.trafficSimulationRounds > 10000) {
            console.warn('交通模拟轮数应在100-10000之间，已调整');
            p.trafficSimulationRounds = Math.max(100, Math.min(10000, p.trafficSimulationRounds));
        }

        // 起始位置验证
        if (!p.startPositions || p.startPositions.length === 0) {
            p.startPositions = [new Vec2(0, 0)];
        }
    }

    /**
     * 获取参数
     */
    getParams(): MapGeneratorParams {
        return { ...this.params };
    }

    /**
     * 设置模式
     */
    setMode(mode: MapGenerationMode): void {
        this.applyParams({ mode });
    }

    /**
     * 设置地图尺寸
     */
    setMapSize(width: number, height: number): void {
        this.applyParams({ mapWidth: width, mapHeight: height });
    }

    /**
     * 设置随机种子
     */
    setSeed(seed: number): void {
        this.params.seed = seed;
    }

    /**
     * 获取预设配置
     */
    static getPresetConfig(preset: 'small' | 'medium' | 'large' | 'classic'): MapGeneratorConfig {
        switch (preset) {
            case 'small':
                return new MapGeneratorConfig({
                    mapWidth: 30,
                    mapHeight: 30,
                    roadDensity: 0.2,
                    propertyRatio: 0.3
                });

            case 'medium':
                return new MapGeneratorConfig({
                    mapWidth: 50,
                    mapHeight: 50,
                    roadDensity: 0.25,
                    propertyRatio: 0.35
                });

            case 'large':
                return new MapGeneratorConfig({
                    mapWidth: 80,
                    mapHeight: 80,
                    roadDensity: 0.3,
                    propertyRatio: 0.4
                });

            case 'classic':
                return new MapGeneratorConfig({
                    mode: MapGenerationMode.CLASSIC,
                    mapWidth: 40,
                    mapHeight: 40
                });

            default:
                return new MapGeneratorConfig();
        }
    }

    /**
     * 获取调试信息
     */
    getDebugInfo(): string {
        const p = this.params;
        return `
地图生成器配置：
- 模式: ${p.mode}
- 尺寸: ${p.mapWidth}x${p.mapHeight}
- 道路密度: ${(p.roadDensity * 100).toFixed(1)}%
- 地产比例: ${(p.propertyRatio * 100).toFixed(1)}%
- 2x2地产比例: ${(p.property2x2Ratio * 100).toFixed(1)}%
- 特殊地块比例: ${(p.specialTileRatio * 100).toFixed(1)}%
- 交通模拟轮数: ${p.trafficSimulationRounds}
- 随机种子: ${p.seed || '未设置'}
        `.trim();
    }
}