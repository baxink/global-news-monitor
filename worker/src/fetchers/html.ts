import type { RawArticle } from '../normalize';

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(href: string, baseUrl: string): string {
  try {
    return new URL(decodeHtml(href), baseUrl).toString();
  } catch {
    return '';
  }
}

function isNatureArticle(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('nature.com') && /\/articles\//.test(parsed.pathname);
  } catch {
    return false;
  }
}

function inferTitle(anchorHtml: string): string {
  const title = stripHtml(anchorHtml);
  return title.replace(/^Nature\s+/, '').trim();
}

function inferPublishedAtFromId(url: string): string | undefined {
  const match = url.match(/-(20\d{2})-(\d{2})-(\d{5})-[a-z]$/i);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-01T00:00:00.000Z`;
}

export async function fetchHtml(url: string, timeoutMs: number = 10000): Promise<RawArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NatureDaily/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) return [];

    const text = await res.text();
    const items: RawArticle[] = [];
    const seen = new Set<string>();
    const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = anchorRegex.exec(text)) !== null) {
      const link = normalizeUrl(match[1], url);
      if (!link || seen.has(link) || !isNatureArticle(link)) continue;

      const title = inferTitle(match[2]);
      if (title.length < 12) continue;

      seen.add(link);
      items.push({
        title,
        link,
        pubDate: inferPublishedAtFromId(link),
      });
    }

    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
