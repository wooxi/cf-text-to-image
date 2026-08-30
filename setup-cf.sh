#!/bin/bash
# CF 全家桶一键初始化脚本
# 前提：已运行 npx wrangler login
set -euo pipefail

PROJECT="cf-text-to-image"

echo "=== 1. 创建 D1 数据库 ==="
DB_INFO=$(npx wrangler d1 create txt2img-db 2>/dev/null) || { echo "txt2img-db 已存在，读取现有 ID"; DB_INFO=$(npx wrangler d1 info txt2img-db 2>/dev/null); }
DB_ID=$(echo "$DB_INFO" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -z "$DB_ID" ]; then echo "无法获取 database_id，请手动填入 wrangler.toml"; exit 1; fi
echo "D1 ID: $DB_ID"

echo "=== 2. 创建 R2 存储桶与队列 ==="
npx wrangler r2 bucket create txt2img-images 2>/dev/null || echo "Bucket 已存在"
npx wrangler queues create txt2img-task-queue 2>/dev/null || echo "Queue 已存在"

echo "=== 3. 更新 wrangler.toml ==="
sed -i "s/^database_id = .*/database_id = \"$DB_ID\"/" wrangler.toml

echo "=== 4. 执行数据库迁移 ==="
for f in db/migrations/*.sql; do
  echo "-- $f"
  npx wrangler d1 execute txt2img-db --remote --file="$f" -y || echo "（跳过：$f 可能已应用）"
done

echo "=== 5. 设置 JWT_SECRET（输入后不可见）==="
echo "为 Pages 项目设置强随机密钥（留空则自动生成）："
read -s -p "JWT_SECRET: " JWT_SECRET_INPUT
echo
JWT_SECRET_VALUE=${JWT_SECRET_INPUT:-$(openssl rand -hex 32)}
echo "$JWT_SECRET_VALUE" | npx wrangler pages secret put JWT_SECRET --project-name="$PROJECT"

echo "=== 6. 创建管理员 ==="
read -p "管理员用户名 [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
read -s -p "管理员密码（至少 8 位）: " ADMIN_PASS
echo
HASH=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync(process.argv[1], 10));" "$ADMIN_PASS")
npx wrangler d1 execute txt2img-db --remote -y --command \
  "INSERT INTO users (username, password_hash, role, created_at) VALUES ('$ADMIN_USER', '$HASH', 'admin', datetime('now'))"

echo "=== 7. 构建并首次部署 ==="
npm install
npm run build
npx wrangler pages deploy out --project-name="$PROJECT" --branch=master
npx wrangler deploy --config queue-worker/wrangler.toml

echo ""
echo "✅ 初始化完成！记得在后台管理页设置模型 API Key。"
echo "   GitHub Actions 已配置：每次 push 到 master 自动部署。"
