(function () {
  'use strict';

  const API_BASE = 'https://nature-daily.fanxj137616.workers.dev';
  const digestCard = document.getElementById('digestCard');
  const metaInfo = document.getElementById('metaInfo');

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

  function renderDigest(item) {
    digestCard.innerHTML = `
      <div class="digest-body">
        <div class="digest-top">
          <span class="badge badge-section">${escapeHtml(item.section)}</span>
          <span class="badge badge-date">${escapeHtml(item.digestDate)}</span>
        </div>

        <h2 class="digest-title">${escapeHtml(item.title)}</h2>
        <p class="digest-summary">${escapeHtml(item.summary)}</p>

        <div class="digest-divider"></div>

        <p class="digest-original-label">Original title</p>
        <h3 class="digest-original-title">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.titleEn)}</a>
        </h3>
        <p class="digest-original-summary">${escapeHtml(item.summaryEn || '')}</p>

        <div class="digest-meta">
          <div class="meta-block">
            <span class="meta-label">来源版面</span>
            <span class="meta-value">${escapeHtml(item.section)}</span>
          </div>
          <div class="meta-block">
            <span class="meta-label">文章来源</span>
            <span class="meta-value">${escapeHtml(item.mediaName || 'Nature')}</span>
          </div>
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
          <a class="action-link action-primary" href="${item.url}" target="_blank" rel="noopener noreferrer">阅读 Nature 原文</a>
          <button class="action-link action-refresh" id="btnRefresh" type="button">🔄 换一篇</button>
          <a class="action-link action-secondary" href="https://www.nature.com" target="_blank" rel="noopener noreferrer">打开 Nature 首页</a>
        </div>
      </div>
    `;

    const btn = document.getElementById('btnRefresh');
    if (btn) {
      btn.addEventListener('click', refreshDaily);
    }
  }

  async function refreshDaily() {
    const btn = document.getElementById('btnRefresh');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ 加载中...';
    }

    try {
      const res = await fetch(`${API_BASE}/api/daily/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('refresh error');
      const data = await res.json();
      renderDigest(data);
    } catch {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 换一篇';
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
      digestCard.innerHTML = '<div class="empty">今日日报暂未生成，请稍后再试。</div>';
    }
  }

  fetchMeta();
  fetchDaily();
})();
