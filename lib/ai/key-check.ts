/** The "Test key" button: a free, read-only request to the provider, straight from the browser. */
import { AiFailure } from "./errors";
import { keyCheckRequest, listedModels, type ModelSettings } from "./model";
import { codeForStatus, providerMessage, safeJson } from "./provider-errors";

const KEY_CHECK_TIMEOUT_MS = 15_000;

export type KeyCheck = {
  /** Whether the key's model list names the chosen model. Null when the provider doesn't list models. */
  modelListed: boolean | null;
};

/** Checks the key with a free, read-only request. Throws an AiFailure saying what is wrong. */
export async function checkKey(settings: ModelSettings): Promise<KeyCheck> {
  const { url, init } = keyCheckRequest(settings);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS) });
  } catch (error) {
    throw new AiFailure(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network");
  }
  const body = await res.text().catch(() => "");
  if (!res.ok) throw new AiFailure(codeForStatus(res.status, body), { detail: providerMessage(body, settings.apiKey) });
  const listed = listedModels(settings.provider, safeJson(body));
  return { modelListed: listed ? listed.includes(settings.model) : null };
}
