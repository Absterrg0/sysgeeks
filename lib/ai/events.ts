/** Client-safe: NDJSON event types and the client reader. Server writer lives in lib/server/ai/ndjson.ts. */
import type { AiErrorCode } from "./errors";

export type AiEvent =
  | { type: "progress"; step: string; detail?: string; runId?: string; files?: string[] }
  | { type: "result"; runId: string; data: unknown }
  | {
      type: "error";
      code: AiErrorCode;
      message: string;
      refunded: boolean;
      /** The run is settled but the credit refund failed; the sweep returns the credits within 10 minutes. */
      refundPending?: boolean;
      runId?: string;
    };

export async function readNdjson(res: Response, onEvent: (e: AiEvent) => void): Promise<void> {
  if (!res.body) throw new Error("Response has no body");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  const drain = (final: boolean) => {
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as AiEvent);
      newline = buffer.indexOf("\n");
    }
    if (final && buffer.trim()) {
      const line = buffer.trim();
      buffer = "";
      onEvent(JSON.parse(line) as AiEvent);
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    drain(false);
  }
  drain(true);
}
