import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { buildSync } = require('../node_modules/esbuild/lib/main.js');

async function loadModule(relativePath) {
  const entryPoint = new URL(relativePath, import.meta.url);
  const result = buildSync({
    entryPoints: [entryPoint.pathname],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });

  const code = result.outputFiles[0].text;
  const encoded = Buffer.from(code).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function createDailyCard(row) {
  return {
    digest_date: row.digest_date,
    source_id: row.source_id,
    section: row.section,
    article_id: row.article_id ?? null,
    title_en: row.title_en ?? null,
    title_zh: row.title_zh ?? null,
    summary_en: row.summary_en ?? null,
    summary_zh: row.summary_zh ?? null,
    url: row.url ?? null,
    image_url: row.image_url ?? '',
    published_at: row.published_at ?? null,
    selected_at: row.selected_at,
    is_empty: row.is_empty ?? 0,
    media_name: row.media_name ?? null,
  };
}

function createDbMock(state) {
  const queries = [];
  const getCardsForDate = (digestDate) => [...(state.dailyCardsByDate.get(digestDate)?.values() || [])];
  const getCard = (digestDate, sourceId) => state.dailyCardsByDate.get(digestDate)?.get(sourceId) || null;
  const getLegacyDigest = (digestDate) => state.legacyDailyDigestByDate?.get(digestDate) || null;
  const setCard = (row) => {
    if (!state.dailyCardsByDate.has(row.digest_date)) {
      state.dailyCardsByDate.set(row.digest_date, new Map());
    }
    state.dailyCardsByDate.get(row.digest_date).set(row.source_id, createDailyCard(row));
  };

  return {
    queries,
    async batch(statements) {
      for (const statement of statements) {
        if (typeof statement.run === 'function') {
          await statement.run();
        }
      }
      return [];
    },
    prepare(sql) {
      const createStatement = (params = []) => ({
        async first() {
          queries.push({ sql, params, method: 'first' });

          if (sql.includes('SELECT COUNT(*) as count FROM media_sources WHERE enabled = 1')) {
            return { count: state.metaSourceCount ?? 0 };
          }

          if (sql.includes('SELECT COUNT(*) as count FROM articles')) {
            return { count: state.metaArticleCount ?? 0 };
          }

          if (sql.includes('SELECT COUNT(DISTINCT digest_date) as count FROM daily_digest_cards')) {
            return { count: state.metaDigestCount ?? 0 };
          }

          if (sql.includes('SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT 1')) {
            return state.lastRun ?? null;
          }

          if (sql.includes('SELECT * FROM daily_digest_cards WHERE digest_date = ? AND source_id = ? LIMIT 1')) {
            return getCard(params[0], params[1]);
          }

          if (sql.includes('SELECT d.*, a.media_name') && sql.includes('WHERE d.digest_date = ? AND d.source_id = ?')) {
            return getCard(params[0], params[1]);
          }

          if (sql.includes('SELECT article_id FROM daily_digest_cards WHERE digest_date = ? AND source_id = ? LIMIT 1')) {
            const row = getCard(params[0], params[1]);
            return row ? { article_id: row.article_id } : null;
          }

          if (sql.includes('SELECT d.*, a.media_name') && sql.includes('FROM daily_digest d') && sql.includes('WHERE d.digest_date = ?')) {
            return getLegacyDigest(params[0]);
          }

          if (sql.includes('SELECT * FROM daily_digest WHERE digest_date = ? LIMIT 1')) {
            return getLegacyDigest(params[0]);
          }

          return null;
        },
        async all() {
          queries.push({ sql, params, method: 'all' });

          if (sql.includes('SELECT article_id FROM daily_digest_cards WHERE source_id = ?')) {
            return {
              results: state.recentArticleIdsBySource.get(params[0]) || [],
            };
          }

          if (sql.includes('SELECT d.*, a.media_name') && sql.includes('WHERE d.digest_date = ?')) {
            return {
              results: getCardsForDate(params[0]),
            };
          }

          if (sql.includes('SELECT * FROM daily_digest_cards WHERE digest_date = ?')) {
            return {
              results: getCardsForDate(params[0]),
            };
          }

          return { results: [] };
        },
        async run() {
          queries.push({ sql, params, method: 'run' });

          if (sql.includes('INSERT OR REPLACE INTO daily_digest_cards')) {
            const [digestDate, sourceId, section, articleId, titleEn, titleZh, summaryEn, summaryZh, url, imageUrl, publishedAt, selectedAt, isEmpty] = params;
            setCard({
              digest_date: digestDate,
              source_id: sourceId,
              section,
              article_id: articleId,
              title_en: titleEn,
              title_zh: titleZh,
              summary_en: summaryEn,
              summary_zh: summaryZh,
              url,
              image_url: imageUrl,
              published_at: publishedAt,
              selected_at: selectedAt,
              is_empty: isEmpty,
              media_name: state.mediaNameBySource.get(sourceId) || 'Nature',
            });
            return { success: true };
          }

          return { success: true };
        },
      });

      return {
        bind(...params) {
          return createStatement(params);
        },
        ...createStatement(),
      };
    },
  };
}

test('rejects write requests from untrusted origins', async () => {
  const mod = await loadModule('../src/index.ts');
  const env = {
    DB: {
      prepare() {
        throw new Error('DB should not be used for rejected writes');
      },
    },
    AI: {
      run() {
        throw new Error('AI should not be used for rejected writes');
      },
    },
    FRONTEND_ORIGIN: 'https://baxink.github.io',
  };

  const request = new Request('https://example.com/api/ingest', {
    method: 'POST',
    headers: { Origin: 'https://evil.example' },
  });

  const response = await mod.default.fetch(request, env);
  assert.equal(response.status, 403);
  assert.match(await response.text(), /Forbidden/);
});

test('reports the configured source count in meta even if the seeded table is stale', async () => {
  const mod = await loadModule('../src/index.ts');
  const env = {
    DB: createDbMock({
      dailyCardsByDate: new Map(),
      recentArticleIdsBySource: new Map(),
      mediaNameBySource: new Map(),
      metaSourceCount: 6,
      metaArticleCount: 42,
      metaDigestCount: 3,
      lastRun: {
        id: 'run_1',
        started_at: '2026-05-11T00:00:00.000Z',
        finished_at: '2026-05-11T00:05:00.000Z',
        status: 'success',
        success_count: 7,
        failure_count: 0,
      },
    }),
    AI: { run() { throw new Error('AI should not be used for meta'); } },
    FRONTEND_ORIGIN: 'https://baxink.github.io',
  };

  const response = await mod.default.fetch(new Request('https://example.com/api/meta'), env);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.sourceCount, 7);
  assert.equal(payload.articleCount, 42);
  assert.equal(payload.digestCount, 3);
});

test('returns ordered daily cards and fills missing sources with empty placeholders', async () => {
  const mod = await loadModule('../src/index.ts');
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const state = {
    dailyCardsByDate: new Map([
      [today, new Map([['nature-news', createDailyCard({
        digest_date: today,
        source_id: 'nature-news',
        section: 'news',
        article_id: 'art_existing',
        title_en: 'Existing title',
        title_zh: '现有标题',
        summary_en: 'Existing summary',
        summary_zh: '现有摘要',
        url: 'https://www.nature.com/articles/existing',
        image_url: '',
        published_at: '2026-05-11T00:00:00.000Z',
        selected_at: '2026-05-11T00:00:00.000Z',
        is_empty: 0,
        media_name: 'Nature',
      })]])],
    ]),
    recentArticleIdsBySource: new Map(),
    mediaNameBySource: new Map([
      ['nature-news', 'Nature'],
      ['nature-reviews-bioengineering', 'Nature Reviews Bioengineering'],
    ]),
  };
  const db = createDbMock(state);
  const env = {
    DB: db,
    AI: { run() { throw new Error('AI should not be used for reads'); } },
    FRONTEND_ORIGIN: 'https://baxink.github.io',
  };

  const response = await mod.default.fetch(new Request('https://example.com/api/daily'), env);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.digestDate, today);
  assert.equal(payload.cards.length, 7);
  assert.deepEqual(payload.cards.map(card => card.sourceId), [
    'nature-main-rss',
    'nature-news',
    'nature-opinion',
    'nature-research-analysis',
    'nature-research-articles',
    'nature-careers',
    'nature-reviews-bioengineering',
  ]);
  assert.equal(payload.cards[1].isEmpty, false);
  assert.equal(payload.cards[1].title, '现有标题');
  assert.equal(payload.cards[6].isEmpty, true);
  assert.equal(payload.cards[6].title, '');
});

test('falls back to the legacy single digest row when card rows are not ready yet', async () => {
  const mod = await loadModule('../src/index.ts');
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const state = {
    dailyCardsByDate: new Map(),
    legacyDailyDigestByDate: new Map([
      [today, {
        digest_date: today,
        article_id: 'art_legacy',
        source_id: 'nature-news',
        section: 'news',
        title_en: 'Legacy title',
        title_zh: '旧版标题',
        summary_en: 'Legacy summary',
        summary_zh: '旧版摘要',
        url: 'https://www.nature.com/articles/legacy',
        image_url: '',
        published_at: '2026-05-11T00:00:00.000Z',
        selected_at: '2026-05-11T00:00:00.000Z',
      }],
    ]),
    recentArticleIdsBySource: new Map(),
    mediaNameBySource: new Map([
      ['nature-news', 'Nature'],
    ]),
  };
  const db = createDbMock(state);
  const env = {
    DB: db,
    AI: { run() { throw new Error('AI should not be used for reads'); } },
    FRONTEND_ORIGIN: 'https://baxink.github.io',
  };

  const response = await mod.default.fetch(new Request('https://example.com/api/daily'), env);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.cards.length, 7);
  const legacyCard = payload.cards.find(card => card.sourceId === 'nature-news');
  assert.ok(legacyCard);
  assert.equal(legacyCard.isEmpty, false);
  assert.equal(legacyCard.title, '旧版标题');
  assert.equal(legacyCard.url, 'https://www.nature.com/articles/legacy');
});

test('rejects refresh requests without a sourceId', async () => {
  const mod = await loadModule('../src/index.ts');
  const env = {
    DB: {
      prepare() {
        throw new Error('DB should not be used for invalid refresh requests');
      },
    },
    AI: {
      run() {
        throw new Error('AI should not be used for invalid refresh requests');
      },
    },
    FRONTEND_ORIGIN: 'https://baxink.github.io',
  };

  const response = await mod.default.fetch(new Request('https://example.com/api/daily/refresh', {
    method: 'POST',
    headers: {
      Origin: 'https://baxink.github.io',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  }), env);

  assert.equal(response.status, 400);
  assert.match(await response.text(), /sourceId/i);
});

test('refreshes only the targeted source card', async () => {
  const mod = await loadModule('../src/index.ts');
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const state = {
    dailyCardsByDate: new Map([
      [today, new Map([
        ['nature-main-rss', createDailyCard({
          digest_date: today,
          source_id: 'nature-main-rss',
          section: 'main',
          article_id: 'art_old',
          title_en: 'Old main title',
          title_zh: '旧主刊标题',
          summary_en: 'Old main summary',
          summary_zh: '旧主刊摘要',
          url: 'https://www.nature.com/articles/old-main',
          image_url: '',
          published_at: '2026-05-01T00:00:00.000Z',
          selected_at: '2026-05-11T00:00:00.000Z',
          is_empty: 0,
          media_name: 'Nature',
        })],
        ['nature-news', createDailyCard({
          digest_date: today,
          source_id: 'nature-news',
          section: 'news',
          article_id: 'art_news',
          title_en: 'News title',
          title_zh: '新闻标题',
          summary_en: 'News summary',
          summary_zh: '新闻摘要',
          url: 'https://www.nature.com/articles/news',
          image_url: '',
          published_at: '2026-05-02T00:00:00.000Z',
          selected_at: '2026-05-11T00:00:00.000Z',
          is_empty: 0,
          media_name: 'Nature',
        })],
      ])],
    ]),
    recentArticleIdsBySource: new Map([
      ['nature-main-rss', [{ article_id: 'art_old' }]],
    ]),
    mediaNameBySource: new Map([
      ['nature-main-rss', 'Nature'],
      ['nature-news', 'Nature'],
    ]),
  };
  const db = createDbMock(state);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === 'https://www.nature.com/nature.rss') {
      return new Response(`<?xml version="1.0"?>
        <rss version="2.0"><channel>
          <item>
            <title>Latest main article</title>
            <link>https://www.nature.com/articles/new-main</link>
            <description>Fresh summary</description>
            <pubDate>Mon, 11 May 2026 00:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Older main article</title>
            <link>https://www.nature.com/articles/old-main</link>
            <description>Old summary</description>
            <pubDate>Sun, 10 May 2026 00:00:00 GMT</pubDate>
          </item>
        </channel></rss>`, { status: 200 });
    }

    return new Response('', { status: 200 });
  };

  try {
    const env = {
      DB: db,
      AI: {
        run() {
          return { response: '{"titleZh":"新主刊标题","summaryZh":"新主刊摘要"}' };
        },
      },
      FRONTEND_ORIGIN: 'https://baxink.github.io',
    };

    const response = await mod.default.fetch(new Request('https://example.com/api/daily/refresh', {
      method: 'POST',
      headers: {
        Origin: 'https://baxink.github.io',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourceId: 'nature-main-rss' }),
    }), env);

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.sourceId, 'nature-main-rss');
    assert.equal(payload.url, 'https://www.nature.com/articles/new-main');
    assert.equal(payload.isEmpty, false);
    assert.equal(state.dailyCardsByDate.get(today).get('nature-news').url, 'https://www.nature.com/articles/news');
    assert.equal(state.dailyCardsByDate.get(today).get('nature-main-rss').url, 'https://www.nature.com/articles/new-main');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchHtml reads published time from nearby metadata', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`
    <html>
      <body>
        <article>
          <time datetime="2024-01-15T12:34:56Z"></time>
          <a href="/articles/example-article">Nature Example article title long enough</a>
        </article>
      </body>
    </html>
  `, { status: 200 });

  try {
    const { fetchHtml } = await loadModule('../src/fetchers/html.ts');
    const [article] = await fetchHtml('https://www.nature.com/news');

    assert.ok(article);
    assert.equal(article.pubDate, '2024-01-15T12:34:56.000Z');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
