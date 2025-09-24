/**
 * 游戏交互管理器
 * 封装与Move合约的所有交互逻辑
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { MapTemplate, createMapTemplateFromJSON } from './types/MapTemplate';
import { MapGraph } from './pathfinding/MapGraph';
import { BFSPathfinder } from './pathfinding/BFSPathfinder';
import { PathChoiceGenerator, PathChoiceResult } from './pathfinding/PathChoiceGenerator';

/**
 * Buff类型常量 (对应Move中的types.move)
 */
export enum BuffType {
    BUFF_MOVE_CTRL = 1,  // 遥控骰子
    BUFF_RENT_FREE = 2,  // 免租金
    // ... 其他buff类型
}

/**
 * 游戏交互配置
 */
export interface GameInteractionConfig {
    /** Sui RPC URL */
    rpcUrl: string;
    /** 游戏包ID */
    packageId: string;
    /** 地图注册表对象ID */
    mapRegistryId: string;
}

/**
 * 掷骰移动参数
 */
export interface RollAndStepParams {
    /** 游戏对象ID */
    gameId: string;
    /** 座位对象 */
    seatId: string;
    /** 目标地块（可选，用于遥控骰子） */
    targetTile?: bigint;
    /** 步数（用于遥控骰子） */
    steps?: number;
}

/**
 * 游戏交互管理器
 * 处理所有与Move合约的交互
 */
export class GameInteraction {
    private client: SuiClient;
    private config: GameInteractionConfig;
    private mapTemplates: Map<bigint, MapTemplate>;
    private mapGraphs: Map<bigint, MapGraph>;

    constructor(config: GameInteractionConfig) {
        this.config = config;
        this.client = new SuiClient({ url: config.rpcUrl });
        this.mapTemplates = new Map();
        this.mapGraphs = new Map();
    }

    /**
     * 加载地图模板
     * @param templateId 模板ID
     */
    public async loadMapTemplate(templateId: bigint): Promise<MapTemplate> {
        // 检查缓存
        if (this.mapTemplates.has(templateId)) {
            return this.mapTemplates.get(templateId)!;
        }

        // 从链上获取地图模板
        // TODO: 实际实现需要从MapRegistry读取
        const templateData = await this.fetchMapTemplateFromChain(templateId);
        const template = createMapTemplateFromJSON(templateData);

        // 缓存模板和图
        this.mapTemplates.set(templateId, template);
        this.mapGraphs.set(templateId, new MapGraph(template));

        return template;
    }

    /**
     * 执行掷骰移动
     * @param params 移动参数
     * @param walletAddress 钱包地址
     */
    public async rollAndStep(
        params: RollAndStepParams,
        walletAddress: string
    ): Promise<string> {
        const tx = new Transaction();

        // 检查是否有遥控骰子buff
        const hasRemoteControl = await this.checkRemoteControlBuff(
            params.gameId,
            walletAddress
        );

        let pathChoices: bigint[] = [];

        if (hasRemoteControl && params.targetTile !== undefined && params.steps !== undefined) {
            // 有遥控骰子，计算路径选择
            pathChoices = await this.calculatePathChoices(
                params.gameId,
                walletAddress,
                params.targetTile,
                params.steps
            );

            console.log('[GameInteraction] Using remote control dice');
            console.log(`  Target: ${params.targetTile}, Steps: ${params.steps}`);
            console.log(`  Path choices: [${pathChoices.join(', ')}]`);
        }

        // 构建交易
        tx.moveCall({
            target: `${this.config.packageId}::game::roll_and_step`,
            arguments: [
                tx.object(params.gameId),        // game: &mut Game
                tx.object(params.seatId),        // seat: &Seat
                tx.pure.vector('u64', pathChoices.map(n => n.toString())), // path_choices
                tx.object(this.config.mapRegistryId), // registry: &MapRegistry
                tx.object('0x8'),                 // random: &Random
                tx.object('0x6'),                 // clock: &Clock
            ],
        });

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: walletAddress,
            requestType: 'WaitForLocalExecution'
        });

        console.log('[GameInteraction] Transaction executed:', result.digest);
        return result.digest;
    }

    /**
     * 计算路径选择序列
     * @param gameId 游戏ID
     * @param player 玩家地址
     * @param targetTile 目标地块
     * @param steps 步数
     * @returns 路径选择序列
     */
    private async calculatePathChoices(
        gameId: string,
        player: string,
        targetTile: bigint,
        steps: number
    ): Promise<bigint[]> {
        // 获取当前位置
        const currentPos = await this.getPlayerPosition(gameId, player);

        // 获取地图模板
        const templateId = await this.getGameTemplateId(gameId);
        const graph = this.mapGraphs.get(templateId);

        if (!graph) {
            throw new Error(`Map template ${templateId} not loaded`);
        }

        // 使用BFS寻找路径
        const pathfinder = new BFSPathfinder(graph);
        const pathInfo = pathfinder.findPath(currentPos, targetTile, steps);

        if (!pathInfo) {
            throw new Error(`Cannot reach tile ${targetTile} in ${steps} steps from ${currentPos}`);
        }

        // 生成路径选择序列
        const generator = new PathChoiceGenerator(graph);
        const choiceResult = generator.generateChoices(pathInfo.path);

        console.log('[GameInteraction] Path calculation:');
        generator.debugPrintChoices(choiceResult);

        return choiceResult.forkChoices;
    }

    /**
     * 检查玩家是否有遥控骰子buff
     * @param gameId 游戏ID
     * @param player 玩家地址
     * @returns 是否有遥控骰子buff
     */
    private async checkRemoteControlBuff(
        gameId: string,
        player: string
    ): Promise<boolean> {
        // TODO: 实际实现需要查询链上状态
        // 这里暂时返回false
        return false;
    }

    /**
     * 获取玩家当前位置
     * @param gameId 游戏ID
     * @param player 玩家地址
     * @returns 当前位置的地块ID
     */
    private async getPlayerPosition(
        gameId: string,
        player: string
    ): Promise<bigint> {
        // TODO: 实际实现需要查询链上状态
        // 这里暂时返回起始位置
        return BigInt(0);
    }

    /**
     * 获取游戏使用的地图模板ID
     * @param gameId 游戏ID
     * @returns 地图模板ID
     */
    private async getGameTemplateId(gameId: string): Promise<bigint> {
        // TODO: 实际实现需要查询链上状态
        // 这里暂时返回默认模板ID
        return BigInt(1);
    }

    /**
     * 从链上获取地图模板数据
     * @param templateId 模板ID
     * @returns 地图模板数据
     */
    private async fetchMapTemplateFromChain(templateId: bigint): Promise<any> {
        // TODO: 实际实现需要从MapRegistry读取
        // 这里返回一个示例模板
        return {
            id: templateId.toString(),
            name: "Test Map",
            description: "A test map for development",
            starting_tile: "0",
            player_count_range: { min: 2, max: 4 },
            tiles: [
                {
                    id: "0",
                    kind: 10,  // START
                    cw_next: "1",
                    ccw_next: "19",
                    adj: []
                },
                {
                    id: "1",
                    kind: 1,  // PROPERTY
                    cw_next: "2",
                    ccw_next: "0",
                    adj: []
                },
                {
                    id: "2",
                    kind: 1,  // PROPERTY
                    cw_next: "3",
                    ccw_next: "1",
                    adj: ["10"]  // 邻接到地块10
                },
                // ... 更多地块
            ]
        };
    }

    /**
     * 获取可达地块（用于UI显示）
     * @param currentPos 当前位置
     * @param steps 步数
     * @param templateId 地图模板ID
     * @returns 可达地块列表
     */
    public async getReachableTiles(
        currentPos: bigint,
        steps: number,
        templateId: bigint
    ): Promise<bigint[]> {
        const graph = this.mapGraphs.get(templateId);
        if (!graph) {
            await this.loadMapTemplate(templateId);
            const loadedGraph = this.mapGraphs.get(templateId);
            if (!loadedGraph) {
                throw new Error(`Failed to load map template ${templateId}`);
            }
            return this.getReachableTilesFromGraph(loadedGraph, currentPos, steps);
        }

        return this.getReachableTilesFromGraph(graph, currentPos, steps);
    }

    /**
     * 从图中获取可达地块
     */
    private getReachableTilesFromGraph(
        graph: MapGraph,
        currentPos: bigint,
        steps: number
    ): bigint[] {
        const pathfinder = new BFSPathfinder(graph);
        return pathfinder.getTilesAtExactDistance(currentPos, steps);
    }

    /**
     * 生成并验证路径选择
     * @param currentPos 当前位置
     * @param targetTile 目标地块
     * @param steps 步数
     * @param templateId 地图模板ID
     * @returns 路径选择结果
     */
    public async generateAndValidatePath(
        currentPos: bigint,
        targetTile: bigint,
        steps: number,
        templateId: bigint
    ): Promise<PathChoiceResult> {
        const graph = this.mapGraphs.get(templateId);
        if (!graph) {
            throw new Error(`Map template ${templateId} not loaded`);
        }

        const pathfinder = new BFSPathfinder(graph);
        const pathInfo = pathfinder.findPath(currentPos, targetTile, steps);

        if (!pathInfo) {
            throw new Error(`Cannot reach tile ${targetTile} in ${steps} steps`);
        }

        const generator = new PathChoiceGenerator(graph);
        const result = generator.generateChoices(pathInfo.path);

        // 验证生成的选择序列
        const isValid = generator.validateChoices(currentPos, result.forkChoices, steps);
        if (!isValid) {
            throw new Error('Generated path choices are invalid');
        }

        return result;
    }
}