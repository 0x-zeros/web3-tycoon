/**
 * 角色管理器
 * 
 * 负责管理游戏中所有的角色实例，包括玩家和NPC
 * 提供角色的创建、销毁、查找和对象池管理功能
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component, Node, instantiate, Prefab, Vec3, director, EventTarget } from 'cc';
import { Role } from './Role';
import { Player } from './Player';
import { NPC } from './NPC';
import { Actor } from './Actor';
import { RoleType, NPCType, RoleData, NPCData, PlayerData } from './RoleTypes';

const { ccclass, property } = _decorator;

/**
 * 角色管理器配置接口
 */
export interface RoleManagerConfig {
    /** 最大玩家数量 */
    maxPlayers: number;
    /** NPC对象池大小 */
    npcPoolSize: number;
    /** 是否启用对象池 */
    enablePooling: boolean;
    /** 预制体配置 */
    prefabs: {
        player: string;
        npc: { [key in NPCType]?: string };
    };
}

/**
 * 对象池管理器
 */
class ObjectPool<T extends Role> {
    private pool: T[] = [];
    private createFn: () => T;
    private resetFn: (obj: T) => void;
    private maxSize: number;

    constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize: number = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
    }

    /**
     * 获取对象
     */
    get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.createFn();
    }

    /**
     * 返还对象
     */
    return(obj: T): void {
        if (this.pool.length < this.maxSize) {
            this.resetFn(obj);
            this.pool.push(obj);
        } else {
            // 超过最大池大小，直接销毁
            obj.destroy();
        }
    }

    /**
     * 清空对象池
     */
    clear(): void {
        this.pool.forEach(obj => obj.destroy());
        this.pool = [];
    }

    /**
     * 获取池中对象数量
     */
    getPoolSize(): number {
        return this.pool.length;
    }
}

/**
 * 角色管理器
 * 单例模式，管理游戏中所有角色
 */
@ccclass('RoleManager')
export class RoleManager extends Component {
    @property({ displayName: "玩家预制体", tooltip: "玩家角色预制体" })
    public playerPrefab: Prefab | null = null;

    @property({ displayName: "NPC预制体列表", tooltip: "各类NPC预制体" })
    public npcPrefabs: Prefab[] = [];

    @property({ displayName: "最大玩家数量", tooltip: "游戏中最大玩家数量" })
    public maxPlayers: number = 4;

    @property({ displayName: "NPC池大小", tooltip: "NPC对象池大小" })
    public npcPoolSize: number = 20;

    @property({ displayName: "启用对象池", tooltip: "是否启用NPC对象池" })
    public enablePooling: boolean = true;

    // 单例实例
    private static _instance: RoleManager | null = null;

    // 角色存储
    private players: Map<number, Player> = new Map();
    private npcs: Map<number, NPC> = new Map();
    private allRoles: Map<number, Role> = new Map();

    // 对象池
    private npcPools: Map<NPCType, ObjectPool<NPC>> = new Map();

    // ID生成器
    private nextRoleId: number = 1;
    private nextPlayerId: number = 1;
    private nextNpcId: number = 1000;

    // 事件系统
    private eventTarget: EventTarget = new EventTarget();

    /**
     * 获取单例实例
     */
    public static getInstance(): RoleManager | null {
        return RoleManager._instance;
    }

    protected onLoad(): void {
        // 设置单例
        if (RoleManager._instance === null) {
            RoleManager._instance = this;
            director.addPersistRootNode(this.node);
        } else {
            this.destroy();
            return;
        }

        this.initializeObjectPools();
    }

    protected onDestroy(): void {
        if (RoleManager._instance === this) {
            RoleManager._instance = null;
        }
        this.clearAllPools();
    }

    /**
     * 初始化对象池
     */
    private initializeObjectPools(): void {
        if (!this.enablePooling) return;

        // 为每种NPC类型创建对象池
        const npcTypes = Object.values(NPCType).filter(value => typeof value === 'string') as NPCType[];
        
        for (const npcType of npcTypes) {
            const pool = new ObjectPool<NPC>(
                () => this.createNPCInstance(npcType),
                (npc: NPC) => this.resetNPC(npc),
                this.npcPoolSize
            );
            this.npcPools.set(npcType, pool);
        }
    }

    /**
     * 创建玩家
     */
    public async createPlayer(playerData: PlayerData): Promise<Player | null> {
        if (this.players.size >= this.maxPlayers) {
            console.warn('已达到最大玩家数量限制');
            return null;
        }

        try {
            // 创建玩家实例
            const player = new Player();
            const playerId = playerData.roleId || this.generatePlayerId();

            // 初始化玩家数据
            await player.init(playerId, playerData);

            // 创建Actor组件
            const actorNode = await this.createActorNode(this.playerPrefab);
            if (actorNode) {
                const actor = actorNode.getComponent(Actor);
                if (actor) {
                    player.setActor(actor);
                    actor.bindRole(player);
                }
            }

            // 注册玩家
            this.players.set(playerId, player);
            this.allRoles.set(playerId, player);

            // 触发事件
            this.eventTarget.dispatchEvent(new CustomEvent('player-created', { 
                detail: { playerId, player } 
            }));

            console.log(`玩家创建成功: ID=${playerId}, Name=${player.getName()}`);
            return player;

        } catch (error) {
            console.error('创建玩家失败:', error);
            return null;
        }
    }

    /**
     * 创建NPC
     */
    public async createNPC(npcData: NPCData): Promise<NPC | null> {
        try {
            let npc: NPC;

            if (this.enablePooling && this.npcPools.has(npcData.npcType)) {
                // 从对象池获取
                const pool = this.npcPools.get(npcData.npcType)!;
                npc = pool.get();
            } else {
                // 直接创建
                npc = this.createNPCInstance(npcData.npcType);
            }

            const npcId = npcData.roleId || this.generateNpcId();

            // 初始化NPC数据
            await npc.init(npcId, npcData);

            // 创建Actor组件
            const prefab = this.getNPCPrefab(npcData.npcType);
            const actorNode = await this.createActorNode(prefab);
            if (actorNode) {
                const actor = actorNode.getComponent(Actor);
                if (actor) {
                    npc.setActor(actor);
                    actor.bindRole(npc);
                }
            }

            // 注册NPC
            this.npcs.set(npcId, npc);
            this.allRoles.set(npcId, npc);

            // 触发事件
            this.eventTarget.dispatchEvent(new CustomEvent('npc-created', { 
                detail: { npcId, npc } 
            }));

            console.log(`NPC创建成功: ID=${npcId}, Type=${npcData.npcType}`);
            return npc;

        } catch (error) {
            console.error('创建NPC失败:', error);
            return null;
        }
    }

    /**
     * 销毁角色
     */
    public destroyRole(roleId: number): boolean {
        const role = this.allRoles.get(roleId);
        if (!role) return false;

        try {
            // 从存储中移除
            this.allRoles.delete(roleId);
            
            if (role instanceof Player) {
                this.players.delete(roleId);
                this.eventTarget.dispatchEvent(new CustomEvent('player-destroyed', { 
                    detail: { playerId: roleId } 
                }));
            } else if (role instanceof NPC) {
                this.npcs.delete(roleId);
                
                // 如果启用对象池，返还到池中
                if (this.enablePooling) {
                    const npcType = (role as NPC).getNPCType();
                    const pool = this.npcPools.get(npcType);
                    if (pool) {
                        pool.return(role as NPC);
                        return true;
                    }
                }
                
                this.eventTarget.dispatchEvent(new CustomEvent('npc-destroyed', { 
                    detail: { npcId: roleId } 
                }));
            }

            // 销毁角色
            role.destroy();
            return true;

        } catch (error) {
            console.error('销毁角色失败:', error);
            return false;
        }
    }

    /**
     * 获取玩家
     */
    public getPlayer(playerId: number): Player | null {
        return this.players.get(playerId) || null;
    }

    /**
     * 获取NPC
     */
    public getNPC(npcId: number): NPC | null {
        return this.npcs.get(npcId) || null;
    }

    /**
     * 获取角色
     */
    public getRole(roleId: number): Role | null {
        return this.allRoles.get(roleId) || null;
    }

    /**
     * 获取所有玩家
     */
    public getAllPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    /**
     * 获取所有NPC
     */
    public getAllNPCs(): NPC[] {
        return Array.from(this.npcs.values());
    }

    /**
     * 获取指定类型的所有NPC
     */
    public getNPCsByType(npcType: NPCType): NPC[] {
        return this.getAllNPCs().filter(npc => npc.getNPCType() === npcType);
    }

    /**
     * 获取所有角色
     */
    public getAllRoles(): Role[] {
        return Array.from(this.allRoles.values());
    }

    /**
     * 根据位置查找角色
     */
    public getRolesByPosition(position: Vec3, radius: number = 1): Role[] {
        return this.getAllRoles().filter(role => {
            const actor = role.getActor();
            if (!actor) return false;
            
            const distance = Vec3.distance(actor.node.position, position);
            return distance <= radius;
        });
    }

    /**
     * 根据地块索引查找角色
     */
    public getRolesByTileIndex(tileIndex: number): Role[] {
        return this.getAllRoles().filter(role => {
            return role.getCurrentTileIndex() === tileIndex;
        });
    }

    /**
     * 清空所有角色
     */
    public clearAllRoles(): void {
        // 销毁所有角色
        for (const [roleId] of this.allRoles) {
            this.destroyRole(roleId);
        }

        // 清空对象池
        this.clearAllPools();

        // 重置ID生成器
        this.nextRoleId = 1;
        this.nextPlayerId = 1;
        this.nextNpcId = 1000;
    }

    /**
     * 获取管理器统计信息
     */
    public getStats(): {
        totalRoles: number;
        players: number;
        npcs: number;
        poolStats: { [key: string]: number };
    } {
        const poolStats: { [key: string]: number } = {};
        for (const [npcType, pool] of this.npcPools) {
            poolStats[npcType] = pool.getPoolSize();
        }

        return {
            totalRoles: this.allRoles.size,
            players: this.players.size,
            npcs: this.npcs.size,
            poolStats
        };
    }

    /**
     * 添加事件监听器
     */
    public addEventListener(type: string, listener: EventListener): void {
        this.eventTarget.addEventListener(type, listener);
    }

    /**
     * 移除事件监听器
     */
    public removeEventListener(type: string, listener: EventListener): void {
        this.eventTarget.removeEventListener(type, listener);
    }

    // 私有辅助方法

    /**
     * 创建NPC实例
     */
    private createNPCInstance(npcType: NPCType): NPC {
        const npc = new NPC();
        return npc;
    }

    /**
     * 重置NPC状态
     */
    private resetNPC(npc: NPC): void {
        npc.reset();
    }

    /**
     * 创建Actor节点
     */
    private async createActorNode(prefab: Prefab | null): Promise<Node | null> {
        if (!prefab) return null;

        try {
            const node = instantiate(prefab);
            if (!node.getComponent(Actor)) {
                node.addComponent(Actor);
            }
            return node;
        } catch (error) {
            console.error('创建Actor节点失败:', error);
            return null;
        }
    }

    /**
     * 获取NPC预制体
     */
    private getNPCPrefab(npcType: NPCType): Prefab | null {
        // 这里应该根据npcType返回对应的预制体
        // 暂时返回第一个预制体
        return this.npcPrefabs.length > 0 ? this.npcPrefabs[0] : null;
    }

    /**
     * 生成玩家ID
     */
    private generatePlayerId(): number {
        return this.nextPlayerId++;
    }

    /**
     * 生成NPC ID
     */
    private generateNpcId(): number {
        return this.nextNpcId++;
    }

    /**
     * 清空所有对象池
     */
    private clearAllPools(): void {
        for (const pool of this.npcPools.values()) {
            pool.clear();
        }
        this.npcPools.clear();
    }
}

/**
 * 全局RoleManager访问器
 */
export const roleManager = {
    get instance(): RoleManager | null {
        return RoleManager.getInstance();
    }
};