#!/bin/bash

# Rust WASM 构建并复制到 Cocos Creator 项目
# 使用方法: ./build-and-copy.sh

set -e  # 遇到错误立即退出

echo "🦀 开始构建 Rust WASM..."

# 构建 WASM (no-modules target for Cocos Creator)
wasm-pack build --target no-modules --release

echo "✅ WASM 构建完成"

# 复制到 Cocos Creator 项目
COCOS_WASM_DIR="../../client/tycoon_cocos/assets/wasm"

echo "📦 复制文件到 Cocos Creator..."

mkdir -p "$COCOS_WASM_DIR"

cp pkg/rust_hello_wasm_bg.wasm "$COCOS_WASM_DIR/"
cp pkg/rust_hello_wasm.js "$COCOS_WASM_DIR/"
cp pkg/rust_hello_wasm.d.ts "$COCOS_WASM_DIR/"

echo "✅ 文件复制完成"

# 显示文件大小
echo ""
echo "📊 文件信息:"
ls -lh "$COCOS_WASM_DIR/"

echo ""
echo "🎉 完成！现在可以在 Cocos Creator 中测试了"
echo ""
echo "下一步:"
echo "  1. 在 Cocos Creator 中打开项目"
echo "  2. 添加 WasmTest 组件到场景"
echo "  3. 运行并测试性能"
