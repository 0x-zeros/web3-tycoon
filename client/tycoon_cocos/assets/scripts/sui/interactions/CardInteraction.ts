/**
 * CardInteraction - 卡片合约交互
 *
 * 封装use_card合约调用
 * 构建PTB (Programmable Transaction Block)
 *
 * @author Web3 Tycoon Team
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiManager } from '../managers/SuiManager';

/**
 * 交易结果
 */
export interface TransactionResult {
    success: boolean;
    message: string;
    digest?: string;
}

/**
 * 卡片合约交互
 */
export class CardInteraction {
    /**
     * 调用use_card合约函数
     *
     * entry fun use_card(
     *     game: &mut Game,
     *     seat: &Seat,
     *     kind: u8,
     *     params: vector<u16>,
     *     game_data: &GameData,
     *     map: &map::MapTemplate,
     *     ctx: &mut TxContext
     * )
     * 注意：use_card 不再需要 Random 参数
     */
    static async useCard(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        params: number[]
    ): Promise<TransactionResult> {
        try {
            console.log('[CardInteraction] 调用use_card:', {
                gameId,
                seatId,
                mapTemplateId,
                cardKind,
                params
            });

            const tx = this.buildUseCardTransaction(gameId, seatId, mapTemplateId, cardKind, params);

            // 执行交易
            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[CardInteraction] 交易成功:', result.digest);

            return {
                success: true,
                message: '卡片使用成功',
                digest: result.digest
            };
        } catch (error: any) {
            console.error('[CardInteraction] useCard失败:', error);
            return {
                success: false,
                message: error.message || '使用卡片失败'
            };
        }
    }

    /**
     * 批量购买普通卡片（kind 0-7）
     * 价格：100/张
     * purchases: 要购买的卡片 kind 列表，每个元素表示一张卡（可重复）
     *
     * entry fun buy_cards(
     *     game: &mut Game,
     *     seat: &Seat,
     *     game_data: &GameData,
     *     purchases: vector<u8>,
     *     map: &map::MapTemplate,
     *     r: &Random,
     *     ctx: &mut TxContext
     * )
     */
    static async buyCards(
        gameId: string,
        seatId: string,
        gameDataId: string,
        purchases: number[],
        mapTemplateId: string
    ): Promise<TransactionResult> {
        try {
            console.log('[CardInteraction] 批量购买普通卡片:', { gameId, seatId, gameDataId, purchases, mapTemplateId });

            const tx = new Transaction();
            const config = SuiManager.instance.config;

            if (!config) {
                throw new Error('SuiManager配置未初始化');
            }

            const packageId = config.packageId;

            // 从配置获取 Random 对象 ID
            const randomObjectId = config.randomObjectId || '0x8';

            tx.moveCall({
                target: `${packageId}::game::buy_cards`,
                arguments: [
                    tx.object(gameId),
                    tx.object(seatId),
                    tx.object(gameDataId),
                    tx.pure.vector('u8', purchases),
                    tx.object(mapTemplateId),
                    tx.object(randomObjectId),
                ]
            });

            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[CardInteraction] 批量购买成功:', result.digest);
            return {
                success: true,
                message: '卡片购买成功',
                digest: result.digest
            };
        } catch (error: any) {
            console.error('[CardInteraction] buyCards失败:', error);
            return {
                success: false,
                message: error.message || '购买卡片失败'
            };
        }
    }

    /**
     * 批量购买GM卡片（kind 8-16），需要GMPass
     * 价格：500/张
     * purchases: 要购买的卡片 kind 列表，每个元素表示一张卡（可重复）
     *
     * entry fun buy_gm_cards(
     *     game: &mut Game,
     *     seat: &Seat,
     *     gm_pass: &GMPass,
     *     game_data: &GameData,
     *     purchases: vector<u8>,
     *     map: &map::MapTemplate,
     *     r: &Random,
     *     ctx: &mut TxContext
     * )
     */
    static async buyGMCards(
        gameId: string,
        seatId: string,
        gmPassId: string,
        gameDataId: string,
        purchases: number[],
        mapTemplateId: string
    ): Promise<TransactionResult> {
        try {
            console.log('[CardInteraction] 批量购买GM卡片:', { gameId, seatId, gmPassId, gameDataId, purchases, mapTemplateId });

            const tx = new Transaction();
            const config = SuiManager.instance.config;

            if (!config) {
                throw new Error('SuiManager配置未初始化');
            }

            const packageId = config.packageId;

            // 从配置获取 Random 对象 ID
            const randomObjectId = config.randomObjectId || '0x8';

            tx.moveCall({
                target: `${packageId}::game::buy_gm_cards`,
                arguments: [
                    tx.object(gameId),
                    tx.object(seatId),
                    tx.object(gmPassId),
                    tx.object(gameDataId),
                    tx.pure.vector('u8', purchases),
                    tx.object(mapTemplateId),
                    tx.object(randomObjectId),
                ]
            });

            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[CardInteraction] GM卡片批量购买成功:', result.digest);
            return {
                success: true,
                message: 'GM卡片购买成功',
                digest: result.digest
            };
        } catch (error: any) {
            console.error('[CardInteraction] buyGMCards失败:', error);
            return {
                success: false,
                message: error.message || '购买GM卡片失败'
            };
        }
    }

    /**
     * 跳过卡片商店（不购买任何卡片）
     *
     * entry fun skip_card_shop(
     *     game: &mut Game,
     *     seat: &Seat,
     *     game_data: &GameData,
     *     map: &map::MapTemplate,
     *     r: &Random,
     *     ctx: &mut TxContext
     * )
     */
    static async skipCardShop(
        gameId: string,
        seatId: string,
        gameDataId: string,
        mapTemplateId: string
    ): Promise<TransactionResult> {
        try {
            console.log('[CardInteraction] 跳过卡片商店:', { gameId, seatId, gameDataId, mapTemplateId });

            const tx = new Transaction();
            const config = SuiManager.instance.config;

            if (!config) {
                throw new Error('SuiManager配置未初始化');
            }

            const packageId = config.packageId;

            // 从配置获取 Random 对象 ID
            const randomObjectId = config.randomObjectId || '0x8';

            tx.moveCall({
                target: `${packageId}::game::skip_card_shop`,
                arguments: [
                    tx.object(gameId),
                    tx.object(seatId),
                    tx.object(gameDataId),
                    tx.object(mapTemplateId),
                    tx.object(randomObjectId),
                ]
            });

            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[CardInteraction] 跳过卡片商店成功:', result.digest);
            return {
                success: true,
                message: '已跳过卡片商店',
                digest: result.digest
            };
        } catch (error: any) {
            console.error('[CardInteraction] skipCardShop失败:', error);
            return {
                success: false,
                message: error.message || '跳过卡片商店失败'
            };
        }
    }

    /**
     * 调用use_card并立即roll_and_step（合并PTB）
     * 用于遥控骰子卡片，使用后直接移动
     *
     * @param gameId 游戏ID
     * @param seatId 座位ID
     * @param mapTemplateId 地图模板ID
     * @param cardKind 卡片类型
     * @param cardParams 卡片参数 [player_index, dice1, dice2, ...]
     * @param path 移动路径（不含起点）
     * @param diceCount 骰子数量
     * @param autoBuy 自动购买
     * @param autoUpgrade 自动升级
     * @param preferRentCard 优先使用免租卡
     */
    static async useCardAndRollAndStep(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        cardParams: number[],
        path: number[],
        diceCount: number,
        autoBuy: boolean,
        autoUpgrade: boolean,
        preferRentCard: boolean
    ): Promise<TransactionResult> {
        try {
            console.log('[CardInteraction] 调用useCardAndRollAndStep:', {
                gameId,
                seatId,
                mapTemplateId,
                cardKind,
                cardParams,
                path,
                diceCount,
                autoBuy,
                autoUpgrade,
                preferRentCard
            });

            const tx = this.buildUseCardAndRollAndStepTransaction(
                gameId,
                seatId,
                mapTemplateId,
                cardKind,
                cardParams,
                path,
                diceCount,
                autoBuy,
                autoUpgrade,
                preferRentCard
            );

            // 执行交易
            const result = await SuiManager.instance.signAndExecuteTransaction(tx);

            console.log('[CardInteraction] 合并交易成功:', result.digest);

            return {
                success: true,
                message: '卡片使用并移动成功',
                digest: result.digest
            };
        } catch (error: any) {
            console.error('[CardInteraction] useCardAndRollAndStep失败:', error);
            return {
                success: false,
                message: error.message || '使用卡片并移动失败'
            };
        }
    }

    /**
     * 构建use_card + roll_and_step合并交易
     */
    private static buildUseCardAndRollAndStepTransaction(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        cardParams: number[],
        path: number[],
        diceCount: number,
        autoBuy: boolean,
        autoUpgrade: boolean,
        preferRentCard: boolean
    ): Transaction {
        const tx = new Transaction();
        const config = SuiManager.instance.config;

        if (!config) {
            throw new Error('SuiManager配置未初始化');
        }

        const packageId = config.packageId;
        const gameDataId = config.gameDataId;
        const randomObjectId = config.randomObjectId || '0x8';
        const clockObjectId = config.clockObjectId || '0x6';

        if (!packageId || !gameDataId) {
            throw new Error('缺少必要的配置: packageId, gameDataId');
        }

        console.log('[CardInteraction] 构建合并交易:', {
            packageId,
            gameDataId,
            mapTemplateId,
            cardKind,
            cardParamsLength: cardParams.length,
            pathLength: path.length,
            diceCount
        });

        // 1. 调用use_card（不需要 Random 参数）
        tx.moveCall({
            target: `${packageId}::game::use_card`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.u8(cardKind),
                tx.pure.vector('u16', cardParams),
                tx.object(gameDataId),
                tx.object(mapTemplateId)
            ]
        });

        // 2. 调用roll_and_step（需要 Random 参数）
        tx.moveCall({
            target: `${packageId}::game::roll_and_step`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.vector('u16', path),
                tx.pure.u8(diceCount),
                tx.pure.bool(autoBuy),
                tx.pure.bool(autoUpgrade),
                tx.pure.bool(preferRentCard),
                tx.object(gameDataId),
                tx.object(mapTemplateId),
                tx.object(randomObjectId),
                tx.object(clockObjectId)
            ]
        });

        return tx;
    }

    /**
     * 构建use_card交易
     */
    private static buildUseCardTransaction(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        cardKind: number,
        params: number[]
    ): Transaction {
        const tx = new Transaction();
        const config = SuiManager.instance.config;

        if (!config) {
            throw new Error('SuiManager配置未初始化');
        }

        // 获取必要的对象
        const packageId = config.packageId;
        const gameDataId = config.gameDataId;

        if (!packageId || !gameDataId) {
            throw new Error('缺少必要的配置: packageId, gameDataId');
        }

        console.log('[CardInteraction] 构建交易:', {
            packageId,
            gameDataId,
            mapTemplateId,
            cardKind,
            paramsLength: params.length
        });

        // 调用use_card（不再需要 Random 参数）
        tx.moveCall({
            target: `${packageId}::game::use_card`,
            arguments: [
                tx.object(gameId),
                tx.object(seatId),
                tx.pure.u8(cardKind),
                tx.pure.vector('u16', params),
                tx.object(gameDataId),
                tx.object(mapTemplateId)
            ]
        });

        return tx;
    }
}
