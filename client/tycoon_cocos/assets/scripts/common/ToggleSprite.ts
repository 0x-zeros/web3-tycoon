import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ToggleSprite')
export class ToggleSprite extends Component {

    @property(Sprite)
    sprite: Sprite | null = null;

    @property(SpriteFrame)
    onSpriteFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    offSpriteFrame: SpriteFrame | null = null;

    @property
    selecteOn: boolean = true;

    onLoad() {
        this.updateState();
    }

    setOn(isOn: boolean) {
        // log('ToggleSprite: ', isOn)
        this.selecteOn = isOn;
        this.updateState();
    }

    updateState() {
        if (this.sprite) {
            if (this.selecteOn) {
                this.sprite.spriteFrame = this.onSpriteFrame;
            } else {
                this.sprite.spriteFrame = this.offSpriteFrame;
            }
        }

        // log('ToggleSprite updateState: ', this.selecteOn, this.sprite.spriteFrame.name)
    }
}