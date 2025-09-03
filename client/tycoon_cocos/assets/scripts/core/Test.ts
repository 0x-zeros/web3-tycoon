import { _decorator, Component, Node } from 'cc';
import { UIManager } from '../ui/core/UIManager';
const { ccclass, property } = _decorator;

@ccclass('Test')
export class Test extends Component {
    start() {
        UIManager.initializeGameUI();
    }

    update(deltaTime: number) {
        
    }
}

