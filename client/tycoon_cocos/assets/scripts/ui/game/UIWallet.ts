import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator, SpriteFrame, Rect, Size, assetManager, Sprite, Texture2D, ImageAsset } from 'cc';
import { GButton, GObject } from "fairygui-cc";
import { VoxelSystem } from "../../voxel/VoxelSystem";
import { UIManager, UILayer } from "../core/UIManager";



import { bcs } from '@mysten/sui/bcs';
import {fromHex, toHex} from '@mysten/bcs';
import { SuiClient } from '@mysten/sui/client';
import { getWallets, IdentifierArray, IdentifierRecord, Wallet, WalletAccount } from '@mysten/wallet-standard';
import { UINotification } from "../utils/UINotification";
import { SuiManager } from "../../sui/managers/SuiManager";


const { ccclass } = _decorator;

/**
 * localStorage存储的钱包连接信息
 */
interface WalletConnection {
    walletName: string;
    accountAddress: string;
}

const STORAGE_KEY = 'sui_wallet_connection';

/**
 * 钱包界面 - 玩家查看钱包
 * 参考 https://docs.sui.io/standards/wallet-standard
 */
@ccclass('UIWallet')
export class UIWallet extends UIBase {

    private m_btn_wallet:fgui.GButton;
    private m_btn_connect:fgui.GButton;
    private m_btn_disconnect:fgui.GButton;

    // Controller控制disconnected/connected状态
    private m_controller: fgui.Controller | null = null;

    // 当前连接的钱包和账户
    private m_connectedWallet: Wallet | null = null;
    private m_connectedAccount: WalletAccount | null = null;

    // WalletList组件引用
    private m_walletListComponent: fgui.GComponent | null = null;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._tryAutoConnect();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {
        this.m_btn_wallet = this.getButton("btn_wallet");
        this.m_btn_connect = this.getButton("btn_connect");
        this.m_btn_disconnect = this.getButton("btn_disconnect");

        // 获取controller
        this.m_controller = this.getController("wallet");
        if (!this.m_controller) {
            console.error("[UIWallet] Controller 'wallet' not found");
        }

        // btn_disconnect初始隐藏
        if (this.m_btn_disconnect) {
            this.m_btn_disconnect.visible = false;
        }
    }
    
    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        // 绑定按钮点击事件
        if (this.m_btn_wallet) {
            this.m_btn_wallet.onClick(this._onWalletClick, this);
        }
        
        if (this.m_btn_connect) {
            this.m_btn_connect.onClick(this._onConnectClick, this);
        }

        if (this.m_btn_disconnect) {
            this.m_btn_disconnect.onClick(this._onDisconnectClick, this);
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

        if (this.m_btn_connect) {
            this.m_btn_connect.offClick(this._onConnectClick, this);
        }

        if (this.m_btn_disconnect) {
            this.m_btn_disconnect.offClick(this._onDisconnectClick, this);
        }

        // 清理WalletList
        this._closeWalletList();

        // 调用父类解绑
        super.unbindEvents();
    }

    private _onConnectClick(): void {
        console.log("[UIWallet] Connect clicked");

        const suiWallets = this.getSuiWallets();

        // 创建并显示WalletList
        this._showWalletList(suiWallets);
    }

    /**
     * 断开连接点击事件
     */
    private async _onDisconnectClick(): Promise<void> {
        console.log("[UIWallet] Disconnect clicked");

        if (!this.m_connectedWallet) {
            console.warn("[UIWallet] No wallet connected");
            return;
        }

        try {
            // 尝试调用钱包的disconnect功能（如果支持）
            const disconnectFeature = this.m_connectedWallet.features['standard:disconnect'] as any;
            if (disconnectFeature && typeof disconnectFeature.disconnect === 'function') {
                await disconnectFeature.disconnect();       //todo suiet里好像没有删掉（revoke）已经连接的账户的信息; 而且只会返回当前的一个
                console.log(`[UIWallet] Disconnected from ${this.m_connectedWallet.name}`);
            }

            // 清除localStorage
            this._clearConnection();

            // 清空连接状态
            this.m_connectedWallet = null;
            this.m_connectedAccount = null;

            // 清除 SuiManager 的签名器
            SuiManager.instance.clearSigner();
            console.log('[UIWallet] SuiManager signer cleared');

            // 切换controller状态为disconnected
            if (this.m_controller) {
                this.m_controller.selectedIndex = 0;
            }

            // 隐藏disconnect按钮
            if (this.m_btn_disconnect) {
                this.m_btn_disconnect.visible = false;
            }

            // 显示断开成功通知
            UINotification.info("钱包已断开");

        } catch (error) {
            console.error("[UIWallet] Failed to disconnect:", error);
            UINotification.error("断开钱包失败");
        }
    }

    /**
     * 钱包点击事件
     */
    private _onWalletClick(): void {
        console.log("[UIWallet] Wallet clicked");

        // 检查controller状态
        if (!this.m_controller) {
            console.error("[UIWallet] Controller not initialized");
            return;
        }

        // 如果是connected状态，toggle btn_disconnect的显示/隐藏
        if (this.m_controller.selectedIndex === 1) {
            if (this.m_btn_disconnect) {
                this.m_btn_disconnect.visible = !this.m_btn_disconnect.visible;
                console.log(`[UIWallet] Toggle disconnect button to ${this.m_btn_disconnect.visible ? 'visible' : 'hidden'}`);
            }
        }
        // disconnected状态下不做任何事（或保持原有逻辑）
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

        // this.m_data.text = JSON.stringify(data);
    }

    private getSuiWallets(): Wallet[] {
        const wallets = getWallets().get();
        console.log("wallets length: ", wallets.length);
        console.log("getWallets: ", wallets);

        //选出所有的sui钱包
        const suiWallets = this._filterSuiWallets(wallets);
        console.log("suiWallets length: ", suiWallets.length);
        console.log("suiWallets: ", suiWallets);

        return suiWallets;
    }

    /**
     * 显示钱包列表
     */
    private _showWalletList(suiWallets: Wallet[]): void {
        // 如果已经有WalletList在显示，先关闭
        if (this.m_walletListComponent) {
            this._closeWalletList();
        }

        // 创建WalletList组件
        this.m_walletListComponent = fgui.UIPackage.createObject("Common", "WalletList").asCom;
        if (!this.m_walletListComponent) {
            console.error("[UIWallet] Failed to create WalletList component");
            return;
        }

        // 获取wallets列表
        const walletsList = this.m_walletListComponent.getChild("wallets") as fgui.GList;
        if (!walletsList) {
            console.error("[UIWallet] Failed to get wallets list from WalletList component");
            return;
        }

        // 设置列表数据
        walletsList.numItems = suiWallets.length;

        // 填充每个item
        for (let i = 0; i < suiWallets.length; i++) {
            const wallet = suiWallets[i];
            const item = walletsList.getChildAt(i).asCom;

            // 设置title
            const titleText = item.getChild("title") as fgui.GTextField;
            if (titleText) {
                titleText.text = wallet.name;
            }

            // 设置icon
            const iconLoader = item.getChild("icon") as fgui.GLoader;
            if (iconLoader && wallet.icon) {
                this._loadWalletIcon(wallet.icon, iconLoader);
            }

            // 添加点击事件
            item.onClick(() => this._onWalletItemClick(wallet), this);
        }

        // 添加到POPUP层并居中显示
        const popupLayer = UIManager.instance.getLayer(UILayer.POPUP);
        if (!popupLayer) {
            console.error("[UIWallet] POPUP layer not found");
            return;
        }

        popupLayer.addChild(this.m_walletListComponent);

        // 居中显示
        const groot = fgui.GRoot.inst;
        const x = (groot.width - this.m_walletListComponent.width) / 2;
        const y = (groot.height - this.m_walletListComponent.height) / 2;
        this.m_walletListComponent.setPosition(x, y);

        console.log(`[UIWallet] WalletList displayed with ${suiWallets.length} wallets`);
    }

    /**
     * 加载钱包图标
     */
    private _loadWalletIcon(iconDataURL: string, iconLoader: fgui.GLoader): void {
        this.createSpriteFrameFromDataURL(iconDataURL, (err, spriteFrame) => {
            if (err || !spriteFrame) {
                console.error("[UIWallet] Failed to load wallet icon:", err);
                return;
            }

            iconLoader.texture = spriteFrame;
        });
    }

    /**
     * 关闭钱包列表
     */
    private _closeWalletList(): void {
        if (this.m_walletListComponent) {
            this.m_walletListComponent.removeFromParent();
            this.m_walletListComponent.dispose();
            this.m_walletListComponent = null;
        }
    }

    /**
     * 钱包item点击事件
     */
    private async _onWalletItemClick(wallet: Wallet): Promise<void> {
        console.log(`[UIWallet] Wallet clicked: ${wallet.name}`);

        try {
            // 调用钱包连接
            const connectFeature = wallet.features['standard:connect'] as any;
            if (!connectFeature || typeof connectFeature.connect !== 'function') {
                console.error('[UIWallet] Wallet does not support standard:connect');
                UINotification.error(`钱包不支持连接功能`);
                return;
            }

            const accountsObj = await connectFeature.connect();
            console.log(`[UIWallet] Connected to ${wallet.name}, accounts:`, accountsObj);

            const accounts = accountsObj.accounts as WalletAccount[];
            if (!accounts || accounts.length === 0) {
                console.error('[UIWallet] No accounts returned');
                UINotification.error(`未获取到账户信息`);
                return;
            }

            // 取第一个账户
            const account = accounts[0];

            // 保存到localStorage
            this._saveConnection(wallet.name, account.address);

            // 保存连接状态
            this.m_connectedWallet = wallet;
            this.m_connectedAccount = account;

            // 切换controller状态为connected
            if (this.m_controller) {
                this.m_controller.selectedIndex = 1;
            }

            // 设置btn_wallet的title为缩略地址
            if (this.m_btn_wallet) {
                this.m_btn_wallet.title = this._shortenAddress(account.address);
            }

            // 关闭WalletList
            this._closeWalletList();

            // 显示连接成功通知
            UINotification.success(`已连接到 ${wallet.name}`);

            // 设置 SuiManager 的签名器
            SuiManager.instance.setWalletSigner(wallet, account);
            console.log(`[UIWallet] SuiManager signer updated`);

            // 监听钱包变化
            const eventsFeature = wallet.features['standard:events'] as any;
            if (eventsFeature && typeof eventsFeature.on === 'function') {
                eventsFeature.on('change', this._onWalletChange.bind(this));
                console.log(`[UIWallet] Listening to wallet change for ${wallet.name}`);
            }

        } catch (error) {
            console.error(`[UIWallet] Failed to connect to ${wallet.name}:`, error);
            UINotification.error(`连接 ${wallet.name} 失败`);
        }
    }

    private _filterSuiWallets(wallets: readonly Wallet[]): Wallet[] {
        return wallets.filter((wallet) => {
            return typeof wallet.features['sui:signTransaction']?.['signTransaction'] === 'function';
        });
    }

    /**
     * 尝试自动连接钱包（从localStorage恢复）
     */
    private async _tryAutoConnect(): Promise<void> {
        if (!this.m_controller) {
            console.error('[UIWallet] Controller not initialized');
            return;
        }

        // 从localStorage读取连接信息
        const savedConnection = this._loadConnection();
        if (!savedConnection) {
            console.log('[UIWallet] No saved connection, set to disconnected state');
            this.m_controller.selectedIndex = 0; // disconnected
            return;
        }

        try {
            // 获取所有Sui钱包
            const wallets = getWallets().get();
            const suiWallets = this._filterSuiWallets(wallets);

            // 找到保存的钱包
            const targetWallet = suiWallets.find(w => w.name === savedConnection.walletName);
            if (!targetWallet) {
                console.log(`[UIWallet] Saved wallet '${savedConnection.walletName}' not found`);
                this._clearConnection();
                this.m_controller.selectedIndex = 0; // disconnected
                return;
            }

            // 连接钱包
            const connectFeature = targetWallet.features['standard:connect'] as any;
            if (!connectFeature || typeof connectFeature.connect !== 'function') {
                console.error('[UIWallet] Wallet does not support standard:connect');
                this._clearConnection();
                this.m_controller.selectedIndex = 0;
                return;
            }

            const accountsObj = await connectFeature.connect();
            console.log(`[UIWallet] Auto-connect to ${targetWallet.name}, accounts:`, accountsObj);
            const accounts = accountsObj.accounts as WalletAccount[];

            // 检查保存的账户是否存在
            const targetAccount = accounts.find(acc => acc.address === savedConnection.accountAddress);
            if (!targetAccount) {
                console.log(`[UIWallet] Saved account '${savedConnection.accountAddress}' not found in accounts`);
                this._clearConnection();
                this.m_controller.selectedIndex = 0; // disconnected
                return;
            }

            // 自动连接成功
            this.m_connectedWallet = targetWallet;
            this.m_connectedAccount = targetAccount;
            this.m_controller.selectedIndex = 1; // connected

            // 更新UI
            if (this.m_btn_wallet) {
                this.m_btn_wallet.title = this._shortenAddress(targetAccount.address);
            }

            // 设置 SuiManager 的签名器
            SuiManager.instance.setWalletSigner(targetWallet, targetAccount);
            console.log(`[UIWallet] SuiManager signer updated (auto-connect)`);

            // 监听钱包变化
            const eventsFeature = targetWallet.features['standard:events'] as any;
            if (eventsFeature && typeof eventsFeature.on === 'function') {
                eventsFeature.on('change', this._onWalletChange.bind(this));
                console.log(`[UIWallet] Listening to wallet change for ${targetWallet.name}`);
            }

            console.log(`[UIWallet] Auto-connected to ${targetWallet.name} with account ${targetAccount.address}`);

        } catch (error) {
            console.error('[UIWallet] Auto-connect failed:', error);
            this._clearConnection();
            this.m_controller.selectedIndex = 0; // disconnected
        }
    }



    /**
     * 从 data URL 创建 SpriteFrame（callback方式）
     * @param dataURL - base64 图片数据或远程 URL
     * @param callback - 回调函数 (err, spriteFrame)
     */
    private createSpriteFrameFromDataURL(dataURL: string, callback: (err: Error | null, spriteFrame: SpriteFrame | null) => void): void {
        assetManager.loadRemote<ImageAsset>(dataURL, { ext: '.png' }, (err, imageAsset) => {
            if (err) {
                console.error('[UIWallet] assetManager.loadRemote failed:', err);
                callback(err, null);
                return;
            }

            const tex = new Texture2D();
            tex.image = imageAsset;

            const sf = new SpriteFrame();
            sf.texture = tex;

            callback(null, sf);
        });
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
        console.log(`[UIWallet] Listening to wallet change for ${wallet.name}`);
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
        console.log('[UIWallet] onWalletChange: ', event);

        if (event.accounts && event.accounts.length > 0) {
            // 账号发生变化
            console.log('[UIWallet] Accounts changed:', event.accounts);
            // 你可以在这里做 UI 更新、重新拉取数据等
        }
    }

    // ================== localStorage辅助方法 ==================

    /**
     * 保存钱包连接信息到localStorage
     */
    private _saveConnection(walletName: string, accountAddress: string): void {
        const connection: WalletConnection = { walletName, accountAddress };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
            console.log('[UIWallet] Connection saved:', connection);
        } catch (error) {
            console.error('[UIWallet] Failed to save connection:', error);
        }
    }

    /**
     * 从localStorage读取钱包连接信息
     */
    private _loadConnection(): WalletConnection | null {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return null;

            const connection = JSON.parse(data) as WalletConnection;
            console.log('[UIWallet] Connection loaded:', connection);
            return connection;
        } catch (error) {
            console.error('[UIWallet] Failed to load connection:', error);
            return null;
        }
    }

    /**
     * 清除localStorage中的钱包连接信息
     */
    private _clearConnection(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('[UIWallet] Connection cleared');
        } catch (error) {
            console.error('[UIWallet] Failed to clear connection:', error);
        }
    }

    /**
     * 缩短地址显示（0x1234...5678格式）
     */
    private _shortenAddress(address: string): string {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

}