/*
*/

module roll_the_dice::simple_roll;


use sui::balance;
use sui::balance::Balance;
use sui::coin;
use sui::coin::Coin;
use sui::random;
use sui::random::Random;
use sui::transfer::{share_object, public_transfer, transfer};
// use sui::sui::SUI;

use std::ascii::String;
use std::type_name::{into_string, get};

use sui::event;
use sui::object::{ID, UID};


public struct Game has key {
    id: UID,
    round: u64,
}

public struct Dice has key {
    id: UID,
    num: u8,
}


// event: game created, dice rolled
public struct GameCreatedEvent has drop, copy {
    /// signer of sender address
    sender: address,
    /// game id
    game_id: ID,
}

public struct DiceRolledEvent has drop, copy {
    /// signer of sender address
    sender: address,
    /// game id
    game_id: ID,
    /// round
    round: u64,
    /// dice num
    dice_num: u8
}




fun init(ctx: &mut TxContext) {

    let game = Game {
        id: object::new(ctx),
        round: 0,
    };

    share_object(game);
}


/// const SUI_RANDOM_ID: address = @0x8;
/// 0x8
fun play(game: &mut Game, rand: &Random, ctx: &mut TxContext) {

    // let num_game = game.num;
    game.round = game.round + 1;

    event::emit(GameCreatedEvent {
        sender: ctx.sender(),
        game_id: object::id(game),
    });

    let mut gen = random::new_generator(rand, ctx);
    // 生成随机数
    let dice = random::generate_u8_in_range(&mut gen, 1, 6);
    let dice_obj = Dice {
        id: object::new(ctx),
        num: dice,
    };

    event::emit(DiceRolledEvent {
        sender: ctx.sender(),
        game_id: object::id(game),
        round: game.round,
        dice_num: dice,
    });

    transfer(dice_obj, ctx.sender());
}


