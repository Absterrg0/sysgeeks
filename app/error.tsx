"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-[44rem] pt-14 pb-10 sm:pt-20">
      <p className="flex items-center gap-2 font-mono text-[0.75rem] text-signal-gap">
        <span className="led led-gap" aria-hidden="true" />
        something went wrong
      </p>
      <h1 className="mt-4 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
        This page failed to load.
      </h1>
      <p className="mt-4 max-w-[48ch] text-[1rem] leading-relaxed text-ink-2">
        Your progress is stored in this browser and is unaffected. Try again, or go back to the systems.
      </p>
      {error.digest && <p className="mt-3 font-mono text-[0.75rem] text-ink-3">Reference: {error.digest}</p>}
      <div className="mt-7 flex flex-wrap gap-2.5">
        <button type="button" className="btn btn-accent" onClick={reset}>
          Try again
        </button>
        <Link href="/investigations" className="btn btn-secondary">
          Systems
        </Link>
      </div>
    </div>
  );
}
