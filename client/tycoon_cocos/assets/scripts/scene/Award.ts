import { _decorator, Label, Node } from 'cc';
import { _ } from '../common/lodash-compat';
import { LabelLocalized } from '../i18n/LabelLocalized';
import { Scene } from './Scene';

const { ccclass, property } = _decorator;


@ccclass('Award')
export class Award extends Scene {

    @property(Label)
    currentScore: Label = null!;

    @property(Label)
    maxScore: Label = null!;

    @property(Node)
    btnReplay: Node = null!; //btnClose

    @property(Node)
    btnHome: Node = null!;

    @property(Node)
    btnRank: Node = null!;

    @property(Node)
    btnShare: Node = null!;

    // onLoad () {
    //
    // },
    //
    // onDestroy() {
    //
    // },

    onEnable() {
        this.btnReplay.on(Node.EventType.TOUCH_END, this.replay, this);
        this.btnHome.on(Node.EventType.TOUCH_END, this.goHome, this);
        this.btnRank.on(Node.EventType.TOUCH_END, this.openRank, this);
        this.btnShare.on(Node.EventType.TOUCH_END, this.share, this);

        this.currentScore.string = game.player.getScore().toString();
        this.maxScore.string = game.player.getHighestScore().toString();
    }

    onDisable() {
        this.btnReplay.off(Node.EventType.TOUCH_END, this.replay, this);
        this.btnHome.off(Node.EventType.TOUCH_END, this.goHome, this);
        this.btnRank.off(Node.EventType.TOUCH_END, this.openRank, this);
        this.btnShare.off(Node.EventType.TOUCH_END, this.share, this);
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

    openRank() {
        game.audioManager.playEffect('click');
        game.pushScene(game.sceneNames.rank);
    }

    share() {
        //todo
    }
}