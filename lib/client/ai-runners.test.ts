import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiFailure } from "@/lib/ai/errors";
import type { AiEvent } from "@/lib/ai/events";
import type { AiRun } from "@/lib/domain/learner";
import type { AiKeySettings } from "@/lib/store/ai-key-store";

const state = vi.hoisted(() => ({
  key: null as AiKeySettings | null,
  model: null as unknown,
  runs: [] as AiRun[],
}));

vi.mock("@/lib/store/ai-key-store", () => ({ readAiKey: () => state.key }));
vi.mock("@/lib/store/learner-store", () => ({ recordAiRun: (run: AiRun) => state.runs.push(run) }));
vi.mock("@/lib/ai/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/catalog")>()),
  loadConceptCatalog: async () => [{ id: "idempotency", title: "Idempotency", summary: "Doing it twice is safe." }],
}));
vi.mock("@/lib/ai/model", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/model")>()),
  languageModel: async () => state.model,
}));

const { gradeAnswerNow, runAiNow } = await import("./ai-runners");

const KEY: AiKeySettings = { provider: "anthropic", apiKey: "sk-ant-test-1234567890", model: "claude-sonnet-5-5", lifetime: "browser" };

function replying(...texts: string[]) {
  return new MockLanguageModelV4({
    modelId: "claude-sonnet-5-5",
    doGenerate: texts.map((text) => ({
      content: [{ type: "text" as const, text }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    })),
  });
}

const model = {
  components: [
    { id: "api", label: "API", kind: "service" as const, responsibility: "Takes orders." },
    { id: "db", label: "Orders DB", kind: "database" as const, responsibility: "Stores orders." },
  ],
  flows: [{ id: "write", from: "api", to: "db", label: "Insert order", kind: "request" as const }],
  invariants: [],
};
const request = { projectId: "shop", name: "Shop", summary: "Sells things.", model };

const review = {
  summary: "A small shop.",
  strengths: [],
  findings: [
    {
      id: "lost-writes",
      category: "failure-mode",
      severity: "high",
      confidence: "medium",
      title: "Lost writes",
      scenario: "When the database restarts mid-write.",
      impact: "Orders vanish. See [[idempotency]] and [[not-a-concept]].",
      recommendation: "Use a transaction.",
      tradeoff: "Latency.",
      componentIds: ["api", "ghost"],
      flowIds: [],
      conceptIds: ["idempotency", "not-a-concept"],
    },
  ],
  suggestedInvariants: [],
  questionsToAsk: [],
};

beforeEach(() => {
  state.key = KEY;
  state.runs = [];
  state.model = replying(JSON.stringify(review));
});

describe("runAiNow", () => {
  it("asks for a key before doing anything", async () => {
    state.key = null;
    const events: AiEvent[] = [];
    await expect(runAiNow("review", request, (e) => events.push(e))).rejects.toMatchObject({ code: "key_missing" });
    expect(events.at(-1)).toMatchObject({ type: "error", code: "key_missing" });
  });

  it("reviews in the browser, keeps only known references, and saves the run", async () => {
    const events: AiEvent[] = [];
    const output = await runAiNow<{ review: typeof review; modelHash: string }>("review", request, (e) => events.push(e));

    expect(output.review.findings[0]?.componentIds).toEqual(["api"]);
    expect(output.review.findings[0]?.conceptIds).toEqual(["idempotency"]);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({ feature: "review", projectId: "shop", provider: "anthropic", modelHash: output.modelHash });
    expect(events.map((e) => e.type)).toEqual(["progress", "result"]);
  });

  it("accepts the old route path, for callers written before AI moved to the browser", async () => {
    await expect(runAiNow("/api/ai/review", request)).resolves.toBeDefined();
  });

  it("asks once more when the answer fails the schema, then gives up", async () => {
    const mock = replying("{}", "not json");
    state.model = mock;
    await expect(runAiNow("review", request)).rejects.toMatchObject({ code: "invalid_output" });
    expect(mock.doGenerateCalls).toHaveLength(2);
    expect(state.runs).toHaveLength(0);
  });

  it("rejects input over the limits before calling the provider", async () => {
    const mock = replying(JSON.stringify(review));
    state.model = mock;
    await expect(runAiNow("intake", { method: "readme", text: "x".repeat(60_001) })).rejects.toMatchObject({
      code: "input_too_large",
    });
    expect(mock.doGenerateCalls).toHaveLength(0);
  });

  it("says the key was rejected, quoting the provider without the key", async () => {
    state.model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "Unauthorized",
          url: "https://api.openai.com/v1/responses",
          requestBodyValues: {},
          statusCode: 401,
          responseBody: JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY.apiKey}.` } }),
        });
      },
    });
    const failure = await runAiNow("review", request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiFailure);
    expect(failure).toMatchObject({ code: "key_invalid", detail: "Incorrect API key provided: [your key]." });
  });
});

describe("gradeAnswerNow", () => {
  it("marks each rubric point and cites the passage", async () => {
    state.model = replying(
      JSON.stringify({
        points: [
          { id: "timeout", mark: "covered", passage: 0, note: "Names it." },
          { id: "retries", mark: "missed", passage: null, note: "Says nothing about retries." },
        ],
        summary: "Half there.",
      }),
    );
    const assessment = await gradeAnswerNow(
      {
        ref: { kind: "concept-explain", conceptId: "timeouts" },
        interaction: {
          kind: "open",
          prompt: "What happens when the database stalls?",
          rubric: [
            { id: "timeout", text: "Names the timeout.", weight: "core" },
            { id: "retries", text: "Says whether retries are safe.", weight: "supporting" },
          ],
          reference: "It times out.",
        },
        title: "Stalls",
      },
      "open",
      "The API gives up after a two second timeout.",
    );
    expect(assessment.marks).toEqual({ timeout: "covered", retries: "missed" });
    expect(assessment.citations.timeout).toBe("The API gives up after a two second timeout.");
    expect(assessment.model).toBe("claude-sonnet-5-5");
  });
});
