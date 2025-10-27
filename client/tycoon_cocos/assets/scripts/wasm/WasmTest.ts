import { _decorator, Component, Label, Button } from 'cc';
import { WasmManager } from './WasmManager';

const { ccclass, property } = _decorator;

/**
 * WASM 测试组件
 *
 * 用于测试 Rust WASM 在 Cocos Creator 中的集成和性能
 * 对比 JavaScript 和 WASM 的数组求和性能
 */
@ccclass('WasmTest')
export class WasmTest extends Component {
    @property(Label)
    public statusLabel: Label | null = null;

    @property(Label)
    public resultLabel: Label | null = null;

    @property(Button)
    public testButton: Button | null = null;

    private wasmManager: WasmManager | null = null;
    private testArraySize: number = 1_000_000; // 100 万个数字

    onLoad() {
        console.log('[WasmTest] 组件加载');

        if (this.testButton) {
            this.testButton.node.on('click', this.onTestButtonClick, this);
        }

        this.updateStatus('点击按钮开始测试');
    }

    start() {
        // 自动初始化 WASM
        this.initializeWasm();
    }

    /**
     * 初始化 WASM 模块
     */
    private async initializeWasm() {
        this.updateStatus('正在初始化 WASM 模块...');

        this.wasmManager = WasmManager.getInstance();

        const success = await this.wasmManager.initialize();

        if (success) {
            this.updateStatus('✅ WASM 初始化成功！点击按钮开始测试');

            // 简单测试：greet 函数
            const greeting = this.wasmManager.greet('Cocos Creator');
            console.log('[WasmTest] Greet test:', greeting);
        } else {
            this.updateStatus('❌ WASM 初始化失败');
        }
    }

    /**
     * 测试按钮点击事件
     */
    private onTestButtonClick() {
        if (!this.wasmManager || !this.wasmManager.isInitialized) {
            this.updateStatus('❌ WASM 未初始化');
            return;
        }

        this.runPerformanceTest();
    }

    /**
     * 运行性能测试：对比 JS vs WASM 数组求和
     */
    private runPerformanceTest() {
        this.updateStatus(`正在生成 ${this.testArraySize.toLocaleString()} 个随机数...`);

        // 生成测试数据
        const testArray = new Float32Array(this.testArraySize);
        for (let i = 0; i < this.testArraySize; i++) {
            testArray[i] = Math.random();
        }

        // JavaScript 基准测试
        const jsStart = performance.now();
        let jsSum = 0;
        for (let i = 0; i < testArray.length; i++) {
            jsSum += testArray[i];
        }
        const jsTime = performance.now() - jsStart;

        console.log(`[WasmTest] JS 求和: ${jsSum}, 耗时: ${jsTime.toFixed(3)}ms`);

        // WASM 测试
        const wasmStart = performance.now();
        const wasmSum = this.wasmManager!.sumArray(testArray);
        const wasmTime = performance.now() - wasmStart;

        console.log(`[WasmTest] WASM 求和: ${wasmSum}, 耗时: ${wasmTime.toFixed(3)}ms`);

        // 计算性能提升
        const speedup = (jsTime / wasmTime).toFixed(2);

        // 显示结果
        const result = [
            `测试规模: ${this.testArraySize.toLocaleString()} 个数字`,
            '',
            `JS 求和: ${jsSum?.toFixed(2)}`,
            `耗时: ${jsTime.toFixed(3)}ms`,
            '',
            `WASM 求和: ${wasmSum?.toFixed(2)}`,
            `耗时: ${wasmTime.toFixed(3)}ms`,
            '',
            `🚀 性能提升: ${speedup}x`,
            '',
            `相对误差: ${Math.abs((jsSum - (wasmSum || 0)) / jsSum * 100).toFixed(4)}%`
        ].join('\n');

        this.updateResult(result);
        this.updateStatus('✅ 测试完成');

        console.log(`[WasmTest] 性能提升: ${speedup}x`);
    }

    /**
     * 更新状态文本
     */
    private updateStatus(text: string) {
        if (this.statusLabel) {
            this.statusLabel.string = text;
        }
        console.log(`[WasmTest] Status: ${text}`);
    }

    /**
     * 更新结果文本
     */
    private updateResult(text: string) {
        if (this.resultLabel) {
            this.resultLabel.string = text;
        }
    }
}
