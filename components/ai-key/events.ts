/** Any AI action can ask the header to open the key settings, so there is one dialog on the page. */
const OPEN_EVENT = "sysgeeks:open-ai-key-settings";

export function openAiKeySettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenAiKeySettings(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
