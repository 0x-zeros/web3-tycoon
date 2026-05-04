#!/usr/bin/env bash
# Playwright e2e entrypoint:
#   1. 校验 build/web-mobile/ 存在 (Cocos Creator GUI build 出来的产物, 容器内不重 build)
#   2. GUI 模式: 起 Xvfb + fluxbox + x11vnc + websockify (noVNC :7900)
#   3. 起静态 server serve build/web-mobile (port 8080)
#   4. 跑 playwright test (headless 或 --headed)
#   5. headless 模式跑完即退; GUI 模式保持存活方便观察 / 重跑
set -e

E2E_GUI="${E2E_GUI:-0}"
PROJECT_ROOT=/workspace/web3-tycoon
CLIENT_DIR="$PROJECT_ROOT/client/tycoon_cocos"
BUILD_DIR="$CLIENT_DIR/build/web-mobile"

# ---------- 校验 build 产物 ----------
if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo "[e2e] ERROR: $BUILD_DIR/index.html not found." >&2
    echo "[e2e] 请先在 host 的 Cocos Creator GUI 里 Build → web-mobile, 然后再起 e2e 容器。" >&2
    exit 1
fi

# 用于 trap 清理后台进程
XVFB_PID=""
WEBSOCKIFY_PID=""
SERVE_PID=""

cleanup() {
    [ -n "$SERVE_PID" ]      && kill "$SERVE_PID" 2>/dev/null || true
    [ -n "$WEBSOCKIFY_PID" ] && kill "$WEBSOCKIFY_PID" 2>/dev/null || true
    [ -n "$XVFB_PID" ]       && kill "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT

# ---------- GUI 模式启动 Xvfb + VNC stack ----------
if [ "$E2E_GUI" = "1" ]; then
    echo "[e2e] GUI 模式: 启动 Xvfb + noVNC..."
    Xvfb :0 -screen 0 1280x720x24 -ac +extension GLX +render -noreset >/dev/null 2>&1 &
    XVFB_PID=$!
    export DISPLAY=:0

    # 等 Xvfb ready
    for _ in {1..40}; do
        if xdpyinfo -display :0 >/dev/null 2>&1; then break; fi
        sleep 0.25
    done

    fluxbox >/dev/null 2>&1 &

    # x11vnc -bg 自己 daemonize, listen localhost 防止 VNC 协议直接对外
    x11vnc -display :0 -forever -shared -nopw -bg -quiet -listen localhost

    # websockify 把 :5900 (VNC) 桥到 :7900 (WebSocket), 同时静态 serve novnc 网页
    websockify --web=/usr/share/novnc 7900 localhost:5900 >/dev/null 2>&1 &
    WEBSOCKIFY_PID=$!

    echo "[e2e] noVNC ready: http://localhost:7900/vnc.html (host 浏览器打开即可观察)"
fi

# ---------- 静态 server ----------
echo "[e2e] 启动静态 server: $BUILD_DIR -> :8080"
# -s 表示 single-page (任何路径都 fallback 到 index.html), Cocos 项目不一定需要但加着无害
serve -s "$BUILD_DIR" -l 8080 >/dev/null 2>&1 &
SERVE_PID=$!

# 等 server ready
for _ in {1..30}; do
    if curl -s -o /dev/null http://127.0.0.1:8080/index.html; then break; fi
    sleep 0.5
done
echo "[e2e] 静态 server ready: http://localhost:8080"

# ---------- 跑测试 ----------
cd "$CLIENT_DIR"

if [ "$E2E_GUI" = "1" ]; then
    echo "[e2e] 跑测试 (--headed)..."
    npx playwright test --headed || true
    echo ""
    echo "================================================"
    echo "[e2e] 测试结束。容器保持存活方便 noVNC 观察 / 重跑。"
    echo "[e2e] 重跑: docker compose -f compose.yml -f compose.gui.yml exec e2e \\"
    echo "         bash -c 'cd client/tycoon_cocos && npx playwright test --headed'"
    echo "[e2e] 调试 UI 模式: ... npx playwright test --ui"
    echo "[e2e] 关闭: docker compose down"
    echo "================================================"
    sleep infinity
else
    echo "[e2e] 跑测试 (headless)..."
    exec npx playwright test
fi
