(function () {
  'use strict';

  const API_BASE = 'https://nature-daily.fanxj137616.workers.dev';
  const digestGrid = document.getElementById('digestGrid');
  const metaInfo = document.getElementById('metaInfo');
  let currentDigest = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '未知';
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return isoStr;
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Shanghai',
    }).format(date);
  }

  function renderCard(item) {
    const emptyState = item.isEmpty
      ? `
        <div class="digest-empty">
          <p class="digest-empty-title">今日暂无内容</p>
          <p class="digest-empty-copy">该版面今天没有抓取到可用文章，保留卡片位以便后续刷新。</p>
        </div>
      `
      : `
        <h2 class="digest-title">${escapeHtml(item.title)}</h2>
        <p class="digest-summary">${escapeHtml(item.summary)}</p>

        <div class="digest-divider"></div>

        <p class="digest-original-label">Original title</p>
        <h3 class="digest-original-title">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.titleEn)}</a>
        </h3>
        <p class="digest-original-summary">${escapeHtml(item.summaryEn || '')}</p>
      `;

    const primaryAction = item.isEmpty
      ? '<span class="action-link action-disabled">暂无原文</span>'
      : `<a class="action-link action-primary" href="${item.url}" target="_blank" rel="noopener noreferrer">阅读 Nature 原文</a>`;

    return `
      <article class="digest-card${item.isEmpty ? ' digest-card-empty' : ''}">
        <div class="digest-top">
          <span class="badge badge-section">${escapeHtml(item.section)}</span>
          <span class="badge badge-date">${escapeHtml(item.digestDate)}</span>
        </div>

        <div class="digest-source">
          <p class="digest-source-name">${escapeHtml(item.mediaName)}</p>
          <p class="digest-source-key">${escapeHtml(item.sourceId)}</p>
        </div>

        ${emptyState}

        <div class="digest-meta">
          <div class="meta-block">
            <span class="meta-label">发布时间</span>
            <span class="meta-value">${escapeHtml(formatDate(item.publishedAt))}</span>
          </div>
          <div class="meta-block">
            <span class="meta-label">日报日期</span>
            <span class="meta-value">${escapeHtml(item.digestDate)}</span>
          </div>
        </div>

        <div class="actions">
          ${primaryAction}
          <button class="action-link action-refresh" data-source-id="${escapeHtml(item.sourceId)}" type="button">换一篇</button>
        </div>
      </article>
    `;
  }

  function renderDigest(payload) {
    currentDigest = payload;

    if (!payload || !Array.isArray(payload.cards) || payload.cards.length === 0) {
      digestGrid.innerHTML = '<div class="empty">今日日报暂未生成，请稍后再试。</div>';
      return;
    }

    digestGrid.innerHTML = payload.cards.map(renderCard).join('');
  }

  async function refreshCard(sourceId, button) {
    if (button) {
      button.disabled = true;
      button.textContent = '加载中...';
    }

    try {
      const res = await fetch(`${API_BASE}/api/daily/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      if (!res.ok) throw new Error('refresh error');

      const card = await res.json();
      if (currentDigest && Array.isArray(currentDigest.cards)) {
        currentDigest = {
          ...currentDigest,
          cards: currentDigest.cards.map(item => item.sourceId === sourceId ? card : item),
        };
        renderDigest(currentDigest);
      } else {
        await fetchDaily();
      }
    } catch {
      if (button) {
        button.disabled = false;
        button.textContent = '换一篇';
      }
      alert('更换失败，请稍后再试');
    }
  }

  async function fetchMeta() {
    try {
      const res = await fetch(`${API_BASE}/api/meta`);
      if (!res.ok) throw new Error('meta error');
      const data = await res.json();
      metaInfo.textContent = `已配置 ${data.sourceCount} 个版面 · 已抓取 ${data.articleCount} 篇文章 · 已生成 ${data.digestCount} 期日报`;
    } catch {
      metaInfo.textContent = '无法获取更新状态';
    }
  }

  async function fetchDaily() {
    try {
      const res = await fetch(`${API_BASE}/api/daily`);
      if (!res.ok) throw new Error('daily error');
      const data = await res.json();
      renderDigest(data);
    } catch {
      digestGrid.innerHTML = '<div class="empty">今日日报暂未生成，请稍后再试。</div>';
    }
  }

  digestGrid.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-source-id]') : null;
    if (!target) return;

    const sourceId = target.getAttribute('data-source-id');
    if (!sourceId) return;

    refreshCard(sourceId, target);
  });

  fetchMeta();
  fetchDaily();
})();
