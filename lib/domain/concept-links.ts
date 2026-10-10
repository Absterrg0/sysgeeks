/** `[[id]]` or `[[id|label]]`, as written in model-review and lesson prose. */
const CONCEPT_LINK = /\[\[([^[\]|]+)(?:\|([^[\]]*))?\]\]/g;

/**
 * Keeps links to known concepts. Unknown links are unwrapped to their label,
 * or to their id when no label was given, so nothing points at a dead page.
 */
export function sanitizeConceptLinks(text: string, known: ReadonlySet<string>): string {
  return text.replace(CONCEPT_LINK, (link: string, rawId: string, label: string | undefined) => {
    const id = rawId.trim();
    if (known.has(id)) return link;
    return label?.trim() || id;
  });
}
