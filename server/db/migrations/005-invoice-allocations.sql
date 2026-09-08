-- Organization fees are divided into exact integer minor-unit allocations. Some seats can
-- receive a zero allocation when a small fixed fee covers many employees. The positive
-- original amount_minor remains the quoted unit fee. Older per-learner lines use its fallback.
ALTER TABLE corporate_invoice_lines ADD COLUMN allocated_amount_minor INTEGER
  CHECK(allocated_amount_minor IS NULL OR (allocated_amount_minor>=0 AND allocated_amount_minor<=amount_minor));
