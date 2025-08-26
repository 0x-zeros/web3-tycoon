import { ConfigData } from './types';

const config: ConfigData = {
    "localStorageKey": "web3-tycoon",  // 使用环境变量
    "projectName": "web3-tycoon",
    "save_interval": 5,

    "loading": {
        "delay": 200,
    },

    "playground": {
        "max_row": 9,
        "max_column": 6,
    },

    "actor": {
        "boss_roundNum": 20,
        "death_split_elite_id": 102
    },

    "emitter": {
        "missile_count": 5,
        "missile_delay": 0.120
    },

    "missile": {
        "damage": 1,
        "max_extra_damage": 5,
        "startSpeed": 20,
        "maxSpeed": 25,
        "pic_url": ["zidan_01.png", "zidan_02.png", "zidan_03.png", "zidan_04.png", "zidan_05.png", "zidan_06.png"]
    },

    "skill_set": [
        {"skillId": 6001, "initCount": 1, "awardCount": 3},
        {"skillId": 6002, "initCount": 1, "awardCount": 3}
    ],

    "rank": {
        "rankListCanvasOffsetY": 350,
        "entry_count_per_page": 6.2,
        "max_show_entry_count": 10
    },

    "effect": {
        "config_url": "data/effectConfig.json",
        "animatedSprite_dir": "data/texture/animatedSprite/"
    },
    "music": {
        "actor_born": {
            "url": "data/music/assets_audio_born.wav",
            "loop": false
        },
        "actor_move": {
            "url": "data/music/assets_audio_move.wav",
            "loop": false
        },
        "missile_fire": {
            "url": "data/music/assets_audio_mission.wav",
            "loop": false
        },
        "missile_rebounce": {
            "url": "data/music/assets_audio_mission.wav",
            "loop": false
        },
        "actor_hit": {
            "url": "data/music/assets_audio_mission.wav",
            "loop": false
        },
        "actor_hit_no_damage": {
            "url": "data/music/assets_audio_spark.wav",
            "loop": false
        },
        "effect_victory": {
            "url": "data/music/assets_audio_victory.wav",
            "loop": false
        },
        "effect_click": {
            "url": "data/music/assets_audio_tiledrop.wav",
            "loop": false
        },
        "bg": {
            "url": null,
            "loop": false
        },
        "bgPlay": {
            "url": null,
            "loop": false
        }
    },
    "font": {
        "en_font": "data/font/zzgflh.TTF"
    },
    "localization": {
        "url": "data/localization.json"
    },
    "unlock": {
        "social": "no",
        "ad": "yes"
    },
    "app_icon": "data/texture/icon/500x400.png",
    "wx_share_title": "听说只有1%的人能超过10000分",
    "wx_share_icon": "data/texture/icon/500x400.png",
    "gameClubButton": {
        "left": 950,
        "top": 380,
        "width": 100,
        "height": 100,
        "icon": "white"
    },
    "naviButton": {
        "left": 40,
        "top": 1760,
        "width": 120,
        "height": 120
    },
    "debug": {
        "drawPlayground": "no",
        "drawPath": "no",
        "fps": "no",
        "log": "no"
    }
};

export default config;