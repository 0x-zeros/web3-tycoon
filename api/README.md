# Web3 Tycoon API

Cloudflare Workers API for Web3 Tycoon metadata service.

## 快速开始

### 1. 安装依赖

```bash
cd api
npm install
```

### 2. 创建KV命名空间

```bash
npm run kv:create
```

执行后会返回KV namespace ID，复制并填入`wrangler.toml`的`id`字段：

```toml
[[kv_namespaces]]
binding = "METADATA_KV"
id = "YOUR_KV_NAMESPACE_ID"  # 在这里填入
```

### 3. 创建R2存储桶

```bash
npm run r2:create
```

### 4. 本地开发

```bash
npm run dev
```

服务会在`http://localhost:8787`启动。

### 5. 部署到Cloudflare

```bash
npm run deploy
```

## API端点

### 健康检查

```
GET /health
```

### 玩家API

```
GET    /api/players/:address    # 获取玩家元数据
POST   /api/players             # 创建/更新玩家
PUT    /api/players/:address    # 更新玩家
```

### 游戏房间API

```
GET    /api/games               # 列出游戏房间
GET    /api/games/:gameId       # 获取游戏房间
POST   /api/games               # 创建游戏房间
PUT    /api/games/:gameId       # 更新游戏房间
```

## 测试API

### 创建玩家

```bash
curl -X POST http://localhost:8787/api/players \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x123",
    "nickname": "Alice"
  }'
```

### 获取玩家

```bash
curl http://localhost:8787/api/players/0x123
```

### 创建游戏房间

```bash
curl -X POST http://localhost:8787/api/games \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "0xabc",
    "roomName": "Test Game",
    "description": "A test game room",
    "hostAddress": "0x123"
  }'
```

### 列出游戏房间

```bash
curl "http://localhost:8787/api/games?status=waiting&limit=10"
```

## 项目结构

```
api/
├── src/
│   ├── index.ts              # Workers入口
│   ├── types.ts              # TypeScript类型定义
│   ├── routes/
│   │   ├── players.ts        # 玩家API
│   │   └── games.ts          # 游戏房间API
│   └── utils/
│       └── cors.ts           # CORS工具函数
├── wrangler.toml             # Cloudflare配置
├── package.json              # 项目依赖
└── tsconfig.json             # TypeScript配置
```

## 环境变量

在`wrangler.toml`中配置：

- `ENVIRONMENT`: 运行环境（production/development）

## 监控和调试

### 查看实时日志

```bash
npm run tail
```

### 开发环境部署

```bash
npm run deploy:dev
```

## 注意事项

1. KV namespace ID必须正确填入`wrangler.toml`
2. R2存储桶名称必须与配置一致
3. 首次部署前确保已登录Cloudflare：`wrangler login`
4. 免费额度限制：
   - KV: 10万次读取/天
   - Workers: 10万次请求/天
   - R2: 10GB存储 + 100万次读取/月

## License

MIT
