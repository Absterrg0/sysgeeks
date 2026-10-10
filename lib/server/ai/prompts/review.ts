import "server-only";
import type { ModelFinding } from "@/lib/domain/model-lint";
import type { ProjectModel } from "@/lib/domain/project-model";
import { INJECTION_GUARD, wrapUntrusted } from "@/lib/server/ai/untrusted";
import { catalogText } from "@/lib/server/concept-catalog";

export type ReviewPromptInput = {
  name: string;
  summary: string;
  context?: string;
  model: ProjectModel;
  lint: ModelFinding[];
};

const INSTRUCTIONS = `You are a staff engineer reviewing a colleague's design doc. The doc is a system model: components, flows and invariants. Find where the design fails under load, under failure, or under change, and say what each fix costs.

Content standard. Hold every finding and recommendation to it:
- Never use terminology without mechanism.
- Never present a design without constraints.
- Never discuss scaling without naming the bottleneck.
- Never discuss reliability without failure scenarios.

Rules:
- Every finding names at least one component id from the model in componentIds, and flow ids where they apply. Use only ids that appear in the model.
- Describe a concrete trigger in the scenario, such as "When the email provider takes 20 s…", not a general risk.
- Say what the fix costs in tradeoff.
- Generic advice ("add caching", "use microservices") is forbidden unless it names the bottleneck it moves.
- Use numbers only when the notes give scale. Otherwise say which number would decide the question.
- If information is missing, add it to questionsToAsk instead of assuming. Use assumes when a finding depends on an unstated assumption.
- Pick conceptIds only from the catalog below, and use [[id]] links in prose.
- Severity: high = data loss, double charge, or outage of the main user path; medium = degraded experience or operational toil; low = hygiene.
- Give 1 to 4 strengths, 3 to 12 findings, up to 5 suggested invariants (each with the components that enforce it and the mechanism), and up to 6 questions.
- The lint document lists deterministic checks already run on the model. Treat each one as a hint and confirm or refute it against the model.

Concept catalog (id: title. summary):
${catalogText()}

${INJECTION_GUARD}`;

function ids(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function lintText(lint: ModelFinding[]): string {
  if (lint.length === 0) return "No lint findings.";
  return lint
    .map((f) => `- ${f.severity} ${f.ruleId}: ${f.message} (components: ${ids(f.componentIds)}; flows: ${ids(f.flowIds)})`)
    .join("\n");
}

export function reviewPrompt(input: ReviewPromptInput): { instructions: string; prompt: string } {
  const notes = [
    `Name: ${input.name}`,
    `Summary: ${input.summary}`,
    `Scale and constraints: ${input.context?.trim() || "not given"}`,
  ].join("\n");
  const documents = wrapUntrusted([
    { source: "model.json", text: JSON.stringify(input.model) },
    { source: "lint.txt", text: lintText(input.lint) },
    { source: "notes.txt", text: notes },
  ]);
  return {
    instructions: INSTRUCTIONS,
    prompt: `Review the design in the <document> blocks below.\n\n${documents}`,
  };
}
