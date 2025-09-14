import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { get_keypair_from_keystore, get_newly_created_object, get_transaction_events } from './util';


// //testnet
// const env = 'testnet';
// const PACKAGE_ID = '';

// devnet
const env = 'devnet';
const PACKAGE_ID = '0x463fb3ad0917466434159d53b9b9703bdf3aa8ebf6e84d2c06c5583e89f8baf7';

//ObjectType: ctfb::MintCTFB<ctfb::CTFB>
const MintCTFB_object_id = '0x06a2991503ca902d82bb19ab005a081c73b1d55aac8fc5713628f40b879dbbb3'; //Shared

//ObjectType: ctfa::MintCTFA<ctfa::CTFA>
const MintCTFA_object_id = '0x705c50ff67a510b65a57cacbcc400cd7d25c1052bb96fdface60ca096fcb63d9'; //Shared

//ObjectType: pool::CreatePoolCap<lp::LP>
const CreatePoolCap_object_id = '0xf5a4bd3d697eb7615afd3adcf700504d3565a456a2002572c3c96149b3ee2024'; //Shared

const suiRpcUrl = getFullnodeUrl(env);

//create_challenge
const challenge_object_id = '0x3a0500c03ccbda79ffb402bd0a666f7639085d3e4b050ae23b3bee8b28754759';

//claim_airdrop //10000000
const ctfb_coin_id = '0xedb12d76f6fb82e15db367c02f7ee348150982777a5116f393d20ee91043250f';

async function main(){

    const keypair = get_keypair_from_keystore();

    const publicKey = keypair.getPublicKey();
    const address = publicKey.toSuiAddress();
    console.log('Wallet Address:', address);

    const client = new SuiClient({ url: suiRpcUrl });
    let balance = await client.getBalance({ owner: address });
    console.log('Account Balance:', balance);

    //call move function create_challenge
    //await create_challenge(client, keypair, address);

    //获取ctfb coin
    // await claim_airdrop(client, keypair, address);
    

    
    // //call move function complete_challenge
    // let moves = 'sdssddssaasssddddddwww';
    // await complete_challenge(client, keypair, newobjectId!, moves);

    // //call move function claim_flag
    // await claim_flag(client, keypair, newobjectId!, github_id);
}


async function claim_airdrop(client: SuiClient, keypair: Ed25519Keypair, to_address: string){
    const tx = new Transaction();
    const ctfb_coin = tx.moveCall({
                target: `${PACKAGE_ID}::challenge::claim_airdrop`,
                arguments: [tx.object(challenge_object_id)]
            });

    tx.transferObjects([ctfb_coin], to_address);
    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('claim_airdrop tx:', result);
}



async function create_challenge(client: SuiClient, keypair: Ed25519Keypair, to_address: string){
    const tx = new Transaction();
    const challenge_obj = tx.moveCall({
                target: `${PACKAGE_ID}::challenge::create_challenge`,
                arguments: [tx.object(MintCTFA_object_id), tx.object(MintCTFB_object_id), tx.object(CreatePoolCap_object_id)]
            });

    tx.transferObjects([challenge_obj], to_address);
    const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
    console.log('create_challenge tx:', result);

    // //wait
    // //https://sdk.mystenlabs.com/typescript/sui-client
    // const transaction = await client.waitForTransaction({
    //     digest: result.digest,
    //     options: {
    //         showEffects: true,
    //         showObjectChanges: true
    //     },
    // });
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