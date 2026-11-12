/** Reading a provider's error response. No SDK imports, so the key test can use it without loading the AI SDK. */
import type { AiErrorCode } from "./errors";

const MAX_DETAIL = 300;

export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function codeForStatus(status: number, body: string): AiErrorCode {
  if (status === 401 || /API_KEY_INVALID|invalid[_ ]api[_ ]key|invalid x-api-key/i.test(body)) return "key_invalid";
  if (status === 403) return "key_forbidden";
  if (status === 404 || /model.{0,40}(not[_ ]found|does not exist|not available|unsupported)/i.test(body)) {
    return "model_not_found";
  }
  if (status === 402 || status === 429) return "provider_limited";
  if (status >= 500) return "provider_unavailable";
  return "model_failed";
}

/** The provider's own error message, with anything key-shaped taken out (OpenAI echoes part of the key). */
export function providerMessage(body: string | undefined, apiKey: string): string | undefined {
  if (!body) return undefined;
  const json = safeJson(body) as { error?: { message?: unknown } | string; message?: unknown } | null;
  const raw =
    typeof json?.error === "object" && typeof json.error?.message === "string"
      ? json.error.message
      : typeof json?.error === "string"
        ? json.error
        : typeof json?.message === "string"
          ? json.message
          : null;
  if (!raw) return undefined;
  let text = raw;
  if (apiKey) text = text.split(apiKey).join("[your key]");
  text = text.replace(/\b(sk-[A-Za-z0-9_*-]{2,}|AIza[0-9A-Za-z_*-]{4,})/g, "[your key]");
  return text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL)}…` : text;
}
