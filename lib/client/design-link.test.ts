import { describe, expect, it } from "vitest";
import { decodeDesign, encodeDesign, hasDesign } from "./design-link";

describe("design links", () => {
  it("round-trips a design through the fragment", async () => {
    const design = { v: 1, model: { components: [{ id: "db", label: "Postgres" }], flows: [], tuning: { db: { instances: 3 } } } };
    const hash = await encodeDesign(design);
    expect(hash.startsWith("design=")).toBe(true);
    expect(hash).toMatch(/^design=[A-Za-z0-9_-]+$/);
    expect(hasDesign(hash)).toBe(true);
    expect(await decodeDesign(hash)).toEqual(design);
  });

  it("ignores fragments without a design, and ones that cannot be read", async () => {
    expect(hasDesign("scenario=campaign-launch")).toBe(false);
    expect(await decodeDesign("scenario=campaign-launch")).toBeUndefined();
    expect(await decodeDesign("design=not-really-deflate")).toBeUndefined();
  });
});
