/**
 * 游戏交互函数封装
 * 封装与Move合约的游戏相关交互逻辑
 *
 * Move源文件: move/tycoon/sources/game.move
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Game, Player, Building, Tile, GameCreateConfig, Seat, NpcInst } from '../types/game';

/**
 * 游戏交互类
 */
export class GameInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string  // GameData共享对象ID
    ) {}

    // ============ 新版本：返回 Transaction（推荐使用）============

    /**
     * 构建创建游戏的交易
     * @param config 游戏创建配置
     * @param senderAddress 发送者地址（用于 transferObjects）
     * @returns Transaction 对象
     */
    buildCreateGameTx(config: GameCreateConfig, senderAddress: string): Transaction {
        const tx = new Transaction();

        // 构建 params 向量（根据 Move 端的 parse_game_params）
        // params[0] = starting_cash
        // params[1] = price_rise_days
        // params[2] = max_rounds
        // 注意：上层 SuiManager 已确保传入正确的默认值，这里直接使用
        const params = [
            Number(config.starting_cash),     // 上层已填充 GameData.starting_cash
            config.price_rise_days,           // 上层已填充 15
            config.max_rounds                 // 上层已填充 0
        ];

        console.log('[GameInteraction] buildCreateGameTx params:', params);
        console.log('  starting_cash:', config.starting_cash);

        // 调用 create_game 函数（entry fun，不返回值）
        // 合约内部已处理 share_object 和 transfer
        tx.moveCall({
            target: `${this.packageId}::game::create_game`,
            arguments: [
                tx.object(this.gameDataId),           // game_data: &GameData
                tx.object(config.template_map_id),    // map: &MapTemplate
                tx.pure.vector('u64', params)         // params: vector<u64>
            ]
        });

        // entry fun 内部已调用：
        // - transfer::share_object(game)
        // - transfer::transfer(seat, creator)
        // 所以不需要手动处理

        return tx;
    }

    /**
     * 构建加入游戏的交易
     * @param gameId 游戏 ID
     * @returns Transaction 对象
     */
    buildJoinGameTx(gameId: string): Transaction {
        const tx = new Transaction();

        // 调用 join 函数（entry fun，不返回值）
        // 合约内部已处理 transfer::transfer(seat, player_addr)
        tx.moveCall({
            target: `${this.packageId}::game::join`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(this.gameDataId)  // game_data: &GameData
            ]
        });

        // entry fun 内部已调用：
        // - transfer::transfer(seat, player_addr)
        // 所以不需要手动 transferObjects

        return tx;
    }

    /**
     * 构建开始游戏的交易
     * @param gameId 游戏 ID
     * @param mapTemplateId 地图模板 ID
     * @returns Transaction 对象
     */
    buildStartGameTx(gameId: string, mapTemplateId: string): Transaction {
        const tx = new Transaction();

        // 调用start函数
        tx.moveCall({
            target: `${this.packageId}::game::start`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(this.gameDataId), // game_data: &GameData
                tx.object(mapTemplateId),   // map: &MapTemplate
                tx.object('0x8'),           // random: &Random
                tx.object('0x6')            // clock: &Clock
            ]
        });

        return tx;
    }

    /**
     * 构建掷骰并移动的交易
     * 对应Move: public entry fun roll_and_step
     */
    buildRollAndStepTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        path: number[]
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::roll_and_step`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.vector('u16', path),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8'),  // random
                tx.object('0x6')   // clock
            ]
        });

        return tx;
    }

    /**
     * 构建结束回合的交易
     * 对应Move: public entry fun end_turn
     */
    buildEndTurnTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::end_turn`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8')  // random
            ]
        });

        return tx;
    }

    /**
     * 构建跳过建筑决策的交易
     * 对应Move: public entry fun skip_building_decision
     */
    buildSkipBuildingDecisionTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::skip_building_decision`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8')  // random
            ]
        });

        return tx;
    }

    /**
     * 构建租金支付决策的交易
     * 对应Move: public entry fun decide_rent_payment
     */
    buildDecideRentPaymentTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        useRentFree: boolean
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::decide_rent_payment`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.bool(useRentFree),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8')  // random
            ]
        });

        return tx;
    }

    /**
     * 构建购买建筑的交易
     * 对应Move: public entry fun buy_building
     */
    buildBuyBuildingTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::buy_building`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8')  // random
            ]
        });

        return tx;
    }

    /**
     * 构建升级建筑的交易
     * 对应Move: public entry fun upgrade_building
     */
    buildUpgradeBuildingTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::upgrade_building`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8')  // random
            ]
        });

        return tx;
    }

    /**
     * 构建使用卡牌的交易
     * 对应Move: public entry fun use_card
     */
    buildUseCardTx(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        params: number[]
    ): Transaction {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.packageId}::game::use_card`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.u8(cardKind),
                tx.pure.vector('u16', params),
                tx.object(this.gameDataId),
                tx.object(mapTemplateId),
                tx.object('0x8')  // random
            ]
        });

        return tx;
    }

    // ============ 查询方法已移除 ============
    // 所有查询操作请使用 QueryService
    // GameInteraction 只负责构建交易
}