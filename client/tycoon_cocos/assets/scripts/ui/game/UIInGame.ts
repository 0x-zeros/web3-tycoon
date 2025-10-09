import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { UIManager } from "../core/UIManager";
import { UIMapElement } from "./UIMapElement";
import { UIEditor } from "./UIEditor";
import { MapManager } from "../../map/MapManager";
import { DiceController } from "../../game/DiceController";

const { ccclass } = _decorator;

/**
 * 游戏内UI界面 - 管理游戏中的HUD和交互界面
 */
@ccclass('UIInGame')
export class UIInGame extends UIBase {


    private m_btn_dice:fgui.GButton;

    private m_mapElementUI:UIMapElement;
    private m_editorUI:UIEditor;
    private m_modeController: fgui.Controller;

    // ================ 玩家信息组件 ================
    /** 玩家名称文本 */
    private _playerNameText: fgui.GTextField | null = null;
    /** 玩家金钱文本 */
    private _playerMoneyText: fgui.GTextField | null = null;
    /** 玩家等级文本 */
    private _playerLevelText: fgui.GTextField | null = null;
    /** 玩家头像 */
    private _playerAvatar: fgui.GImage | null = null;

    // ================ 游戏状态组件 ================
    /** 当前回合文本 */
    private _currentRoundText: fgui.GTextField | null = null;
    /** 当前玩家文本 */
    private _currentPlayerText: fgui.GTextField | null = null;
    /** 游戏时间文本 */
    private _gameTimeText: fgui.GTextField | null = null;

    // ================ 功能按钮组件 ================
    /** 投掷骰子按钮 */
    private _rollDiceBtn: fgui.GButton | null = null;
    /** 暂停按钮 */
    private _pauseBtn: fgui.GButton | null = null;
    /** 设置按钮 */
    private _settingsBtn: fgui.GButton | null = null;
    /** 背包按钮 */
    private _bagBtn: fgui.GButton | null = null;
    /** 退出游戏按钮 */
    private _exitGameBtn: fgui.GButton | null = null;

    // ================ 进度条组件 ================
    /** 生命值进度条 */
    private _hpProgressBar: fgui.GProgressBar | null = null;
    /** 经验值进度条 */
    private _expProgressBar: fgui.GProgressBar | null = null;

    // ================ 其他组件 ================
    /** 小地图容器 */
    private _miniMapContainer: fgui.GComponent | null = null;
    /** 状态指示器容器 */
    private _statusContainer: fgui.GComponent | null = null;

    /** 计时器ID */
    private _gameTimerID: number | null = null;

    /**
     * 初始化回调
     */
    protected onInit(): void {
        this._setupComponents();
        this._setupDefaultValues();
    }

    /**
     * 设置组件引用
     */
    private _setupComponents(): void {

        this.m_btn_dice = this.getChild('n1').asCom.getChild('n2') as fgui.GButton;
        
        // 获取editor组件并设置UIEditor
        const editorComponent = this.getChild('editor').asCom;
        this.m_editorUI = editorComponent.node.addComponent(UIEditor);
        // 设置UI名称和面板引用
        this.m_editorUI.setUIName("Editor");
        this.m_editorUI.setPanel(editorComponent);
        // 初始化
        this.m_editorUI.init();
        
        // 使用主界面的mode控制器
        this.m_modeController = this.getController('mode');

        //m_mapElementUI
        const mapElementComponent = this.getChild('mapElement').asCom;
        this.m_mapElementUI = mapElementComponent.node.addComponent(UIMapElement);
        // 设置UI名称和面板引用
        this.m_mapElementUI.setUIName("MapElement");
        this.m_mapElementUI.setPanel(mapElementComponent);
        // 初始化
        this.m_mapElementUI.init();
        
        // 设置UIEditor的UIMapElement引用（在m_mapElementUI创建之后）
        this.m_editorUI.setMapElementUI(this.m_mapElementUI);

        //hide
        this.m_mapElementUI.hide();
        
        // 根据GameMap的编辑模式设置控制器
        this.updateModeController();

        // 玩家信息组件
        this._playerNameText = this.getText("txtPlayerName");
        this._playerMoneyText = this.getText("txtPlayerMoney");
        this._playerLevelText = this.getText("txtPlayerLevel");
        this._playerAvatar = this.getImage("imgPlayerAvatar");

        // 游戏状态组件
        this._currentRoundText = this.getText("txtCurrentRound");
        this._currentPlayerText = this.getText("txtCurrentPlayer");
        this._gameTimeText = this.getText("txtGameTime");

        // 功能按钮
        // this._rollDiceBtn = this.getButton("btnRollDice");
        // this._rollDiceBtn = this.m_btn_dice;
        this._pauseBtn = this.getButton("btnPause");
        this._settingsBtn = this.getButton("btnSettings");
        this._bagBtn = this.getButton("btnBag");
        this._exitGameBtn = this.getButton("btn_exitGame");

        // 进度条
        this._hpProgressBar = this.getProgressBar("progressHP");
        this._expProgressBar = this.getProgressBar("progressEXP");

        // 容器组件
        this._miniMapContainer = this.getComponent("containerMiniMap");
        this._statusContainer = this.getComponent("containerStatus");
    }

    /**
     * 更新模式控制器
     */
    private updateModeController(): void {
        
        // 获取编辑模式状态并设置mode控制器
        if (this.m_modeController) {
            // 0:play模式 1:editor模式
            const isEditMode = MapManager.getInstance().getCurrentMapEditMode();
            this.m_modeController.selectedIndex = isEditMode ? 1 : 0;
        }
    }
    
    /**
     * 设置默认值
     */
    private _setupDefaultValues(): void {
        // 设置初始按钮状态
        // if (this._rollDiceBtn) {
        //     this._rollDiceBtn.enabled = false;
        //     this._rollDiceBtn.text = "等待回合";
        // }

        // 初始化显示数据
        this._updatePlayerDisplay();
        this._updateGameStateDisplay();
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {

        if(this.m_btn_dice){
            console.log('添加 投掷骰子事件1');
            this.m_btn_dice.onClick(this._onRollDiceClick, this);
        }

        // 绑定按钮事件
        if (this._rollDiceBtn) {
            console.log('添加 投掷骰子事件');
            this._rollDiceBtn.onClick(this._onRollDiceClick, this);
        }

        if (this._pauseBtn) {
            this._pauseBtn.onClick(this._onPauseClick, this);
        }

        if (this._settingsBtn) {
            this._settingsBtn.onClick(this._onSettingsClick, this);
        }

        if (this._bagBtn) {
            this._bagBtn.onClick(this._onBagClick, this);
        }

        if (this._exitGameBtn) {
            this._exitGameBtn.onClick(this._onExitGameClick, this);
        }

        // 监听游戏事件
        EventBus.on(EventTypes.Game.GameStart, this._onGameStart, this);
        EventBus.on(EventTypes.Game.TurnStart, this._onTurnStart, this);
        EventBus.on(EventTypes.Game.TurnEnd, this._onTurnEnd, this);
        EventBus.on(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.on(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.on(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.on(EventTypes.Dice.RollComplete, this._onDiceComplete, this);
        EventBus.on(EventTypes.UI.ScreenSizeChanged, this._onScreenSizeChanged, this);

        // 监听显示地图选择事件，隐藏游戏界面
        EventBus.on(EventTypes.UI.ShowMapSelect, this._onShowMapSelect, this);

        // 监听玩家数据变化
        Blackboard.instance.watch("playerMoney", this._onPlayerMoneyChange, this);
        Blackboard.instance.watch("playerLevel", this._onPlayerLevelChange, this);
        Blackboard.instance.watch("playerHp", this._onPlayerHpChange, this);
        Blackboard.instance.watch("playerExp", this._onPlayerExpChange, this);

        // 监听游戏状态变化
        Blackboard.instance.watch("currentRound", this._onRoundChange, this);
        Blackboard.instance.watch("currentPlayer", this._onCurrentPlayerChange, this);
        Blackboard.instance.watch("gameTime", this._onGameTimeChange, this);
        
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if(this.m_btn_dice){
            console.log('移除 投掷骰子事件1');
            this.m_btn_dice.offClick(this._onRollDiceClick, this);
        }

        // 解绑按钮事件
        if (this._rollDiceBtn) {
            this._rollDiceBtn.offClick(this._onRollDiceClick, this);
        }

        if (this._pauseBtn) {
            this._pauseBtn.offClick(this._onPauseClick, this);
        }

        if (this._settingsBtn) {
            this._settingsBtn.offClick(this._onSettingsClick, this);
        }

        if (this._bagBtn) {
            this._bagBtn.offClick(this._onBagClick, this);
        }

        if (this._exitGameBtn) {
            this._exitGameBtn.offClick(this._onExitGameClick, this);
        }

        EventBus.off(EventTypes.Game.GameStart, this._onGameStart, this);
        EventBus.off(EventTypes.Game.TurnStart, this._onTurnStart, this);
        EventBus.off(EventTypes.Game.TurnEnd, this._onTurnEnd, this);
        EventBus.off(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.off(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.off(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.off(EventTypes.Dice.RollComplete, this._onDiceComplete, this);
        EventBus.off(EventTypes.UI.ScreenSizeChanged, this._onScreenSizeChanged, this);
        EventBus.off(EventTypes.UI.ShowMapSelect, this._onShowMapSelect, this);
        

        // 调用父类解绑
        super.unbindEvents();
    }

    /**
     * 显示回调
     */
    protected onShow(data?: any): void {
        console.log("[UIInGame] Showing in-game UI");
        
        // 开始游戏计时器
        this._startGameTimer();
        
        // 更新显示数据
        this._updatePlayerDisplay();
        this._updateGameStateDisplay();
        
        // 播放入场动画
        this._playShowAnimation();
    }

    /**
     * 隐藏回调
     */
    protected onHide(): void {
        console.log("[UIInGame] Hiding in-game UI");
        
        // 停止游戏计时器
        this._stopGameTimer();
    }

    /**
     * 刷新回调
     */
    protected onRefresh(data?: any): void {
        this._updatePlayerDisplay();
        this._updateGameStateDisplay();

        this.updateModeController();
    }

    // ================== 按钮事件处理 ==================

    /**
     * 投掷骰子按钮点击
     */
    private _onRollDiceClick(): void {
        console.log("[UIInGame] Roll dice clicked");

        // 禁用骰子按钮，防止重复点击
        if (this.m_btn_dice) {
            this.m_btn_dice.enabled = false;
        }

        // 生成随机骰子值 (1-6)
        const diceValue = Math.floor(Math.random() * 6) + 1;
        console.log(`[UIInGame] 骰子点数: ${diceValue}`);

        // 使用DiceController播放骰子动画
        DiceController.instance.roll(diceValue, () => {
            console.log(`[UIInGame] 骰子动画完成，最终点数: ${diceValue}`);

            // 动画完成后重新启用骰子按钮
            if (this.m_btn_dice) {
                this.m_btn_dice.enabled = true;
            }

            // 发送骰子投掷完成事件
            EventBus.emit(EventTypes.Dice.RollComplete, {
                value: diceValue,
                playerId: Blackboard.instance.get("currentPlayerId"),
                source: "in_game_ui"
            });
        });

        // 发送投掷骰子事件
        EventBus.emit(EventTypes.Dice.StartRoll, {
            playerId: Blackboard.instance.get("currentPlayerId"),
            source: "in_game_ui"
        });
    }



    /**
     * 暂停按钮点击
     */
    private _onPauseClick(): void {
        console.log("[UIInGame] Pause clicked");

        // 发送游戏暂停事件
        EventBus.emit(EventTypes.Game.GamePause, {
            source: "in_game_ui"
        });

        // 显示暂停菜单
        EventBus.emit(EventTypes.UI.ShowPauseMenu);
    }

    /**
     * 设置按钮点击
     */
    private _onSettingsClick(): void {
        console.log("[UIInGame] Settings clicked");

        // 发送显示设置界面事件
        EventBus.emit(EventTypes.UI.ShowSettings, {
            source: "in_game_ui"
        });
    }

    /**
     * 背包按钮点击
     */
    private _onBagClick(): void {
        console.log("[UIInGame] Bag clicked");

        // 发送打开背包事件
        EventBus.emit(EventTypes.UI.OpenBag, {
            source: "in_game_ui"
        });
    }

    /**
     * 退出游戏按钮点击
     * 使用EventBus系统退出当前GameMap并返回地图选择界面
     */
    private _onExitGameClick(): void {
        console.log("[UIInGame] Exit game button clicked");

        // 发送请求切换地图事件（不指定目标地图toMapId: null表示卸载当前地图）
        //fromMapId: string; toMapId: string, isEdit?: boolean }
        EventBus.emit(EventTypes.Game.RequestMapChange, {
            toMapId: null
        });

        // 发送请求显示地图选择界面事件
        EventBus.emit(EventTypes.UI.ShowMapSelect);
        this.hide();

        console.log("[UIInGame] Sent events to exit to map selection");
    }

    /**
     * 显示地图选择事件（退出游戏/返回地图选择）
     */
    private _onShowMapSelect(data?: any): void {
        console.log('[UIInGame] ShowMapSelect event received, hiding');
        console.log('  Data:', data);
        this.hide();
    }
    

    // ================== 游戏事件处理 ==================

    /**
     * 游戏开始事件（从链上数据加载场景）
     * 事件数据：{ game, template, gameData }
     */
    private async _onGameStart(data: any): Promise<void> {
        console.log('[UIInGame] GameStart event received');
        console.log('  Game ID:', data.game?.id);
        console.log('  Template tiles:', data.template?.tiles_static?.size);
        console.log('  GameData:', !!data.gameData);

        try {
            // 1. 显示 UIInGame（先显示 UI，再加载场景）
            console.log('[UIInGame] Showing UIInGame');
            this.show();

            // 2. 隐藏 UIMapSelect
            //todo , 在UIMapSelect中自己处理隐藏

            // 3. 获取 GameMap 实例
            const mapManager = MapManager.getInstance();
            if (!mapManager) {
                throw new Error('MapManager not found');
            }

            const mapInfo = mapManager.getCurrentMapInfo();
            const gameMap = mapInfo?.component;

            if (!gameMap) {
                throw new Error('GameMap not found');
            }

            // 4. 从链上数据加载场景
            console.log('[UIInGame] Loading game scene from chain data...');
            const loaded = await gameMap.loadFromChainData(data.template, data.game);

            if (!loaded) {
                throw new Error('Failed to load game scene');
            }

            console.log('[UIInGame] Game scene loaded successfully');

            // 5. 初始化游戏状态到 Blackboard
            this._initializeGameState(data.game, data.gameData);

            // 6. 更新显示
            this._updatePlayerDisplay();
            this._updateGameStateDisplay();

            console.log('[UIInGame] Game started successfully');

        } catch (error) {
            console.error('[UIInGame] Failed to start game:', error);
            // TODO: 显示错误提示并返回地图选择
        }
    }

    /**
     * 初始化游戏状态到 Blackboard
     */
    private _initializeGameState(game: any, gameData: any): void {
        console.log('[UIInGame] Initializing game state to Blackboard');

        // 设置游戏基础信息
        Blackboard.instance.set('currentGameId', game.id, true);
        Blackboard.instance.set('currentRound', game.round, true);
        Blackboard.instance.set('currentTurn', game.turn, true);

        // 设置当前玩家信息（假设是第一个玩家）
        if (game.players && game.players.length > 0) {
            const player = game.players[0];
            Blackboard.instance.set('playerName', `玩家 #1`, true);
            Blackboard.instance.set('playerMoney', Number(player.cash), true);
            Blackboard.instance.set('playerLevel', 1, true);
        }

        // 设置游戏配置
        Blackboard.instance.set('gameData', gameData, true);

        console.log('[UIInGame] Game state initialized');
    }

    /**
     * 回合开始事件
     */
    private _onTurnStart(data: any): void {
        console.log("[UIInGame] Turn started:", data);

        // // 启用投掷按钮
        // if (this._rollDiceBtn) {
        //     this._rollDiceBtn.enabled = true;
        //     this._rollDiceBtn.text = "投掷骰子";
        // }
    }

    /**
     * 回合结束事件
     */
    private _onTurnEnd(data: any): void {
        console.log("[UIInGame] Turn ended:", data);

        // // 禁用投掷按钮
        // if (this._rollDiceBtn) {
        //     this._rollDiceBtn.enabled = false;
        //     this._rollDiceBtn.text = "等待回合";
        // }
    }

    /**
     * 游戏暂停事件
     */
    private _onGamePause(): void {
        console.log("[UIInGame] Game paused");

        if (this._pauseBtn) {
            this._pauseBtn.text = "继续";
        }

        this._stopGameTimer();
    }

    /**
     * 游戏恢复事件
     */
    private _onGameResume(): void {
        console.log("[UIInGame] Game resumed");

        if (this._pauseBtn) {
            this._pauseBtn.text = "暂停";
        }

        this._startGameTimer();
    }

    /**
     * 骰子开始投掷
     */
    private _onDiceStart(): void {
        // if (this._rollDiceBtn) {
        //     this._rollDiceBtn.enabled = false;
        //     this._rollDiceBtn.text = "投掷中...";
        // }
    }

    /**
     * 骰子投掷完成
     */
    private _onDiceComplete(data: any): void {
        console.log("[UIInGame] Dice roll completed:", data);

        // if (this._rollDiceBtn) {
        //     this._rollDiceBtn.text = "等待回合";
        // }
    }

    /**
     * 屏幕尺寸变化
     */
    private _onScreenSizeChanged(data: any): void {
        // console.log("[UIInGame] Screen size changed:", data);

        this._panel.setSize(data.width, data.height);
        // console.log("[UIInGame] panel size changed:", data.width, data.height);
    }

    // ================== 数据监听处理 ==================

    /**
     * 玩家金钱变化
     */
    private _onPlayerMoneyChange(money: number): void {
        if (this._playerMoneyText) {
            this._playerMoneyText.text = this._formatMoney(money);
        }

        // 播放金钱变化动画
        this._playMoneyAnimation(money);
    }

    /**
     * 玩家等级变化
     */
    private _onPlayerLevelChange(level: number): void {
        if (this._playerLevelText) {
            this._playerLevelText.text = `Lv.${level}`;
        }
    }

    /**
     * 玩家血量变化
     */
    private _onPlayerHpChange(hp: number): void {
        if (this._hpProgressBar) {
            const maxHp = Blackboard.instance.get<number>("playerMaxHp", 100);
            this._hpProgressBar.value = (hp / maxHp) * 100;
        }
    }

    /**
     * 玩家经验变化
     */
    private _onPlayerExpChange(exp: number): void {
        if (this._expProgressBar) {
            const maxExp = Blackboard.instance.get<number>("playerMaxExp", 1000);
            this._expProgressBar.value = (exp / maxExp) * 100;
        }
    }

    /**
     * 回合变化
     */
    private _onRoundChange(round: number): void {
        if (this._currentRoundText) {
            this._currentRoundText.text = `回合: ${round}`;
        }
    }

    /**
     * 当前玩家变化
     */
    private _onCurrentPlayerChange(playerName: string): void {
        if (this._currentPlayerText) {
            this._currentPlayerText.text = `当前: ${playerName}`;
        }
    }

    /**
     * 游戏时间变化
     */
    private _onGameTimeChange(time: number): void {
        if (this._gameTimeText) {
            this._gameTimeText.text = this._formatTime(time);
        }
    }

    // ================== 私有方法 ==================

    /**
     * 更新玩家显示数据
     */
    private _updatePlayerDisplay(): void {
        const playerName = Blackboard.instance.get<string>("playerName", "玩家");
        const playerMoney = Blackboard.instance.get<number>("playerMoney", 0);
        const playerLevel = Blackboard.instance.get<number>("playerLevel", 1);

        if (this._playerNameText) {
            this._playerNameText.text = playerName;
        }

        if (this._playerMoneyText) {
            this._playerMoneyText.text = this._formatMoney(playerMoney);
        }

        if (this._playerLevelText) {
            this._playerLevelText.text = `Lv.${playerLevel}`;
        }

        // 更新进度条
        this._onPlayerHpChange(Blackboard.instance.get<number>("playerHp", 100));
        this._onPlayerExpChange(Blackboard.instance.get<number>("playerExp", 0));
    }

    /**
     * 更新游戏状态显示
     */
    private _updateGameStateDisplay(): void {
        const currentRound = Blackboard.instance.get<number>("currentRound", 1);
        const currentPlayer = Blackboard.instance.get<string>("currentPlayer", "你");

        this._onRoundChange(currentRound);
        this._onCurrentPlayerChange(currentPlayer);
    }

    /**
     * 格式化金钱显示
     */
    private _formatMoney(money: number): string {
        if (money >= 1000000) {
            return `${(money / 1000000).toFixed(1)}M`;
        } else if (money >= 1000) {
            return `${(money / 1000).toFixed(1)}K`;
        }
        return money.toString();
    }

    /**
     * 格式化时间显示
     */
    private _formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 播放金钱变化动画
     */
    private _playMoneyAnimation(newMoney: number): void {
        // 可以使用FairyGUI的动画或自定义动画
        console.log(`[UIInGame] Money animation: ${newMoney}`);
        
        // 播放金钱增加特效
        const moneyEffect = this.getTransition("moneyChangeEffect");
        if (moneyEffect) {
            moneyEffect.play();
        }
    }

    /**
     * 开始游戏计时器
     */
    private _startGameTimer(): void {
        if (this._gameTimerID) {
            this._stopGameTimer();
        }

        this._gameTimerID = window.setInterval(() => {
            const currentTime = Blackboard.instance.get<number>("gameTime", 0);
            Blackboard.instance.set("gameTime", currentTime + 1);
        }, 1000);
    }

    /**
     * 停止游戏计时器
     */
    private _stopGameTimer(): void {
        if (this._gameTimerID) {
            clearInterval(this._gameTimerID);
            this._gameTimerID = null;
        }
    }

    /**
     * 播放显示动画
     */
    private _playShowAnimation(): void {
        const showTransition = this.getTransition("showAnim");
        if (showTransition) {
            showTransition.play();
        }

        console.log("[UIInGame] Playing show animation");
    }

    /**
     * 销毁回调
     */
    protected onDestroy(): void {
        this._stopGameTimer();
        super.onDestroy();
    }
}