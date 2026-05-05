# Docker 环境总览

本项目按用途分了多套独立的 docker 环境，各自有清晰边界，互不干扰：

| 路径 | 用途 | 入口 | 状态 |
|---|---|---|---|
| `.devcontainer/` | AI/coding 长跑环境（Claude Code + Codex + suiup） | VS Code → `Dev Containers: Reopen in Container` | ✅ 已实施 |
| `docker/sui-dev/` | Move 部署 + 集成测试（带 localnet + faucet） | `cd docker/sui-dev && docker compose run --rm --service-ports sui-dev` | ✅ 已实施 |
| `docker/e2e/` | Playwright 端到端测试（headless + GUI 双模式） | `cd docker/e2e && docker compose run --rm e2e` | ✅ 已实施 |

## 设计原则

- **长跑 vs 短跑分离**：devcontainer 是 attach 几小时改代码的"长跑"，sui-dev / e2e 是跑完即丢的"短跑"。塞一起会互相干扰
- **每个容器只装本职工具**：避免镜像膨胀
- **共享同一个 sui binary**：devcontainer 和 sui-dev 都通过 `suiup` 装 sui CLI，版本可独立升级

## 与 .devcontainer 的关系

devcontainer 里也有 sui CLI（通过 suiup），所以临时调试可以直接在 devcontainer 里 `sui start --with-faucet --force-regenesis &`。

但严肃的集成测试场景（每次都要干净状态、需要可复现的 ADMIN/PLAYER_A/PLAYER_B keys、要在 CI 里跑）应该走 `docker/sui-dev/`，不要污染 devcontainer。

## sui-dev 工作流

进容器：
```bash
cd docker/sui-dev
docker compose run --rm --service-ports sui-dev
```

发布合约（用项目自带 `move/scripts/publish.sh`，会自动更新 Cocos config）：
```bash
./move/scripts/publish.sh local
```

跑 Move 单测（不依赖链）：
```bash
cd move/tycoon && sui move test
```

### Postgres + GraphQL Indexer

`compose.override.yml` 默认会被 docker compose 自动加载，所以**起容器就自带 indexer**：
- Postgres: `postgres://sui:sui@postgres:5432/sui_indexer`（容器网络内）
- GraphQL endpoint: `http://localhost:9125/graphql`（host 可访问）

`SuiEventIndexer.ts` / GraphQL 客户端调试时直接用即可。

**不想要 indexer**（纯 localnet 节省资源）：
```bash
docker compose -f compose.yml run --rm --service-ports sui-dev
# 显式 -f compose.yml 跳过 override
```

### 完全清空重来

```bash
docker compose down -v
```
会删 keys、sui binary 缓存、Postgres 数据，下次启动会重建一切。

## e2e 工作流

测试代码在 `client/tycoon_cocos/tests/e2e/`，配置在 `client/tycoon_cocos/playwright.config.ts`。

**前置条件**：先在 host 的 Cocos Creator GUI 里 Build → web-mobile，产物 `client/tycoon_cocos/build/web-mobile/` 必须存在（容器不参与 build，Cocos 是 GUI 工具跑不进容器）。

**Headless 模式**（CI / 快速跑一遍）：
```bash
cd docker/e2e
docker compose run --rm e2e
```

**GUI 模式**（前期验证，浏览器观察 Chromium 跑测试）：
```bash
cd docker/e2e
docker compose -f compose.yml -f compose.gui.yml up
# 容器内会起 Xvfb + noVNC, host 浏览器开 http://localhost:7900/vnc.html 看
# 测试自动跑 --headed, 跑完保持容器存活让你重跑/调试
```

**重跑测试 / 调试 UI**（GUI 模式容器存活时）：
```bash
docker compose -f compose.yml -f compose.gui.yml exec e2e \
    bash -c 'cd client/tycoon_cocos && npx playwright test --ui'
```

**与 sui-dev 容器联动**：e2e 默认走 `host.docker.internal:9000`，所以先在 host 上 `cd docker/sui-dev && docker compose up -d` 把 localnet 起来即可。e2e 测试代码读 `process.env.SUI_RPC_URL`。

**输出位置**：`client/tycoon_cocos/test-results/` (raw) + `client/tycoon_cocos/playwright-report/` (HTML)，已 gitignore。

### 注意事项 / 常见踩坑

1. **Cocos 必须先 build**
   每次改了客户端代码要先在 host 的 Cocos Creator GUI 里重新 build 到
   `build/web-mobile/`，e2e 容器才能跑到最新版本。容器不参与 build——
   Cocos Creator 是 GUI 工具，跑不进 Linux 容器。

2. **测链上交互前先起 sui-dev**
   e2e 默认走 `host.docker.internal:9000`，链不在容器内。要测真链：
   ```bash
   cd docker/sui-dev && docker compose up -d
   ./move/scripts/publish.sh local      # publish 一次
   cd ../e2e && docker compose run --rm e2e
   ```
   测试代码里通过 `process.env.SUI_RPC_URL` 拿到 URL（环境变量在
   `docker/e2e/compose.yml` 注入）。不需要链时不起 sui-dev 即可。

3. **Cocos 加载/WebGL 初始化在容器里很慢**
   Headless Chromium + 容器内 WebGL（swiftshader 软渲染）大约要
   10–30 秒才能让 Cocos 全局对象就绪。`playwright.config.ts` 已经把
   timeout 拉到 60 秒。真业务测试不要直接断言"游戏 ready"，
   要用 `page.waitForFunction(() => globalThis.cc?.director?...)`
   之类等真实就绪信号。

4. **noVNC 默认无密码（只 bind 127.0.0.1 所以正常用安全）**
   `compose.gui.yml` 把 `7900` 显式 bind 到 `127.0.0.1`，外网/局域网
   访问不到。但如果你 SSH 端口转发了 7900，那一端别人能连进来看你
   的浏览器画面（甚至如果用 vnc 客户端连 5900，能控制鼠标键盘）。
   公司/咖啡馆 wifi 下用 SSH 反代时要意识到这点。
