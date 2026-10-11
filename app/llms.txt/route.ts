import { listCompanies, listConcepts, listInvestigations } from "@/lib/content";
import { proseToPlainText } from "@/lib/prose";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { PLAYGROUNDS } from "@/lib/content/playground";

export const dynamic = "force-static";

/**
 * A plain-markdown map of the site for AI assistants and agents (https://llmstxt.org):
 * what SysGeeks is, and one line per system, concept and company with its URL.
 */
export function GET() {
  const investigations = listInvestigations();
  const line = (title: string, path: string, text: string) => `- [${title}](${SITE_URL}${path}): ${proseToPlainText(text)}`;

  const body = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `${SITE_NAME} is a free system design interview practice site. Each system is worked through from its requirements in stages: the learner makes a design decision and explains why, then sees the engineering reasoning, injects a failure, changes a constraint and defends the final design. There are ${investigations.length} systems, from foundational (URL shortener, rate limiter) to advanced (sharding a live database, collaborative editing). No account is needed to practise, and progress stays in the browser. Choices are checked against an authored key, and written answers are self-assessed against specific rubric points. Signed-in users can also have a written answer assessed by an AI model; those assessments are labelled as AI-assessed.`,
    "",
    "Good fit for: software engineers preparing for system design (high-level design) interviews, and anyone who wants to understand why distributed systems are built the way they are and how they fail.",
    "",
    `The complete text of every walkthrough and concept is at ${SITE_URL}/llms-full.txt.`,
    "",
    "## Start here",
    "",
    `- [How to prepare for a system design interview](${SITE_URL}/system-design-interview): What the interview tests, how to spend the 45 minutes, common mistakes, and which systems to practise.`,
    `- [Printable system design interview practice sheet](${SITE_URL}/system-design-interview/worksheet): A free two-page PDF with a 45-minute plan, sizing formulas, five questions, and a readiness checklist. Download: ${SITE_URL}/downloads/system-design-interview-practice-sheet.pdf`,
    `- [System design interview questions and answers PDF](${SITE_URL}/investigations): A free guide with 14 original question prompts, concise answer outlines, and links to complete worked walkthroughs. Download: ${SITE_URL}/downloads/system-design-interview-questions-and-answers.pdf`,
    `- [System design interview scorecard](${SITE_URL}/system-design-interview/scorecard): A free printable self-review rubric. Score six observable skills from 0 to 2, record evidence from a mock, and choose one focused drill. Download: ${SITE_URL}/downloads/system-design-interview-scorecard.pdf`,
    `- [Free system design mock interview practice](${SITE_URL}/system-design-mock-interview): Practise alone with timed 30, 45, or 60-minute sessions, six original follow-up prompts about scale, retries, worker failure, hot partitions, cache freshness and migration, a six-dimension scorecard, and a debrief after you answer. These are practice prompts, not claims about questions asked by a particular employer.`,
    `- [Interactive system design interview practice](${SITE_URL}/system-design-playground): Explore ${Object.keys(PLAYGROUNDS).length} browser-based simulations. Change components, raise traffic, and compare failures, backlog, and capacity with a reference design.`,
    `- [Design YouTube: system design interview walkthrough](${SITE_URL}/system-design-interview/design-youtube): A sourced, assumption-labeled design for video uploads, transcoding, playback, and CDN delivery.`,
    `- [Design an LLM inference service](${SITE_URL}/system-design-interview/design-llm-inference): An original interview walkthrough for token-aware capacity estimates, GPU scheduling, continuous batching, streaming, tenant fairness, and failures.`,
    `- [System design capacity estimator](${SITE_URL}/capacity-estimator): Estimate average and peak QPS, storage, and network throughput from explicit workload assumptions.`,
    `- [About ${SITE_NAME}](${SITE_URL}/about): How the exercises are built, where the material comes from, and how answers are checked.`,
    `- [How ${SITE_NAME} uses AI](${SITE_URL}/ai): Which features use AI, what is sent to model providers, which models run, how long data is kept, and how AI output is labelled.`,
    "",
    "- [Design a RAG system](" + SITE_URL + "/system-design-interview/design-rag-system): An original interview walkthrough for private-document ingestion, permission-scoped retrieval, citations, freshness, evaluation, and failure handling.",
    "",
    "- [Design an AI agent](" +
      SITE_URL +
      "/system-design-interview/design-ai-agent): An original interview walkthrough for scoped tools, safe refunds, idempotent actions, prompt injection, durable runs, and evaluation.",
    "## System design interview questions",
    "",
    ...investigations.map((inv) => line(inv.searchTitle, `/investigations/${inv.id}`, inv.premise)),
    "",
    "## System design walkthroughs",
    "",
    ...investigations.map((inv) =>
      line(
        `${inv.searchTitle}: full system design walkthrough`,
        `/investigations/${inv.id}/review`,
        "Every stage's question and answer, the reasoning and tradeoffs behind each decision, the finished architecture, its invariants, and where it stops working.",
      ),
    ),
    "",
    "## System design concepts",
    "",
    ...listConcepts().map((c) => line(c.title, `/concepts/${c.id}`, c.summary)),
    "",
    "## How real companies solved these problems",
    "",
    ...listCompanies().map((c) => line(`${c.name}: ${c.topic}`, `/companies/${c.id}`, c.summary)),
    "",
    "## Practice",
    "",
    `- [Review](${SITE_URL}/review): A timed mock interview session drawn from the systems and concepts above, answers due for review, and a claim check of common engineering statements ("adding Redis makes it faster") judged as holds, fails or depends, with the reason.`,
    "## Architecture playgrounds",
    "",
    ...investigations
      .filter((inv) => PLAYGROUNDS[inv.id])
      .map((inv) =>
        line(
          `${inv.searchTitle}: architecture playground`,
          `/investigations/${inv.id}/playground`,
          "Change the architecture, increase traffic, and test failures to see the costs and benefits of each design choice.",
        ),
      ),
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
