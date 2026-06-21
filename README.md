<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/platform-Cloudflare-orange" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D22.0-brightgreen" alt="Node">
</p>

<h1 align="center">CF Text-to-Image Studio</h1>

<p align="center">
  <strong>AI 创意工坊 · 全栈 Serverless · 一键部署</strong><br>
  基于 Cloudflare 全家桶的 AI 文生图 / 图生图 / 视频生成工作室
</p>

---

<!-- ═══════════════════ 插图 · 首页截图 ═══════════════════ -->
<!-- ![](docs/screenshots/homepage.png) -->

---

## 目录

- [简介](#简介)
- [核心能力](#核心能力)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [配置参考](#配置参考)
- [API 文档](#api-文档)
- [数据库设计](#数据库设计)
- [部署指南](#部署指南)
- [可观测性](#可观测性)
- [常见问题](#常见问题)
- [经验总结](#经验总结)
- [维护与贡献](#维护与贡献)

---

## 简介

**CF Text-to-Image Studio** 是一个完整部署在 Cloudflare 边缘网络上的 AI 图像与视频生成工作室。

用户通过可视化界面选择关键词、撰写提示词，由 LLM 辅助生成高质量画面描述，再通过异步任务队列调用图像/视频模型完成创作。整个系统从前端页面、API 接口、数据库、对象存储到后台消费者全部运行在 Cloudflare 上，无需管理任何服务器。

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 + React 18 + Tailwind CSS 3 | App Router，静态导出 |
| API | Cloudflare Pages Functions | 文件路由，零配置部署 |
| 数据库 | Cloudflare D1 | SQLite 兼容，边缘分布式 |
| 对象存储 | Cloudflare R2 | S3 兼容，零出站费用 |
| 异步任务 | Cloudflare Queues | 可靠投递，自动重试 |
| 后台消费 | Cloudflare Worker | 独立运行时，长任务处理 |
| 认证 | JWT (jose) + bcryptjs | 无状态鉴权 |
| CI/CD | GitHub Actions | 推送即部署 |

### 为什么选择全 Serverless

- **零服务器运维** — 无需管理实例、操作系统或容器编排
- **按量付费** — 没有请求时不产生费用
- **边缘就近** — Pages 和 Worker 运行在全球边缘节点
- **弹性伸缩** — Cloudflare 自动处理流量峰值

---

## 核心能力

### 🎨 三种创作模式

| 模式 | 说明 |
|------|------|
| **关键词导演** | 按"主体 → 环境 → 服装 → 姿态 → 镜头 → 风格 → 输出"逐层选词，LLM 自动编排成完整提示词 |
| **参考图编辑** | 上传参考图 + 编辑指令，保留构图的前提下修改服装、色调、风格 |
| **视频生成** | 支持文生视频、参考图视频、关键帧动画，可调分辨率 / 帧数 / 帧率 |

<!-- ![](docs/screenshots/keyword-selector.png) -->
<!-- ![](docs/screenshots/img2img-mode.png) -->
<!-- ![](docs/screenshots/video-mode.png) -->

### 🤖 AI 辅助

- **提示词生成** — 选中关键词，一键让 LLM 生成 80-300 字的完整中文画面描述
- **提示词润色** — 对已有文本进行扩写、增强氛围、提升文学性
- **模型切换** — 支持 OpenAI 兼容接口，可在后台自由配置端点与模型

### ⚡ 异步任务系统

```
用户提交 → 任务入库 → 入队(Queue) → Worker 消费 → 调用模型 API → 结果写 R2 + D1
```

- 前端提交后立即可继续操作，不阻塞
- 实时轮询任务状态 (pending → processing → completed / failed)
- 失败任务支持一键重试
- 生成结果自动归档到历史画廊

### 🔐 后台管理

- JWT 账号体系，注册/登录/鉴权
- 模型端点、API Key、模型名称可视化配置
- 系统提示词 (生图 / 视频 / 润色) 可自定义
- 关键词分组管理，支持单选 / 多选 / 最大数量限制

---

## 系统架构

```
                              ┌──────────────────────┐
                              │      GitHub Actions   │
                              │   push → build →     │
                              │   deploy Pages +     │
                              │   deploy Worker      │
                              └──────────┬───────────┘
                                         │
  ┌──────────┐     HTTPS      ┌─────────▼──────────┐
  │  Browser  │───────────────│  Cloudflare Pages    │
  │           │◀──────────────│  cf-text-to-image    │
  └──────────┘                │                      │
                              │  ┌────────────────┐  │
                              │  │ Next.js (static)│  │
                              │  └────────────────┘  │
                              │  ┌────────────────┐  │
                              │  │ Pages Functions │  │
                              │  │ /api/*          │  │
                              │  └───────┬────────┘  │
                              └──────────┼───────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
              │    D1      │      │     R2      │     │   Queue     │
              │ txt2img-db │      │txt2img-images│     │txt2img-task │
              │            │      │             │     │             │
              │ · users    │      │ · 生成图片   │     │ · task msgs │
              │ · tasks    │      │ · 参考图     │     │             │
              │ · config   │      │             │     │             │
              │ · keywords │      │             │     │             │
              │ · history  │      │             │     │             │
              └────────────┘      └─────────────┘     └──────┬──────┘
                                                            │
                                                  ┌─────────▼──────────┐
                                                  │  Worker Consumer   │
                                                  │  task-consumer     │
                                                  │                    │
                                                  │  processImage()    │
                                                  │  processVideo()    │
                                                  └────────┬───────────┘
                                                           │
                                                    ┌──────▼──────┐
                                                    │  External   │
                                                    │  Model APIs │
                                                    │             │
                                                    │  · LLM      │
                                                    │  · Image    │
                                                    │  · Video    │
                                                    └─────────────┘
```

### 两个 Cloudflare 服务

| 名称 | 类型 | 职责 |
|------|------|------|
| `cf-text-to-image` | Cloudflare Pages | 前端页面 + `/api/*` 接口 + 鉴权 + 任务入队 |
| `cf-text-to-image-task-consumer` | Cloudflare Worker | 消费 Queue → 调模型 API → 写回 D1 和 R2 |

> **不是两个网站**。用户只访问 Pages 项目，Worker 是后台消费者，对用户不可见。

### 任务队列设计

- **单队列，多并发** — 一个 `txt2img-task-queue`，Worker 端 `max_concurrency = 3`，最多同时处理 3 个任务
- **乐观锁** — 消费时 UPDATE `WHERE status IN ('pending','failed')`，0 rows changed 则跳过，防止重复处理
- **自动重试** — `max_retries = 1`，失败消息自动重新投递一次

### 超时保护

所有对外 API 调用均设置 `AbortController` 超时：

| 端点 | 超时 | 说明 |
|------|------|------|
| `/api/generate-prompt` (LLM) | 25s | 提示词生成 |
| `/api/polish` (LLM) | 25s | 提示词润色 |
| `processImage()` (图像 API) | 无 | 在 Queue Worker 中运行，Worker 有更长时限 |
| `processVideo()` (视频 API) | 无 | 同上 |

---

## 快速开始

### 前置条件

- Node.js ≥ 22
- Cloudflare 账号
- wrangler CLI (`npm i -g wrangler`)
- 模型 API 端点及 Key

### 一键脚本

```bash
git clone https://github.com/wooxi/cf-text-to-image.git
cd cf-text-to-image
bash setup-cf.sh
```

脚本会自动完成：创建 D1 数据库 → 创建 R2 存储桶 → 执行数据库迁移 → 引导设置 API Key → 创建管理员 → 首次部署。

### 手动步骤

#### 1. 安装依赖 & 构建

```bash
npm install
npm run build
```

#### 2. 创建 Cloudflare 资源

```bash
npx wrangler d1 create txt2img-db
npx wrangler r2 bucket create txt2img-images
npx wrangler queues create txt2img-task-queue
```

将 `wrangler.toml` 中的 `database_id` 替换为实际 D1 ID。

#### 3. 数据库迁移

```bash
npx wrangler d1 execute txt2img-db --remote --file=db/migrations/0000_init.sql
npx wrangler d1 execute txt2img-db --remote --file=db/migrations/0001_task_request_json.sql
```

#### 4. 部署

```bash
npx wrangler pages deploy out --project-name=cf-text-to-image --branch=master
npx wrangler deploy --config queue-worker/wrangler.toml
```

#### 5. 创建管理员

```bash
# 在 D1 中手动插入
npx wrangler d1 execute txt2img-db --remote --command \
  "INSERT INTO users (username, password_hash, created_at) VALUES ('admin', '<bcrypt_hash>', datetime('now'));"
```

---

## 项目结构

```
cf-text-to-image/
├── src/                          # 前端 (Next.js 14 App Router)
│   ├── app/
│   │   ├── page.tsx              # 桌面端主页
│   │   ├── admin/page.tsx        # 后台管理面板
│   │   ├── layout.tsx            # 根布局 (ThemeProvider)
│   │   └── globals.css           # 全局样式 + CSS 变量
│   ├── components/
│   │   ├── Header.tsx            # 顶栏
│   │   ├── KeywordSelector.tsx   # 关键词筛选面板
│   │   ├── ImageUploader.tsx     # 图片上传 (拖拽/粘贴/URL)
│   │   ├── MasonryGallery.tsx    # 瀑布流画廊
│   │   ├── TaskCard.tsx          # 任务卡片 (进度/状态/重试)
│   │   ├── ImageCard.tsx         # 单张图片卡片
│   │   ├── LoginModal.tsx        # 登录弹窗
│   │   ├── FullscreenViewer.tsx  # 全屏图片查看器
│   │   ├── MobileHome.tsx        # 移动端主页
│   │   └── ThemeProvider.tsx     # 主题上下文
│   ├── lib/
│   │   ├── keyword-presets.ts    # 默认关键词数据
│   │   └── generated-media.ts    # 媒体工具函数
│   └── types/index.ts            # TypeScript 类型定义
│
├── functions/                    # Cloudflare Pages Functions
│   ├── auth.ts                   # JWT 签发/验证/中间件
│   ├── db.ts                     # D1 连接, Env 接口, 配置读取
│   ├── task-processing.ts        # 图像/视频处理核心逻辑
│   └── api/
│       ├── auth/login.ts         # 登录
│       ├── auth/register.ts      # 注册
│       ├── auth/me.ts            # 当前用户
│       ├── config.ts             # GET/PUT 系统配置
│       ├── generate-prompt.ts    # POST 关键词 → LLM 生成提示词
│       ├── generate-image.ts     # POST 直接生图 (旧端点)
│       ├── polish.ts             # POST 提示词润色
│       ├── tasks.ts              # 任务 CRUD (GET/POST/PUT/DELETE)
│       ├── history.ts            # 历史记录管理
│       ├── keywords.ts           # 关键词分组管理
│       ├── models.ts             # 获取可用模型列表
│       └── images.ts             # 从 R2 返回图片
│
├── queue-worker/                 # Queue Consumer Worker
│   ├── task-consumer.ts          # 入口, 消费队列消息
│   └── wrangler.toml             # 独立 wrangler 配置
│
├── db/migrations/                # D1 数据库迁移
│   ├── 0000_init.sql             # 初始表结构
│   └── 0001_task_request_json.sql # 增加 request_json 列
│
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions 自动部署
│
├── wrangler.toml                 # Pages 项目的 wrangler 配置
├── next.config.js                # Next.js 配置 (静态导出)
├── tailwind.config.ts            # Tailwind CSS 配置
├── tsconfig.json                 # TypeScript 配置
├── package.json                  # 依赖与脚本
└── setup-cf.sh                   # 一键初始化脚本
```

---

## 配置参考

所有配置项存储在 D1 的 `config` 表中，支持密钥标记。后台管理页面提供可视化编辑。

### 模型端点

| Key | 说明 | 默认值 |
|-----|------|--------|
| `llm_endpoint` | LLM API 地址 | `https://api.openai.com/v1` |
| `llm_api_key` | LLM API Key (密钥) | — |
| `llm_model` | LLM 模型名 | `gpt-4o` |
| `image_endpoint` | 图像 API 地址 | 同 llm_endpoint |
| `image_api_key` | 图像 API Key (密钥) | 同 llm_api_key |
| `image_model` | 图像模型名 | `dall-e-3` |
| `image_provider` | 图像接口类型 | `openai_image` |
| `video_endpoint` | 视频 API 地址 | `https://apihub.agnes-ai.com` |
| `video_api_key` | 视频 API Key (密钥) | — |
| `video_model` | 视频模型名 | `agnes-video-v2.0` |

### image_provider 说明

| 值 | 图像请求格式 |
|----|-------------|
| `openai_image` | 文生图 `POST /images/generations`，图生图 `POST /images/edits` |
| `agnes_image` | 统一 `POST /images/generations`，图像通过 `extra_body.image` 传递 |

### 系统提示词

| Key | 说明 |
|-----|------|
| `prompt_system_image` | 生图模式的 LLM 系统提示词 |
| `prompt_system_video` | 视频模式的 LLM 系统提示词 |
| `prompt_system_polish` | 润色模式的 LLM 系统提示词 |

---

## API 文档

所有 API 需携带 Cookie 中的 JWT Token（通过 `/api/auth/login` 获取）。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录，body: `{ username, password }` |
| `POST` | `/api/auth/register` | 注册（需 `ENABLE_REGISTRATION=true`） |
| `GET` | `/api/auth/me` | 获取当前用户信息 |

### 关键词

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/keywords` | 获取所有关键词分组 |
| `POST` | `/api/keywords` | 创建/更新关键词分组 (admin) |

### 生成

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/generate-prompt` | 关键词生成提示词<br>`{ keywords: [{ name, groupSlug, facetSlug }], mode?: "video" }` → `{ success, data: { prompt } }` |
| `POST` | `/api/polish` | 润色提示词<br>`{ text, mode? }` → `{ success, data: { text } }` |
| `POST` | `/api/generate-image` | 直接生图（不走队列）<br>`{ prompt, keywords?, size?, image? }` |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/tasks` | 创建任务 `<br>{ type, keywords?, prompt?, size?, image?, width?, height?, num_frames?, frame_rate?, video_mode? }` → `{ success, data: { taskId } }` |
| `GET` | `/api/tasks?status=pending,processing,failed` | 查询任务列表 |
| `PUT` | `/api/tasks` | 重试失败任务<br>`{ id }` |
| `DELETE` | `/api/tasks?id=N` | 删除任务 |

### 历史 & 图片

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/history` | 获取历史记录 (DESC, LIMIT 50) |
| `DELETE` | `/api/history?id=N` | 删除历史记录 |
| `GET` | `/api/images?file=xxx.png` | 从 R2 返回图片 |

### 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/config` | 获取所有配置（密钥值显示为 `***`） |
| `PUT` | `/api/config` | 更新配置<br>`{ key, value, isSecret? }` |

### 错误响应格式

```json
{
  "success": false,
  "error": "描述信息"
}
```

| HTTP Status | 含义 |
|-------------|------|
| 400 | 参数错误或配置缺失 |
| 401 | 未登录 |
| 500 | 内部错误 |
| 502 | 上游模型 API 错误 |
| 504 | 上游超时 (或 API Gateway 超时) |

---

## 数据库设计

### 核心表

```sql
-- 用户
users (id, username, password_hash, created_at)

-- 关键词分组 (如: 主体、环境、服装、风格...)
keyword_groups (id, name, slug, sort_order, is_parameter_group, description)

-- 关键词 (含 selection_mode: single/multiple, max_select)
keywords (id, group_id, name, sort_order, selection_mode, max_select)

-- 系统配置 (key/value 存储, is_secret 标记密钥)
config (id, key, value, is_secret, updated_at)

-- 生成历史
image_history (id, keyword_names, prompt, image_path, type, poster_path, size, created_at)

-- 异步任务 (含完整 request_json 用于重放)
tasks (id, status, type, keyword_names, prompt, image_path,
       reference_image, video_path, poster_path, progress,
       size, error, request_json, created_at, updated_at)
```

### 任务状态机

```
pending ──→ processing ──→ completed
   │                          │
   └──── failed ◀─────────────┘
            │
            └── (retry) → pending
```

---

## 部署指南

### GitHub Actions

推送到 `master` 分支自动触发部署。需要以下 GitHub Secrets：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token (需 Pages/Workers/D1/R2/Queues 权限) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |

部署流程：

1. `npm ci` → `npm run build`
2. 确保 `txt2img-task-queue` 存在 (不存在则创建)
3. `wrangler pages deploy` — 部署 Pages
4. `wrangler deploy --config queue-worker/wrangler.toml` — 部署 Queue Consumer

### 手动部署

```bash
# Pages
npx wrangler pages deploy out --project-name=cf-text-to-image --branch=master

# Worker
npx wrangler deploy --config queue-worker/wrangler.toml
```

### 环境变量

| 变量 | 位置 | 默认值 | 说明 |
|------|------|--------|------|
| `JWT_SECRET` | wrangler.toml vars | 内置默认 | JWT 签名密钥，生产环境建议覆盖 |
| `ENABLE_REGISTRATION` | wrangler.toml vars | `"true"` | 是否允许注册 |
| `LLM_ENDPOINT` | env vars / config 表 | — | 覆盖 D1 中的配置 |
| `LLM_API_KEY` | env vars / config 表 | — | 覆盖 D1 中的密钥 |

> **安全提示**：生产环境中应在 Cloudflare Dashboard 的 Pages 环境变量中设置 `JWT_SECRET` 和 API Key，而非硬编码在 `wrangler.toml`。

---

## 可观测性

Queue Consumer Worker 已启用 `observability`，所有日志通过 `console.log` 输出结构化 JSON，可在 Cloudflare Dashboard → Workers & Pages → `cf-text-to-image-task-consumer` → Logs 查看。

### 日志事件速查表

#### 请求方向 (→ 发给模型 API)

| event | 含义 | 关键字段 |
|-------|------|----------|
| `→ image-req` | 图像 API 请求 | `endpoint, provider, model, size, requestBody` |
| `→ video-req` | 视频 API 请求 | `endpoint, model, requestBody` |

#### 响应方向 (← 模型 API 返回)

| event | 含义 | 关键字段 |
|-------|------|----------|
| `← image-ok` | 图像生成成功 | `imagePath` |
| `← image-err` | 图像生成失败 | `status, responseBody` |
| `← video-ok` | 视频生成成功 | `videoUrl` |
| `← video-err` | 视频生成失败 | `status, responseBody` |

#### 任务生命周期 (task:)

| event | 含义 |
|-------|------|
| `task:start` | 任务开始处理 (已获取锁) |
| `task:fail` | 任务失败 (已写 error 到 DB) |
| `task:lock-skip` | 乐观锁碰撞，跳过 (已被其他消费者处理) |
| `task:skip-done` | 跳过已完成任务 |
| `task:missing` | 任务不存在 |

#### 队列层面 (scope: queue-consumer)

| event | 含义 |
|-------|------|
| `batch-start` | 批次开始，含 `ids` 数组 |
| `task-start` | 单个任务开始处理 |
| `task-finish` | 单个任务处理完成 |
| `batch-finish` | 批次处理完成 |

### 排查工作流

```
1. 搜 taskId → 看是否有 batch-start (确认入队)
2. 看 task:start (确认被消费且获得锁)
3. 看 → image-req 的 requestBody (确认请求体正常)
4. 看 ← image-err 的 responseBody 和 status (定位根因)
5. 看 task:fail (确认错误已记录)
```

---

## 常见问题

### Q: 为什么任务报 504 错误？

A: 504 有两种情况：

1. **前端提交时 504** — Pages Function 调用 LLM 超时。已通过 25s AbortController 超时保护修复，会返回 JSON 错误而非空白页
2. **任务处理时 504** — Queue Worker 调图像 API 超时。这是上游模型 API 网关的超时 (`error code: 504`)，说明模型生成太慢，超过了 API 网关的超时阈值。解决方向：调大 API 网关超时、换更快模型、或加重试机制

**排查方法**：在 Cloudflare Logs 搜 `← image-err`，看 `responseBody` 是否包含 `error code: 504`。

### Q: 连续点击能同时生成多张图吗？

A: 能。当前 Queue Worker 配置 `max_concurrency = 3`，最多同时处理 3 个任务。超过 3 个的任务在队列中排队等候。

### Q: 生成提示词和提交生图冲突吗？

A: 不冲突。前端有独立的 `textActionLock` 防止重复触发提示词生成；而提交生图走的是异步队列，有独立的提交锁。两者可同时操作。

### Q: 提示词生成返回"调用超时"？

A: 说明 LLM 响应超过了 25s。可能是模型负载高或 prompt 太长。稍后重试即可。

### Q: Cloudflare 里有两个服务，是什么关系？

A: `cf-text-to-image` (Pages) 是用户访问的站点；`cf-text-to-image-task-consumer` (Worker) 是后台消费者，处理队列中的生图/视频任务。用户不直接访问 Worker。

### Q: 如何修改生成的图片尺寸？

A: 在"输出规格"关键词组中选择比例 (1:1, 9:16, 16:9, 4:3, 3:4) 和分辨率 (512~2048)。不选则默认 1024x1024。

### Q: 支持哪些图像模型？

A: 理论支持所有 OpenAI 兼容接口。已测试：
- OpenAI 原生 (`openai_image`) — `gpt-image-2`, `dall-e-3`
- Agnes 网关 (`agnes_image`) — 通过 `extra_body` 传参

### Q: 数据库怎么备份？

A: Cloudflare D1 自带时间点恢复 (Point-in-Time Recovery)。也可通过 `wrangler d1 export txt2img-db --remote` 导出。

---

## 经验总结

### 请求体兼容性

不同 provider 的请求体格式有细微差异，需严格测试：

- OpenAI `n: 1` 参数在某些代理网关上会触发 504（已移除）
- `thinking: { type: "disabled" }` 非所有 API 支持
- Agnes provider 的图像通过 `extra_body.image` 传递，而非顶层 `image` 字段

### 并发设计演变

| 阶段 | 方案 | 并发 |
|------|------|------|
| v1 | 请求内同步调模型 API | 受 Pages Function 时限限制，504 频繁 |
| v2 | 双队列 (A/B) 按 taskId 奇偶分流 | 2 (每条队列串行) |
| v3 | 单队列 + `max_concurrency = 3` | 3 |

当前 v3 方案更简洁：一个 Queue + 一个 Worker + `max_concurrency` 控制并发。

### 架构决策记录

1. **Queue 而非直接调用** — Pages Function 有时长限制（免费 10s/付费 30s），图像/视频生成远超此时限，必须异步
2. **乐观锁而非悲观锁** — D1 不支持行级锁，使用 `UPDATE … WHERE status IN ('pending','failed')` 实现轻量级并发控制
3. **request_json 快照** — 任务创建时保存完整请求 JSON，避免重试时前端状态丢失
4. **结构化日志** — 用 `→` `←` 箭头区分请求/响应方向，用 `task:` 前缀标记生命周期事件

---

## 维护与贡献

### 新增 API 端点

1. 在 `functions/api/` 下创建文件，导出 `onRequest[Method]` 函数
2. 路由即文件名：`functions/api/foo.ts` → `GET /api/foo`
3. 使用 `requireAuth(context.env, context.request)` 做身份验证

### 新增模型 Provider

1. 在 `task-processing.ts` 的 `processImage()` 中添加新的 provider 分支
2. 确保 `reqBody` 格式匹配该 provider 的 API 规范
3. 在后台管理 / README 中补充 provider 说明

### 本地开发

```bash
npm run dev              # Next.js dev server
npm run pages:dev        # wrangler pages dev (模拟 CF 环境)
npm run db:migrate:local # 本地 D1 迁移
```

### 提交规范

- `feat:` — 新功能
- `fix:` — Bug 修复
- `debug:` — 日志 / 可观测性改进
- `ci:` — CI/CD 变更
- `docs:` — 文档更新

---

## 致谢

- [Cloudflare](https://cloudflare.com) — Pages / Workers / D1 / R2 / Queues
- [Next.js](https://nextjs.org) — React 框架
- [Tailwind CSS](https://tailwindcss.com) — 样式框架
- [Drizzle ORM](https://orm.drizzle.team) — TypeScript ORM
- [jose](https://github.com/panva/jose) — JWT 库

---

<p align="center">
  <sub>Made with ❤️ by wooxi · Deployed on Cloudflare</sub>
</p>
