import { _decorator, sys, assetManager, Asset } from 'cc';
const { ccclass } = _decorator;

/**
 * WASM 管理器 - 单例模式
 *
 * 负责加载和初始化 Rust WASM 模块（no-modules target）
 * 使用全局 wasm_bindgen 对象调用 WASM 函数
 *
 * 平台支持：
 * - ✅ Web 平台：使用 WASM（性能优化）
 * - ✅ 其他平台：自动 fallback 到 JS 实现
 */
@ccclass('WasmManager')
export class WasmManager {
    private static _instance: WasmManager | null = null;
    private _isInitialized: boolean = false;
    private _isLoading: boolean = false;
    private _wasmModule: any = null; // wasm_bindgen 全局对象
    private _wasmAvailable: boolean = false; // WASM 是否可用

    private constructor() {}

    public static getInstance(): WasmManager {
        if (!WasmManager._instance) {
            WasmManager._instance = new WasmManager();
        }
        return WasmManager._instance;
    }

    /**
     * 初始化 WASM 模块
     *
     * @returns Promise<boolean> 初始化是否成功
     */
    public async initialize(): Promise<boolean> {
        if (this._isInitialized) {
            console.log('[WasmManager] 已经初始化');
            return this._wasmAvailable;
        }

        if (this._isLoading) {
            console.log('[WasmManager] 正在加载中...');
            // 等待加载完成
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this._isInitialized) {
                        clearInterval(checkInterval);
                        resolve(this._wasmAvailable);
                    }
                }, 100);
            });
        }

        this._isLoading = true;

        // 平台检测：只在 Web 平台加载 WASM
        if (!sys.isBrowser) {
            console.log('[WasmManager] ⚠️ 非 Web 平台，使用 JS fallback');
            this._isInitialized = true;
            this._wasmAvailable = false;
            this._isLoading = false;
            return false;
        }

        try {
            console.log('[WasmManager] 开始加载 WASM 模块...');

            // 步骤1: 加载 glue code (rust_hello_wasm.js)
            await this.loadGlueCode();

            // 步骤2: 加载 WASM 二进制文件（使用 Cocos assetManager）
            const wasmBuffer = await this.loadWasmBinary();

            // 步骤3: 初始化 WASM (调用全局 wasm_bindgen 函数)
            if (typeof (window as any).wasm_bindgen === 'function') {
                await (window as any).wasm_bindgen(wasmBuffer);
                this._wasmModule = (window as any).wasm_bindgen;
                this._isInitialized = true;
                this._wasmAvailable = true;
                console.log('[WasmManager] ✅ WASM 模块初始化成功');
                return true;
            } else {
                throw new Error('wasm_bindgen 全局函数未找到');
            }
        } catch (error) {
            console.error('[WasmManager] ❌ WASM 初始化失败:', error);
            this._isLoading = false;
            this._isInitialized = true; // 标记为已尝试初始化
            this._wasmAvailable = false; // 但 WASM 不可用
            return false;
        } finally {
            this._isLoading = false;
        }
    }

    /**
     * 加载 glue code (rust_hello_wasm.js)
     * 这会暴露全局 wasm_bindgen 函数
     */
    private loadGlueCode(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 检查是否已加载
            if (typeof (window as any).wasm_bindgen !== 'undefined') {
                console.log('[WasmManager] Glue code 已加载');
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'assets/wasm/rust_hello_wasm.js';
            script.onload = () => {
                console.log('[WasmManager] Glue code 加载成功');
                resolve();
            };
            script.onerror = (error) => {
                console.error('[WasmManager] Glue code 加载失败:', error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * 加载 WASM 二进制文件（使用 Cocos assetManager）
     * 返回 ArrayBuffer
     */
    private loadWasmBinary(): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            assetManager.loadAny(
                { url: 'wasm/rust_hello_wasm_bg', ext: '.wasm' },
                (err: Error | null, asset: Asset) => {
                    if (err) {
                        console.error('[WasmManager] WASM 加载失败:', err);
                        reject(err);
                        return;
                    }

                    // 获取 ArrayBuffer
                    const wasmBuffer = (asset as any)._nativeAsset as ArrayBuffer;
                    if (!wasmBuffer) {
                        reject(new Error('无法获取 WASM ArrayBuffer'));
                        return;
                    }

                    console.log('[WasmManager] WASM 二进制加载成功');
                    resolve(wasmBuffer);
                }
            );
        });
    }

    /**
     * 检查 WASM 是否已初始化
     */
    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    /**
     * 获取 WASM 模块（wasm_bindgen 全局对象）
     * 包含所有导出的函数
     */
    public get wasmModule(): any {
        if (!this._isInitialized) {
            console.warn('[WasmManager] WASM 尚未初始化');
            return null;
        }
        return this._wasmModule;
    }

    // ========== 便捷 API（类型安全的包装 + JS fallback） ==========

    /**
     * 简单问候函数
     */
    public greet(name: string): string {
        if (this._wasmAvailable && this._wasmModule) {
            // Web 平台：使用 WASM
            return this._wasmModule.greet(name);
        } else {
            // 其他平台：JS fallback
            return `Hello from JS fallback, ${name}!`;
        }
    }

    /**
     * 数组求和（f32）
     * Web 平台使用 WASM，其他平台使用 JS
     */
    public sumArray(arr: Float32Array): number {
        if (this._wasmAvailable && this._wasmModule) {
            // Web 平台：使用 WASM
            return this._wasmModule.sum_array(arr);
        } else {
            // 其他平台：JS fallback
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                sum += arr[i];
            }
            return sum;
        }
    }

    /**
     * 数组乘以常数（原地修改）
     */
    public multiplyArray(arr: Float32Array, factor: number): void {
        if (this._wasmAvailable && this._wasmModule) {
            // Web 平台：使用 WASM
            this._wasmModule.multiply_array(arr, factor);
        } else {
            // 其他平台：JS fallback
            for (let i = 0; i < arr.length; i++) {
                arr[i] *= factor;
            }
        }
    }

    /**
     * 检查是否使用 WASM（用于调试）
     */
    public get usingWasm(): boolean {
        return this._wasmAvailable;
    }
}
