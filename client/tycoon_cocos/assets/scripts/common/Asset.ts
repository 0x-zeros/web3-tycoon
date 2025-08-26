// 预载资源等

import { Prefab, resources, log } from 'cc';
// import { _ } from './lodash-compat';
// import { utils } from './utils';


// 使用方式:
// load(entryName)
// setCompleteCallback(entryName, completeCallback)
// remove(entryName)

// completeCallback(prefab)

interface AssetEntry {
    name: string;
    url: string;
    type: typeof Prefab;
    prefab?: Prefab;
    completeCallback?: Function | null;
}

export default class Asset {
    list: { [key: string]: AssetEntry } = {};

    init() {
        let projectName = game.config.projectName;
        // 常用资源url //as private
        let list: { [key: string]: AssetEntry } = {};
        list.playScene = { name: 'playScene', url: `${projectName}/prefabs/scene/play`, type: Prefab };

        // private
        this.list = list;
    }

    load(entryName: string, completeCallback: Function | null = null) {
        let data = this.list[entryName];
        if (data) {
            if (!data.prefab) {
                data.completeCallback = completeCallback;
                this.loadEntry(data);
            } else {
                // 已经load
                if (completeCallback) {
                    completeCallback(data.prefab);
                }
            }
        } else {
            console.log(`${entryName} not found.`);
        }
    }

    // private
    loadEntry(data: AssetEntry) {
        resources.load(data.url, data.type, (err, prefab) => {
            if (err) {
                console.log(err);
            } else {
                log(`${data.name} load OK`);
                data.prefab = prefab as Prefab;
                if (data.completeCallback) {
                    data.completeCallback(data.prefab);
                    data.completeCallback = null; // 调用以后就set为null
                }
            }
        });
    }

    setCompleteCallback(entryName: string, completeCallback: Function) {
        let data = this.list[entryName];
        if (data) {
            if (!data.prefab) {
                data.completeCallback = completeCallback;
            } else {
                // 已经load
                if (completeCallback) {
                    completeCallback(data.prefab);
                }
            }
        } else {
            log(`${entryName} not found.`);
        }
    }

    remove(entryName: string) {
        this.list[entryName] = null!;
    }
}