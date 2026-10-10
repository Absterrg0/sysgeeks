import { describe, expect, it } from "vitest";
import { sanitizeConceptLinks } from "./concept-links";

const known = new Set(["idempotency", "durability"]);

describe("sanitizeConceptLinks", () => {
  it("keeps known links, bare and labelled", () => {
    const text = "Use [[idempotency]] and [[durability|durable state]].";
    expect(sanitizeConceptLinks(text, known)).toBe(text);
  });

  it("unwraps an unknown labelled link to its label", () => {
    expect(sanitizeConceptLinks("See [[quorum|quorum reads]].", known)).toBe("See quorum reads.");
  });

  it("unwraps an unknown bare link to its id", () => {
    expect(sanitizeConceptLinks("See [[quorum]].", known)).toBe("See quorum.");
  });

  it("treats an empty label as no label", () => {
    expect(sanitizeConceptLinks("See [[quorum|]].", known)).toBe("See quorum.");
  });

  it("handles known and unknown links in one string", () => {
    expect(sanitizeConceptLinks("[[idempotency]] then [[quorum|quorum reads]] then [[durability|durable]].", known)).toBe(
      "[[idempotency]] then quorum reads then [[durability|durable]].",
    );
  });

  it("leaves text without complete links untouched", () => {
    const text = "Plain [text], a [[unclosed link, and single [brackets].";
    expect(sanitizeConceptLinks(text, known)).toBe(text);
  });
});
