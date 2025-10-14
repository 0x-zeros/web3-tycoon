/**
 * ActorFactory - Actor 工厂类
 *
 * 负责创建和管理 Actor 实例（3D模型渲染）
 * 用于建筑、NPC、玩家等实体的 prefab 渲染
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { Node } from 'cc';
import { Actor } from './Actor';

/**
 * ActorFactory 类
 * 提供静态工厂方法创建各类 Actor
 */
export class ActorFactory {

    /**
     * 为建筑创建 Actor
     * @param gameBuilding GameBuilding 实例
     * @returns Actor 节点
     */
    public static createForBuilding(gameBuilding: any): Node | null {
        return Actor.createBuildingActor(gameBuilding);
    }

    /**
     * 为 NPC 创建 Actor（预留，未来扩展）
     * @param npcData NPC 数据
     * @returns Actor 节点
     */
    public static createForNPC(npcData: any): Node | null {
        // TODO: 未来扩展
        // 1. 创建节点
        // 2. 加载 NPC prefab
        // 3. 设置位置、动画等
        console.warn('[ActorFactory] createForNPC not implemented yet');
        return null;
    }

    /**
     * 为 Player 创建 Actor（预留，未来扩展）
     * @param playerData Player 数据
     * @returns Actor 节点
     */
    public static createForPlayer(playerData: any): Node | null {
        // TODO: 未来扩展
        // 1. 创建节点
        // 2. 加载 Player prefab
        // 3. 设置位置、动画等
        console.warn('[ActorFactory] createForPlayer not implemented yet');
        return null;
    }

    /**
     * 更新 Actor 渲染（用于 owner/level 变化）
     * @param actorNode Actor 节点
     * @param newData 新的数据（GameBuilding/NPC/Player等）
     */
    public static updateRender(actorNode: Node, newData: any): void {
        const actor = actorNode.getComponent(Actor);
        if (!actor) {
            console.warn('[ActorFactory] No Actor component found');
            return;
        }

        // 调用 Actor 的更新方法
        actor.updateBuildingRender(newData);
    }
}
