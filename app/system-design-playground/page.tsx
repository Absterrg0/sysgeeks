import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { listInvestigations } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { breadcrumbs, itemList, jsonLd, pageMetadata } from "@/lib/metadata";

const PATH = "/system-design-playground";
const TITLE = "Interactive System Design Playgrounds";
const DESCRIPTION =
  "Explore interactive system design simulations for a URL shortener, rate limiter, news feed, payment system, and more. Change components and traffic, then see where the design breaks. Free, no signup.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

export default function SystemDesignPlaygroundPage() {
  const playgrounds = listInvestigations().flatMap((investigation) => {
    const workload = PLAYGROUNDS[investigation.id];
    return workload ? [{ investigation, workload }] : [];
  });

  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design interview questions", path: "/investigations" },
                { name: "Interactive system design playgrounds", path: PATH },
              ]),
              itemList(
                "Interactive system design playgrounds",
                playgrounds.map(({ investigation }) => ({
                  name: investigation.searchTitle,
                  path: `/investigations/${investigation.id}/playground`,
                })),
              ),
            ],
          }),
        }}
      />

      <PageHeader
        title="Interactive system design playgrounds"
        meta={`${playgrounds.length} simulations · Free · No account needed`}
        actions={
          <Link href="/investigations" className="btn btn-secondary">
            Browse all system design questions
          </Link>
        }
      >
        Change an architecture and see how the system responds. Add or remove components, turn traffic up, and inspect
        requests failing, backlog growing, and the instances needed to keep up. Each playground is a hands-on system
        design simulation; you can compare your changes with its reference design.
      </PageHeader>

      <Section
        id="choose-a-playground"
        title="Choose a system to explore"
        description="Start with a system you know, then test a change that could expose its bottleneck or failure mode."
      >
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playgrounds.map(({ investigation, workload }) => (
            <li key={investigation.id} className="min-w-0">
              <article className="sheet flex h-full flex-col p-4 sm:p-5">
                <p className="kicker">
                  {investigation.difficulty} · {investigation.estimatedMinutes} min
                </p>
                <h3 className="mt-2 text-[1rem] font-medium leading-snug">
                  <Link
                    href={`/investigations/${investigation.id}/playground`}
                    className="transition-colors hover:text-accent"
                  >
                    {investigation.searchTitle}
                  </Link>
                </h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{investigation.premise}</p>
                <div className="mt-4 border-t border-rule-soft pt-3">
                  <p className="text-[0.75rem] font-medium">Scenario</p>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{workload.note}</p>
                  <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-3">
                    Models: {workload.operations.map((operation) => operation.label).join(", ")}.
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-[0.8125rem] font-medium">
                  <Link href={`/investigations/${investigation.id}/playground`} className="text-accent hover:underline">
                    Open playground →
                  </Link>
                  <Link href={`/investigations/${investigation.id}`} className="text-ink-3 hover:text-ink">
                    Interview question
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="how-the-simulations-work" title="How the simulations work">
        <div className="prose max-w-[72ch]">
          <p>
            Each playground starts with a reference architecture and an explicit workload. Select a component to change
            its role or capacity, put a cache or another component in front of it, or simulate it going down. Then raise
            traffic and compare what fails, how much work backs up, and how the changed design compares with the
            reference.
          </p>
          <p>
            The workloads are interview scenarios, and some inputs are marked as assumptions. Use the results to reason
            about tradeoffs, not as production capacity estimates. The simulations run in your browser, and you can
            explore them without an account.
          </p>
          <p>
            For the full interview exercise, start from a system&apos;s{" "}
            <Link href="/investigations" className="link">
              design question
            </Link>
            , make decisions before reading the answer, and use the playground to test the architecture afterward. Read
            the 45-minute guide from SysGeeks as well.
          </p>
        </div>
      </Section>
    </article>
  );
}
