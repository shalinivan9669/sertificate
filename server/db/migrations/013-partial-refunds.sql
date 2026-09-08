-- Append receipt identity/snapshot without rewriting any historical financial fact.
-- NULL identity/total marks a pre-013 row; only new confirmations require them.
ALTER TABLE refunds ADD COLUMN payment_id TEXT REFERENCES payments(id);
ALTER TABLE refunds ADD COLUMN currency TEXT NOT NULL DEFAULT 'KZT' CHECK(currency='KZT');
ALTER TABLE refunds ADD COLUMN refunded_total_minor INTEGER;
DROP INDEX refunds_one_confirmed;
CREATE INDEX refunds_confirmed_order ON refunds(order_id,created_at,id) WHERE status='confirmed';
CREATE INDEX refunds_payment ON refunds(payment_id) WHERE status='confirmed';

CREATE TRIGGER refunds_confirmed_insert_valid BEFORE INSERT ON refunds WHEN NEW.status='confirmed'
BEGIN
  SELECT CASE WHEN typeof(NEW.amount_minor)!='integer' OR NEW.amount_minor<=0 OR NEW.amount_minor>9007199254740991
    OR typeof(NEW.refunded_total_minor)!='integer' OR NEW.refunded_total_minor>9007199254740991
    OR NEW.refunded_total_minor!=NEW.amount_minor+COALESCE((SELECT SUM(amount_minor) FROM refunds WHERE order_id=NEW.order_id AND status='confirmed'),0)
    OR NOT EXISTS(SELECT 1 FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=NEW.payment_id AND o.id=NEW.order_id
      AND p.status IN ('succeeded','partially_refunded') AND o.status=p.status
      AND p.amount_minor=o.amount_minor AND p.currency=o.currency AND p.currency=NEW.currency
      AND NEW.refunded_total_minor<=p.amount_minor AND NEW.refunded_total_minor>=NEW.amount_minor)
    THEN RAISE(ABORT,'confirmed refund amount or payment mismatch') END;
END;
CREATE TRIGGER refunds_confirmed_no_update BEFORE UPDATE ON refunds WHEN OLD.status='confirmed' OR NEW.status='confirmed'
BEGIN SELECT RAISE(ABORT,'confirmed refund history is immutable; append a receipt'); END;
CREATE TRIGGER refunds_confirmed_no_delete BEFORE DELETE ON refunds WHEN OLD.status='confirmed'
BEGIN SELECT RAISE(ABORT,'confirmed refund history is immutable'); END;

-- An old writer cannot reset a partial refund with a late succeeded webhook.
-- Existing legacy rows alone do not retroactively acquire new constraints.
CREATE TRIGGER payments_refund_identity_immutable BEFORE UPDATE ON payments
WHEN EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=OLD.id AND r.status='confirmed')
  AND (NEW.id IS NOT OLD.id OR NEW.order_id IS NOT OLD.order_id OR NEW.provider IS NOT OLD.provider
    OR NEW.amount_minor IS NOT OLD.amount_minor OR NEW.currency IS NOT OLD.currency OR NEW.merchant IS NOT OLD.merchant)
BEGIN SELECT RAISE(ABORT,'refunded payment identity is immutable'); END;
CREATE TRIGGER payments_refund_status_valid BEFORE UPDATE OF status ON payments
WHEN EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=OLD.id AND r.status='confirmed')
  AND NEW.status!=CASE WHEN (SELECT SUM(amount_minor) FROM refunds WHERE order_id=OLD.order_id AND status='confirmed')=OLD.amount_minor THEN 'refunded' ELSE 'partially_refunded' END
BEGIN SELECT RAISE(ABORT,'refunded payment state is monotonic'); END;
CREATE TRIGGER orders_refund_identity_immutable BEFORE UPDATE ON orders
WHEN EXISTS(SELECT 1 FROM refunds r WHERE r.order_id=OLD.id AND r.payment_id IS NOT NULL AND r.status='confirmed')
  AND (NEW.id IS NOT OLD.id OR NEW.user_id IS NOT OLD.user_id OR NEW.version_id IS NOT OLD.version_id
    OR NEW.organization_id IS NOT OLD.organization_id OR NEW.amount_minor IS NOT OLD.amount_minor OR NEW.currency IS NOT OLD.currency)
BEGIN SELECT RAISE(ABORT,'refunded order identity is immutable'); END;
CREATE TRIGGER orders_refund_status_valid BEFORE UPDATE OF status ON orders
WHEN EXISTS(SELECT 1 FROM refunds r WHERE r.order_id=OLD.id AND r.payment_id IS NOT NULL AND r.status='confirmed')
  AND NEW.status!=CASE WHEN (SELECT SUM(amount_minor) FROM refunds WHERE order_id=OLD.id AND status='confirmed')=OLD.amount_minor THEN 'refunded' ELSE 'partially_refunded' END
BEGIN SELECT RAISE(ABORT,'refunded order state is monotonic'); END;
