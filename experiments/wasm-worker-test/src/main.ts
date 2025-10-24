// 创建 Worker
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
});

// 监听 Worker 消息
worker.onmessage = (e: MessageEvent) => {
    const { type, result, elapsed } = e.data;

    switch (type) {
        case 'ready':
            console.log('✅ Worker ready!');
            updateStatus('Worker 已就绪，开始测试...');
            runTests();
            break;

        case 'greet-result':
            console.log('Greet result:', result);
            addResult(`问候测试: ${result}`);
            break;

        case 'sum-result':
            console.log(`WASM sum: ${result}, time: ${elapsed.toFixed(3)}ms`);
            addResult(`WASM 求和: ${result.toFixed(2)}, 耗时: ${elapsed.toFixed(3)}ms`, 'wasm');
            break;

        case 'error':
            console.error('Worker error:', e.data.message);
            updateStatus('错误: ' + e.data.message);
            break;
    }
};

worker.onerror = (err) => {
    console.error('Worker error:', err);
    updateStatus('Worker 错误: ' + err.message);
};

// 运行测试
function runTests() {
    // 1. 问候测试
    worker.postMessage({ type: 'greet', data: 'Claude' });

    // 2. 性能测试：生成 100 万个随机数
    const arraySize = 1_000_000;
    const testArray = new Float32Array(arraySize);
    for (let i = 0; i < arraySize; i++) {
        testArray[i] = Math.random();
    }

    addResult(`生成了 ${arraySize.toLocaleString()} 个随机数`);

    // JS 对照组
    const jsStart = performance.now();
    const jsSum = testArray.reduce((a, b) => a + b, 0);
    const jsElapsed = performance.now() - jsStart;

    console.log(`JS sum: ${jsSum}, time: ${jsElapsed.toFixed(3)}ms`);
    addResult(`JS 求和: ${jsSum.toFixed(2)}, 耗时: ${jsElapsed.toFixed(3)}ms`, 'js');

    // WASM 测试组（通过 Worker）
    // 使用 Transferable Objects 避免拷贝
    worker.postMessage(
        { type: 'sum', data: testArray },
        [testArray.buffer]
    );

    console.log('已发送数据到 Worker（零拷贝传输）');
}

// UI 辅助函数
function updateStatus(text: string) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

function addResult(text: string, type: 'js' | 'wasm' | 'info' = 'info') {
    const resultsEl = document.getElementById('results');
    if (resultsEl) {
        const div = document.createElement('div');
        div.className = `result result-${type}`;
        div.textContent = text;
        resultsEl.appendChild(div);
    }
}

// 初始化
updateStatus('正在加载 Worker...');
