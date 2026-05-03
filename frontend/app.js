(function () {
  'use strict';

  const API_BASE = window.__API_BASE__ || '';
  let allItems = [];
  let currentCountry = '';
  let searchQuery = '';

  const countryFilters = document.getElementById('countryFilters');
  const searchInput = document.getElementById('searchInput');
  const newsGrid = document.getElementById('newsGrid');
  const newsCount = document.getElementById('newsCount');
  const metaInfo = document.getElementById('metaInfo');

  function formatTimeAgo(isoStr) {
    if (!isoStr) return '';
    const now = Date.now();
    const then = new Date(isoStr).getTime();
    if (isNaN(then)) return '';
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  }

  function getNewBadge(isoStr) {
    if (!isoStr) return '';
    const diff = Date.now() - new Date(isoStr).getTime();
    if (diff < 0 || diff >= 86400000) return '';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 60) return `NEW ${minutes}m`;
    return `NEW ${hours}h`;
  }

  function createCard(item) {
    const newBadge = getNewBadge(item.publishedAt);
    const timeAgo = formatTimeAgo(item.publishedAt);
    const summary = item.summary
      ? item.summary.length > 200
        ? item.summary.slice(0, 200) + '...'
        : item.summary
      : '';

    const div = document.createElement('div');
    div.className = 'news-card';
    div.innerHTML = `
      <div class="card-meta">
        <span class="country-tag ${item.countryCode || ''}">${item.country}</span>
        <span class="media-name">${item.mediaName}</span>
      </div>
      <div class="card-title">
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
      </div>
      ${summary ? `<div class="card-summary">${escapeHtml(summary)}</div>` : ''}
      <div class="card-footer">
        <span>${timeAgo}</span>
        ${newBadge ? `<span class="new-badge">${newBadge}</span>` : ''}
      </div>
    `;
    return div;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    let filtered = allItems;

    if (currentCountry) {
      filtered = filtered.filter(item => item.country === currentCountry);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.title.toLowerCase().includes(q) ||
          (item.summary && item.summary.toLowerCase().includes(q))
      );
    }

    newsCount.textContent = `共 ${filtered.length} 条新闻`;
    newsGrid.innerHTML = '';

    if (filtered.length === 0) {
      newsGrid.innerHTML = '<div class="empty">暂无匹配的新闻</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(item => fragment.appendChild(createCard(item)));
    newsGrid.appendChild(fragment);
  }

  async function fetchMeta() {
    try {
      const res = await fetch(`${API_BASE}/api/meta`);
      if (!res.ok) return;
      const data = await res.json();

      metaInfo.textContent =
        `上次更新：${data.lastUpdate ? formatTimeAgo(data.lastUpdate) : '尚未更新'} · ` +
        `${data.sourceCount} 个媒体源 · ${data.articleCount} 条文章`;

      if (data.countries && data.countries.length > 0) {
        data.countries.forEach(country => {
          const btn = document.createElement('button');
          btn.className = 'country-btn';
          btn.dataset.country = country;
          btn.textContent = country;
          countryFilters.appendChild(btn);
        });
      }
    } catch {
      metaInfo.textContent = '无法获取元数据';
    }
  }

  async function fetchNews() {
    try {
      const res = await fetch(`${API_BASE}/api/news?limit=200`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      allItems = data.items.map(item => ({
        ...item,
        countryCode: getCountryCode(item.country),
      }));

      render();
    } catch {
      newsGrid.innerHTML = '<div class="empty">加载失败，请稍后重试</div>';
    }
  }

  function getCountryCode(country) {
    const map = {
      '美国': 'US', '英国': 'GB', '中国': 'CN', '日本': 'JP',
      '法国': 'FR', '德国': 'DE', '印度': 'IN', '新加坡': 'SG',
      '澳大利亚': 'AU', '加拿大': 'CA',
    };
    return map[country] || '';
  }

  countryFilters.addEventListener('click', function (e) {
    const btn = e.target.closest('.country-btn');
    if (!btn) return;
    currentCountry = btn.dataset.country;
    countryFilters.querySelectorAll('.country-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });

  let searchTimer;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      render();
    }, 200);
  });

  fetchMeta();
  fetchNews();
})();
