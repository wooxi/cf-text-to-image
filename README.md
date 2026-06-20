# CF Text-to-Image

基于 Cloudflare Pages、Pages Functions、D1、R2、Queues 的 AI 文生图 / 图生图 / 视频生成项目。支持关键词编排、提示词生成与润色、任务历史、后台配置，以及适配手机端的创作体验。

当前仓库已经从“同步请求直接跑生图”的模式，演进到“前台提交任务，后台异步消费”的模式，用于缓解连续点击提交时的阻塞与失败问题。

## 当前状态

当前线上由两个 Cloudflare 服务组成：

- cf-text-to-image
  - 类型：Cloudflare Pages
  - 职责：前端页面、/api/* 接口、登录鉴权、任务入库、历史和配置管理
- cf-text-to-image-task-consumer
  - 类型：Cloudflare Worker
  - 职责：消费 Queue 中的任务，调用图像 / 视频模型，写回 D1 与 R2

这不是两个网站，而是“一个站点 + 一个后台消费者”。用户实际访问的仍然是原来的 Pages 项目。

## 核心能力

### 创作能力

- 关键词导演：通过预设关键词快速组合画面主体、镜头、风格和输出规格
- 提示词生成：根据关键词由 LLM 自动生成更完整的提示词
- 提示词润色：对手写提示词进行扩写和风格修正
- 文生图：支持 OpenAI 兼容接口与定制上游网关
- 图生图：支持参考图编辑，按 provider 自动切换请求体格式
- 视频生成：支持文本视频与参考图视频参数提交

### 任务能力

- 连续提交：允许前端连续点击提交多个任务
- 异步处理：任务先入库，再进入队列，由后台消费者处理
- 状态轮询：前端轮询 pending / processing / failed / completed
- 历史记录：生成成功后写入 image_history
- 重试能力：失败任务可重置为 pending 后重新入队

### 管理能力

- 后台登录鉴权
- 模型端点、Key、模型名配置
- 提示词系统设定词配置
- 关键词管理
- 历史记录查看与删除

## 当前架构

~~~text
Browser
  -> Cloudflare Pages (cf-text-to-image)
      -> Pages Functions /api/*
          -> D1 (tasks, image_history, config, users ...)
          -> R2 (generated images, reference images)
          -> Queue producers (txt2img-task-queue-a, txt2img-task-queue-b)

Queue A / Queue B
  -> Worker consumer (cf-text-to-image-task-consumer)
      -> External image / video model APIs
      -> D1 status updates
      -> R2 image persistence
~~~

### 为什么是两条队列

为了保留一定并发能力，但避免单个队列批处理时的不稳定，当前实现使用两条独立队列：

- txt2img-task-queue-a
- txt2img-task-queue-b

任务按 taskId 奇偶分流：

- 偶数任务 -> Queue A
- 奇数任务 -> Queue B

每条队列内部串行消费，两条队列并行工作。这样比“一个队列内批量 Promise.all 并发”更稳，也更容易排查问题。

## 技术栈

- 前端：Next.js 14, React 18, Tailwind CSS
- 托管：Cloudflare Pages
- API：Cloudflare Pages Functions
- 异步任务：Cloudflare Queues
- 后台消费者：Cloudflare Worker
- 数据库：Cloudflare D1
- 对象存储：Cloudflare R2
- 认证：JWT + bcryptjs
- CI/CD：GitHub Actions

## 仓库结构

~~~text
cf-text-to-image/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ admin/page.tsx
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  ├─ components/
│  └─ types/
├─ functions/
│  ├─ auth.ts
│  ├─ db.ts
│  ├─ task-processing.ts
│  └─ api/
│     ├─ auth/
│     ├─ tasks.ts
│     ├─ generate-image.ts
│     ├─ generate-prompt.ts
│     ├─ polish.ts
│     ├─ images.ts
│     ├─ history.ts
│     ├─ keywords.ts
│     ├─ config.ts
│     └─ models.ts
├─ queue-worker/
│  ├─ task-consumer.ts
│  └─ wrangler.toml
├─ db/migrations/
│  ├─ 0000_init.sql
│  └─ 0001_task_request_json.sql
├─ .github/workflows/deploy.yml
├─ wrangler.toml
└─ README.md
~~~

## 数据流说明

### 创建任务

1. 前端调用 POST /api/tasks
2. Pages Functions 将任务写入 tasks
3. 保存完整 request_json
4. 根据 taskId 奇偶将任务发送到 A 或 B 队列
5. 前端开始轮询任务状态

### 消费任务

1. Queue consumer 收到任务消息
2. functions/task-processing.ts 读取任务并加锁
3. 调用对应的图像或视频接口
4. 成功时写入 R2 与 image_history
5. 更新 tasks.status = completed
6. 失败时写入错误信息到 tasks.error

## 部署说明

### 1. Cloudflare 资源

至少需要这些资源：

- 一个 Pages 项目：cf-text-to-image
- 一个 D1 数据库：txt2img-db
- 一个 R2 Bucket：txt2img-images
- 两个 Queues：
  - txt2img-task-queue-a
  - txt2img-task-queue-b
- 一个 Worker consumer：cf-text-to-image-task-consumer

### 2. 本地初始化

~~~bash
npm install
npm run build
~~~

### 3. D1 初始化

~~~bash
npx wrangler d1 execute txt2img-db --remote --file=./db/migrations/0000_init.sql
npx wrangler d1 execute txt2img-db --remote --file=./db/migrations/0001_task_request_json.sql
~~~

### 4. 创建队列

~~~bash
npx wrangler queues create txt2img-task-queue-a
npx wrangler queues create txt2img-task-queue-b
~~~

### 5. 部署 Pages

~~~bash
npx wrangler pages deploy out --project-name=cf-text-to-image --branch=master
~~~

### 6. 部署消费者 Worker

~~~bash
npx wrangler deploy --config queue-worker/wrangler.toml
~~~

## GitHub Actions 自动部署

当前 workflow 文件：.github/workflows/deploy.yml

自动部署会执行：

1. npm ci
2. npm run build
3. 确保两个队列存在
4. 部署 Pages
5. 部署 queue consumer Worker

### 注意事项

- 当前 workflow 已改为 Node 22
- 原因：wrangler 4.84.1 及以上版本要求至少 Node 22
- 如果 Actions 报 Wrangler requires at least Node.js v22.0.0，说明 workflow 仍然在用旧版本 Node

## 配置项说明

这些配置来自后台管理页或 D1 config 表：

- image_endpoint
- image_api_key
- image_model
- image_provider
- llm_endpoint
- llm_api_key
- llm_model
- video_endpoint
- video_api_key
- video_model

### image_provider

当前支持两类：

- openai_image
  - 文生图：走 /images/generations
  - 图生图：走 /images/edits
- agnes_image
  - 文生图与图生图：走 /images/generations
  - 图像通过 extra_body.image 传递

## 已验证的关键结论

以下结论来自线上实测，不是理论推断：

### 1. n: 1 会导致特定上游异常

对于当前接入的上游：

- https://llm.seator.top:8443/v1/images/generations
- model = gpt-image-2

直接测试结果：

- { model, prompt, size } -> 正常 200
- { model, prompt, size, n: 1 } -> 会触发 504

因此项目已移除残留的 n: 1 字段。

### 2. 某些 504 不是“前端没发出去”

多次排查后确认：

- 很多失败任务已经成功写入 tasks
- 也被消费者实际处理到了
- 失败发生在消费者向外部模型发请求时

所以 504 需要区分：

- 前端没有提交
- 任务没有入队
- 队列没有消费
- 消费阶段请求上游失败

它们不是一回事。

### 3. 同样参数在不同网络路径上表现不同

已经验证过：

- 从服务器 192.168.100.6 直接并发请求模型接口，有时可 2 路都成功
- 从 Cloudflare Worker / Queue consumer 发起的同类请求，仍可能出现部分 504

这说明当前问题不完全是模型参数问题，也和 Cloudflare 到上游的执行链路有关。

## 当前已知问题

以下问题在项目现阶段仍需继续优化：

### 1. Cloudflare -> 图像上游链路偶发 504

现象：

- 某些任务 completed
- 某些任务在相近时间内 failed
- 失败错误为 生图失败(504): error code: 504

当前状态：

- 已排除一部分坏参数问题（如 n: 1）
- 已从单队列改为双队列分流
- 仍存在 Cloudflare 侧偶发失败，需要继续收敛

### 2. 前端“排队中 / 处理中”显示可能滞后于真实状态

因为前端依赖轮询与本地临时任务替换，某些瞬时状态可能显示得不够及时。

当前已经做过：

- 修正移动端任务文案
- 修正批次消费时的状态替换逻辑

但若继续优化，可以考虑更细的状态事件或更高频轮询。

### 3. generate-image.ts 与主任务链必须保持一致

仓库里存在两条生图调用路径：

- functions/task-processing.ts：主任务链
- functions/api/generate-image.ts：独立接口

如果两边请求体不一致，就可能出现“一个地方能生成，另一个地方 504”的问题。当前 README 特别提醒这一点，是为了避免后续再次引入漂移。

## 观察与日志

当前 queue consumer 已启用 observability，并加入结构化日志：

- batch-start
- task-start
- task-finish
- task-error
- batch-finish
- task.request
- task.completed
- task.failed

这样后续定位单个任务号时，可以更快区分：

- 是否入队
- 是否被哪个队列消费
- 是否真正开始请求上游
- 失败发生在哪一层

## 常见问题

### Q: 为什么 Cloudflare 里会看到两个服务？

A:

- cf-text-to-image 是 Pages 项目，负责前端和 API
- cf-text-to-image-task-consumer 是 Worker 服务，负责消费队列

它们不是两个网站，而是“一个站点 + 一个后台消费者”。

### Q: 为什么有时会看到临时部署地址？

A:

Cloudflare Pages 每次手动部署都会生成一个临时部署 URL，但正式项目仍然是原来的 cf-text-to-image。临时 URL 只是某次部署产物，不是新的站点。

### Q: 为什么连续点击时按钮文字以前会变化？

A:

这是为了给“任务已提交”的即时反馈。后续已经按体验调整为更稳定的按钮文案，避免连续点击时视觉干扰过强。

### Q: 当前到底是串行还是并行？

A:

当前是：

- 前端：允许连续提交
- 后端：两条独立队列并行
- 每条队列内部：串行消费

因此整体上是“2 路并行，但每一路自己排队”。

## 维护建议

如果后续继续沿 Cloudflare 路线优化，建议优先关注：

1. 保持所有图像请求体格式完全一致
2. 不要随意加 OpenAI 兼容接口未验证过的字段
3. 每次改动图像请求参数，都做单发与并发各一轮验证
4. 区分“任务系统成功”和“上游请求成功”两个层面的日志
5. 不要让 README 与真实架构脱节

## 致谢

- 原始项目：wooxi/text-to-image
- Cloudflare Pages / Workers / D1 / R2 / Queues
- Next.js
- Tailwind CSS
