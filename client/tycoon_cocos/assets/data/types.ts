/**
 * 游戏数据类型定义文件
 */

// 音频配置接口
export interface AudioConfig {
    url: string | null;
    loop: boolean;
}

// 音频配置集合
export interface MusicConfig {
    actor_born: AudioConfig;
    actor_move: AudioConfig;
    missile_fire: AudioConfig;
    missile_rebounce: AudioConfig;
    actor_hit: AudioConfig;
    actor_hit_no_damage: AudioConfig;
    effect_victory: AudioConfig;
    effect_click: AudioConfig;
    bg: AudioConfig;
    bgPlay: AudioConfig;
}

// 游戏配置数据接口
export interface ConfigData {
    localStorageKey: string;
    projectName: string;
    save_interval: number;
    
    loading: {
        delay: number;
    };
    
    playground: {
        max_row: number;
        max_column: number;
    };
    
    actor: {
        boss_roundNum: number;
        death_split_elite_id: number;
    };
    
    emitter: {
        missile_count: number;
        missile_delay: number;
    };
    
    missile: {
        damage: number;
        max_extra_damage: number;
        startSpeed: number;
        maxSpeed: number;
        pic_url: string[];
    };
    
    skill_set: Array<{
        skillId: number;
        initCount: number;
        awardCount: number;
    }>;
    
    rank: {
        rankListCanvasOffsetY: number;
        entry_count_per_page: number;
        max_show_entry_count: number;
    };
    
    effect: {
        config_url: string;
        animatedSprite_dir: string;
    };
    
    music: MusicConfig;
    
    font: {
        en_font: string;
    };
    
    localization: {
        url: string;
    };
    
    unlock: {
        social: string;
        ad: string;
    };
    
    app_icon: string;
    wx_share_title: string;
    wx_share_icon: string;
    
    gameClubButton: {
        left: number;
        top: number;
        width: number;
        height: number;
        icon: string;
    };
    
    naviButton: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    
    debug: {
        drawPlayground: string;
        drawPath: string;
        fps: string;
        log: string;
    };
}

// 角色掉落物品接口
export interface ActorDrop {
    money?: number;
    actor?: number[];
}

// 角色数据接口
export interface ActorData {
    actor_id: number;
    name: string;
    type: 'monster' | 'elite' | 'boss' | 'item' | 'skill';
    hp: number;
    hp_rate: number;
    size: number;
    rebounce: number;
    eliminate_damage: number;
    speed: number;
    drop: ActorDrop | null;
    pic_url: string[];
    new_round_spawn_percentage?: number; // 新回合生成百分比
}

// 技能数据接口
export interface SkillData {
    skill_id: number;
    name: string;
    type: string;
    description: string;
    damage?: number;
    duration?: number;
    cooldown?: number;
    range?: number;
    pic_url: string[];
}

// 生成角色数据接口
export interface SpawnActorData {
    round_num: number;
    spawn_elite: number;
    spawn_elite_id: number;
    monster: number;
    monster_percentage: number;
    monster_min: number;
    monster_max: number;
    item: number;
    item_percentage: number;
    skill: number;
    skill_percentage: number;
}

// 国际化数据接口
export interface I18nData {
    [key: string]: string;
}

// 游戏JSON数据接口
export interface GameJsonData {
    actor: ActorData[];
    skill: SkillData[];
    spawnactor: SpawnActorData[];
}