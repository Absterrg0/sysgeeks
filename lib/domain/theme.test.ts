import { describe, expect, it } from "vitest";
import { effectiveScheme, parseTheme, themeAttribute, themeInitScript, THEME_STORAGE_KEY } from "./theme";

describe("parseTheme", () => {
  it("keeps the three known values", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to system for missing or unreadable values", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("Light")).toBe("system");
    expect(parseTheme("auto")).toBe("system");
  });
});

describe("themeAttribute", () => {
  it("forces light and dark, and removes the attribute for system", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeNull();
  });
});

describe("effectiveScheme", () => {
  it("follows the forced mode regardless of the OS", () => {
    expect(effectiveScheme("light", true)).toBe("light");
    expect(effectiveScheme("dark", false)).toBe("dark");
  });

  it("follows the OS when the preference is system", () => {
    expect(effectiveScheme("system", true)).toBe("dark");
    expect(effectiveScheme("system", false)).toBe("light");
  });
});

describe("themeInitScript", () => {
  it("reads the same key the toggle writes", () => {
    expect(themeInitScript).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });

  it("only ever sets a forced mode, never system", () => {
    expect(themeInitScript).toContain("data-theme");
    expect(themeInitScript).not.toContain('"system"');
  });
});
