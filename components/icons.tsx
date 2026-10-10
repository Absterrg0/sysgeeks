import type { ReactNode } from "react";

function Icon({ children, size = 14, className = "shrink-0" }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Two components joined by a flow. */
export function InvestigationsIcon() {
  return (
    <Icon>
      <rect x="1.75" y="1.75" width="5" height="5" rx="1.25" />
      <rect x="9.25" y="9.25" width="5" height="5" rx="1.25" />
      <path d="M6.75 4.25h2.5a2 2 0 0 1 2 2v3" />
    </Icon>
  );
}

export function ConceptsIcon() {
  return (
    <Icon>
      <path d="M2.5 3.25c1.75-.75 3.75-.75 5.5.5v9.5c-1.75-1.25-3.75-1.25-5.5-.5z" />
      <path d="M13.5 3.25c-1.75-.75-3.75-.75-5.5.5v9.5c1.75-1.25 3.75-1.25 5.5-.5z" />
    </Icon>
  );
}

/** A building with windows. */
export function CompaniesIcon() {
  return (
    <Icon>
      <path d="M2.75 14.25V3a1.25 1.25 0 0 1 1.25-1.25h5A1.25 1.25 0 0 1 10.25 3v11.25M10.25 6.75H12A1.25 1.25 0 0 1 13.25 8v6.25M1.5 14.25h13" />
      <path d="M5.25 4.75h1.5M5.25 7.5h1.5M5.25 10.25h1.5" />
    </Icon>
  );
}

export function PracticeIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.75" />
      <circle cx="8" cy="8" r=".5" fill="currentColor" />
    </Icon>
  );
}

export function InterviewIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8.75" r="5.5" />
      <path d="M8 6v2.75l1.75 1.25M6.5 1.75h3" />
    </Icon>
  );
}

export function ProjectsIcon() {
  return (
    <Icon>
      <path d="M1.75 4.5a1.25 1.25 0 0 1 1.25-1.25h3l1.5 1.5H13a1.25 1.25 0 0 1 1.25 1.25v6.5A1.25 1.25 0 0 1 13 13.75H3a1.25 1.25 0 0 1-1.25-1.25z" />
    </Icon>
  );
}

export function UnderstandingIcon() {
  return (
    <Icon>
      <path d="M2.25 13.75h11.5M4 11V7.5M8 11V3.75M12 11V6" />
    </Icon>
  );
}

export function ArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
      <path d="M3 7l4-4M3.75 3H7v3.25" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

type ThemeGlyph = { size?: number; className?: string };

/** The sun, for the light mode. */
export function SunIcon({ size, className }: ThemeGlyph) {
  return (
    <Icon size={size} className={className ?? "shrink-0"}>
      <circle cx="8" cy="8" r="3.25" />
      <path d="M8 1.5v1.75M8 12.75V14.5M1.5 8h1.75M12.75 8h1.75M3.4 3.4l1.25 1.25M11.35 11.35l1.25 1.25M12.6 3.4l-1.25 1.25M4.65 11.35L3.4 12.6" />
    </Icon>
  );
}

/** The crescent, for the dark mode. */
export function MoonIcon({ size, className }: ThemeGlyph) {
  return (
    <Icon size={size} className={className ?? "shrink-0"}>
      <path d="M13.5 10.25A5.75 5.75 0 0 1 5.75 2.5a5.75 5.75 0 1 0 7.75 7.75z" />
    </Icon>
  );
}

/** A monitor, for following the OS. */
export function MonitorIcon({ size, className }: ThemeGlyph) {
  return (
    <Icon size={size} className={className ?? "shrink-0"}>
      <rect x="2.25" y="2.75" width="11.5" height="8" rx="1.25" />
      <path d="M6 13.5h4M8 10.75v2.75" />
    </Icon>
  );
}

/** A check, marking the active choice in a menu. */
export function CheckIcon({ size, className }: ThemeGlyph) {
  return (
    <Icon size={size} className={className ?? "shrink-0"}>
      <path d="M3 8.5l3.25 3.25L13 5" />
    </Icon>
  );
}

/** A plus, for a row that opens; turned 45° it closes. */
export function PlusIcon({ size, className }: ThemeGlyph) {
  return (
    <Icon size={size} className={className ?? "shrink-0"}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  );
}

/** 8x8 cells; 1 = lit node, 2 = lit flow. Shared with the social card renderer. */
export const PIXEL_MARK_GRID = [
  "11100000",
  "11122200",
  "11100200",
  "00000200",
  "00000200",
  "00000111",
  "00000111",
  "00000111",
] as const;

/**
 * The mark: a pixel grid in which two nodes and the flow between them are lit,
 * set like a small display.
 */
export function PixelMark({ size = 44 }: { size?: number }) {
  const grid = PIXEL_MARK_GRID;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      aria-hidden="true"
      className="shrink-0 overflow-hidden"
      style={{
        borderRadius: Math.round(size * 0.2),
        outline: "1px solid light-dark(transparent, #4D4840)",
        outlineOffset: "-1px",
      }}
    >
      <rect width="8" height="8" fill="#0a0a0a" />
      {grid.flatMap((row, y) =>
        [...row].map((cell, x) => (
          <rect
            key={`${x}-${y}`}
            x={x + 0.08}
            y={y + 0.08}
            width={0.84}
            height={0.84}
            rx={0.12}
            fill={cell === "0" ? "#ffffff" : "#00bbff"}
            fillOpacity={cell === "0" ? 0.07 : cell === "2" ? 0.55 : 1}
          />
        )),
      )}
    </svg>
  );
}
