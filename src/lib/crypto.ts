const encoder = new TextEncoder();

export async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bufferToHex(signature);
}

export async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return timingSafeEqual(expected, signature);
}

export function generateToken(licenseId: string, tier: string, expiresAt: number): string {
  const payload = JSON.stringify({ lid: licenseId, tier, exp: expiresAt, iat: Date.now() });
  return btoa(payload);
}

export function decodeToken(token: string): { lid: string; tier: string; exp: number; iat: number } | null {
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

export function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let s = 0; s < 5; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      const bytes = new Uint8Array(1);
      crypto.getRandomValues(bytes);
      seg += chars[bytes[0] % chars.length];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

export function generateId(): string {
  return crypto.randomUUID();
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
