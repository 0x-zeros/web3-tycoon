use wasm_bindgen::prelude::*;

/// 简单的问候函数，用于验证 Rust→WASM 基础功能
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello from Rust, {}!", name)
}

/// 数组求和函数，用于性能测试
///
/// 这个函数接收一个 f32 数组切片，返回所有元素的总和。
/// 用于对比 JS 和 WASM 在大数组计算上的性能差异。
#[wasm_bindgen]
pub fn sum_array(arr: &[f32]) -> f32 {
    arr.iter().sum()
}

/// 数组元素乘以常数，用于测试数据修改
#[wasm_bindgen]
pub fn multiply_array(arr: &mut [f32], factor: f32) {
    for item in arr.iter_mut() {
        *item *= factor;
    }
}

// WASM 模块初始化时调用（可选）
#[wasm_bindgen(start)]
pub fn main() {
    // 在浏览器控制台设置 panic hook，方便调试
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
