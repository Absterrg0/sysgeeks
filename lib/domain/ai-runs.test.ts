import { describe, expect, it } from "vitest";
import { type AiRun, MAX_AI_RUNS, type Project } from "./learner";
import { createLearnerState, deleteAiRun, deleteProject, parseLearnerState, recordAiRun, saveProject } from "./learner-state";

const now = "2026-11-01T00:00:00.000Z";

const run = (id: string, extra: Partial<AiRun> = {}): AiRun => ({
  id,
  feature: "review",
  createdAt: now,
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  projectId: "shop",
  output: { review: { summary: "ok" } },
  ...extra,
});

const project: Project = {
  id: "shop",
  name: "Shop",
  summary: "",
  source: { type: "manual" },
  components: [],
  flows: [],
  invariants: [],
  createdAt: now,
  updatedAt: now,
};

describe("AI runs in learner state", () => {
  it("starts empty, and reads older states without the field as empty", () => {
    const state = createLearnerState("me", now);
    expect(state.aiRuns).toEqual([]);
    const older: Partial<typeof state> = { ...state };
    delete older.aiRuns;
    const parsed = parseLearnerState(JSON.stringify(older));
    expect(parsed.ok && parsed.state.aiRuns).toEqual([]);
  });

  it("keeps runs oldest first, replaces a run with the same id, and drops the oldest past the cap", () => {
    let state = createLearnerState("me", now);
    for (let i = 0; i < MAX_AI_RUNS + 3; i++) state = recordAiRun(state, run(`r${i}`));
    expect(state.aiRuns).toHaveLength(MAX_AI_RUNS);
    expect(state.aiRuns[0]?.id).toBe("r3");

    state = recordAiRun(state, run("r10", { title: "again" }));
    expect(state.aiRuns.filter((r) => r.id === "r10")).toHaveLength(1);
    expect(state.aiRuns.at(-1)?.title).toBe("again");
  });

  it("deletes one run, and a project's runs with the project", () => {
    let state = saveProject(createLearnerState("me", now), project);
    state = recordAiRun(state, run("a"));
    state = recordAiRun(state, run("b", { projectId: "other" }));
    expect(deleteAiRun(state, "a").aiRuns.map((r) => r.id)).toEqual(["b"]);
    expect(deleteProject(state, "shop").aiRuns.map((r) => r.id)).toEqual(["b"]);
  });

  it("round-trips through export and import, and rejects a malformed run", () => {
    const state = recordAiRun(createLearnerState("me", now), run("a"));
    const parsed = parseLearnerState(JSON.stringify(state));
    expect(parsed.ok && parsed.state.aiRuns).toEqual(state.aiRuns);

    const bad = { ...state, aiRuns: [{ ...run("a"), feature: "billing" }] };
    expect(parseLearnerState(JSON.stringify(bad))).toMatchObject({ ok: false });
    const noOutput = { ...state, aiRuns: [{ ...run("a"), output: "text" }] };
    expect(parseLearnerState(JSON.stringify(noOutput))).toMatchObject({ ok: false });
  });
});
