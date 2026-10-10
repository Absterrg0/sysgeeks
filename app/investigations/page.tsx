import type { Metadata } from "next";
import Link from "next/link";
import { InvestigationIndex } from "@/components/investigation/investigation-index";
import { PageHeader } from "@/components/page-header";
import { listInvestigations } from "@/lib/content";
import { itemList, jsonLd, pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "System Design Interview Questions",
  description:
    "Classic system design interview questions, worked step by step: URL shortener, rate limiter, news feed, chat, payments, job queue, distributed cache and more.",
  path: "/investigations",
});

export default function InvestigationsPage() {
  const investigations = listInvestigations();
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            itemList(
              "System design interview questions",
              investigations.map((inv) => ({ name: inv.searchTitle, path: `/investigations/${inv.id}` })),
            ),
          ),
        }}
      />
      <PageHeader title="System design interview questions">
        Each one is a system you design from its requirements: decide, explain why, see the consequences, break it,
        change the constraints, and defend what is left. New to the format? Start with{" "}
        <Link href="/system-design-interview" className="link">
          how the interview works
        </Link>
        .
      </PageHeader>
      <section aria-label="All investigations" className="pt-8 pb-10">
        <InvestigationIndex investigations={investigations} grouped />
      </section>
      <section aria-labelledby="youtube-walkthrough" className="max-w-[66ch] border-t border-rule py-8">
        <h2 id="youtube-walkthrough" className="font-display text-[1.25rem] leading-tight">
          Design YouTube: a video streaming system design answer
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Work through the upload path, transcoding pipeline, adaptive playback, CDN caching and failure cases in a
          separate interview walkthrough.
        </p>
        <Link href="/system-design-interview/design-youtube" className="mt-3 inline-block text-[0.875rem] font-medium text-accent hover:underline">
          Read the YouTube system design walkthrough →
        </Link>
      </section>
    </div>
  );
}
