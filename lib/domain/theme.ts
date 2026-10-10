/**
 * The theme preference. "system" follows the OS; "light" and "dark" force a
 * mode by setting `data-theme` on `<html>`, which flips `color-scheme` and
 * with it every `light-dark()` token (app/globals.css).
 */
export type Theme = "light" | "dark" | "system";

export const THEMES: readonly Theme[] = ["light", "dark", "system"];

/** The interviewgeek prefix keeps one namespace for everything the browser stores. */
export const THEME_STORAGE_KEY = "interviewgeek.theme";

/** Stored strings to Theme. Anything missing or unreadable means "system". */
export function parseTheme(raw: string | null | undefined): Theme {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

/** The `data-theme` value for `<html>`, or null when the OS decides (attribute removed). */
export function themeAttribute(theme: Theme): "light" | "dark" | null {
  return theme === "system" ? null : theme;
}

/** The mode actually shown, for the toggle's icon. */
export function effectiveScheme(theme: Theme, systemDark: boolean): "light" | "dark" {
  if (theme === "light" || theme === "dark") return theme;
  return systemDark ? "dark" : "light";
}

/**
 * Pre-paint script for `<head>`: applies the stored theme before CSS paints,
 * so a forced mode never flashes the OS mode first. Runs synchronously during
 * HTML parsing; the try/catch covers browsers that refuse storage.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
