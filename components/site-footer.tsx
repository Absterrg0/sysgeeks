import Link from "next/link";
import { ABOUT, COMPANIES, LEARN, LEGAL, PRICING, YOURS } from "@/components/nav-items";
import { Brand } from "@/components/site-nav";
import { SITE_REPO_URL } from "@/lib/site";

export function SiteFooter() {
  const column = (title: string, items: typeof LEARN) => (
    <div>
      <p className="kicker">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[0.8125rem]">
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
    <footer className="mt-16 border-t border-rule">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] lg:gap-16">
        <div className="max-w-xs sm:col-span-2 lg:col-span-1">
          <Brand />
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-2">
            System design practice that asks why, what breaks, and what changes at ten times the load.
          </p>
          <p className="mt-4 text-micro text-ink-3">
            Lessons, investigations and keys are written and checked by people. Anything an AI wrote or assessed is
            labelled as such.
          </p>
        </div>
        {column("Learn", LEARN)}
        {column("Yours", YOURS)}
        {column("Product", [PRICING, ...ABOUT])}
        {column("Company", [COMPANIES, ...LEGAL])}
      </div>
      <div className="shell">
        <div className="flex flex-wrap justify-between gap-2 border-t border-rule py-5 text-micro text-ink-3">
          <p>
            © {new Date().getFullYear()} sysgeeks ·{" "}
            <a href={SITE_REPO_URL} className="transition-colors hover:text-ink">
              Source on GitHub
            </a>
          </p>
          <p>Light and dark follow your system setting.</p>
        </div>
      </div>
    </footer>
  );
}
