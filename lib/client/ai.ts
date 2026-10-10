import { AI_ERROR_MESSAGES, AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import { type AiEvent, readNdjson } from "@/lib/ai/events";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * POSTs to an NDJSON AI route. `onEvent` sees every event as it arrives.
 * Resolves with the result data, or rejects with an AiFailure carrying the error code.
 */
export async function runAi<T = unknown>(
  path: string,
  body: unknown,
  onEvent: (event: AiEvent) => void = () => {},
): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }).catch(() => {
    throw new AiFailure("ai_unavailable");
  });

  const events: AiEvent[] = [];
  try {
    await readNdjson(res, (event) => {
      events.push(event);
      onEvent(event);
    });
  } catch {
    throw new AiFailure("ai_unavailable");
  }

  const end = events.filter((event) => event.type !== "progress").at(-1);
  if (end?.type === "result") return end.data as T;
  if (end?.type === "error") throw new AiFailure(end.code, { refunded: end.refunded });
  throw new AiFailure("ai_unavailable");
}

/** Grading returns plain JSON, not a stream, and costs no credits. */
export async function gradeAnswer<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/ai/grade", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }).catch(
    () => {
      throw new AiFailure("ai_unavailable");
    },
  );
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new AiFailure(errorCode(json));
  return json as T;
}

function errorCode(json: unknown): AiErrorCode {
  const code = typeof json === "object" && json !== null && "code" in json ? json.code : undefined;
  return typeof code === "string" && Object.hasOwn(AI_ERROR_MESSAGES, code) ? (code as AiErrorCode) : "ai_unavailable";
}
