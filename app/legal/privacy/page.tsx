import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: `What ${SITE_NAME} stores (very little), what your browser sends to the AI provider you choose, who processes data for us, and how to delete it.`,
  path: "/legal/privacy",
  noindex: true,
});

export default function PrivacyPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: "Privacy policy", path: "/legal/privacy" }]),
              { "@type": "WebPage", name: "Privacy policy", url: `${SITE_URL}/legal/privacy` },
            ],
          }),
        }}
      />
      <PageHeader title="Privacy policy">
        What is stored, what your browser sends to the AI provider you choose, who processes data for us, and how to
        delete it.
        <br />
        <mark className="bg-highlight px-1">TODO(owner): draft for review by counsel before launch.</mark>
      </PageHeader>

      <Section id="who" title="Who we are">
        <div className="prose max-w-[66ch]">
          <p>
            The controller of your data is <mark className="bg-highlight px-1">TODO(owner): legal entity name</mark>.
            Privacy questions go to <mark className="bg-highlight px-1">TODO(owner): support email</mark>.
          </p>
        </div>
      </Section>

      <Section id="collect" title="What we store">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              <strong>No account.</strong> There are no accounts and no sign-in. {SITE_NAME} does not ask for your name or
              email address, and sells nothing, so it holds no payment details.
            </li>
            <li>
              <strong>Learner state, in your browser.</strong> Your answers, progress, projects, tailored questions and
              the output of your AI runs are stored in your browser&rsquo;s local storage. They are not sent to us.
            </li>
            <li>
              <strong>Your AI key, in your browser.</strong> If you add an API key, it is stored in your browser&rsquo;s
              local storage, or in session storage if you choose &ldquo;This tab only&rdquo;, apart from your learner
              state. It is never sent to us.
            </li>
            <li>
              <strong>Analytics.</strong> If configured, PostHog records anonymous page views on public pages, along
              with page URL and route, referrer and browser summaries. It excludes saved reports, interview sessions and
              private project URLs. The site sends these explicit events to
              PostHog: practice_entry_clicked, practice_started, walkthrough_opened, resource_download_clicked, share,
              answer_submitted,
              design_round_saved, mock_interview_started, mock_interview_completed, llm_capacity_estimator_used,
              ai_key_saved and content_feedback.
              The practice_entry_clicked event records the public practice entry point and its source label; exercise
              links also include the selected exercise ID.
              The walkthrough_opened event records the public walkthrough slug and whether its title or exercise link
              was selected.
              The practice_started event records the exercise, whether someone started or continued it, and the
              short label for the start control. The content_feedback event records only a yes/no response and public
              page route, not written feedback. The calculator event records that the tool was used, not values
              entered. The ai_key_saved event records which provider was chosen and whether the key is kept for the
              browser or the tab, never the key or the model. The resource_download_clicked event records a fixed label for the public PDF link selected, not
              file contents. Events include only the event name and limited context such as public route, exercise,
              interview length, focus and question count; answer text and private project content are not sent. PostHog uses
              session storage for an anonymous identifier that lasts for the browser tab session. Autocapture and
              session recordings are disabled, and the site does not identify visitors. PostHog
              may process an IP address, referrer and browser/device details; its project settings can be configured
              to discard IP addresses. The site also sends PostHog a request event when a public page is requested
              with a user-agent string matching a known search or AI crawler. That event contains the public path,
              hostname, request method, user-agent string and a derived crawler name/category; it omits query strings,
              referrer, the crawler&apos;s IP
              address and cookies, and is configured not to create a person profile or GeoIP data.
              User-agent matching is a heuristic and can be spoofed.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="processors" title="Who processes data for us">
        <div className="prose max-w-[66ch]">
          <ul>
            <li>
              <strong>Cloudflare</strong> for hosting, caching and blocking abusive automated traffic.
            </li>
            <li>
              <strong>PostHog</strong> for anonymous product analytics, only when a project key is configured.
            </li>
          </ul>
          <p>
            Read{" "}
            <a href="https://posthog.com/docs/privacy" target="_blank" rel="noopener noreferrer" className="link">
              PostHog privacy controls
            </a>{" "}
            for details about how these providers handle data.
          </p>
        </div>
      </Section>

      <Section id="providers" title="AI providers you choose">
        <div className="prose max-w-[66ch]">
          <p>
            AI features are optional and run on your own API key. When you run one, your browser sends the input it
            needs straight to the provider you chose (Anthropic, OpenAI, Google or OpenRouter), and, for a draft from a
            public repository, reads the files from GitHub first. These requests do not pass through {SITE_NAME}, so we
            do not receive or keep your key, your inputs or the replies. Your provider is not our processor: you use it
            under your own agreement with it, and its terms, data retention and training settings apply. The{" "}
            <Link href="/ai" className="link">
              AI page
            </Link>{" "}
            lists what each feature sends.
          </p>
        </div>
      </Section>

      <Section id="retention" title="How long we keep data">
        <div className="prose max-w-[66ch]">
          <p>
            {SITE_NAME} keeps no learner data on its servers. What your browser stores stays until you delete it.
            Analytics events are kept by PostHog.{" "}
            <mark className="bg-highlight px-1">TODO(owner): state the PostHog retention period.</mark>
          </p>
        </div>
      </Section>

      <Section id="choices" title="Your choices">
        <div className="prose max-w-[66ch]">
          <p>
            You can export your learner data as a JSON file, and import it again, from{" "}
            <Link href="/review#data" className="link">
              your progress
            </Link>
            , and delete AI runs there one at a time. Clearing this site&rsquo;s data in your browser deletes all of it.
            The key settings in the header remove your API key. To ask about anything else, email{" "}
            <mark className="bg-highlight px-1">TODO(owner): support email</mark>.
          </p>
          <p>
            <mark className="bg-highlight px-1">TODO(owner): describe the rights that apply to you in your jurisdiction,
            for example under the GDPR or UK GDPR, and how to use them.</mark>
          </p>
        </div>
      </Section>

      <Section id="changes" title="Changes">
        <div className="prose max-w-[66ch]">
          <p>We will update this page when the way we process data changes.</p>
        </div>
      </Section>
    </article>
  );
}
