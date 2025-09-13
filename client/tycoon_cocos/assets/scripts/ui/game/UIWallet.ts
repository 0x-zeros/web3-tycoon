import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator, SpriteFrame, Rect, Size } from 'cc';
import { GButton, GObject } from "fairygui-cc";
import { VoxelSystem } from "../../voxel/VoxelSystem";



import { bcs } from '@mysten/sui/bcs';
import {fromHex, toHex} from '@mysten/bcs';
import { SuiClient } from '@mysten/sui/client';
import { getWallets, IdentifierArray, IdentifierRecord, Wallet, WalletAccount } from '@mysten/wallet-standard';


const { ccclass } = _decorator;

/**
 * 钱包界面 - 玩家查看钱包
 * 参考 https://docs.sui.io/standards/wallet-standard
 */
@ccclass('UIWallet')
export class UIWallet extends UIBase {

    private m_data:fgui.GTextField;      // 数据列表
    private m_btn_wallet:fgui.GButton;    // 物体列表

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {

        // 获取数据
        this.m_data = this.getText("data");
        this.m_btn_wallet = this.getButton("btn_wallet");
    }
    
    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件
        if (this.m_btn_wallet) {
            this.m_btn_wallet.onClick(this._onWalletClick, this);
        }
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {

        // 解绑按钮点击事件
        if (this.m_btn_wallet) {
            this.m_btn_wallet.offClick(this._onWalletClick, this);
        }

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 钱包点击事件
     */
    private _onWalletClick(): void {
        console.log("[UIWallet] Wallet clicked");

        this.testSuiClient();
        // this.initWallets();
    }

    private async testSuiClient(): Promise<void> {

        const DEV_NET_URL = 'https://fullnode.testnet.sui.io:443';
        const client = new SuiClient({ url: DEV_NET_URL });

        const {data, error} = await client.getObject({
            id: '0x8',
            options: {
                showBcs: true,
                showContent: true,
            }
        });

        console.log("wallet data: ", data);
        console.log("wallet error: ", error);

        this.m_data.text = JSON.stringify(data);
    }

    private async initWallets(): Promise<void> {
        const wallets = getWallets().get();
        console.log("wallets length: ", wallets.length);
        console.log("getWallets: ", wallets);
        for (const wallet of wallets) {
            console.log(`wallet index: ${wallets.indexOf(wallet)}, wallet name: ${wallet.name}, wallet icon: ${wallet.icon}`);
            console.log(wallet);
        }

        //find wallet by name
        const wallet = wallets.find((wallet) => wallet.name === "Suiet");//"Suiet"
        if (wallet) {
            this.logWallet(wallet);
        }
    }

    private async logWallet(wallet: Wallet): Promise<void> {
        // console.log('logWallet: ', wallet);
        console.log(`logWallet wallet ${wallet.name}: icon: ${wallet.icon}, accounts: ${wallet.accounts.length}`);
        for (let i = 0; i < wallet.accounts.length; i++) {
            const account: WalletAccount = wallet.accounts[i];
            console.log(`account ${i}: address: ${account.address}, publicKey: ${account.publicKey}`);
            console.log(account);
        }



        // 好像并不需要检测？
        // if (wallet.accounts.length < 1) {
        //     await wallet.features['standard:connect'].connect();
        // }
        // else {
        //     await wallet.features['standard:disconnect'].disconnect();
        // }


        //This call returns a function that can be called to unsubscribe from listening to the events.
        const unsubscribe = wallet.features['standard:events'].on('change', this._onWalletChange.bind(this));
        //unsubscribe();//on destroy


        //connect() 一次以后才能获取到wallet.accounts, 不然都是[]
        const accounts = await wallet.features['standard:connect'].connect();
        console.log(`after connect, accounts:`, accounts);





        //todo
        //or sui:signAndExecuteTransaction
        //wallet.features['sui:signTransaction'].signTransaction({
        // transaction: <Transaction>,
        // account: <WalletAccount>
        // })
    }

    //event:
    //{
        // accounts: WalletAccount[],
        // chains: IdentifierArray,
        // features: IdentifierRecord<unknown>
    //  }
    private _onWalletChange(event: { accounts: WalletAccount[], chains: IdentifierArray, features: IdentifierRecord<unknown> }): void {
        console.log('onWalletChange: ', event);
    }

}