export interface Env {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  CORS_ORIGIN: string;
  RAZORPAY_KEY_SECRET: string;
  STRIPE_WEBHOOK_SECRET: string;
  HMAC_SECRET: string;
}

export interface License {
  id: string;
  email: string;
  license_key: string;
  tier: "free" | "basic" | "pro";
  status: "active" | "expired" | "revoked";
  payment_provider: "razorpay" | "stripe" | null;
  subscription_id: string | null;
  max_devices: number;
  created_at: string;
  expires_at: string | null;
}

export interface Device {
  id: string;
  license_id: string;
  fingerprint: string;
  label: string | null;
  last_seen: string;
  created_at: string;
}

export interface Session {
  id: string;
  license_id: string;
  token: string;
  issued_at: string;
  expires_at: string;
}

export interface ValidateRequest {
  key: string;
  fingerprint: string;
  label?: string;
}

export interface ValidateResponse {
  valid: boolean;
  tier?: string;
  features?: string[];
  token?: string;
  expires_in?: number;
  error?: string;
}

export type Tier = "free" | "basic" | "pro";
