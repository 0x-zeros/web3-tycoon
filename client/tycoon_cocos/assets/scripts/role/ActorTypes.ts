/**
 * ActorTypes - Actor 相关的共享类型定义
 *
 * 抽取到独立文件以避免循环依赖：
 * - ActorConfig 需要 ActorType 枚举
 * - PaperActor 需要 ActorConfigManager
 *
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

/**
 * Actor 类型枚举
 */
export enum ActorType {
    /** NPC（各种神、狗等） */
    NPC = 0,
    /** 玩家角色 */
    PLAYER = 1,
    /** 建筑物 */
    BUILDING = 2,
    /** 特殊物体（路障、炸弹等） */
    OBJECT = 3
}
