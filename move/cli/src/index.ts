import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { get_keypair_from_keystore, get_newly_created_object, get_transaction_events } from './utils';
import { createNetworkConfig, getExplorerUrl, NetworkType } from './config/config';

//从命令行参数获取该值，默认localnet
const env = process.argv[2]// || 'localnet';

const networkConfig = createNetworkConfig(env as NetworkType);
const suiRpcUrl = networkConfig.url;
const PACKAGE_ID = networkConfig.variables.packageId;

const COIN_TYPE = networkConfig.variables.coinType;
const TREASURY_CAP = networkConfig.variables.treasuryCap;



async function main(){

    console.log('env:', env);
    console.log('suiRpcUrl:', suiRpcUrl);
    console.log('PACKAGE_ID:', PACKAGE_ID);
    console.log('COIN_TYPE:', COIN_TYPE);
    console.log('TREASURY_CAP:', TREASURY_CAP);
    console.log('--------------------------------');

    const keypair = get_keypair_from_keystore();

    const publicKey = keypair.getPublicKey();
    const address = publicKey.toSuiAddress();
    console.log('Wallet Address:', address);

    const client = new SuiClient({ url: suiRpcUrl });
    let balance = await client.getBalance({ owner: address });
    console.log('Account Balance:', balance);

    //call move function create_challenge
    let newobjectId = await create_challenge(client, keypair);
    // console.log('newobjectId:', newobjectId);

    //call move function complete_challenge
    let moves = 'sdssddssaasssddddddwww';
    await complete_challenge(client, keypair, newobjectId!, moves);

    //call move function claim_flag
    await claim_flag(client, keypair, newobjectId!, github_id);
}


async function create_challenge(client: SuiClient, keypair: Ed25519Keypair){
    const tx = new Transaction();
    tx.moveCall({
                target: `${PACKAGE_ID}::maze::create_challenge`,
                arguments: []
            });
    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('create_challenge tx:', result);

    //wait
    //https://sdk.mystenlabs.com/typescript/sui-client
    const transaction = await client.waitForTransaction({
        digest: result.digest,
        options: {
            showEffects: true,
            showObjectChanges: true
        },
    });

    let newobjectId = await get_newly_created_object(suiRpcUrl, result.digest);
    return newobjectId;
}

async function complete_challenge(client: SuiClient, keypair: Ed25519Keypair, challenge_object_Id: string, moves: string){
    const tx = new Transaction();
    
    // 将字符串转换为vector<u8>
    // 使用ASCII值：'w'=119, 's'=115, 'a'=97, 'd'=100
    const movesArray = moves.split('').map(char => char.charCodeAt(0));
    
    // console.log('movesArray:', movesArray);
    // {
    //     // 检查 movesArray 是否等于 [115, 100, 115, 115, 100, 100, 115, 115, 97, 97, 115, 115, 115, 100, 100, 100, 100, 100, 100, 119, 119, 119]
    //     const expectedMoves = [115, 100, 115, 115, 100, 100, 115, 115, 97, 97, 115, 115, 115, 100, 100, 100, 100, 100, 100, 119, 119, 119];
    //     const isCorrect = movesArray.length === expectedMoves.length && movesArray.every((v, i) => v === expectedMoves[i]);
    //     if (!isCorrect) {
    //         console.warn('Warning: movesArray does not match the expected sequence!');
    //     } else {
    //         console.log('movesArray matches the expected sequence.');
    //     }
    // }
    
    tx.moveCall({
                target: `${PACKAGE_ID}::maze::complete_challenge`,
                arguments: [tx.object(challenge_object_Id), tx.pure.vector('u8', movesArray)]
            });
    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('complete_challenge tx:', result);

    //wait
    const transaction = await client.waitForTransaction({
        digest: result.digest,
        options: {
            showEvents: true,
        },
    });

    let events = await get_transaction_events(suiRpcUrl, result.digest);
    console.log('complete_challenge events:', events);
}

async function claim_flag(client: SuiClient, keypair: Ed25519Keypair, challenge_object_Id: string, github_id: string){
    const tx = new Transaction();
    tx.moveCall({
                target: `${PACKAGE_ID}::maze::claim_flag`,
                arguments: [tx.object(challenge_object_Id), tx.pure.string(github_id)]
                // arguments: [tx.object(challenge_object_Id)] //参照 实际部署在testnet的claim_flag函数
            });
    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('claim_flag tx:', result);

    //wait
    const transaction = await client.waitForTransaction({
        digest: result.digest,
        options: {
            showEvents: true,
        },
    });

    let events = await get_transaction_events(suiRpcUrl, result.digest);
    console.log('claim_flag events:', events);
}

//实际部署在testnet的claim_flag函数
// public entry fun claim_flag(arg0: &ChallengeStatus, arg1: &mut 0x2::tx_context::TxContext) {
//     assert!(arg0.owner == 0x2::tx_context::sender(arg1), 1);
//     assert!(arg0.challenge_complete, 2);
//     let v0 = FlagEvent{
//         sender  : 0x2::tx_context::sender(arg1), 
//         success : true,
//     };
//     0x2::event::emit<FlagEvent>(v0);
// }


//run
main().catch(console.error);