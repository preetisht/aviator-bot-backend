import { Env, License } from "../types";

const ADMIN_KEY_HEADER = "x-admin-key";

export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const adminKey = request.headers.get(ADMIN_KEY_HEADER);
  if (!adminKey || adminKey !== env.HMAC_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  switch (action) {
    case "list": {
      const licenses = await env.DB
        .prepare("SELECT id, email, license_key, tier, status, max_devices, created_at, expires_at FROM licenses ORDER BY created_at DESC LIMIT 100")
        .all<License>();
      return jsonResponse({ licenses: licenses.results }, 200);
    }

    case "revoke": {
      const key = url.searchParams.get("key");
      if (!key) return jsonResponse({ error: "key param required" }, 400);
      await env.DB
        .prepare("UPDATE licenses SET status = 'revoked' WHERE license_key = ?")
        .bind(key)
        .run();
      return jsonResponse({ success: true, message: `License ${key} revoked` }, 200);
    }

    case "upgrade": {
      const key = url.searchParams.get("key");
      const tier = url.searchParams.get("tier");
      if (!key || !tier) return jsonResponse({ error: "key and tier params required" }, 400);
      const maxDevices = tier === "pro" ? 3 : tier === "basic" ? 2 : 1;
      await env.DB
        .prepare("UPDATE licenses SET tier = ?, max_devices = ? WHERE license_key = ?")
        .bind(tier, maxDevices, key)
        .run();
      return jsonResponse({ success: true, message: `License ${key} upgraded to ${tier}` }, 200);
    }

    case "devices": {
      const key = url.searchParams.get("key");
      if (!key) return jsonResponse({ error: "key param required" }, 400);
      const license = await env.DB
        .prepare("SELECT id FROM licenses WHERE license_key = ?")
        .bind(key)
        .first<{ id: string }>();
      if (!license) return jsonResponse({ error: "License not found" }, 404);
      const devices = await env.DB
        .prepare("SELECT id, fingerprint, label, last_seen, created_at FROM devices WHERE license_id = ?")
        .bind(license.id)
        .all();
      return jsonResponse({ devices: devices.results }, 200);
    }

    default:
      return jsonResponse({ error: "Unknown action. Use: list, revoke, upgrade, devices" }, 400);
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
