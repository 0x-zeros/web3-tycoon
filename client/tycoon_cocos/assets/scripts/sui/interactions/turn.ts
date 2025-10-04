/**
 * 回合交互函数封装
 * 封装与Move合约的回合相关交互逻辑
 *
 * Move源文件: move/tycoon/sources/game.move
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { RollAndStepActionEvent } from '../events/aggregated';

/**
 * 回合交互类
 */
export class TurnInteraction {
    constructor(
        private client: SuiClient,
        private packageId: string,
        private gameDataId: string
    ) {}

    /**
     * 掷骰并移动
     * 对应Move: public entry fun roll_and_step
     */
    async rollAndStep(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        path: number[] = [],
        keypair: Ed25519Keypair
    ): Promise<{
        dice: number;
        endPos: number;
        event: RollAndStepActionEvent;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用roll_and_step函数
        tx.moveCall({
            target: `${this.packageId}::game::roll_and_step`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(seatId),          // seat: &Seat
                tx.pure.vector('u16', path), // path: vector<u16>
                tx.object(this.gameDataId), // game_data: &GameData
                tx.object(mapTemplateId),   // map: &MapTemplate
                tx.object('0x8'),           // random: &Random
                tx.object('0x6')            // clock: &Clock
            ]
        });

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEvents: true
            }
        });

        // 解析事件
        const event = this.extractRollAndStepEvent(result);

        return {
            dice: event.dice,
            endPos: event.end_pos,
            event,
            txHash: result.digest
        };
    }

    /**
     * 结束回合
     * 对应Move: public entry fun end_turn
     */
    async endTurn(
        gameId: string,
        seatId: string,
        keypair: Ed25519Keypair
    ): Promise<{
        success: boolean;
        nextPlayer?: string;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用end_turn函数
        tx.moveCall({
            target: `${this.packageId}::game::end_turn`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(this.gameDataId), // game_data: &GameData
                tx.object(seatId),          // seat: &Seat
                tx.object('0x8')            // random: &Random
            ]
        });

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEvents: true
            }
        });

        // 解析下一个玩家
        const nextPlayer = this.extractNextPlayer(result);

        return {
            success: true,
            nextPlayer,
            txHash: result.digest
        };
    }

    /**
     * 跳过地产决策
     * 对应Move: public entry fun skip_property_decision
     */
    async skipPropertyDecision(
        gameId: string,
        seatId: string,
        keypair: Ed25519Keypair
    ): Promise<{
        success: boolean;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用skip_property_decision函数
        tx.moveCall({
            target: `${this.packageId}::game::skip_property_decision`,
            arguments: [
                tx.object(gameId), // game: &mut Game
                tx.object(seatId)  // seat: &Seat
            ]
        });

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair
        });

        return {
            success: true,
            txHash: result.digest
        };
    }

    /**
     * 决定租金支付方式
     * 对应Move: public entry fun decide_rent_payment
     */
    async decideRentPayment(
        gameId: string,
        seatId: string,
        mapTemplateId: string,
        useRentFree: boolean,
        keypair: Ed25519Keypair
    ): Promise<{
        success: boolean;
        amountPaid: bigint;
        txHash: string;
    }> {
        const tx = new Transaction();

        // 调用decide_rent_payment函数
        tx.moveCall({
            target: `${this.packageId}::game::decide_rent_payment`,
            arguments: [
                tx.object(gameId),          // game: &mut Game
                tx.object(seatId),          // seat: &Seat
                tx.pure.bool(useRentFree),  // use_rent_free: bool
                tx.object(this.gameDataId), // game_data: &GameData
                tx.object(mapTemplateId)    // map: &MapTemplate
            ]
        });

        // 执行交易
        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            options: {
                showEvents: true
            }
        });

        // 从事件中提取支付金额
        const amountPaid = this.extractPaymentAmount(result);

        return {
            success: true,
            amountPaid,
            txHash: result.digest
        };
    }

    // ===== 辅助函数 =====

    /**
     * 从交易结果中提取RollAndStepActionEvent
     */
    private extractRollAndStepEvent(result: any): RollAndStepActionEvent {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('RollAndStepActionEvent')) {
                const data = event.parsedJson;
                return {
                    game: data.game,
                    player: data.player,
                    round: data.round,
                    turn_in_round: data.turn_in_round,
                    dice: data.dice,
                    path_choices: data.path_choices || [],
                    from: data.from,
                    steps: data.steps || [],
                    cash_changes: data.cash_changes || [],
                    end_pos: data.end_pos
                };
            }
        }

        // 如果没有找到事件，返回默认值
        return {
            game: '',
            player: '',
            round: 0,
            turn_in_round: 0,
            dice: 0,
            path_choices: [],
            from: 0,
            steps: [],
            cash_changes: [],
            end_pos: 0
        };
    }

    /**
     * 从交易结果中提取下一个玩家
     */
    private extractNextPlayer(result: any): string | undefined {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('TurnStartEvent')) {
                return event.parsedJson?.player;
            }
        }
        return undefined;
    }

    /**
     * 从交易结果中提取支付金额
     */
    private extractPaymentAmount(result: any): bigint {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('RollAndStepActionEvent') ||
                event.type.includes('UseCardActionEvent')) {
                const cashChanges = event.parsedJson?.cash_changes || [];
                for (const change of cashChanges) {
                    if (change.is_debit && change.reason === 1) { // 1 = toll
                        return BigInt(change.amount);
                    }
                }
            }
        }
        return 0n;
    }
}