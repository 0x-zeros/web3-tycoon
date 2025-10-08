/**
 * Sui 交互管理器（单例）
 * 统一管理所有 Sui 链上交互，包括签名、查询、交易执行等
 */

import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Wallet, WalletAccount } from '@mysten/wallet-standard';

import { SuiConfig, getNetworkRpcUrl, getExplorerUrl, getNetworkDisplayName, ExplorerItemType } from '../config';
import { SignerProvider, WalletSigner, KeypairSigner } from '../signers';
import { TycoonGameClient } from '../interactions';
import { MapAdminInteraction } from '../interactions/mapAdmin';
import { QueryService, GameListItem, AssetService, DataPollingService } from '../services';
import { TycoonEventIndexer } from '../events/indexer';
import { EventType } from '../events/types';
import type { Game, Seat, GameCreateConfig } from '../types/game';
import type { MapTemplate } from '../types/map';
import type { SeatNFT, MapTemplateNFT, DeFiAssets } from '../types/assets';
import { EventBus } from '../../events/EventBus';
import { EventTypes } from '../../events/EventTypes';
import { Blackboard } from '../../events/Blackboard';
import { UINotification } from '../../ui/utils/UINotification';
import { loadKeypairFromKeystore } from '../utils/KeystoreLoader';

/**
 * Sui Manager 配置选项
 */
export interface SuiManagerOptions {
    /** 是否启用调试日志 */
    debug?: boolean;
}

/**
 * Sui Manager 单例
 * 负责管理 Sui 链交互的生命周期
 */
export class SuiManager {
    private static _instance: SuiManager | null = null;

    // 核心组件
    private _client: SuiClient | null = null;
    private _signer: SignerProvider | null = null;
    private _gameClient: TycoonGameClient | null = null;
    private _mapAdmin: MapAdminInteraction | null = null;
    private _queryService: QueryService | null = null;
    private _assetService: AssetService | null = null;
    private _pollingService: DataPollingService | null = null;

    // 配置
    private _config: SuiConfig | null = null;
    private _options: SuiManagerOptions = {};

    // 状态
    private _initialized: boolean = false;
    private _currentAddress: string | null = null;
    private _currentSeat: Seat | null = null;

    // 缓存数据（链上数据）
    private _cachedGameData: any = null;
    private _cachedGames: Game[] = [];
    private _cachedMapTemplates: { id: number; name: string }[] = [];
    private _cacheTimestamp: number = 0;

    // 缓存数据（玩家资产）
    private _cachedSuiBalance: bigint = 0n;
    private _cachedSeats: SeatNFT[] = [];
    private _cachedMapTemplateNFTs: MapTemplateNFT[] = [];
    private _cachedDeFiAssets: DeFiAssets = {};
    private _assetsCacheTimestamp: number = 0;

    // 最近发布的模板 ID
    private _lastPublishedTemplateId: number | null = null;

    // 事件监听器
    private _eventIndexer: TycoonEventIndexer | null = null;

    // 预加载状态
    private _preloadStarted: boolean = false;
    private _preloadCompleted: boolean = false;

    /**
     * 私有构造函数（单例模式）
     */
    private constructor() {}

    /**
     * 获取单例实例
     */
    public static get instance(): SuiManager {
        if (!SuiManager._instance) {
            SuiManager._instance = new SuiManager();
        }
        return SuiManager._instance;
    }

    // ============ 初始化方法 ============

    /**
     * 初始化 Sui Manager
     * @param config Sui 配置
     * @param options 可选配置
     */
    public async init(config: SuiConfig, options?: SuiManagerOptions): Promise<void> {
        if (this._initialized) {
            console.warn('[SuiManager] Already initialized');
            return;
        }

        this._config = config;
        this._options = { ...options };

        // 创建 Sui Client
        const rpcUrl = getNetworkRpcUrl(config.network, config.rpcUrl);
        this._client = new SuiClient({ url: rpcUrl });

        // 创建 TycoonGameClient
        this._gameClient = new TycoonGameClient(
            this._client,
            config.packageId,
            config.gameDataId
        );

        // 创建 MapAdminInteraction
        this._mapAdmin = new MapAdminInteraction(
            this._client,
            config.packageId,
            config.gameDataId
        );

        // 创建 QueryService
        this._queryService = new QueryService(
            this._client,
            config.packageId,
            config.gameDataId
        );

        // 创建 AssetService
        this._assetService = new AssetService(
            this._client,
            config.packageId
        );

        // 创建 DataPollingService
        this._pollingService = new DataPollingService();

        this._initialized = true;

        this._log('[SuiManager] Initialized successfully', {
            network: config.network,
            rpcUrl,
            packageId: config.packageId,
            gameDataId: config.gameDataId,
            signerType: config.signerType || 'wallet'
        });

        // 根据配置自动设置签名器
        await this._autoConfigureSigner(config);
    }

    /**
     * 根据配置自动设置签名器
     */
    private async _autoConfigureSigner(config: SuiConfig): Promise<void> {
        if (config.signerType === 'keypair') {
            console.log('[SuiManager] Config signerType is keypair, loading...');
            UINotification.info("检测到 Keypair 模式");

            try {
                const keypair = await loadKeypairFromKeystore();
                this.setKeypairSigner(keypair);

                console.log('[SuiManager] ✓ Auto-configured with KeypairSigner');
                console.log('  Address:', this._currentAddress);

                // 通过 Blackboard 通知 UI（Keypair 模式连接）
                Blackboard.instance.set("sui_keypair_connected", true, true);
                Blackboard.instance.set("sui_current_address", this._currentAddress, true);

                // 加载玩家资产
                this.loadPlayerAssets().catch(error => {
                    console.error('[SuiManager] Failed to load assets:', error);
                });

            } catch (error) {
                console.error('[SuiManager] Failed to load keypair:', error);
                UINotification.error("Keypair 加载失败");
                console.log('[SuiManager] Falling back to wallet connection...');
            }
        } else {
            console.log('[SuiManager] Waiting for wallet connection (signerType: wallet)');
        }
    }

    /**
     * 检查是否已初始化
     */
    private _ensureInitialized(): void {
        if (!this._initialized || !this._client || !this._gameClient || !this._mapAdmin || !this._queryService || !this._assetService) {
            throw new Error('[SuiManager] Not initialized. Call init() first.');
        }
    }

    // ============ 签名器管理 ============

    /**
     * 设置 Wallet 签名器
     * @param wallet 钱包实例
     * @param account 账户信息
     */
    public setWalletSigner(wallet: Wallet, account: WalletAccount): void {
        this._signer = new WalletSigner(wallet, account);
        this._currentAddress = account.address;

        this._log('[SuiManager] Wallet signer set', {
            wallet: wallet.name,
            address: account.address
        });

        // 启动资产轮询
        this.startAssetPolling();
    }

    /**
     * 设置 Keypair 签名器
     * @param keypair 密钥对
     */
    public setKeypairSigner(keypair: Ed25519Keypair): void {
        this._signer = new KeypairSigner(keypair);
        this._currentAddress = keypair.toSuiAddress();

        this._log('[SuiManager] Keypair signer set', {
            address: this._currentAddress
        });

        // 启动资产轮询
        this.startAssetPolling();
    }

    /**
     * 清除签名器
     */
    public clearSigner(): void {
        // 停止资产轮询
        this.stopAssetPolling();

        this._signer = null;
        this._currentAddress = null;
        this._currentSeat = null;

        this._log('[SuiManager] Signer cleared');
    }

    /**
     * 检查签名器是否可用
     */
    private _ensureSigner(): void {
        if (!this._signer) {
            throw new Error('[SuiManager] No signer set. Call setWalletSigner() or setKeypairSigner() first.');
        }
    }

    // ============ 交易执行 ============

    /**
     * 签名并执行交易
     * @param tx 交易对象
     * @returns 交易结果
     */
    public async signAndExecuteTransaction(tx: Transaction): Promise<SuiTransactionBlockResponse> {
        this._ensureInitialized();
        this._ensureSigner();

        this._log('[SuiManager] Executing transaction...');

        const result = await this._signer!.signAndExecuteTransaction(tx, this._client!);

        this._log('[SuiManager] Transaction executed', {
            digest: result.digest,
            status: result.effects?.status?.status
        });

        // 交易成功后，异步刷新余额（不阻塞）
        if (result.effects?.status?.status === 'success') {
            this._refreshBalanceAsync().catch(error => {
                console.error('[SuiManager] Failed to refresh balance after tx:', error);
            });
        }

        return result;
    }

    // ============ 游戏交互 API ============

    /**
     * 创建游戏
     * @param config 游戏创建配置
     * @returns 游戏 ID 和座位 ID
     */
    public async createGame(config: GameCreateConfig): Promise<{
        gameId: string;
        seatId: string;
        txHash: string;
    }> {
        this._ensureInitialized();
        this._ensureSigner();

        this._log('[SuiManager] Creating game...', config);

        // 构建交易
        const address = this._signer!.getAddress();
        const tx = this._gameClient!.game.buildCreateGameTx(config, address);

        // 签名并执行
        const result = await this.signAndExecuteTransaction(tx);

        // 解析结果
        const gameId = this._extractObjectId(result, 'Game');
        const seatId = this._extractObjectId(result, 'Seat');

        const response = {
            gameId,
            seatId,
            txHash: result.digest
        };

        this._log('[SuiManager] Game created', response);

        return response;
    }

    /**
     * 加入游戏
     * @param gameId 游戏 ID
     * @returns 座位 ID 和玩家索引
     */
    public async joinGame(gameId: string): Promise<{
        seatId: string;
        playerIndex: number;
        txHash: string;
    }> {
        this._ensureInitialized();
        this._ensureSigner();

        this._log('[SuiManager] Joining game...', { gameId });

        // 构建交易
        const address = this._signer!.getAddress();
        const tx = this._gameClient!.game.buildJoinGameTx(gameId, address);

        // 签名并执行
        const result = await this.signAndExecuteTransaction(tx);

        // 解析结果
        const seatId = this._extractObjectId(result, 'Seat');
        const playerIndex = this._extractPlayerIndex(result);

        // 保存当前座位
        this._currentSeat = {
            id: seatId,
            game: gameId,
            player: this._currentAddress!,
            player_index: playerIndex
        };

        const response = {
            seatId,
            playerIndex,
            txHash: result.digest
        };

        this._log('[SuiManager] Joined game', response);

        return response;
    }

    /**
     * 开始游戏
     * @param gameId 游戏 ID
     * @param mapTemplateId 地图模板 ID
     */
    public async startGame(gameId: string, mapTemplateId: string): Promise<{
        success: boolean;
        startingPlayer: string;
        txHash: string;
    }> {
        this._ensureInitialized();
        this._ensureSigner();

        this._log('[SuiManager] Starting game...', { gameId, mapTemplateId });

        // 构建交易
        const tx = this._gameClient!.game.buildStartGameTx(gameId, mapTemplateId);

        // 签名并执行
        const result = await this.signAndExecuteTransaction(tx);

        // 解析事件获取起始玩家
        const startingPlayer = this._extractStartingPlayer(result);

        const response = {
            success: true,
            startingPlayer,
            txHash: result.digest
        };

        this._log('[SuiManager] Game started', response);

        return response;
    }

    /**
     * 获取游戏状态
     * @param gameId 游戏 ID
     * @returns 游戏对象
     */
    public async getGameState(gameId: string): Promise<Game | null> {
        this._ensureInitialized();

        return await this._gameClient!.game.getGameState(gameId);
    }

    /**
     * 获取当前玩家的座位
     * @param gameId 游戏 ID
     * @returns 座位对象
     */
    public async getPlayerSeat(gameId: string): Promise<Seat | null> {
        this._ensureInitialized();
        this._ensureSigner();

        const address = this._signer!.getAddress();
        return await this._gameClient!.game.getPlayerSeat(address, gameId);
    }

    // ============ 地图交互 API ============

    /**
     * 发布地图模板
     * @param mapTemplate 地图模板数据
     * @returns 模板 ID 和交易哈希
     */
    public async publishMapTemplate(mapTemplate: MapTemplate): Promise<{
        txHash: string;
        templateId: number;
    }> {
        this._ensureInitialized();
        this._ensureSigner();

        // 获取 GameData 的 schema_version
        const gameData = this._cachedGameData || await this._queryService!.getGameData();
        const schemaVersion = gameData?.map_schema_version || 1;  // 默认 1

        this._log('[SuiManager] Publishing map template...', {
            templateId: mapTemplate.id,
            schemaVersion: schemaVersion
        });

        console.log('[SuiManager] Using schema_version from GameData:', schemaVersion);

        // 构建交易（传入 schema_version）
        const tx = this._mapAdmin!.buildUploadMapTemplateTx(mapTemplate, schemaVersion);

        // 签名并执行
        const result = await this.signAndExecuteTransaction(tx);

        // 解析事件获取模板 ID
        const templateId = this._extractTemplateId(result);

        // 记录最新发布的模板 ID
        this._lastPublishedTemplateId = templateId;
        console.log('[SuiManager] Recorded last published template ID:', templateId);

        const response = {
            txHash: result.digest,
            templateId
        };

        this._log('[SuiManager] Map template published', response);

        return response;
    }

    /**
     * 获取最近发布的模板 ID
     */
    public get lastPublishedTemplateId(): number | null {
        return this._lastPublishedTemplateId;
    }

    /**
     * 使用指定模板创建游戏（封装通用逻辑）
     * @param templateId 模板 ID
     * @param options 可选配置
     * @returns 游戏 ID 和座位 ID
     */
    public async createGameWithTemplate(
        templateId: number,
        options?: {
            maxPlayers?: number;
            startingCash?: bigint;
            priceRiseDays?: number;
            maxRounds?: number;
        }
    ): Promise<{ gameId: string; seatId: string; txHash: string }> {
        console.log('[SuiManager] createGameWithTemplate:', templateId);

        // 检查连接
        if (!this.isConnected) {
            UINotification.warning("请先连接钱包");
            throw new Error('Not connected');
        }

        // 获取 GameData 的默认值
        const gameData = this._cachedGameData || await this._queryService!.getGameData();
        const defaultStartingCash = gameData?.starting_cash || BigInt(10000);

        console.log('[SuiManager] Using defaults from GameData:');
        console.log('  starting_cash:', defaultStartingCash);

        UINotification.info("正在创建游戏...");

        try {
            const result = await this.createGame({
                template_map_id: templateId.toString(),
                max_players: options?.maxPlayers || 4,
                starting_cash: options?.startingCash || defaultStartingCash,  // 从 GameData
                price_rise_days: options?.priceRiseDays || 15,                // DEFAULT_PRICE_RISE_DAYS
                max_rounds: options?.maxRounds || 0                           // 0 = 无限
            });

            console.log('[SuiManager] Game created successfully');
            console.log('  Game ID:', result.gameId);
            console.log('  Seat ID:', result.seatId);

            UINotification.success("游戏创建成功");

            // 发送游戏开始事件
            EventBus.emit(EventTypes.Game.GameStart, {
                gameId: result.gameId,
                seatId: result.seatId,
                playerIndex: 0,
                isCreator: true
            });

            return result;

        } catch (error) {
            console.error('[SuiManager] Failed to create game:', error);
            UINotification.error("创建游戏失败");
            throw error;
        }
    }

    // ============ 查询 API ============

    /**
     * 获取可加入的游戏列表
     * - 优先使用缓存数据
     * - 过滤 STATUS_READY（准备中）的游戏
     * - 自己创建的游戏排在第一位
     * - 返回前 6 个
     *
     * @param forceRefresh 是否强制刷新（默认 false）
     * @returns 游戏列表（最多 6 个）
     */
    public async getAvailableGames(forceRefresh: boolean = false): Promise<Game[]> {
        this._ensureInitialized();

        // 优先使用缓存
        if (!forceRefresh && this._cachedGames.length > 0) {
            this._log('[SuiManager] Returning cached games', {
                count: this._cachedGames.length,
                cacheAge: Date.now() - this._cacheTimestamp
            });
            return this._cachedGames;
        }

        // 实时查询
        this._log('[SuiManager] Querying available games (cache miss or force refresh)...');
        UINotification.info("正在查询游戏列表...");

        // 查询所有 READY 状态的游戏
        let games = await this._queryService!.getReadyGames(
            this._currentAddress || undefined,
            50  // 查询更多以便筛选
        );

        this._log(`[SuiManager] Found ${games.length} READY games`);

        // 更新缓存
        this._cachedGames = this._sortAndLimitGames(games);
        this._cacheTimestamp = Date.now();

        this._log(`[SuiManager] Returning ${this._cachedGames.length} games`);

        return this._cachedGames;
    }

    /**
     * 获取地图模板列表
     * @returns 地图模板列表
     */
    public async getMapTemplates(): Promise<{ id: number; name: string }[]> {
        this._ensureInitialized();

        this._log('[SuiManager] Querying map templates...');

        const templates = await this._queryService!.getMapTemplates();

        this._log(`[SuiManager] Found ${templates.length} map templates`);

        return templates;
    }

    /**
     * 获取 GameData
     * @returns GameData 对象
     */
    public async getGameData(): Promise<any> {
        this._ensureInitialized();

        return await this._queryService!.getGameData();
    }

    // ============ 访问器 ============

    /**
     * 获取 Sui Client
     */
    public get client(): SuiClient {
        this._ensureInitialized();
        return this._client!;
    }

    /**
     * 获取 TycoonGameClient
     */
    public get gameClient(): TycoonGameClient {
        this._ensureInitialized();
        return this._gameClient!;
    }

    /**
     * 获取当前配置
     */
    public get config(): SuiConfig {
        this._ensureInitialized();
        return this._config!;
    }

    /**
     * 获取当前地址
     */
    public get currentAddress(): string | null {
        return this._currentAddress;
    }

    /**
     * 获取当前座位
     */
    public get currentSeat(): Seat | null {
        return this._currentSeat;
    }

    /**
     * 是否已连接签名器
     */
    public get isConnected(): boolean {
        return this._signer !== null;
    }

    /**
     * 获取当前签名器类型
     * @returns 'wallet' | 'keypair' | null
     */
    public getSignerType(): 'wallet' | 'keypair' | null {
        if (!this._signer) return null;
        return this._signer.getType();
    }

    // ============ 辅助方法 ============

    /**
     * 从交易结果中提取对象 ID
     */
    private _extractObjectId(result: SuiTransactionBlockResponse, objectType: string): string {
        const changes = result.objectChanges || [];
        for (const change of changes) {
            if (change.type === 'created' && change.objectType?.includes(objectType)) {
                return (change as any).objectId;
            }
        }
        throw new Error(`[SuiManager] Failed to extract ${objectType} ID from transaction`);
    }

    /**
     * 从交易结果中提取玩家索引
     */
    private _extractPlayerIndex(result: SuiTransactionBlockResponse): number {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('PlayerJoinedEvent')) {
                return (event.parsedJson as any)?.player_index || 0;
            }
        }
        return 0;
    }

    /**
     * 从交易结果中提取起始玩家
     */
    private _extractStartingPlayer(result: SuiTransactionBlockResponse): string {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('GameStartedEvent')) {
                return (event.parsedJson as any)?.starting_player || '';
            }
        }
        return '';
    }

    /**
     * 从交易结果中提取模板 ID
     */
    private _extractTemplateId(result: SuiTransactionBlockResponse): number {
        const events = result.events || [];
        for (const event of events) {
            if (event.type.includes('MapTemplatePublishedEvent')) {
                return (event.parsedJson as any)?.template_id || 0;
            }
        }
        return 0;
    }

    /**
     * 调试日志
     */
    private _log(message: string, data?: any): void {
        if (this._options.debug) {
            if (data) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
    }

    // ============ 后台数据预加载和事件监听 ============

    /**
     * 启动后台数据同步
     * 包括数据预加载和事件监听
     */
    public async startBackgroundSync(): Promise<void> {
        if (this._preloadStarted) {
            console.warn('[SuiManager] Background sync already started');
            return;
        }

        this._preloadStarted = true;
        console.log('[SuiManager] Starting background sync...');

        // 异步预加载数据（不阻塞）
        this._preloadData();

        // 启动事件监听
        this._startEventListener();
    }

    /**
     * 预加载数据
     */
    private async _preloadData(): Promise<void> {
        this._ensureInitialized();

        console.log('[SuiManager] Starting data preload...');
        UINotification.info("正在加载链上数据...");

        try {
            // 并行查询所有数据
            const [gameData, games, templates] = await Promise.all([
                this._queryService!.getGameData(),
                this._queryService!.getReadyGames(this._currentAddress || undefined, 50),
                this._queryService!.getMapTemplates()
            ]);

            // 打印 GameData
            console.log('[SuiManager] GameData loaded:');
            console.log('  Full GameData:', gameData);
            if (gameData) {
                console.log('  map_schema_version:', gameData.map_schema_version);
                console.log('  starting_cash:', gameData.starting_cash);
            }

            // 更新缓存
            this._cachedGameData = gameData;
            this._cachedGames = this._sortAndLimitGames(games);
            this._cachedMapTemplates = templates;
            this._cacheTimestamp = Date.now();
            this._preloadCompleted = true;

            console.log('[SuiManager] Preload completed', {
                games: this._cachedGames.length,
                templates: this._cachedMapTemplates.length
            });

            UINotification.info(`数据加载完成：${this._cachedGames.length} 个游戏，${this._cachedMapTemplates.length} 个模板`);

            // 发送预加载完成事件
            EventBus.emit(EventTypes.Sui.DataPreloaded, {
                gamesCount: this._cachedGames.length,
                templatesCount: this._cachedMapTemplates.length
            });

        } catch (error) {
            console.error('[SuiManager] Preload failed:', error);
            UINotification.error("数据加载失败");
        }
    }

    /**
     * 启动事件监听器
     */
    private _startEventListener(): void {
        this._ensureInitialized();

        console.log('[SuiManager] Starting event listener...');

        this._eventIndexer = new TycoonEventIndexer({
            client: this._client!,
            packageId: this._config!.packageId,
            autoStart: true,
            pollInterval: 5000  // 每 5 秒轮询一次
        });

        // 监听游戏创建事件
        this._eventIndexer.on(EventType.GAME_CREATED, (event) => {
            console.log('[SuiManager] New game created event:', event);
            UINotification.info("发现新游戏！");
            this._refreshGamesCache();
        });

        // 监听游戏开始事件（从列表移除）
        this._eventIndexer.on(EventType.GAME_STARTED, (event) => {
            console.log('[SuiManager] Game started event:', event);
            this._onGameStarted(event);
        });

        console.log('[SuiManager] Event listener started');
    }

    /**
     * 刷新游戏列表缓存
     */
    private async _refreshGamesCache(): Promise<void> {
        try {
            const games = await this._queryService!.getReadyGames(
                this._currentAddress || undefined,
                50
            );

            this._cachedGames = this._sortAndLimitGames(games);
            this._cacheTimestamp = Date.now();

            console.log('[SuiManager] Games cache refreshed:', this._cachedGames.length);

            // 发送缓存更新事件
            EventBus.emit(EventTypes.Sui.GamesListUpdated, {
                games: this._cachedGames
            });

        } catch (error) {
            console.error('[SuiManager] Failed to refresh games cache:', error);
        }
    }

    /**
     * 游戏开始事件处理（从 READY 列表移除）
     */
    private _onGameStarted(event: any): void {
        const gameId = event.data?.game;
        if (!gameId) return;

        // 从缓存中移除已开始的游戏
        const index = this._cachedGames.findIndex(g => g.id === gameId);
        if (index >= 0) {
            this._cachedGames.splice(index, 1);
            console.log(`[SuiManager] Removed started game ${gameId} from cache`);

            // 通知 UI 更新
            EventBus.emit(EventTypes.Sui.GamesListUpdated, {
                games: this._cachedGames
            });
        }
    }

    /**
     * 排序并限制游戏列表
     */
    private _sortAndLimitGames(games: GameListItem[]): Game[] {
        // 排序：自己创建的优先，其他按时间降序
        games.sort((a, b) => {
            if (a.isMyCreation && !b.isMyCreation) return -1;
            if (!a.isMyCreation && b.isMyCreation) return 1;
            return b.createdAt - a.createdAt;
        });

        // 只保留前 6 个
        return games.slice(0, 6).map(item => item.game);
    }

    /**
     * 停止事件监听器
     */
    public stopEventListener(): void {
        if (this._eventIndexer) {
            this._eventIndexer.stop();
            this._eventIndexer = null;
            console.log('[SuiManager] Event listener stopped');
        }
    }

    /**
     * 获取缓存的游戏列表
     */
    public getCachedGames(): Game[] {
        return this._cachedGames;
    }

    /**
     * 获取缓存的地图模板列表
     */
    public getCachedMapTemplates(): { id: number; name: string }[] {
        return this._cachedMapTemplates;
    }

    /**
     * 获取缓存的 GameData
     */
    public getCachedGameData(): any {
        return this._cachedGameData;
    }

    /**
     * 预加载是否完成
     */
    public get isPreloadCompleted(): boolean {
        return this._preloadCompleted;
    }

    // ============ 玩家资产管理 ============

    /**
     * 加载当前玩家的资产
     * 在连接钱包后自动调用
     */
    public async loadPlayerAssets(): Promise<void> {
        if (!this._currentAddress) {
            console.warn('[SuiManager] No wallet connected, skip loading assets');
            return;
        }

        this._ensureInitialized();

        console.log('[SuiManager] Loading player assets for:', this._currentAddress);
        UINotification.info("正在查询钱包资产...");

        try {
            // 并行查询所有资产
            const [balance, seats] = await Promise.all([
                this._assetService!.getSuiBalance(this._currentAddress),
                this._assetService!.getPlayerSeats(this._currentAddress)
                // 预留：Map Template NFTs
                // this._assetService!.getMapTemplateNFTs(this._currentAddress),
                // 预留：DeFi 资产
                // this._assetService!.getDeFiAssets(this._currentAddress)
            ]);

            // 更新缓存
            this._cachedSuiBalance = balance;
            this._cachedSeats = seats;
            this._assetsCacheTimestamp = Date.now();

            console.log('[SuiManager] Player assets loaded', {
                balance: balance.toString(),
                seats: seats.length
            });

            // 通过 Blackboard 通知 UI 更新
            Blackboard.instance.set("sui_balance", balance, true);
            Blackboard.instance.set("sui_seats", seats, true);

            const formattedBalance = this._formatSuiAmount(balance);
            UINotification.success(`资产加载完成：${formattedBalance} SUI`);

        } catch (error) {
            console.error('[SuiManager] Failed to load player assets:', error);
            UINotification.error("资产查询失败");
        }
    }

    /**
     * 刷新 SUI 余额（异步，不阻塞）
     */
    private async _refreshBalanceAsync(): Promise<void> {
        if (!this._currentAddress) return;

        try {
            const balance = await this._assetService!.getSuiBalance(this._currentAddress);

            if (balance !== this._cachedSuiBalance) {
                this._cachedSuiBalance = balance;
                Blackboard.instance.set("sui_balance", balance, true);
                console.log('[SuiManager] Balance updated:', balance.toString());
            }
        } catch (error) {
            console.error('[SuiManager] Failed to refresh balance:', error);
        }
    }

    /**
     * 格式化 SUI 数量
     * @param mist MIST 数量
     * @returns 格式化字符串（如 "123.4567"）
     */
    private _formatSuiAmount(mist: bigint): string {
        return AssetService.formatSuiAmount(mist, 4);
    }

    /**
     * 获取缓存的 SUI 余额
     */
    public get suiBalance(): bigint {
        return this._cachedSuiBalance;
    }

    /**
     * 获取缓存的 Seat NFTs
     */
    public get seats(): SeatNFT[] {
        return this._cachedSeats;
    }

    /**
     * 获取缓存的 Map Template NFTs（预留）
     */
    public get mapTemplateNFTs(): MapTemplateNFT[] {
        return this._cachedMapTemplateNFTs;
    }

    /**
     * 获取缓存的 DeFi 资产（预留）
     */
    public get defiAssets(): DeFiAssets {
        return this._cachedDeFiAssets;
    }

    // ============ Explorer 工具方法 ============

    /**
     * 获取 Explorer URL
     * @param id 对象ID/交易哈希/地址
     * @param type 类型（默认 address）
     * @returns Explorer URL
     */
    public getExplorer(id: string, type: ExplorerItemType = 'address'): string {
        this._ensureInitialized();
        return getExplorerUrl(this._config!.network, id, type);
    }

    /**
     * 获取当前网络的显示名称
     * @returns 网络名称（如 "Localnet", "Testnet"）
     */
    public getNetworkName(): string {
        this._ensureInitialized();
        return getNetworkDisplayName(this._config!.network);
    }

    /**
     * 打开当前连接地址的 Explorer
     */
    public openCurrentAddressExplorer(): void {
        if (!this._currentAddress) {
            console.warn('[SuiManager] No address connected');
            UINotification.warning("请先连接钱包");
            return;
        }

        const url = this.getExplorer(this._currentAddress, 'address');
        this.openUrl(url);
    }

    /**
     * 在浏览器中打开 URL
     * @param url URL 地址
     */
    public openUrl(url: string): void {
        if (typeof window !== 'undefined' && window.open) {
            window.open(url, '_blank');
            console.log('[SuiManager] Opened URL:', url);
        } else {
            console.log('[SuiManager] URL to open:', url);
        }
    }

    // ============ 数据轮询管理 ============

    /**
     * 启动资产数据轮询
     * 在连接钱包或 keypair 后自动调用
     */
    private startAssetPolling(): void {
        if (!this._pollingService || !this._currentAddress) {
            console.warn('[SuiManager] Cannot start polling: service or address missing');
            return;
        }

        console.log('[SuiManager] Starting asset polling...');

        // 注册余额轮询（2 秒一次）
        this._pollingService.registerSimple(
            'sui_balance',
            async () => {
                const balance = await this._assetService!.getSuiBalance(this._currentAddress!);
                return balance;
            },
            2000,  // 2 秒
            'sui_balance'  // 自动更新 Blackboard
        );

        // // 注册 Seat NFT 轮询（10 秒一次，不需要太频繁）
        // this._pollingService.registerSimple(
        //     'sui_seats',
        //     async () => {
        //         const seats = await this._assetService!.getPlayerSeats(this._currentAddress!);
        //         return seats;
        //     },
        //     10000,  // 10 秒
        //     'sui_seats'
        // );

        // 启动轮询
        this._pollingService.start();

        console.log('[SuiManager] Asset polling started');
        console.log('  Balance: every 2s');
        console.log('  Seats: every 10s');
    }

    /**
     * 停止资产轮询
     */
    private stopAssetPolling(): void {
        if (this._pollingService) {
            this._pollingService.clear();
            console.log('[SuiManager] Asset polling stopped and cleared');
        }
    }
}

/**
 * 便捷的全局访问器
 */
export const suiManager = SuiManager.instance;
