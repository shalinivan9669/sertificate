-- Additive operational context only. Existing historical rows intentionally remain NULL.
ALTER TABLE audit_events ADD COLUMN request_id TEXT;
ALTER TABLE audit_events ADD COLUMN correlation_id TEXT;
ALTER TABLE audit_events ADD COLUMN origin_request_id TEXT;
ALTER TABLE audit_events ADD COLUMN source_job_id TEXT;
ALTER TABLE outbox ADD COLUMN request_id TEXT;
ALTER TABLE outbox ADD COLUMN correlation_id TEXT;
ALTER TABLE outbox ADD COLUMN origin_request_id TEXT;
ALTER TABLE outbox ADD COLUMN source_job_id TEXT;
CREATE INDEX audit_correlation ON audit_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX outbox_correlation ON outbox(correlation_id) WHERE correlation_id IS NOT NULL;
