CREATE TABLE learning_reminder_preferences (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id),
  access_deadline INTEGER NOT NULL DEFAULT 1 CHECK(access_deadline IN (0,1)),
  renewal INTEGER NOT NULL DEFAULT 1 CHECK(renewal IN (0,1)),
  updated_at TEXT NOT NULL
);
CREATE TABLE learning_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  organization_id TEXT REFERENCES organizations(id),
  kind TEXT NOT NULL CHECK(kind IN ('access_deadline','renewal')),
  due_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  lead_days_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_by TEXT NOT NULL REFERENCES "user"(id),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX learning_reminders_active ON learning_reminders(user_id,enrollment_id,kind) WHERE status='active';
CREATE INDEX learning_reminders_user ON learning_reminders(user_id,created_at);
CREATE INDEX learning_reminders_organization ON learning_reminders(organization_id,created_at);
CREATE TABLE learning_reminder_deliveries (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL REFERENCES learning_reminders(id),
  revision INTEGER NOT NULL,
  offset_days INTEGER NOT NULL CHECK(offset_days>=0 AND offset_days<=365),
  scheduled_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','queued','delivered','cancelled','missed')),
  outbox_id TEXT REFERENCES outbox(id),
  notification_id TEXT REFERENCES notifications(id),
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  UNIQUE(reminder_id,revision,offset_days)
);
CREATE INDEX learning_reminder_deliveries_due ON learning_reminder_deliveries(status,scheduled_at);
CREATE TRIGGER learning_reminder_identity_immutable BEFORE UPDATE OF user_id,enrollment_id,organization_id,kind ON learning_reminders BEGIN SELECT RAISE(ABORT,'Reminder identity is immutable'); END;
