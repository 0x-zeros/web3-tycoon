import { _decorator, Component, Prefab, instantiate, find, director, EventTarget, Node, Size } from 'cc';
import * as cc from 'cc';
import config from '../data/config';
import { ConfigData, GameJsonData } from '../data/types';
import { GameGlobal } from './global';
import Player from './Player';
import Pool from './common/Pool';
import Asset from './common/Asset';
import { AudioManager } from './common/AudioManager';
import { EffectManager } from './common/EffectManager';
import { SkillManager } from './scene/play/skillManager';
import { ActorManager } from './scene/play/actorManager';
import { UITransform } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {
    @property(Prefab)
    audioManagerPrefab: Prefab = null!;

    @property(Prefab)
    loadingPrefab: Prefab = null!;

    ctor() {
        //ts，ctor()没有被调用过？
        // 初始化全局game对象
        // window.game = {} as GameGlobal;
        // console.log('in ctor, Game ctor window.game:', window.game)
    }

    onLoad() {

        window.addEventListener("error", (event) => {
            if (event.message.includes("MetaMask encountered an error")) {
              console.warn("cocos, Ignored MetaMask injection error:", event.message);
              event.preventDefault();
            }
          });


        window.game = {} as GameGlobal;
        console.log('onLoad, window.game:', window.game)

        // 无法解决下面的bug, 因此注释掉
        // http://forum.cocos.com/t/bug-ios-label/65605
        // cc.game.config.renderMode = 1

        // console.log('cc.game.config.renderMode', cc.game.config.renderMode)
        // let useCanvasRenderer = wx_helper.shouldEnforceCanvasRenderer()
        // if(useCanvasRenderer) {
        //     //0 - 通过引擎自动选择
        //     //1 - 强制使用 canvas 渲染
        //     //2 - 强制使用 WebGL 渲染，但是在部分 Android 浏览器中这个选项会被忽略
        //     cc.game.config.renderMode = 1
        //     console.log('cc.game.config.renderMode', cc.game.config.renderMode)
        // }

        director.addPersistRootNode(this.node);
        // cc.game.removePersistRootNode(this.node);

        this.initNode();
        this.initShader();

        //碰撞管理 没有用到吧？ zero 2025-08-25
        // // CollisionManager
        // let manager = director.getCollisionManager();
        // manager.enabled = true;
        // manager.enabledDebugDraw = false;
        // // manager.enabledDrawBoundingBox = true;

        // 定义全局变量
        // window.game = {};

        // game.config = this.configData.json
        game.config = config;

        // this.initMessageBox()

        this.initAudioManager();

        // game.wx_helper = wx_helper

        game.uiData = {};

        // my data
        this.initPlayerData();

        // i18n
        // game.i18n = new I18n()
        // game.i18n.init()

        // 预载
        game.asset = new Asset();
        game.asset.init();

        // pool
        game.pool = new Pool();
        game.pool.init();

        // 全局事件系统
        game.eventTarget = new EventTarget();

        // 初始化技能管理器
        game.skillManager = new SkillManager();
        
        // 初始化角色管理器
        game.actorManager = new ActorManager();

        // 初始化屏幕尺寸
        const canvasNode = find('Canvas');
        if (canvasNode) {
            game.winSize = canvasNode.getComponent(UITransform)!.contentSize;
        } else {
            // 默认尺寸作为备选
            game.winSize = { width: 640, height: 1136 } as Size;
        }

        // 初始化JSON数据容器
        game.jsonData = {
            actor: [],
            skill: [],
            spawnactor: []
        };

        this.createUniqueId();

        // scenes
        this.initScenes();

        // cc.log('game onload: ', game)
        // console.log('game onload: ', game)
    }

    start() {
        this.loadLoading();
    }

    initNode() {
        // 确保game对象存在并初始化node属性
        if (!window.game) {
            window.game = {} as GameGlobal;
        }
        
        game.node = {
            canvas: find('Canvas/normal')!,
            canvas_overlay: find('Canvas/overlay')!,
            canvas_overlay1: find('Canvas/overlay1')!
        };
    }

    // 各种需要存储的玩家数据
    initPlayerData() {
        // game.jsonData = {
        //     petData: this.petData.json
        // }

        game.player = new Player();
        game.player.init();
        // cc.log(game.player)
    }

    initMessageBox() {
        // let node = instantiate(this.messageBoxPrefab)
        // game.node.canvas_overlay1.addChild(node)
        // node.active = false

        // let messageBox = node.getComponent('MessageBox')
        // if (messageBox) {
        //     game.showMessage = function (msg, duration, msgRich) {
        //         messageBox.showMessage(msg, duration, msgRich)
        //     }
        // }
        // else {
        //     console.error('messageBox not found')
        // }
    }

    initAudioManager() {
        let node = instantiate(this.audioManagerPrefab);
        this.node.addChild(node);
    }

    update(dt: number) {
        if (game && game.player) {
            game.player.loop(dt);
        }
    }

    // http://docs.cocos.com/creator/manual/zh/scripting/load-assets.html
    loadLoading() {
        let node = instantiate(this.loadingPrefab);
        game.node.canvas.addChild(node);
    }

    initScenes() {
        let projectName = game.config.projectName;
        game.sceneDir = 'prefabs/scene/';

        game.scenes = {};

        game.sceneNames = {
            modeSelect: 'modeSelect',
            play: 'play',
            pause: 'pause',
            award: 'award',
            // language: 'language',
            // setting: 'setting',
            selectskill: 'selectskill',
            loading: 'loading',
            // rank: 'rank',
        };

        game.currentScene = null;
        game.prevSceneName = null;

        game.loadScene = this.loadScene;
        game.pushScene = this.pushScene;
        game.popScene = this.popScene;
    }

    createUniqueId() {
        // unique id
        function createIdObj() {
            let id = 100;

            let nextId = () => {
                id += 1;
                return id;
            };

            return { nextId: nextId };
        }

        let idObj = createIdObj();

        game.nextId = () => {
            return idObj.nextId();
        };
    }

    loadScene(name: string) {
        cc.log(`loadScene ${name}.`)
        let scene = game.scenes[name];
        if (scene) {
            scene.show();
        } else {
            let prefab = game.scenePrefabs[name];
            let node = instantiate(prefab);

            scene = node.getComponent('Scene');
            scene.sceneName = name;
            game.scenes[name] = scene;
            scene.show();
        }
    }

    pushScene(name: string) {
        // cc.log(`pushScene ${name}.`)
        let scene = game.scenes[name];
        if (scene) {
            scene.push();
        } else {
            let prefab = game.scenePrefabs[name];
            let node = instantiate(prefab);

            scene = node.getComponent('Scene');
            scene.sceneName = name;
            game.scenes[name] = scene;
            scene.push();
        }
    }

    popScene() {
        if (game.currentScene) {
            game.currentScene.pop();
        }
    }

    initShader() {
        // require("SpriteHook").init();
        // let ShaderLib = require("ShaderLib");
        // ShaderLib.addShader(require("CdxrShader"));
    }
}