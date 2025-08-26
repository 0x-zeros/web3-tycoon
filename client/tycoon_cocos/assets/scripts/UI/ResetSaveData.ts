import { _decorator, Component, Node, Toggle, Event } from 'cc';

const { ccclass, property } = _decorator;

declare global {
    var game: any;
}

@ccclass('ResetSaveData')
export class ResetSaveData extends Component {

    @property(Toggle)
    toggle: Toggle | null = null;

    @property(Node)
    closeBtn: Node | null = null;

    @property(Node)
    confirmBtn: Node | null = null;

    onEnable() {
        this.toggle?.uncheck();

        this.closeBtn?.on(Node.EventType.TOUCH_END, this.close, this);
        // this.node.on('touchstart', this.onTouchStart, this);

        this.confirmBtn?.on(Node.EventType.TOUCH_END, this.clearData, this);
    }

    onDisable() {
        this.closeBtn?.off(Node.EventType.TOUCH_END, this.close, this);
        // this.node.off('touchstart', this.onTouchStart, this);

        this.confirmBtn?.off(Node.EventType.TOUCH_END, this.clearData, this);
    }

    close() {
        //close
        this.node.active = false;
        // this.node.destroy()
    }

    clearData(event: Event) {
        if (this.toggle?.isChecked) {
            game.player.clearSaveData();
        }

        // event.stopPropagation()
        // event.stopPropagationImmediate()
        this.node.active = false;
    }
}