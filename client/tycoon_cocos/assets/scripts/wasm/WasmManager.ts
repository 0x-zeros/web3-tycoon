import { _decorator } from 'cc';
const { ccclass } = _decorator;

/**
 * WASM 管理器 - 单例模式
 *
 * 负责加载和初始化 Rust WASM 模块（no-modules target）
 * 使用全局 wasm_bindgen 对象调用 WASM 函数
 */
@ccclass('WasmManager')
export class WasmManager {
    private static _instance: WasmManager | null = null;
    private _isInitialized: boolean = false;
    private _isLoading: boolean = false;
    private _wasmModule: any = null; // wasm_bindgen 全局对象

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
            return true;
        }

        if (this._isLoading) {
            console.log('[WasmManager] 正在加载中...');
            // 等待加载完成
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this._isInitialized) {
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 100);
            });
        }

        this._isLoading = true;

        try {
            console.log('[WasmManager] 开始加载 WASM 模块...');

            // 步骤1: 加载 glue code (rust_hello_wasm.js)
            await this.loadGlueCode();

            // 步骤2: 加载 WASM 二进制文件
            const wasmBuffer = await this.loadWasmBinary();

            // 步骤3: 初始化 WASM (调用全局 wasm_bindgen 函数)
            if (typeof (window as any).wasm_bindgen === 'function') {
                await (window as any).wasm_bindgen(wasmBuffer);
                this._wasmModule = (window as any).wasm_bindgen;
                this._isInitialized = true;
                console.log('[WasmManager] ✅ WASM 模块初始化成功');
                return true;
            } else {
                throw new Error('wasm_bindgen 全局函数未找到');
            }
        } catch (error) {
            console.error('[WasmManager] ❌ WASM 初始化失败:', error);
            this._isLoading = false;
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
     * 加载 WASM 二进制文件
     * 返回 ArrayBuffer
     */
    private loadWasmBinary(): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'assets/wasm/rust_hello_wasm_bg.wasm', true);
            xhr.responseType = 'arraybuffer';

            xhr.onload = () => {
                if (xhr.status === 200) {
                    console.log('[WasmManager] WASM 二进制加载成功');
                    resolve(xhr.response);
                } else {
                    reject(new Error(`Failed to load WASM: ${xhr.status}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Network error loading WASM'));
            };

            xhr.send();
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

    // ========== 便捷 API（类型安全的包装） ==========

    /**
     * 简单问候函数
     */
    public greet(name: string): string | null {
        if (!this._wasmModule) return null;
        return this._wasmModule.greet(name);
    }

    /**
     * 数组求和（f32）
     */
    public sumArray(arr: Float32Array): number | null {
        if (!this._wasmModule) return null;
        return this._wasmModule.sum_array(arr);
    }

    /**
     * 数组乘以常数（原地修改）
     */
    public multiplyArray(arr: Float32Array, factor: number): void {
        if (!this._wasmModule) return;
        this._wasmModule.multiply_array(arr, factor);
    }
}
