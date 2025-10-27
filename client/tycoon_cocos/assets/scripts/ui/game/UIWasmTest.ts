import { _decorator } from 'cc';
import { UIBase } from '../core/UIBase';
import { WasmManager } from '../../wasm/WasmManager';
import { WasmWorkerManager } from '../../wasm/WasmWorkerManager';

const { ccclass } = _decorator;

/**
 * WASM 测试 UI
 *
 * 绑定 FairyGUI 的 wasm_worker_test 组件
 * 包含两个按钮：
 * - btn_main: 主线程 WASM 测试
 * - btn_worker: Worker 线程 WASM 测试
 */
@ccclass('UIWasmTest')
export class UIWasmTest extends UIBase {
    private btnMain!: fgui.GButton;
    private btnWorker!: fgui.GButton;
    private title!: fgui.GTextField;

    private testArraySize: number = 1_000_000; // 100 万个数字

    protected onInit(): void {
        // 获取 UI 元素
        this.btnMain = this._view.getChild('btn_main').asButton;
        this.btnWorker = this._view.getChild('btn_worker').asButton;
        this.title = this._view.getChild('title').asTextField;

        // 绑定事件
        this.btnMain.onClick(this.onMainTest, this);
        this.btnWorker.onClick(this.onWorkerTest, this);

        // 初始状态
        this.updateTitle('点击按钮开始测试');
    }

    /**
     * 主线程测试
     */
    private async onMainTest() {
        this.updateTitle('正在初始化主线程 WASM...');
        this.btnMain.enabled = false;
        this.btnWorker.enabled = false;

        try {
            const wasm = WasmManager.getInstance();
            const success = await wasm.initialize();

            if (!success) {
                this.updateTitle('WASM 初始化失败，使用 JS fallback');
            }

            // 生成测试数据
            this.updateTitle('生成测试数据...');
            const testArray = this.generateTestData();

            // JavaScript 对照组
            const jsStart = performance.now();
            let jsSum = 0;
            for (let i = 0; i < testArray.length; i++) {
                jsSum += testArray[i];
            }
            const jsTime = performance.now() - jsStart;

            // WASM/JS 测试组
            const wasmStart = performance.now();
            const wasmSum = wasm.sumArray(testArray);
            const wasmTime = performance.now() - wasmStart;

            // 显示结果
            const mode = wasm.usingWasm ? 'WASM' : 'JS Fallback';
            const speedup = (jsTime / wasmTime).toFixed(2);
            const error = Math.abs((jsSum - wasmSum) / jsSum * 100).toFixed(4);

            const result = [
                `【主线程模式 - ${mode}】`,
                `数组大小: ${this.testArraySize.toLocaleString()}`,
                ``,
                `纯 JS: ${jsSum.toFixed(2)}`,
                `耗时: ${jsTime.toFixed(3)}ms`,
                ``,
                `${mode}: ${wasmSum.toFixed(2)}`,
                `耗时: ${wasmTime.toFixed(3)}ms`,
                ``,
                `性能提升: ${speedup}x`,
                `相对误差: ${error}%`
            ].join('\n');

            this.updateTitle(result);

            console.log(`[UIWasmTest] 主线程测试完成: ${mode}, 性能提升 ${speedup}x`);

        } catch (error) {
            console.error('[UIWasmTest] 主线程测试失败:', error);
            this.updateTitle(`测试失败: ${error}`);
        } finally {
            this.btnMain.enabled = true;
            this.btnWorker.enabled = true;
        }
    }

    /**
     * Worker 测试
     */
    private async onWorkerTest() {
        this.updateTitle('正在初始化 Worker WASM...');
        this.btnMain.enabled = false;
        this.btnWorker.enabled = false;

        try {
            const worker = WasmWorkerManager.getInstance();
            const success = await worker.initialize();

            if (!success) {
                this.updateTitle('Worker 初始化失败，使用 JS fallback');
            }

            // 生成测试数据
            this.updateTitle('生成测试数据...');
            const testArray = this.generateTestData();

            // JavaScript 对照组（主线程）
            const jsStart = performance.now();
            let jsSum = 0;
            for (let i = 0; i < testArray.length; i++) {
                jsSum += testArray[i];
            }
            const jsTime = performance.now() - jsStart;

            // Worker + WASM 测试组（异步）
            const wasmStart = performance.now();
            const wasmSum = await worker.sumArray(testArray);
            const wasmTime = performance.now() - wasmStart;

            // 显示结果
            const mode = worker.usingWorker ? 'Worker+WASM' : 'JS Fallback';
            const speedup = (jsTime / wasmTime).toFixed(2);
            const error = Math.abs((jsSum - wasmSum) / jsSum * 100).toFixed(4);

            const result = [
                `【Worker 模式 - ${mode}】`,
                `数组大小: ${this.testArraySize.toLocaleString()}`,
                ``,
                `纯 JS (主线程): ${jsSum.toFixed(2)}`,
                `耗时: ${jsTime.toFixed(3)}ms`,
                ``,
                `${mode}: ${wasmSum.toFixed(2)}`,
                `耗时: ${wasmTime.toFixed(3)}ms`,
                `(含通信开销)`,
                ``,
                `性能提升: ${speedup}x`,
                `相对误差: ${error}%`
            ].join('\n');

            this.updateTitle(result);

            console.log(`[UIWasmTest] Worker 测试完成: ${mode}, 性能提升 ${speedup}x`);

        } catch (error) {
            console.error('[UIWasmTest] Worker 测试失败:', error);
            this.updateTitle(`测试失败: ${error}`);
        } finally {
            this.btnMain.enabled = true;
            this.btnWorker.enabled = true;
        }
    }

    /**
     * 生成测试数据
     */
    private generateTestData(): Float32Array {
        const arr = new Float32Array(this.testArraySize);
        for (let i = 0; i < this.testArraySize; i++) {
            arr[i] = Math.random();
        }
        return arr;
    }

    /**
     * 更新标题文本
     */
    private updateTitle(text: string) {
        if (this.title) {
            this.title.text = text;
        }
    }
}
