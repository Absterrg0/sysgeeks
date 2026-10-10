export type TreeEntry = { path: string; type: "blob" | "tree"; size?: number };
export type Budget = { maxFiles: number; maxTotalChars: number; maxFileChars: number; maxListing: number };
export const DEFAULT_BUDGET: Budget = { maxFiles: 60, maxTotalChars: 180_000, maxFileChars: 15_000, maxListing: 400 };

const MAX_BLOB_BYTES = 200_000;
const LISTING_MIN_SCORE = 40;
const MIGRATIONS_KEPT = 5;
const REDACTED = "[REDACTED]";

const words = (list: string) => new Set(list.split(" "));
const EXCLUDED_SEGMENTS = words("node_modules vendor dist build .next out target coverage .git __pycache__ .venv venv Pods third_party");
const LOCKFILES = words("package-lock.json npm-shrinkwrap.json yarn.lock pnpm-lock.yaml bun.lock bun.lockb cargo.lock poetry.lock pipfile.lock composer.lock gemfile.lock go.sum mix.lock uv.lock podfile.lock packages.lock.json gradle.lockfile");
const BINARY_EXTENSIONS = words("png jpg jpeg gif webp ico bmp tif tiff avif svg pdf zip gz tgz tar bz2 xz 7z rar jar war class exe dll so dylib o a bin wasm pyc woff woff2 ttf otf eot mp3 mp4 mov avi webm wav ogg flac sqlite sqlite3 db");
const SOURCE_EXTENSIONS = words("ts tsx js jsx mjs cjs py go rb java kt rs cs php ex scala");
const MANIFEST_NAMES = words("pyproject.toml go.mod cargo.toml pom.xml gemfile composer.json mix.exs");
const INFRA_NAMES = words("serverless.yml serverless.yaml vercel.json fly.toml render.yaml netlify.toml wrangler.toml procfile app.yaml");
const INFRA_DIRS = words("k8s helm charts deploy");
const DATA_NAMES = words("schema.prisma models.py");
const ROUTE_DIRS = words("routes api controllers handlers");
const ASYNC_PATTERN = /(worker|job|queue|consumer|producer|cron|schedul|webhook|subscriber|listener)/i;
const TEST_PATTERN = /__tests__|\.test\.|\.spec\.|\/tests?\//;

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /AKIA[0-9A-Z]{16}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9_]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /xox[bp]-[A-Za-z0-9-]+/g,
];
const SECRET_ASSIGNMENT = /((?:api[_-]?key|secret|token|password)\s*[:=]\s*)(?!\[REDACTED\])\S{8,}/gi;

type ParsedPath = { path: string; segments: string[]; dirs: string[]; name: string; ext: string };

function parsePath(path: string): ParsedPath {
  const segments = path.split("/").filter(Boolean);
  const name = (segments[segments.length - 1] ?? "").toLowerCase();
  const dot = name.lastIndexOf(".");
  return { path, segments, dirs: segments.slice(0, -1), name, ext: dot > 0 ? name.slice(dot + 1) : "" };
}

function isExcludedPath(path: string): boolean {
  return parsePath(path).segments.some((segment) => EXCLUDED_SEGMENTS.has(segment));
}

function isManifest({ name, dirs }: ParsedPath): boolean {
  if (name === "package.json") return dirs.length <= 3;
  return MANIFEST_NAMES.has(name) || /^requirements.*\.txt$/.test(name) || name.startsWith("build.gradle") || name.endsWith(".csproj");
}

function isInfra({ name, ext, dirs }: ParsedPath): boolean {
  if (name.startsWith("docker-compose") || name.startsWith("dockerfile") || ext === "tf" || INFRA_NAMES.has(name)) return true;
  return (ext === "yaml" || ext === "yml") && dirs.some((dir) => INFRA_DIRS.has(dir));
}

function isData({ name, ext, dirs }: ParsedPath): boolean {
  if (DATA_NAMES.has(name) || ext === "proto" || ext === "graphql" || /^openapi.*\.(ya?ml|json)$/.test(name)) return true;
  if (ext === "sql") return dirs.some((dir) => dir === "migrations" || dir === "db");
  return name === "schema.ts" && dirs.some((dir) => dir === "drizzle" || dir === "db");
}

function isEntry({ name, dirs, segments }: ParsedPath): boolean {
  if (/^(main|server|app|index)\./.test(name) && underSourceRoot(segments)) return true;
  if (dirs.some((dir) => ROUTE_DIRS.has(dir))) return true;
  return /^route\.[cm]?[jt]sx?$/.test(name) && dirs.includes("app");
}

function underSourceRoot(segments: string[]): boolean {
  return segments.some((segment, index) => ["src", "app", "lib"].includes(segment) && segments.length - index - 2 <= 2);
}

function isConfig({ name, dirs }: ParsedPath): boolean {
  return dirs.includes("config") || ["settings.py", ".env.example", ".env.sample"].includes(name);
}

function isMigration(path: string): boolean {
  const { ext, dirs } = parsePath(path);
  return ext === "sql" && dirs.includes("migrations");
}

export function isNeverFetch(path: string): boolean {
  const { name } = parsePath(path);
  if (name === ".env.example" || name === ".env.sample") return false;
  return name.startsWith(".env") || name.endsWith(".pem") || name.endsWith(".key") || name.startsWith("id_rsa") || name.endsWith(".p12");
}

export function scorePath(path: string): number {
  const parsed = parsePath(path);
  const { name, ext, dirs } = parsed;
  if (isExcludedPath(path) || LOCKFILES.has(name) || name.includes(".min.") || BINARY_EXTENSIONS.has(ext) || isNeverFetch(path)) return 0;
  if (TEST_PATTERN.test(`/${path}`)) return 10;

  const lowerPath = path.toLowerCase();
  const topDoc = dirs.length === 0 && /^(readme|architecture)/.test(name);
  if (topDoc || lowerPath.startsWith("docs/architecture") || lowerPath.startsWith("docs/adr/")) return 100;
  if (isManifest(parsed)) return 90;
  if (isInfra(parsed)) return 85;
  if (isData(parsed)) return 80;
  if (isEntry(parsed)) return 70;
  if (ASYNC_PATTERN.test(path)) return 65;
  if (isConfig(parsed)) return 60;
  if (path.startsWith(".github/workflows/")) return 50;
  return SOURCE_EXTENSIONS.has(ext) ? 40 : 0;
}

function scoreEntry(entry: TreeEntry): number {
  if (entry.size !== undefined && entry.size > MAX_BLOB_BYTES) return 0;
  return scorePath(entry.path);
}

function latestMigrations(entries: TreeEntry[]): Set<string> {
  const byDir = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.type !== "blob" || !isMigration(entry.path)) continue;
    const dir = parsePath(entry.path).dirs.join("/");
    byDir.set(dir, [...(byDir.get(dir) ?? []), entry.path]);
  }
  const latest = new Set<string>();
  for (const paths of byDir.values()) {
    const newest = paths.sort((a, b) => parsePath(b).name.localeCompare(parsePath(a).name)).slice(0, MIGRATIONS_KEPT);
    for (const path of newest) latest.add(path);
  }
  return latest;
}

export function selectRepoFiles(entries: TreeEntry[], budget: Budget = DEFAULT_BUDGET): { files: { path: string; score: number }[]; listing: string[]; considered: number } {
  const latest = latestMigrations(entries);
  const candidates = entries.flatMap((entry) => {
    if (entry.type !== "blob" || (isMigration(entry.path) && !latest.has(entry.path))) return [];
    const score = scoreEntry(entry);
    if (score === 0) return [];
    return [{ path: entry.path, score, depth: parsePath(entry.path).dirs.length, chars: entry.size ?? budget.maxFileChars }];
  });
  candidates.sort((a, b) => b.score - a.score || a.depth - b.depth || a.chars - b.chars);

  const files: { path: string; score: number }[] = [];
  let totalChars = 0;
  for (const candidate of candidates) {
    if (files.length >= budget.maxFiles) break;
    if (totalChars + candidate.chars > budget.maxTotalChars) continue;
    files.push({ path: candidate.path, score: candidate.score });
    totalChars += candidate.chars;
  }

  const listing = entries
    .filter((entry) => (entry.type === "tree" ? !isExcludedPath(entry.path) : scoreEntry(entry) >= LISTING_MIN_SCORE))
    .map((entry) => entry.path)
    .slice(0, budget.maxListing);

  return { files, listing, considered: candidates.length };
}

export function redactSecrets(text: string): { text: string; redactions: number } {
  let redactions = 0;
  const redact = () => {
    redactions += 1;
    return REDACTED;
  };
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, redact);
  out = out.replace(SECRET_ASSIGNMENT, (_match, label: string) => {
    redactions += 1;
    return `${label}${REDACTED}`;
  });
  return { text: out, redactions };
}

export function truncateFile(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…[truncated]` : text;
}
