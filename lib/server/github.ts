import "server-only";
import { z } from "zod";
import { AiFailure } from "@/lib/ai/errors";
import { env } from "@/lib/config";
import { DEFAULT_BUDGET, redactSecrets, selectRepoFiles, truncateFile, type TreeEntry } from "@/lib/domain/repo-files";

export type RepoRef = { owner: string; repo: string; ref?: string };

export type RepoSnapshot = {
  url: string;
  owner: string;
  repo: string;
  commit: string;
  files: { path: string; text: string }[];
  listing: string[];
  redactions: number;
};

export type FetchOptions = {
  signal: AbortSignal;
  onProgress?: (step: string, detail?: string, files?: string[]) => void;
};

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const ACCEPT_JSON = "application/vnd.github+json";
const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;
const NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const REQUEST_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 30_000;
const FILE_CONCURRENCY = 6;

const RepoInfo = z.object({ default_branch: z.string(), private: z.boolean() });
const CommitInfo = z.object({ sha: z.string().regex(/^[0-9a-f]{40,64}$/) });
const TreeInfo = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string(), size: z.number().optional() })),
});

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && name !== "." && name !== "..";
}

function isValidRef(ref: string): boolean {
  return REF_PATTERN.test(ref) && !ref.includes("..") && ref !== ".";
}

function toRepoRef(owner = "", repo = ""): RepoRef | null {
  return isValidName(owner) && isValidName(repo) ? { owner, repo } : null;
}

export function parseRepoUrl(input: string): RepoRef | null {
  const trimmed = input.trim();
  if (!GITHUB_URL.test(trimmed)) {
    const [owner, repo, ...rest] = trimmed.split("/");
    return rest.length === 0 ? toRepoRef(owner, repo) : null;
  }

  const path = trimmed.replace(GITHUB_URL, "").replace(/[?#].*$/, "");
  let parts: string[];
  try {
    parts = path
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }

  const [owner, name, marker, ...refParts] = parts;
  const base = toRepoRef(owner, name?.replace(/\.git$/, ""));
  if (base === null) return null;
  if (parts.length === 2) return base;
  if (marker !== "tree" || refParts.length === 0) return null;

  const ref = refParts.join("/");
  return isValidRef(ref) ? { ...base, ref } : null;
}

function githubHeaders(accept?: string): Record<string, string> {
  return {
    "User-Agent": "sysgeeks",
    ...(accept ? { Accept: accept } : {}),
    ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {}),
  };
}

async function readJson<S extends z.ZodType>(response: Response, schema: S): Promise<z.output<S>> {
  if (!response.ok) throw new AiFailure("github_unavailable");
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new AiFailure("github_unavailable");
  return parsed.data;
}

async function pool<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = items.entries();
  const worker = async () => {
    for (const [index, item] of queue) results[index] = await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function fetchRepoSnapshot(ref: RepoRef, opts: FetchOptions): Promise<RepoSnapshot> {
  const { owner, repo } = ref;
  if (!isValidName(owner) || !isValidName(repo) || (ref.ref !== undefined && !isValidRef(ref.ref))) {
    throw new AiFailure("repo_not_found");
  }

  const overall = AbortSignal.any([opts.signal, AbortSignal.timeout(TOTAL_TIMEOUT_MS)]);
  const send = (url: string, accept?: string) =>
    fetch(url, {
      headers: githubHeaders(accept),
      signal: AbortSignal.any([overall, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
  const api = async (path: string) => {
    try {
      return await send(`${API}${path}`, ACCEPT_JSON);
    } catch {
      throw new AiFailure("github_unavailable");
    }
  };
  const base = `/repos/${owner}/${repo}`;

  opts.onProgress?.("repo", `${owner}/${repo}`);
  const repoResponse = await api(base);
  if (repoResponse.status === 404) throw new AiFailure("repo_not_found");
  const info = await readJson(repoResponse, RepoInfo);
  if (info.private) throw new AiFailure("repo_private");

  const commitResponse = await api(`${base}/commits/${encodeURIComponent(ref.ref ?? info.default_branch)}`);
  if (commitResponse.status === 409) throw new AiFailure("repo_empty");
  if (commitResponse.status === 404) throw new AiFailure(ref.ref === undefined ? "repo_empty" : "repo_not_found");
  const { sha } = await readJson(commitResponse, CommitInfo);
  opts.onProgress?.("commit", sha.slice(0, 7));

  const treeResponse = await api(`${base}/git/trees/${sha}?recursive=1`);
  const { tree } = await readJson(treeResponse, TreeInfo);
  const entries: TreeEntry[] = tree.flatMap((entry) =>
    entry.type === "blob" || entry.type === "tree" ? [{ path: entry.path, type: entry.type, size: entry.size }] : [],
  );
  if (entries.length === 0) throw new AiFailure("repo_empty");
  const { files: selected, listing } = selectRepoFiles(entries);
  opts.onProgress?.("tree", `${listing.length} paths`);

  const readFile = async (path: string): Promise<string | null> => {
    const encoded = path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    try {
      const response = await send(`${RAW}/${owner}/${repo}/${sha}/${encoded}`);
      return response.ok ? await response.text() : null;
    } catch {
      return null;
    }
  };
  opts.onProgress?.("read", `${selected.length} files`, selected.map((file) => file.path));
  const texts = await pool(selected, FILE_CONCURRENCY, (file) => readFile(file.path));
  if (opts.signal.aborted) throw new AiFailure("github_unavailable");

  let redactions = 0;
  const files = selected.flatMap((file, index) => {
    const text = texts[index] ?? null;
    if (text === null) return [];
    const redacted = redactSecrets(text);
    redactions += redacted.redactions;
    return [{ path: file.path, text: truncateFile(redacted.text, DEFAULT_BUDGET.maxFileChars) }];
  });

  return { url: `https://github.com/${owner}/${repo}`, owner, repo, commit: sha, files, listing, redactions };
}
