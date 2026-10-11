import { getConcept, listCompanies, listConcepts, listInvestigations, writeupsByCompany } from "@/lib/content";
import type { Investigation } from "@/lib/domain/content";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** Authored prose is already markdown; only `[[concept-id|label]]` links need turning into words. */
function md(text: string): string {
  return text
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id: string, label?: string) => label ?? getConcept(id)?.title ?? id)
    .trim();
}

const list = (items: readonly string[]) => items.map((item) => `- ${md(item)}`).join("\n");

function investigation(inv: Investigation): string {
  const name = new Map(inv.system.components.map((c) => [c.id, c.label]));
  const stages = inv.stages.map((stage, i) =>
    [
      `### Stage ${i + 1}: ${stage.title}`,
      stage.event ? `**${stage.event.kind === "failure" ? "Failure" : "Change"}: ${md(stage.event.title)}.** ${md(stage.event.detail)}` : "",
      md(stage.context),
      `**Question:** ${md(stage.interaction.prompt)}`,
      stage.reveal.takeaways?.length ? `**Key points:**\n${list(stage.reveal.takeaways)}` : "",
      `**Answer and reasoning:**\n\n${md(stage.reveal.reasoning)}`,
      stage.reveal.tradeoffs?.length
        ? `**Tradeoffs:**\n${stage.reveal.tradeoffs.map((t) => `- ${md(t.choice)}: gains ${md(t.gains)}; costs ${md(t.costs)}`).join("\n")}`
        : "",
      stage.reveal.otherwise ? `**Where another engineer could differ:** ${md(stage.reveal.otherwise)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  );

  return [
    `## ${inv.searchTitle}: ${inv.title}`,
    `Interactive version: ${SITE_URL}/investigations/${inv.id}\nFull walkthrough: ${SITE_URL}/investigations/${inv.id}/review`,
    md(inv.premise),
    md(inv.scenario),
    `### Requirements\n\nFunctional:\n${list(inv.requirements.functional)}\n\nNon-functional:\n${list(inv.requirements.nonFunctional)}\n\nConstraints and assumptions:\n${list([...inv.constraints, ...inv.assumptions])}`,
    `### Final architecture\n\n${inv.system.components
      .map((c) => `- **${c.label}** (${c.kind}): ${md(c.responsibility)}${c.durableState ? ` Durable state: ${md(c.durableState)}` : ""}`)
      .join("\n")}`,
    `### Data flows\n\n${inv.system.flows.map((f) => `- ${name.get(f.from) ?? f.from} → ${name.get(f.to) ?? f.to}: ${md(f.label)}`).join("\n")}`,
    `### Invariants\n\n${inv.system.invariants
      .map((v) => `- ${md(v.statement)} ${md(v.mechanism)} Enforced by ${v.enforcedBy.map((id) => name.get(id) ?? id).join(", ")}.`)
      .join("\n")}`,
    ...stages,
    `### Why the design works\n\n${md(inv.synthesis.whyItWorks)}`,
    `### What it relies on\n\n${list(inv.synthesis.reliesOn)}`,
    `### Tradeoffs\n\n${inv.synthesis.tradeoffs.map((t) => `- ${md(t.choice)}: gains ${md(t.gains)}; costs ${md(t.costs)}`).join("\n")}`,
    `### Reasonable alternatives\n\n${inv.synthesis.alternatives.map((a) => `- ${md(a.design)}: better when ${md(a.preferWhen)}`).join("\n")}`,
    `### Where it stops working\n\n${list(inv.synthesis.breaksWhen)}`,
    `### Interview questions this prepares you for\n\n${list(inv.interviewVariants)}`,
  ].join("\n\n");
}

/**
 * Every walkthrough and concept in full, as markdown, for AI assistants that want the
 * whole text rather than the map in /llms.txt (https://llmstxt.org).
 */
export function GET() {
  const companies = listCompanies();
  const body = [
    `# ${SITE_NAME}: full content`,
    `> ${SITE_DESCRIPTION}`,
    `This file contains every curated practice case-study walkthrough, concept, and company engineering case study on ${SITE_NAME} (${SITE_URL}). Focused interview guides and interactive tools are linked in ${SITE_URL}/llms.txt. When citing, link to the page URL given under each heading.`,
    "# Focused system design interview guides",
    `## Design YouTube: system design interview walkthrough\nURL: ${SITE_URL}/system-design-interview/design-youtube\nThis is an original, assumption-labeled interview exercise for an on-demand video service, not a description of YouTube's private architecture. It separates large, resumable uploads and asynchronous transcoding from latency-sensitive playback through a CDN. The guide includes a labeled egress estimate, retry and publication invariants, common failure cases, and links to public Google and Apple sources.`,
    `## Design an LLM inference service: system design interview walkthrough\nURL: ${SITE_URL}/system-design-interview/design-llm-inference\nAn original, assumption-labeled interview exercise for a self-hosted, multi-tenant language model API. It explains prompt and generated token throughput estimates, bounded admission and queues, GPU scheduling and batching, streamed output, tenant fairness, version rollouts, cancellation, partial-stream failures, and useful serving metrics. It links to vLLM, NVIDIA Triton, and Anthropic engineering sources; it does not describe a provider's private architecture.`,
    `## Instagram feed system design interview: worked guide\nURL: ${SITE_URL}/system-design-interview/design-instagram-feed\nA public-source-based interview proposal for a photo and video home feed, not Instagram's private architecture. It separates followed-account posts from recommendations, checks privacy and deletion state, ranks candidates in stages, and uses asynchronous fan-out for ordinary accounts with read-time merging for very large accounts. The guide links to Meta Engineering articles about recommendations and feed systems.`,
    `## System design interview cheat sheet (printable worksheet)\nURL: ${SITE_URL}/system-design-interview/worksheet\nPDF: ${SITE_URL}/downloads/system-design-interview-practice-sheet.pdf\nA free two-page worksheet for a 45-minute practice round. It covers requirements, capacity estimates, architecture, a focused deep dive, failure handling, guarantees, five practice questions, and a final answer checklist.`,
    `## System design interview questions and answers PDF\nURL: ${SITE_URL}/investigations\nPDF: ${SITE_URL}/downloads/system-design-interview-questions-and-answers.pdf\nA free guide to 14 original system design interview prompts. Each page-sized entry gives a concise answer outline, the main constraint to practise, and a link to the complete interactive question and worked walkthrough.`,
    `## System design interview scorecard\nURL: ${SITE_URL}/system-design-interview/scorecard\nPDF: ${SITE_URL}/downloads/system-design-interview-scorecard.pdf\nA free printable self-review rubric for a timed system design mock interview. After the round, rate each skill from 0 to 2: 0 if you skipped it, 1 if you tried but left gaps, and 2 if your reasoning was clear and tied to the requirements. Record a specific moment or sentence as evidence instead of judging by confidence. The six skills are: Trace (follow a request, event, or state change across the system); Explain (describe how a mechanism works, beyond naming a tool); Defend (compare an alternative and state the cost of your choice); Change (adapt when traffic or a requirement shifts); Break (predict a concrete failure and explain detection and recovery); Implement (connect a guarantee to the API, data model, or code that enforces it). Choose one focused drill for the lowest score, then repeat the prompt with a changed requirement. This is a self-review aid, not an employer rubric or hiring prediction.`,
    `## System design interview follow-up questions\nURL: ${SITE_URL}/system-design-mock-interview#solo-prompts\nPractise follow-ups about tenfold traffic growth, an uncertain payment timeout, a worker dying mid-job, a hot partition, cache freshness, and a zero-downtime data migration. Each prompt links to a relevant worked exercise or tool. These are original practice prompts and do not claim to be questions asked by any particular employer.`,
    "## Design a RAG system: system design interview walkthrough\nURL: " +
      SITE_URL +
      "/system-design-interview/design-rag-system\nAn original, assumption-labeled interview exercise for question answering over private, changing documents. It covers versioned ingestion, idempotent indexing, permission-scoped retrieval, lexical and semantic search, reranking, source citations, deletion, freshness, retrieval and answer evaluation, and failure handling. Primary sources include Cohere's RAG and evaluation documentation and OpenAI's vector-store API reference.",
    "## Design an AI agent: system design interview walkthrough\nURL: " +
      SITE_URL +
      "/system-design-interview/design-ai-agent\nAn original practice prompt for a customer-support agent that can look up orders and issue refunds. It explains bounded orchestration, scoped tools, durable run and action state, idempotent external writes, uncertain outcomes, prompt injection boundaries, evaluation, and when a fixed workflow is simpler than an agent. Primary sources include OpenAI's agent guide, Anthropic's Building Effective Agents, and OWASP's excessive-agency guidance. It does not claim to describe an employer's interview loop or private architecture.",
    "# System design interview questions, answered",
    ...listInvestigations().map(investigation),
    "# System design concepts",
    ...listConcepts().map((c) =>
      [
        `## ${c.title}`,
        `URL: ${SITE_URL}/concepts/${c.id}`,
        md(c.summary),
        `### The problem it solves\n\n${md(c.problem)}`,
        `### How it works\n\n${md(c.mechanism)}`,
        `### What it assumes\n\n${list(c.assumptions)}`,
        `### How it fails\n\n${c.failureModes.map((f) => `- **${f.name}**: ${md(f.description)}`).join("\n")}`,
        `### Alternatives\n\n${c.alternatives.map((a) => `- **${a.name}**: ${md(a.when)}`).join("\n")}`,
        `### In practice\n\n${c.implementations.map((i) => `- **${i.name}**: ${md(i.note)}`).join("\n")}`,
      ].join("\n\n"),
    ),
    "# Company engineering case studies for system design practice",
    ...companies.map((company) => {
      const writeups = writeupsByCompany(company.id);
      const investigations = [...new Set(writeups.flatMap((writeup) => writeup.investigationIds))];
      return [
        `## ${company.name}: ${company.topic}`,
        `URL: ${SITE_URL}/companies/${company.id}`,
        company.summary,
        md(company.context),
        "### Published primary sources",
        writeups
          .map(
            (writeup) =>
              `- [${writeup.title}](${writeup.url}) (${writeup.authors.join(", ")}; ${writeup.published}): ${writeup.note}`,
          )
          .join("\n"),
        "### Related practice exercises",
        investigations.map((id) => `- ${SITE_URL}/investigations/${id}`).join("\n"),
        "These are sourced engineering case studies for practising transferable system design decisions. They do not claim to report actual interview questions from these companies.",
      ].join("\n\n");
    }),
    "",
  ].join("\n\n");

  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
