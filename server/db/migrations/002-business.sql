CREATE TABLE organizations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES "user"(id),
  role TEXT NOT NULL CHECK(role IN ('owner','manager','member')), status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL, PRIMARY KEY(organization_id,user_id)
);
CREATE INDEX memberships_user ON memberships(user_id,status);
CREATE TABLE invitations (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('manager','member')), token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', expires_at TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX invitations_one_pending ON invitations(organization_id,email) WHERE status='pending';
CREATE TABLE import_previews (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), created_by TEXT NOT NULL,
  data_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'preview', expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id), organization_id TEXT REFERENCES organizations(id),
  version_id TEXT NOT NULL REFERENCES program_versions(id), status TEXT NOT NULL DEFAULT 'created',
  amount_minor INTEGER NOT NULL CHECK(amount_minor>=0), currency TEXT NOT NULL CHECK(currency='KZT'),
  snapshot_json TEXT NOT NULL, enrollment_id TEXT REFERENCES enrollments(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX orders_user ON orders(user_id,created_at);
CREATE TABLE payments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', amount_minor INTEGER NOT NULL, currency TEXT NOT NULL,
  merchant TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(order_id,provider)
);
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id), payload_hash TEXT NOT NULL,
  event_type TEXT NOT NULL, received_at TEXT NOT NULL
);
CREATE TABLE refunds (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), status TEXT NOT NULL,
  amount_minor INTEGER NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX refunds_one_confirmed ON refunds(order_id) WHERE status='confirmed';
CREATE TABLE credentials (
  id TEXT PRIMARY KEY, enrollment_id TEXT NOT NULL REFERENCES enrollments(id), attempt_id TEXT NOT NULL REFERENCES attempts(id),
  serial TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', snapshot_json TEXT NOT NULL,
  verification_hash TEXT NOT NULL UNIQUE, document_base64 TEXT, document_sha256 TEXT,
  issued_at TEXT, revoked_at TEXT, revoked_reason TEXT, supersedes_id TEXT REFERENCES credentials(id),
  issued_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX credentials_active_enrollment ON credentials(enrollment_id) WHERE status IN ('pending','issued');
CREATE TABLE lead_submissions (
  id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, request_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'accepted',
  crm_lead_id INTEGER, crm_note_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX leads_created ON lead_submissions(created_at);
CREATE TABLE consent_records (
  id TEXT PRIMARY KEY, user_id TEXT, lead_id TEXT REFERENCES lead_submissions(id), purpose TEXT NOT NULL,
  version TEXT NOT NULL, granted_at TEXT NOT NULL, withdrawn_at TEXT
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES "user"(id), purpose TEXT NOT NULL, template TEXT NOT NULL,
  payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL, delivered_at TEXT
);
CREATE INDEX notifications_user ON notifications(user_id,created_at);
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, dimensions_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX analytics_created ON analytics_events(created_at);
ALTER TABLE outbox ADD COLUMN lease_token TEXT;
ALTER TABLE outbox ADD COLUMN lease_until TEXT;
CREATE INDEX orders_status ON orders(status,updated_at);
CREATE INDEX credentials_lookup ON credentials(verification_hash,status);
