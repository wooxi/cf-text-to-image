# cf-text-to-image — Cloudflare 全家桶版

AI 文生图工作室，部署在 Cloudflare Pages + Workers Functions + D1 + R2。

## 架构

```
用户浏览器
    │
    ▼
Cloudflare Pages (静态前端)
    │  /api/*
    ▼
Pages Functions (API 路由)
    │
    ├── D1 (数据库：用户、关键词、历史、任务)
    ├── R2 (图片存储)
    └── Secrets (API Key 安全存储)
```

## 🔐 安全改造

- **API Key 不存数据库** → 用 `wrangler secret put` 注入环境变量
- **Config API 不暴露 Key 值** → 返回 "已设置"/"未设置"
- **管理后台** → 只能改非敏感配置

## 部署步骤

### 1. 安装依赖

```bash
cd cf-text-to-image
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 D1 数据库

```bash
npx wrangler d1 create txt2img-db
# 把返回的 database_id 填入 wrangler.toml 的 [[d1_databases]]
```

### 4. 创建 R2 存储桶

```bash
npx wrangler r2 bucket create txt2img-images
```

### 5. 初始化数据库

```bash
npx wrangler d1 execute txt2img-db --remote --file=./db/migrations/0000_init.sql
```

### 6. 设置 API Key（安全注入）

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put IMAGE_API_KEY
# 可选
npx wrangler secret put AGNES_API_KEY
npx wrangler secret put JWT_SECRET
```

### 7. 创建初始管理员

```bash
npx wrangler d1 execute txt2img-db --remote --command "INSERT INTO users (username, password_hash, created_at) VALUES ('admin', '<bcrypt_hash>', datetime('now'));"
```

### 8. 复制前端文件

从原项目复制：
```bash
# 从原项目 /root/text-to-image/ 复制
cp -r src/app/page.tsx src/app/globals.css src/app/icon.svg src/components/ src/lib/ public/ cf-text-to-image/
```

### 9. 部署

```bash
npm run pages:deploy
```

## 本地开发

```bash
npm run dev          # Next.js 开发服务器
npm run pages:dev    # Pages Functions + D1 本地模拟
```

## 设置 Secrets（完整列表）

| Secret | 说明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI/LibreChat API Key |
| `IMAGE_API_KEY` | 生图 API Key（可与上面相同） |
| `OPENAI_BASE_URL` | API 端点（非 OpenAI 时设置） |
| `JWT_SECRET` | JWT 签名密钥 |
| `AGNES_API_KEY` | Agnes 视频 API Key |
