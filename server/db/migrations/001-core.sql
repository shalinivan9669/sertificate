CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'learner', twoFactorEnabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, mfaVerifiedAt INTEGER
);
CREATE INDEX IF NOT EXISTS session_user ON session(userId);
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_user ON account(userId);
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS verification_identifier ON verification(identifier);
CREATE TABLE IF NOT EXISTS twoFactor (
  id TEXT PRIMARY KEY, secret TEXT NOT NULL, backupCodes TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verified INTEGER NOT NULL DEFAULT 1, failedVerificationCount INTEGER NOT NULL DEFAULT 0, lockedUntil INTEGER
);
CREATE INDEX IF NOT EXISTS two_factor_user ON twoFactor(userId);
CREATE TABLE IF NOT EXISTS rateLimit (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, lastRequest INTEGER NOT NULL);
CREATE TABLE programs (
  id TEXT PRIMARY KEY, direction_id TEXT NOT NULL, title_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')), created_at TEXT NOT NULL
);
CREATE TABLE program_versions (
  id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published')),
  data_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES "user"(id), approved_by TEXT REFERENCES "user"(id),
  review_evidence TEXT, published_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
  UNIQUE(program_id,version), CHECK(approved_by IS NULL OR approved_by != created_by)
);
CREATE TRIGGER program_version_immutable_update BEFORE UPDATE ON program_versions WHEN OLD.status = 'published' BEGIN SELECT RAISE(ABORT, 'Published version is immutable'); END;
CREATE TRIGGER program_version_immutable_delete BEFORE DELETE ON program_versions WHEN OLD.status = 'published' BEGIN SELECT RAISE(ABORT, 'Published version is immutable'); END;
CREATE TABLE enrollments (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES "user"(id), version_id TEXT NOT NULL REFERENCES program_versions(id),
  organization_id TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending_access','active','learning_complete','assessment_eligible','completed','suspended','expired','cancelled')),
  access_until TEXT, created_at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX enrollments_user ON enrollments(user_id);
CREATE INDEX enrollments_org ON enrollments(organization_id);
CREATE TRIGGER enrollment_identity_immutable BEFORE UPDATE OF user_id,version_id,organization_id ON enrollments BEGIN SELECT RAISE(ABORT, 'Enrollment identity is immutable'); END;
CREATE TABLE lesson_progress (
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id), lesson_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)), revision INTEGER NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '{}', completed_by TEXT REFERENCES "user"(id), completed_at TEXT,
  PRIMARY KEY(enrollment_id,lesson_id)
);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY, enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','graded','expired','voided')),
  deadline_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, form_json TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '{}', result_json TEXT, created_at TEXT NOT NULL, submitted_at TEXT
);
CREATE UNIQUE INDEX attempt_one_active ON attempts(enrollment_id) WHERE status = 'in_progress';
CREATE TRIGGER attempt_terminal_immutable BEFORE UPDATE ON attempts WHEN OLD.status != 'in_progress' BEGIN SELECT RAISE(ABORT, 'Terminal attempt is immutable'); END;
CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL, key TEXT NOT NULL, payload_hash TEXT NOT NULL, resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL, PRIMARY KEY(scope,key)
);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, actor_id TEXT, organization_id TEXT, action TEXT NOT NULL,
  target TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TRIGGER audit_append_only_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit is append-only'); END;
CREATE TRIGGER audit_append_only_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit is append-only'); END;
CREATE TABLE outbox (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, aggregate_id TEXT NOT NULL, payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX outbox_pending ON outbox(status,available_at);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL
);
