/**
 * PaperActorFactory - PaperActor工厂类
 *
 * 负责创建和初始化PaperActor实例
 * 根据配置自动设置属性和资源
 */

import { Node, Vec3, Camera, find } from 'cc';
import { PaperActor, ActorType } from './PaperActor';
import { ActorConfigManager, ActorConfig } from './ActorConfig';
import { getWeb3BlockByBlockId } from '../voxel/Web3BlockTypes';

export class PaperActorFactory {

    /**
     * 创建Actor
     */
    public static createActor(actorId: string, position: Vec3): Node | null {
        // 获取配置
        const config = ActorConfigManager.getConfig(actorId);
        if (!config) {
            console.error(`[PaperActorFactory] Config not found for: ${actorId}`);
            return null;
        }

        // 根据类型创建
        if (config.type === ActorType.BUILDING) {
            return this.createBuilding(actorId, config.defaultLevel || 0, position);
        } else {
            return this.createNPC(actorId, position);
        }
    }

    /**
     * 创建NPC或物体
     */
    public static createNPC(npcType: string, position: Vec3): Node | null {
        const config = ActorConfigManager.getConfig(npcType);
        if (!config) {
            console.error(`[PaperActorFactory] NPC config not found: ${npcType}`);
            return null;
        }

        // 创建节点
        const node = new Node('NPC_' + npcType.replace('web3:', ''));

        // 添加PaperActor组件
        const actor = node.addComponent(PaperActor);

        // 设置基本信息
        actor.setActorInfo(npcType, config.type, 1);

        // 设置billboard模式
        if (config.billboardMode) {
            actor.billboardMode = config.billboardMode;
        }

        // 设置位置
        node.setPosition(position);

        // 设置缩放
        if (config.size.scale) {
            node.setScale(config.size.scale, config.size.scale, config.size.scale);
        }

        // 查找并设置相机
        this.setupCamera(actor);

        // 初始化（加载纹理等）
        actor.initialize().then(() => {
            // 根据配置启动初始动画
            this.startInitialAnimations(actor, config);
        });

        console.log(`[PaperActorFactory] Created NPC: ${npcType} at`, position);
        return node;
    }

    /**
     * 根据建筑类型获取对应的建筑Actor ID
     * @param buildingBlockId 建筑方块ID
     * @returns 对应的建筑Actor ID
     */
    private static getBuildingActorIdFromBuilding(buildingBlockId: string): string {
        // 映射表：从体素建筑ID到PaperActor建筑ID
        const buildingToActorMap: Record<string, string> = {
            // 基础建筑类型
            'web3:building_1x1': 'web3:building_1x1',
            'web3:building_2x2': 'web3:building_2x2',

            // 升级后的具体建筑类型（保留供未来使用）
            'web3:temple': 'web3:temple',
            'web3:research': 'web3:research',
            'web3:oil_company': 'web3:oil_company',
            'web3:commercial': 'web3:commercial',
            'web3:hotel': 'web3:hotel',
            'web3:property_small': 'web3:property_small',  // 升级后的小型房屋
        };

        // 如果找到映射，使用映射的建筑ID；否则回退到传入的buildingBlockId
        return buildingToActorMap[buildingBlockId] || buildingBlockId;
    }

    /**
     * 创建建筑
     */
    public static createBuilding(buildingType: string, level: number, position: Vec3): Node | null {
        // 将地产ID转换为建筑Actor ID
        const buildingActorId = this.getBuildingActorIdFromBuilding(buildingType);

        const config = ActorConfigManager.getConfig(buildingActorId);
        if (!config) {
            console.error(`[PaperActorFactory] Building config not found: ${buildingActorId} (from ${buildingType})`);
            return null;
        }

        // 创建节点
        const node = new Node('Building_' + buildingType.replace('web3:', ''));

        // 添加PaperActor组件
        const actor = node.addComponent(PaperActor);

        // 设置基本信息
        actor.setActorInfo(buildingActorId, ActorType.BUILDING, level);

        // 建筑通常不需要billboard
        actor.billboardMode = config.billboardMode || 'off';

        // 设置位置
        node.setPosition(position);

        // 设置缩放（2x2建筑需要更大的缩放）
        const scale = 1;//config.size.scale || 1;
        node.setScale(scale, scale, scale);

        // 查找并设置相机
        this.setupCamera(actor);

        // 初始化
        actor.initialize();

        // console.log(`[PaperActorFactory] Created Building: ${buildingActorId} (from ${buildingType}) Lv${level} at`, position);
        return node;
    }

    /**
     * 创建玩家角色
     */
    public static createPlayer(playerId: string, position: Vec3): Node | null {
        // 玩家使用特殊的配置
        const node = new Node('Player_' + playerId);

        const actor = node.addComponent(PaperActor);
        actor.setActorInfo('web3:player_' + playerId, ActorType.PLAYER, 1);
        actor.billboardMode = 'yAxis';

        node.setPosition(position);

        // 查找并设置相机
        this.setupCamera(actor);

        // 初始化
        actor.initialize();

        console.log(`[PaperActorFactory] Created Player: ${playerId} at`, position);
        return node;
    }

    /**
     * 从Web3BlockType创建Actor
     */
    public static createFromBlockType(blockId: string, position: Vec3): Node | null {
        // 尝试从Web3BlockType获取信息
        const blockInfo = getWeb3BlockByBlockId(blockId);
        if (!blockInfo) {
            console.warn(`[PaperActorFactory] Block not found in Web3BlockTypes: ${blockId}`);
        }

        // 直接使用blockId作为actorId
        return this.createActor(blockId, position);
    }

    /**
     * 批量创建Actors
     */
    public static createMultiple(configs: Array<{actorId: string, position: Vec3}>): Node[] {
        const nodes: Node[] = [];

        for (const config of configs) {
            const node = this.createActor(config.actorId, config.position);
            if (node) {
                nodes.push(node);
            }
        }

        return nodes;
    }

    /**
     * 升级建筑
     */
    public static upgradeBuilding(buildingNode: Node, newLevel: number): boolean {
        const actor = buildingNode.getComponent(PaperActor);
        if (!actor) {
            console.error('[PaperActorFactory] No PaperActor component found');
            return false;
        }

        // 检查最大等级
        const maxLevel = ActorConfigManager.getMaxLevel(actor.actorId);
        if (newLevel > maxLevel) {
            console.warn(`[PaperActorFactory] Level ${newLevel} exceeds max level ${maxLevel}`);
            return false;
        }

        // 执行升级动画
        actor.upgrade(newLevel);

        console.log(`[PaperActorFactory] Upgraded building ${actor.actorId} to level ${newLevel}`);
        return true;
    }

    /**
     * 设置相机引用
     */
    private static setupCamera(actor: PaperActor) {
        if (!actor.camera) {
            // 尝试查找主相机
            const cameraNode = find('Main Camera') ||
                             find('Camera') ||
                             find('Canvas/Camera');

            if (cameraNode) {
                const camera = cameraNode.getComponent(Camera);
                if (camera) {
                    actor.camera = camera;
                }
            }
        }
    }

    /**
     * 启动初始动画
     */
    private static startInitialAnimations(actor: PaperActor, config: ActorConfig) {
        // 根据配置启动默认动画
        if (config.animations.canFloat) {
            // 漂浮物体自动启动漂浮动画
            actor.float(0.2, 2);
        } else if (config.type === ActorType.NPC) {
            // NPC播放idle动画
            actor.playFrameAnimation('idle');
        }

        // 装饰物可能需要轻微的摇摆
        if (config.id.includes('deco_') && config.animations.canShake) {
            // 可以添加轻微的摇摆动画
            // actor.sway();
        }
    }

    /**
     * 创建并添加到父节点
     */
    public static createAndAddTo(
        actorId: string,
        position: Vec3,
        parent: Node
    ): Node | null {
        const node = this.createActor(actorId, position);
        if (node) {
            node.parent = parent;
        }
        return node;
    }

    /**
     * 预加载Actor资源
     */
    public static async preloadActorResources(actorIds: string[]): Promise<void> {
        // TODO: 实现资源预加载
        // 可以预先加载纹理等资源，提高创建速度
        console.log('[PaperActorFactory] Preloading resources for:', actorIds);
    }

    /**
     * 获取建议的Actor位置（考虑地形高度等）
     */
    public static getSuggestedPosition(gridX: number, gridZ: number, actorType: ActorType): Vec3 {
        const position = new Vec3(gridX, 0, gridZ);

        // 根据类型调整Y位置
        switch (actorType) {
            case ActorType.NPC:
            case ActorType.PLAYER:
                position.y = 0.5;  // 稍微抬高，避免陷入地面
                break;
            case ActorType.BUILDING:
                position.y = 0;    // 建筑贴地
                break;
            case ActorType.OBJECT:
                position.y = 0.3;  // 物体稍微抬高
                break;
        }

        return position;
    }
}
