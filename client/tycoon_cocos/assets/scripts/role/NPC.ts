/**
 * NPC类 - 地图上的NPC实体
 *
 * 对应 Move 端的 NpcInst 结构
 * 只保留 extends Role，所有游戏逻辑数据来自 Move 链
 *
 * @author Web3 Tycoon Team
 * @version 2.0.0
 */

import { Role } from './Role';
import { RoleType, RoleAttribute } from './RoleTypes';
import type { NpcInst as MoveNpcInst } from '../sui/types/game';
import { NpcKind } from '../sui/types/constants';
import { EventBus } from '../events/EventBus';
import { EventTypes } from '../events/EventTypes';

/**
 * NPC 配置接口
 */
export interface NPCConfig {
    /** NPC 类型 */
    kind: number;
    /** 是否可消耗 */
    consumable: boolean;
    /** 生成池索引 */
    spawnIndex: number;
    /** 模型路径（可选） */
    modelPath?: string;
    /** 显示名称（可选） */
    displayName?: string;
}

/**
 * NPC 类
 * 继承自 Role，包含 Move 端对应的 NPC 数据
 */
export class NPC extends Role {

    // ========================= Move 端对应字段 =========================

    /** NPC 类型（对应 Move NpcInst.kind） */
    protected _kind: number = NpcKind.NONE;

    /** 是否可消耗（对应 Move NpcInst.consumable） */
    protected _consumable: boolean = false;

    /** 生成池索引（对应 Move NpcInst.spawn_index） */
    protected _spawnIndex: number = 0xFFFF; // 0xFFFF 表示玩家放置

    // ========================= 客户端辅助字段 =========================

    /** 所在地块ID */
    protected _tileId: number = -1;

    // ========================= 构造和初始化 =========================

    constructor() {
        super();
        this.m_eType = RoleType.NPC;
        console.log('[NPC] NPC 实例创建');
    }

    /**
     * 从 Move NpcInst 对象加载数据
     * @param moveNpc Move 端的 NpcInst 对象
     * @param tileId 所在地块ID（可选）
     */
    public loadFromMoveNPC(moveNpc: MoveNpcInst, tileId?: number): void {
        console.log('[NPC] 从 Move NpcInst 加载数据', moveNpc);

        // Move 端字段
        this._kind = moveNpc.kind;
        this._consumable = moveNpc.consumable;
        this._spawnIndex = moveNpc.spawn_index;

        // 辅助字段
        if (tileId !== undefined) {
            this._tileId = tileId;
        }

        // 设置名称和ID
        this.m_strName = this.getNPCKindName(this._kind);
        this.m_oId = `npc_${this._kind}_${this._spawnIndex}_${Date.now()}`;

        // 同步到 Role 基类属性
        this.setAttr(RoleAttribute.HP, 1);

        console.log('[NPC] NPC数据加载完成', {
            kind: this._kind,
            name: this.m_strName,
            consumable: this._consumable,
            spawnIndex: this._spawnIndex,
            tileId: this._tileId
        });

        // 触发NPC数据加载事件
        EventBus.emit(EventTypes.Role.Initialized, {
            roleId: this.m_oId,
            role: this,
            npcKind: this._kind
        });
    }

    /**
     * 从配置创建NPC
     */
    public loadFromConfig(config: NPCConfig, tileId?: number): void {
        console.log('[NPC] 从配置加载数据', config);

        this._kind = config.kind;
        this._consumable = config.consumable;
        this._spawnIndex = config.spawnIndex;

        if (tileId !== undefined) {
            this._tileId = tileId;
        }

        // 设置名称
        this.m_strName = config.displayName || this.getNPCKindName(this._kind);
        this.m_oId = `npc_${this._kind}_${this._spawnIndex}_${Date.now()}`;

        console.log('[NPC] NPC配置加载完成');
    }

    // ========================= 辅助方法 =========================

    /**
     * 根据 NPC 类型获取名称
     */
    private getNPCKindName(kind: number): string {
        switch (kind) {
            case NpcKind.BARRIER: return '路障';
            case NpcKind.BOMB: return '炸弹';
            case NpcKind.DOG: return '恶犬';
            case NpcKind.LAND_GOD: return '土地神';
            case NpcKind.WEALTH_GOD: return '财神';
            case NpcKind.FORTUNE_GOD: return '福神';
            case NpcKind.POOR_GOD: return '穷神';
            default: return `NPC_${kind}`;
        }
    }

    /**
     * 检查是否为玩家放置的NPC
     */
    public isPlayerPlaced(): boolean {
        return this._spawnIndex === 0xFFFF;
    }

    /**
     * 检查是否为障碍型NPC
     */
    public isBarrierType(): boolean {
        return this._kind === NpcKind.BARRIER ||
               this._kind === NpcKind.BOMB ||
               this._kind === NpcKind.DOG;
    }

    /**
     * 检查是否为增益型NPC
     */
    public isBeneficialType(): boolean {
        return this._kind === NpcKind.LAND_GOD ||
               this._kind === NpcKind.WEALTH_GOD ||
               this._kind === NpcKind.FORTUNE_GOD;
    }

    /**
     * 检查是否为干扰型NPC
     */
    public isDisruptiveType(): boolean {
        return this._kind === NpcKind.POOR_GOD;
    }

    // ========================= 访问器 =========================

    public getKind(): number { return this._kind; }
    public isConsumable(): boolean { return this._consumable; }
    public getSpawnIndex(): number { return this._spawnIndex; }
    public getTileId(): number { return this._tileId; }

    public setTileId(tileId: number): void {
        this._tileId = tileId;
        this.setCurrentTileId(tileId);
    }

    // PaperActor 关联方法继承自 Role 基类
    // setPaperActor(), getPaperActor()

    // ========================= 重写方法 =========================

    /**
     * 重写重置方法
     */
    public reset(): void {
        super.reset();

        // 重置NPC数据
        this._kind = NpcKind.NONE;
        this._consumable = false;
        this._spawnIndex = 0xFFFF;
        this._tileId = -1;

        // _paperActor 由 Role.reset() 处理

        console.log('[NPC] NPC重置完成');
    }

    /**
     * 重写调试信息
     */
    public debugInfo(): string {
        const baseInfo = super.debugInfo();
        const npcInfo = [
            `Kind: ${this._kind} (${this.m_strName})`,
            `Consumable: ${this._consumable}`,
            `SpawnIndex: ${this._spawnIndex}`,
            `TileId: ${this._tileId}`,
            `PlayerPlaced: ${this.isPlayerPlaced()}`
        ];

        return `${baseInfo}, ${npcInfo.join(', ')}`;
    }
}
