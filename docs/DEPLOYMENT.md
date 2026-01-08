# Cloudflare Pages 自动部署指南

本文档说明如何配置 GitHub Actions 自动部署 Cocos Creator 构建的 Web 应用到 Cloudflare Pages。

## 📋 配置概览

- **构建产物路径**: `client/tycoon_cocos/build/web-mobile`
- **部署触发分支**: `dev`, `main`
- **部署工具**: GitHub Actions + Wrangler
- **托管平台**: Cloudflare Pages

## 🔧 前置准备

### 1. Cloudflare 配置

你需要从 Cloudflare Dashboard 获取以下信息：

#### 1.1 获取 Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在右侧边栏找到你的 **Account ID**
3. 复制备用

#### 1.2 创建 API Token

1. 访问 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Create Custom Token**
4. 配置权限：
   - **Token name**: `GitHub Actions - Cloudflare Pages`
   - **Permissions**:
     - Account / Cloudflare Pages / Edit
   - **Account Resources**:
     - Include / 选择你的账户
   - **TTL**: 根据需要设置（建议永久或长期有效）
5. 点击 **Continue to summary** → **Create Token**
6. **重要**: 复制生成的 Token（只会显示一次）

#### 1.3 确认 Cloudflare Pages 项目名称

- 如果已有项目，记录项目名称（如 `web3-tycoon`）
- 如果没有项目，可以使用任意名称，首次部署时会自动创建

### 2. GitHub Secrets 配置

1. 打开你的 GitHub 仓库
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，添加以下三个 secrets：

| Secret 名称 | 值 | 说明 |
|------------|-----|------|
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID | 从 Cloudflare Dashboard 获取 |
| `CLOUDFLARE_API_TOKEN` | 你的 API Token | 刚才创建的 API Token |
| `CLOUDFLARE_PROJECT_NAME` | 你的项目名称 | 如 `web3-tycoon-dev` |

## 🚀 使用流程

### 日常开发和部署

1. **在 Cocos Creator 中构建项目**
   - 打开 Cocos Creator 3.8.7
   - 菜单: **项目 → 构建**
   - 平台选择: **Web Mobile**
   - 点击 **构建**
   - 等待构建完成

2. **提交构建产物到 Git**
   ```bash
   # 查看构建产物状态
   git status client/tycoon_cocos/build/web-mobile

   # 添加所有构建产物
   git add client/tycoon_cocos/build/web-mobile

   # 提交（简洁的中文 commit message）
   git commit -m "build(web): 更新 web-mobile 构建"

   # 推送到远程仓库
   git push origin dev    # 或 main
   ```

3. **自动部署触发**
   - 推送后，GitHub Actions 会自动触发部署
   - 访问 GitHub 仓库的 **Actions** 标签查看部署进度
   - 部署成功后会显示部署 URL

4. **访问部署的应用**
   - **Production** (main 分支): `https://[PROJECT_NAME].pages.dev`
   - **Preview** (dev 分支): `https://[COMMIT_SHA].[PROJECT_NAME].pages.dev`

### 手动触发部署

如果需要重新部署而不推送新的 commit：

1. 进入 GitHub 仓库的 **Actions** 标签
2. 选择 **Deploy to Cloudflare Pages** workflow
3. 点击 **Run workflow**
4. 选择要部署的分支
5. 点击 **Run workflow** 按钮

## 📁 项目文件说明

### `.github/workflows/deploy-cloudflare.yml`

GitHub Actions 工作流配置文件，定义了自动部署流程：

- **触发条件**:
  - 推送到 `dev` 或 `main` 分支
  - 且 `client/tycoon_cocos/build/web-mobile/**` 有变更
  - 或手动触发 (`workflow_dispatch`)

- **部署步骤**:
  1. Checkout 代码
  2. 使用 Wrangler Action 部署到 Cloudflare Pages
  3. 输出部署信息

### `client/tycoon_cocos/.gitignore`

已配置为跟踪 `build/web-mobile/` 目录：

```gitignore
build/*
!build/web-mobile/
```

- 忽略所有 `build/` 目录下的文件
- 但保留 `build/web-mobile/` 目录的跟踪

## 🔍 故障排查

### 部署失败：API Token 权限不足

**错误信息**: `Authentication error`

**解决方案**:
1. 检查 `CLOUDFLARE_API_TOKEN` 是否正确配置
2. 确认 API Token 具有 **Cloudflare Pages Edit** 权限
3. 重新创建 API Token 并更新 GitHub Secret

### 部署失败：找不到项目

**错误信息**: `Project not found`

**解决方案**:
1. 检查 `CLOUDFLARE_PROJECT_NAME` 是否正确
2. 确认项目名称与 Cloudflare Pages 中的项目名称一致
3. 如果是首次部署，确保项目名称合法（小写字母、数字、连字符）

### 部署成功但页面无法访问

**可能原因**:
1. **缓存问题**: 清除浏览器缓存后重试
2. **构建配置错误**: 检查 Cocos Creator 构建配置
3. **资源路径错误**: 确认 Cocos Creator 构建时的路径配置正确

**调试步骤**:
1. 打开浏览器开发者工具（F12）
2. 查看 Console 和 Network 标签的错误信息
3. 检查资源加载是否正常

### 提交时 build/web-mobile 仍被忽略

**解决方案**:
```bash
# 强制添加文件
git add -f client/tycoon_cocos/build/web-mobile

# 检查 .gitignore 配置
cat client/tycoon_cocos/.gitignore | grep build

# 应该看到：
# build/*
# !build/web-mobile/
```

## 📊 工作流程图

```
┌─────────────────────┐
│ Cocos Creator 构建  │
│  (Web Mobile)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ git add + commit    │
│  build/web-mobile   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  git push origin    │
│    dev / main       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ GitHub Actions 触发 │
│  (自动检测变更)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Wrangler 部署到     │
│  Cloudflare Pages   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  部署完成 ✅        │
│  访问 Pages URL     │
└─────────────────────┘
```

## 🎯 最佳实践

### 1. 分支策略

- **dev 分支**: 开发环境，用于测试和预览
- **main 分支**: 生产环境，用于正式发布
- 在 dev 分支测试通过后再合并到 main

### 2. Commit 规范

使用简洁的中文 commit message：

```bash
# 好的示例
git commit -m "build(web): 修复资源加载问题"
git commit -m "build(web): 更新游戏逻辑"
git commit -m "build(web): 优化渲染性能"

# 避免的示例
git commit -m "update"
git commit -m "fix bug"
git commit -m "build"
```

### 3. 构建优化

- **生产构建**: 在 Cocos Creator 中启用代码压缩和资源优化
- **调试构建**: 开发时可以关闭压缩以便调试
- **增量构建**: 只提交变更的文件以减少 commit 大小

### 4. 监控和日志

- 定期查看 GitHub Actions 日志
- 关注部署时间和成功率
- 使用 Cloudflare Analytics 监控网站访问情况

## 🔗 相关链接

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Wrangler Action](https://github.com/cloudflare/wrangler-action)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Cocos Creator 文档](https://docs.cocos.com/creator/manual/zh/)

## ❓ 常见问题

### Q: 每次都需要手动构建吗？

A: 是的，目前需要在 Cocos Creator 中手动构建。未来可以考虑使用 Cocos Creator 的命令行工具自动化构建。

### Q: 可以只部署特定分支吗？

A: 可以，编辑 `.github/workflows/deploy-cloudflare.yml` 中的 `branches` 配置。

### Q: 部署需要多长时间？

A: 通常 2-5 分钟，取决于构建产物的大小和网络速度。

### Q: 可以回滚到之前的版本吗？

A: 可以，在 Cloudflare Pages Dashboard 中选择历史部署记录并回滚。

### Q: build/web-mobile 会占用很多 Git 空间吗？

A: 是的，建议定期清理历史 commit 或使用 Git LFS。

---

**文档版本**: 1.0
**最后更新**: 2025-10-17
**维护者**: Web3 Tycoon Team
