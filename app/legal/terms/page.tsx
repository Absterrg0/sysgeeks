import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of use",
  description: `The terms for using ${SITE_NAME}: free practice, optional AI features, credit packs, and what is not promised.`,
  path: "/legal/terms",
});

export default function TermsPage() {
  return (
    <article className="measure">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              breadcrumbs([{ name: "Terms of use", path: "/legal/terms" }]),
              { "@type": "WebPage", name: "Terms of use", url: `${SITE_URL}/legal/terms` },
            ],
          }),
        }}
      />
      <PageHeader title="Terms of use">
        What you agree to when you use {SITE_NAME}: the free practice, the optional AI features and the credit packs.
        <br />
        <mark className="bg-highlight px-1">TODO(owner): draft for review by counsel before launch.</mark>
      </PageHeader>

      <Section id="about" title="About this service">
        <div className="prose max-w-[66ch]">
          <p>
            {SITE_NAME} is operated by <mark className="bg-highlight px-1">TODO(owner): legal entity name</mark>. The
            practice content is free. Signed-in users can also use AI features and buy credit packs. Support is at{" "}
            <mark className="bg-highlight px-1">TODO(owner): support email</mark>.
          </p>
        </div>
      </Section>

      <Section id="accounts" title="Accounts">
        <div className="prose max-w-[66ch]">
          <p>
            You sign in through Clerk. You are responsible for keeping your sign-in secure. Welcome credits are granted
            once, after you verify your email address.
          </p>
        </div>
      </Section>

      <Section id="credits" title="Credits and payments">
        <div className="prose max-w-[66ch]">
          <p>
            Credits are bought in one-time packs and never expire. Prices are in US dollars. Payments are taken by Dodo
            Payments, which acts as merchant of record and handles sales tax. There are no subscriptions and no automatic
            charges. Refunds follow the{" "}
            <Link href="/legal/refunds" className="link">
              refunds policy
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section id="ai" title="AI output">
        <div className="prose max-w-[66ch]">
          <p>
            AI features produce drafts, reviews and assessments, and they can be wrong. Every AI output is labelled, and
            the{" "}
            <Link href="/ai" className="link">
              AI page
            </Link>{" "}
            explains what is sent and which models run. Treat AI output as a second opinion and check it yourself. Do not
            rely on it as the only basis for a hiring decision or a production architecture decision.
          </p>
        </div>
      </Section>

      <Section id="content" title="Your content and ours">
        <div className="prose max-w-[66ch]">
          <p>
            You keep ownership of the answers, projects and repository files you give us. You allow us to process them to
            run the feature you asked for and to store its output under your account. Repository file contents are not
            stored after the run.
          </p>
          <p>
            Lessons, investigations and concepts are our own writing. Company writeups belong to their authors, and we
            link to the originals and credit the authors. <mark className="bg-highlight px-1">TODO(owner): licence for
            reuse of our content.</mark>
          </p>
        </div>
      </Section>

      <Section id="use" title="Acceptable use">
        <div className="prose max-w-[66ch]">
          <p>
            Do not run automated scripts against the AI features, try to get around daily limits, share an account to
            pool credits, or upload content you have no right to share.
          </p>
        </div>
      </Section>

      <Section id="liability" title="Warranties and liability">
        <div className="prose max-w-[66ch]">
          <p>
            The service is provided as it is. <mark className="bg-highlight px-1">TODO(owner): warranty disclaimer and
            limitation of liability, to be drafted by counsel.</mark>
          </p>
        </div>
      </Section>

      <Section id="law" title="Governing law and changes">
        <div className="prose max-w-[66ch]">
          <p>
            <mark className="bg-highlight px-1">TODO(owner): governing law and venue.</mark> We may update these terms.
            The version on this page is the current one.
          </p>
        </div>
      </Section>
    </article>
  );
}
