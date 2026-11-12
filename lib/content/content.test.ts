import { describe, expect, it } from "vitest";
import { checkContentIntegrity, checkExampleIntegrity, checkSourceIntegrity, conceptReferences } from "./integrity";
import { getConcept, listCompanies, listConcepts, listInvestigations, listWriteups, writeupsForInvestigation } from ".";
import { getExampleProject, listExampleProjects } from "./example-projects";
import { listExercises, resolveExercise } from "./exercises";
import { parseExerciseKey } from "@/lib/domain/learner";

describe("curated content", () => {
  it("parses and has a consistent reference graph", () => {
    expect(checkContentIntegrity(listInvestigations(), listConcepts())).toEqual([]);
  });

  it("has sources that reference existing companies, investigations and concepts", () => {
    expect(checkSourceIntegrity(listCompanies(), listWriteups(), listInvestigations(), listConcepts())).toEqual([]);
  });

  it("has example projects that are valid models and reference existing content", () => {
    expect(checkExampleIntegrity(listExampleProjects(), listConcepts(), listInvestigations())).toEqual([]);
  });

  it("cites at least one published source for every investigation", () => {
    const unsourced = listInvestigations()
      .filter((inv) => writeupsForInvestigation(inv.id).length === 0)
      .map((inv) => inv.id);
    expect(unsourced).toEqual([]);
  });

  // Most companies are here for one idea and one system. Case studies such as Google's and Amazon's papers
  // inform several systems, so the rule is: every company leads to practice, and every system has a company.
  it("links every company to an investigation, and every investigation to a company", () => {
    const investigationsOf = (companyId: string) =>
      new Set(listWriteups().filter((w) => w.companyId === companyId).flatMap((w) => w.investigationIds));
    expect(listCompanies().filter((c) => investigationsOf(c.id).size === 0).map((c) => c.id)).toEqual([]);
    const covered = new Set(listCompanies().flatMap((c) => [...investigationsOf(c.id)]));
    expect(listInvestigations().filter((inv) => !covered.has(inv.id)).map((inv) => inv.id)).toEqual([]);
  });

  it("links every concept from at least one investigation or concept", () => {
    const referenced = new Set<string>();
    for (const inv of listInvestigations()) {
      for (const s of inv.stages) s.conceptIds.forEach((id) => referenced.add(id));
      conceptReferences(inv).forEach((id) => referenced.add(id));
    }
    for (const c of listConcepts()) c.relatedConceptIds.forEach((id) => referenced.add(id));
    const orphans = listConcepts().filter((c) => !referenced.has(c.id)).map((c) => c.id);
    expect(orphans).toEqual([]);
  });

  it("gives every investigation a failure, a change and a defense stage", () => {
    for (const inv of listInvestigations()) {
      expect(inv.stages.some((s) => s.phase === "break"), inv.id).toBe(true);
      expect(inv.stages.some((s) => s.phase === "change"), inv.id).toBe(true);
      expect(inv.stages.some((s) => s.phase === "defend"), inv.id).toBe(true);
    }
  });

  it("resolves every listed exercise and round-trips its key", () => {
    const exercises = listExercises();
    expect(exercises.length).toBeGreaterThan(0);
    for (const e of exercises) {
      expect(parseExerciseKey(e.key)).toEqual(e.ref);
      expect(resolveExercise(e.ref)?.summary.key).toBe(e.key);
    }
  });

  it("derives concept checks from concept claims", () => {
    const concept = listConcepts()[0];
    if (!concept) throw new Error("no concepts");
    const resolved = resolveExercise({ kind: "concept-claims", conceptId: concept.id });
    expect(resolved?.interaction.kind).toBe("claims");
    expect(getConcept(concept.id)?.claims.length).toBeGreaterThanOrEqual(2);
  });
});

describe("integrity checker", () => {
  it("reports dangling references", () => {
    const [inv] = listInvestigations();
    if (!inv) throw new Error("no investigations");
    const broken = {
      ...inv,
      relatedInvestigationIds: ["does-not-exist"],
      stages: inv.stages.map((s, i) => (i === 0 ? { ...s, conceptIds: ["no-such-concept"] } : s)),
    };
    const errors = checkContentIntegrity([broken], listConcepts());
    expect(errors.some((e) => e.includes("does-not-exist"))).toBe(true);
    expect(errors.some((e) => e.includes("no-such-concept"))).toBe(true);
  });

  it("reports broken example projects", () => {
    const example = getExampleProject("subscription-saas");
    if (!example) throw new Error("no example projects");
    const broken = {
      ...example,
      focusConceptIds: ["no-such-concept", ...example.focusConceptIds],
      flows: example.flows.map((f) => (f.id === "read-write" ? { ...f, to: "nowhere" } : f)),
    };
    const errors = checkExampleIntegrity([broken], listConcepts(), listInvestigations());
    expect(errors.some((e) => e.includes("no-such-concept"))).toBe(true);
    expect(errors.some((e) => e.includes("nowhere"))).toBe(true);
  });
});
