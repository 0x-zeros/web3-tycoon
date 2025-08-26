import { _decorator, Node } from 'cc';
import { _ } from '../common/lodash-compat';
import { LabelLocalized } from '../i18n/LabelLocalized';
import { Scene } from './Scene';

const { ccclass, property } = _decorator;


@ccclass('Pause')
export class Pause extends Scene {

    //btnClose: Node = null!;

    @property(Node)
    btnContinue: Node = null!;

    @property(Node)
    btnHome: Node = null!;

    @property(Node)
    btnReplay: Node = null!;

    // onLoad () {
    //
    // },
    //
    // onDestroy() {
    //
    // },

    onEnable() {
        //this.btnClose.on(Node.EventType.TOUCH_END, this.close, this)
        this.btnContinue.on(Node.EventType.TOUCH_END, this.close, this);

        this.btnHome.on(Node.EventType.TOUCH_END, this.goHome, this);
        this.btnReplay.on(Node.EventType.TOUCH_END, this.replay, this);

        //game.currentScene.stopTime();
    }

    onDisable() {
        //this.btnClose.off(Node.EventType.TOUCH_END, this.close, this)
        this.btnContinue.off(Node.EventType.TOUCH_END, this.close, this);

        this.btnHome.off(Node.EventType.TOUCH_END, this.goHome, this);
        this.btnReplay.off(Node.EventType.TOUCH_END, this.replay, this);

        //game.currentScene.resumeTime();
    }

    close() {
        game.audioManager.playEffect('click');
        game.popScene();
    }

    goHome() {
        game.audioManager.playEffect('click');
        game.loadScene(game.sceneNames.modeSelect);
    }

    replay() {
        game.audioManager.playEffect('click');
        game.popScene();

        if (game.playground) {
            game.playground.replay();
        }
    }
}