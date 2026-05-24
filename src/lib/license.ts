import { Env, License, Device } from "../types";
import { generateId, generateToken, hmacSign } from "./crypto";
import { getPlan } from "./plans";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ValidationResult {
  valid: boolean;
  license?: License;
  token?: string;
  signedToken?: string;
  features?: string[];
  error?: string;
  maxRounds?: number;
}

export async function validateLicense(
  db: D1Database,
  key: string,
  fingerprint: string,
  label: string | undefined,
  hmacSecret: string
): Promise<ValidationResult> {
  const license = await db
    .prepare("SELECT * FROM licenses WHERE license_key = ?")
    .bind(key)
    .first<License>();

  if (!license) {
    return { valid: false, error: "Invalid license key" };
  }

  if (license.status !== "active") {
    return { valid: false, error: `License is ${license.status}` };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    await db.prepare("UPDATE licenses SET status = 'expired' WHERE id = ?").bind(license.id).run();
    return { valid: false, error: "Subscription expired" };
  }

  // Check device limit
  const devices = await db
    .prepare("SELECT * FROM devices WHERE license_id = ?")
    .bind(license.id)
    .all<Device>();

  const existingDevice = devices.results?.find((d) => d.fingerprint === fingerprint);

  if (!existingDevice) {
    const deviceCount = devices.results?.length || 0;
    if (deviceCount >= license.max_devices) {
      return {
        valid: false,
        error: `Maximum devices reached (${license.max_devices}). Deactivate a device first.`,
      };
    }
    // Register new device
    await db
      .prepare("INSERT INTO devices (id, license_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, datetime('now'))")
      .bind(generateId(), license.id, fingerprint, label || "Unknown device")
      .run();
  } else {
    // Update last_seen
    await db
      .prepare("UPDATE devices SET last_seen = datetime('now'), label = COALESCE(?, label) WHERE id = ?")
      .bind(label, existingDevice.id)
      .run();
  }

  // Issue token
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const tokenPayload = generateToken(license.id, license.tier, expiresAt);
  const signature = await hmacSign(tokenPayload, hmacSecret);
  const signedToken = `${tokenPayload}.${signature}`;

  // Store session
  const sessionId = generateId();
  await db
    .prepare("INSERT INTO sessions (id, license_id, token, expires_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, license.id, signedToken, new Date(expiresAt).toISOString())
    .run();

  // Clean old sessions
  await db
    .prepare("DELETE FROM sessions WHERE license_id = ? AND expires_at < datetime('now')")
    .bind(license.id)
    .run();

  const plan = getPlan(license.tier);

  return {
    valid: true,
    license,
    token: signedToken,
    features: plan.features,
    maxRounds: plan.maxRounds,
  };
}

export async function deactivateDevice(
  db: D1Database,
  key: string,
  fingerprint: string
): Promise<{ success: boolean; error?: string }> {
  const license = await db
    .prepare("SELECT id FROM licenses WHERE license_key = ?")
    .bind(key)
    .first<{ id: string }>();

  if (!license) return { success: false, error: "Invalid key" };

  await db
    .prepare("DELETE FROM devices WHERE license_id = ? AND fingerprint = ?")
    .bind(license.id, fingerprint)
    .run();

  return { success: true };
}
