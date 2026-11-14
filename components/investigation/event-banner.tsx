import { InlineText } from "@/components/prose-core";
import type { StageEvent } from "@/lib/domain/content";

const EVENT_STYLE: Record<StageEvent["kind"], { label: string; led: string; text: string; ring: string }> = {
  failure: {
    label: "Failure",
    led: "led-gap led-pulse",
    text: "text-signal-gap",
    ring: "shadow-[0_0_0_1px_color-mix(in_srgb,var(--mark-gap)_30%,transparent),0_1px_2px_var(--drop-1),0_10px_28px_-16px_var(--drop-2)]",
  },
  "requirement-change": {
    label: "Requirement change",
    led: "led-accent",
    text: "text-ember",
    ring: "shadow-[var(--shadow-card)]",
  },
  scale: {
    label: "Scale change",
    led: "led-partial",
    text: "text-signal-partial",
    ring: "shadow-[0_0_0_1px_color-mix(in_srgb,var(--mark-partial)_30%,transparent),0_1px_2px_var(--drop-1),0_10px_28px_-16px_var(--drop-2)]",
  },
};

/** Something just happened to the system: one sheet, its edge tinted the colour of what happened. */
export function EventBanner({ event }: { event: StageEvent }) {
  const style = EVENT_STYLE[event.kind];
  return (
    <aside aria-label={style.label} className={`rounded-[14px] bg-raised px-5 py-4 sm:px-6 sm:py-5 ${style.ring}`}>
      <p className={`flex items-center gap-2 text-[0.75rem] font-medium ${style.text}`}>
        <span className={`led ${style.led}`} aria-hidden="true" />
        {style.label}
      </p>
      <p className="mt-2 text-[1.125rem] leading-snug font-semibold tracking-[-0.02em]">
        <InlineText text={event.title} />
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2">
        <InlineText text={event.detail} />
      </p>
    </aside>
  );
}
