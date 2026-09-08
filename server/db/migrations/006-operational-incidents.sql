CREATE TABLE operational_incidents (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('warning','critical')),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  owner_role TEXT NOT NULL CHECK(owner_role IN ('admin','finance','issuer')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved')),
  cycle INTEGER NOT NULL DEFAULT 1 CHECK(cycle > 0),
  observations INTEGER NOT NULL DEFAULT 1 CHECK(observations > 0),
  details_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  acknowledged_by TEXT REFERENCES "user"(id),
  acknowledged_at TEXT,
  resolved_at TEXT
);
CREATE INDEX operational_incidents_active ON operational_incidents(status,last_seen_at);
CREATE INDEX operational_incidents_owner ON operational_incidents(owner_role,status);
CREATE TABLE operational_counters (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY(day,metric)
);
