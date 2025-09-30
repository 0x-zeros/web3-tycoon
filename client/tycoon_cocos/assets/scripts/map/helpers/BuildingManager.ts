/**
 * 建筑管理器
 *
 * 负责管理建筑的放置、删除、朝向、升级等操作
 * 支持1x1和2x2建筑
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Node, Vec2, Vec3, Quat } from 'cc';
import { MapTile } from '../core/MapTile';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { getWeb3BlockByBlockId, isWeb3Building, getBuildingSize } from '../../voxel/Web3BlockTypes';
import { PaperActorFactory } from '../../role/PaperActorFactory';
import { PaperActor } from '../../role/PaperActor';
import { BuildingInfo } from '../editor/MapIdSystem';
import { TilePlacementHelper } from './TilePlacementHelper';

/**
 * 建筑管理器
 * 管理所有建筑相关的操作
 */
export class BuildingManager {

    // 建筑容器
    private _buildingsRoot: Node | null = null;
    private _tilesContainer: Node | null = null;

    // 建筑数据
    private _buildings: Map<string, Node> = new Map();  // 建筑的PaperActor节点
    private _buildingRegistry: Map<string, BuildingInfo> = new Map();  // 建筑信息注册表

    // 依赖系统
    private _voxelSystem: VoxelSystem | null = null;
    private _tileHelper: TilePlacementHelper | null = null;

    /**
     * 初始化管理器
     */
    public initialize(
        buildingsRoot: Node,
        tilesContainer: Node,
        voxelSystem: VoxelSystem | null,
        tileHelper: TilePlacementHelper
    ): void {
        this._buildingsRoot = buildingsRoot;
        this._tilesContainer = tilesContainer;
        this._voxelSystem = voxelSystem;
        this._tileHelper = tileHelper;
    }

    /**
     * 在指定位置放置建筑
     * @param blockId 方块ID
     * @param gridPos 网格位置（左下角）
     * @param size 建筑大小（1或2）
     */
    public async placeBuildingAt(blockId: string, gridPos: Vec2, size: 1 | 2 = 1): Promise<void> {
        // 验证是否为有效的建筑类型
        if (!isWeb3Building(blockId)) {
            console.error(`[BuildingManager] Invalid building block: ${blockId}`);
            return;
        }

        // 2x2建筑特殊处理
        if (size === 2) {
            await this.place2x2Building(blockId, gridPos);
            return;
        }

        // 检查位置是否有效
        if (!this.isValidBuildingPosition(gridPos, size)) {
            console.warn(`[BuildingManager] Invalid position for building at (${gridPos.x}, ${gridPos.y})`);
            return;
        }

        // 找到最佳朝向
        const direction = this.findBestDirection(gridPos, size);

        // 创建建筑信息
        const buildingInfo: BuildingInfo = {
            blockId,
            position: { x: gridPos.x, z: gridPos.y },
            size,
            direction,
            buildingId: 65535,  // 初始无效ID，后续由编辑器分配
            owner: '',
            level: 1,
            price: 1000,
            rent: [100, 200, 400, 800],
            mortgaged: false
        };

        // 注册建筑信息
        const key = `${gridPos.x}_${gridPos.y}`;
        this._buildingRegistry.set(key, buildingInfo);

        // 创建PaperActor
        const paperActor = await this.createBuildingPaperActor(
            blockId,
            gridPos,
            size,
            direction,
            buildingInfo
        );

        if (paperActor) {
            this._buildings.set(key, paperActor);
        }

        console.log(`[BuildingManager] Placed ${size}x${size} building at (${gridPos.x}, ${gridPos.y}), direction: ${direction}`);
    }

    /**
     * 放置2x2建筑
     * @param blockId 方块ID
     * @param gridPos 网格位置（左下角）
     */
    private async place2x2Building(blockId: string, gridPos: Vec2): Promise<void> {
        // 检查四个格子是否都可用
        const positions = [
            gridPos,
            new Vec2(gridPos.x + 1, gridPos.y),
            new Vec2(gridPos.x, gridPos.y + 1),
            new Vec2(gridPos.x + 1, gridPos.y + 1)
        ];

        for (const pos of positions) {
            if (this._tileHelper?.hasTileAt(pos)) {
                console.warn(`[BuildingManager] Cannot place 2x2 building, position occupied at (${pos.x}, ${pos.y})`);
                return;
            }
        }

        // 放置四个占位tile
        for (const pos of positions) {
            await this._tileHelper?.placeTileAt('web3:building_2x2', pos);
        }

        // 创建建筑信息
        const buildingInfo: BuildingInfo = {
            blockId,
            position: { x: gridPos.x, z: gridPos.y },
            size: 2,
            direction: this.findBestDirection(gridPos, 2),
            buildingId: 65535,
            owner: '',
            level: 1,
            price: 2000,
            rent: [200, 400, 800, 1600],
            mortgaged: false
        };

        // 注册建筑（只在左下角注册一次）
        const key = `${gridPos.x}_${gridPos.y}`;
        this._buildingRegistry.set(key, buildingInfo);

        // 创建PaperActor（放在中心位置）
        const paperActor = await this.createBuildingPaperActor(
            blockId,
            gridPos,
            2,
            buildingInfo.direction!,
            buildingInfo
        );

        if (paperActor) {
            this._buildings.set(key, paperActor);
        }
    }

    /**
     * 创建建筑的PaperActor
     */
    private async createBuildingPaperActor(
        blockId: string,
        gridPos: Vec2,
        size: 1 | 2,
        direction: number,
        buildingInfo: BuildingInfo
    ): Promise<Node | null> {
        try {
            // 计算建筑中心位置
            let centerX = gridPos.x;
            let centerZ = gridPos.y;

            if (size === 2) {
                // 2x2建筑中心偏移
                centerX += 1;
                centerZ += 1;
            } else {
                // 1x1建筑中心偏移
                centerX += 0.5;
                centerZ += 0.5;
            }

            // 创建PaperActor
            const actorNode = await PaperActorFactory.createFromBlockId(blockId);
            if (!actorNode) {
                console.error(`[BuildingManager] Failed to create PaperActor for ${blockId}`);
                return null;
            }

            // 设置父节点
            actorNode.setParent(this._buildingsRoot!);

            // 设置位置和旋转
            const worldPos = new Vec3(centerX, 0, centerZ);
            actorNode.setPosition(worldPos);

            // 设置Y轴旋转（朝向）
            const rotation = Quat.fromEuler(new Quat(), 0, direction * 90, 0);
            actorNode.setRotation(rotation);

            // 获取PaperActor组件并设置数据
            const paperActor = actorNode.getComponent(PaperActor);
            if (paperActor) {
                (paperActor as any).buildingInfo = buildingInfo;
            }

            return actorNode;

        } catch (error) {
            console.error('[BuildingManager] Error creating building PaperActor:', error);
            return null;
        }
    }

    /**
     * 删除指定位置的建筑
     * @param gridPos 网格位置
     */
    public removeBuilding(gridPos: Vec2): void {
        const key = `${gridPos.x}_${gridPos.y}`;

        // 查找建筑信息
        const buildingInfo = this.findBuildingInfo(gridPos);
        if (!buildingInfo) {
            console.warn(`[BuildingManager] No building found at (${gridPos.x}, ${gridPos.y})`);
            return;
        }

        // 获取实际的建筑位置（可能是2x2建筑的一部分）
        const actualPos = buildingInfo.position;
        const actualKey = `${actualPos.x}_${actualPos.z}`;

        // 删除PaperActor
        const actorNode = this._buildings.get(actualKey);
        if (actorNode) {
            actorNode.destroy();
            this._buildings.delete(actualKey);
        }

        // 如果是2x2建筑，删除所有占位tile
        if (buildingInfo.size === 2) {
            const positions = [
                new Vec2(actualPos.x, actualPos.z),
                new Vec2(actualPos.x + 1, actualPos.z),
                new Vec2(actualPos.x, actualPos.z + 1),
                new Vec2(actualPos.x + 1, actualPos.z + 1)
            ];

            for (const pos of positions) {
                const tile = this._tileHelper?.getTileAt(pos.x, pos.y);
                if (tile) {
                    this._tileHelper?.removeTile(tile);
                }
            }
        } else {
            // 1x1建筑，只删除一个tile
            const tile = this._tileHelper?.getTileAt(actualPos.x, actualPos.z);
            if (tile) {
                this._tileHelper?.removeTile(tile);
            }
        }

        // 从注册表删除
        this._buildingRegistry.delete(actualKey);

        console.log(`[BuildingManager] Removed building at (${actualPos.x}, ${actualPos.z})`);
    }

    /**
     * 切换建筑朝向
     * @param gridPos 网格位置
     */
    public cycleBuildingDirection(gridPos: Vec2): void {
        const buildingInfo = this.findBuildingInfo(gridPos);
        if (!buildingInfo) {
            console.warn(`[BuildingManager] No building found at (${gridPos.x}, ${gridPos.y})`);
            return;
        }

        // 更新朝向（0-3循环）
        const newDirection = ((buildingInfo.direction || 0) + 1) % 4;
        buildingInfo.direction = newDirection;

        // 更新PaperActor的旋转
        const key = `${buildingInfo.position.x}_${buildingInfo.position.z}`;
        const actorNode = this._buildings.get(key);
        if (actorNode) {
            const rotation = Quat.fromEuler(new Quat(), 0, newDirection * 90, 0);
            actorNode.setRotation(rotation);
        }

        console.log(`[BuildingManager] Building direction changed to ${newDirection} at (${buildingInfo.position.x}, ${buildingInfo.position.z})`);
    }

    /**
     * 升级建筑
     * @param gridPos 网格位置
     * @param newLevel 新等级
     */
    public upgradeBuilding(gridPos: Vec2, newLevel: number): boolean {
        const buildingInfo = this.findBuildingInfo(gridPos);
        if (!buildingInfo) {
            console.warn(`[BuildingManager] No building found at (${gridPos.x}, ${gridPos.y})`);
            return false;
        }

        // 更新等级
        buildingInfo.level = newLevel;

        // TODO: 更新视觉效果

        console.log(`[BuildingManager] Building upgraded to level ${newLevel} at (${buildingInfo.position.x}, ${buildingInfo.position.z})`);
        return true;
    }

    /**
     * 找到最佳朝向（朝向有路径的方向）
     * @param gridPos 建筑位置
     * @param size 建筑大小
     */
    private findBestDirection(gridPos: Vec2, size: 1 | 2): number {
        const directions = [
            { dir: 0, offset: new Vec2(0, -1) },    // 南
            { dir: 1, offset: new Vec2(1, 0) },     // 东
            { dir: 2, offset: new Vec2(0, 1) },     // 北
            { dir: 3, offset: new Vec2(-1, 0) }     // 西
        ];

        // 检查每个方向是否有路径tile
        for (const { dir, offset } of directions) {
            let checkPos: Vec2;

            if (size === 2) {
                // 2x2建筑检查中心前方
                if (dir === 0) checkPos = new Vec2(gridPos.x + 1, gridPos.y - 1);
                else if (dir === 1) checkPos = new Vec2(gridPos.x + 2, gridPos.y + 1);
                else if (dir === 2) checkPos = new Vec2(gridPos.x + 1, gridPos.y + 2);
                else checkPos = new Vec2(gridPos.x - 1, gridPos.y + 1);
            } else {
                // 1x1建筑检查相邻位置
                checkPos = new Vec2(gridPos.x + offset.x, gridPos.y + offset.y);
            }

            const tile = this._tileHelper?.getTileAt(checkPos.x, checkPos.y);
            if (tile && this.isPathTile(tile)) {
                return dir;
            }
        }

        return 0;  // 默认朝南
    }

    /**
     * 判断是否为路径tile
     */
    private isPathTile(tile: MapTile): boolean {
        const blockId = tile.getBlockId();
        return blockId === 'web3:empty_land' ||
               blockId === 'web3:hospital' ||
               blockId === 'web3:chance' ||
               blockId === 'web3:bonus' ||
               blockId === 'web3:fee' ||
               blockId === 'web3:card' ||
               blockId === 'web3:news';
    }

    /**
     * 检查建筑位置是否有效
     */
    private isValidBuildingPosition(gridPos: Vec2, size: 1 | 2): boolean {
        if (size === 2) {
            // 检查2x2范围
            for (let dx = 0; dx < 2; dx++) {
                for (let dz = 0; dz < 2; dz++) {
                    const pos = new Vec2(gridPos.x + dx, gridPos.y + dz);
                    if (this._tileHelper?.hasTileAt(pos)) {
                        return false;
                    }
                }
            }
        } else {
            // 检查1x1位置
            if (this._tileHelper?.hasTileAt(gridPos)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 查找建筑信息（支持2x2建筑的任意位置）
     */
    public findBuildingInfo(gridPos: Vec2): BuildingInfo | null {
        // 直接查找
        const key = `${gridPos.x}_${gridPos.y}`;
        let info = this._buildingRegistry.get(key);
        if (info) return info;

        // 检查是否为2x2建筑的一部分
        const offsets = [
            { x: 0, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: -1 },
            { x: -1, y: -1 }
        ];

        for (const offset of offsets) {
            const checkKey = `${gridPos.x + offset.x}_${gridPos.y + offset.y}`;
            info = this._buildingRegistry.get(checkKey);
            if (info && info.size === 2) {
                // 验证gridPos是否在2x2范围内
                const bx = info.position.x;
                const bz = info.position.z;
                if (gridPos.x >= bx && gridPos.x < bx + 2 &&
                    gridPos.y >= bz && gridPos.y < bz + 2) {
                    return info;
                }
            }
        }

        return null;
    }

    /**
     * 判断指定位置是否为2x2建筑的一部分
     */
    public isPartOfBuilding2x2(gridPos: Vec2): boolean {
        const info = this.findBuildingInfo(gridPos);
        return info !== null && info.size === 2;
    }

    /**
     * 获取建筑注册表（供其他模块使用）
     */
    public getBuildingRegistry(): Map<string, BuildingInfo> {
        return this._buildingRegistry;
    }

    /**
     * 获取建筑节点映射（供其他模块使用）
     */
    public getBuildings(): Map<string, Node> {
        return this._buildings;
    }

    /**
     * 获取建筑统计信息
     */
    public getBuildingStats(): { total: number; by1x1: number; by2x2: number } {
        let count1x1 = 0;
        let count2x2 = 0;

        for (const info of this._buildingRegistry.values()) {
            if (info.size === 2) {
                count2x2++;
            } else {
                count1x1++;
            }
        }

        return {
            total: this._buildingRegistry.size,
            by1x1: count1x1,
            by2x2: count2x2
        };
    }

    /**
     * 重建建筑容器（用于修复层级问题）
     */
    public rebuildBuildingContainers(): void {
        if (!this._buildingsRoot) return;

        // 临时保存所有建筑节点
        const tempBuildings: Node[] = [];
        this._buildings.forEach(node => {
            if (node && node.isValid) {
                tempBuildings.push(node);
            }
        });

        // 重新添加到容器
        for (const node of tempBuildings) {
            node.setParent(this._buildingsRoot);
        }

        console.log(`[BuildingManager] Rebuilt ${tempBuildings.length} building containers`);
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        // 销毁所有建筑节点
        this._buildings.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });

        // 清空数据
        this._buildings.clear();
        this._buildingRegistry.clear();
        this._buildingsRoot = null;
        this._tilesContainer = null;
        this._voxelSystem = null;
        this._tileHelper = null;
    }
}