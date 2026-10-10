"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import {
  parseTheme,
  themeAttribute,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
} from "@/lib/domain/theme";

const THEME_META: Record<Theme, { label: string; Icon: typeof SunIcon }> = {
  light: { label: "Light", Icon: SunIcon },
  dark: { label: "Dark", Icon: MoonIcon },
  system: { label: "System", Icon: MonitorIcon },
};

function readStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage refused (private mode): the OS decides, for this tab.
    return "system";
  }
}

/** Set `data-theme` on `<html>` and persist the choice. System clears both. */
function applyTheme(theme: Theme) {
  const attribute = themeAttribute(theme);
  if (attribute) document.documentElement.setAttribute("data-theme", attribute);
  else document.documentElement.removeAttribute("data-theme");
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Losing the preference is not worth surfacing.
  }
}

/**
 * The theme switch, in the shadcn ModeToggle shape: a sun/moon button that
 * opens Light / Dark / System. The glyph crossfade is pure CSS (see
 * `.theme-glyph` in app/globals.css), so server and client render identical
 * markup and the icon follows the OS live with no JavaScript. The menu is the
 * site's own raised panel, so this needs no new dependencies.
 */
export function ThemeToggle() {
  // The lazy initializer reads the same key as the pre-paint script in
  // app/layout.tsx. The menu is closed on first paint either way, so nothing
  // it renders can mismatch hydration.
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === "undefined" ? "system" : readStoredTheme(),
  );
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Re-apply after React clears <html> attributes on the dev remount. A
  // production no-op: the pre-paint script already ran during parsing.
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    setOpen(false);
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="knob size-10 lg:size-8"
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative block size-[18px]" aria-hidden="true">
          <SunIcon size={18} className="theme-glyph theme-glyph-light" />
          <MoonIcon size={18} className="theme-glyph theme-glyph-dark" />
        </span>
      </button>

      {open && (
        <div role="menu" aria-label="Theme" className="panel absolute top-[calc(100%+8px)] right-0 z-50 grid w-40 gap-0.5 p-1.5">
          {THEMES.map((option) => {
            const meta = THEME_META[option];
            const active = theme === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                aria-current={active}
                onClick={() => choose(option)}
                className="index-row mx-0 w-full text-left whitespace-nowrap"
              >
                <meta.Icon size={14} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">{meta.label}</span>
                <CheckIcon size={14} className={`shrink-0 text-ink ${active ? "" : "invisible"}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
