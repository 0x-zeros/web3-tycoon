/**
 * 物体放置辅助类
 *
 * 负责管理物体和装饰物的放置、删除、查询等操作
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Node, Vec2, Vec3, BoxCollider } from 'cc';
import { MapObject } from '../core/MapObject';
import { VoxelSystem } from '../../voxel/VoxelSystem';
import { getWeb3BlockByBlockId, isWeb3Object } from '../../voxel/Web3BlockTypes';
import { PaperActorFactory } from '../../role/PaperActorFactory';

/**
 * 物体放置辅助类
 * 管理NPC、装饰物等物体
 */
export class ObjectPlacementHelper {

    // 容器节点
    private _objectsContainer: Node | null = null;
    private _actorsRoot: Node | null = null;

    // 物体数据
    private _objects: MapObject[] = [];
    private _objectIndex: Map<string, MapObject> = new Map();

    // Actor和装饰物节点
    private _actors: Map<string, Node> = new Map();  // NPC的PaperActor
    private _decorations: Map<string, Node> = new Map();  // 装饰物的体素节点

    // 体素系统引用
    private _voxelSystem: VoxelSystem | null = null;

    /**
     * 初始化辅助器
     */
    public initialize(
        objectsContainer: Node,
        actorsRoot: Node,
        voxelSystem: VoxelSystem | null
    ): void {
        this._objectsContainer = objectsContainer;
        this._actorsRoot = actorsRoot;
        this._voxelSystem = voxelSystem;
    }

    /**
     * 在指定位置放置物体
     * @param blockId 方块ID
     * @param gridPos 网格位置
     */
    public async placeObjectAt(blockId: string, gridPos: Vec2): Promise<void> {
        const key = `${gridPos.x}_${gridPos.y}`;

        // 检查位置是否已有物体
        if (this._objectIndex.has(key)) {
            console.warn(`[ObjectPlacementHelper] Object already exists at ${key}`);
            return;
        }

        // 验证是否为有效的物体类型
        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo || !isWeb3Object(blockId)) {
            console.error(`[ObjectPlacementHelper] Invalid object block: ${blockId}`);
            return;
        }

        // 创建物体节点
        const objectNode = new Node(`Object_${gridPos.x}_${gridPos.y}`);
        objectNode.setParent(this._objectsContainer!);

        // 设置位置
        const worldPos = new Vec3(gridPos.x, 0, gridPos.y);
        objectNode.setPosition(worldPos);

        // 添加MapObject组件并初始化
        const mapObject = objectNode.addComponent(MapObject);
        await mapObject.initialize(blockId, gridPos);

        // 创建PaperActor（如果是NPC类型）
        if (this.isNPCObject(blockId)) {
            const actorNode = await PaperActorFactory.createFromBlockId(blockId);
            if (actorNode) {
                actorNode.setParent(this._actorsRoot!);
                actorNode.setPosition(new Vec3(gridPos.x + 0.5, 0, gridPos.y + 0.5));

                const actorKey = `actor_${gridPos.x}_${gridPos.y}`;
                this._actors.set(actorKey, actorNode);
            }
        }

        // 添加到索引
        this._objects.push(mapObject);
        this._objectIndex.set(key, mapObject);

        console.log(`[ObjectPlacementHelper] Placed object ${blockId} at (${gridPos.x}, ${gridPos.y})`);
    }

    /**
     * 在指定位置放置装饰物
     * @param blockId 方块ID
     * @param gridPos 网格位置
     */
    public async placeDecorationAt(blockId: string, gridPos: Vec2): Promise<void> {
        // 使用体素系统创建装饰物节点
        if (!this._voxelSystem) {
            console.warn('[ObjectPlacementHelper] VoxelSystem not available for decoration');
            return;
        }

        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo) {
            console.error(`[ObjectPlacementHelper] Invalid decoration block: ${blockId}`);
            return;
        }

        const worldPos = new Vec3(gridPos.x, 0, gridPos.y);
        const decorKey = `decor_${gridPos.x}_${gridPos.y}`;

        // 使用 createBlockNode 创建装饰物节点
        const decorNode = await this._voxelSystem.createBlockNode(
            this._objectsContainer!,
            blockId,
            worldPos
        );

        if (decorNode) {
            decorNode.name = `Decoration_${gridPos.x}_${gridPos.y}`;

            // 添加碰撞器以支持点击删除
            const collider = decorNode.addComponent(BoxCollider);
            collider.size = new Vec3(1, blockInfo.height || 1, 1);

            this._decorations.set(decorKey, decorNode);
            console.log(`[ObjectPlacementHelper] Placed decoration ${blockId} at (${gridPos.x}, ${gridPos.y})`);
        }
    }

    /**
     * 删除指定物体
     * @param object 要删除的物体
     */
    public removeObject(object: MapObject): void {
        const pos = object.getGridPosition();
        const key = `${pos.x}_${pos.y}`;

        // 从索引中删除
        this._objectIndex.delete(key);
        const index = this._objects.indexOf(object);
        if (index !== -1) {
            this._objects.splice(index, 1);
        }

        // 删除关联的Actor
        const actorKey = `actor_${pos.x}_${pos.y}`;
        const actorNode = this._actors.get(actorKey);
        if (actorNode) {
            actorNode.destroy();
            this._actors.delete(actorKey);
        }

        // 删除装饰物
        const decorKey = `decor_${pos.x}_${pos.y}`;
        const decorNode = this._decorations.get(decorKey);
        if (decorNode) {
            decorNode.destroy();
            this._decorations.delete(decorKey);
        }

        // 装饰物节点会随 destroy()自动清理

        // 销毁节点
        if (object.node) {
            object.node.destroy();
        }

        console.log(`[ObjectPlacementHelper] Removed object at (${pos.x}, ${pos.y})`);
    }

    /**
     * 获取指定位置的物体
     * @param x X坐标
     * @param z Z坐标
     */
    public getObjectAt(x: number, z: number): MapObject | null {
        const key = `${x}_${z}`;
        return this._objectIndex.get(key) || null;
    }

    /**
     * 获取指定位置的装饰物节点
     * @param x X坐标
     * @param z Z坐标
     */
    public getDecorationAt(x: number, z: number): Node | null {
        const decorKey = `decor_${x}_${z}`;
        return this._decorations.get(decorKey) || null;
    }

    /**
     * 删除指定位置的装饰物
     * @param x X坐标
     * @param z Z坐标
     */
    public removeDecorationAt(x: number, z: number): void {
        const decorKey = `decor_${x}_${z}`;
        const decorNode = this._decorations.get(decorKey);
        if (decorNode) {
            decorNode.destroy();
            this._decorations.delete(decorKey);
            console.log(`[ObjectPlacementHelper] Removed decoration at (${x}, ${z})`);
        }
    }

    /**
     * 获取所有物体
     */
    public getAllObjects(): MapObject[] {
        return [...this._objects];
    }

    /**
     * 清空所有物体
     */
    public clearAllObjects(): void {
        // 销毁所有物体节点
        for (const object of this._objects) {
            if (object.node && object.node.isValid) {
                object.node.destroy();
            }
        }

        // 销毁所有Actor节点
        this._actors.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });

        // 销毁所有装饰物节点
        this._decorations.forEach(node => {
            if (node && node.isValid) {
                node.destroy();
            }
        });

        // 清空索引
        this._objects = [];
        this._objectIndex.clear();
        this._actors.clear();
        this._decorations.clear();

        console.log('[ObjectPlacementHelper] All objects cleared');
    }

    /**
     * 判断是否为NPC物体
     */
    private isNPCObject(blockId: string): boolean {
        // 这里根据实际的blockId判断
        return blockId.includes('npc') ||
               blockId.includes('character') ||
               blockId.includes('player');
    }

    /**
     * 判断是否为装饰物
     */
    private isDecoration(blockId: string): boolean {
        return blockId.includes('tree') ||
               blockId.includes('lamp') ||
               blockId.includes('flower') ||
               blockId.includes('decoration');
    }

    /**
     * 获取物体统计信息
     */
    public getObjectStats(): {
        total: number;
        npcs: number;
        decorations: number;
        others: number
    } {
        let npcs = 0;
        let decorations = 0;
        let others = 0;

        for (const object of this._objects) {
            const blockId = object.getBlockId();
            if (this.isNPCObject(blockId)) {
                npcs++;
            } else if (this.isDecoration(blockId)) {
                decorations++;
            } else {
                others++;
            }
        }

        return {
            total: this._objects.length,
            npcs,
            decorations,
            others
        };
    }

    /**
     * 获取物体索引（供其他模块使用）
     */
    public getObjectIndex(): Map<string, MapObject> {
        return this._objectIndex;
    }

    /**
     * 获取Actor映射（供其他模块使用）
     */
    public getActors(): Map<string, Node> {
        return this._actors;
    }

    /**
     * 获取装饰物映射（供其他模块使用）
     */
    public getDecorations(): Map<string, Node> {
        return this._decorations;
    }

    /**
     * 清理资源
     */
    public cleanup(): void {
        this.clearAllObjects();
        this._objectsContainer = null;
        this._actorsRoot = null;
        this._voxelSystem = null;
    }
}