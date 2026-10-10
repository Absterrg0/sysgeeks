/**
 * The example architectures. Parsed once at module load, like `lib/content`, so
 * a malformed example fails the build. Server-only by convention: pages import
 * the examples, and client components receive one example as a prop.
 */
import { z } from "zod";
import { exampleProject, type ExampleProject, type ExampleProjectInput } from "@/lib/domain/content";
import { subscriptionSaas } from "./subscription-saas";
import { courseMarketplace } from "./course-marketplace";
import { teamChat } from "./team-chat";
import { storefront } from "./storefront";
import { mlInferenceApi } from "./ml-inference-api";
import { iotTelemetry } from "./iot-telemetry";
import { rideHailing } from "./ride-hailing";
import { blogCms } from "./blog-cms";
import { multiplayerGame } from "./multiplayer-game";
import { fintechLedger } from "./fintech-ledger";
import { eventTicketing } from "./event-ticketing";
import { ciPipeline } from "./ci-pipeline";

/** To add an example: write its file, import it here, and add it to this array. */
export const allExampleProjects: ExampleProjectInput[] = [
  subscriptionSaas,
  courseMarketplace,
  teamChat,
  storefront,
  mlInferenceApi,
  iotTelemetry,
  rideHailing,
  blogCms,
  multiplayerGame,
  fintechLedger,
  eventTicketing,
  ciPipeline,
];

const examples: ExampleProject[] = allExampleProjects.map((input) => {
  const result = exampleProject.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid example project "${input.id}":\n${z.prettifyError(result.error)}`);
  }
  return result.data;
});
const exampleById = new Map(examples.map((e) => [e.id, e]));

export function listExampleProjects(): ExampleProject[] {
  return examples;
}

export function getExampleProject(id: string): ExampleProject | undefined {
  return exampleById.get(id);
}
