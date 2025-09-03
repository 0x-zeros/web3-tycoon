import { _decorator, Component, Node, Prefab, instantiate, log, resources, EventTouch } from 'cc';
import { _ } from './lodash-compat';

const { ccclass, property } = _decorator;


@ccclass('GameList')
export class GameList extends Component {
    @property([Node])
    btnList: Node[] = [];

    private gamesDir: string = '';

    onLoad() {
        this.gamesDir = 'prefabs/games/';

        _.each(this.btnList, (btn) => {
            btn.on(Node.EventType.TOUCH_END, this.startGame, this);
        });
    }

    startGame(event: EventTouch) {
        const btn = event.getCurrentTarget() as Node;
        const url = this.gamesDir + btn.name;

        log(`startGame ${url}`);

        resources.load(url, Prefab, (err, prefab) => {
            if (err) {
                console.log(err);
            } else {
                const node = instantiate(prefab as Prefab);
                game.node.canvas.addChild(node);
            }
        });
    }
}

export default GameList;