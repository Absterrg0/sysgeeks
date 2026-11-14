import type { Metadata } from "next";
import Link from "next/link";
import { DotArrow } from "@/components/icons";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { listInvestigations, writeupsByCompany } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { missionsFor } from "@/lib/content/scenarios";
import { breadcrumbs, itemList, jsonLd, pageMetadata } from "@/lib/metadata";

const PATH = "/system-design-playground";
const TITLE = "System Design Interview Simulator: Postgres Sharding";
const DESCRIPTION =
  `Try ${Object.keys(PLAYGROUNDS).length} free system design simulations, including Postgres sharding based on Notion's published migration. Test shard placement, capacity, and failures. No signup.`;

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function SystemDesignPlaygroundPage() {
  const notionWriteups = writeupsByCompany("notion");
  const playgrounds = listInvestigations().flatMap((investigation) => {
    const workload = PLAYGROUNDS[investigation.id];
    return workload ? [{ investigation, workload }] : [];
  });

  return (
    <article className="pt-10 pb-6 sm:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview questions", path: "/investigations" },
                { name: "Free system design interview simulator", path: PATH },
              ]),
              itemList(
                "Free system design interview simulator",
                playgrounds.map(({ investigation }) => ({
                  name: investigation.searchTitle,
                  path: `/investigations/${investigation.id}/playground`,
                })),
              ),
            ],
          }),
        }}
      />

      <header className="max-w-3xl">
        <p className="font-mono text-[0.75rem] text-ink-3">{playgrounds.length} simulations · runs in your browser · no account</p>
        <h1 className="mt-4 text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          System design playground.
          <span className="block text-ink-3">Change it, load it, break it.</span>
        </h1>
        <p className="mt-4 max-w-[58ch] text-[1.0625rem] leading-relaxed text-ink-2 text-pretty">
          Pick a system, then add caches and replicas, turn up traffic or kill a part, and see what fails.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <PracticeEntryLink
            href="/investigations/url-shortener/playground"
            investigationId="url-shortener"
            source="playground_landing_hero"
            className="btn btn-accent btn-lg group"
          >
            Start with a URL shortener
            <DotArrow />
          </PracticeEntryLink>
        </div>
      </header>

      <section aria-labelledby="choose-a-playground" className="mt-14">
        <h2 id="choose-a-playground" className="sr-only">
          Choose a system to explore
        </h2>
        <ol className="sheet grid overflow-hidden md:grid-cols-2">
          {playgrounds.map(({ investigation, workload }) => (
            <li
              key={investigation.id}
              className="min-w-0 border-t border-rule-soft first:border-t-0 md:[&:nth-child(2)]:border-t-0 md:odd:border-r"
            >
              <PracticeEntryLink
                href={`/investigations/${investigation.id}/playground`}
                investigationId={investigation.id}
                source="playground_catalog"
                className="group flex h-full items-center gap-4 px-4 py-3.5 transition-colors hover:bg-hover sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium">{investigation.title}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-2">{workload.note}</span>
                  <span className="mt-1 block font-mono text-[0.75rem] text-ink-3">
                    {DIFFICULTY[investigation.difficulty].toLowerCase()} · {missionsFor(investigation.id).length} missions
                  </span>
                </span>
                <span className="shrink-0 text-[0.8125rem] font-medium text-ink-3 transition-colors group-hover:text-ink">
                  Open
                  <span aria-hidden="true" className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </PracticeEntryLink>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-16 grid gap-12 border-t border-rule pt-10 md:grid-cols-2 md:gap-16">
        <section aria-labelledby="postgres-sharding">
          <h2 id="postgres-sharding" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            How do you shard a live Postgres database?
          </h2>
          <div className="mt-3 space-y-3 text-[0.875rem] leading-relaxed text-ink-2">
            <p>
              Pick a shard key that keeps common reads and joins together. Notion chose workspace ID and mapped 480
              logical shards across database hosts, so later growth could move whole shards without re-hashing rows. A
              later expansion used replication to add hosts without downtime.
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
              <Link href="/investigations/shard-live-database/playground" className="link">
                Sharding simulator
              </Link>
              <Link href="/investigations/shard-live-database" className="link">
                Interview exercise
              </Link>
              <Link href="/investigations/shard-live-database/review" className="link">
                Full walkthrough
              </Link>
              <Link href="/companies/notion" className="link">
                Notion case study
              </Link>
            </p>
            {notionWriteups.map((writeup) => (
              <p key={writeup.id} className="text-[0.8125rem] text-ink-3">
                Primary source:{" "}
                <a className="link" href={writeup.url} target="_blank" rel="noopener noreferrer">
                  {writeup.title}
                </a>
              </p>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-the-simulations-work">
          <h2 id="how-the-simulations-work" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            How the simulator works
          </h2>
          <div className="mt-3 space-y-3 text-[0.875rem] leading-relaxed text-ink-2">
            <p>
              Each playground starts with a reference architecture and an explicit workload. Change a component&apos;s
              role or capacity, put a cache in front of it, or take it down, then raise traffic and compare what fails
              and how much work backs up.
            </p>
            <p>
              The workloads are interview scenarios, not production capacity estimates. For the full exercise, start from
              a system&apos;s{" "}
              <Link href="/investigations" className="link">
                design question
              </Link>
              , read the{" "}
              <Link href="/system-design-interview" className="link">
                interview guide
              </Link>
              , or rehearse a{" "}
              <Link href="/system-design-mock-interview" className="link">
                timed mock interview
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
