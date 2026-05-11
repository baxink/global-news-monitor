import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createDigestApp } from './app.js';

function setupDom() {
  const dom = new JSDOM(
    `<!DOCTYPE html>
    <html lang="zh-CN">
      <body>
        <div id="metaInfo"></div>
        <div id="digestGrid"></div>
      </body>
    </html>`,
    { url: 'https://example.com/' }
  );

  global.window = dom.window;
  global.document = dom.window.document;
  global.Element = dom.window.Element;
  return dom;
}

function samplePayload() {
  return {
    digestDate: '2026-05-11',
    cards: [
      {
        sourceId: 'nature-main-rss',
        section: 'Main',
        mediaName: 'Nature',
        title: '主版块头条',
        titleEn: 'Lead story',
        summary: '这是头条摘要。',
        summaryEn: 'Lead summary.',
        url: 'https://example.com/main',
        publishedAt: '2026-05-11T00:00:00.000Z',
        selectedAt: '2026-05-11T00:30:00.000Z',
        isEmpty: false,
      },
      {
        sourceId: 'nature-news',
        section: 'News',
        mediaName: 'Nature',
        title: '新闻栏目',
        titleEn: 'News story',
        summary: '新闻摘要。',
        summaryEn: 'News summary.',
        url: 'https://example.com/news',
        publishedAt: '2026-05-11T01:00:00.000Z',
        selectedAt: '2026-05-11T01:30:00.000Z',
        isEmpty: false,
      },
    ],
  };
}

test('renderDigest puts nature-main-rss into the lead slot and other cards into section columns', () => {
  setupDom();
  const app = createDigestApp({
    apiBase: 'https://example.com',
    digestRoot: document.getElementById('digestGrid'),
    metaRoot: document.getElementById('metaInfo'),
    fetchImpl: async () => {
      throw new Error('not used');
    },
  });

  app.renderDigest(samplePayload());

  const lead = document.querySelector('[data-role="lead-story"]');
  const sectionItems = [...document.querySelectorAll('[data-role="section-story"]')];

  assert.ok(lead);
  assert.match(lead.textContent, /主版块头条/u);
  assert.equal(sectionItems.length, 1);
  assert.match(sectionItems[0].textContent, /新闻栏目/u);
});

test('renderDigest keeps the lead slot visible when the lead story is empty', () => {
  setupDom();
  const app = createDigestApp({
    apiBase: 'https://example.com',
    digestRoot: document.getElementById('digestGrid'),
    metaRoot: document.getElementById('metaInfo'),
    fetchImpl: async () => {
      throw new Error('not used');
    },
  });

  const payload = samplePayload();
  payload.cards[0] = {
    ...payload.cards[0],
    title: '',
    titleEn: '',
    summary: '',
    summaryEn: '',
    url: '',
    publishedAt: null,
    isEmpty: true,
  };

  app.renderDigest(payload);

  const lead = document.querySelector('[data-role="lead-story"]');
  assert.ok(lead);
  assert.match(lead.textContent, /今日主版块暂无可用文章/u);
});

test('mergeCardUpdate replaces only the matching source item', () => {
  setupDom();
  const app = createDigestApp({
    apiBase: 'https://example.com',
    digestRoot: document.getElementById('digestGrid'),
    metaRoot: document.getElementById('metaInfo'),
    fetchImpl: async () => {
      throw new Error('not used');
    },
  });

  const payload = samplePayload();
  payload.cards.push({
    sourceId: 'nature-opinion',
    section: 'Opinion',
    mediaName: 'Nature',
    title: '观点栏目',
    titleEn: 'Opinion story',
    summary: '观点摘要。',
    summaryEn: 'Opinion summary.',
    url: 'https://example.com/opinion',
    publishedAt: '2026-05-11T02:00:00.000Z',
    selectedAt: '2026-05-11T02:30:00.000Z',
    isEmpty: false,
  });

  app.renderDigest(payload);
  app.mergeCardUpdate({
    sourceId: 'nature-news',
    section: 'News',
    mediaName: 'Nature',
    title: '新闻栏目已刷新',
    titleEn: 'Updated news story',
    summary: '新的新闻摘要。',
    summaryEn: 'Updated news summary.',
    url: 'https://example.com/news-2',
    publishedAt: '2026-05-11T03:00:00.000Z',
    selectedAt: '2026-05-11T03:30:00.000Z',
    isEmpty: false,
  });

  const lead = document.querySelector('[data-role="lead-story"]');
  const sections = [...document.querySelectorAll('[data-role="section-story"]')];
  const sectionText = sections.map((node) => node.textContent).join(' ');
  const newsMentions = sections.filter((node) => /新闻栏目/u.test(node.textContent));
  const updatedNewsMentions = sections.filter((node) => /新闻栏目已刷新/u.test(node.textContent));

  assert.match(lead.textContent, /主版块头条/u);
  assert.equal(sections.length, 2);
  assert.equal(newsMentions.length, 0);
  assert.equal(updatedNewsMentions.length, 1);
  assert.match(sectionText, /新闻栏目已刷新/u);
  assert.match(sectionText, /观点栏目/u);
});
