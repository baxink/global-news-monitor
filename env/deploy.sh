#!/bin/bash
# 全球主流媒体时政监控 - 一键部署脚本
# 用法: bash env/deploy.sh
# 注意: 本地 Node.js 可能存在 TLS 证书验证问题，需设置 NODE_TLS_REJECT_UNAUTHORIZED=0
#       生产环境（如 GitHub Actions）不需要此设置

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== 部署开始: 全球主流媒体时政监控 ==="

# 加载环境变量
export $(grep -v '^\s*#' "$PROJECT_ROOT/env/.env.cloudflare" | xargs)
export $(grep -v '^\s*#' "$PROJECT_ROOT/env/.env.github" | xargs)

# macOS 本地 TLS 兼容性
export NODE_TLS_REJECT_UNAUTHORIZED=0

echo "1/4 安装 Worker 依赖..."
cd "$PROJECT_ROOT/worker"
npm install

echo "2/4 部署 Worker..."
npx wrangler deploy

echo "3/4 部署前端到 GitHub Pages..."
cd "$PROJECT_ROOT"
git add frontend/
git commit -m "deploy: update frontend" || true
git push origin main

echo "4/4 触发 GitHub Actions 部署..."
# Worker GitHub Actions 会自动触发
# 如果 Pages 未配置，可以用 gh CLI 启用
if command -v gh &> /dev/null; then
  gh api repos/baxink/global-news-monitor/pages -X POST \
    --input <(cat <<JSON
{"source":{"branch":"main","path":"/frontend"}}
JSON
) 2>/dev/null || echo "GitHub Pages 可能已配置或需手动设置"
fi

echo "=== 部署完成 ==="
echo "Worker:    https://global-news-monitor.fanxj137616.workers.dev"
echo "Frontend:  https://baxink.github.io/global-news-monitor/"
echo "DB:        global-news-monitor-db (D1)"
echo ""
echo "手动触发抓取: curl -X POST https://global-news-monitor.fanxj137616.workers.dev/api/ingest"
