import { _decorator, Node } from 'cc';
import { _ } from '../common/lodash-compat';
import { Scene } from './Scene';

const { ccclass, property } = _decorator;

// declare global {
//     var game: any;
// }

@ccclass('ModeSelect')
export class ModeSelect extends Scene {

    @property(Node)
    btnDanren: Node = null!;

    @property(Node)
    btnZudui: Node = null!;

    @property(Node)
    btnPaihangbang: Node = null!;

    // onLoad () {
    //
    // },
    //
    // onDestroy() {
    //
    // },

    onEnable() {
        this.btnDanren.on(Node.EventType.TOUCH_END, this.play, this);
        this.btnZudui.on(Node.EventType.TOUCH_END, this.playTeam, this);
        this.btnPaihangbang.on(Node.EventType.TOUCH_END, this.play, this);

        // this.btnDanren.on(Node.EventType.MOUSE_UP, this.play, this);
        // this.btnZudui.on(Node.EventType.MOUSE_UP, this.playTeam, this);
        // this.btnJingji.on(Node.EventType.MOUSE_UP, this.jingji, this);
        // this.btnPaihangbang.on(Node.EventType.MOUSE_UP, this.openRank, this);
    }

    onDisable() {
        this.btnDanren.off(Node.EventType.TOUCH_END, this.play, this);
        this.btnZudui.off(Node.EventType.TOUCH_END, this.playTeam, this);
        this.btnPaihangbang.off(Node.EventType.TOUCH_END, this.play, this);
    }

    play() {
        // console.log("btnDanren clicked")

        game.audioManager.playEffect('click');
        game.loadScene(game.sceneNames.play);
    }

    playTeam() {
        game.audioManager.playEffect('click');
        //ui.createMessageBox('unavailale', 'normal', game.currentScene.tweenGroup, 26);
    }

    // openRank() {
    //     game.audioManager.playEffect('click');
    //     game.pushScene(game.sceneNames.rank);
    // }
}