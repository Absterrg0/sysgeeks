import { listConcepts } from "@/lib/content";
import type { ConceptSummary } from "@/lib/ai/catalog";

export const dynamic = "force-static";

/**
 * The concept catalog the AI prompts cite from, written at build time. AI runs in the learner's browser,
 * and this keeps the content library out of the client bundle.
 */
export function GET() {
  const concepts: ConceptSummary[] = listConcepts().map(({ id, title, summary }) => ({ id, title, summary }));
  return Response.json({ concepts });
}
