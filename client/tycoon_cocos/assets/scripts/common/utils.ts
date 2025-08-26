import { _ } from './lodash-compat';
import { v3, Rect } from 'cc';

interface FlyArea {
    width: number;
    height: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

interface JsonData {
    json: any[];
}

const utils = {
    clamp(x: number, min: number, max: number): number {
        if (x < min) {
            x = min;
        }

        if (x > max) {
            x = max;
        }

        return x;
    },

    calcWanderTarget(x: number, y: number, flyArea: FlyArea) {
        //随机一个在区域内的坐标
        //todo 需要调整容易挤在边缘处的问题
        let stepX = flyArea.width / 4;
        let stepY = flyArea.height / 4;

        x += _.random(-stepX, stepX);
        y += _.random(-stepY, stepY);

        x = this.clamp(x, flyArea.xMin, flyArea.xMax);
        y = this.clamp(y, flyArea.yMin, flyArea.yMax);

        return v3(x, y, 0);
    },

    randomPositionInRect(rect: Rect) {
        return v3(_.random(rect.xMin, rect.xMax), _.random(rect.yMin, rect.yMax), 0);
    },

    getBigNumString(iNum: number): string {
        iNum = Math.floor(iNum);

        let iIndex = -1;
        while (iNum > 10000) {
            iNum = iNum / 1000;

            iIndex++;
            if (iIndex >= 6)
                break;
        }

        let sDanWei = ["K", "M", "G", "U", "T", "P"];
        if (iIndex >= 0 && iIndex < 6) {
            var itmp = Number(iNum);
            let formattedNum = itmp.toFixed(3);
            return formattedNum + sDanWei[iIndex];
        }
        return iNum.toString();
    },

    formatDateTimeString(min: number): string {
        const dayLen = 24 * 60;
        const hourLen = 60;

        let dayNum = Math.floor(min / dayLen);

        let num = min - dayNum * dayLen;
        let hourNum = Math.floor(num / hourLen);
        let minNum = num - hourLen * hourNum;

        if (dayNum > 0) {
            return `${dayNum}天${hourNum}小时${minNum}分`;
        } else if (hourNum > 0) {
            return `${hourNum}小时${minNum}分`;
        } else {
            return `${minNum}分`;
        }
    },

    formatDateTimeString_s(s: number): string {
        const minLen = 60;
        const hourLen = 60 * minLen;
        const dayLen = 24 * hourLen;

        let dayNum = Math.floor(s / dayLen);

        let num = s - dayNum * dayLen;
        let hourNum = Math.floor(num / hourLen);
        num = num - hourLen * hourNum; //分秒

        let minNum = Math.floor(num / minLen);
        let secondNum = num - minLen * minNum; //秒

        if (dayNum > 0) {
            return `${dayNum}天${hourNum}小时${minNum}分${secondNum}秒`;
        } else if (hourNum > 0) {
            return `${hourNum}小时${minNum}分${secondNum}秒`;
        } else if (minNum > 0) {
            return `${minNum}分${secondNum}秒`;
        } else {
            return `${secondNum}秒`;
        }
    },

    prefix0(num: number): string {
        let str = num >= 10 ? num.toString() : '0' + num.toString();
        return str;
    },

    formatTimeString_hms(s: number): string {
        // var s = Math.floor(ms / 1000);

        s = Math.floor(s);

        var hh = Math.floor(s / (60 * 60));
        s = s - hh * (60 * 60); //min s

        var mm = Math.floor(s / 60);
        s = s - mm * 60; //s

        // log(hh, mm, s);

        if (hh > 0) {
            return this.prefix0(hh) + 'h' + this.prefix0(mm) + 'm' + this.prefix0(s) + 's';
        } else if (mm > 0) {
            return this.prefix0(mm) + 'm' + this.prefix0(s) + 's';
        } else {
            return this.prefix0(s) + 's';
        }
    },

    formatTimeString(ms: number): string {
        //mm:ss.xx
        var xx = Math.floor(ms % 1000 / 10);
        var s = Math.floor(ms / 1000);
        var ss = Math.floor(s % 60);

        var mm = Math.floor(s / 60);//max 99
        mm = mm > 99 ? 99 : mm;

        //logA(mm, ss, xx, s);

        return this.prefix0(mm) + ':' + this.prefix0(ss) + '.' + this.prefix0(xx);
    },

    uncompleteTimeString: '--:--.--',

    convertJsonDataList2Obj(jsonData: JsonData): { [key: string]: any } {
        let list = jsonData.json;
        let obj: { [key: string]: any } = {};
        list.forEach((v: any) => {
            obj[v.id] = v;
        });

        return obj;
    }
};

// log('utils: ', utils)

export { utils };