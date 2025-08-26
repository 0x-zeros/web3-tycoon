import { _decorator, Node } from 'cc';
import { _ } from '../common/lodash-compat';
import { LabelLocalized } from '../i18n/LabelLocalized';
import { Scene } from './Scene';

const { ccclass, property } = _decorator;

declare global {
    var game: any;
}

@ccclass('Setting')
export class Setting extends Scene {

    @property(Node)
    btnClose: Node = null!;

    @property(Node)
    btnLanguage: Node = null!;

    @property(Node)
    btnMusic: Node = null!;

    @property(Node)
    btnEffect: Node = null!;

    // Private properties
    private toggleSprite_music: any = null;
    private toggleSprite_effect: any = null;

    // onLoad () {
    //
    // },
    //
    // onDestroy() {
    //
    // },

    onEnable() {
        this.btnClose.on(Node.EventType.TOUCH_END, this.close, this);
        this.btnLanguage.on(Node.EventType.TOUCH_END, this.openLanguageSetting, this);

        this.initToggleMusicBtn();
        this.initToggleEffectBtn();
    }

    onDisable() {
        this.btnClose.off(Node.EventType.TOUCH_END, this.close, this);
        this.btnLanguage.off(Node.EventType.TOUCH_END, this.openLanguageSetting, this);

        this.btnMusic.off(Node.EventType.TOUCH_END, this.toggleMusicMute, this);
        this.btnEffect.off(Node.EventType.TOUCH_END, this.toggleEffectMute, this);
    }

    // start() {
    //   this.initToggleMusicBtn()
    //   this.initToggleEffectBtn()
    // },

    initToggleMusicBtn() {

        let toggleSprite = this.btnMusic.getComponent('ToggleSprite');
        toggleSprite.setOn(!game.audioManager.mute_bg);
        this.toggleSprite_music = toggleSprite;

        this.btnMusic.on(Node.EventType.TOUCH_END, this.toggleMusicMute, this);
    }

    initToggleEffectBtn() {

        let toggleSprite = this.btnEffect.getComponent('ToggleSprite');
        toggleSprite.setOn(!game.audioManager.mute_effect);
        this.toggleSprite_effect = toggleSprite;

        this.btnEffect.on(Node.EventType.TOUCH_END, this.toggleEffectMute, this);
    }

    close() {
        game.audioManager.playEffect('click');
        game.popScene();
    }

    openLanguageSetting() {
        game.popScene();
        game.audioManager.playEffect('click');
        game.pushScene(game.sceneNames.language);
    }

    toggleMusicMute() {
        game.audioManager.toggleMusicMute();
        this.toggleSprite_music.setOn(!game.audioManager.mute_bg);
    }

    toggleEffectMute() {
        game.audioManager.toggleEffectMute();
        this.toggleSprite_effect.setOn(!game.audioManager.mute_effect);
    }
}