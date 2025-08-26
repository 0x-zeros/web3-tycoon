import { _decorator, Node, Label, log } from 'cc';
import { _ } from '../../common/lodash-compat';
import { LabelLocalized } from '../../i18n/LabelLocalized';
import Scene from '../Scene';
import Playground from './Playground';

const { ccclass, property } = _decorator;


@ccclass('Play')
export class Play extends Scene {
    @property(Node)
    btnPause: Node = null!;

    @property(Label)
    scoreLabel: Label = null!;

    @property(Label)
    roundNumLabel: Label = null!;

    @property(Playground)
    playground: Playground = null!;

    @property(Node)
    btnVideo: Node = null!;

    @property(Node)
    bossEffect: Node = null!;

    onEnable() {
        this.btnPause.on(Node.EventType.TOUCH_END, this.pause, this);
        this.btnVideo.on(Node.EventType.TOUCH_END, this.viewVideo, this);

        if (game.playground) {
            this.playground.replay();
        } else {
            this.playground.init();
        }
    }

    onDisable() {
        this.btnPause.off(Node.EventType.TOUCH_END, this.pause, this);
        this.btnVideo.off(Node.EventType.TOUCH_END, this.viewVideo, this);
    }

    start() {
        this.scoreLabel.string = '0';
        game.eventTarget.on('setScore', (score: number) => {
            this.scoreLabel.string = score.toString();
        });

        this.roundNumLabel.string = `第1层`;
        game.eventTarget.on('nextRound', (roundNum: number) => {
            this.roundNumLabel.string = `第${roundNum}层`;
        });

        game.effectManager.bossEffect = this.bossEffect;

        // btnVideo
        game.effectManager.flauntEffect(this.btnVideo);

        game.eventTarget.on('setSkill', (idx: number, s: any) => {
            const num = game.role.getSkillSetRemaindAwardCountTotal();
            if (num < 1) {
                this.btnVideo.active = false;
            } else {
                this.btnVideo.active = true;
            }
        });
    }

    pause() {
        log('pause play');
        game.audioManager.playEffect('click');
        game.pushScene(game.sceneNames.pause);
    }

    viewVideo() {
        game.pushScene(game.sceneNames.selectskill);

        // let awardFunc = () => {
        //     game.pushScene(game.sceneNames.selectskill);
        // };
        //
        // let closeFunc = () => {
        //     //do nothing
        // };
        //
        // wx_helper.setVideoAdCb(awardFunc, closeFunc);
        // wx_helper.showVideoAd();
    }
}

export default Play;