CREATE TABLE support_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  author_id TEXT NOT NULL REFERENCES "user"(id),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 10 AND 2000),
  supersedes_id TEXT REFERENCES support_notes(id),
  created_at TEXT NOT NULL
);
CREATE INDEX support_notes_user ON support_notes(user_id,created_at,id);
CREATE TRIGGER support_notes_no_update BEFORE UPDATE ON support_notes BEGIN SELECT RAISE(ABORT,'Support notes are append-only'); END;
CREATE TRIGGER support_notes_no_delete BEFORE DELETE ON support_notes BEGIN SELECT RAISE(ABORT,'Support notes are append-only'); END;
CREATE TABLE credential_batches (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  action TEXT NOT NULL CHECK(action IN ('issue','revoke')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','processing','completed','partial')),
  expires_at TEXT NOT NULL,
  lease_token TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX credential_batches_owner ON credential_batches(created_by,created_at);
CREATE TABLE credential_batch_items (
  batch_id TEXT NOT NULL REFERENCES credential_batches(id),
  target_id TEXT NOT NULL,
  preview_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
  result_json TEXT,
  error_code TEXT,
  PRIMARY KEY(batch_id,target_id)
);
