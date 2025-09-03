import { sys, log, director } from 'cc';
import { _ } from './common/lodash-compat';
// import { utils } from './common/utils';
// import i18n from './i18n/i18n';


export default class Player {
    key: string = '';
    score: number = 0;
    maxScore: number = 0;
    maxMoney: number = 0;
    setting: any = {};
    lastUpdateTime: number = 0;
    schedulerTimeScale: number = 1;
    saveTime: number = 0;
    saveObj: any = null;

    init() {
        this.key = game.config.localStorageKey;

        if (!this.load()) {
            this.initData();
        } else {
            // 
            let l = this.setting.language;
            if (l !== sys.languageCode) {
                // i18n.init(l);
                // game.eventTarget.emit('changeLanguage', l);
            }
        }

        this.lastUpdateTime = Date.now(); // _.now()
        this.schedulerTimeScale = 1;
        this.saveTime = 0;

        // 最小化或者是切换到后台，保存数据的功能，后续再fix，找新api zero 2025-08-25
        // director.getGame().on(director.getGame().EVENT_HIDE, function () {
        //     // console.log('cc.game.EVENT_HIDE')
        //     this.save();
        // }.bind(this));
    }

    initData() {
        log('init player, initData', this);
        // 没有save data, 第一次初始化

        this.score = 0;
        this.maxScore = 0;
        this.maxMoney = 0;

        this.setting = {
            // mute: false,
            language: sys.languageCode, // localization.defaultLanguage,
            mute_bg: false, // music
            mute_effect: false
        };

        log('language', sys.languageCode);
    }

    changeLanguage(l: string) {
        if (l !== this.setting.language) {
            this.setting.language = l;

            // i18n.init(l);
            // game.eventTarget.emit('changeLanguage', l);

            return true;
        }

        return false;
    }

    getHighestScore() {
        return this.maxScore;
    }

    getScore() {
        return this.score;
    }

    recordScore(score: number) {
        this.score = score;
        if (score > this.maxScore) {
            this.maxScore = score;
        }
    }

    // loop
    loop(dt: number) {
        let now = Date.now(); // _.now()

        // save
        this.saveTime += dt;
        if (this.saveTime >= game.config.save_interval) {
            this.saveTime = 0;
            this.save();
        }

        this.lastUpdateTime = now;
    }

    // save
    save() {
        // let bSaveWxRankScore = false

        if (this.saveObj) {
            this.saveObj.score = this.score;
            this.saveObj.maxScore = this.maxScore;
            this.saveObj.maxMoney = this.maxMoney;

            this.saveObj.setting = this.setting;

            // this.saveObj.lastSaveTime = _.now()
        } else {
            let obj = {
                score: this.score,
                maxScore: this.maxScore,
                maxMoney: this.maxMoney,
                setting: this.setting,

                // lastSaveTime: _.now()
            };

            this.saveObj = obj;
        }

        this.saveLocalData(this.key, this.saveObj);

        // if(bSaveWxRankScore) {
        // game.wx_helper.setUserScore(this.unlockLevelNum - 1,  this.saveObj);
        // }
    }

    load() {
        let obj = this.loadLocalSaveData(this.key);
        if (obj) {
            this.score = obj.score ? obj.score : 0;
            this.maxScore = obj.maxScore ? obj.maxScore : 0;
            this.maxMoney = obj.maxMoney ? obj.maxMoney : 0;

            this.setting = obj.setting ? obj.setting : {
                // mute: false,
                language: sys.languageCode, // localization.defaultLanguage,
                mute_bg: false, // music
                mute_effect: false
            };

            // this.lastOffLineTime = obj.lastSaveTime

            return true;
        }

        return false;
    }

    clearSaveData() {
        console.log('clearSaveData');
        localStorage.removeItem(this.key);

        this.initData();
    }

    loadLocalSaveData(key: string) {
        var str = localStorage.getItem(key);
        // log(str);

        var obj = null;
        if (str) {
            obj = JSON.parse(str);
        }

        // log(obj);
        return obj;
    }

    saveLocalData(key: string, obj: any) {
        // log(obj);
        var str = JSON.stringify(obj);
        // log(str);
        localStorage.setItem(key, str);
    }
}