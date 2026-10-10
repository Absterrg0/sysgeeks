import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiFailure } from "@/lib/ai/errors";
import { fetchRepoSnapshot, parseRepoUrl } from "./github";

const env = vi.hoisted(() => ({ githubToken: undefined as string | undefined }));
vi.mock("@/lib/config", () => ({ env }));

const SHA = "f".repeat(40);
const API = "https://api.github.com/repos/acme/shop";
const RAW = `https://raw.githubusercontent.com/acme/shop/${SHA}`;
const TREE_URL = `${API}/git/trees/${SHA}?recursive=1`;
const REF = { owner: "acme", repo: "shop" };

const TREE_ENTRIES = [
  { path: "README.md", type: "blob", size: 120 },
  { path: "package.json", type: "blob", size: 80 },
  { path: "src", type: "tree" },
  { path: "src/app/api/checkout/route.ts", type: "blob", size: 200 },
  { path: "node_modules/left-pad/index.js", type: "blob", size: 40 },
  { path: ".env", type: "blob", size: 30 },
];

const FILES: Record<string, string> = {
  "README.md": "# Shop",
  "package.json": '{"name":"shop"}',
  "src/app/api/checkout/route.ts": 'const key = "AKIAABCDEFGHIJKLMNOP";\nexport async function POST() {}',
};

function defaultRoute(url: string): Response {
  if (url === API) return Response.json({ default_branch: "main", private: false });
  if (url === `${API}/commits/main`) return Response.json({ sha: SHA });
  if (url === TREE_URL) return Response.json({ sha: SHA, truncated: false, tree: TREE_ENTRIES });
  const file = url.startsWith(`${RAW}/`) ? FILES[url.slice(RAW.length + 1)] : undefined;
  return file === undefined ? new Response("Not Found", { status: 404 }) : new Response(file);
}

function stubGithub(route: (url: string) => Promise<Response | undefined> | Response | undefined = () => undefined) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    return (await route(url)) ?? defaultRoute(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return requests;
}

const options = () => ({ signal: new AbortController().signal });

beforeEach(() => {
  env.githubToken = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseRepoUrl", () => {
  it.each([
    ["https://github.com/acme/shop", { owner: "acme", repo: "shop" }],
    ["https://github.com/acme/shop/", { owner: "acme", repo: "shop" }],
    ["https://www.github.com/acme/shop.git", { owner: "acme", repo: "shop" }],
    ["github.com/acme/shop", { owner: "acme", repo: "shop" }],
    ["acme/shop", { owner: "acme", repo: "shop" }],
    [" https://github.com/acme/shop/tree/main ", { owner: "acme", repo: "shop", ref: "main" }],
    ["https://github.com/acme/shop/tree/feature/cart", { owner: "acme", repo: "shop", ref: "feature/cart" }],
  ])("accepts %s", (input, expected) => {
    expect(parseRepoUrl(input)).toEqual(expected);
  });

  it.each([
    "https://gitlab.com/acme/shop",
    "https://github.com.evil.com/acme/shop",
    "https://evil.com/github.com/acme/shop",
    "ftp://github.com/acme/shop",
    "https://github.com/acme",
    "https://github.com/acme/shop/blob/main/README.md",
    "https://github.com/acme/shop/tree/",
    "https://github.com/acme/shop/tree/a..b",
    "acme/sh$op",
    "../shop",
    "acme/..",
    `${"a".repeat(101)}/shop`,
    "",
  ])("rejects %s", (input) => {
    expect(parseRepoUrl(input)).toBeNull();
  });
});

describe("fetchRepoSnapshot", () => {
  it("builds a snapshot from the default branch with secrets redacted", async () => {
    const requests = stubGithub();

    const snapshot = await fetchRepoSnapshot(REF, options());

    expect(snapshot).toEqual({
      url: "https://github.com/acme/shop",
      owner: "acme",
      repo: "shop",
      commit: SHA,
      files: [
        { path: "README.md", text: "# Shop" },
        { path: "package.json", text: '{"name":"shop"}' },
        { path: "src/app/api/checkout/route.ts", text: 'const key = "[REDACTED]";\nexport async function POST() {}' },
      ],
      listing: ["README.md", "package.json", "src", "src/app/api/checkout/route.ts"],
      redactions: 1,
    });
    expect(requests.map((request) => request.url)).toEqual([
      API,
      `${API}/commits/main`,
      TREE_URL,
      `${RAW}/README.md`,
      `${RAW}/package.json`,
      `${RAW}/src/app/api/checkout/route.ts`,
    ]);
  });

  it("sends GitHub headers and the token when configured", async () => {
    env.githubToken = "ghp_test_token";
    const requests = stubGithub();

    await fetchRepoSnapshot(REF, options());

    const headers = new Headers(requests[0]?.init?.headers);
    expect(headers.get("accept")).toBe("application/vnd.github+json");
    expect(headers.get("user-agent")).toBe("sysgeeks");
    expect(headers.get("authorization")).toBe("Bearer ghp_test_token");
  });

  it("resolves a requested ref to a commit", async () => {
    const requests = stubGithub((url) => (url === `${API}/commits/feature%2Fcart` ? Response.json({ sha: SHA }) : undefined));

    await fetchRepoSnapshot({ ...REF, ref: "feature/cart" }, options());

    expect(requests[1]?.url).toBe(`${API}/commits/feature%2Fcart`);
  });

  it("throws repo_not_found on 404", async () => {
    stubGithub((url) => (url === API ? new Response("Not Found", { status: 404 }) : undefined));

    const error = await fetchRepoSnapshot(REF, options()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiFailure);
    expect(error).toMatchObject({ code: "repo_not_found" });
  });

  it("throws repo_private when the repo is private", async () => {
    stubGithub((url) => (url === API ? Response.json({ default_branch: "main", private: true }) : undefined));

    await expect(fetchRepoSnapshot(REF, options())).rejects.toMatchObject({ code: "repo_private" });
  });

  it("throws github_unavailable when rate limited", async () => {
    stubGithub((url) =>
      url === API
        ? new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } })
        : undefined,
    );

    await expect(fetchRepoSnapshot(REF, options())).rejects.toMatchObject({ code: "github_unavailable" });
  });

  it("throws repo_empty when the tree has no entries", async () => {
    stubGithub((url) => (url === TREE_URL ? Response.json({ sha: SHA, truncated: false, tree: [] }) : undefined));

    await expect(fetchRepoSnapshot(REF, options())).rejects.toMatchObject({ code: "repo_empty" });
  });

  it("throws repo_empty when the default branch has no commits", async () => {
    stubGithub((url) => (url === `${API}/commits/main` ? new Response("Conflict", { status: 409 }) : undefined));

    await expect(fetchRepoSnapshot(REF, options())).rejects.toMatchObject({ code: "repo_empty" });
  });

  it("proceeds with a truncated tree", async () => {
    stubGithub((url) => (url === TREE_URL ? Response.json({ sha: SHA, truncated: true, tree: TREE_ENTRIES }) : undefined));

    const snapshot = await fetchRepoSnapshot(REF, options());

    expect(snapshot.files.map((file) => file.path)).toEqual(["README.md", "package.json", "src/app/api/checkout/route.ts"]);
  });

  it("skips files that fail to download", async () => {
    stubGithub((url) => (url === `${RAW}/package.json` ? new Response("boom", { status: 500 }) : undefined));

    const snapshot = await fetchRepoSnapshot(REF, options());

    expect(snapshot.files.map((file) => file.path)).toEqual(["README.md", "src/app/api/checkout/route.ts"]);
  });

  it("truncates long files", async () => {
    stubGithub((url) => (url === `${RAW}/README.md` ? new Response("x".repeat(20_000)) : undefined));

    const snapshot = await fetchRepoSnapshot(REF, options());

    expect(snapshot.files[0]?.text).toBe(`${"x".repeat(15_000)}\n…[truncated]`);
  });

  it("fetches files six at a time", async () => {
    let inFlight = 0;
    let peak = 0;
    const paths = Array.from({ length: 10 }, (_, index) => ({ path: `src/app/api/r${index}/route.ts`, type: "blob", size: 100 }));
    stubGithub(async (url) => {
      if (url === TREE_URL) return Response.json({ sha: SHA, truncated: false, tree: paths });
      if (!url.startsWith(`${RAW}/`)) return undefined;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return new Response("export {};");
    });

    const snapshot = await fetchRepoSnapshot(REF, options());

    expect(snapshot.files).toHaveLength(10);
    expect(peak).toBe(6);
  });
});
