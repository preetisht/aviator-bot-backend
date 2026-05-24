import { Env } from "../types";
import { generateId, generateLicenseKey } from "../lib/crypto";

export async function handleActivate(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { email: string; tier?: string; subscription_id?: string; payment_provider?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const { email, tier, subscription_id, payment_provider } = body;

  if (!email || !email.includes("@")) {
    return jsonResponse({ error: "Valid email required" }, 400);
  }

  // Check if email already has a license
  const existing = await env.DB
    .prepare("SELECT * FROM licenses WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    return jsonResponse({
      error: "Email already has a license",
      license_key: (existing as any).license_key,
      tier: (existing as any).tier,
    }, 409);
  }

  const licenseKey = generateLicenseKey();
  const id = generateId();
  const finalTier = tier || "free";
  const maxDevices = finalTier === "pro" ? 3 : finalTier === "basic" ? 2 : 1;

  await env.DB
    .prepare(
      `INSERT INTO licenses (id, email, license_key, tier, status, payment_provider, subscription_id, max_devices)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
    )
    .bind(id, email, licenseKey, finalTier, payment_provider || null, subscription_id || null, maxDevices)
    .run();

  return jsonResponse({
    success: true,
    license_key: licenseKey,
    tier: finalTier,
    email,
  }, 201);
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
