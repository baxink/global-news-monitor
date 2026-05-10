# nature-daily

每天北京时间早上 6 点自动抓取并生成一篇 Nature 日报，在 GitHub Pages 页面上展示中文摘要、原标题、版面信息和原文链接。

GitHub Pages: [https://baxink.github.io/nature-daily/](https://baxink.github.io/nature-daily/)

## 功能

- 按天轮换 Nature 不同版面
- 每天选出 1 篇文章作为当日推荐
- 自动生成中文标题与中文摘要
- GitHub 静态页面实时读取当日内容
- Cloudflare Worker 每天北京时间 6:00 自动更新

## 技术栈

- **前端**: 纯 HTML/CSS/JS → GitHub Pages
- **后端**: Cloudflare Workers (TypeScript)
- **数据库**: Cloudflare D1
- **定时任务**: Workers Cron Triggers
- **代码托管**: GitHub

## 部署

### 1. 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create nature-daily-db
```

把输出的 `database_id` 写入 [worker/wrangler.toml](worker/wrangler.toml)。

### 2. 初始化数据库

```bash
npm run db:init
npm run db:seed
```

### 3. 配置 OpenAI Key

在 Worker 环境里添加 `OPENAI_API_KEY`，用于生成中文标题与摘要。

```bash
cd worker
npx wrangler secret put OPENAI_API_KEY
```

### 4. 部署 Worker

```bash
npm run deploy:worker
```

### 5. 手动触发一次抓取

```bash
curl -X POST https://<your-worker-subdomain>.workers.dev/api/ingest
```

## 项目结构

```text
nature-daily/
  docs/           # GitHub Pages 静态页面
  worker/         # Cloudflare Worker
  shared/         # Nature 来源配置
  db/             # D1 schema 与 seed
```

## API

- `GET /api/daily` — 获取当天日报
- `GET /api/meta` — 获取抓取元数据
- `POST /api/ingest` — 手动触发当天抓取与选文
