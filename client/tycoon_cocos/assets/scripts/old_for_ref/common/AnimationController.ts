import { _decorator, Component, Animation, log } from 'cc';

const { ccclass, property } = _decorator;


@ccclass('AnimationController')
export class AnimationController extends Component {
    @property(Boolean)
    playOnEnable: boolean = true;

    @property([String])
    param: string[] = [];

    private animCtrl: Animation = null!;

    onLoad() {
        this.animCtrl = this.getComponent(Animation)!;
    }

    onEnable() {
        if (this.playOnEnable && this.animCtrl) {
            if (this.param.length > 0 && this.param[0] === 'selectLevel') {
                // 控制moveToLeft or moveToRight
                let prevSceneName = game.prevSceneName;
                if (prevSceneName === 'play') {
                    this.animCtrl.play('moveToLeft');
                    // log('moveToLeft')
                } else {
                    this.animCtrl.play('moveToRight');
                    // log('moveToRight')
                }
            } else {
                this.animCtrl.play();
            }
        }
    }
}

export default AnimationController;