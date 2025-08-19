import { _decorator, Component, Node, Label, Color } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Tile')
export class Tile extends Component {
    @property(Label)
    valueLabel: Label = null!;

    private _value: number = 0;

    get value(): number {
        return this._value;
    }

    set value(val: number) {
        this._value = val;
        this.updateDisplay();
    }

    start() {
        this.updateDisplay();
    }

    private updateDisplay() {
        if (!this.valueLabel) return;
        
        this.valueLabel.string = this._value.toString();
        
        // Set colors based on value
        const colors = {
            2: new Color(238, 228, 218),
            4: new Color(237, 224, 200),
            8: new Color(242, 177, 121),
            16: new Color(245, 149, 99),
            32: new Color(246, 124, 95),
            64: new Color(246, 94, 59),
            128: new Color(237, 207, 114),
            256: new Color(237, 204, 97),
            512: new Color(237, 200, 80),
            1024: new Color(237, 197, 63),
            2048: new Color(237, 194, 46),
        };

        const textColors = {
            2: new Color(119, 110, 101),
            4: new Color(119, 110, 101),
        };

        // Set background color
        const bgColor = colors[this._value as keyof typeof colors] || new Color(60, 58, 50);
        this.node.getComponent('cc.Sprite')?.setColor(bgColor);
        
        // Set text color
        const textColor = textColors[this._value as keyof typeof textColors] || new Color(249, 246, 242);
        this.valueLabel.color = textColor;
        
        // Adjust font size for larger numbers
        if (this._value >= 1000) {
            this.valueLabel.fontSize = 24;
        } else if (this._value >= 100) {
            this.valueLabel.fontSize = 28;
        } else {
            this.valueLabel.fontSize = 32;
        }
    }
}