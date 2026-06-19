#!/bin/bash
# CF 全家桶一键初始化脚本
# 前提：已运行 npx wrangler login

set -e

PROJECT="cf-text-to-image"

echo "=== 1. 创建 D1 数据库 ==="
DB_INFO=$(npx wrangler d1 create txt2img-db)
echo "$DB_INFO"
DB_ID=$(echo "$DB_INFO" | grep -oP 'database_id = "K[^"]+')
echo "D1 ID: $DB_ID"

echo "=== 2. 创建 R2 存储桶 ==="
npx wrangler r2 bucket create txt2img-images 2>/dev/null || echo "Bucket already exists"

echo "=== 3. 更新 wrangler.toml ==="
sed -i "s/database_id = "create-later"/database_id = "$DB_ID"/" wrangler.toml

echo "=== 4. 执行数据库迁移 ==="
npx wrangler d1 execute txt2img-db --remote --file=db/migrations/0000_init.sql

echo "=== 5. 设置 API Key（输入后不可见）==="
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put JWT_SECRET
echo "可选: npx wrangler secret put IMAGE_API_KEY"
echo "可选: npx wrangler secret put AGNES_API_KEY"

echo "=== 6. 创建管理员 ==="
read -p "管理员用户名 [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
read -s -p "管理员密码: " ADMIN_PASS
echo
HASH=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync(process.argv[1], 10));" "$ADMIN_PASS")
npx wrangler d1 execute txt2img-db --remote --command "INSERT INTO users (username, password_hash, created_at) VALUES ('$ADMIN_USER', '$HASH', datetime('now'));"

echo ""
echo "=== 7. 首次部署 ==="
npx wrangler pages deploy out --project-name=$PROJECT --branch=master

echo ""
echo "✅ 初始化完成！"
echo "GitHub Actions 已配置：每次 git push 自动部署"
