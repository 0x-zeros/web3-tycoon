/**
 * 地图验证系统
 *
 * 负责验证地图的完整性和游戏规则合规性
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Vec2 } from 'cc';
import { MapTile } from '../core/MapTile';
import { BuildingInfo } from './MapIdSystem';

/**
 * 验证结果
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
    code: string;
    message: string;
    position?: Vec2;
    severity: 'error' | 'critical';
}

/**
 * 验证警告
 */
export interface ValidationWarning {
    code: string;
    message: string;
    position?: Vec2;
}

/**
 * 地图验证规则配置
 */
export interface ValidationRules {
    minTiles: number;
    maxTiles: number;
    requireStartTile: boolean;
    requireHospital: boolean;
    minProperties: number;
    maxDeadEnds: number;
    requireConnected: boolean;
}

/**
 * 地图验证器
 * 验证地图是否满足游戏规则
 */
export class MapEditorValidator {

    private _tiles: Map<string, MapTile> = new Map();
    private _buildingRegistry: Map<string, BuildingInfo> = new Map();

    // 默认验证规则
    private readonly DEFAULT_RULES: ValidationRules = {
        minTiles: 20,
        maxTiles: 100,
        requireStartTile: true,
        requireHospital: true,
        minProperties: 8,
        maxDeadEnds: 2,
        requireConnected: true
    };

    /**
     * 初始化验证器
     */
    public initialize(
        tileIndex: Map<string, MapTile>,
        buildingRegistry: Map<string, BuildingInfo>
    ): void {
        this._tiles = tileIndex;
        this._buildingRegistry = buildingRegistry;
    }

    /**
     * 执行完整验证
     * @param rules 验证规则（可选，使用默认规则）
     * @returns 验证结果
     */
    public validate(rules?: Partial<ValidationRules>): ValidationResult {
        const finalRules = { ...this.DEFAULT_RULES, ...rules };
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // 执行各项验证
        this.validateTileCount(finalRules, errors, warnings);
        this.validateSpecialTiles(finalRules, errors, warnings);
        this.validateProperties(finalRules, errors, warnings);
        this.validateConnectivity(finalRules, errors, warnings);
        this.validateDeadEnds(finalRules, errors, warnings);
        this.validateGameBalance(errors, warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 验证地图完整性
     * @returns 是否完整
     */
    public validateMapCompleteness(): boolean {
        // 检查是否有起始位置
        const hasStart = this.hasStartPosition();

        // 检查是否有足够的地块
        const hasSufficientTiles = this._tiles.size >= this.DEFAULT_RULES.minTiles;

        // 检查是否所有地块连通
        const isConnected = this.checkAllTilesConnected();

        return hasStart && hasSufficientTiles && isConnected;
    }

    /**
     * 检查所有地块是否连通
     * @returns 是否连通
     */
    public checkAllTilesConnected(): boolean {
        if (this._tiles.size === 0) return false;

        // 从任意一个tile开始DFS
        const startKey = this._tiles.keys().next().value;
        const visited = new Set<string>();
        this.dfsConnectivity(startKey, visited);

        // 检查是否访问了所有tile
        return visited.size === this._tiles.size;
    }

    /**
     * 验证地产分组
     * @returns 验证结果
     */
    public validatePropertyGroups(): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // 统计各类地产数量
        const propertyGroups = new Map<string, number>();
        this._buildingRegistry.forEach((info) => {
            const count = propertyGroups.get(info.blockId) || 0;
            propertyGroups.set(info.blockId, count + 1);
        });

        // 检查地产分组平衡性
        propertyGroups.forEach((count, blockId) => {
            if (count < 2) {
                warnings.push({
                    code: 'PROPERTY_GROUP_SMALL',
                    message: `地产类型 ${blockId} 只有 ${count} 个，建议至少2个`
                });
            }
            if (count > 4) {
                warnings.push({
                    code: 'PROPERTY_GROUP_LARGE',
                    message: `地产类型 ${blockId} 有 ${count} 个，可能过多`
                });
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 验证起始位置
     * @returns 是否有有效的起始位置
     */
    public validateStartPosition(): boolean {
        return this.hasStartPosition();
    }

    /**
     * 检查最少地块数量
     * @returns 是否满足最少地块要求
     */
    public checkMinimumTiles(): boolean {
        return this._tiles.size >= this.DEFAULT_RULES.minTiles;
    }

    /**
     * 验证特殊地块
     * @returns 是否包含所有必需的特殊地块
     */
    public validateSpecialTiles(): boolean {
        let hasHospital = false;

        this._tiles.forEach((tile) => {
            const blockId = tile.getBlockId();
            if (blockId === 'web3:hospital') {
                hasHospital = true;
            }
        });

        return hasHospital;
    }

    // ========================= 私有验证方法 =========================

    private validateTileCount(
        rules: ValidationRules,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        const tileCount = this._tiles.size;

        if (tileCount < rules.minTiles) {
            errors.push({
                code: 'INSUFFICIENT_TILES',
                message: `地块数量不足，最少需要 ${rules.minTiles} 个，当前 ${tileCount} 个`,
                severity: 'error'
            });
        }

        if (tileCount > rules.maxTiles) {
            warnings.push({
                code: 'TOO_MANY_TILES',
                message: `地块数量过多，建议不超过 ${rules.maxTiles} 个，当前 ${tileCount} 个`
            });
        }
    }

    private validateSpecialTiles(
        rules: ValidationRules,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (rules.requireHospital && !this.hasHospitalTile()) {
            errors.push({
                code: 'NO_HOSPITAL',
                message: '缺少医院地块',
                severity: 'critical'
            });
        }

        if (rules.requireStartTile && !this.hasStartPosition()) {
            errors.push({
                code: 'NO_START',
                message: '缺少起始位置',
                severity: 'critical'
            });
        }
    }

    private validateProperties(
        rules: ValidationRules,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        const propertyCount = this._buildingRegistry.size;

        if (propertyCount < rules.minProperties) {
            errors.push({
                code: 'INSUFFICIENT_PROPERTIES',
                message: `地产数量不足，最少需要 ${rules.minProperties} 个，当前 ${propertyCount} 个`,
                severity: 'error'
            });
        }
    }

    private validateConnectivity(
        rules: ValidationRules,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        if (rules.requireConnected && !this.checkAllTilesConnected()) {
            errors.push({
                code: 'NOT_CONNECTED',
                message: '地图不连通，存在孤立的区域',
                severity: 'critical'
            });
        }
    }

    private validateDeadEnds(
        rules: ValidationRules,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        const deadEnds = this.findDeadEnds();

        if (deadEnds.length > rules.maxDeadEnds) {
            warnings.push({
                code: 'TOO_MANY_DEAD_ENDS',
                message: `死胡同过多，建议不超过 ${rules.maxDeadEnds} 个，当前 ${deadEnds.length} 个`
            });
        }
    }

    private validateGameBalance(
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): void {
        // 检查地产分布是否平衡
        const propertyTypes = new Set<string>();
        this._buildingRegistry.forEach((info) => {
            propertyTypes.add(info.blockId);
        });

        if (propertyTypes.size < 3) {
            warnings.push({
                code: 'LOW_PROPERTY_VARIETY',
                message: `地产种类较少，当前只有 ${propertyTypes.size} 种`
            });
        }
    }

    // ========================= 辅助方法 =========================

    private hasStartPosition(): boolean {
        // 检查是否有起始相关的tile
        for (const tile of this._tiles.values()) {
            const blockId = tile.getBlockId();
            if (blockId === 'web3:start' || blockId === 'web3:hospital') {
                return true;
            }
        }
        return false;
    }

    private hasHospitalTile(): boolean {
        for (const tile of this._tiles.values()) {
            if (tile.getBlockId() === 'web3:hospital') {
                return true;
            }
        }
        return false;
    }

    private findDeadEnds(): Vec2[] {
        const deadEnds: Vec2[] = [];

        this._tiles.forEach((tile, key) => {
            const [x, z] = key.split('_').map(Number);
            let neighborCount = 0;

            // 检查四个方向
            const directions = [
                { x: 0, y: 1 },   // 北
                { x: 1, y: 0 },   // 东
                { x: 0, y: -1 },  // 南
                { x: -1, y: 0 }   // 西
            ];

            for (const dir of directions) {
                const neighborKey = `${x + dir.x}_${z + dir.y}`;
                if (this._tiles.has(neighborKey)) {
                    neighborCount++;
                }
            }

            if (neighborCount === 1) {
                deadEnds.push(new Vec2(x, z));
            }
        });

        return deadEnds;
    }

    private dfsConnectivity(key: string, visited: Set<string>): void {
        if (visited.has(key)) return;

        visited.add(key);
        const [x, z] = key.split('_').map(Number);

        // 访问四个方向的邻居
        const directions = [
            { x: 0, y: 1 },   // 北
            { x: 1, y: 0 },   // 东
            { x: 0, y: -1 },  // 南
            { x: -1, y: 0 }   // 西
        ];

        for (const dir of directions) {
            const neighborKey = `${x + dir.x}_${z + dir.y}`;
            if (this._tiles.has(neighborKey)) {
                this.dfsConnectivity(neighborKey, visited);
            }
        }
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this._tiles.clear();
        this._buildingRegistry.clear();
    }
}