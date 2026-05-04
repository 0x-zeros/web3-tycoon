# Playwright e2e: 默认 headless, 通过 compose.gui.yml 切到 GUI 模式 (Xvfb + noVNC)
# 基于 Microsoft 官方 playwright 镜像（已预装 chromium/firefox/webkit + node + @playwright/test）
# noble = ubuntu 24.04
FROM mcr.microsoft.com/playwright:v1.55.1-noble

ENV DEBIAN_FRONTEND=noninteractive

# GUI 模式所需:
#   xvfb       - 虚拟 X server (容器无显示器, 提供假 framebuffer)
#   x11-utils  - xdpyinfo (entrypoint 等 Xvfb ready 用)
#   x11vnc     - 把 Xvfb framebuffer 暴露成 VNC server (5900)
#   fluxbox    - 极简 WM, 让浏览器窗口能正常聚焦/拖拽
#   websockify - WebSocket → TCP 桥, 让 noVNC 网页客户端能连 VNC
#   novnc      - 网页版 VNC client (host 浏览器开 http://localhost:7900 看)
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11-utils \
    x11vnc \
    fluxbox \
    websockify \
    novnc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 静态文件 server (用来 serve client/tycoon_cocos/build/web-mobile/)
# @playwright/test 与基础镜像 playwright 版本严格对齐
# (mcr playwright 镜像只带浏览器二进制不带 npm 包, 必须显式装)
RUN npm install -g serve@14 @playwright/test@1.55.1

# 让项目的 playwright.config.ts 能 import 全局装的 @playwright/test
# (Node 默认 require 不查全局, 必须显式 NODE_PATH)
ENV NODE_PATH=/usr/lib/node_modules

# /workspace/web3-tycoon 是 bind mount 进来的项目根 (compose.yml 配置)
WORKDIR /workspace/web3-tycoon

# entrypoint 放 /opt 避免被 bind mount 覆盖
COPY scripts/ /opt/e2e/scripts/
RUN chmod +x /opt/e2e/scripts/*.sh

ENTRYPOINT ["/opt/e2e/scripts/entrypoint.sh"]
