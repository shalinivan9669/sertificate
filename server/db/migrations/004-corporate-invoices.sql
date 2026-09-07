CREATE TABLE corporate_invoices (
  id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL REFERENCES organizations(id), version_id TEXT NOT NULL REFERENCES program_versions(id),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','issued','confirmed','cancelled')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0), currency TEXT NOT NULL CHECK(currency='KZT'),
  snapshot_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES "user"(id), created_at TEXT NOT NULL,
  confirmed_by TEXT REFERENCES "user"(id), confirmed_at TEXT, confirmation_json TEXT,
  payment_reference TEXT UNIQUE, cancelled_by TEXT REFERENCES "user"(id), cancelled_at TEXT, cancellation_reason TEXT,
  CHECK((status='confirmed' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND confirmation_json IS NOT NULL AND payment_reference IS NOT NULL)
    OR (status!='confirmed' AND confirmed_by IS NULL AND confirmed_at IS NULL AND confirmation_json IS NULL AND payment_reference IS NULL))
);
CREATE INDEX corporate_invoices_organization ON corporate_invoices(organization_id,created_at);
CREATE INDEX corporate_invoices_status ON corporate_invoices(status,created_at);
CREATE TABLE corporate_invoice_lines (
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES corporate_invoices(id), user_id TEXT NOT NULL REFERENCES "user"(id),
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0), snapshot_json TEXT NOT NULL,
  UNIQUE(invoice_id,user_id)
);
-- Reservations serialize two different invoice requests for the same seat. Cancellation releases them.
CREATE TABLE corporate_invoice_reservations (
  organization_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES "user"(id),
  version_id TEXT NOT NULL REFERENCES program_versions(id), invoice_id TEXT NOT NULL REFERENCES corporate_invoices(id),
  PRIMARY KEY(organization_id,user_id,version_id)
);
CREATE TABLE corporate_invoice_fulfillments (
  line_id TEXT PRIMARY KEY REFERENCES corporate_invoice_lines(id), order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id), created_at TEXT NOT NULL
);
CREATE TRIGGER corporate_invoice_snapshot_immutable BEFORE UPDATE ON corporate_invoices
WHEN NEW.id IS NOT OLD.id OR NEW.number IS NOT OLD.number OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.version_id IS NOT OLD.version_id OR NEW.amount_minor IS NOT OLD.amount_minor OR NEW.currency IS NOT OLD.currency
  OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'invoice snapshot is immutable'); END;
CREATE TRIGGER corporate_invoice_terminal_immutable BEFORE UPDATE ON corporate_invoices
WHEN OLD.status NOT IN ('preparing','issued') BEGIN SELECT RAISE(ABORT,'terminal invoice is immutable'); END;
CREATE TRIGGER corporate_invoice_valid_transition BEFORE UPDATE OF status ON corporate_invoices
WHEN NOT ((OLD.status='preparing' AND NEW.status='issued') OR (OLD.status='issued' AND NEW.status IN ('confirmed','cancelled')))
BEGIN SELECT RAISE(ABORT,'invalid invoice transition'); END;
CREATE TRIGGER corporate_invoice_no_delete BEFORE DELETE ON corporate_invoices
BEGIN SELECT RAISE(ABORT,'invoice history is immutable'); END;
CREATE TRIGGER corporate_invoice_lines_no_update BEFORE UPDATE ON corporate_invoice_lines
BEGIN SELECT RAISE(ABORT,'invoice lines are immutable'); END;
CREATE TRIGGER corporate_invoice_lines_no_delete BEFORE DELETE ON corporate_invoice_lines
BEGIN SELECT RAISE(ABORT,'invoice lines are immutable'); END;
CREATE TRIGGER corporate_invoice_lines_terminal_no_insert BEFORE INSERT ON corporate_invoice_lines
WHEN (SELECT status FROM corporate_invoices WHERE id=NEW.invoice_id)!='preparing'
BEGIN SELECT RAISE(ABORT,'terminal invoice lines are immutable'); END;
CREATE TRIGGER corporate_invoice_fulfillments_no_update BEFORE UPDATE ON corporate_invoice_fulfillments
BEGIN SELECT RAISE(ABORT,'invoice fulfillments are immutable'); END;
CREATE TRIGGER corporate_invoice_fulfillments_no_delete BEFORE DELETE ON corporate_invoice_fulfillments
BEGIN SELECT RAISE(ABORT,'invoice fulfillments are immutable'); END;
