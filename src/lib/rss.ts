import { assertSafeUrl, isHttpUrl, readResponseText } from "./urlSafety";

type RssItem = {
  title: string;
  url: string;
  dateText: string;
  source?: string;
  image?: string | null;
};

const cache = (globalThis as { __rssCache?: Map<string, { ts: number; items: RssItem[] }> })
  .__rssCache ??= new Map<string, { ts: number; items: RssItem[] }>();

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_FEED_BYTES = 1024 * 1024;

const stripCdata = (value: string) =>
  value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();

const getTag = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripCdata(match[1]) : null;
};

const getAttr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? match[1] : null;
};

const formatDate = (value?: string) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const parseItems = (xml: string, fallbackSource?: string) => {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi);
  const entries = blocks ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

  return entries
    .map((block) => {
      const title = getTag(block, "title");
      if (!title) return null;

      const linkTag = block.match(/<link[\s\S]*?>/i)?.[0] || "";
      const link =
        getTag(block, "link") ||
        getAttr(linkTag, "href") ||
        getTag(block, "guid");

      if (!link || !isHttpUrl(link)) return null;

      const pubDate = getTag(block, "pubDate") || getTag(block, "updated") || getTag(block, "published");
      const source = getTag(block, "source") || getTag(block, "author") || fallbackSource;

      const mediaTag = block.match(/<media:content[\s\S]*?>/i)?.[0];
      const thumbTag = block.match(/<media:thumbnail[\s\S]*?>/i)?.[0];
      const enclosureTag = block.match(/<enclosure[\s\S]*?>/i)?.[0];

      const image =
        (mediaTag && getAttr(mediaTag, "url")) ||
        (thumbTag && getAttr(thumbTag, "url")) ||
        (enclosureTag && getAttr(enclosureTag, "url")) ||
        null;

      return {
        title,
        url: link.trim(),
        dateText: formatDate(pubDate || undefined),
        source,
        image,
      };
    })
    .filter(Boolean) as RssItem[];
};

type FetchOptions = {
  maxItems?: number;
  startDate?: string;
  endDate?: string;
  sourceLabel?: string;
};

const filterByDate = (items: RssItem[], startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return items;
  const start = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY;
  const end = endDate ? new Date(endDate).getTime() : Number.POSITIVE_INFINITY;

  return items.filter((item) => {
    const date = new Date(item.dateText).getTime();
    if (Number.isNaN(date)) return false;
    return date >= start && date <= end;
  });
};

export const fetchRssItems = async (urls: string[], options: FetchOptions = {}) => {
  const now = Date.now();
  const results: RssItem[] = [];

  for (const url of urls) {
    try {
      await assertSafeUrl(url);
    } catch {
      cache.set(url, { ts: now, items: [] });
      continue;
    }
    const cached = cache.get(url);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      results.push(...cached.items);
      continue;
    }

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MPLS-Legacy/1.0)" },
      });
      await assertSafeUrl(response.url);
      const xml = await readResponseText(response, MAX_FEED_BYTES);
      const items = parseItems(xml, options.sourceLabel);
      cache.set(url, { ts: now, items });
      results.push(...items);
    } catch {
      cache.set(url, { ts: now, items: [] });
    }
  }

  const filtered = filterByDate(results, options.startDate, options.endDate);
  return filtered.slice(0, options.maxItems ?? filtered.length);
};
