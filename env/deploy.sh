#!/bin/bash
# 全球主流媒体时政监控 - 一键部署脚本
# 用法: bash env/deploy.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== 部署开始: 全球主流媒体时政监控 ==="

# 加载环境变量
export $(grep -v '^\s*#' "$PROJECT_ROOT/env/.env.cloudflare" | xargs)

# macOS 本地 TLS 兼容性
export NODE_TLS_REJECT_UNAUTHORIZED=0

echo "1/4 同步前端文件到 docs/ ..."
cp "$PROJECT_ROOT/frontend/index.html" "$PROJECT_ROOT/docs/"
cp "$PROJECT_ROOT/frontend/app.js" "$PROJECT_ROOT/docs/"
cp "$PROJECT_ROOT/frontend/style.css" "$PROJECT_ROOT/docs/"

echo "2/4 安装 Worker 依赖..."
cd "$PROJECT_ROOT/worker"
npm install

echo "3/4 部署 Worker..."
npx wrangler deploy

echo "4/4 推送到 GitHub（自动触发 Pages 构建和 Worker CI）..."
cd "$PROJECT_ROOT"
git add docs/ worker/ frontend/
git commit -m "deploy: sync frontend & worker" || true
git push origin main

echo "=== 部署完成 ==="
echo "Worker:    https://global-news-monitor.fanxj137616.workers.dev"
echo "Frontend:  https://baxink.github.io/global-news-monitor/"
echo ""
echo "手动触发抓取: curl -X POST https://global-news-monitor.fanxj137616.workers.dev/api/ingest"
echo "查看状态:      gh api repos/baxink/global-news-monitor/pages"
