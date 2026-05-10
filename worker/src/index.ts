import { getEnabledSources, type MediaSource } from './sources';
import { normalizeArticles, type NormalizedArticle } from './normalize';
import { fetchRss } from './fetchers/rss';
import { fetchHtml } from './fetchers/html';

interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN: string;
  OPENAI_API_KEY?: string;
}

interface ArticleRow {
  id: string;
  source_id: string;
  country: string;
  media_name: string;
  title: string;
  summary: string;
  url: string;
  image_url: string;
  published_at: string;
  fetched_at: string;
  lang: string;
}

interface IngestRow {
  id: string;
  started_at: string;
  finished_at: string;
  status: string;
  success_count: number;
  failure_count: number;
}

interface DailyDigestRow {
  digest_date: string;
  article_id: string;
  source_id: string;
  section: string;
  title_en: string;
  title_zh: string;
  summary_en: string;
  summary_zh: string;
  url: string;
  image_url: string;
  published_at: string;
  selected_at: string;
}

interface DigestPayload {
  digestDate: string;
  section: string;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  selectedAt: string;
  sourceId: string;
  mediaName: string;
}

const DEFAULT_FRONTEND_ORIGIN = 'https://baxink.github.io';

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300',
  };
}

function getRequestOrigin(request: Request): string {
  const origin = request.headers.get('Origin');
  return origin || DEFAULT_FRONTEND_ORIGIN;
}

function toDigestDate(date: Date = new Date()): string {
  const offsetMs = 8 * 60 * 60 * 1000;
  return new Date(date.getTime() + offsetMs).toISOString().slice(0, 10);
}

function getRotatingSource(sources: MediaSource[], digestDate: string): MediaSource[] {
  if (sources.length === 0) return [];
  const anchor = new Date(`${digestDate}T00:00:00+08:00`).getTime();
  const index = Math.floor(anchor / 86400000) % sources.length;
  return [...sources.slice(index), ...sources.slice(0, index)];
}

function normalizeSectionLabel(section: string): string {
  return section
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripMarkdownFence(text: string): string {
  return text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
}

async function summarizeInChinese(env: Env, article: NormalizedArticle): Promise<{ titleZh: string; summaryZh: string }> {
  if (!env.OPENAI_API_KEY) {
    return {
      titleZh: article.title,
      summaryZh: article.summary || article.title,
    };
  }

  const prompt = [
    '请把下面这篇 Nature 文章信息整理成简体中文。',
    '要求：标题简洁准确；摘要 2-3 句，忠于原意，不要编造。',
    '只返回 JSON，格式为 {"titleZh":"...","summaryZh":"..."}。',
    `原标题：${article.title}`,
    `英文摘要：${article.summary || article.title}`,
    `链接：${article.url}`,
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: prompt,
    }),
  });

  if (!res.ok) {
    return {
      titleZh: article.title,
      summaryZh: article.summary || article.title,
    };
  }

  const data = await res.json() as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const outputText = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text || '';
  const text = stripMarkdownFence(outputText);

  try {
    const parsed = JSON.parse(text) as { titleZh?: string; summaryZh?: string };
    return {
      titleZh: parsed.titleZh?.trim() || article.title,
      summaryZh: parsed.summaryZh?.trim() || article.summary || article.title,
    };
  } catch {
    return {
      titleZh: article.title,
      summaryZh: article.summary || article.title,
    };
  }
}

function mapDigestRow(row: DailyDigestRow & { media_name?: string }): DigestPayload {
  return {
    digestDate: row.digest_date,
    section: normalizeSectionLabel(row.section),
    title: row.title_zh,
    titleEn: row.title_en,
    summary: row.summary_zh,
    summaryEn: row.summary_en,
    url: row.url,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    selectedAt: row.selected_at,
    sourceId: row.source_id,
    mediaName: row.media_name || 'Nature',
  };
}

async function fetchArticles(source: MediaSource): Promise<NormalizedArticle[]> {
  const raw = source.parserType === 'html'
    ? await fetchHtml(source.feedUrl)
    : await fetchRss(source.feedUrl);

  if (raw.length === 0) return [];

  return normalizeArticles(
    raw,
    source.id,
    source.country,
    source.mediaName,
    source.language,
    source.articleLimit
  );
}

async function upsertArticles(env: Env, articles: NormalizedArticle[]): Promise<void> {
  if (articles.length === 0) return;

  const stmts = articles.map(article =>
    env.DB.prepare(
      `INSERT OR REPLACE INTO articles (id, source_id, country, media_name, title, summary, url, image_url, published_at, fetched_at, lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      article.id,
      article.sourceId,
      article.country,
      article.mediaName,
      article.title,
      article.summary,
      article.url,
      article.imageUrl,
      article.publishedAt,
      article.fetchedAt,
      article.lang
    )
  );

  await env.DB.batch(stmts);
}

async function selectDailyDigest(env: Env, sources: MediaSource[], articles: NormalizedArticle[], digestDate: string): Promise<DailyDigestRow | null> {
  const orderedSources = getRotatingSource(sources, digestDate);
  const recentRows = await env.DB.prepare(
    'SELECT article_id FROM daily_digest ORDER BY digest_date DESC LIMIT 14'
  ).all<{ article_id: string }>();
  const recentIds = new Set(recentRows.results.map(row => row.article_id));

  for (const source of orderedSources) {
    const candidates = articles
      .filter(article => article.sourceId === source.id)
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

    const selected = candidates.find(article => !recentIds.has(article.id)) || candidates[0];
    if (!selected) continue;

    const localized = await summarizeInChinese(env, selected);

    await env.DB.prepare(
      `INSERT OR REPLACE INTO daily_digest (
        digest_date, article_id, source_id, section, title_en, title_zh, summary_en, summary_zh, url, image_url, published_at, selected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      digestDate,
      selected.id,
      source.id,
      source.section,
      selected.title,
      localized.titleZh,
      selected.summary,
      localized.summaryZh,
      selected.url,
      selected.imageUrl,
      selected.publishedAt,
      new Date().toISOString()
    ).run();

    const digest = await env.DB.prepare(
      'SELECT * FROM daily_digest WHERE digest_date = ? LIMIT 1'
    ).bind(digestDate).first<DailyDigestRow>();

    return digest || null;
  }

  return null;
}

async function runIngest(env: Env): Promise<{ runId: string; status: string; successCount: number; failureCount: number; totalSources: number; digestDate: string; digestCreated: boolean; errors?: string[] }> {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO ingest_runs (id, started_at, status) VALUES (?, ?, ?)'
  ).bind(runId, startedAt, 'running').run();

  const sources = getEnabledSources();
  const articles: NormalizedArticle[] = [];
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const sourceArticles = await fetchArticles(source);
      if (sourceArticles.length === 0) {
        failureCount++;
        errors.push(`${source.id}: no articles`);
        continue;
      }
      articles.push(...sourceArticles);
      await upsertArticles(env, sourceArticles);
      successCount++;
    } catch (error) {
      failureCount++;
      errors.push(`${source.id}: ${String(error)}`);
    }
  }

  const digestDate = toDigestDate();
  const existingDigest = await env.DB.prepare(
    'SELECT * FROM daily_digest WHERE digest_date = ? LIMIT 1'
  ).bind(digestDate).first<DailyDigestRow>();

  const digest = existingDigest || await selectDailyDigest(env, sources, articles, digestDate);
  const status = successCount > 0 ? 'success' : 'failed';
  const finishedAt = new Date().toISOString();

  await env.DB.prepare(
    'UPDATE ingest_runs SET finished_at = ?, status = ?, success_count = ?, failure_count = ?, notes = ? WHERE id = ?'
  ).bind(finishedAt, status, successCount, failureCount, errors.join('\n') || null, runId).run();

  await env.DB.prepare(
    "DELETE FROM articles WHERE fetched_at < datetime('now', '-30 days')"
  ).run();

  return {
    runId,
    status,
    successCount,
    failureCount,
    totalSources: sources.length,
    digestDate,
    digestCreated: Boolean(digest),
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function handleDaily(env: Env, request: Request): Promise<Response> {
  const today = toDigestDate();
  const digest = await env.DB.prepare(
    `SELECT d.*, a.media_name
     FROM daily_digest d
     LEFT JOIN articles a ON a.id = d.article_id
     WHERE d.digest_date = ?
     LIMIT 1`
  ).bind(today).first<DailyDigestRow & { media_name?: string }>();

  if (!digest) {
    return new Response(JSON.stringify({ error: 'Daily digest not ready' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(getRequestOrigin(request)),
      },
    });
  }

  return new Response(JSON.stringify(mapDigestRow(digest)), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(getRequestOrigin(request)),
    },
  });
}

async function handleMeta(env: Env, request: Request): Promise<Response> {
  const sourceCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM media_sources WHERE enabled = 1'
  ).first<{ count: number }>();

  const lastRun = await env.DB.prepare(
    'SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT 1'
  ).first<IngestRow>();

  const articleCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM articles'
  ).first<{ count: number }>();

  const digestCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM daily_digest'
  ).first<{ count: number }>();

  return new Response(
    JSON.stringify({
      sourceCount: sourceCount?.count || 0,
      articleCount: articleCount?.count || 0,
      digestCount: digestCount?.count || 0,
      lastUpdate: lastRun?.finished_at || lastRun?.started_at || null,
      lastRunStatus: lastRun?.status || null,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(getRequestOrigin(request)),
      },
    }
  );
}

async function handleIngest(env: Env, request: Request): Promise<Response> {
  const result = await runIngest(env);
  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(getRequestOrigin(request)),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(getRequestOrigin(request)),
      });
    }

    if (url.pathname === '/api/daily' && request.method === 'GET') {
      return handleDaily(env, request);
    }

    if (url.pathname === '/api/meta' && request.method === 'GET') {
      return handleMeta(env, request);
    }

    if (url.pathname === '/api/ingest' && request.method === 'POST') {
      return handleIngest(env, request);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runIngest(env);
  },
};
