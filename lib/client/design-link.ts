/**
 * A playground design in a link: the model as JSON, deflated and base64url-encoded into the #fragment, so it
 * never reaches a server and needs no account. A link is a few hundred characters for a typical design.
 */

const PREFIX = "design=";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The #fragment (without "#") that carries this design. */
export async function encodeDesign(design: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(design));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** The design a #fragment carries, or undefined when it carries none or cannot be read. */
export async function decodeDesign(hash: string): Promise<unknown> {
  const param = new URLSearchParams(hash).get(PREFIX.slice(0, -1));
  if (!param) return undefined;
  try {
    const bytes = await pipe(fromBase64Url(param), new DecompressionStream("deflate-raw"));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

export function hasDesign(hash: string): boolean {
  return new URLSearchParams(hash).has(PREFIX.slice(0, -1));
}
