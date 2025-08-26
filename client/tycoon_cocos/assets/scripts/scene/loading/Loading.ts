import { _decorator, Component, ProgressBar, Node, JsonAsset, Prefab } from 'cc';
import * as cc from 'cc';
import { _ } from '../../common/lodash-compat';
import { LabelLocalized } from '../../i18n/LabelLocalized';
import { resources } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Loading')
export class Loading extends Component {

    @property(LabelLocalized)
    loadingStatus: LabelLocalized = null!;

    @property(ProgressBar)
    progressBar: ProgressBar = null!;

    @property(Node)
    btnStart: Node = null!;

    @property(Node)
    resetBtn: Node = null!;

    @property(JsonAsset)
    actorJsonData: JsonAsset = null!;

    @property(JsonAsset)
    skillJsonData: JsonAsset = null!;

    @property(JsonAsset)
    spawnactorJsonData: JsonAsset = null!;

    // Private properties
    private loadFinished: boolean = false;
    private loadResProgressData: { [key: string]: { loaded: boolean, completedCount: number, totalCount: number } } = {};
    private progress: number = 0;

    onEnable() {
        //this.btnStart.on(Node.EventType.TOUCH_START, this.loadNextScene, this)
        //this.resetBtn.on(Node.EventType.TOUCH_END, this.openResetSaveDataUI, this)
    }

    onDisable() {
        //this.btnStart.off(Node.EventType.TOUCH_START, this.loadNextScene, this)
        //this.resetBtn.off(Node.EventType.TOUCH_END, this.openResetSaveDataUI, this)
    }

    onLoad() {
        //this.btnStart.active = false

        //preload other scene
        this.loadRes();
    }

    loadRes() {
        //记录progress的
        this.loadFinished = false;
        this.loadResProgressData = {};
        this.progress = 0;
        this.initJsonData();
        this.loadOtherScenes();
        //this.loadShapePrefab()
    }

    onLoadFinished() {
        this.loadingStatus.textKey = 'preload_ok';
        this.progressBar.progress = 1;
        //console.log('onLoadFinished', this.progress, this.progressBar.progress)

        //this.btnStart.active = true

        //
        //立刻切换到play场景看不到效果, 我觉得得停留个比如200ms
        let delayTime = game.config.loading.delay;
        //_.delay(this.showSelect, delayTime);//200

        // console.log('onLoadFinished, showSelect', delayTime)

        _.delay(() => {
            this.showSelect();
        }, delayTime);
    }

    showSelect() {
        // let node = instantiate(this.modeSelectPrefab)
        // this.node.addChild(node)

        //hide
        this.progressBar.node.active = false;
        this.loadingStatus.node.active = false;

        game.loadScene(game.sceneNames.modeSelect);
    }

    initJsonData() {

        game.jsonData = {
            actor: [],
            skill: [],
            spawnactor: []
        };

        game.jsonData.actor = this.actorJsonData.json as any[];//utils.convertJsonDataList2Obj(this.actorJsonData)
        game.jsonData.skill = this.skillJsonData.json as any[];//utils.convertJsonDataList2Obj(this.skillJsonData)
        game.jsonData.spawnactor = this.spawnactorJsonData.json as any[];//utils.convertJsonDataList2Obj(this.spawnactorJsonData)

        //
        //game.skillManager = skillManager
        //game.actorManager = actorManager
        //console.log('game.skillManager', game.skillManager)
        //console.log('game.actorManager', game.actorManager)

        // 初始化管理器（在JSON数据加载完成后）
        if (game.skillManager) {
            game.skillManager.init();
        }
        
        if (game.actorManager) {
            game.actorManager.init();
        }

        game.eventTarget.emit('Loaded_jsonData', null);
    }

    loadOtherScenes() {

        // game.scenePrefabs = {}
        // _.each(game.sceneNames, (sceneName) => {
        //     if (sceneName !== game.sceneNames.loading) {
        //         let url = game.sceneDir + sceneName
        //
        //         resources.load(url, Prefab, this.progressCallback, (err, prefab) => {
        //
        //             if (err) {
        //                 console.log(err)
        //             }
        //             else {
        //                 console.log(`scenePrefab ${sceneName} loaded. ${prefab.name}`)
        //                 game.scenePrefabs[sceneName] = prefab
        //             }
        //         });
        //     }
        // })

        let sceneUrl: string[] = [];
        // let sceneNames = []

        _.each(game.sceneNames, (sceneName: string) => {
            if (sceneName !== game.sceneNames.loading) {
                let url = game.sceneDir + sceneName;
                sceneUrl.push(url);
                // sceneNames.push(sceneName)
            }
        });

        game.scenePrefabs = {};

        let resKey = 'scenes';
        this.loadResProgressData[resKey] = { loaded: false, completedCount: 0, totalCount: 0 };
        
        resources.load(sceneUrl, Prefab, (completedCount, totalCount, item) => {
            // cc.log('progressCallback', completedCount, totalCount)

            let obj = this.loadResProgressData[resKey]
            obj.completedCount = completedCount
            obj.totalCount = totalCount
        },
        (err, assets) => {

            if (err) {
                console.log(err)
            }
            else {

                assets.forEach((prefab, idx) => {
                    game.scenePrefabs[prefab.name] = prefab
                    cc.log(`scenePrefab ${prefab.name} loaded.`)
                })
            }


            let obj = this.loadResProgressData[resKey]
            obj.loaded = true
        })
    }

    // loadShapePrefab(cbFunc?: Function) {
    //     game.shapePrefab = {};
    //     let dir = `${game.config.projectName}/prefabs/shape`;
    //     // console.log('loadShapePrefab dir', dir)

    //     let resKey = dir;
    //     this.loadResProgressData[resKey] = { loaded: false, completedCount: 0, totalCount: 0 };
        
    //     // Note: In Cocos Creator 3.x, we should use resources.loadDir instead of cc.loader.loadResDir
    //     // This is a placeholder for the resource loading logic
    //     console.warn('Shape prefab loading needs to be implemented with Cocos Creator 3.x resources API');
        
    //     // Temporary completion for development
    //     setTimeout(() => {
    //         this.loadResProgressData[resKey].loaded = true;
    //     }, 500);
    // }

    checkLoadProgress(): [boolean, number, number] {

        let loaded = true;
        let completedCount = 0;
        let totalCount = 0;
        _.each(this.loadResProgressData, (obj) => {
            loaded = loaded && obj.loaded;
            completedCount += obj.completedCount;
            totalCount += obj.totalCount;
        });

        return [loaded, completedCount, totalCount];
    }

    update(deltaTime: number) {
        // console.log('loadFinished = ', this.loadFinished)

        if (!this.loadFinished) {

            let [loaded, completedCount, totalCount] = this.checkLoadProgress();

            if (loaded) {
                this.loadFinished = true;

                this.onLoadFinished();
                return;
            }

            // console.log('progress ', completedCount, totalCount)
            if (totalCount > 0) {
                let progress = completedCount / totalCount;

                if (progress > this.progress) {
                    // console.log('progress = ', progress)
                    this.progress = progress;
                    this.progressBar.progress = this.progress;
                }
            }
        }
    }

    loadNextScene() {

        game.loadScene(game.sceneNames.selectLevel);

        this.clear();
    }

    openResetSaveDataUI() {
        // console.log('in openResetSaveDataUI')

        // Note: This logic needs to be updated for Cocos Creator 3.x
        // if (this.resetSaveDataUI) {
        //     this.resetSaveDataUI.active = true
        // }
        // else {
        //     if (this.resetSaveDataPrefab) {
        //         this.resetSaveDataUI = instantiate(this.resetSaveDataPrefab)
        //         game.node.canvas.addChild(this.resetSaveDataUI)
        //     }
        // }
    }

    clear() {
        this.node.destroy();

        // if (this.resetSaveDataUI) {
        //     this.resetSaveDataUI.destroy()
        // }
    }
}