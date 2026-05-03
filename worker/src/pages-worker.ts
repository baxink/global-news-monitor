import { getEnabledSources, type MediaSource } from './sources';
import { normalizeArticles } from './normalize';
import { fetchRss } from './fetchers/rss';

interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN: string;
  ASSETS: { fetch: (url: string | Request) => Promise<Response> };
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

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300',
  };
}

async function handleNews(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const country = url.searchParams.get('country');
  const q = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '90'), 200);

  let query = 'SELECT * FROM articles';
  const conditions: string[] = [];
  const params: any[] = [];

  if (country) {
    conditions.push('country = ?');
    params.push(country);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY published_at DESC, fetched_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all<ArticleRow>();

  let items = results.map(row => ({
    id: row.id,
    country: row.country,
    mediaName: row.media_name,
    title: row.title,
    summary: row.summary,
    url: row.url,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    lang: row.lang,
  }));

  if (q) {
    const queryLower = q.toLowerCase();
    items = items.filter(
      item =>
        item.title.toLowerCase().includes(queryLower) ||
        item.summary.toLowerCase().includes(queryLower)
    );
  }

  const updatedAt = results.length > 0 ? results[0].fetched_at : new Date().toISOString();

  return new Response(
    JSON.stringify({ updatedAt, total: items.length, items }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.FRONTEND_ORIGIN),
      },
    }
  );
}

async function handleMeta(env: Env): Promise<Response> {
  const countries = await env.DB.prepare(
    'SELECT DISTINCT country FROM articles ORDER BY country'
  ).all<{ country: string }>();

  const sourceCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM media_sources WHERE enabled = 1'
  ).first<{ count: number }>();

  const lastRun = await env.DB.prepare(
    'SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT 1'
  ).first<IngestRow>();

  const articleCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM articles'
  ).first<{ count: number }>();

  return new Response(
    JSON.stringify({
      countries: countries.map(r => r.country),
      sourceCount: sourceCount?.count || 0,
      articleCount: articleCount?.count || 0,
      lastUpdate: lastRun?.finished_at || lastRun?.started_at || null,
      lastRunStatus: lastRun?.status || null,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.FRONTEND_ORIGIN),
      },
    }
  );
}

async function handleIngest(env: Env): Promise<Response> {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO ingest_runs (id, started_at, status) VALUES (?, ?, ?)'
  ).bind(runId, startedAt, 'running').run();

  const sources = getEnabledSources();
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  const CONCURRENCY = 5;
  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(source => ingestSource(env, source))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value > 0) {
        successCount++;
      } else {
        failureCount++;
        const src = batch[j];
        const reason = result.status === 'rejected' ? String(result.reason) : 'no articles';
        errors.push(`${src.id}: ${reason}`);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const status = failureCount === sources.length ? 'failed' : 'success';

  await env.DB.prepare(
    'UPDATE ingest_runs SET finished_at = ?, status = ?, success_count = ?, failure_count = ?, notes = ? WHERE id = ?'
  ).bind(finishedAt, status, successCount, failureCount, errors.join('\n') || null, runId).run();

  await env.DB.prepare(
    "DELETE FROM articles WHERE fetched_at < datetime('now', '-7 days')"
  ).run();

  return new Response(
    JSON.stringify({
      runId,
      status,
      successCount,
      failureCount,
      totalSources: sources.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.FRONTEND_ORIGIN),
      },
    }
  );
}

async function ingestSource(env: Env, source: MediaSource): Promise<number> {
  const raw = await fetchRss(source.feedUrl);
  if (raw.length === 0) return 0;

  const articles = normalizeArticles(
    raw,
    source.id,
    source.country,
    source.mediaName,
    source.language,
    source.articleLimit
  );

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
  return articles.length;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders(env.FRONTEND_ORIGIN) });
      }
      if (url.pathname === '/api/news' && request.method === 'GET') {
        return handleNews(env, request);
      }
      if (url.pathname === '/api/meta' && request.method === 'GET') {
        return handleMeta(env);
      }
      if (url.pathname === '/api/ingest' && request.method === 'POST') {
        return handleIngest(env);
      }
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.FRONTEND_ORIGIN) },
      });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: any): Promise<void> {
    await handleIngest(env);
  },
};
