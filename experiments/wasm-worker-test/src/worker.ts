/// <reference lib="webworker" />

import init, { sum_array, greet } from '../../rust-hello-wasm/pkg/rust_hello_wasm.js';

let wasmReady = false;

// 初始化 WASM 模块
init().then(() => {
    wasmReady = true;
    console.log('[Worker] WASM module loaded');
    postMessage({ type: 'ready' });
}).catch((err) => {
    console.error('[Worker] Failed to load WASM:', err);
    postMessage({ type: 'error', message: err.toString() });
});

// 监听主线程消息
self.onmessage = (e: MessageEvent) => {
    if (!wasmReady) {
        postMessage({ type: 'error', message: 'WASM not ready' });
        return;
    }

    const { type, data } = e.data;

    switch (type) {
        case 'greet': {
            const result = greet(data);
            postMessage({ type: 'greet-result', result });
            break;
        }

        case 'sum': {
            const start = performance.now();
            const result = sum_array(data);
            const elapsed = performance.now() - start;

            postMessage({
                type: 'sum-result',
                result,
                elapsed
            });
            break;
        }

        default:
            console.warn('[Worker] Unknown message type:', type);
    }
};
