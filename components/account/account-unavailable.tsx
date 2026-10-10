import { FeatureUnavailable } from "@/components/account/feature-unavailable";
import { Callout } from "@/components/feedback";

/** Shown in place of an account page when this deployment cannot hold accounts. */
export function AccountUnavailable({ reason }: { reason: "auth-off" | "db-off" }) {
  if (reason === "auth-off") return <FeatureUnavailable />;
  return (
    <Callout tone="note" title="Accounts are not set up on this site">
      Everything else works as normal.
    </Callout>
  );
}
