import { describe, expect, it } from "vitest";
import { PACKS, creditCost, packById } from "./pricing";

describe("creditCost", () => {
  it("charges 2 credits for repository intake and 1 for other intake sources", () => {
    expect(creditCost("intake", { source: "repository" })).toBe(2);
    expect(creditCost("intake", { source: "readme" })).toBe(1);
    expect(creditCost("intake", { source: "description" })).toBe(1);
    expect(creditCost("intake")).toBe(1);
  });

  it("prices the other AI features", () => {
    expect(creditCost("review")).toBe(2);
    expect(creditCost("questions")).toBe(1);
    expect(creditCost("grade")).toBe(0);
    expect(creditCost("interview")).toBe(1);
  });

  it("ignores the source for features other than intake", () => {
    expect(creditCost("review", { source: "repository" })).toBe(2);
  });
});

describe("packById", () => {
  it("finds each pack by id", () => {
    for (const pack of PACKS) {
      expect(packById(pack.id)).toEqual(pack);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(packById("enterprise")).toBeUndefined();
    expect(packById("")).toBeUndefined();
  });
});

describe("PACKS", () => {
  it("gives a strictly lower price per credit as packs grow", () => {
    let previous = Infinity;
    for (const pack of PACKS) {
      const perCredit = pack.priceUsd / pack.credits;
      expect(perCredit).toBeLessThan(previous);
      previous = perCredit;
    }
  });
});
