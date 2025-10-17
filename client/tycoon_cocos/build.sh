#!/bin/bash

# web3-tycoon Cocos Creator 自动化构建脚本
# 支持错误处理和自动修复

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 设置变量
COCOS_CREATOR_PATH="/Applications/Cocos/Creator/3.8.7/CocosCreator.app/Contents/MacOS/CocosCreator"
PROJECT_PATH="/Users/zero/dev/sui/web3-tycoon_dev/web3-tycoon_dev/client/tycoon_cocos"
BUILD_PATH="/Users/zero/dev/sui/tmp/web3-tycoon-out"
PLATFORM="web-desktop"

# 检查环境
check_environment() {
    log_info "检查构建环境..."
    
    # 检查 Cocos Creator
    if [ ! -f "$COCOS_CREATOR_PATH" ]; then
        log_error "找不到 Cocos Creator，请检查安装路径: $COCOS_CREATOR_PATH"
        exit 1
    fi
    
    # 检查项目路径
    if [ ! -d "$PROJECT_PATH" ]; then
        log_error "找不到项目路径: $PROJECT_PATH"
        exit 1
    fi
    
    # 检查项目文件
    if [ ! -f "$PROJECT_PATH/package.json" ]; then
        log_error "项目目录中找不到 package.json 文件"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 安装 npm 依赖
install_dependencies() {
    log_info "安装 npm 依赖..."
    
    # 进入项目目录
    cd "$PROJECT_PATH"
    
    # 检查 node_modules 是否存在
    if [ ! -d "node_modules" ]; then
        log_info "node_modules 不存在，开始安装依赖..."
        npm install
    else
        log_info "检查依赖是否需要更新..."
        # 检查 package-lock.json 是否比 node_modules 新
        if [ "package-lock.json" -nt "node_modules" ]; then
            log_info "package-lock.json 已更新，重新安装依赖..."
            npm install
        else
            log_info "依赖已是最新，跳过安装"
        fi
    fi
    
    if [ $? -eq 0 ]; then
        log_success "npm 依赖安装完成"
    else
        log_error "npm 依赖安装失败"
        exit 1
    fi
}

# 清理构建目录
clean_build_directory() {
    log_info "清理构建目录..."
    if [ -d "$BUILD_PATH" ]; then
        rm -rf "$BUILD_PATH"
        log_info "已清理旧的构建文件"
    fi
    mkdir -p "$BUILD_PATH"
}

# 检查 TypeScript 编译
check_typescript() {
    log_info "跳过 TypeScript 编译检查..."
    log_warning "由于缺少 temp/tsconfig.cocos.json 文件，跳过 TypeScript 检查"
    log_info "Cocos Creator 构建时会自动处理 TypeScript 编译"
}

# 执行构建
build_project() {
    log_info "开始构建项目..."
    log_info "项目路径: $PROJECT_PATH"
    log_info "构建路径: $BUILD_PATH"
    log_info "平台: $PLATFORM"
    
    # 构建参数（根据你的截图配置）
    BUILD_OPTIONS="platform=$PLATFORM;debug=false;sourceMaps=OFF;md5Cache=false;inlineEnums=true;mergeStartScene=false;optimizeHotUpdate=false;buildPath=$BUILD_PATH"
    
    # 执行构建
    log_info "执行构建命令..."
    "$COCOS_CREATOR_PATH" --project "$PROJECT_PATH" --build "$BUILD_OPTIONS"
    
    local build_result=$?
    
    if [ $build_result -eq 0 ]; then
        log_success "构建成功！"
        return 0
    else
        log_error "构建失败，退出码: $build_result"
        return $build_result
    fi
}

# 验证构建结果
verify_build() {
    log_info "验证构建结果..."
    
    if [ ! -d "$BUILD_PATH" ]; then
        log_error "构建目录不存在"
        return 1
    fi
    
    # 检查关键文件
    local index_file="$BUILD_PATH/index.html"
    if [ -f "$index_file" ]; then
        log_success "找到 index.html 文件"
    else
        log_warning "未找到 index.html 文件"
    fi
    
    # 列出构建结果
    log_info "构建结果："
    ls -la "$BUILD_PATH"
    
    # 显示构建大小
    local build_size=$(du -sh "$BUILD_PATH" | cut -f1)
    log_info "构建大小: $build_size"
}

# 主函数
main() {
    log_info "开始 web3-tycoon 项目构建流程..."
    
    # 检查环境
    check_environment
    
    # 安装 npm 依赖
    install_dependencies
    
    # 清理构建目录
    clean_build_directory
    
    # 检查 TypeScript
    check_typescript
    
    # 执行构建
    if build_project; then
        # 验证构建结果
        verify_build
        log_success "构建流程完成！"
        log_info "构建文件位于: $BUILD_PATH"
    else
        log_error "构建失败，请检查错误信息"
        exit 1
    fi
}

# 错误处理
trap 'log_error "构建过程中发生错误，退出码: $?"' ERR

# 运行主函数
main "$@"
