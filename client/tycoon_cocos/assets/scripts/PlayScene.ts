import { _decorator, Component, Node, Prefab, instantiate, log, v3, Size } from 'cc';
import { resources } from 'cc';
// 使用自定义的 lodash-compat 库
import { _ } from './common/lodash-compat';
// import {BigNumber} from 'bignumber.min';
import { utils } from './common/utils';

const { ccclass, property } = _decorator;


@ccclass('PlayScene')
export class PlayScene extends Component {

    @property(Node)
    cityNode: Node | null = null;

    @property(Node)
    mainUINode: Node | null = null;

    @property(Node)
    coinFlyTarget: Node | null = null;

    @property(Prefab)
    treasureBoxPrefab: Prefab | null = null;

    @property(Prefab)
    coinRainPrefab: Prefab | null = null;

    playArea: Node | null = null;

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        game.playScene = this;

        this.loadCity();
        this.loadMainUI();

        // let tmpPos = this.coinFlyTarget.parent.convertToWorldSpaceAR(this.coinFlyTarget.position)
        // game.coinFlyTarget = this.playArea.convertToNodeSpaceAR(tmpPos)
    }

    // start () {
    // },

    loadCity() {
        resources.load('prefabs/play/city', Prefab, (err, prefab) => {
            if (err) {
                console.log(err);
            } else {
                // log('city prefab loaded.')
                let node = instantiate(prefab);
                this.cityNode?.addChild(node);
            }
        });
    }

    loadMainUI() {
        resources.load('prefabs/UI/main', Prefab, (err, prefab) => {
            if (err) {
                console.log(err);
            } else {
                // log('main UI prefab loaded.')
                let node = instantiate(prefab);
                this.mainUINode?.addChild(node);

                this.mainUINode?.removeFromParent();
                game.node.canvas_overlay.addChild(this.mainUINode);
            }
        });
    }

    // update (dt) {
    // },

    dropTreasureBox() {
        // log('dropTreasureBox')

        let interval = game.config.treasureBox_interval;
        // 重复次数
        let repeat = Math.floor(game.config.treasureBox_last_second / game.config.treasureBox_interval);
        // 开始延时
        let delay = 0;

        this.schedule(() => {
            let minX = 100;
            let maxX = game.winSize.width - minX;
            let y = game.winSize.height + 75;
            let pos = v3(_.random(minX, maxX), y, 0);

            this.createtreasureBox(pos);
        }, interval, repeat, delay);
    }

    dropCoinRain() {
        // log('dropCoinRain')

        let interval = game.config.coin_rain_interval;
        // 重复次数
        let repeat = Math.floor(game.config.coin_rain_last_second / game.config.coin_rain_interval);
        // 开始延时
        let delay = 0;

        this.schedule(() => {
            let minX = 100;
            let maxX = game.winSize.width - minX;
            let y = game.winSize.height + 75;
            let pos = v3(_.random(minX, maxX), y, 0);

            this.createCoinRain(pos);
        }, interval, repeat, delay);
    }

    createtreasureBox(position: any) {
        // let go = instantiate(this.treasureBoxPrefab)
        let go = game.pool.get(this.treasureBoxPrefab);

        this.playArea?.addChild(go);
        go.setPosition(position);
    }

    createCoinRain(position: any) {
        // let go = instantiate(this.treasureBoxPrefab)
        let go = game.pool.get(this.coinRainPrefab);

        //this.playArea.addChild(go)
        this.cityNode?.addChild(go);
        go.setPosition(position);
    }
}