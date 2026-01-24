import { UIBase } from "../../core/UIBase";
import { EventBus } from "../../../events/EventBus";
import { EventTypes } from "../../../events/EventTypes";
import { UINotification } from "../../utils/UINotification";
import * as fgui from "fairygui-cc";
import { _decorator } from 'cc';
import {
    DEFAULT_STARTING_CASH,
    MIN_STARTING_CASH,
    MAX_STARTING_CASH,
    DEFAULT_PRICE_RISE_DAYS,
    MIN_PRICE_RISE_DAYS,
    MAX_PRICE_RISE_DAYS,
    DEFAULT_MAX_ROUNDS,
    MIN_MAX_ROUNDS,
    MAX_MAX_ROUNDS
} from "../../../sui/types/constants";
import { SETTING_GM_MODE } from "../../../sui/types/game";

const { ccclass } = _decorator;

/**
 * 游戏创建参数配置界面
 * 允许玩家在创建游戏时自定义参数：starting_cash, price_rise_days, max_rounds
 */
@ccclass('UIGameCreateParams')
export class UIGameCreateParams extends UIBase {
    // FairyGUI组件引用
    private m_btnCreateGame: fgui.GButton;
    private m_btnCancel: fgui.GButton;
    private m_btnEditMap: fgui.GButton;

    // Slider和Text组件
    private m_sliderStartingCash: fgui.GSlider;
    private m_textStartingCash: fgui.GTextField;

    private m_sliderPriceRiseDays: fgui.GSlider;
    private m_textPriceRiseDays: fgui.GTextField;

    private m_sliderMaxRounds: fgui.GSlider;
    private m_textMaxRounds: fgui.GTextField;

    // Controller（无限期/有限期切换）
    private m_controllerMaxRounds: fgui.Controller;
    private m_btnMaxRoundsMode: fgui.GButton;

    // GM模式按钮
    private m_btnGm: fgui.GButton;

    // 游戏名称输入框
    private m_inputName: fgui.GTextField;

    // 数据
    private _mapTemplateId: string;

    // 父容器引用（用于返回主界面）
    private _parentUI: any = null;

    /**
     * 设置父容器引用
     */
    public setParentUI(parent: any): void {
        this._parentUI = parent;
    }

    /**
     * 初始化UI元素
     */
    protected onInit(): void {
        console.log('[UIGameCreateParams] onInit');

        // 获取组件引用
        this.m_btnCreateGame = this.getButton('btn_createGame');
        this.m_btnCancel = this.getButton('btn_cancel');

        this.m_sliderStartingCash = this.getSlider('slider_starting_cash');
        this.m_textStartingCash = this.getText('starting_cash');

        this.m_sliderPriceRiseDays = this.getSlider('slider_price_rise_days');
        this.m_textPriceRiseDays = this.getText('price_rise_days');

        this.m_sliderMaxRounds = this.getSlider('slider_max_rounds');
        this.m_textMaxRounds = this.getText('max_rounds');

        this.m_controllerMaxRounds = this.getController('max_rounds');
        this.m_btnMaxRoundsMode = this.getButton('btn_max_rounds_mode');

        // GM模式按钮
        this.m_btnGm = this.getButton('btn_gm');

        // 编辑地图按钮
        this.m_btnEditMap = this.getButton('btn_editMap');

        // 游戏名称输入框
        this.m_inputName = this.getText('name');

        // 检查组件是否正确获取
        if (!this.m_btnCreateGame) {
            console.error('[UIGameCreateParams] btn_createGame not found');
        }

        if (!this.m_btnCancel) {
            console.error('[UIGameCreateParams] btn_cancel not found');
        }

        if (!this.m_sliderStartingCash || !this.m_textStartingCash) {
            console.error('[UIGameCreateParams] starting_cash components not found');
        }

        if (!this.m_sliderPriceRiseDays || !this.m_textPriceRiseDays) {
            console.error('[UIGameCreateParams] price_rise_days components not found');
        }

        if (!this.m_sliderMaxRounds || !this.m_textMaxRounds) {
            console.error('[UIGameCreateParams] max_rounds components not found');
        }

        if (!this.m_controllerMaxRounds) {
            console.error('[UIGameCreateParams] max_rounds controller not found');
        }

        if (!this.m_btnMaxRoundsMode) {
            console.error('[UIGameCreateParams] btn_max_rounds_mode not found');
        }
    }

    /**
     * 绑定事件
     */
    protected bindEvents(): void {
        if (!this.m_sliderStartingCash || !this.m_sliderPriceRiseDays ||
            !this.m_sliderMaxRounds || !this.m_btnMaxRoundsMode ||
            !this.m_btnCreateGame || !this.m_btnCancel) {
            console.error('[UIGameCreateParams] Cannot bind events - components not initialized');
            return;
        }

        // Slider变化事件
        this.m_sliderStartingCash.on(fgui.Event.STATUS_CHANGED, this._onStartingCashChanged, this);
        this.m_sliderPriceRiseDays.on(fgui.Event.STATUS_CHANGED, this._onPriceRiseDaysChanged, this);
        this.m_sliderMaxRounds.on(fgui.Event.STATUS_CHANGED, this._onMaxRoundsChanged, this);

        // 按钮事件
        this.m_btnMaxRoundsMode.on(fgui.Event.CLICK, this._onMaxRoundsModeClick, this);
        this.m_btnCreateGame.on(fgui.Event.CLICK, this._onCreateGameClick, this);
        this.m_btnCancel.on(fgui.Event.CLICK, this._onCancelClick, this);
        this.m_btnEditMap?.on(fgui.Event.CLICK, this._onEditMapClick, this);
    }

    /**
     * 解绑事件
     */
    protected unbindEvents(): void {
        if (this.m_sliderStartingCash) {
            this.m_sliderStartingCash.off(fgui.Event.STATUS_CHANGED, this._onStartingCashChanged, this);
        }
        if (this.m_sliderPriceRiseDays) {
            this.m_sliderPriceRiseDays.off(fgui.Event.STATUS_CHANGED, this._onPriceRiseDaysChanged, this);
        }
        if (this.m_sliderMaxRounds) {
            this.m_sliderMaxRounds.off(fgui.Event.STATUS_CHANGED, this._onMaxRoundsChanged, this);
        }
        if (this.m_btnMaxRoundsMode) {
            this.m_btnMaxRoundsMode.off(fgui.Event.CLICK, this._onMaxRoundsModeClick, this);
        }
        if (this.m_btnCreateGame) {
            this.m_btnCreateGame.off(fgui.Event.CLICK, this._onCreateGameClick, this);
        }
        if (this.m_btnCancel) {
            this.m_btnCancel.off(fgui.Event.CLICK, this._onCancelClick, this);
        }
        if (this.m_btnEditMap) {
            this.m_btnEditMap.off(fgui.Event.CLICK, this._onEditMapClick, this);
        }

        super.unbindEvents();
    }

    /**
     * 显示参数配置界面
     */
    public showWithParams(mapTemplateId: string): void {
        console.log('[UIGameCreateParams] showWithParams:', mapTemplateId);
        this._mapTemplateId = mapTemplateId;

        // 设置初始值为默认值
        this._initDefaultValues();

        // 该面板是固定尺寸的模态框，避免被 UIBase 强制拉伸为全屏
        this.show(undefined, false);
    }

    /**
     * Slider值映射到实际参数值（number类型）
     */
    private _mapSliderToValue(percent: number, min: number, max: number): number {
        return Math.round(min + (max - min) * percent / 100);
    }

    /**
     * Slider值映射到实际参数值（bigint类型）
     */
    private _mapSliderToBigInt(percent: number, min: bigint, max: bigint): bigint {
        const range = Number(max - min);
        const offset = Math.round(range * percent / 100);
        return min + BigInt(offset);
    }

    /**
     * Slider值映射到实际参数值（bigint类型，带 snap）
     * @param percent Slider百分比（0-100）
     * @param min 最小值
     * @param max 最大值
     * @param snapUnit snap单位（如 1000n）
     */
    private _mapSliderToBigIntWithSnap(
        percent: number,
        min: bigint,
        max: bigint,
        snapUnit: bigint
    ): bigint {
        const range = Number(max - min);
        const rawOffset = range * percent / 100;

        // 将 offset 按 snapUnit 对齐
        const snapUnitNum = Number(snapUnit);
        const snappedOffset = Math.round(rawOffset / snapUnitNum) * snapUnitNum;

        return min + BigInt(snappedOffset);
    }

    /**
     * 计算默认值对应的slider百分比（number类型）
     */
    private _calculateInitialPercent(
        defaultValue: number,
        min: number,
        max: number
    ): number {
        if (max === min) return 50;  // 防止除零
        return ((defaultValue - min) / (max - min)) * 100;
    }

    /**
     * 计算默认值对应的slider百分比（bigint类型）
     */
    private _calculateInitialPercentBigInt(
        defaultValue: bigint,
        min: bigint,
        max: bigint
    ): number {
        if (max === min) return 50;
        const range = Number(max - min);
        const offset = Number(defaultValue - min);
        return (offset / range) * 100;
    }

    /**
     * 初始化默认值
     */
    private _initDefaultValues(): void {
        console.log('[UIGameCreateParams] Initializing default values');

        // 计算默认值对应的slider百分比
        const startingCashPercent = this._calculateInitialPercentBigInt(
            DEFAULT_STARTING_CASH,
            MIN_STARTING_CASH,
            MAX_STARTING_CASH
        );
        this.m_sliderStartingCash.value = startingCashPercent;
        this._onStartingCashChanged();  // 更新显示

        const priceRiseDaysPercent = this._calculateInitialPercent(
            DEFAULT_PRICE_RISE_DAYS,
            MIN_PRICE_RISE_DAYS,
            MAX_PRICE_RISE_DAYS
        );
        this.m_sliderPriceRiseDays.value = priceRiseDaysPercent;
        this._onPriceRiseDaysChanged();

        const maxRoundsPercent = this._calculateInitialPercent(
            DEFAULT_MAX_ROUNDS,
            MIN_MAX_ROUNDS,
            MAX_MAX_ROUNDS
        );
        this.m_sliderMaxRounds.value = maxRoundsPercent;
        this._onMaxRoundsChanged();

        // 默认为无限期模式
        this.m_controllerMaxRounds.selectedIndex = 0;
        this.m_btnMaxRoundsMode.selected = true;  // 同步按钮视觉状态

        console.log('[UIGameCreateParams] Default values initialized:', {
            startingCash: this.m_textStartingCash.text,
            priceRiseDays: this.m_textPriceRiseDays.text,
            maxRounds: 'infinite (mode 0)'
        });
    }

    /**
     * starting_cash slider变化事件
     */
    private _onStartingCashChanged(): void {
        const percent = this.m_sliderStartingCash.value;
        const value = this._mapSliderToBigIntWithSnap(
            percent,
            MIN_STARTING_CASH,
            MAX_STARTING_CASH,
            1000n  // snap 单位 1000
        );
        this.m_textStartingCash.text = value.toString();
    }

    /**
     * price_rise_days slider变化事件
     */
    private _onPriceRiseDaysChanged(): void {
        const percent = this.m_sliderPriceRiseDays.value;
        const value = this._mapSliderToValue(
            percent,
            MIN_PRICE_RISE_DAYS,
            MAX_PRICE_RISE_DAYS
        );
        this.m_textPriceRiseDays.text = value.toString();
    }

    /**
     * max_rounds slider变化事件
     */
    private _onMaxRoundsChanged(): void {
        const percent = this.m_sliderMaxRounds.value;
        const value = this._mapSliderToValue(
            percent,
            MIN_MAX_ROUNDS,
            MAX_MAX_ROUNDS
        );
        this.m_textMaxRounds.text = value.toString();
    }

    /**
     * 无限期/有限期切换按钮点击
     */
    private _onMaxRoundsModeClick(): void {
        // 切换Controller的page（0=infinite, 1=limited）
        const currentPage = this.m_controllerMaxRounds.selectedIndex;
        const newPage = currentPage === 0 ? 1 : 0;

        this.m_controllerMaxRounds.selectedIndex = newPage;

        // 同步按钮视觉状态
        this.m_btnMaxRoundsMode.selected = (newPage === 0);

        console.log('[UIGameCreateParams] Max rounds mode changed to:',
            newPage === 0 ? 'infinite' : 'limited');
    }

    /**
     * 创建游戏按钮点击
     */
    private _onCreateGameClick(): void {
        // 收集参数
        const params = {
            templateMapId: this._mapTemplateId,
            startingCash: BigInt(this.m_textStartingCash.text),
            priceRiseDays: parseInt(this.m_textPriceRiseDays.text),
            maxRounds: this.m_controllerMaxRounds.selectedIndex === 0
                ? 0  // 无限期
                : parseInt(this.m_textMaxRounds.text),  // 有限期
            settings: this.m_btnGm?.selected ? SETTING_GM_MODE : 0,  // 游戏设置位字段
            name: this.m_inputName?.text?.trim() || ''  // 游戏名称（可选）
        };

        console.log('[UIGameCreateParams] Create game with params:', {
            ...params,
            startingCash: params.startingCash.toString(),  // BigInt需要转为string才能log
            settings: params.settings,
            name: params.name
        });

        // 发送事件，让UIMapList处理实际创建
        EventBus.emit(EventTypes.Game.CreateGameWithParams, params);

        // 隐藏自己，通知父UI返回主面板
        if (this._parentUI && this._parentUI.showMainPanel) {
            this._parentUI.showMainPanel();
        }
    }

    /**
     * 取消按钮点击
     */
    private _onCancelClick(): void {
        console.log('[UIGameCreateParams] Cancel clicked, closing without creating game');

        // 隐藏自己，通知父UI返回主面板
        if (this._parentUI && this._parentUI.showMainPanel) {
            this._parentUI.showMainPanel();
        }
    }

    /**
     * 编辑地图按钮点击
     */
    private async _onEditMapClick(): Promise<void> {
        if (!this._mapTemplateId) {
            UINotification.warning("请先选择地图模板");
            return;
        }

        console.log('[UIGameCreateParams] Edit map, template:', this._mapTemplateId);

        // 隐藏参数面板
        if (this._parentUI?.showMainPanel) {
            this._parentUI.showMainPanel();
        }

        // 发送事件，请求以编辑模式加载链上模板
        EventBus.emit(EventTypes.Game.EditMapTemplate, {
            templateId: this._mapTemplateId
        });
    }
}
