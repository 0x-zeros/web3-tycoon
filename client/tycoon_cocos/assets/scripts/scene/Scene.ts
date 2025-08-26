import { _decorator, Component, Label } from 'cc';
import { utils } from '../common/utils';

const { ccclass, property } = _decorator;


@ccclass('Scene')
export class Scene extends Component {
    sceneName: string = '';
    additiveScene: Scene | null = null;

    show() {
        this.node.active = true;

        if (game.currentScene) {
            game.prevSceneName = game.currentScene.sceneName;
            game.currentScene.hide();
            game.currentScene = null;
        }

        game.currentScene = this;

        if (!this.node.parent) {
            game.node.canvas.addChild(this.node);
        }
    }

    hide() {
        this.node.active = false;

        if (this.additiveScene) {
            this.additiveScene.pop();
        }
    }

    push() {
        this.node.active = true;

        if (this.node.parent) {
            this.node.parent.removeChild(this.node);
        }

        game.currentScene.node.addChild(this.node);
        game.currentScene.additiveScene = this;
    }

    pop() {
        const scene = game.currentScene.additiveScene;
        if (scene) {
            game.currentScene.additiveScene = null;
            scene.node.active = false;

            // removeFromParent
            if (scene.node.parent) {
                scene.node.parent.removeChild(scene.node);
            }
        }
    }

    // 其他好几个scene在用的
    updateLevelBestTime(levelNum: number, label: Label) {
        const num = game.player.getLevelScore(levelNum);
        let numStr: string;
        if (num) {
            numStr = utils.formatTimeString(num);
        } else {
            numStr = utils.uncompleteTimeString;
        }

        label.string = numStr;
    }

    updateLevelCurrentTime(label: Label) {
        const usedTime = game.player.currentLevelUsedTime;
        const ms = Math.floor(usedTime);
        const str = utils.formatTimeString(ms);
        label.string = str;
    }
}

export default Scene;