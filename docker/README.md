# Docker 环境总览

本项目按用途分了多套独立的 docker 环境，各自有清晰边界，互不干扰：

| 路径 | 用途 | 入口 | 状态 |
|---|---|---|---|
| `.devcontainer/` | AI/coding 长跑环境（Claude Code + Codex + suiup） | VS Code → `Dev Containers: Reopen in Container` | ✅ 已实施 |
| `docker/sui-dev/` | Move 部署 + 集成测试（带 localnet + faucet） | `cd docker/sui-dev && docker compose run --rm --service-ports sui-dev` | ✅ 已实施 |
| `docker/e2e/` | Playwright 端到端测试 | TBD | 📋 待 playwright 测试代码出现后再建 |

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
