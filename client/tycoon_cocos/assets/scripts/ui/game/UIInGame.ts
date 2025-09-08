import { UIBase } from "../core/UIBase";
import { EventBus } from "../../events/EventBus";
import { EventTypes } from "../../events/EventTypes";
import { Blackboard } from "../../events/Blackboard";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import { UIManager } from "../core/UIManager";
import { UIMapElement } from "./UIMapElement";

const { ccclass } = _decorator;

/**
 * 游戏内UI界面 - 管理游戏中的HUD和交互界面
 */
@ccclass('UIInGame')
export class UIInGame extends UIBase {


    private m_btn_dice:fgui.GButton;
    private m_btn_mapElement:fgui.GButton;

    private m_mapElementUI:UIMapElement;

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
        this.m_btn_mapElement = this.getChild('btn_mapElement') as fgui.GButton;
        console.log('this.m_btn_mapElement', this.m_btn_mapElement);


        //m_mapElementUI
        const mapElementComponent = this.getChild('mapElement').asCom;
        this.m_mapElementUI = mapElementComponent.node.addComponent(UIMapElement);
        // 设置UI名称和面板引用
        this.m_mapElementUI.setUIName("MapElement");
        this.m_mapElementUI.setPanel(mapElementComponent);
        // 初始化
        this.m_mapElementUI.init();

        //hide
        this.m_mapElementUI.hide();

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

        // 进度条
        this._hpProgressBar = this.getProgressBar("progressHP");
        this._expProgressBar = this.getProgressBar("progressEXP");

        // 容器组件
        this._miniMapContainer = this.getComponent("containerMiniMap");
        this._statusContainer = this.getComponent("containerStatus");
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

        if(this.m_btn_mapElement){
            this.m_btn_mapElement.onClick(this.onMapElementClick, this);
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

        // 监听游戏事件
        EventBus.on(EventTypes.Game.TurnStart, this._onTurnStart, this);
        EventBus.on(EventTypes.Game.TurnEnd, this._onTurnEnd, this);
        EventBus.on(EventTypes.Game.GamePause, this._onGamePause, this);
        EventBus.on(EventTypes.Game.GameResume, this._onGameResume, this);
        EventBus.on(EventTypes.Dice.StartRoll, this._onDiceStart, this);
        EventBus.on(EventTypes.Dice.RollComplete, this._onDiceComplete, this);

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

        if(this.m_btn_mapElement){
            this.m_btn_mapElement.offClick(this.onMapElementClick, this);
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
    }

    // ================== 按钮事件处理 ==================

    /**
     * 投掷骰子按钮点击
     */
    private _onRollDiceClick(): void {
        console.log("[UIInGame] Roll dice clicked");

        if (!this._rollDiceBtn || !this._rollDiceBtn.enabled) {
            return;
        }

        // 发送投掷骰子事件
        EventBus.emit(EventTypes.Dice.StartRoll, {
            playerId: Blackboard.instance.get("currentPlayerId"),
            source: "in_game_ui"
        });
    }


    /**
     * 地图元素按钮点击
     */
    private onMapElementClick(): void {
        console.log("[UIInGame] Map element clicked");

        // UIManager.instance.registerMapElementUI("InGame", "MapElement");
        // UIManager.instance.showUI("MapElement");

        this.m_mapElementUI.show();
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

    // ================== 游戏事件处理 ==================

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