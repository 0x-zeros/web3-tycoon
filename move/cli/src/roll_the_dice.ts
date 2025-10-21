import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { get_keypair_from_keystore, get_newly_created_object, get_transaction_events } from './utils';
import { createNetworkConfig, getExplorerUrl, NetworkType } from './config/config';

//从命令行参数获取该值，默认localnet
const env = process.argv[2] || 'localnet';
console.log('env:', env);

const networkConfig = createNetworkConfig(env as NetworkType);
const suiRpcUrl = networkConfig.url;
const PACKAGE_ID = '0x6ef51c92e23cfba63597c1788515a77ccc973c03a8e1486c0704485fe0b6157c'

const game_objct_id = '0x45401f2d3b7bcfa456b70b56e57604744bffb665130e4cfbb88d6b04174ae692'
const GameAdminCap_object_id = '0x4550f4fed0570620720af418a58cbd4f095445b0c0dde231641be5751147180a'

const COIN_TYPE = networkConfig.variables.coinType;
const TREASURY_CAP = networkConfig.variables.treasuryCap;



async function main(){

    console.log('env:', env);
    console.log('suiRpcUrl:', suiRpcUrl);
    console.log('PACKAGE_ID:', PACKAGE_ID);
    console.log('--------------------------------');

    const keypair = get_keypair_from_keystore();

    const publicKey = keypair.getPublicKey();
    const address = publicKey.toSuiAddress();
    console.log('Wallet Address:', address);

    const client = new SuiClient({ url: suiRpcUrl });
    let balance = await client.getBalance({ owner: address });
    console.log('Account Balance:', balance);

    //ptb
    console.log('mint coin and add game coin');
    const tx = new Transaction();

    //mint coin
    const coin = tx.moveCall({
        target: `0x2::coin::mint`,//mint_and_transfer
        arguments: [tx.object(TREASURY_CAP), tx.pure.u64(1_000_000_000)],
        typeArguments: [COIN_TYPE]
    });


    //add game coin
    tx.moveCall({
        target: `${PACKAGE_ID}::roll_the_dice::add_game_coin`,
        arguments: [tx.object(game_objct_id), coin],
        // typeArguments: []
    });

    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('add_game_coin tx:', result);

    const transaction = await wait_transaction(client, result.digest);

    //play
    await play(client, keypair);
    
}

async function play(client: SuiClient, keypair: Ed25519Keypair){
    

    const rounds = 3;
    for(let i = 0; i < rounds; i++){
        console.log('play round:', i);

        const tx = new Transaction();

        //mint coin
        const coin = tx.moveCall({
            target: `0x2::coin::mint`,//mint_and_transfer
            arguments: [tx.object(TREASURY_CAP), tx.pure.u64(10_000_000)],
            typeArguments: [COIN_TYPE]
        });

        //play
        tx.moveCall({
            target: `${PACKAGE_ID}::roll_the_dice::play`,
                arguments: [tx.object(game_objct_id), tx.object('0x8'), coin], //random_object_id=0x8
                // typeArguments: []
            });

        const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
        console.log('play tx:', result);

        const transaction = await wait_transaction(client, result.digest);
    }

}


async function wait_transaction(client: SuiClient, digest: string){
    //wait
    //https://sdk.mystenlabs.com/typescript/sui-client
    const transaction = await client.waitForTransaction({
        digest: digest,
        options: {
            showEffects: true,
            showObjectChanges: true
        },
    });
}



//run
main().catch(console.error);
