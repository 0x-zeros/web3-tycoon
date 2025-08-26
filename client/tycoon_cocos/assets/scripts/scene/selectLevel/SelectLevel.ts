import { _decorator, Node, Prefab, instantiate, v3 } from 'cc';
import { _ } from '../../common/lodash-compat';
import { Scene } from '../Scene';

const { ccclass, property } = _decorator;

declare global {
    var game: any;
}

@ccclass('SelectLevel')
export class SelectLevel extends Scene {

    @property(Node)
    maskNode: Node = null!;

    @property(Node)
    content: Node = null!;

    @property(Prefab)
    btnLevelPrefab: Prefab = null!;

    @property(Node)
    btnSetting: Node = null!;

    @property(Node)
    btnVideo: Node = null!;

    // Private properties
    private btnList: any[] = [];

    onLoad() {
        this.btnSetting.on(Node.EventType.TOUCH_END, this.openSetting, this);
        this.btnVideo.on(Node.EventType.TOUCH_END, this.videoAward, this);

        this.createLevelBtns();
    }

    onDestroy() {
        this.btnSetting.off(Node.EventType.TOUCH_END, this.openSetting, this);
        this.btnVideo.off(Node.EventType.TOUCH_END, this.videoAward, this);
    }

    onEnable() {
        //http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
        //onEnable: 倘若节点第一次被创建且 enabled 为 true，则会在 onLoad 之后，start 之前被调用。

        //上面的顺序好像不靠谱, 去掉下面调用的话, createLevelBtns()的list并未刷新(如果LevelButton的init里不调用自己的刷新的话)

        this.refreshLevelBtn();
    }

    calcPositon(idx: number, column: number, row: number, width: number, height: number) {

        let x = Math.floor(idx % column);
        let y = Math.floor(idx / column);

        let posX = (x + 0.5) * width;
        let posY = -(y + 0.5) * height;

        // console.log('calcPositon', idx, x, y, posX, posY)
        return v3(posX, posY, 0);
    }

    createLevelBtns() {
        this.btnList = [];
        let column = game.config.selectLevel.column;
        let row = game.config.selectLevel.row;
        let width = this.maskNode.getComponent('UITransform')?.width || this.maskNode['width'] || 0;
        let height = this.maskNode.getComponent('UITransform')?.height || this.maskNode['height'] || 0;

        let totalLevel = game.player.getTotalLevel();
        for (let i = 0; i < totalLevel; i++) {
            let node = instantiate(this.btnLevelPrefab);
            this.content.addChild(node);

            let position = this.calcPositon(i, column, row, width / column, height / row);
            node.setPosition(position.x, position.y);

            let levelButton = node.getComponent('LevelButton');
            levelButton.init(i + 1);
            this.btnList.push(levelButton);
        }

        let totalRow = Math.floor(totalLevel / column);
        if (totalLevel > (totalRow * column)) {
            totalRow += 1;
        }

        let totalHeight = totalRow * (height / row);
        const contentTransform = this.content.getComponent('UITransform');
        if (contentTransform) {
            contentTransform.height = totalHeight;
        } else {
            // Fallback for legacy property access
            this.content['height'] = totalHeight;
        }
    }

    refreshLevelBtn() {
        if (this.btnList) {
            _.each(this.btnList, (btn) => {
                btn.updateState();
            });
        }
    }

    openSetting() {
        //console.log('openSetting')
        game.audioManager.playEffect('click');
        game.pushScene(game.sceneNames.setting);//打开设置
    }

    videoAward() {
        //console.log('videoAward')
        game.pushScene(game.sceneNames.message);
    }

    // update() {
    // }
}