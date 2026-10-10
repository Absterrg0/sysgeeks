import { describe, expect, it } from "vitest";
import { slug } from "./content";
import { getExampleProject } from "@/lib/content/example-projects";
import { instantiateExample } from "./example-project";
import { autoLayout, routeCost, slugify, uniqueSlug } from "./layout";

describe("autoLayout", () => {
  it("places components in columns by kind and drops empty columns", () => {
    const placed = autoLayout([
      { id: "web", label: "Web", kind: "client", responsibility: "x" },
      { id: "db", label: "DB", kind: "database", responsibility: "x" },
      { id: "cache", label: "Cache", kind: "cache", responsibility: "x" },
    ]);
    expect(placed.map((p) => p.position.col)).toEqual([0, 1, 1]);
    expect(new Set(placed.map((p) => `${p.position.col},${p.position.row}`)).size).toBe(3);
  });

  it("leaves no empty rows between components in any example", async () => {
    const { listExampleProjects } = await import("@/lib/content/example-projects");
    for (const def of listExampleProjects()) {
      const rows = new Set(autoLayout(def.components, def.flows).map((p) => p.position.row));
      expect([...rows].sort((a, b) => a - b), def.id).toEqual([...rows].map((_, i) => i));
    }
  });

  it("lays out every example so its flows are drawn without detours round other parts", async () => {
    const { listExampleProjects } = await import("@/lib/content/example-projects");
    for (const def of listExampleProjects()) {
      const placed = autoLayout(def.components, def.flows);
      const at = new Map(placed.map((p) => [p.id, p.position]));
      const taken = new Set(placed.map((p) => `${p.position.col},${p.position.row}`));
      const isEmpty = (col: number, row: number) => !taken.has(`${col},${row}`);
      const detours = def.flows.filter((f) => {
        const a = at.get(f.from);
        const b = at.get(f.to);
        return a && b && routeCost(a, b, isEmpty).cost >= 3;
      });
      // A dense model can force one; none should need more.
      expect(detours.length, def.id).toBeLessThanOrEqual(1);
    }
    const saas = instantiateExample(getExampleProject("subscription-saas")!, "x", "2026-01-01T00:00:00.000Z");
    const placed = autoLayout(saas.components, saas.flows);
    const at = new Map(placed.map((p) => [p.id, p.position]));
    const taken = new Set(placed.map((p) => `${p.position.col},${p.position.row}`));
    for (const f of saas.flows) {
      expect(routeCost(at.get(f.from)!, at.get(f.to)!, (c, r) => !taken.has(`${c},${r}`)).cost, f.id).toBeLessThan(3);
    }
  });
});

describe("slugs", () => {
  it("produces valid, unique slugs", () => {
    for (const text of ["Payment Provider", "  ", "Ünïcødé API!!", "a".repeat(80)]) {
      expect(slug.safeParse(slugify(text)).success, text).toBe(true);
    }
    expect(uniqueSlug("API", ["api", "api-2"])).toBe("api-3");
  });

  it("keeps a suffixed slug within 40 characters", () => {
    const long = "a".repeat(60);
    const first = uniqueSlug(long, ["a".repeat(40)]);
    expect(first).toBe(`${"a".repeat(38)}-2`);
    expect(slug.safeParse(first).success).toBe(true);
    expect(uniqueSlug(long, ["a".repeat(40), first])).toBe(`${"a".repeat(38)}-3`);
  });
});
