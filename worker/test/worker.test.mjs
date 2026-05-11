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

function createDbMock(state) {
  const queries = [];

  return {
    queries,
    prepare(sql) {
      const createStatement = (params = []) => ({
        async first() {
          queries.push({ sql, params, method: 'first' });

          if (sql.includes('SELECT article_id FROM daily_digest WHERE digest_date = ? LIMIT 1')) {
            return state.dailyDigestByDate.get(params[0]) || null;
          }

          if (sql.includes('SELECT * FROM daily_digest WHERE digest_date = ? LIMIT 1')) {
            return state.dailyDigestByDate.get(params[0]) || null;
          }

          return null;
        },
        async all() {
          queries.push({ sql, params, method: 'all' });

          if (sql.includes('SELECT article_id FROM daily_digest ORDER BY digest_date DESC LIMIT 14')) {
            return {
              results: [...state.dailyDigestByDate.values()].map(row => ({ article_id: row.article_id })),
            };
          }

          return { results: [] };
        },
        async run() {
          queries.push({ sql, params, method: 'run' });

          if (sql.includes('DELETE FROM daily_digest WHERE digest_date = ?')) {
            state.dailyDigestByDate.delete(params[0]);
            return { success: true };
          }

          if (sql.includes('INSERT OR REPLACE INTO daily_digest')) {
            const [digestDate, articleId, sourceId, section, titleEn, titleZh, summaryEn, summaryZh, url, imageUrl, publishedAt, selectedAt] = params;
            state.dailyDigestByDate.set(digestDate, {
              digest_date: digestDate,
              article_id: articleId,
              source_id: sourceId,
              section,
              title_en: titleEn,
              title_zh: titleZh,
              summary_en: summaryEn,
              summary_zh: summaryZh,
              url,
              image_url: imageUrl,
              published_at: publishedAt,
              selected_at: selectedAt,
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

test('keeps the existing digest when refresh cannot select a replacement', async () => {
  const mod = await loadModule('../src/index.ts');
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const state = {
    dailyDigestByDate: new Map([
      [today, {
        digest_date: today,
        article_id: 'art_existing',
        source_id: 'nature-news',
        section: 'news',
        title_en: 'Existing title',
        title_zh: '现有标题',
        summary_en: 'Existing summary',
        summary_zh: '现有摘要',
        url: 'https://www.nature.com/articles/existing',
        image_url: '',
        published_at: '2026-05-11T00:00:00.000Z',
        selected_at: '2026-05-11T00:00:00.000Z',
      }],
    ]),
  };
  const db = createDbMock(state);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 200 });

  try {
    const env = {
      DB: db,
      AI: {
        run() {
          return { response: '{"titleZh":"标题","summaryZh":"摘要"}' };
        },
      },
      FRONTEND_ORIGIN: 'https://baxink.github.io',
    };

    const request = new Request('https://example.com/api/daily/refresh', {
      method: 'POST',
      headers: { Origin: 'https://baxink.github.io' },
    });

    const response = await mod.default.fetch(request, env);
    assert.equal(response.status, 404);
    assert.ok(state.dailyDigestByDate.has(today));
    assert.equal(state.dailyDigestByDate.get(today).article_id, 'art_existing');
    assert.equal(db.queries.some(entry => entry.sql.includes('DELETE FROM daily_digest WHERE digest_date = ?')), false);
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
