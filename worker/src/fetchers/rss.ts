import type { RawArticle } from '../normalize';

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return (match[1] || match[2] || '').trim();
}

function extractMediaContent(xml: string): string {
  const match = xml.match(/<media:content[^>]*url="([^"]+)"/i);
  return match ? match[1] : '';
}

function extractEnclosure(xml: string): string {
  const match = xml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image\/[^"]*"/i);
  return match ? match[1] : '';
}

export async function fetchRss(url: string, timeoutMs: number = 10000): Promise<RawArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsMonitor/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!res.ok) return [];

    const text = await res.text();
    const items: RawArticle[] = [];

    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1];
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
      const description = extractTag(itemXml, 'description') || extractTag(itemXml, 'summary');
      const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date');

      if (title && link) {
        items.push({
          title,
          link,
          description,
          pubDate,
          imageUrl: extractMediaContent(itemXml) || extractEnclosure(itemXml),
        });
      }
    }

    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
