#!/usr/bin/env bash
#
# CF 全家桶一键初始化。
# 前置：npx wrangler login（或已设置 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID）
#
# 与旧版的区别：
#   * 同时更新 wrangler.toml 和 queue-worker/wrangler.toml 的 database_id
#     （旧版只改前者，消费者 Worker 会绑到别人的数据库上）
#   * 先创建 Pages 项目再写 secret（pages secret put 要求项目已存在）
#   * 没有账号体系，只需要一个访问密码
#   * macOS / Linux 都能用（旧版 sed -i 是 GNU 语法，macOS 上会失败）

set -euo pipefail

PROJECT="cf-text-to-image"
DB_NAME="txt2img-db"
BUCKET="txt2img-images"
QUEUE="txt2img-task-queue"
WORKER_CONFIG="queue-worker/wrangler.toml"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少命令：$1" >&2
    exit 1
  }
}
need_cmd node
need_cmd npx

if [ ! -t 0 ] && [ -z "${ACCESS_PASSWORD:-}" ]; then
  echo "非交互环境：请先 export ACCESS_PASSWORD 再运行。" >&2
  exit 1
fi

# 写 secret：Pages 与 Worker 语法不同
put_secret() {
  local target="$1" name="$2" value="$3"
  if [ "$target" = "pages" ]; then
    printf '%s' "$value" | npx wrangler pages secret put "$name" --project-name="$PROJECT"
  else
    printf '%s' "$value" | npx wrangler secret put "$name" --config "$WORKER_CONFIG"
  fi
  echo "  ✓ $name → $target"
}

echo "=== 1/8 创建 D1 数据库 ==="
if DB_INFO=$(npx wrangler d1 create "$DB_NAME" 2>/dev/null); then
  echo "已创建 $DB_NAME"
else
  echo "$DB_NAME 已存在，读取现有信息"
  DB_INFO=$(npx wrangler d1 info "$DB_NAME")
fi
DB_ID=$(printf '%s' "$DB_INFO" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
[ -n "$DB_ID" ] || {
  echo "无法解析 database_id，请手动填入两个 wrangler.toml" >&2
  exit 1
}
echo "D1 ID: $DB_ID"

echo "=== 2/8 创建 R2 存储桶与队列 ==="
npx wrangler r2 bucket create "$BUCKET" 2>/dev/null || echo "Bucket 已存在"
npx wrangler queues create "$QUEUE" 2>/dev/null || echo "Queue 已存在"

echo "=== 3/8 写入 database_id（两个配置文件）==="
for cfg in wrangler.toml "$WORKER_CONFIG"; do
  [ -f "$cfg" ] || {
    echo "找不到 $cfg" >&2
    exit 1
  }
  sed "s|^database_id = .*|database_id = \"$DB_ID\"|" "$cfg" >"$cfg.tmp"
  mv "$cfg.tmp" "$cfg"
  echo "  ✓ $cfg"
done

echo "=== 4/8 应用数据库迁移 ==="
for f in ./db/migrations/*.sql; do
  echo "  ▶ $f"
  npx wrangler d1 execute "$DB_NAME" --remote -y --file="$f"
done

echo "=== 5/8 创建 Pages 项目 ==="
npx wrangler pages project create "$PROJECT" --production-branch master 2>/dev/null &&
  echo "已创建 Pages 项目" ||
  echo "Pages 项目已存在"

echo "=== 6/8 构建并部署 ==="
npm install
npm run build
npx wrangler pages deploy out --project-name="$PROJECT" --branch=master
npx wrangler deploy --config "$WORKER_CONFIG"

echo "=== 7/8 写入环境变量 ==="
if [ -z "${SESSION_SECRET:-}" ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
fi
put_secret pages SESSION_SECRET "$SESSION_SECRET"

if [ -z "${ACCESS_PASSWORD:-}" ]; then
  read -r -s -p "设置访问密码（登录系统的唯一凭据）: " ACCESS_PASSWORD
  echo
fi
put_secret pages ACCESS_PASSWORD "$ACCESS_PASSWORD"

# 图像模型配置两边都要（Pages 提交任务时校验、Worker 出图时调用）
for name in IMAGE_ENDPOINT IMAGE_API_KEY IMAGE_MODEL; do
  value="${!name:-}"
  if [ -n "$value" ]; then
    put_secret pages "$name" "$value"
    put_secret worker "$name" "$value"
  fi
done

echo "=== 8/8 完成 ==="
cat <<EOF

✅ 初始化完成

还需要到 Cloudflare 控制台补齐以下变量（脚本不代填密钥，避免进入 shell 历史）：

  Pages 项目 → Settings → Variables and Secrets
    LLM_ENDPOINT     例如 https://api.openai.com/v1
    LLM_API_KEY      LLM 密钥（提示词生成 / 润色）
    LLM_MODEL        例如 gpt-4o
    IMAGE_*          若上面没通过环境变量传入，也需要在这里补一份

  消费者 Worker → Settings → Variables and Secrets
    IMAGE_ENDPOINT / IMAGE_API_KEY / IMAGE_MODEL  必须与 Pages 一致

补齐后重新部署一次即可打开站点，用访问密码进入。
EOF
