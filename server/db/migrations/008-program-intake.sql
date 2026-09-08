CREATE TABLE program_intake_controls (
  version_id TEXT PRIMARY KEY REFERENCES program_versions(id),
  is_open INTEGER NOT NULL CHECK (is_open IN (0,1)),
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  reason TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
