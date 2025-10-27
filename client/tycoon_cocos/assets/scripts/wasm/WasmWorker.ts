/// <reference lib="webworker" />

/**
 * WASM Worker 内部代码
 *
 * 运行在 Web Worker 中，负责：
 * 1. 加载 glue code (使用 importScripts)
 * 2. 接收主线程传来的 WASM bytes
 * 3. 初始化 WASM 模块
 * 4. 处理计算任务并返回结果
 *
 * 通信协议：
 * - 接收: { type: 'init', wasmBytes: ArrayBuffer }
 * - 接收: { type: 'sum', data: Float32Array, id: number }
 * - 发送: { type: 'ready' }
 * - 发送: { type: 'result', id: number, result: number, elapsed: number }
 * - 发送: { type: 'error', message: string }
 */

let wasmReady = false;
let wasmModule: any = null;

// 使用 async onmessage 因为初始化 WASM 需要 await
self.onmessage = async (e: MessageEvent) => {
    const { type, data, id, wasmBytes } = e.data;

    try {
        // 处理初始化消息
        if (type === 'init') {
            if (wasmReady) {
                self.postMessage({ type: 'ready' });
                return;
            }

            console.log('[WasmWorker] 开始初始化 WASM...');

            // 步骤1: 加载 glue code（Worker 专用方式）
            try {
                importScripts('/assets/wasm/rust_hello_wasm.js');
                console.log('[WasmWorker] Glue code 加载成功');
            } catch (err) {
                // 可能已经加载过了
                console.log('[WasmWorker] Glue code 已加载或加载失败:', err);
            }

            // 步骤2: 检查 wasm_bindgen 是否可用
            if (typeof (self as any).wasm_bindgen !== 'function') {
                throw new Error('wasm_bindgen 函数未找到');
            }

            // 步骤3: 使用传来的 bytes 初始化 WASM
            await (self as any).wasm_bindgen(wasmBytes);
            wasmModule = (self as any).wasm_bindgen;
            wasmReady = true;

            console.log('[WasmWorker] ✅ WASM 初始化成功');
            self.postMessage({ type: 'ready' });
            return;
        }

        // 处理计算请求
        if (!wasmReady || !wasmModule) {
            self.postMessage({
                type: 'error',
                message: 'WASM 未初始化',
                id
            });
            return;
        }

        // 数组求和
        if (type === 'sum') {
            const start = performance.now();
            const result = wasmModule.sum_array(data);
            const elapsed = performance.now() - start;

            self.postMessage({
                type: 'result',
                id,
                result,
                elapsed
            });
            return;
        }

        // 未知消息类型
        self.postMessage({
            type: 'error',
            message: `未知消息类型: ${type}`,
            id
        });

    } catch (error) {
        console.error('[WasmWorker] 错误:', error);
        self.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
            id
        });
    }
};

// Worker 启动日志
console.log('[WasmWorker] Worker 已启动，等待初始化...');
