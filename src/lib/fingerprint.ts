const encoder = new TextEncoder();

export async function hashFingerprint(raw: string): Promise<string> {
  const data = encoder.encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidFingerprint(fp: string): boolean {
  return typeof fp === "string" && fp.length >= 16 && fp.length <= 128;
}
