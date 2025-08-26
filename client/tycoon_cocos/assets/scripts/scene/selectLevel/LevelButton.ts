import { _decorator, Component, Node, Label } from 'cc';
import { _ } from '../../common/lodash-compat';

const { ccclass, property } = _decorator;

declare global {
    var game: any;
}

@ccclass('LevelButton')
export class LevelButton extends Component {

    @property(Node)
    defaultSprite: Node = null!;

    @property(Node)
    toggleSprite: Node = null!;

    @property(Node)
    lock: Node = null!;

    @property(Label)
    levelNumLabel: Label = null!;

    // Private properties
    private levelNum: number = 0;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this.click, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.click, this);
    }

    init(levelNum: number) {
        this.levelNum = levelNum;
        this.levelNumLabel.string = levelNum.toString();

        this.updateState();
    }

    updateState() {
        let unlockLevelNum = game.player.getUnlockLevelNum();
        // console.log('unlockLevelNum', unlockLevelNum)
        if (this.levelNum > unlockLevelNum) {
            // console.log(this.levelNum, 'locked', unlockLevelNum);
            //未解锁
            this.defaultSprite.active = true;
            this.lock.active = true;

            this.toggleSprite.active = false;
        }
        else {
            //已解锁
            // console.log(this.levelNum, 'unlock', unlockLevelNum);
            this.defaultSprite.active = false;
            this.lock.active = false;

            this.toggleSprite.active = true;
        }
    }

    click() {
        let unlockLevelNum = game.player.getUnlockLevelNum();

        //已经解锁的或者debug模式的所有关卡
        if (game.config.debug.unlockAllLevel === 'yes'
            || this.levelNum <= unlockLevelNum) {

            // if (game.player.selectLevelNum !== this.levelNum) {
            game.player.selectLevelNum = this.levelNum;
            // }

            game.pushScene(game.sceneNames.levelInfo);
            // game.pushScene(game.sceneNames.play);
        }
        else {
            // game.pushScene(game.sceneNames.message);
        }
    }
}