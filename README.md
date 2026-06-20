# 🎨 CF Text-to-Image — AI 文生图工作室

> 基于 Cloudflare 全家桶（Pages + Functions + D1 + R2）的 AI 驱动文生图/图生图/文生视频平台。关键词组合智能生成提示词，异步任务队列，瀑布流画廊，全后台可视化管理。

```
┌──────────────────────────────────────────────────────────┐
│                    用户浏览器 (前端)                       │
│  Next.js 14 + React 18 + TailwindCSS                     │
├──────────────────────────────────────────────────────────┤
│               Cloudflare Pages (静态托管)                  │
├──────────────────────────────────────────────────────────┤
│           Pages Functions (API 路由 /api/*)               │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ 认证 JWT │ │ 任务队列 │ │ 图片代理  │ │ 关键词/配置API │  │
│  └─────────┘ └─────────┘ └──────────┘ └───────────────┘  │
├──────────┬───────────────┬───────────────┬───────────────┤
│  D1 数据库 │   R2 图片存储  │   环境变量/密钥  │  外部 AI API   │
│ (用户/任务/ │ (生成图片/     │ (API Key 安全  │ (OpenAI兼容/  │
│  历史/配置) │  参考图)       │  存储，不暴露)  │  Agnes视频)   │
└──────────┴───────────────┴───────────────┴───────────────┘
```

## ✨ 功能特性

### 创作功能

- **关键词导演** — 8 组 120+ 预设关键词（主体/环境/服装/光线/风格/输出规格），多选组合后 AI 自动生成专业提示词
- **参考图编辑（图生图）** — 上传参考图 + 编辑指令，保留原图结构只改指定属性（服装/风格/光线等）
- **视频生成** — 文生视频、图生视频、关键帧动画，支持自定义分辨率/帧数/帧率
- **提示词润色** — AI 润色手写描述，增强画面感和氛围
- **连续提交** — 支持连续提交多个生成任务，实时轮询状态，无需等待

### 画廊与展示

- **瀑布流布局** — 响应式多列（1-5列自适应），懒加载 + IntersectionObserver
- **全屏查看** — 点击放大，支持复制提示词、下载、删除
- **筛选排序** — 按类型（图片/视频/全部）筛选，最新/最早排序
- **任务卡片** — 实时显示进度条、状态（排队/处理中/完成/失败），支持重试和删除

### 后台管理

- **左侧菜单导航** — 端点配置 / 提示词设定 / 生成历史 / 关键词管理
- **端点配置** — LLM / 图像 / 视频三组独立配置，支持自动获取模型列表
- **提示词设定** — 三组系统提示词可自定义（关键词生图 / 视频生成 / 润色），留空用默认值
- **生成历史** — 全量记录查看，支持删除
- **关键词管理** — 分组管理关键词，实时增删

### 安全设计

- **API Key 不入库** — 密钥通过 D1 config 表加密存储，API 返回"已设置/未设置"不暴露明文
- **JWT 认证** — 所有 API 端点鉴权，图片代理端点公开（供 AI API 回拉参考图）
- **文件名 sanitize** — 图片代理防路径遍历攻击

## 🛠 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 14 (App Router) | 静态导出 `out/` 部署到 Pages |
| UI | React 18 + TailwindCSS 3 | 响应式 + 暗色主题 |
| API | Cloudflare Pages Functions | `functions/api/*.ts` 自动路由 |
| 数据库 | Cloudflare D1 (SQLite) | 用户/任务/历史/关键词/配置 |
| 图片存储 | Cloudflare R2 | 生成图片 + 参考图临时存储 |
| 认证 | JWT (jose) + bcryptjs | Cookie-based 会话 |
| CI/CD | GitHub Actions | push to master 自动部署 |

## 📁 项目结构

```
cf-text-to-image/
├── src/                          # 前端源码
│   ├── app/
│   │   ├── page.tsx              # 首页（创作台）
│   │   ├── admin/page.tsx        # 后台管理（左侧菜单布局）
│   │   ├── layout.tsx            # 根布局
│   │   └── globals.css           # 全局样式 + CSS变量
│   ├── components/               # React组件
│   │   ├── MasonryGallery.tsx    # 瀑布流画廊
│   │   ├── ImageCard.tsx         # 图片卡片（懒加载）
│   │   ├── KeywordSelector.tsx   # 关键词选择器
│   │   ├── ImageUploader.tsx     # 参考图上传
│   │   ├── TaskCard.tsx          # 任务进度卡片
│   │   ├── Lightbox.tsx          # 全屏查看器
│   │   ├── LoginModal.tsx        # 登录弹窗
│   │   ├── Header.tsx            # 顶部导航
│   │   ├── MobileHome.tsx        # 移动端首页
│   │   └── ThemeProvider.tsx     # 主题切换
│   ├── lib/
│   │   ├── keyword-presets.ts    # 预设关键词数据
│   │   └── generated-media.ts    # 媒体工具
│   └── types/index.ts            # TypeScript 类型定义
├── functions/                    # Cloudflare Pages Functions (API)
│   ├── auth.ts                   # JWT 认证中间件
│   ├── db.ts                     # D1 连接 + config 读取
│   └── api/
│       ├── auth/
│       │   ├── login.ts          # 登录
│       │   ├── register.ts       # 注册
│       │   └── me.ts             # 当前用户
│       ├── tasks.ts              # 任务 CRUD + 生图/视频处理
│       ├── generate-prompt.ts    # AI 生成提示词
│       ├── polish.ts             # AI 润色
│       ├── images.ts             # R2 图片代理 (/api/images?file=)
│       ├── history.ts            # 生成历史
│       ├── keywords.ts           # 关键词管理
│       ├── config.ts             # 配置读写（密钥安全处理）
│       └── models.ts             # 获取模型列表
├── db/migrations/
│   └── 0000_init.sql             # D1 数据库初始化
├── .github/workflows/
│   └── deploy.yml                # GitHub Actions 自动部署
├── wrangler.toml                 # Cloudflare 配置
├── package.json
├── tailwind.config.ts
├── next.config.js
└── tsconfig.json
```

## 🚀 部署指南

### 前置条件

- Cloudflare 账号
- Node.js 20+
- Git

### 步骤 1：克隆仓库

```bash
git clone https://github.com/wooxi/cf-text-to-image.git
cd cf-text-to-image
npm install
```

### 步骤 2：创建 Cloudflare 资源

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create txt2img-db
# 将返回的 database_id 填入 wrangler.toml

# 创建 R2 存储桶
npx wrangler r2 bucket create txt2img-images
```

### 步骤 3：配置 wrangler.toml

```toml
name = "cf-text-to-image"
compatibility_date = "2025-06-01"
pages_build_output_dir = "out"

[[d1_databases]]
binding = "DB"
database_name = "txt2img-db"
database_id = "<你的数据库ID>"

[[r2_buckets]]
binding = "IMAGES_BUCKET"
bucket_name = "txt2img-images"

[vars]
JWT_SECRET = "<随机生成的密钥>"
ENABLE_REGISTRATION = "true"
```

### 步骤 4：初始化数据库

```bash
npx wrangler d1 execute txt2img-db --remote --file=./db/migrations/0000_init.sql
```

### 步骤 5：创建管理员账号

```bash
# 生成 bcrypt hash（可用 Node.js）
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your_password', 10));"

# 写入数据库
npx wrangler d1 execute txt2img-db --remote --command \
  "INSERT INTO users (username, password_hash, created_at) VALUES ('admin', '<bcrypt_hash>', datetime('now'));"
```

### 步骤 6：导入关键词种子数据

```bash
npx wrangler d1 execute txt2img-db --remote --file=./db/seed.sql
```

### 步骤 7：构建并部署

```bash
# 构建
npm run build

# 部署到 Cloudflare Pages
npx wrangler pages deploy out --project-name=cf-text-to-image
```

### 步骤 8：配置 GitHub Actions 自动部署（可选）

在 GitHub 仓库 Settings → Secrets → Actions 中添加：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Pages 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

之后每次 `git push origin master` 即自动部署。

### 步骤 9：后台配置模型端点

访问 `https://<你的域名>/admin`，用管理员账号登录：

1. **端点配置** — 填写 LLM / 图像 / 视频三组的端点地址、API Key、模型名称
2. **提示词设定** — 自定义三组系统提示词（可选，留空用默认值）

## ⚙️ 配置项说明

### 环境变量（wrangler.toml [vars]）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET` | JWT 签名密钥 | 无（必须设置） |
| `ENABLE_REGISTRATION` | 是否开放注册 | `true` |

### D1 config 表配置项（后台管理页配置）

| Key | 说明 | 示例 |
|-----|------|------|
| `llm_endpoint` | LLM 端点地址 | `https://api.openai.com/v1` |
| `llm_api_key` | LLM API Key | `sk-...` |
| `llm_model` | LLM 模型名 | `gpt-4o` |
| `image_endpoint` | 生图端点地址 | `https://api.openai.com/v1` |
| `image_api_key` | 生图 API Key | `sk-...` |
| `image_model` | 生图模型名 | `gpt-image-2` |
| `image_provider` | 生图服务商 | `openai_image` / `agnes_image` |
| `video_endpoint` | 视频端点地址 | `https://apihub.agnes-ai.com` |
| `video_api_key` | 视频 API Key | `sk-...` |
| `video_model` | 视频模型名 | `agnes-video-v2.0` |
| `prompt_system_image` | 关键词生图系统提示词 | 留空用默认 |
| `prompt_system_video` | 视频生成系统提示词 | 留空用默认 |
| `prompt_system_polish` | 润色系统提示词 | 留空用默认 |

## 🔌 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | ❌ |
| POST | `/api/auth/register` | 注册 | ❌ |
| GET | `/api/auth/me` | 当前用户信息 | ✅ |
| GET | `/api/keywords` | 获取关键词组 | ✅ |
| POST | `/api/keywords` | 添加关键词 | ✅ |
| DELETE | `/api/keywords?id=` | 删除关键词 | ✅ |
| POST | `/api/generate-prompt` | AI 生成提示词 | ✅ |
| POST | `/api/polish` | AI 润色提示词 | ✅ |
| POST | `/api/tasks` | 创建生成任务 | ✅ |
| GET | `/api/tasks?status=` | 获取任务列表 | ✅ |
| PUT | `/api/tasks` | 重试任务 | ✅ |
| DELETE | `/api/tasks?id=` | 删除任务 | ✅ |
| GET | `/api/history` | 获取生成历史 | ✅ |
| DELETE | `/api/history?id=` | 删除历史记录 | ✅ |
| GET | `/api/config` | 获取配置（密钥脱敏） | ✅ |
| PUT | `/api/config` | 更新配置 | ✅ |
| POST | `/api/models` | 获取可用模型列表 | ✅ |
| GET | `/api/images?file=` | R2 图片代理 | ❌（公开） |

## 💻 本地开发

```bash
# 安装依赖
npm install

# Next.js 开发模式（前端热更新，API 需单独启动）
npm run dev

# Cloudflare Pages 本地模拟（含 D1 + R2）
npm run pages:dev

# 构建生产版本
npm run build
```

## ⚠️ 注意事项

### Cloudflare 平台限制

- **Workers 执行时间** — Pages Functions 有 30 秒 wall time 限制（fetch 等待不计入 CPU 时间）。生图 API 调用通常 30-40 秒，在限制内但接近边界。如果频繁超时，考虑使用响应更快的模型或降低图片尺寸。
- **不支持后台异步** — CF Workers 运行时在响应返回后会终止所有 I/O。不能使用 fire-and-forget 模式，任务必须在请求生命周期内同步完成。
- **D1 写入限制** — 免费版有写入频率限制，高并发场景需注意。

### 图生图特殊处理

- 参考图上传后先存入 R2，生成公开 URL 再传给图片 API，避免大数据 base64 传输超时。
- 图片 API 需要能从公网访问 `/api/images?file=refs/xxx.png` 来回拉参考图。
- `openai_image` provider 使用 `/images/edits` 端点；`agnes_image` provider 使用 `/images/generations` + `extra_body.image`。

### 安全

- **不要将 API Key 写入代码或 wrangler.toml** — 通过后台管理页的配置功能写入 D1 config 表。
- **JWT_SECRET 必须设置** — 使用随机字符串，不要用默认值。
- **生产环境关闭注册** — 设置 `ENABLE_REGISTRATION = "false"`。

### API 兼容性

- 支持任何 OpenAI 兼容的 API 端点（包括 LibreChat、one-api 等代理）。
- 端点地址不需要包含 `/v1` 后缀，系统会自动补全。
- 视频生成适配 Agnes AI API 格式。

## ❓ 常见问题

### Q: 登录后刷新页面会闪烁未登录状态？

A: 这是由于前端在认证检查完成前渲染了已登录内容。当前版本已修复：未登录时只显示欢迎页，认证完成后才渲染主界面。

### Q: 生图报 504 超时？

A: 图片生成 API 响应时间超过 30 秒时会触发 Cloudflare 超时。解决方案：
1. 换用响应更快的模型（如 `agnes-image-2.1-flash`）
2. 降低输出尺寸（如 `512x512`）
3. 如果使用代理端点，检查代理是否有自己的超时设置

### Q: 图生图生成的图片与参考图无关？

A: 检查 `image_provider` 配置：
- `openai_image` → 使用 `/images/edits` 端点，参考图放在 `image` 字段
- `agnes_image` → 使用 `/images/generations` + `extra_body.image`
- 参考图必须能被图片 API 从公网访问（通过 R2 公开 URL）

### Q: 图片显示为空白？

A: 检查：
1. R2 存储桶是否正确绑定（`IMAGES_BUCKET`）
2. `/api/images?file=xxx.png` 是否返回 200（图片路径在 DB 中为 `/api/images?file=xxx.png` 格式）
3. D1 数据库字段映射是否正确（DB 是 snake_case，前端用 camelCase，API 层已做转换）

### Q: 关键词生成的提示词总是三段式（远景/中景/近景）？

A: 这是系统提示词的设定。进入后台管理 → 提示词设定，修改 `prompt_system_image` 配置项。留空则使用默认值（已改为不强制分段）。

### Q: 如何修改管理员密码？

A: 通过 wrangler 命令行：
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('new_password', 10));"
npx wrangler d1 execute txt2img-db --remote --command \
  "UPDATE users SET password_hash = '<new_hash>' WHERE username = 'admin';"
```

### Q: 如何开启/关闭注册？

A: 修改 `wrangler.toml` 中的 `ENABLE_REGISTRATION` 变量，或通过 Cloudflare Dashboard 的环境变量设置。

### Q: 部署后 API 返回 500？

A: 检查：
1. D1 数据库是否已执行 migration（`0000_init.sql`）
2. R2 存储桶是否已创建并绑定
3. 后台管理页是否已配置 LLM/图像/视频端点和 API Key
4. 管理员账号是否已创建

## 📜 License

MIT

## 🙏 致谢

- 原始项目 [wooxi/text-to-image](https://github.com/wooxi/text-to-image) — 基于 Next.js + SQLite 的本地版
- [Cloudflare Pages](https://pages.cloudflare.com/) — 静态托管 + Edge Functions
- [Next.js](https://nextjs.org/) — React 全栈框架
- [TailwindCSS](https://tailwindcss.com/) — 原子化 CSS 框架

