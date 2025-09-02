import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

import { initUISystem, initializeGameUI } from "./ui/index";
import { UIManager } from "./ui/core/UIManager";



@ccclass('TestNewUI')
export class TestNewUI extends Component {
    async start() {


        // 基础初始化
        initUISystem({
            debug: true,
            enableCache: true,
            designResolution: { width: 1136, height: 640 }
        });
        
        // 完整初始化（推荐）
        await initializeGameUI(); // 自动完成包加载、UI注册、界面显示

        // 显示UI
        await UIManager.instance.showUI("ModeSelect");
    }

    update(deltaTime: number) {
        
    }
}

