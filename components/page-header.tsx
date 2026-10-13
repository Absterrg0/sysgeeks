import type { ReactNode } from "react";

/**
 * The opening of a page: a small line of context, the title, one paragraph saying what is here, and the actions
 * on the right. Working pages open straight into their content, so this stays compact and ends on a rule.
 */
export function PageHeader({
  title,
  eyebrow,
  children,
  meta,
  actions,
  aside,
}: {
  title: ReactNode;
  /** One quiet line of context above the title, like a breadcrumb. */
  eyebrow?: ReactNode;
  children?: ReactNode;
  /** One quiet line of facts under the paragraph, e.g. "Intermediate · 40 min". */
  meta?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  /** Kept for older callers; headers are always set from the start now. */
  align?: "start" | "center";
}) {
  return (
    <header className="mb-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-rule pt-8 pb-6 sm:pt-10">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="mb-2 text-[0.8125rem] text-ink-3">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2rem]">
          {title}
        </h1>
        {children && (
          <p className="mt-2.5 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">{children}</p>
        )}
        {meta && <p className="mt-2.5 text-[0.8125rem] text-ink-3">{meta}</p>}
      </div>
      {(actions || aside) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {aside}
        </div>
      )}
    </header>
  );
}

/**
 * The top of a working page (everything but the home page): a title with an optional count, one line saying
 * what is here, actions on the right, and optionally a row of tabs that carries the bottom rule.
 */
export function AppHeader({
  title,
  count,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A toolbar under the title, usually tabs. */
  children?: ReactNode;
}) {
  return (
    <header className={`pt-8 sm:pt-10 ${children ? "" : "border-b border-rule"}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-5">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2.5 font-display text-[1.625rem] leading-tight tracking-[-0.02em] text-balance">
            {title}
          {count !== undefined && (
            <span className="font-mono text-[0.8125rem] tracking-normal text-ink-3">
              {" "}
              {count}
            </span>
          )}
          </h1>
          {description && <p className="mt-1.5 max-w-[72ch] text-[0.875rem] leading-relaxed text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** A titled block of the main column. `split` puts the heading in a column beside the content on wide screens. */
export function Section({
  id,
  title,
  description,
  children,
  className = "",
  action,
  eyebrow,
  split = false,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
  split?: boolean;
}) {
  const heading = (
    <div className="min-w-0">
      {eyebrow && <p className="kicker mb-3">{eyebrow}</p>}
      <h2 id={id} className="font-display text-[1.375rem] leading-tight text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-2 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">{description}</p>
      )}
    </div>
  );
  if (split) {
    return (
      <section
        aria-labelledby={id}
        className={`section scroll-mt-14 grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] ${className}`}
      >
        <div className="lg:sticky lg:top-24 lg:self-start">
          {heading}
          {action && <div className="mt-5">{action}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className={`section scroll-mt-14 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        {heading}
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A plain list with small dashes, for requirements, assumptions and the like. */
export function DashList({ items, muted = false }: { items: readonly ReactNode[]; muted?: boolean }) {
  return (
    <ul className={`space-y-2 text-[0.9375rem] leading-relaxed ${muted ? "text-ink-2" : ""}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[0.7rem] h-px w-2.5 shrink-0 bg-ink-3" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
