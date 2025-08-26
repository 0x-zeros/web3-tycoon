import { _decorator, Component, SpriteAtlas, Animation, Sprite, AnimationClip, log } from 'cc';

const { ccclass, property } = _decorator;

declare global {
    var game: any;
}

@ccclass('AnimatedSprite')
export class AnimatedSprite extends Component {

    @property({
        type: SpriteAtlas,
        tooltip: '不能为空, 内含的帧按名字排序',
    })
    atlas: SpriteAtlas | null = null;

    @property
    loop: boolean = true;

    @property
    speed: number = 1;

    @property({
        tooltip: '动画的帧速率',
    })
    sample: number = 15;

    @property
    playOnLoad: boolean = true;

    @property
    autoDestroy: boolean = false;

    @property
    autoActive: boolean = false;

    private animation: Animation | null = null;
    private cb: (() => void) | null = null;

    onLoad() {
        this._initAni();
        // if(this.playOnLoad) {
        //     this.play()
        // }
    }

    setOnFinishedCb(cb: () => void) {
        this.cb = cb;
    }

    play() {
        if (this.animation) {
            this.node.active = true;
            this.animation.play('default');
            let aniState = this.animation.getState('default')!;
            aniState.speed = this.speed;
            // aniState.wrapMode = WrapMode.Loop;

            // log(this.animation, aniState, aniState.wrapMode)
        }
    }

    onEnable() {
        var animation = this.animation;
        if (animation) {
            // animation.on('play',      this.onPlay,        this);
            // animation.on('stop',      this.onStop,        this);
            // animation.on('lastframe', this.onLastFrame,   this);
            animation.on(Animation.EventType.FINISHED, this.onFinished, this);
            // animation.on('pause',     this.onPause,       this);
            // animation.on('resume',    this.onResume,      this);
        }

        if (this.playOnLoad) {
            this.play();
        }
    }

    onDisable() {
        var animation = this.animation;
        if (animation) {
            // animation.off('play',      this.onPlay,        this);
            // animation.off('stop',      this.onStop,        this);
            // animation.off('lastframe', this.onLastFrame,   this);
            animation.off(Animation.EventType.FINISHED, this.onFinished, this);
            // animation.off('pause',     this.onPause,       this);
            // animation.off('resume',    this.onResume,      this);
        }

        this.cb = null;
    }

    onFinished() {
        if (this.cb) {
            this.cb();
        }

        this.cb = null;

        if (this.autoActive) {
            this.node.active = false;
        }

        if (this.autoDestroy) {
            // this.node.destroy()
            game.pool.put(this.node);
        }
    }

    //as private method
    _initAni() {
        // let self = this
        let node = this.node;

        if (!this.atlas) {
            console.warn('atlas is null.');
            return;
        }

        let frames = this.atlas.getSpriteFrames();
        let anim = node.addComponent(Animation);
        node.addComponent(Sprite);

        // log(frames, this.frameTime)
        let clip = AnimationClip.createWithSpriteFrames(frames, this.sample);
        if (this.loop) {
            clip.wrapMode = AnimationClip.WrapMode.Loop;
        } else {
            clip.wrapMode = AnimationClip.WrapMode.Normal;
        }
        // clip.name = 'default'
        anim.addClip(clip, 'default');
        // anim.defaultClip = clip

        this.animation = anim;
    }
}