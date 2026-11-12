/** Client-safe: the progress events an AI run reports while it works. */
import type { AiErrorCode } from "./errors";

export type AiEvent =
  | { type: "progress"; step: string; detail?: string; runId?: string; files?: string[] }
  | { type: "result"; runId: string; data: unknown }
  | { type: "error"; code: AiErrorCode; message: string; detail?: string; runId?: string };
