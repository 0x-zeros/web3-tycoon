import { _decorator, Component, Label, ProgressBar } from 'cc';
import { utils } from "./utils";

const { ccclass, property } = _decorator;

@ccclass('Countdown')
export class Countdown extends Component {

    @property(Label)
    label: Label | null = null;

    @property(ProgressBar)
    progressBar: ProgressBar | null = null;

    private num: number = 0;
    private nowNum: number = 0;
    private total: number = 0;
    private style: number = 0;

    onLoad() {
        this.num = 0;
        this.nowNum = 0;
    }

    countdown(numSecond: number, progressTotalNum: number, style: number) {
        // log('countdown in Countdown ', numSecond)
        this.node.active = true;

        this.total = progressTotalNum;
        this.num = numSecond * 1000;
        this.nowNum = this.num;
        this.style = style;

        if (this.style === 1) {
            // this.label.string = this.formatTimeString1(Math.floor(this.nowNum))
            if (this.label) {
                this.label.string = utils.formatTimeString_hms(this.nowNum / 1000);
            }
        } else {
            if (this.label) {
                this.label.string = this.formatTimeString(Math.floor(this.nowNum));
            }
        }

        if (this.progressBar) {
            this.progressBar.progress = 1;
        }
    }

    endCountdown() {
        this.node.active = false;
    }

    update(dt: number) {
        this.nowNum -= dt * 1000;
        if (this.nowNum < 0) {
            this.node.active = false;
        } else {
            // this.label.string = this.formatTimeString(Math.floor(this.nowNum))

            if (this.style === 1) {
                if (this.label) {
                    this.label.string = utils.formatTimeString_hms(this.nowNum / 1000);
                }
            } else {
                if (this.label) {
                    this.label.string = this.formatTimeString(Math.floor(this.nowNum));
                }
            }

            if (this.progressBar) {
                this.progressBar.progress = this.nowNum / this.total;
            }
        }
    }

    prefix0(num: number): string {
        let str = num >= 10 ? num.toString() : '0' + num.toString();
        return str;
    }

    formatTimeString(ms: number): string {
        //mm:ss.xx
        // var xx = Math.floor(ms % 1000 / 10);
        var s = Math.floor(ms / 1000);
        var ss = Math.floor(s % 60);

        var mm = Math.floor(s / 60);//max 99
        mm = mm > 99 ? 99 : mm;

        //log(mm, ss, xx, s);

        // return prefix0(mm) + ':' + prefix0(ss) + '.' + prefix0(xx);
        return this.prefix0(mm) + ':' + this.prefix0(ss);// + '.' + prefix0(xx);
    }
}