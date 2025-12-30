import { assertSafeUrl, readResponseText } from "./urlSafety";

const cache = (globalThis as { __articleImageCache?: Map<string, string | null> })
  .__articleImageCache ??= new Map<string, string | null>();

const META_KEYS = ["og:image", "twitter:image", "twitter:image:src"];
const MAX_HTML_BYTES = 512 * 1024;

const getAttr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? match[1] : null;
};

const extractMetaImage = (html: string) => {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = (getAttr(tag, "property") || getAttr(tag, "name") || "").toLowerCase();
    if (!key || !META_KEYS.includes(key)) continue;
    const content = getAttr(tag, "content");
    if (content) return content;
  }
  return null;
};

const normalizeUrl = (value: string, baseUrl: string) => {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

export const fetchOgImage = async (url: string) => {
  if (cache.has(url)) return cache.get(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    await assertSafeUrl(url);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MPLS-Legacy/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    await assertSafeUrl(response.url);
    const html = await readResponseText(response, MAX_HTML_BYTES);
    const image = extractMetaImage(html);
    const normalized = image ? normalizeUrl(image, url) : null;
    cache.set(url, normalized);
    return normalized;
  } catch {
    cache.set(url, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const attachArticleImages = async <T extends { url: string; image?: string | null }>(items: T[]) =>
  Promise.all(
    items.map(async (item) => ({
      ...item,
      image: item.image || (await fetchOgImage(item.url)),
    }))
  );
