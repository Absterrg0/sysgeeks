import Link from "next/link";
import { DotArrow } from "@/components/icons";

const PLACES = [
  { href: "/system-design-playground", title: "Playground", body: "Change a live system, turn up the traffic, break parts." },
  { href: "/investigations", title: "Systems", body: "Real interview questions, with worked answers." },
  { href: "/system-design-mock-interview", title: "Mock interview", body: "A timed round on your own, with a debrief." },
  { href: "/concepts", title: "Concepts", body: "The mechanisms, and how they fail." },
];

export default function NotFound() {
  return (
    <div className="grid gap-x-14 gap-y-10 pt-14 pb-10 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div>
        <p className="font-mono text-[0.75rem] text-ink-3">error 404</p>
        <h1 className="mt-4 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
          Nothing at this address.
        </h1>
        <p className="mt-4 max-w-[44ch] text-[1rem] leading-relaxed text-ink-2">
          The page may have moved, or the link may be mistyped. One of these is probably what you were after.
        </p>
        <Link href="/" className="btn btn-accent group mt-7">
          Back to the start
          <DotArrow />
        </Link>
      </div>
      <ul className="sheet self-start overflow-hidden">
        {PLACES.map((p) => (
          <li key={p.href} className="sheet-row">
            <Link href={p.href} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-hover">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium tracking-[-0.01em]">{p.title}</span>
                <span className="mt-0.5 block text-[0.8125rem] text-ink-3">{p.body}</span>
              </span>
              <DotArrow className="text-ink-3 group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
