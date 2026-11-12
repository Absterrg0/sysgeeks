import { describe, expect, it } from "vitest";
import { codeForStatus, providerMessage } from "./provider-errors";
import { keyCheckRequest, listedModels } from "./model";
import { AI_PROVIDERS, defaultModel, MODEL_ID, PROVIDERS } from "./providers";

describe("provider catalog", () => {
  it("offers at least one well-formed model per provider, with a key page over https", () => {
    for (const id of AI_PROVIDERS) {
      const info = PROVIDERS[id];
      expect(info.models.length, id).toBeGreaterThan(0);
      for (const model of info.models) expect(MODEL_ID.test(model.id), model.id).toBe(true);
      expect(info.keyUrl.startsWith("https://"), id).toBe(true);
      expect(defaultModel(id)).toBe(info.models[0]?.id);
    }
  });

  it("names OpenRouter models by vendor", () => {
    for (const model of PROVIDERS.openrouter.models) expect(model.id).toMatch(/^[a-z0-9-]+\/.+/);
  });
});

describe("key checks", () => {
  it("sends Anthropic's browser opt-in header and only Gemini's own key header", () => {
    const anthropic = new Headers(keyCheckRequest({ provider: "anthropic", apiKey: "k" }).init.headers);
    expect(anthropic.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    const google = new Headers(keyCheckRequest({ provider: "google", apiKey: "k" }).init.headers);
    expect([...google.keys()]).toEqual(["x-goog-api-key"]);
  });

  it("checks OpenRouter keys with the endpoint that rejects bad ones", () => {
    expect(keyCheckRequest({ provider: "openrouter", apiKey: "k" }).url).toBe("https://openrouter.ai/api/v1/key");
  });

  it("reads the model list each provider returns", () => {
    expect(listedModels("anthropic", { data: [{ id: "claude-sonnet-5-5" }] })).toEqual(["claude-sonnet-5-5"]);
    expect(listedModels("google", { models: [{ name: "models/gemini-3.8-flash" }] })).toEqual(["gemini-3.8-flash"]);
    expect(listedModels("openrouter", { data: { label: "k" } })).toBeNull();
  });
});

describe("provider errors", () => {
  it("maps statuses and bodies to codes", () => {
    expect(codeForStatus(401, "")).toBe("key_invalid");
    // Gemini answers a bad key with 400.
    expect(codeForStatus(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}')).toBe("key_invalid");
    expect(codeForStatus(403, "")).toBe("key_forbidden");
    expect(codeForStatus(404, "")).toBe("model_not_found");
    expect(codeForStatus(400, '{"error":{"message":"The model `gpt-9` does not exist"}}')).toBe("model_not_found");
    expect(codeForStatus(402, "")).toBe("provider_limited");
    expect(codeForStatus(429, "")).toBe("provider_limited");
    expect(codeForStatus(529, "")).toBe("provider_unavailable");
    expect(codeForStatus(400, "{}")).toBe("model_failed");
  });

  it("quotes the provider's message without the key", () => {
    const key = "sk-proj-abcdefghijklmnop";
    const body = JSON.stringify({ error: { message: `Incorrect API key provided: sk-proj-abc***mnop and ${key}.` } });
    expect(providerMessage(body, key)).toBe("Incorrect API key provided: [your key] and [your key].");
    expect(providerMessage('{"error":"User not found."}', "k")).toBe("User not found.");
    expect(providerMessage("<html>", "k")).toBeUndefined();
  });
});
