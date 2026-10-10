import { InlineText } from "@/components/prose-core";
import type { StageEvent } from "@/lib/domain/content";

const EVENT_STYLE: Record<StageEvent["kind"], { label: string; callout: string }> = {
  failure: { label: "Failure", callout: "callout-failure" },
  "requirement-change": { label: "Requirement change", callout: "callout-change" },
  scale: { label: "Scale change", callout: "callout-scale" },
};

/** Something just happened to the system: a note pinned to the design, ruled in the colour of what happened. */
export function EventBanner({ event }: { event: StageEvent }) {
  const style = EVENT_STYLE[event.kind];
  return (
    <aside aria-label={style.label} className={`callout ${style.callout}`}>
      <p className="callout-title">{style.label}</p>
      <p className="mt-1 font-display text-[1.25rem] leading-snug">
        <InlineText text={event.title} />
      </p>
      <p className="mt-2 max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
        <InlineText text={event.detail} />
      </p>
    </aside>
  );
}
