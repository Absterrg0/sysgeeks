import Link from "next/link";
import { ABOUT, COMPANIES, LEARN, LEGAL, YOURS } from "@/components/nav-items";
import { Brand } from "@/components/site-nav";
import { SITE_REPO_URL } from "@/lib/site";

export function SiteFooter() {
  const column = (title: string, items: typeof LEARN) => (
    <div>
      <p className="kicker">{title}</p>
      <ul className="mt-3 space-y-2 text-[0.8125rem]">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} prefetch={false} className="text-ink-2 transition-colors hover:text-ink">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="mt-24 border-t border-rule">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] lg:gap-14">
        <div className="max-w-xs sm:col-span-2 lg:col-span-1">
          <Brand />
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">
            System design practice that asks why, what breaks, and what changes at ten times the load.
          </p>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">
            Content is published under the SysGeeks name. Guides that use AI assistance say so and note whether a person
            has independently reviewed them.{" "}
            <Link href="/ai" className="link">
              How we use AI
            </Link>
          </p>
        </div>
        {column("Learn", LEARN)}
        {column("Yours", YOURS)}
        {column("Product", ABOUT)}
        {column("Company", [COMPANIES, ...LEGAL])}
      </div>
      <div className="shell">
        <div className="flex flex-wrap justify-between gap-2 border-t border-rule py-5 text-[0.75rem] text-ink-3">
          <p>
            © {new Date().getFullYear()} SysGeeks ·{" "}
            <a href={SITE_REPO_URL} className="transition-colors hover:text-ink">
              Source on GitHub
            </a>
          </p>
          <p>Free. No account. Your progress stays in your browser.</p>
        </div>
      </div>
    </footer>
  );
}
