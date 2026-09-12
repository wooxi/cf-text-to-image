# 文生图工作室

**关键词选卡 → LLM 写画面描述 → 异步出图 → 图库**，整套跑在 Cloudflare 上：一个 Worker、一个 D1、一个 R2、一个 Queue，免费额度内即可自用。

<div align="center">

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wooxi/cf-text-to-image)

</div>

---

## 一键部署

点上面的按钮，Cloudflare 会把仓库复制一份到你自己的账号，自动创建 D1 / R2 / Queue 并部署 Worker。
过程中**只需要填一个访问密码**（`ACCESS_PASSWORD`），其余配置等部署完登录进去在「设置」里填。

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
- **设置页**：模型接口、图床、系统提示词、关键词表都在页面里改，不用碰配置文件

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
           │ 配置   │      │
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

## 配置

配置只有两个地方，一个值只属于其中一个：

| 位置 | 内容 | 怎么改 |
| --- | --- | --- |
| **环境变量** | `ACCESS_PASSWORD`（必填）、`SESSION_SECRET`（可选） | Cloudflare 控制台 → Workers & Pages → 本项目 → Settings → Variables and Secrets |
| **设置页** | 模型接口、图床、系统提示词 | 登录后点「设置 → 配置」 |

放在环境变量的只有「进门」这件事：访问密码必须在你能打开设置页之前就存在。
`SESSION_SECRET` 不配也行——首次使用时自动生成一条存进 D1。

模型接口（LLM / 图像）需要填三个字段：接口地址、API Key、模型名，都是 OpenAI 兼容协议。
两个接口可以指向同一个网关。

### 图床（可选）

设置页里填图床地址和认证码，成品图就会走 [CloudFlare-ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)，
入库的是可公开访问的外链，图库直接引用；不填或上传失败则存 R2，经 `/api/images` 鉴权读取——**图不会丢**。

**渠道名要填对**，它决定画质：

| 渠道 | 行为 |
| --- | --- |
| `cfr2`（Cloudflare R2） | 原图字节不变，推荐 |
| `telegram` 等 | 会被转码压缩（PNG 可能变成有损 JPEG） |

留空则用图床的默认渠道；默认渠道是 Telegram 时就会压缩。

---

## 设计取舍

这一版刻意做了减法，几处「不做」的理由如下：

### 1. 访问密码不哈希，直接比对

`ACCESS_PASSWORD` 明文放在 Cloudflare Secret 里，校验时对两侧各做一次 SHA-256 后定长比较。
哈希的意义是「存储被读取后仍无法还原明文」，但会话密钥同样能被读到——拿到它就能伪造会话，哈希提供不了额外防护。

### 2. 配置不做多层回退

一个值只有一个来源：要么在环境变量里，要么在 D1 设置表里。
不做「环境变量优先、库里兜底」那一套——否则改了半天不知道被哪一层盖住。

### 3. 不做登录限速、不做任务配额

单用户 + 强密码的前提下，暴力破解和滥用额度都不成立——能登录的人就是拥有 API Key 的人。

### 4. 不做用户表

一个密码就是一个用户。没有注册、找回密码、角色管理这些需要表结构和额外往返的东西。

---

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars     # 填一个本地访问密码即可
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
  lib/                   env / auth / settings / http / imagebed / llm / media
  task-processing.ts     出图流水线 + 每日维护
src/                     Next.js 前端（静态导出）
db/migrations/           D1 迁移，用 wrangler d1 migrations apply 追踪
```

## 常见问题

**登录后提示「还差 xxx 没填」**
去「设置 → 配置」把模型接口补上。

**提交任务一直 pending**
队列消费者没跑起来。检查 Worker 的 Triggers 里是否挂着 `txt2img-task-queue` 的 Consumer。

**图片显示「加载失败」**
R2 模式下是会话过期（图片接口要鉴权），重新登录即可。图床模式下检查图床地址是否可达。

**CI 全绿但线上是坏的**
部署只保证代码上去了，环境变量不在仓库里。仓库自带的冒烟测试会检查 `/api/auth/me` 的 `passwordConfigured`，密码没配时会让 CI 变红。

## License

MIT
