import type { Metadata } from "next";
import { AiBlock, AiLabel, StreamCaret } from "@/components/ai";
import { CostTag, CreditsChip, PriceCard } from "@/components/billing-ui";
import { Callout, EmptyState, Skeleton } from "@/components/feedback";
import { PageHeader } from "@/components/page-header";
import { SectionHeading, SignalBadge } from "@/components/ui";
import { PACKS } from "@/lib/domain/pricing";
import { PaywallDemo, StreamDemo, ToastDemo } from "./interactive";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const VARIANTS = [
  { cls: "btn-primary", label: "Primary" },
  { cls: "btn-accent", label: "Accent" },
  { cls: "btn-secondary", label: "Secondary" },
  { cls: "btn-ghost", label: "Ghost" },
  { cls: "btn-danger", label: "Danger" },
  { cls: "btn-danger-solid", label: "Danger solid" },
];

export default function DesignSystemPage() {
  return (
    <div className="space-y-14 pb-24">
      <PageHeader
        eyebrow="Internal · noindex"
        title="Design system"
        aside={<CreditsChip balance={4} allotment={40} />}
      >
        Every primitive and state of the design system. Not linked from the site.
      </PageHeader>

      <section aria-labelledby="buttons" className="space-y-5">
        <SectionHeading id="buttons">Buttons</SectionHeading>
        <div className="flex flex-wrap items-center gap-2">
          {VARIANTS.map((v) => (
            <button key={v.cls} type="button" className={`btn ${v.cls}`}>
              {v.label}
            </button>
          ))}
          <button type="button" className="btn btn-secondary" aria-pressed="true">
            Pressed
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary btn-sm">Small</button>
          <button type="button" className="btn btn-primary">Default</button>
          <button type="button" className="btn btn-primary btn-lg">Large</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" aria-busy="true">
            <span className="spinner" aria-hidden="true" />
            Saving
          </button>
          <button type="button" className="btn btn-accent">
            Draft from README <CostTag credits={1} />
          </button>
          <button type="button" className="btn btn-accent">
            Architecture review <CostTag credits={2} />
          </button>
          <button type="button" className="btn btn-secondary">Assess an answer</button>
          <button type="button" className="knob" aria-label="Copy">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M9.5 4.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v5A1.5 1.5 0 0 0 3 9.5h1.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {VARIANTS.map((v) => (
            <button key={v.cls} type="button" className={`btn ${v.cls}`} disabled>
              {v.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="badges" className="space-y-5">
        <SectionHeading id="badges">Badges and chips</SectionHeading>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">Updated 3 Oct</span>
          <span className="chip-flat">Trade-offs</span>
          <SignalBadge signal="strong" />
          <SignalBadge signal="partial" />
          <SignalBadge signal="gap" />
          <span className="badge-new">New</span>
          <span className="kicker">Kicker</span>
        </div>
      </section>

      <section aria-labelledby="callouts" className="space-y-5">
        <SectionHeading id="callouts">Callouts</SectionHeading>
        <div className="grid gap-8 md:grid-cols-2">
          <Callout tone="failure" title="Failure">
            <p>Draft failed after one retry.</p>
            <button type="button" className="btn btn-secondary btn-sm mt-2">Retry</button>
          </Callout>
          <Callout tone="scale" title="Scale">
            At ten times the traffic, the write queue becomes the bottleneck.
          </Callout>
          <Callout tone="change" title="What changed">
            The cache moved to the read path.
          </Callout>
          <Callout tone="note" title="Note">
            Numbers are estimates.
          </Callout>
          <Callout tone="ai" title="AI suggestion">
            Consider a read replica for the feed.
          </Callout>
        </div>
      </section>

      <section aria-labelledby="ai" className="space-y-5">
        <SectionHeading id="ai">AI-generated content</SectionHeading>
        <div className="flex flex-wrap items-center gap-2">
          <AiLabel kind="draft" />
          <AiLabel kind="review" />
          <AiLabel kind="assessed" />
          <AiLabel kind="suggestion" />
        </div>
        <AiBlock
          kind="draft"
          provenance="Drafted from your README · 8 Oct, 14:02 · not yet reviewed by you"
          actions={
            <>
              <button type="button" className="btn btn-secondary btn-sm">Accept</button>
              <button type="button" className="btn btn-ghost btn-sm">Edit</button>
              <button type="button" className="btn btn-ghost btn-sm">Dismiss</button>
            </>
          }
        >
          <p className="text-body">
            Split ingest from reads. Put a <span className="ai-inline">cache in front of the feed</span> and accept
            eventual consistency for follower counts.
            <StreamCaret />
          </p>
        </AiBlock>
        <div className="space-y-2">
          <span className="chip">AI-drafted · edited by you</span>
          <p className="text-body">Split ingest from reads, with a cache in front of the feed.</p>
        </div>
        <StreamDemo />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton lines={3} />
          <Skeleton className="h-24 w-full" />
        </div>
      </section>

      <section aria-labelledby="feedback" className="space-y-5">
        <SectionHeading id="feedback">Empty states and toasts</SectionHeading>
        <EmptyState
          title="No projects yet"
          action={<button type="button" className="btn btn-primary">Start from a description</button>}
          secondary={<button type="button" className="btn btn-ghost">Browse examples</button>}
        >
          Describe a system, or start from a README to get a first draft.
        </EmptyState>
        <ToastDemo />
      </section>

      <section aria-labelledby="billing" className="space-y-5">
        <SectionHeading id="billing">Paywalls, credits and pricing</SectionHeading>
        <PaywallDemo />
        <div className="grid gap-5 md:grid-cols-3">
          {PACKS.map((pack) => (
            <PriceCard
              key={pack.id}
              plan={pack.id}
              price={`$${pack.priceUsd}`}
              period="one-time, USD"
              allotment={`${pack.credits} credits`}
              description={`$${(pack.priceUsd / pack.credits).toFixed(2)} per credit.`}
              features={[`${pack.credits} credits, never expire`, "Spend them on any AI step at the cost shown"]}
              featured={pack.id === "standard"}
              band="Recommended for active prep"
              cta={
                <button
                  type="button"
                  className={`btn w-full ${pack.id === "standard" ? "btn-accent" : "btn-secondary"}`}
                >
                  Buy {pack.credits} credits
                </button>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
