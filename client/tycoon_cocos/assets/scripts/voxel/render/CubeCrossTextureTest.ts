/**
 * 横十字贴图测试工具
 * 用于生成测试贴图，验证UV映射是否正确
 *
 * @author Web3 Tycoon Team
 */

import { _decorator, Component, CCInteger } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CubeCrossTextureTest')
export class CubeCrossTextureTest extends Component {

    @property({
        type: CCInteger,
        displayName: '贴图尺寸',
        tooltip: '生成的测试贴图尺寸（像素）',
        min: 128,
        max: 2048
    })
    textureSize: number = 512;

    /**
     * 生成测试贴图的Canvas
     * 可以在浏览器控制台调用此方法生成测试贴图
     *
     * 使用方法：
     * 1. 在浏览器控制台调用 generateTestTextureCanvas()
     * 2. 右键保存生成的图片
     * 3. 导入到项目中使用
     */
    static generateTestTextureCanvas(size: number = 512): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // 填充背景（透明）
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, size, size);

        // 每个格子的尺寸
        const cellWidth = size / 4;
        const cellHeight = size / 3;

        // 面的定义：[列, 行, 文字, 颜色]
        const faces: [number, number, string, string][] = [
            // 中间行
            [0, 1, '-X', '#FF6B6B'],  // 红色
            [1, 1, '+Z', '#4ECDC4'],  // 青色
            [2, 1, '+X', '#45B7D1'],  // 蓝色
            [3, 1, '-Z', '#96CEB4'],  // 绿色
            // 上下
            [1, 0, '-Y', '#FECA57'],  // 黄色
            [1, 2, '+Y', '#48DBFB'],  // 天蓝色
        ];

        // 绘制每个面
        for (const [col, row, text, color] of faces) {
            const x = col * cellWidth;
            const y = (2 - row) * cellHeight; // Y轴翻转（Canvas坐标系）

            // 填充背景色
            ctx.fillStyle = color;
            ctx.fillRect(x, y, cellWidth, cellHeight);

            // 绘制边框
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, cellWidth, cellHeight);

            // 绘制文字
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${cellHeight / 3}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + cellWidth / 2, y + cellHeight / 2);

            // 绘制小标记（帮助识别方向）
            ctx.fillStyle = '#000000';
            ctx.font = `${cellHeight / 6}px Arial`;

            // 左上角标记
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('↖', x + 5, y + 5);

            // 右下角标记
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('↘', x + cellWidth - 5, y + cellHeight - 5);
        }

        // 在空白区域绘制说明
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 左上角空白
        ctx.fillText('Empty', cellWidth / 2, cellHeight / 2);
        // 右上角空白
        ctx.fillText('Empty', cellWidth * 2.5, cellHeight / 2);
        ctx.fillText('Empty', cellWidth * 3.5, cellHeight / 2);

        // 左下角空白
        ctx.fillText('Empty', cellWidth / 2, cellHeight * 2.5);
        // 右下角空白
        ctx.fillText('Empty', cellWidth * 2.5, cellHeight * 2.5);
        ctx.fillText('Empty', cellWidth * 3.5, cellHeight * 2.5);

        return canvas;
    }

    /**
     * 在控制台输出测试贴图的Data URL
     * 可以复制此URL在浏览器中打开查看
     */
    static generateTestTextureDataURL(size: number = 512): string {
        const canvas = this.generateTestTextureCanvas(size);
        return canvas.toDataURL('image/png');
    }

    /**
     * 下载测试贴图
     */
    static downloadTestTexture(filename: string = 'cube_cross_test.png', size: number = 512): void {
        const canvas = this.generateTestTextureCanvas(size);
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    start() {
        // 在组件启动时输出使用说明
        console.log('===== 横十字贴图测试工具 =====');
        console.log('在浏览器控制台执行以下命令生成测试贴图：');
        console.log('');
        console.log('1. 生成并下载测试贴图：');
        console.log("   CubeCrossTextureTest.downloadTestTexture('test.png', 512)");
        console.log('');
        console.log('2. 获取贴图DataURL（可在浏览器打开）：');
        console.log("   CubeCrossTextureTest.generateTestTextureDataURL(512)");
        console.log('');
        console.log('3. 获取Canvas对象（高级用法）：');
        console.log("   CubeCrossTextureTest.generateTestTextureCanvas(512)");
        console.log('===============================');
    }
}

// 导出到全局，方便在控制台使用
if (typeof window !== 'undefined') {
    (window as any).CubeCrossTextureTest = CubeCrossTextureTest;
}