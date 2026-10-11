import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const PATH = "/system-design-interview/scorecard";
const PDF_PATH = "/downloads/system-design-interview-scorecard.pdf";
const TITLE = "System Design Interview Scorecard Template";
const DESCRIPTION =
  "Free printable system design interview scorecard. Rate six skills from 0 to 2, record evidence from a mock, and choose one focused practice drill.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const SKILLS = [
  ["Trace", "Follow a request, event, or state change across the system."],
  ["Explain", "Describe how a mechanism works, beyond naming a tool."],
  ["Defend", "Compare an alternative and state the cost of your choice."],
  ["Change", "Adapt when traffic or a requirement shifts."],
  ["Break", "Predict a concrete failure and explain detection and recovery."],
  ["Implement", "Connect a guarantee to the API, data model, or code that enforces it."],
] as const;

const DRILLS = [
  ["Trace", "Draw one read and one write path. Name each boundary and the state it changes."],
  ["Explain", "Explain one mechanism without naming a vendor. Say what state it keeps and how it handles retries or failure."],
  ["Defend", "Compare two plausible designs. Choose one for a stated requirement and name the cost you accept."],
  ["Change", "Multiply traffic by ten or add a requirement. Change only the parts the new constraint affects."],
  ["Break", "Stop a worker, duplicate a message, or time out a request. Explain detection, recovery, and user-visible behavior."],
  ["Implement", "Write the API or state transition that enforces one guarantee. Include the condition that makes retries safe."],
] as const;

export default function SystemDesignScorecardPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([
                { name: "System design mock interview", path: "/system-design-mock-interview" },
                { name: TITLE, path: PATH },
              ]),
              {
                "@type": "WebPage",
                name: TITLE,
                description: DESCRIPTION,
                url: `${SITE_URL}${PATH}`,
                mainEntity: {
                  "@type": "DigitalDocument",
                  name: "Printable system design interview self-scorecard",
                  encodingFormat: "application/pdf",
                  contentUrl: `${SITE_URL}${PDF_PATH}`,
                  inLanguage: "en",
                  isAccessibleForFree: true,
                  publisher: { "@id": `${SITE_URL}/#organization` },
                },
              },
            ],
          }),
        }}
      />

      <PageHeader title="System design interview scorecard">
        A free self-review rubric for a timed mock interview. Score six observable skills, write down evidence from your
        answer, then use the lowest score to choose one focused drill.
      </PageHeader>

      <div className="mt-6 flex flex-wrap gap-3">
        <a className="btn btn-accent btn-lg" href={PDF_PATH} download>
          Download the printable scorecard
        </a>
        <Link href="/system-design-mock-interview" className="btn btn-secondary btn-lg">
          Start a free timed mock
        </Link>
      </div>

      <Section id="scale" title="How to score a system design mock interview">
        <div className="max-w-[72ch] space-y-3 text-[0.9375rem] leading-relaxed text-ink-2">
          <p>
            Rate each skill from 0 to 2 after the round. Give yourself 0 if you skipped it, 1 if you tried but left gaps,
            and 2 if your reasoning was clear and tied to the requirements. Record a specific moment or sentence as
            evidence instead of judging the round by how confident it felt.
          </p>
          <p>
            These six dimensions come from the SysGeeks practice exercises. This is a self-review aid, not an employer
            rubric or a prediction of a hiring decision.
          </p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="data-table min-w-[34rem]">
            <caption className="sr-only">Six skills for reviewing a system design mock interview</caption>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Evidence to look for</th>
              </tr>
            </thead>
            <tbody>
              {SKILLS.map(([skill, evidence]) => (
                <tr key={skill}>
                  <th scope="row">{skill}</th>
                  <td>{evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="next-drill" title="Choose one drill for the lowest score">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          Do one focused exercise, then repeat the same prompt with a changed requirement. That tests whether you can
          reason through the design instead of recalling the answer you just reviewed.
        </p>
        <ul className="mt-4 max-w-[72ch] divide-y divide-rule border-y border-rule">
          {DRILLS.map(([skill, drill]) => (
            <li key={skill} className="grid gap-1 py-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <strong className="text-[0.875rem] font-medium">{skill}</strong>
              <span className="text-[0.875rem] leading-relaxed text-ink-2">{drill}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/review#dimension" className="btn btn-primary">
            Practise a focused skill
          </Link>
          <Link href="/investigations" className="btn btn-secondary">
            Choose a system design question
          </Link>
        </div>
      </Section>

      <Section id="download" title="Print the scorecard or save it as a PDF">
        <p className="max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2">
          The two-page worksheet has space to record your evidence, debrief the round, and plan the next mock. It is free
          to download and does not require an account.
        </p>
        <a className="mt-4 inline-flex btn btn-accent" href={PDF_PATH} download>
          Download the free PDF scorecard
        </a>
        <p className="mt-4 text-[0.8125rem] text-ink-3">
          Published by {SITE_NAME}. Practice scores are not hiring predictions.
        </p>
      </Section>
    </article>
  );
}
