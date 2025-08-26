/**
 * 空白地块
 * 
 * 不触发任何特殊事件的普通地块，主要用于路径连接和地图布局
 * 玩家停留或经过时不会有任何特殊效果，是最基础的地块类型
 * 
 * @author Web3 Tycoon Team
 * @version 1.0.0
 */

import { _decorator, Component } from 'cc';
import { MapTile, TileInteractionResult } from '../core/MapTile';
import { MapTileData, TileType } from '../types/MapTypes';
import { PlayerData } from '../types/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 空白地块实现类
 * 提供最基础的地块功能，不含特殊逻辑
 */
@ccclass('EmptyTile')
export class EmptyTile extends MapTile {
    
    // ========================= 编辑器属性 =========================
    
    @property({ displayName: "欢迎消息", multiline: true, tooltip: "玩家第一次停留时显示的消息" })
    public welcomeMessage: string = '这是一片安静的空地。';
    
    @property({ displayName: "休息效果", tooltip: "是否提供休息恢复效果" })
    public providesRest: boolean = false;
    
    @property({ displayName: "休息恢复量", tooltip: "休息时恢复的体力值（如果有体力系统）" })
    public restAmount: number = 0;
    
    @property({ displayName: "显示路过统计", tooltip: "是否统计玩家路过次数" })
    public trackPassage: boolean = false;
    
    @property({ displayName: "装饰主题", tooltip: "空地的装饰主题（如花园、广场等）" })
    public decorationTheme: string = 'default';
    
    // ========================= 私有属性 =========================
    
    /** 玩家访问统计 */
    private _visitStats: Map<string, { landCount: number; passCount: number; lastVisit: number }> = new Map();
    
    /** 是否显示过欢迎消息 */
    private _hasShownWelcome: boolean = false;
    
    // ========================= 抽象方法实现 =========================
    
    /**
     * 获取地块类型
     */
    public get tileType(): TileType {
        return TileType.EMPTY;
    }
    
    /**
     * 地块初始化
     * @param tileData 地块数据
     */
    protected onTileInitialized(tileData: MapTileData): void {
        // 空白地块的初始化很简单，主要是设置基础属性
        
        // 如果没有设置名称，使用默认名称
        if (!this.tileName || this.tileName.trim() === '') {
            this.tileName = this.generateDefaultName();
        }
        
        // 如果没有设置描述，使用默认描述
        if (!this.description || this.description.trim() === '') {
            this.description = this.generateDefaultDescription();
        }
        
        // 根据装饰主题设置外观
        this.applyDecorationTheme();
        
        console.log(`[EmptyTile] 空白地块初始化完成: ${this.tileName} (${this.decorationTheme})`);
    }
    
    /**
     * 玩家停留处理
     * 空白地块通常不做特殊处理，但可以提供休息效果或显示信息
     * @param player 停留的玩家
     */
    protected async onPlayerLandOn(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[EmptyTile] 玩家 ${player.nickname} 停留在空白地块 ${this.tileName}`);
        
        // 更新访问统计
        this.updateVisitStats(player.id, 'land');
        
        // 构建消息
        let message = this.welcomeMessage;
        let moneyChange = 0;
        const events = [];
        
        // 首次访问显示欢迎消息
        if (!this._hasShownWelcome) {
            this._hasShownWelcome = true;
            message = `欢迎来到 ${this.tileName}！${this.welcomeMessage}`;
        }
        
        // 提供休息效果
        if (this.providesRest && this.restAmount > 0) {
            // 这里可以恢复玩家的体力值或提供小额金钱奖励
            const restBonus = Math.floor(this.restAmount);
            if (restBonus > 0) {
                player.financialStatus.cash += restBonus;
                player.financialStatus.income.other += restBonus;
                moneyChange = restBonus;
                message += ` 你在这里得到了充分的休息，获得 ${restBonus} 金币的小费。`;
            }
        }
        
        // 添加统计信息（如果启用）
        if (this.trackPassage) {
            const stats = this._visitStats.get(player.id);
            if (stats) {
                message += ` (你是第 ${stats.landCount} 次停留在这里)`;
            }
        }
        
        // 根据装饰主题添加特殊描述
        const themeMessage = this.getThemeMessage();
        if (themeMessage) {
            message += ` ${themeMessage}`;
        }
        
        return {
            success: true,
            message: message,
            events: events,
            moneyChange: moneyChange,
            blockMovement: false
        };
    }
    
    /**
     * 玩家经过处理
     * 记录经过统计，一般不做其他处理
     * @param player 经过的玩家
     */
    protected async onPlayerPassThrough(player: PlayerData): Promise<TileInteractionResult> {
        console.log(`[EmptyTile] 玩家 ${player.nickname} 经过空白地块 ${this.tileName}`);
        
        // 更新访问统计
        if (this.trackPassage) {
            this.updateVisitStats(player.id, 'pass');
        }
        
        return {
            success: true,
            message: `经过 ${this.tileName}`,
            events: [],
            moneyChange: 0,
            blockMovement: false
        };
    }
    
    // ========================= 私有方法 =========================
    
    /**
     * 生成默认名称
     */
    private generateDefaultName(): string {
        const defaultNames = [
            '空地', '休息区', '小广场', '绿地', '停车场',
            '公园', '花园', '空旷地', '安全区', '中转站'
        ];
        
        return defaultNames[Math.floor(Math.random() * defaultNames.length)];
    }
    
    /**
     * 生成默认描述
     */
    private generateDefaultDescription(): string {
        const descriptions = [
            '一片宁静的空地，什么也没有发生。',
            '这里很安全，是个休息的好地方。',
            '一个普通的地方，没有什么特别的。',
            '微风轻拂，这里很舒服。',
            '这里可以稍作停留。'
        ];
        
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }
    
    /**
     * 应用装饰主题
     */
    private applyDecorationTheme(): void {
        // 根据装饰主题调整地块的视觉外观
        // TODO: 这里可以设置不同的材质、颜色、装饰物等
        
        switch (this.decorationTheme) {
            case 'garden':
                // 花园主题：绿色调，可能有花朵装饰
                this.baseColor.set(120, 200, 120, 255);
                break;
            case 'plaza':
                // 广场主题：石灰色调
                this.baseColor.set(180, 180, 180, 255);
                break;
            case 'park':
                // 公园主题：自然绿色
                this.baseColor.set(100, 180, 100, 255);
                break;
            case 'beach':
                // 海滩主题：沙色
                this.baseColor.set(240, 220, 160, 255);
                break;
            default:
                // 默认主题：保持原色
                break;
        }
        
        console.log(`[EmptyTile] 应用装饰主题: ${this.decorationTheme}`);
    }
    
    /**
     * 获取主题相关消息
     */
    private getThemeMessage(): string {
        switch (this.decorationTheme) {
            case 'garden':
                return '花香阵阵，心情愉悦。';
            case 'plaza':
                return '宽阔的广场让人心胸开阔。';
            case 'park':
                return '绿树成荫，鸟语花香。';
            case 'beach':
                return '海风轻拂，浪花朵朵。';
            default:
                return '';
        }
    }
    
    /**
     * 更新访问统计
     * @param playerId 玩家ID
     * @param type 访问类型
     */
    private updateVisitStats(playerId: string, type: 'land' | 'pass'): void {
        let stats = this._visitStats.get(playerId);
        
        if (!stats) {
            stats = { landCount: 0, passCount: 0, lastVisit: 0 };
            this._visitStats.set(playerId, stats);
        }
        
        if (type === 'land') {
            stats.landCount++;
        } else {
            stats.passCount++;
        }
        
        stats.lastVisit = Date.now();
    }
    
    // ========================= 公共方法 =========================
    
    /**
     * 设置装饰主题
     * @param theme 主题名称
     */
    public setDecorationTheme(theme: string): void {
        this.decorationTheme = theme;
        this.applyDecorationTheme();
        
        // 更新描述
        this.description = this.generateDefaultDescription();
        
        console.log(`[EmptyTile] 装饰主题已更改为: ${theme}`);
    }
    
    /**
     * 获取访问统计
     * @param playerId 可选的玩家ID筛选
     */
    public getVisitStats(playerId?: string): any {
        if (playerId) {
            return this._visitStats.get(playerId) || { landCount: 0, passCount: 0, lastVisit: 0 };
        }
        
        // 返回所有玩家的统计
        const allStats: { [playerId: string]: any } = {};
        this._visitStats.forEach((stats, pid) => {
            allStats[pid] = { ...stats };
        });
        
        return allStats;
    }
    
    /**
     * 重置访问统计
     */
    public resetVisitStats(): void {
        this._visitStats.clear();
        this._hasShownWelcome = false;
        console.log('[EmptyTile] 访问统计已重置');
    }
    
    /**
     * 获取地块统计摘要
     */
    public getStatsSummary(): {
        totalPlayers: number;
        totalLandings: number;
        totalPassages: number;
        mostActivePlayer: string | null;
    } {
        let totalLandings = 0;
        let totalPassages = 0;
        let mostActivePlayer: string | null = null;
        let maxActivity = 0;
        
        this._visitStats.forEach((stats, playerId) => {
            totalLandings += stats.landCount;
            totalPassages += stats.passCount;
            
            const activity = stats.landCount + stats.passCount;
            if (activity > maxActivity) {
                maxActivity = activity;
                mostActivePlayer = playerId;
            }
        });
        
        return {
            totalPlayers: this._visitStats.size,
            totalLandings,
            totalPassages,
            mostActivePlayer
        };
    }
    
    /**
     * 检查是否是安全地块
     * 空白地块通常被认为是安全的
     */
    public isSafeTile(): boolean {
        return true;
    }
    
    /**
     * 检查是否适合休息
     */
    public isRestTile(): boolean {
        return this.providesRest;
    }
    
    /**
     * 设置休息效果
     * @param enabled 是否启用休息效果
     * @param amount 休息恢复量
     */
    public setRestEffect(enabled: boolean, amount: number = 0): void {
        this.providesRest = enabled;
        this.restAmount = amount;
        
        console.log(`[EmptyTile] 休息效果设置: ${enabled ? '启用' : '禁用'}, 恢复量: ${amount}`);
    }
    
    /**
     * 获取地块特色描述（用于UI显示）
     */
    public getFeatureDescription(): string {
        const features: string[] = [];
        
        if (this.providesRest) {
            features.push('可休息');
        }
        
        if (this.trackPassage) {
            features.push('统计访问');
        }
        
        if (this.decorationTheme !== 'default') {
            features.push(`${this.decorationTheme}主题`);
        }
        
        if (features.length === 0) {
            return '普通空地';
        }
        
        return features.join('、');
    }
}