import { EventTarget, Node, Size } from 'cc';
import { ConfigData, GameJsonData } from '../data/types';
import Player from './Player';
import Pool from './common/Pool';
import Asset from './common/Asset';
import { AudioManager } from './common/AudioManager';
import { EffectManager } from './common/EffectManager';
import { SkillManager } from './scene/play/skillManager';
import { ActorManager } from './scene/play/actorManager';
import Actorgrid from './scene/play/Actorgrid';

/**
 * 全局game对象的类型定义
 * 包含游戏核心系统的所有引用和数据
 */
export interface GameGlobal {
    // 核心配置和数据
    config: ConfigData;
    uiData: any;
    asset: Asset;
    pool: Pool;
    eventTarget: EventTarget;
    player: Player;
    
    // 节点引用
    node: {
        canvas: Node;
        canvas_overlay: Node;
        canvas_overlay1: Node;
    };
    
    // 场景管理
    sceneDir: string;
    scenes: any;
    sceneNames: any;
    scenePrefabs: any;
    currentScene: any;
    prevSceneName?: string | null;
    
    // 游戏系统组件
    audioManager: AudioManager;
    effectManager: EffectManager;
    actorManager?: ActorManager;
    playScene?: any; // PlayScene 类型
    playground?: any; // Playground 类型
    round?: any; // Round 类型
    role?: any; // Role 类型
    grid?: Actorgrid; // Actorgrid 类型
    rebounceWall?: any; // Wall 类型
    skillManager?: SkillManager;
    
    // 游戏数据
    winSize: Size;
    jsonData: GameJsonData;
    
    // 工具函数
    nextId: () => number;
    loadScene: (name: string) => void;
    pushScene: (name: string) => void;
    popScene: () => void;
}

/**
 * 全局变量声明
 * 确保TypeScript编译器能够识别全局game对象
 */
declare global {
    interface Window {
        game: GameGlobal;
    }
    // var game: GameGlobal;
}

// 让TypeScript将此文件视为模块
export {};