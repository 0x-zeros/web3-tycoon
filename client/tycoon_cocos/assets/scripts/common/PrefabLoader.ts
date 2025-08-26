import { _decorator, Component, Node, Prefab, instantiate } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PrefabLoader')
export class PrefabLoader extends Component {
    @property(Prefab)
    prefab: Prefab = null!;

    @property(Node)
    parentRoot: Node = null!;

    onLoad() {
        if (this.prefab && this.parentRoot) {
            const node = instantiate(this.prefab);
            this.parentRoot.addChild(node);
        }
    }
}

export default PrefabLoader;