import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const baseUrl = process.env.SITE_URL || "https://legacy.mp.ls";

const pagesDir = path.join(root, "src", "pages");
const publicDir = path.join(root, "public");
const contentDirs = [
  { dir: path.join(root, "src", "content", "news"), routeBase: "/news/" },
  { dir: path.join(root, "src", "content", "politics"), routeBase: "/politics/" },
];

const disallowPrefixes = ["/admin/", "/api/"];
const disallowExact = ["/order/"];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRoute(filePath) {
  const rel = path.relative(pagesDir, filePath);
  const noExt = rel.replace(/\.astro$/, "");
  const parts = noExt.split(path.sep);
  const fileName = parts[parts.length - 1];
  if (fileName.startsWith("[")) return null;
  if (fileName === "index") {
    const dirParts = parts.slice(0, -1);
    return `/${dirParts.join("/")}/`.replace(/\/{2,}/g, "/");
  }
  return `/${parts.join("/")}/`.replace(/\/{2,}/g, "/");
}

function shouldExclude(route) {
  if (disallowExact.includes(route)) return true;
  return disallowPrefixes.some((prefix) => route.startsWith(prefix));
}

const routeMeta = new Map();

for (const filePath of walk(pagesDir)) {
  if (!filePath.endsWith(".astro")) continue;
  const route = toRoute(filePath);
  if (!route || shouldExclude(route)) continue;
  const stat = fs.statSync(filePath);
  routeMeta.set(route, stat.mtime.toISOString().slice(0, 10));
}

for (const { dir, routeBase } of contentDirs) {
  if (!fs.existsSync(dir)) continue;
  const entries = fs.readdirSync(dir).filter((name) => name.endsWith(".md"));
  for (const name of entries) {
    const slug = name.replace(/\.md$/, "");
    const route = `${routeBase}${slug}/`;
    if (shouldExclude(route)) continue;
    const stat = fs.statSync(path.join(dir, name));
    routeMeta.set(route, stat.mtime.toISOString().slice(0, 10));
  }
}

const routes = Array.from(routeMeta.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([route, lastmod]) => ({ route, lastmod }));

const xmlLines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(
    ({ route, lastmod }) =>
      `  <url><loc>${baseUrl}${route}</loc><lastmod>${lastmod}</lastmod></url>`
  ),
  "</urlset>",
];

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xmlLines.join("\n") + "\n");

const robotsLines = [
  "User-agent: *",
  "Disallow: /admin/",
  "Disallow: /api/",
  "Disallow: /order/",
  `Sitemap: ${baseUrl}/sitemap.xml`,
  "",
];

fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsLines.join("\n"));

console.log(`Wrote sitemap with ${routes.length} URLs.`);
