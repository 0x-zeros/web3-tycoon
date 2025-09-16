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
const PACKAGE_ID = '0xb169bd8207cb3cf879634315854af483073661990b0625d24989e22eb5b3999a'

const game_objct_id = '0xa3a8698800d3b84c21582aa37445717a5ec511f388719cdc353c86f6588ba27a'




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

    //play
    await play(client, keypair);
    
}

async function play(client: SuiClient, keypair: Ed25519Keypair){
    

    const rounds = 1;
    for(let i = 0; i < rounds; i++){
        console.log('play round:', i);

        const tx = new Transaction();


        //play
        const dice = tx.moveCall({
            target: `${PACKAGE_ID}::simple_roll::play`,
                arguments: [tx.object(game_objct_id), tx.object('0x8')], //random_object_id=0x8
                // typeArguments: []
            });

        //dry run
        tx.setSender(keypair.getPublicKey().toSuiAddress());
        const r0 = await client.dryRunTransactionBlock({
            transactionBlock: await await tx.build({ client }),
        });
        console.log('dry run:', r0);


        // //dev inspect
        // const r1 = await client.devInspectTransactionBlock({
        //     sender: keypair.getPublicKey().toSuiAddress(),
        //     transactionBlock: tx,
        //   });
        // //   console.log(r1);

        //   console.log(r1.events[0].parsedJson);



  


        // const result = await client.signAndExecuteTransaction({signer: keypair,transaction: tx,});
        // console.log('play tx:', result);

        // const transaction = await wait_transaction(client, result.digest);

        // // console.log(`dice ${i}:`, dice);
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