export type DraftConfidence = "stated" | "inferred" | "guessed";
export type ReportConfidence = "high" | "medium" | "low";
export type Confidence = DraftConfidence | ReportConfidence;

const LABEL: Record<Confidence, string> = {
  stated: "Stated",
  inferred: "Inferred",
  guessed: "Guessed",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const MEANING: Record<Confidence, string> = {
  stated: "You said this directly.",
  inferred: "Reasonably implied by what you wrote.",
  guessed: "A guess. Check it before you rely on it.",
  high: "Strong evidence in the input.",
  medium: "Some evidence, some judgement.",
  low: "Weak evidence. Treat it as a guess.",
};

/** How sure the AI is: stated / inferred / guessed for draft items, high / medium / low for findings. */
export function ConfidenceChip({ level }: { level: Confidence }) {
  return (
    <span className="chip-flat" title={MEANING[level]}>
      {LABEL[level]}
    </span>
  );
}
