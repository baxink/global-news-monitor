# nature-daily

每天北京时间早上 6 点自动抓取 Nature 文章，用 Cloudflare Workers AI 生成中文摘要，在 GitHub Pages 展示。

🔗 [baxink.github.io/nature-daily](https://baxink.github.io/nature-daily/)

## 功能

- 抓取 Nature 6 个版面（news / opinion / research / careers / main RSS 等）
- 每天按版面轮换，选出一篇推荐
- **Cloudflare Workers AI 免费内置模型** 生成中文标题与摘要
- 前端 **换一篇** 按钮，手动刷新当日推荐
- GitHub Pages 静态页面实时读取

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | HTML / CSS / JS → GitHub Pages |
| 后端 | Cloudflare Workers (TypeScript) |
| 翻译 | Cloudflare Workers AI (`llama-3.1-8b-instruct`) |
| 数据库 | Cloudflare D1 |
| 定时 | Workers Cron Triggers (`0 22 * * *` UTC = 北京时间 6:00) |

## 项目结构

```
nature-daily/
  docs/           # GitHub Pages 前端
  worker/         # Cloudflare Worker
  shared/         # Nature 来源配置 (JSON)
  db/             # D1 schema 与 seed
```

## 部署

### 1. 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create nature-daily-db
```

把输出的 `database_id` 写入 `worker/wrangler.toml`。

### 2. 初始化数据库

```bash
cd worker
npm run db:init
npm run db:seed
```

### 3. 部署 Worker

```bash
cd worker
npx wrangler deploy
```

### 4. 手动触发一次抓取

```bash
curl -X POST https://<your-worker>.workers.dev/api/ingest
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/daily` | 获取当日日报 |
| POST | `/api/daily/refresh` | **换一篇**：重新选文并翻译 |
| GET | `/api/meta` | 数据库统计信息 |
| POST | `/api/ingest` | 手动触发抓取与选文 |
