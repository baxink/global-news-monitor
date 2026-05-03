# 全球主流媒体时政监控

覆盖 10 个国家、30 家主流媒体的时政新闻聚合仪表盘。

GitHub Pages: https://baxink.github.io/global-news-monitor/

## 功能

- 按国家筛选新闻
- 标题与摘要关键词搜索
- NEW 新鲜度标记
- 点击标题直达原文
- 每 6 小时自动更新

## 技术栈

- **前端**: 纯 HTML/CSS/JS → Cloudflare Pages
- **后端**: Cloudflare Workers (TypeScript)
- **数据库**: Cloudflare D1
- **定时任务**: Workers Cron Triggers
- **代码托管**: GitHub

## 部署

### 1. 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create global-news-monitor-db
```

将输出的 `database_id` 填入 `worker/wrangler.toml` 的 `database_id` 字段。

### 2. 初始化数据库表

```bash
cd worker
npx wrangler d1 execute global-news-monitor-db --file=../db/schema.sql --remote
```

### 3. 部署 Worker

```bash
cd worker
npx wrangler deploy
```

### 4. 部署前端

```bash
cd frontend
npx wrangler pages deploy . --project-name=global-news-monitor
```

### 5. 手动触发一次抓取

```bash
curl -X POST https://<your-worker-subdomain>.workers.dev/api/ingest
```

## 项目结构

```
全球主流媒体时政监控/
  frontend/       # 前端静态文件
  worker/         # Cloudflare Worker
  shared/         # 媒体源配置
  db/             # 数据库 Schema
```

## API

- `GET /api/news?country=&q=&limit=90` — 获取新闻列表
- `GET /api/meta` — 获取元数据（国家列表、源数量、上次更新）
- `POST /api/ingest` — 手动触发抓取
