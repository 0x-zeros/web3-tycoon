# Cloudflare Pages Web Walrus 部署配置指南

本文档介绍如何配置 Cloudflare Pages 部署 Web3 Tycoon 的 Web Walrus 版本，提供独立访问入口和 CDN 资源服务。

## 架构说明

Web3 Tycoon 使用双版本构建策略：

- **Web Mobile 版本** (`build/web-mobile`)：主版本，通过 Cloudflare Pages 部署完整应用
- **Web Walrus 版本** (`build/web-walrus`)：完整部署到 Cloudflare Pages
  - 可作为独立入口访问和测试：`https://cdn.web3tycoon.com/`
  - `remote` 文件夹作为 CDN 资源：`https://cdn.web3tycoon.com/remote/`
  - 同时也可以部署到 Walrus 去中心化存储（可选）

**域名**：`https://cdn.web3tycoon.com`

## 前置准备

### 1. Cloudflare 账户
- 注册并登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
- 确保域名 `web3tycoon.com` 已添加到 Cloudflare（或使用 Cloudflare 作为 DNS）

### 2. GitHub Secrets 配置

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加以下 secrets：

| Secret 名称 | 获取方式 | 用途 |
|------------|---------|------|
| `CLOUDFLARE_API_TOKEN` | 见下方步骤 | API 认证 |
| `CLOUDFLARE_ACCOUNT_ID` | 见下方步骤 | 账户标识 |

#### 获取 CLOUDFLARE_API_TOKEN

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 选择 "Edit Cloudflare Workers" 模板
4. **权限配置**：
   - Account → Cloudflare Pages → Edit
5. **Account Resources**：选择你的账户
6. **Zone Resources**：选择 `web3tycoon.com`
7. 点击 "Continue to summary" → "Create Token"
8. 复制 Token（只显示一次，请妥善保存）

#### 获取 CLOUDFLARE_ACCOUNT_ID

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧任意站点
3. 在右侧边栏找到 "Account ID"，点击复制

## Cloudflare Pages 项目配置

### 1. 创建 Pages 项目（CDN 专用）

**方式一：通过 Dashboard（首次推荐）**

1. 访问 [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. 点击 "Create a project"
3. 选择 "Connect to Git"（推荐）或 "Direct Upload"
4. **项目设置**：
   - Project name: `web3-tycoon-cdn`
   - Production branch: `main`
   - Build settings: 选择 "None"（直接部署静态文件）

**方式二：通过 GitHub Actions 自动创建**

首次推送代码到 GitHub 后，GitHub Actions 会自动创建项目（如果不存在）。

### 2. 配置自定义域名

#### 在 Cloudflare Pages 中添加域名

1. 进入 `web3-tycoon-cdn` 项目
2. 点击 "Custom domains" 标签
3. 点击 "Set up a custom domain"
4. 输入：`cdn.web3tycoon.com`
5. 点击 "Continue"
6. Cloudflare 会自动检测 DNS 配置

#### 配置 DNS 记录

如果 `web3tycoon.com` 使用 Cloudflare DNS，会自动创建 CNAME 记录。否则，手动添加：

```
类型：CNAME
名称：cdn
目标：web3-tycoon-cdn.pages.dev
代理状态：已代理（橙色云朵）
TTL：自动
```

#### 验证域名

1. DNS 记录生效后（通常几分钟），Cloudflare 会自动验证
2. 验证成功后，`cdn.web3tycoon.com` 会显示绿色 "Active" 状态
3. SSL 证书会自动配置（Let's Encrypt）

## 部署流程

### 自动部署（推荐）

当以下条件满足时，GitHub Actions 会自动触发 Web Walrus 部署：

1. **推送到 `main` 或 `dev` 分支**
2. **修改了 `client/tycoon_cocos/build/web-walrus/**` 路径下的任何文件**

部署 workflow 位置：`.github/workflows/deploy-cdn.yml`

### 手动部署

1. 访问 [Actions 页面](../../actions)
2. 选择 "Deploy Web Walrus to Cloudflare Pages"
3. 点击 "Run workflow"
4. 选择分支（`main` 或 `dev`）
5. 点击 "Run workflow" 确认

### 本地部署（测试）

使用 Wrangler CLI：

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 部署整个 web-walrus 目录
cd client/tycoon_cocos/build
wrangler pages deploy web-walrus --project-name=web3-tycoon-cdn
```

## 资源访问路径

部署后，资源访问路径规则：

### 生产环境（main 分支）

```
入口域名：https://cdn.web3tycoon.com
Cloudflare Pages 域名：https://web3-tycoon-cdn.pages.dev

访问路径示例：
1. 应用入口：
   - https://cdn.web3tycoon.com/
   - https://cdn.web3tycoon.com/index.html

2. CDN 资源（remote 文件夹）：
   - https://cdn.web3tycoon.com/remote/assets/texture.png
   - https://cdn.web3tycoon.com/remote/audio/bgm.mp3
   - https://cdn.web3tycoon.com/remote/models/character.gltf

3. 本地资源：
   - https://cdn.web3tycoon.com/assets/...
   - https://cdn.web3tycoon.com/cocos-js/...
```

### 预览环境（dev 分支）

```
预览 URL：https://<commit-sha>.web3-tycoon-cdn.pages.dev

例如：
1. 应用入口：
   - https://abc123def.web3-tycoon-cdn.pages.dev/

2. CDN 资源：
   - https://abc123def.web3-tycoon-cdn.pages.dev/remote/assets/texture.png
```

## 在 Cocos Creator 中配置 CDN

在 Cocos Creator 项目中配置远程资源 URL：

```typescript
// assets/scripts/config/ResourceConfig.ts

export class ResourceConfig {
    // 根据环境选择 CDN 地址
    static CDN_BASE_URL = (() => {
        if (window.location.hostname === 'localhost') {
            // 本地开发：使用相对路径
            return './remote';
        } else {
            // 生产环境：使用 CDN
            return 'https://cdn.web3tycoon.com/remote';
        }
    })();

    // 加载远程资源
    static getRemoteUrl(path: string): string {
        // path 不应该包含 'remote' 前缀
        return `${this.CDN_BASE_URL}/${path}`;
    }
}
```

使用示例：

```typescript
// 加载远程纹理（注意：path 不包含 remote 前缀）
const url = ResourceConfig.getRemoteUrl('assets/texture.png');
// 实际 URL: https://cdn.web3tycoon.com/remote/assets/texture.png

resources.load(url, Texture2D, (err, texture) => {
    if (err) {
        console.error('加载远程资源失败:', err);
        return;
    }
    // 使用纹理
});
```

## 测试 Web Walrus 入口

部署完成后，可以通过以下方式测试应用入口：

### 1. 访问入口页面

```bash
# 生产环境
open https://cdn.web3tycoon.com

# 预览环境（替换 commit-sha）
open https://<commit-sha>.web3-tycoon-cdn.pages.dev
```

### 2. 验证 CDN 资源加载

打开浏览器开发者工具：
1. 访问 `https://cdn.web3tycoon.com`
2. 打开 Network 面板
3. 刷新页面
4. 检查 `remote/` 路径下的资源是否正确加载

### 3. 对比两个版本

| 特性 | Web Mobile | Web Walrus |
|-----|-----------|-----------|
| 部署位置 | Cloudflare Pages | Cloudflare Pages |
| 入口 URL | `web3tycoon.com` | `cdn.web3tycoon.com` |
| Remote 资源 | 本地或 CDN | CDN (`/remote/`) |
| 用途 | 主要版本 | 测试 + CDN |

## 性能优化建议

### 1. 启用缓存头

在 Pages 项目根目录创建 `_headers` 文件（可选）：

```
# 远程资源缓存（长期缓存）
/remote/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

# HTML 文件（不缓存）
/*.html
  Cache-Control: public, max-age=0, must-revalidate

# 其他静态资源（中期缓存）
/assets/*
  Cache-Control: public, max-age=86400
  Access-Control-Allow-Origin: *
```

**注意**：这个文件应该放在：
`client/tycoon_cocos/build/web-walrus/_headers`

### 2. 压缩优化

Cloudflare 自动压缩以下格式：
- Gzip
- Brotli（更高压缩率）

无需额外配置，自动生效。

### 3. 图片优化

考虑使用 Cloudflare Images（付费功能）：
- 自动格式转换（WebP、AVIF）
- 响应式图片尺寸
- 智能压缩

### 4. 预加载关键资源

在 HTML 中添加 `<link rel="preload">`（如果需要）：

```html
<link rel="preload" href="https://cdn.web3tycoon.com/remote/assets/critical-texture.png" as="image">
```

## 监控和调试

### 查看部署日志

1. **GitHub Actions**：查看 workflow 运行日志
2. **Cloudflare Dashboard**：
   - 进入 `web3-tycoon-cdn` 项目
   - 点击 "Deployments" 查看部署历史
   - 点击任意部署查看详细日志

### 分析访问统计

1. 进入 `web3-tycoon-cdn` 项目
2. 点击 "Analytics" 标签
3. 查看：
   - 请求数量
   - 带宽使用
   - 响应时间
   - 热门资源

### 测试可用性

```bash
# 测试 DNS 解析
nslookup cdn.web3tycoon.com

# 测试入口页面
curl -I https://cdn.web3tycoon.com

# 测试 CDN 资源
curl -I https://cdn.web3tycoon.com/remote/assets/test.png

# 测试本地资源
curl -I https://cdn.web3tycoon.com/assets/test.png
```

## 常见问题

### Q: 部署后资源 404

**A**: 检查以下几点：
1. 确认 `web-walrus` 文件夹存在且有内容
2. 检查 GitHub Actions 日志，确认部署成功
3. 等待 DNS 传播（最多 24 小时，通常几分钟）
4. 检查文件路径是否正确（区分大小写）
5. CDN 资源路径必须包含 `/remote/` 前缀

### Q: 自定义域名 SSL 证书错误

**A**:
1. 等待 SSL 证书自动签发（通常 5-15 分钟）
2. 确认 DNS CNAME 记录正确
3. 确保代理状态为"已代理"（橙色云朵）

### Q: 如何回滚到之前的版本？

**A**:
1. 进入 Cloudflare Dashboard → Pages → `web3-tycoon-cdn`
2. 点击 "Deployments"
3. 找到要回滚的版本，点击 "..."
4. 选择 "Rollback to this deployment"

### Q: 如何清除 CDN 缓存？

**A**:
1. 进入 Cloudflare Dashboard → Websites → `web3tycoon.com`
2. 点击 "Caching" → "Configuration"
3. 点击 "Purge Cache"
4. 选择：
   - Purge Everything（清除所有）
   - Custom Purge（清除特定 URL）

## 成本估算

### Cloudflare Pages 免费额度

- **请求数**：无限制
- **带宽**：无限制
- **构建次数**：500 次/月
- **并发构建**：1 个

**付费计划（Pro）**：$20/月
- 构建次数：5000 次/月
- 并发构建：5 个
- 更快的构建速度

对于一般项目，**免费额度通常足够**。

## 安全建议

1. **API Token 权限最小化**：只授予 Pages 编辑权限
2. **定期轮换 Token**：建议每 3-6 个月更换一次
3. **监控异常流量**：使用 Cloudflare Analytics 监控
4. **启用 WAF**（付费功能）：防止恶意请求

## 相关文档

- [Cloudflare Pages 官方文档](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions 集成](https://github.com/cloudflare/wrangler-action)

## 支持

如有问题，请联系：
- 项目负责人：[Your Name]
- Cloudflare 社区：https://community.cloudflare.com/
