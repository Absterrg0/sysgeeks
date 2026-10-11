"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

export function ContentUsefulness() {
  const [response, setResponse] = useState<boolean | null>(null);

  function respond(helpful: boolean) {
    setResponse(helpful);
    track("content_feedback", { helpful });
  }

  return (
    <section aria-label="Feedback on this guide" className="mt-8 border-t border-rule pt-5">
      {response === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.875rem] font-medium">Was this useful for your system design interview prep?</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => respond(true)}>
              Yes
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => respond(false)}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <p role="status" className="text-[0.875rem] text-ink-3">
          Thanks. Your response helps us improve this guide.
        </p>
      )}
    </section>
  );
}
