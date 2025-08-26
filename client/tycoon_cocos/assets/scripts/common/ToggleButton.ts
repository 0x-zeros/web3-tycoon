import { _decorator, Node, log } from 'cc';
import { ToggleSprite } from './ToggleSprite';

const { ccclass } = _decorator;

@ccclass('ToggleButton')
export class ToggleButton extends ToggleSprite {

    // properties: {
    //     sprite: Sprite,
    //     onSpriteFrame: SpriteFrame,
    //     offSpriteFrame: SpriteFrame,
    //     selecteOn: true,
    // },
    //
    // onLoad() {
    //     this.updateState()
    // },
    //
    // setOn(isOn) {
    //     // log('ToggleSprite: ', isOn)
    //     this.selecteOn = isOn
    //     this.updateState()
    // },
    //
    // updateState() {
    //     if(this.selecteOn) {
    //         this.sprite.spriteFrame = this.onSpriteFrame
    //     }
    //     else {
    //         this.sprite.spriteFrame = this.offSpriteFrame
    //     }
    //
    //     // log('ToggleSprite updateState: ', this.selecteOn, this.sprite.spriteFrame.name)
    // },

    onEnable() {
        this.node.on(Node.EventType.TOUCH_START, this.onDown, this);

        this.node.on(Node.EventType.TOUCH_CANCEL, this.onUp, this);
        this.node.on(Node.EventType.TOUCH_END, this.onUp, this);

        this.setOn(true);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onDown, this);

        this.node.off(Node.EventType.TOUCH_CANCEL, this.onUp, this);
        this.node.off(Node.EventType.TOUCH_END, this.onUp, this);
    }

    onDown() {
        log('onDown');
        this.setOn(false);
    }

    onUp() {
        log('onUp');
        this.setOn(true);
    }
}