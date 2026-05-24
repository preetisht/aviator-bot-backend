-- Aviator Bot License System Schema

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  license_key TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  payment_provider TEXT,
  subscription_id TEXT,
  max_devices INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_subscription ON licenses(subscription_id);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  label TEXT,
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_devices_license ON devices(license_id);
CREATE INDEX idx_devices_fingerprint ON devices(fingerprint);
CREATE UNIQUE INDEX idx_devices_license_fp ON devices(license_id, fingerprint);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_license ON sessions(license_id);
CREATE INDEX idx_sessions_token ON sessions(token);
