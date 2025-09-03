import { instantiate, NodePool, Prefab, Node } from 'cc';
// import { _ } from './lodash-compat';
// import { utils } from './utils';

export default class Pool {
    pools: { [key: string]: NodePool } = {};

    init() {
        this.pools = {};
    }

    // data_id === idx now
    get(prefab: Prefab): Node | null {
        if (!prefab)
            return null;

        let key = prefab._uuid;
        let pool = this.pools[key];
        if (!pool) {
            pool = new NodePool();
            this.pools[key] = pool;
        }

        let go = pool.get();
        if (!go) {
            go = instantiate(prefab);
            (go as any).myPrefabPoolKey = key;
            // pool.put(go)//等用完了才能放进去
        }

        // cc.log(_.keys(this.pools))
        return go;
    }

    put(go: Node) {
        if (!go)
            return;

        if (!(go as any).myPrefabPoolKey) {
            go.destroy();
        }

        let pool = this.pools[(go as any).myPrefabPoolKey];
        if (pool) {
            pool.put(go);
        } else {
            go.destroy();
        }
    }
}