import { _decorator, sys, assetManager, Asset } from 'cc';
const { ccclass } = _decorator;

/**
 * WASM Worker 管理器 - 单例模式
 *
 * 在主线程中管理 Web Worker，将 WASM 计算卸载到 Worker 线程
 * 避免阻塞主线程，保持 UI 流畅
 *
 * 平台支持：
 * - ✅ Web 平台：使用 Worker + WASM
 * - ✅ 其他平台：自动 fallback 到 JS（主线程）
 */
@ccclass('WasmWorkerManager')
export class WasmWorkerManager {
    private static _instance: WasmWorkerManager | null = null;
    private _worker: Worker | null = null;
    private _isInitialized: boolean = false;
    private _isLoading: boolean = false;
    private _workerAvailable: boolean = false;
    private _nextRequestId: number = 1;
    private _pendingRequests: Map<number, {
        resolve: (result: any) => void;
        reject: (error: Error) => void;
    }> = new Map();

    private constructor() {}

    public static getInstance(): WasmWorkerManager {
        if (!WasmWorkerManager._instance) {
            WasmWorkerManager._instance = new WasmWorkerManager();
        }
        return WasmWorkerManager._instance;
    }

    /**
     * 初始化 Worker 和 WASM
     */
    public async initialize(): Promise<boolean> {
        if (this._isInitialized) {
            console.log('[WasmWorkerManager] 已经初始化');
            return this._workerAvailable;
        }

        if (this._isLoading) {
            console.log('[WasmWorkerManager] 正在加载中...');
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this._isInitialized) {
                        clearInterval(checkInterval);
                        resolve(this._workerAvailable);
                    }
                }, 100);
            });
        }

        this._isLoading = true;

        // 平台检测：只在 Web 平台使用 Worker
        if (!sys.isBrowser) {
            console.log('[WasmWorkerManager] ⚠️ 非 Web 平台，使用 JS fallback');
            this._isInitialized = true;
            this._workerAvailable = false;
            this._isLoading = false;
            return false;
        }

        try {
            console.log('[WasmWorkerManager] 开始初始化 Worker...');

            // 步骤1: 创建 Worker
            this._worker = new Worker(
                new URL('./WasmWorker.ts', import.meta.url),
                { type: 'module' }
            );

            // 步骤2: 设置消息处理
            this._worker.onmessage = (e) => this.handleWorkerMessage(e);
            this._worker.onerror = (err) => {
                console.error('[WasmWorkerManager] Worker 错误:', err);
            };

            // 步骤3: 加载 WASM 二进制（使用 Cocos assetManager）
            const wasmBytes = await this.loadWasmBinary();

            // 步骤4: 发送 WASM bytes 给 Worker（零拷贝传输）
            const initPromise = this.waitForWorkerReady();
            this._worker.postMessage(
                { type: 'init', wasmBytes },
                [wasmBytes]  // Transferable Objects
            );

            await initPromise;

            this._isInitialized = true;
            this._workerAvailable = true;
            console.log('[WasmWorkerManager] ✅ Worker 初始化成功');
            return true;

        } catch (error) {
            console.error('[WasmWorkerManager] ❌ Worker 初始化失败:', error);
            this._isInitialized = true;
            this._workerAvailable = false;
            return false;
        } finally {
            this._isLoading = false;
        }
    }

    /**
     * 加载 WASM 二进制（使用 Cocos assetManager）
     */
    private loadWasmBinary(): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            assetManager.loadAny(
                { url: 'wasm/rust_hello_wasm_bg', ext: '.wasm' },
                (err: Error | null, asset: Asset) => {
                    if (err) {
                        console.error('[WasmWorkerManager] WASM 加载失败:', err);
                        reject(err);
                        return;
                    }

                    const wasmBuffer = (asset as any)._nativeAsset as ArrayBuffer;
                    if (!wasmBuffer) {
                        reject(new Error('无法获取 WASM ArrayBuffer'));
                        return;
                    }

                    console.log('[WasmWorkerManager] WASM 二进制加载成功');
                    resolve(wasmBuffer);
                }
            );
        });
    }

    /**
     * 等待 Worker 就绪
     */
    private waitForWorkerReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker 初始化超时'));
            }, 10000); // 10 秒超时

            const originalOnMessage = this._worker!.onmessage;
            this._worker!.onmessage = (e) => {
                if (e.data.type === 'ready') {
                    clearTimeout(timeout);
                    this._worker!.onmessage = originalOnMessage;
                    resolve();
                } else if (originalOnMessage) {
                    originalOnMessage.call(this._worker, e);
                }
            };
        });
    }

    /**
     * 处理 Worker 消息
     */
    private handleWorkerMessage(e: MessageEvent) {
        const { type, id, result, elapsed, message } = e.data;

        if (type === 'result') {
            const request = this._pendingRequests.get(id);
            if (request) {
                this._pendingRequests.delete(id);
                request.resolve({ result, elapsed });
            }
        } else if (type === 'error') {
            const request = this._pendingRequests.get(id);
            if (request) {
                this._pendingRequests.delete(id);
                request.reject(new Error(message));
            }
        }
    }

    /**
     * 向 Worker 发送请求（Promise 化）
     */
    private sendRequest(type: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this._worker) {
                reject(new Error('Worker 未初始化'));
                return;
            }

            const id = this._nextRequestId++;
            this._pendingRequests.set(id, { resolve, reject });

            this._worker.postMessage(
                { type, data, id },
                data.buffer ? [data.buffer] : []  // 如果是 TypedArray，零拷贝传输
            );
        });
    }

    // ========== 便捷 API（与 WasmManager 一致）==========

    /**
     * 数组求和（异步）
     * Web 平台使用 Worker + WASM，其他平台使用 JS
     */
    public async sumArray(arr: Float32Array): Promise<number> {
        if (this._workerAvailable && this._worker) {
            // Web 平台：使用 Worker + WASM
            const { result } = await this.sendRequest('sum', arr);
            return result;
        } else {
            // 其他平台：JS fallback（主线程）
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                sum += arr[i];
            }
            return sum;
        }
    }

    /**
     * 检查是否使用 Worker（用于调试）
     */
    public get usingWorker(): boolean {
        return this._workerAvailable;
    }

    /**
     * 销毁 Worker
     */
    public destroy() {
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
        this._isInitialized = false;
        this._workerAvailable = false;
        this._pendingRequests.clear();
    }
}
