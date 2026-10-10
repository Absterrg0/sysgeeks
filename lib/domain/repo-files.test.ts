import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUDGET,
  isNeverFetch,
  redactSecrets,
  scorePath,
  selectRepoFiles,
  truncateFile,
  type TreeEntry,
} from "./repo-files";

const blob = (path: string, size = 1_000): TreeEntry => ({ path, type: "blob", size });
const tree = (path: string): TreeEntry => ({ path, type: "tree" });
const paths = (entries: { path: string }[]) => entries.map((entry) => entry.path);

const nextApp: TreeEntry[] = [
  tree("src"),
  tree("src/app"),
  tree("src/app/api"),
  tree("src/app/api/chat"),
  tree("node_modules"),
  tree("node_modules/react"),
  blob("README.md", 2_000),
  blob("package.json", 1_500),
  blob("package-lock.json", 180_000),
  blob("next.config.mjs", 300),
  blob("tsconfig.json", 400),
  blob(".env", 120),
  blob(".env.example", 120),
  blob("src/app/layout.tsx", 900),
  blob("src/app/page.tsx", 1_200),
  blob("src/app/page.test.tsx", 600),
  blob("src/app/api/chat/route.ts", 2_500),
  blob("src/lib/db.ts", 800),
  blob("node_modules/react/index.js", 50_000),
];

const pythonService: TreeEntry[] = [
  tree("app"),
  tree("migrations"),
  blob("README.md", 1_000),
  blob("pyproject.toml", 800),
  blob("requirements.txt", 300),
  blob("poetry.lock", 90_000),
  blob("app/main.py", 1_100),
  blob("app/routes/items.py", 2_000),
  blob("app/models.py", 1_500),
  blob("app/worker.py", 900),
  blob("app/settings.py", 400),
  blob("migrations/0001_init.sql", 700),
  blob("tests/test_items.py", 700),
  blob(".venv/lib/python3.12/site.py", 5_000),
];

const monorepo: TreeEntry[] = [
  blob("README.md", 3_000),
  blob("package.json", 900),
  blob("pnpm-lock.yaml", 150_000),
  blob("docker-compose.yml", 500),
  blob(".github/workflows/ci.yml", 800),
  blob("apps/web/package.json", 700),
  blob("apps/web/app/page.tsx", 1_000),
  blob("packages/ui/src/index.ts", 600),
  blob("packages/ui/dist/index.js", 40_000),
  blob("packages/a/b/c/d/package.json", 300),
];

describe("isNeverFetch", () => {
  it("blocks env files except the example and sample templates", () => {
    expect(isNeverFetch(".env")).toBe(true);
    expect(isNeverFetch("apps/web/.env.local")).toBe(true);
    expect(isNeverFetch(".env.production")).toBe(true);
    expect(isNeverFetch(".env.example")).toBe(false);
    expect(isNeverFetch(".env.sample")).toBe(false);
  });

  it("blocks keys, certificates and keystores", () => {
    expect(isNeverFetch("certs/server.pem")).toBe(true);
    expect(isNeverFetch("tls/private.key")).toBe(true);
    expect(isNeverFetch("ssh/id_rsa")).toBe(true);
    expect(isNeverFetch("secrets/store.p12")).toBe(true);
    expect(isNeverFetch("src/env.ts")).toBe(false);
  });
});

describe("scorePath", () => {
  it("ranks docs, manifests and infra highest", () => {
    expect(scorePath("README.md")).toBe(100);
    expect(scorePath("docs/adr/0001-storage.md")).toBe(100);
    expect(scorePath("apps/web/package.json")).toBe(90);
    expect(scorePath("services/api/requirements-dev.txt")).toBe(90);
    expect(scorePath("Dockerfile")).toBe(85);
    expect(scorePath("infra/k8s/web.yaml")).toBe(85);
  });

  it("ranks data, routing, async and config below that", () => {
    expect(scorePath("prisma/schema.prisma")).toBe(80);
    expect(scorePath("db/queries.sql")).toBe(80);
    expect(scorePath("src/main.ts")).toBe(70);
    expect(scorePath("app/routes/items.py")).toBe(70);
    expect(scorePath("src/workers/email.ts")).toBe(65);
    expect(scorePath("config/database.ts")).toBe(60);
    expect(scorePath(".github/workflows/ci.yml")).toBe(50);
    expect(scorePath("src/utils/format.ts")).toBe(40);
  });

  it("scores tests at 10 and excludes generated, vendored, binary and secret files", () => {
    expect(scorePath("src/app/page.test.tsx")).toBe(10);
    expect(scorePath("tests/test_items.py")).toBe(10);
    expect(scorePath("node_modules/react/index.js")).toBe(0);
    expect(scorePath("packages/ui/dist/index.js")).toBe(0);
    expect(scorePath("package-lock.json")).toBe(0);
    expect(scorePath("pnpm-lock.yaml")).toBe(0);
    expect(scorePath("public/app.min.js")).toBe(0);
    expect(scorePath("public/logo.png")).toBe(0);
    expect(scorePath("certs/server.pem")).toBe(0);
    expect(scorePath(".env")).toBe(0);
    expect(scorePath("packages/a/b/c/d/package.json")).toBe(0);
    expect(scorePath("docs/guide.md")).toBe(0);
  });
});

describe("selectRepoFiles", () => {
  it("selects the README and manifests first in a Next.js app", () => {
    const { files, considered } = selectRepoFiles(nextApp);
    expect(paths(files).slice(0, 2)).toEqual(["README.md", "package.json"]);
    expect(paths(files)).toContain("src/app/api/chat/route.ts");
    expect(considered).toBe(9);
  });

  it("never selects lockfiles, dependencies or secrets, and ranks tests last", () => {
    const selected = paths(selectRepoFiles(nextApp).files);
    expect(selected).not.toContain("package-lock.json");
    expect(selected.some((path) => path.startsWith("node_modules/"))).toBe(false);
    expect(selected).not.toContain(".env");
    expect(selected.indexOf("src/app/page.test.tsx")).toBeGreaterThan(selected.indexOf("src/app/page.tsx"));
  });

  it("selects a Python service's entry points, models and manifests", () => {
    const selected = paths(selectRepoFiles(pythonService).files);
    expect(selected.slice(0, 3)).toEqual(["README.md", "requirements.txt", "pyproject.toml"]);
    expect(selected).toEqual(expect.arrayContaining(["app/main.py", "app/models.py", "app/routes/items.py"]));
    expect(selected).not.toContain("poetry.lock");
    expect(selected.some((path) => path.startsWith(".venv/"))).toBe(false);
  });

  it("selects per-package manifests and skips build output in a monorepo", () => {
    const selected = paths(selectRepoFiles(monorepo).files);
    expect(selected.slice(0, 3)).toEqual(["README.md", "package.json", "apps/web/package.json"]);
    expect(selected).toEqual(expect.arrayContaining(["docker-compose.yml", ".github/workflows/ci.yml", "packages/ui/src/index.ts"]));
    expect(selected).not.toContain("packages/ui/dist/index.js");
    expect(selected).not.toContain("pnpm-lock.yaml");
    expect(selected).not.toContain("packages/a/b/c/d/package.json");
  });

  it("stops at the file-count and total-character budgets", () => {
    const many = Array.from({ length: 100 }, (_, i) => blob(`src/lib/mod${i}.ts`, 5_000));
    expect(selectRepoFiles(many).files).toHaveLength(36);
    expect(selectRepoFiles(many, { ...DEFAULT_BUDGET, maxFiles: 5 }).files).toHaveLength(5);
  });

  it("skips blobs over 200,000 bytes and counts only eligible files", () => {
    const { files, considered } = selectRepoFiles([blob("src/lib/huge.ts", 250_000), blob("src/lib/small.ts", 500)]);
    expect(paths(files)).toEqual(["src/lib/small.ts"]);
    expect(considered).toBe(1);
  });

  it("keeps only the five newest migrations", () => {
    const migrations = Array.from({ length: 7 }, (_, i) => blob(`migrations/000${i + 1}_step.sql`, 500));
    const selected = paths(selectRepoFiles(migrations).files);
    expect(selected.sort()).toEqual([
      "migrations/0003_step.sql",
      "migrations/0004_step.sql",
      "migrations/0005_step.sql",
      "migrations/0006_step.sql",
      "migrations/0007_step.sql",
    ]);
  });

  it("orders by score, then depth, then size", () => {
    const selected = paths(
      selectRepoFiles([blob("src/deep/er/file.ts", 100), blob("src/big.ts", 900), blob("src/small.ts", 100)]).files,
    );
    expect(selected).toEqual(["src/small.ts", "src/big.ts", "src/deep/er/file.ts"]);
  });

  it("lists directories and well-scored files, without excluded paths", () => {
    const { listing } = selectRepoFiles(nextApp);
    expect(listing).toEqual(expect.arrayContaining(["src", "src/app", "README.md", "src/app/api/chat/route.ts"]));
    expect(listing).not.toContain("node_modules");
    expect(listing).not.toContain("package-lock.json");
    expect(listing).not.toContain("tsconfig.json");
    expect(listing).not.toContain("src/app/page.test.tsx");
  });

  it("caps the listing at maxListing", () => {
    expect(selectRepoFiles(nextApp, { ...DEFAULT_BUDGET, maxListing: 3 }).listing).toHaveLength(3);
  });
});

describe("redactSecrets", () => {
  it("redacts each secret pattern", () => {
    expect(redactSecrets("aws = AKIAIOSFODNN7EXAMPLE")).toEqual({ text: "aws = [REDACTED]", redactions: 1 });
    expect(redactSecrets("OPENAI=sk-abcdefghijklmnopqrstuvwx")).toEqual({ text: "OPENAI=[REDACTED]", redactions: 1 });
    expect(redactSecrets("GH=ghp_abcdefghijklmnopqrstuvwxyz0123456789")).toEqual({ text: "GH=[REDACTED]", redactions: 1 });
    expect(redactSecrets("PAT=github_pat_11ABCDEFG0123456789_abcdef")).toEqual({ text: "PAT=[REDACTED]", redactions: 1 });
    expect(redactSecrets("SLACK=xoxb-123456789012-abcdefghijkl")).toEqual({ text: "SLACK=[REDACTED]", redactions: 1 });
  });

  it("redacts whole PEM private key blocks, including unterminated ones", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
    expect(redactSecrets(`key:\n${pem}\ndone`)).toEqual({ text: "key:\n[REDACTED]\ndone", redactions: 1 });
    expect(redactSecrets("-----BEGIN PRIVATE KEY-----\nMIIE")).toEqual({ text: "[REDACTED]", redactions: 1 });
  });

  it("redacts values assigned to key-like names", () => {
    expect(redactSecrets("password: hunter2hunter2")).toEqual({ text: "password: [REDACTED]", redactions: 1 });
    expect(redactSecrets("API_KEY = abcd1234efgh")).toEqual({ text: "API_KEY = [REDACTED]", redactions: 1 });
    expect(redactSecrets("client_secret=s3cr3tvalue")).toEqual({ text: "client_secret=[REDACTED]", redactions: 1 });
  });

  it("leaves short values and ordinary text alone", () => {
    expect(redactSecrets("token: short")).toEqual({ text: "token: short", redactions: 0 });
    expect(redactSecrets("const max_tokens = 4096;")).toEqual({ text: "const max_tokens = 4096;", redactions: 0 });
    expect(redactSecrets("task-management-system-v2")).toEqual({ text: "task-management-system-v2", redactions: 0 });
  });
});

describe("truncateFile", () => {
  it("cuts long text and marks the cut", () => {
    expect(truncateFile("abcdef", 3)).toBe("abc\n…[truncated]");
    expect(truncateFile("abc", 3)).toBe("abc");
  });
});
