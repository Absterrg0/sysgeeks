import { Callout } from "@/components/feedback";

/** Shown in place of AI actions when AI is switched off on this deployment. */
export function FeatureUnavailable() {
  return (
    <Callout tone="note" title="AI features are switched off on this site">
      Everything else works as normal.
    </Callout>
  );
}
