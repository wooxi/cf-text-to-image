<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/platform-Cloudflare-orange" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D22.0-brightgreen" alt="Node">
</p>

<h1 align="center">CF Text-to-Image Studio</h1>

<p align="center">
  <strong>私人 AI 文生图工作台 · 全栈 Serverless</strong><br>
  关键词生成提示词 → 异步队列出图 → 归档到图库
</p>

---

## 简介

一个完整跑在 Cloudflare 上的文生图工作台：选关键词、由 LLM 写成中文画面描述、提交后由队列 Worker 调用图像模型，结果存入 R2 并归档。

**这是私人工具，不是多租户服务。** 只有一个访问密码，没有注册、没有账号、没有角色。密码和全部密钥都放在 Cloudflare 环境变量里，系统内部不存储、也不能修改。

### 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Next.js 14 + React 18 + Tailwind（`output: "export"` 静态导出） |
| API | Cloudflare Pages Functions（文件路由） |
| 数据库 | Cloudflare D1 |
| 对象存储 | Cloudflare R2 |
| 异步任务 | Cloudflare Queues |
| 后台消费 | Cloudflare Worker（消费 + 每日定时维护） |
| 鉴权 | Web Crypto + JWT (jose) |

---

## 架构

```text
  ┌──────────┐    HTTPS     ┌──────────────────────┐
  │  Browser  │─────────────▶│  Cloudflare Pages     │
  │           │◀─────────────│  静态前端 + /api/*     │
  └──────────┘              └──────────┬───────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
        ┌─────▼─────┐          ┌───────▼──────┐         ┌───────▼──────┐
        │    D1     │          │      R2       │         │    Queue     │
        │ tasks     │          │ images/ 成品  │         │              │
        │ history   │          │ refs/   参考图 │         │              │
        │ keywords  │          └──────────────┘         └───────┬──────┘
        └───────────┘                                           │
                                                    ┌───────────▼──────────┐
                                                    │  Worker Consumer     │
                                                    │  queue() + scheduled()│
                                                    └───────────┬──────────┘
                                                                │
                                                        ┌───────▼────────┐
                                                        │  图像模型 API    │
                                                        └────────────────┘
```

两个 Cloudflare 服务：

| 名称 | 职责 | 需要的环境变量 |
| --- | --- | ------- |
| `cf-text-to-image`（Pages） | 静态前端 + `/api/*` + 鉴权 + LLM 调用 + 入队 | 全部 |
| `cf-text-to-image-task-consumer`（Worker） | 消费队列 → 调图像模型 → 写回 D1/R2；每天 03:00 UTC 收尸 | 只需 `IMAGE_*` |

### 任务状态机

```text
pending ──(乐观锁抢占)──▶ processing ──▶ completed
   ▲                          │
   │                          └──▶ failed ──(PUT /api/tasks)──┐
   └──────────────────────────────────────────────────────────┘
```

- **乐观锁**：`UPDATE ... WHERE status IN ('pending','failed')`，抢不到就跳过，不会重复出图
- **重试**：队列 `max_retries = 1`，只有基础设施异常（D1/R2/网络）才重投；上游业务错误直接判失败
- **收尸**：每天 03:00 UTC 把超过 30 分钟仍是 `processing` 的任务标记失败，并清理 7 天前的参考图

---

## 设计取舍

这一版刻意做了减法。有几处是刻意的「不做」，理由如下——如果不同意，改回来都不难：

### 1. 访问密码不哈希，直接比对

`ACCESS_PASSWORD` 明文放在 Cloudflare Secret 里，校验时对两侧各做一次 SHA-256 后定长比较。

哈希的意义是「存储被读取后仍无法还原明文」。但 `SESSION_SECRET` 就躺在同一份环境变量里——**拿到环境变量的人可以直接伪造会话 Cookie**，哈希 `ACCESS_PASSWORD` 提供不了任何额外防护，却要引入盐值、迭代次数、缓存和哈希格式解析一整套代码（还得为了适配 Workers 免费版 10ms CPU 预算去调迭代次数）。

> 如果你希望抵御「Cloudflare Secret 泄露」这个场景，那真正该保护的是 `SESSION_SECRET`，而不是把密码再哈希一层。

### 2. 不做登录限速、不做任务配额

单用户 + 强密码的前提下，「暴力破解」和「滥用额度」都不成立——能登录的人就是拥有 API Key 的人。这两个机制需要额外的表、额外的 D1 往返和额外的错误分支。删掉了。

### 3. 只支持一种图像上游协议

统一走 OpenAI 兼容协议：文生图 `POST /images/generations`（JSON），图生图 `POST /images/edits`（multipart）。

旧版还有一个 `agnes` 分支，通过 `extra_body.image` 传**公网 URL**。这需要把参考图暴露成可公网访问的地址，于是带出了 `PUBLIC_BASE_URL`、参考图签名短链、`/api/ref` 路由，以及 Worker 也要配 `SESSION_SECRET` 一整套东西。删掉这个分支后，参考图只从 R2 读字节直接塞进 multipart，**从不对外暴露**。

### 4. 参考图不支持外链

只接受上传的文件（Data URI）。放行外链等于让上游替我们请求任意地址，而且我们无法校验它拿到的是什么。前端同时也不做客户端压缩——超限就明确报错，让用户自己压。

### 5. 任务参数只有一份来源

旧版把整个请求 `JSON.stringify` 存进 `request_json` 做「快照」，但那张表已经有 `prompt` / `keyword_names` / `size` / `reference_image` 这些列了——快照和列完全重复，还得同步、还得处理解析失败。删掉了，参数就是列。参考图在入队前先落 R2，所以列里存的是对象键，不会撞 D1 单行 2MB 上限。

### 6. 迁移只有两个文件

旧的 4 个迁移里有 1 个在任何新库上都会失败（`ALTER TABLE` 加已存在的列），还有 1 个是运维动作。单实例服务不需要层层叠加的增量迁移，现在是 `0000_init.sql`（全部结构）+ `0001_seed_keywords.sql`（193 个初始关键词）。

> ⚠️ **如果你已经部署过旧版**：需要在 D1 里先删掉旧表再跑新迁移，否则 `0000` 的 `CREATE TABLE IF NOT EXISTS` 会跳过、结构对不上：
>
> ```bash
> npx wrangler d1 execute txt2img-db --remote -y --command \
>   "DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS image_history; DROP TABLE IF EXISTS keywords; DROP TABLE IF EXISTS keyword_groups; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS config; DROP TABLE IF EXISTS login_attempts;"
> ```
>
> 这会清空历史作品与任务记录。

---

## 快速开始

前置：Node ≥ 22、Cloudflare 账号、`npx wrangler login`、一个 OpenAI 兼容的图像模型端点。

```bash
git clone https://github.com/wooxi/cf-text-to-image.git
cd cf-text-to-image

export ACCESS_PASSWORD="$(openssl rand -base64 24)"   # 或交互式输入
bash setup-cf.sh
```

脚本会：创建 D1 / R2 / Queue → 把 `database_id` 写进**两个** `wrangler.toml` → 应用迁移 → 创建 Pages 项目 → 构建部署 → 部署 Worker → 写入 `SESSION_SECRET` / `ACCESS_PASSWORD`（以及你通过环境变量传入的 `IMAGE_*`）。

然后到控制台补齐模型变量并重新部署一次：

- **Pages → Settings → Variables and Secrets**：`LLM_ENDPOINT`、`LLM_API_KEY`、`LLM_MODEL`，以及 `IMAGE_*`
- **Worker → Settings → Variables and Secrets**：`IMAGE_ENDPOINT`、`IMAGE_API_KEY`、`IMAGE_MODEL`（必须与 Pages 一致）

---

## 环境变量

### 必填

| 变量 | 配置位置 | 说明 |
| --- | ---- | --- |
| `SESSION_SECRET` | Pages | 会话 Cookie 签名密钥。`openssl rand -hex 32`，至少 16 字符 |
| `ACCESS_PASSWORD` | Pages | 访问密码，系统的唯一凭据。建议 ≥12 位随机 |
| `LLM_ENDPOINT` | Pages | 例如 `https://api.openai.com/v1`（缺协议会自动补 `https://`，无路径时补 `/v1`） |
| `LLM_API_KEY` | Pages | 提示词生成 / 润色 |
| `LLM_MODEL` | Pages | 例如 `gpt-4o` |
| `IMAGE_ENDPOINT` | Pages + Worker | 图像模型端点 |
| `IMAGE_API_KEY` | Pages + Worker | 图像模型密钥 |
| `IMAGE_MODEL` | Pages + Worker | 例如 `gpt-image-1` |

### 可选

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PROMPT_SYSTEM_IMAGE` | 内置 | 覆写生图系统提示词 |
| `PROMPT_SYSTEM_POLISH` | 内置 | 覆写润色系统提示词 |

改动环境变量后需要**重新部署**才生效。设置页的「运行状态」会逐条显示哪些已配置、缺哪个、以及每个变量该配在哪个服务上。

---

## 项目结构

```text
src/
  app/            page.tsx（应用外壳）/ layout.tsx / globals.css
  components/     Gate / Header / AuthProvider / ConfirmDialog / Toast / ThemeProvider
                  KeywordSelector / ImageUploader / Gallery / ImageCard / TaskCard / FullscreenViewer
    panels/       CreatePanel / TasksPanel / SettingsPanel
  lib/            api.ts（类型化客户端）/ sizes.ts（尺寸档位表）
  types/          前后端共享的响应类型

functions/        Pages Functions = /api/*
  lib/            env（配置）/ auth（会话）/ http（错误出口）/ llm / endpoints / media / validate
  task-processing.ts   任务状态机 + 出图 + 定时维护
  api/            auth/{login,logout,me} · config · generate-prompt · polish
                  keywords · tasks · history · images

queue-worker/     task-consumer.ts（queue + scheduled）
db/migrations/    0000_init.sql · 0001_seed_keywords.sql
tests/            vitest：auth / validate / media / sizes
```

---

## API

除登录外都需要会话 Cookie，未登录返回 `401`。所有响应是 `{ success, data }` 或 `{ success: false, error }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ password }` → 设置 HttpOnly Cookie |
| `POST` | `/api/auth/logout` | 清除 Cookie |
| `GET` | `/api/auth/me` | `{ authenticated, passwordConfigured }` |
| `GET` | `/api/config` | 环境变量自检 + 当前生效值（**不回传密钥**） |
| `POST` | `/api/config` | 用已配置的 LLM 端点拉一次 `/models` 验证连通性 |
| `POST` | `/api/generate-prompt` | `{ keywords: [{ name }] }` → `{ prompt }` |
| `POST` | `/api/polish` | `{ text }` → `{ text }` |
| `GET` | `/api/keywords` | 全部分组与关键词 |
| `POST` | `/api/keywords` | `{ groupId, name }` 加词 → `{ id }`；`{ name, slug, keywords[] }` 建组 → `{ id }`；`{ action: "reorder", groupId, orderedIds[] }` |
| `DELETE` | `/api/keywords?group=N` \| `?id=N` | 删除分组（连带关键词）或单个关键词 |
| `GET` | `/api/tasks?status=pending,processing&limit=50` | 任务列表（`limit` ≤ 200） |
| `POST` | `/api/tasks` | `{ type: "image"\|"img2img", prompt?, keywords?, size?, image?: dataURI[] }` → `{ taskId }` |
| `PUT` | `/api/tasks` | `{ id }` 重试失败任务 |
| `DELETE` | `/api/tasks?id=N` | 删除任务记录（**不动 R2 文件**） |
| `GET` | `/api/history?limit=30&before=<id>` | `{ items, hasMore, nextBefore }`，按 id 倒序分页 |
| `DELETE` | `/api/history?id=N` | 删除记录 + 对应的 R2 文件 |
| `GET` | `/api/images?file=<name>` | 生成结果，需登录 |

状态码：`400` 参数错误 · `401` 未登录 · `403` 跨站请求 · `404` 不存在 · `409` 冲突 · `429` 无（已移除限速）· `500` 服务异常（细节只进日志）· `502` 上游错误 · `504` 上游超时。

---

## 数据库

```sql
keyword_groups (id, name, slug UNIQUE, description, is_parameter_group, sort_order, created_at)
keywords       (id, group_id → keyword_groups, name, sort_order, created_at)

tasks (
  id, status, type, prompt, keyword_names, size,
  reference_image,   -- 逗号分隔的 R2 对象键（refs/...）
  image_path,        -- /api/images?file=...
  progress, error, created_at, updated_at
)

image_history (id, prompt, keyword_names, image_path, size, created_at)
```

没有 `users` / `config` / `login_attempts` 表——单密码模式下都用不到。

> D1 单行上限 2MB。参考图在入队前先落 R2，列里只存对象键。

---

## 安全模型

| 层面 | 做法 |
| --- | --- |
| 入口 | 单密码门，无注册、无账号枚举面 |
| 密码比较 | 双侧 SHA-256 + 定长异或比较，不泄露前缀匹配长度 |
| 会话 | HS256 JWT，`HttpOnly; Secure; SameSite=Lax`，30 天 |
| CSRF | 依赖 `SameSite=Lax`：跨站发起的 POST/PUT/DELETE 不会携带 Cookie |
| 媒体 | 生成结果需登录；参考图只从 R2 读字节转发，**没有任何公网入口** |
| 路径穿越 | 文件名过 `isSafeKey`（拒绝 `..` 与路径分隔符） |
| 服务端校验 | 尺寸按格式 + 单边 256–4096 校验；文本超长截断；参考图限 3 张 / 8MB |
| 响应头 | `public/_headers` 里的 CSP / HSTS / nosniff / frame-ancestors 等 |
| 错误泄露 | 统一 `handleError`，内部细节只进日志 |
| 供应链 | GitHub Actions 固定到 commit SHA |

---

## 开发

```bash
npm install
npm run dev              # 前端开发服务器
npm run typecheck        # 三套 tsconfig：app / worker / tests
npm run lint
npm test
npm run db:migrate:local

cp .dev.vars.example .dev.vars   # 填好值
npm run build && npm run pages:dev   # 含 Functions 的本地环境
```

CI 在 push 和 PR 上跑：typecheck → lint → test → **用全新本地 D1 跑一遍全部迁移** → build。

那条迁移检查是有来由的：旧版的 `0002` 在任何新库上都会失败（`duplicate column name`），因为当时没有这道关卡，问题存在了很久都没被发现。

---

## 已知限制

1. **`npm audit` 会残留 next / postcss 的告警。** 本项目是 `output: "export"` 纯静态导出，产物只有 HTML/JS/CSS，运行时不跑 Next 服务端，Image Optimizer / Server Actions / middleware / RSC 反序列化这几类漏洞不可达（`images.unoptimized: true` 也已关闭图片优化端点）。CI 里 `npm audit` 只提示不阻塞。彻底消除需要升到 Next 16（React 19），属于破坏性升级。
2. **单用户模型**，没有多租户隔离与按用户配额。要开放给多人用，需要给 `tasks` / `image_history` 加 `user_id` 并恢复角色体系。
3. **只支持单张/generations 协议**，不支持 `agnes` 那类需要公网 URL 的网关。
4. **参考图不支持外链**，这是刻意的 SSRF 取舍。
5. **无登录限速**。请务必使用足够强的 `ACCESS_PASSWORD`。
6. **GitHub Actions 固定到 commit SHA**，需要 Dependabot 之类的工具跟进更新。

---

## 许可

[MIT](./LICENSE)
