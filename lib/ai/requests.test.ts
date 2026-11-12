import { describe, expect, it } from "vitest";
import { getExampleProject } from "@/lib/content/example-projects";
import { IntakeRequestSchema, ProjectModelInputSchema, ReviewRequestSchema } from "./requests";

describe("IntakeRequestSchema", () => {
  it("needs text for a description or readme", () => {
    expect(IntakeRequestSchema.safeParse({ method: "description" }).success).toBe(false);
    expect(IntakeRequestSchema.safeParse({ method: "readme", text: "   " }).success).toBe(false);
    expect(IntakeRequestSchema.safeParse({ method: "description", text: "A shop." }).success).toBe(true);
  });

  it("caps a description at 20k characters but lets a readme run to 60k", () => {
    const long = "x".repeat(20_001);
    expect(IntakeRequestSchema.safeParse({ method: "description", text: long }).success).toBe(false);
    expect(IntakeRequestSchema.safeParse({ method: "readme", text: long }).success).toBe(true);
  });

  it("needs a repository URL, and no text, for a repository", () => {
    expect(IntakeRequestSchema.safeParse({ method: "repository" }).success).toBe(false);
    expect(IntakeRequestSchema.safeParse({ method: "repository", repoUrl: "https://github.com/a/b" }).success).toBe(true);
  });
});

describe("ProjectModelInputSchema", () => {
  it("accepts an authored example model", () => {
    const example = getExampleProject("storefront")!;
    const model = { components: example.components, flows: example.flows, invariants: example.invariants };
    expect(ProjectModelInputSchema.safeParse(model).success).toBe(true);
  });

  it("caps the number of components at 30", () => {
    const components = Array.from({ length: 31 }, (_, i) => ({
      id: `c-${i}`,
      label: "Component",
      kind: "service",
      responsibility: "Does things.",
    }));
    expect(ProjectModelInputSchema.safeParse({ components, flows: [], invariants: [] }).success).toBe(false);
  });

  it("caps the serialized model at 40k characters", () => {
    const long = "f".repeat(300);
    const flows = Array.from({ length: 60 }, (_, i) => ({
      id: `${long}${i}`,
      from: long,
      to: long,
      label: long,
      kind: "request",
    }));
    expect(ProjectModelInputSchema.safeParse({ components: [], flows, invariants: [] }).success).toBe(false);
  });
});

describe("ReviewRequestSchema", () => {
  const model = { components: [], flows: [], invariants: [] };

  it("needs a project id and name", () => {
    expect(ReviewRequestSchema.safeParse({ projectId: "shop", name: "Shop", summary: "", model }).success).toBe(true);
    expect(ReviewRequestSchema.safeParse({ projectId: "Shop App", name: "Shop", summary: "", model }).success).toBe(false);
    expect(ReviewRequestSchema.safeParse({ projectId: "shop", name: "", summary: "", model }).success).toBe(false);
  });

  it("caps the project id length", () => {
    expect(ReviewRequestSchema.safeParse({ projectId: "a".repeat(64), name: "Shop", summary: "", model }).success).toBe(true);
    expect(ReviewRequestSchema.safeParse({ projectId: "a".repeat(65), name: "Shop", summary: "", model }).success).toBe(false);
  });
});
