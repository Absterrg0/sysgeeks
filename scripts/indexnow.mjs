// Submit only URLs affected by a production deploy to IndexNow. The live sitemap is used as the
// source of truth so removed URLs are not submitted as if they were still available.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const site = process.env.SITE_URL?.replace(/\/$/, "");
if (!site) {
  console.error("Set SITE_URL to the production origin, e.g. SITE_URL=https://example.com pnpm indexnow");
  process.exit(1);
}

const deploySha = process.env.DEPLOY_SHA;
let changedFiles = [];
let submitAll = !deploySha;
if (deploySha) {
  try {
    changedFiles = execFileSync("git", ["diff", "--name-only", `${deploySha}^`, deploySha], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    console.error(`Could not read changed files for deployment ${deploySha}.`);
    process.exit(1);
  }
}

function routePattern(route, includeChildren = false) {
  const segments = route.split("/").filter(Boolean).filter((part) => !/^\(.+\)$/.test(part) && !part.startsWith("@"));
  const pattern = segments.map((segment) => {
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "(?:/[^/]+)*";
    if (/^\[\.\.\..+\]$/.test(segment)) return "/.+";
    if (/^\[.+\]$/.test(segment)) return "/[^/]+";
    return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
  }).join("");
  return new RegExp(`^${pattern || "/"}${includeChildren ? "(?:/.*)?" : ""}/?$`);
}

const exactRoutes = new Set();
const routePatterns = [];

for (const file of changedFiles) {
  if (file === "app/sitemap.ts" || file === "lib/site.ts" || file === "app/layout.tsx") {
    submitAll = true;
    break;
  }

  const pageMatch = file.match(/^app\/(.+)\/page\.(?:js|jsx|ts|tsx)$/);
  if (file === "app/page.tsx") {
    exactRoutes.add("/");
    continue;
  }
  if (pageMatch) {
    routePatterns.push(routePattern(`/${pageMatch[1]}`));
    continue;
  }
  if (/^app\/.+\/(?:layout|template)\.(?:js|jsx|ts|tsx)$/.test(file)) {
    const route = file.replace(/^app\//, "").replace(/\/(?:layout|template)\.(?:js|jsx|ts|tsx)$/, "");
    routePatterns.push(routePattern(`/${route}`, true));
    continue;
  }

  let match = file.match(/^lib\/content\/investigations\/([^/]+)\.(?:ts|tsx|js|json)$/);
  if (match && match[1] !== "index") {
    exactRoutes.add(`/investigations/${match[1]}`);
    routePatterns.push(routePattern(`/investigations/${match[1]}/[stageId]`));
    exactRoutes.add(`/investigations/${match[1]}/design`);
    exactRoutes.add(`/investigations/${match[1]}/review`);
    exactRoutes.add(`/investigations/${match[1]}/playground`);
    continue;
  }
  match = file.match(/^lib\/content\/concepts\/([^/]+)\.(?:ts|tsx|js|json)$/);
  if (match) {
    routePatterns.push(routePattern("/concepts/[conceptId]"));
    exactRoutes.add("/concepts");
    continue;
  }
  match = file.match(/^lib\/content\/example-projects\/([^/]+)\.(?:ts|tsx|js|json)$/);
  if (match) {
    if (match[1] === "index") routePatterns.push(routePattern("/projects/examples/[exampleId]"));
    else exactRoutes.add(`/projects/examples/${match[1]}`);
    exactRoutes.add("/projects/examples");
    continue;
  }
  if (file === "lib/content/sources.ts" || file === "lib/content/index.ts") {
    exactRoutes.add("/companies");
    routePatterns.push(routePattern("/companies/[companyId]"));
    exactRoutes.add("/investigations");
    routePatterns.push(routePattern("/investigations/[investigationId]"));
    routePatterns.push(routePattern("/investigations/[investigationId]/[stageId]"));
    routePatterns.push(routePattern("/concepts/[conceptId]"));
    continue;
  }
  if (file === "lib/content/system-design-answers.json") {
    exactRoutes.add("/investigations");
    continue;
  }
  if (file.startsWith("lib/content/")) {
    // New content modules may affect pages in ways this mapping does not yet know about.
    submitAll = true;
    break;
  }
  if (/^(components|lib\/metadata\.ts)\//.test(file) || file === "lib/metadata.ts") {
    // Shared rendered content or metadata can affect pages across the site.
    submitAll = true;
    break;
  }
}

const key = readFileSync(new URL("../lib/indexnow.ts", import.meta.url), "utf8").match(/INDEXNOW_KEY = "([a-f0-9]+)"/)?.[1];
const served = await fetch(`${site}/indexnow.txt`).then((r) => (r.ok ? r.text() : ""));
if (!key || served.trim() !== key) {
  console.error(`${site}/indexnow.txt does not serve the key in lib/indexnow.ts yet. Deploy first.`);
  process.exit(1);
}

const sitemap = await fetch(`${site}/sitemap.xml`).then((r) => r.text());
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urlList = submitAll
  ? sitemapUrls
  : sitemapUrls.filter((url) => {
      const pathname = new URL(url).pathname;
      return exactRoutes.has(pathname) || routePatterns.some((pattern) => pattern.test(pathname));
    });

if (!urlList.length) {
  console.log(`No sitemap URLs changed by ${deploySha}; skipped IndexNow submission.`);
  process.exit(0);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/indexnow.txt`, urlList }),
});
console.log(`Submitted ${urlList.length} changed URLs: ${response.status} ${response.statusText}`);
if (!response.ok) process.exit(1);
