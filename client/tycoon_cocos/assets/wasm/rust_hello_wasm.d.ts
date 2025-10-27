declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	/**
	 * 简单的问候函数，用于验证 Rust→WASM 基础功能
	 */
	export function greet(name: string): string;
	/**
	 * 数组求和函数，用于性能测试
	 *
	 * 这个函数接收一个 f32 数组切片，返回所有元素的总和。
	 * 用于对比 JS 和 WASM 在大数组计算上的性能差异。
	 */
	export function sum_array(arr: Float32Array): number;
	/**
	 * 数组元素乘以常数，用于测试数据修改
	 */
	export function multiply_array(arr: Float32Array, factor: number): void;
	export function main(): void;
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly greet: (a: number, b: number) => [number, number];
  readonly sum_array: (a: number, b: number) => number;
  readonly multiply_array: (a: number, b: number, c: any, d: number) => void;
  readonly main: () => void;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
