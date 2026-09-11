# 文生图工作室

**关键词选卡 → LLM 写画面描述 → 异步出图 → 图库**，整套跑在 Cloudflare 上：一个 Worker、一个 D1、一个 R2、一个 Queue，免费额度内即可自用。

<div align="center">

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wooxi/cf-text-to-image)

</div>

---

## 一键部署

点上面的按钮，Cloudflare 会把仓库复制一份到你自己的账号，自动创建 D1 / R2 / Queue 并部署 Worker。
过程中会让你填几个变量（见下表），填完就能用：

| 变量 | 说明 |
| --- | --- |
| `ACCESS_PASSWORD` | 访问密码，进站唯一凭据，自己想一个强一点的 |
| `SESSION_SECRET` | 会话签名密钥，`openssl rand -hex 32` 生成一串即可 |
| `LLM_ENDPOINT` / `LLM_API_KEY` / `LLM_MODEL` | 生成和润色画面描述用的 OpenAI 兼容接口 |
| `IMAGE_ENDPOINT` / `IMAGE_API_KEY` / `IMAGE_MODEL` | 出图用的 OpenAI 兼容接口 |

也可以先部署再补：Worker → Settings → Variables and Secrets 里随时能改。

> 想用自己的域名：Worker → Settings → Domains & Routes → Add custom domain。
> 仓库里刻意不写死任何域名和资源 ID，所以别人的部署不会踩到你的。

<details>
<summary>不想用按钮？手动部署 / 本地开发</summary>

```bash
npm install
npm run build          # Next 静态导出 + API 打包
npx wrangler dev       # 本地预览（首次会提示建本地 D1）

npm run deploy         # 部署到线上：建资源 → 部署 → 跑迁移
```

GitHub Actions 也可用：在仓库 Secrets 里加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，push 到 `master` 自动部署。

</details>

---

## 功能

- **关键词选卡**：7 组 149 个预设词（主体 / 环境 / 服装 / 姿势 / 拍摄 / 风格 / 输出），支持搜索、按组清空
- **AI 写词**：选完词一键生成画面描述，也可以对已有描述做 AI 润色
- **参考图编辑**：上传 1–3 张参考图走图生图
- **异步出图**：任务进队列，Worker 消费，页面轮询进度，失败可重试
- **图库**：成品列表、全屏查看、复制提示词、下载、删除
- **单密码门**：没有注册、没有账号体系，一个访问密码进来就是全部

## 架构

```text
        ┌────────────────────────────────────────────┐
Browser │  Cloudflare Worker  cf-text-to-image       │
   │    │                                            │
   │    │  /api/*  ──▶ 编译后的 API 路由（functions/）│
   └───▶│  其余路径 ──▶ 静态资源绑定（out/）           │
        │                                            │
        │  queue()     ──▶ 消费出图任务               │
        │  scheduled() ──▶ 每天 03:00 UTC 收尸/清理    │
        └───────┬──────────┬──────────┬───────────────┘
                │          │          │
           ┌────▼───┐ ┌────▼───┐ ┌────▼─────┐
           │   D1   │ │   R2   │ │  Queue   │
           │ 任务   │ │ 参考图 │ │ 异步解耦 │
           │ 历史   │ │ (回退) │ └──────────┘
           │ 关键词 │ └────────┘
           │ 设置   │      │
           └────────┘      ▼
                    外部图床（可选，成品图）
```

**为什么是一个 Worker 而不是 Pages**：Cloudflare 的一键部署按钮只支持 Workers；而且队列消费、定时触发在 Pages 上都没有。合并之后静态资源由 assets 绑定直出（走 CDN，不唤醒 Worker），只有 `/api/*` 进 Worker。

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

## 环境变量

全部通过 Cloudflare 环境变量注入，**不进仓库、不落数据库**。

| 变量 | 配置位置 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ACCESS_PASSWORD` | Worker | ✅ | 访问密码 |
| `SESSION_SECRET` | Worker | ✅ | 会话 JWT 签名密钥，≥16 字符 |
| `LLM_ENDPOINT` | Worker | ✅ | 形如 `https://api.openai.com/v1` |
| `LLM_API_KEY` | Worker | ✅ | |
| `LLM_MODEL` | Worker | ✅ | 例如 `gpt-4o` |
| `IMAGE_ENDPOINT` | Worker | ✅ | 可与 LLM 同一网关 |
| `IMAGE_API_KEY` | Worker | ✅ | |
| `IMAGE_MODEL` | Worker | ✅ | 例如 `gpt-image-1` |
| `IMAGE_BED_ENDPOINT` | Worker | — | 图床地址，配了就把成品图传图床 |
| `IMAGE_BED_AUTH_CODE` | Worker | — | 图床上传认证码 |
| `IMAGE_BED_CHANNEL` | Worker | — | 存储渠道，见下 |
| `PROMPT_SYSTEM_IMAGE` | Worker | — | 覆盖出图提示词（≤5KB，更长请写 D1） |

登录后在「设置 → 环境自检」能看到当前哪些配了、哪些没配，以及成品图存在哪里。

### 图床（可选）

配了 `IMAGE_BED_ENDPOINT` 就把生成结果上传到 [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)，入库的是可公开访问的外链，图库直接引用；不配或上传失败则回退存 R2，经 `/api/images` 鉴权读取——**图不会丢**。

```bash
IMAGE_BED_ENDPOINT=https://imgbed.example.com
IMAGE_BED_AUTH_CODE=你的上传认证码
IMAGE_BED_CHANNEL=cfr2          # 渠道名，见下
```

渠道名要填图床后台里配置的存储渠道标识。**同一个图床的渠道会影响画质**：

| 渠道 | 行为 |
| --- | --- |
| `cfr2`（Cloudflare R2） | 原图字节不变，推荐 |
| `telegram` 等 | 会被转码压缩（PNG 可能变成有损 JPEG） |

不填 `IMAGE_BED_CHANNEL` 则用图床的默认渠道，默认渠道是 Telegram 时就会压缩。

### 长提示词

Cloudflare Worker 的单个文本绑定上限 **5.1 KB**，一份认真写过的提示词很容易超过（中文 UTF-8 一个字 3 字节）。
超过时把内容写进 D1 的 `settings` 表，键名 `prompt_system_image` / `prompt_system_polish`：

```bash
npx wrangler d1 execute DB --remote --command \
  "INSERT INTO settings (key,value,updated_at) VALUES ('prompt_system_image','…',datetime('now')) \
   ON CONFLICT(key) DO UPDATE SET value=excluded.value;"
```

取值顺序：**环境变量 → D1 settings → 内置默认**。

---

## 设计取舍

这一版刻意做了减法，几处「不做」的理由如下：

### 1. 访问密码不哈希，直接比对

`ACCESS_PASSWORD` 明文放在 Cloudflare Secret 里，校验时对两侧各做一次 SHA-256 后定长比较。
哈希的意义是「存储被读取后仍无法还原明文」，但 `SESSION_SECRET` 就躺在同一份环境变量里——拿到环境变量的人可以直接伪造会话 Cookie，哈希提供不了额外防护。

### 2. 不做登录限速、不做任务配额

单用户 + 强密码的前提下，暴力破解和滥用额度都不成立——能登录的人就是拥有 API Key 的人。

### 3. 不做用户表

一个密码就是一个用户。没有注册、找回密码、角色管理这些需要表结构和额外往返的东西。

### 4. 配置全外置

密钥只在 Cloudflare 环境变量里，系统内不存储、不能修改，也就没有「配置读取被拖库」这条攻击路径。
唯一的例外是超长提示词（放不下环境变量），存在 D1 的非机密 `settings` 表。

---

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars     # 填本地用的变量
npm run build
npx wrangler dev                   # http://localhost:8787
```

D1 本地库：`npm run db:migrate:local`。

```bash
npm run typecheck   # 依赖构建产物，先 npm run build
npm test            # vitest
npm run lint
```

## 目录

```text
worker/index.ts          Worker 入口：/api/*、静态资源、队列消费、定时任务
functions/               API 路由（Pages Functions 写法，构建时编译进 Worker）
  api/                   HTTP 接口
  lib/                   env / auth / http / imagebed / llm / media / validate
  task-processing.ts     出图流水线 + 每日维护
src/                     Next.js 前端（静态导出）
db/migrations/           D1 迁移，用 wrangler d1 migrations apply 追踪
```

## 常见问题

**部署成功但页面报「缺少环境变量」**
变量没配。登录后看「设置 → 环境自检」的 missing 列表，或在 Cloudflare 控制台补齐。

**提交任务一直 pending**
队列消费者没跑起来。检查 Worker 的 Triggers 里是否挂着 `txt2img-task-queue` 的 Consumer。

**图片显示「加载失败」**
R2 模式下是会话过期（图片接口要鉴权），重新登录即可。图床模式下检查 `IMAGE_BED_ENDPOINT` 是否可达、CSP 的 `img-src` 是否放行了该域名（默认已放行所有 https 图片）。

**CI 全绿但线上是坏的**
部署只保证代码上去了，环境变量不在仓库里。仓库自带的冒烟测试会检查 `/api/auth/me` 的 `passwordConfigured`，配置缺失时会让 CI 变红。

## License

MIT
