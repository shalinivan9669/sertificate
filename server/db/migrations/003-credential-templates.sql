CREATE TABLE credential_templates (
  id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), name TEXT NOT NULL,
  data_json TEXT NOT NULL, pdf_base64 TEXT NOT NULL, font_base64 TEXT,
  status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL REFERENCES "user"(id),
  approved_by TEXT REFERENCES "user"(id), approved_at TEXT, created_at TEXT NOT NULL,
  CHECK(approved_by IS NULL OR approved_by != created_by)
);
CREATE INDEX templates_program ON credential_templates(program_id,status);
CREATE TRIGGER template_immutable BEFORE UPDATE ON credential_templates WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'Approved template immutable'); END;
