export interface ExternalNewsSource {
  key: string;
  name: string;
  category: string;
  feedUrl: string;
  type: 'lasu' | 'rss';
}

export interface ExternalHeadlineItem {
  id: string;
  source_key: string;
  source_name: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  image_url: string;
  published_at: string;
  suggested_category_slug: string;
}

export interface SourceStatusInfo {
  key: string;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
}

export const NEWS_SOURCES: ExternalNewsSource[] = [
  {
    key: 'lasu',
    name: 'LASU Official Newsroom',
    category: 'University',
    feedUrl: 'https://lasu.edu.ng/home/news/',
    type: 'lasu',
  },
  {
    key: 'punch',
    name: 'Punch Nigeria',
    category: 'National & Education',
    feedUrl: 'https://punchng.com/feed/',
    type: 'rss',
  },
  {
    key: 'vanguard',
    name: 'Vanguard Nigeria',
    category: 'National & Campus',
    feedUrl: 'https://www.vanguardngr.com/feed/',
    type: 'rss',
  },
  {
    key: 'channels',
    name: 'Channels TV',
    category: 'Broadcast News',
    feedUrl: 'https://www.channelstv.com/feed/',
    type: 'rss',
  },
  {
    key: 'premiumtimes',
    name: 'Premium Times',
    category: 'National & Policy',
    feedUrl: 'https://www.premiumtimesng.com/feed',
    type: 'rss',
  },
  {
    key: 'dailypost',
    name: 'Daily Post Nigeria',
    category: 'Breaking & Metro',
    feedUrl: 'https://dailypost.ng/feed/',
    type: 'rss',
  },
  {
    key: 'bbcafrica',
    name: 'BBC Africa',
    category: 'Global & Africa',
    feedUrl: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
    type: 'rss',
  },
];

function decodeEntities(str: string): string {
  const named: Record<string, string> = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    rsquo: '\u2019',
    lsquo: '\u2018',
    rdquo: '\u201D',
    ldquo: '\u201C',
    ndash: '\u2013',
    mdash: '\u2014',
    hellip: '\u2026',
    bull: '\u2022',
  };
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_m, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return '';
      }
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => named[name] ?? m);
}

function htmlToCleanText(html: string): string {
  const clean = html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(clean)
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t\r\n]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function makeSummary(text: string): string {
  const singleLine = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 220) return singleLine;
  return singleLine.slice(0, 217).replace(/\s+\S*$/, '') + '...';
}

function suggestCategorySlug(title: string, body: string): string {
  const hay = `${title} ${body.slice(0, 400)}`.toLowerCase();
  if (/\b(nuga|football|sport|athlet|medal|championship|fifa|super eagles|caf|match|league|cup)\b/.test(hay)) {
    return 'sports';
  }
  if (/\b(admission|jamb|nuc|tetfund|exam|matriculation|convocation|calendar|semester|postgraduate|faculty|university|lasu|campus|academic)\b/.test(hay)) {
    return 'academic-updates';
  }
  if (/\b(notice|urgent|warning|disclaimer|deadline|announcement|circular|directive|extends)\b/.test(hay)) {
    return 'announcements';
  }
  if (/\b(conference|summit|lecture|ceremony|festival|award|symposium|inaugurat|workshop)\b/.test(hay)) {
    return 'events';
  }
  if (/\b(student|nelfund|loan|scholarship|youth|graduates|alumni)\b/.test(hay)) {
    return 'student-news';
  }
  return 'university-news';
}

function isSafeExternalUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5500): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LASUBroadcast/1.0)',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseRssItems(xml: string, sourceKey: string, sourceName: string): ExternalHeadlineItem[] {
  const items: ExternalHeadlineItem[] = [];
  const itemMatches = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];

  for (let i = 0; i < Math.min(itemMatches.length, 15); i++) {
    const block = itemMatches[i];
    const titleRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const linkRaw =
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
      '';
    const descRaw =
      block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
      block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
      '';
    const dateRaw =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ||
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1] ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ||
      '';

    const mediaImg =
      block.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i)?.[1] ||
      block.match(/<enclosure[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i)?.[1] ||
      descRaw.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
      '';

    const title = htmlToCleanText(titleRaw).replace(/\n+/g, ' ').trim();
    const content = htmlToCleanText(descRaw);
    const link = decodeEntities(linkRaw).trim();
    if (!title || !link) continue;

    const parsedDate = dateRaw ? new Date(decodeEntities(dateRaw).trim()) : new Date();
    const publishedAt = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    const bodyText = content.length >= 25 ? content : `${title}. Full report available via ${sourceName}: ${link}`;
    items.push({
      id: `${sourceKey}-${i}-${Buffer.from(link).toString('base64').slice(0, 12)}`,
      source_key: sourceKey,
      source_name: sourceName,
      title: title.slice(0, 215),
      summary: makeSummary(bodyText),
      content: `${bodyText}\n\nSource Dispatch: ${sourceName} (${link})`,
      url: link,
      image_url: mediaImg.startsWith('http') ? decodeEntities(mediaImg) : '',
      published_at: publishedAt,
      suggested_category_slug: suggestCategorySlug(title, bodyText),
    });
  }

  return items;
}

async function fetchLasuRecentHeadlines(): Promise<ExternalHeadlineItem[]> {
  const probeIds = [622, 621, 620, 619, 618, 617, 616, 615, 613, 612, 611, 607, 569];
  const tasks = probeIds.map(async (id): Promise<ExternalHeadlineItem | null> => {
    const pageUrl = `https://lasu.edu.ng/home/news/read.php?id=${id}`;
    const r1 = await fetchWithTimeout(pageUrl, {}, 4500);
    if (!r1.ok) return null;
    const rawCookie = r1.headers.get('set-cookie');
    if (!rawCookie) return null;
    const cookie = rawCookie.split(';')[0];

    const r2 = await fetchWithTimeout(
      'https://lasu.edu.ng/home/news/ajax/read.php',
      {
        headers: {
          Cookie: cookie,
          Referer: pageUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
      4500
    );
    if (!r2.ok) return null;
    const html = await r2.text();

    const imgMatch = html.match(/<div class="single-latest-item">[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const titleMatch = html.match(/<div class="single-latest-text"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const dateMatch = html.match(/zmdi-calendar-check"><\/i>\s*([^<]+)/i);
    const bodyMatch = html.match(
      /class="single-item-comment-view">[\s\S]*?<\/div>\s*([\s\S]*?)\s*<div class="tags-and-links">/i
    );
    if (!titleMatch || !bodyMatch) return null;

    const title = htmlToCleanText(titleMatch[1]).replace(/\n+/g, ' ').trim();
    const content = htmlToCleanText(bodyMatch[1]);
    if (!title || content.length < 40) return null;

    let rawImg = imgMatch ? imgMatch[1].trim() : '';
    if (rawImg.startsWith('../')) rawImg = 'https://lasu.edu.ng/home/' + rawImg.slice(3);
    else if (rawImg && !rawImg.startsWith('http')) rawImg = 'https://lasu.edu.ng/home/news/' + rawImg;

    const parsedDate = dateMatch ? new Date(dateMatch[1].trim()) : new Date();
    const publishedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    return {
      id: `lasu-${id}`,
      source_key: 'lasu',
      source_name: 'LASU Official Newsroom',
      title: title.slice(0, 215),
      summary: makeSummary(content),
      content,
      url: pageUrl,
      image_url: rawImg ? encodeURI(decodeURI(rawImg)) : '',
      published_at: publishedAt,
      suggested_category_slug: suggestCategorySlug(title, content),
    };
  });

  const settled = await Promise.allSettled(tasks);
  return settled
    .filter((r): r is PromiseFulfilledResult<ExternalHeadlineItem | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((item): item is ExternalHeadlineItem => item !== null);
}

export async function fetchMultiSourceHeadlines(options: {
  sourceKey?: string;
  query?: string;
  customFeedUrl?: string;
}): Promise<{
  items: ExternalHeadlineItem[];
  sourceStatuses: SourceStatusInfo[];
  availableSources: Array<{ key: string; name: string; category: string }>;
}> {
  const sourceKey = (options.sourceKey || 'all').trim().toLowerCase();
  const query = (options.query || '').trim().toLowerCase();
  const customUrl = (options.customFeedUrl || '').trim();

  const sourceStatuses: SourceStatusInfo[] = [];
  const allItems: ExternalHeadlineItem[] = [];

  if (customUrl) {
    if (!isSafeExternalUrl(customUrl)) {
      sourceStatuses.push({
        key: 'custom',
        name: 'Custom Feed URL',
        ok: false,
        count: 0,
        error: 'URL must be a public http:// or https:// RSS/Atom feed.',
      });
    } else {
      try {
        const res = await fetchWithTimeout(customUrl, {}, 6000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        const hostname = new URL(customUrl).hostname.replace(/^www\./, '');
        const parsed = parseRssItems(xml, 'custom', hostname);
        allItems.push(...parsed);
        sourceStatuses.push({ key: 'custom', name: hostname, ok: true, count: parsed.length });
      } catch (err) {
        sourceStatuses.push({
          key: 'custom',
          name: 'Custom Feed',
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : 'Unable to fetch custom feed',
        });
      }
    }
  } else {
    const selectedSources =
      sourceKey === 'all' ? NEWS_SOURCES : NEWS_SOURCES.filter((s) => s.key === sourceKey);

    const settled = await Promise.allSettled(
      selectedSources.map(async (src) => {
        if (src.type === 'lasu') {
          const items = await fetchLasuRecentHeadlines();
          return { src, items };
        }
        const res = await fetchWithTimeout(src.feedUrl, {}, 5500);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        const items = parseRssItems(xml, src.key, src.name);
        return { src, items };
      })
    );

    settled.forEach((result, idx) => {
      const src = selectedSources[idx];
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.items);
        sourceStatuses.push({
          key: src.key,
          name: src.name,
          ok: true,
          count: result.value.items.length,
        });
      } else {
        sourceStatuses.push({
          key: src.key,
          name: src.name,
          ok: false,
          count: 0,
          error: result.reason instanceof Error ? result.reason.message : 'Feed unavailable',
        });
      }
    });
  }

  let filtered = allItems;
  if (query) {
    filtered = allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.source_name.toLowerCase().includes(query)
    );
  }

  filtered.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  return {
    items: filtered.slice(0, 80),
    sourceStatuses,
    availableSources: NEWS_SOURCES.map((s) => ({ key: s.key, name: s.name, category: s.category })),
  };
}
