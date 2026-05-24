import { Env, ValidateRequest, ValidateResponse } from "../types";
import { validateLicense, deactivateDevice } from "../lib/license";
import { isValidFingerprint } from "../lib/fingerprint";
import { getPlan } from "../lib/plans";

export async function handleValidate(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ valid: false, error: "Method not allowed" }, 405);
  }

  let body: ValidateRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ valid: false, error: "Invalid JSON body" }, 400);
  }

  const { key, fingerprint, label } = body;

  if (!key || typeof key !== "string") {
    return jsonResponse({ valid: false, error: "Missing license key" }, 400);
  }

  if (!fingerprint || !isValidFingerprint(fingerprint)) {
    return jsonResponse({ valid: false, error: "Invalid device fingerprint" }, 400);
  }

  // Rate limit: max 10 requests per key per minute
  const rateLimitKey = `rl:${key}`;
  const current = parseInt((await env.RATE_LIMIT.get(rateLimitKey)) || "0");
  if (current >= 10) {
    return jsonResponse({ valid: false, error: "Rate limited. Try again in 1 minute." }, 429);
  }
  await env.RATE_LIMIT.put(rateLimitKey, String(current + 1), { expirationTtl: 60 });

  const result = await validateLicense(env.DB, key, fingerprint, label, env.HMAC_SECRET);

  if (!result.valid) {
    return jsonResponse({ valid: false, error: result.error }, 403);
  }

  const plan = getPlan(result.license!.tier);

  const response: ValidateResponse = {
    valid: true,
    tier: result.license!.tier,
    features: result.features,
    token: result.token,
    expires_in: 86400,
  };

  return jsonResponse(response, 200);
}

export async function handleDeactivate(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { key: string; fingerprint: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const result = await deactivateDevice(env.DB, body.key, body.fingerprint);
  if (!result.success) {
    return jsonResponse({ error: result.error }, 400);
  }

  return jsonResponse({ success: true, message: "Device deactivated" }, 200);
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
