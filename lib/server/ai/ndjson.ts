import "server-only";
import { after } from "next/server";
import { AI_ERROR_MESSAGES, AiFailure, type AiErrorCode, REFUND_PENDING_MESSAGE } from "@/lib/ai/errors";
import type { AiEvent } from "@/lib/ai/events";

const encoder = new TextEncoder();

/** A run that failed, as returned by runMetered. */
export type RunFailure = {
  code: AiErrorCode;
  runId: string | null;
  refunded: boolean;
  refundPending?: boolean;
};

export function runFailureEvent(failure: RunFailure): AiEvent {
  const base = AI_ERROR_MESSAGES[failure.code];
  return {
    type: "error",
    code: failure.code,
    message: failure.refundPending ? `${base} ${REFUND_PENDING_MESSAGE}` : base,
    refunded: failure.refunded,
    refundPending: failure.refundPending,
    runId: failure.runId ?? undefined,
  };
}

function failureEvent(error: unknown): AiEvent {
  if (error instanceof AiFailure) {
    return { type: "error", code: error.code, message: error.message, refunded: error.refunded };
  }
  console.error(error);
  return { type: "error", code: "ai_unavailable", message: AI_ERROR_MESSAGES.ai_unavailable, refunded: false };
}

export function ndjsonResponse(work: (emit: (event: AiEvent) => void) => Promise<void>): Response {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      open = false;
    },
  });

  const emit = (event: AiEvent) => {
    if (open) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  const finished = (async () => {
    try {
      await work(emit);
    } catch (error) {
      emit(failureEvent(error));
    } finally {
      if (open) {
        open = false;
        controller.close();
      }
    }
  })();
  after(finished);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
