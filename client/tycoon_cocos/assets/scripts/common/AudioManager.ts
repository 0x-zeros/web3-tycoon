import { _decorator, Component, AudioClip, AudioSource } from 'cc';

const { ccclass, property } = _decorator;


@ccclass('AudioManager')
export class AudioManager extends Component {

    @property({
        type: [AudioClip],
    })
    list: AudioClip[] = [];

    private clipNames: { [key: string]: string } = {};
    private clips: { [key: string]: AudioClip } = {};
    private mute_bg: boolean = false;
    private mute_effect: boolean = false;

    onLoad() {
        game.audioManager = this;

        // let clipNames = {
        //     effect_move : 'effect_move',
        //     effect_forbiddenMove : 'effect_forbiddenMove',
        //     effect_click : 'effect_click',
        //     bg : 'bg',
        //     bgPlay : 'bgPlay',
        // }

        this.clipNames = {};
        this.clips = {};

        this.list.forEach((clip) => {
            let name = clip.name;

            this.clips[name] = clip;
            this.clipNames[name] = name;
        });
    }

    start() {
        // this.mute = game.player.setting.mute
        this.mute_bg = game.player.setting.mute_bg;
        this.mute_effect = game.player.setting.mute_effect;

        this.playBg('bg');
    }

    playBg(clipName: string) {
        if (this.mute_bg) {
            return;
        }

        //resources.load  zero 2025-08-25
        // cc.loader.loadRes(bgmUrl, AudioClip, function (err, clip) {
        //     var audioID = cc.audioEngine.playMusic(clip, false);
        // });

        let clip = this.clips[clipName];
        if (clip) {
            // In Cocos Creator 3.x, we use AudioSource component instead of cc.audioEngine
            let audioSource = this.node.getComponent(AudioSource);
            if (!audioSource) {
                audioSource = this.node.addComponent(AudioSource);
            }
            audioSource.clip = clip;
            audioSource.loop = true;
            audioSource.play();
        }
    }

    playEffect(clipName: string) {
        if (this.mute_effect) {
            return;
        }

        let clip = this.clips[clipName];
        if (clip) {
            // In Cocos Creator 3.x, we use AudioSource component for effects too
            let audioSource = this.node.getComponent(AudioSource);
            if (!audioSource) {
                audioSource = this.node.addComponent(AudioSource);
            }
            audioSource.clip = clip;
            audioSource.loop = false;
            audioSource.playOneShot(clip);
        }
    }

    // toggleMute() {
    //     this.setMute(!this.mute)
    // },
    //
    // setMute(isMute) {
    //     if(isMute !== this.mute) {
    //         this.mute = isMute
    //
    //         if(this.mute) {
    //             cc.audioEngine.stopAll()
    //         }
    //
    //         game.player.setting.mute = this.mute
    //     }
    // },

    toggleMusicMute() {
        this.setMusicMute(!this.mute_bg);
    }

    setMusicMute(isMute: boolean) {
        if (isMute !== this.mute_bg) {
            this.mute_bg = isMute;

            if (this.mute_bg) {
                let audioSource = this.node.getComponent(AudioSource);
                if (audioSource) {
                    audioSource.stop();
                }
            }

            game.player.setting.mute_bg = this.mute_bg;
        }
    }

    toggleEffectMute() {
        this.setEffectMute(!this.mute_effect);
    }

    setEffectMute(isMute: boolean) {
        if (isMute !== this.mute_effect) {
            this.mute_effect = isMute;

            if (this.mute_effect) {
                // In v3.x, we need to manage effect audio sources separately
                // This is a simplified approach - you might want to maintain a list of effect audio sources
                let audioSource = this.node.getComponent(AudioSource);
                if (audioSource && !audioSource.loop) {
                    audioSource.stop();
                }
            }

            game.player.setting.mute_effect = this.mute_effect;
        }
    }
}