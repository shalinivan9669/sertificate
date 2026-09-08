CREATE TABLE lead_qualifications (
  lead_id TEXT PRIMARY KEY REFERENCES lead_submissions(id),
  status TEXT NOT NULL CHECK(status IN ('in_review','qualified','rejected')),
  request_type TEXT NOT NULL DEFAULT 'unspecified' CHECK(request_type IN ('unspecified','training','document_status','other')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_by TEXT NOT NULL REFERENCES "user"(id), updated_at TEXT NOT NULL
);
CREATE INDEX lead_qualification_status ON lead_qualifications(status,lead_id);
CREATE TABLE sales_proposals (
  id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES lead_submissions(id),
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','withdrawn')),
  sent_at TEXT NOT NULL, reference TEXT NOT NULL, organization_id TEXT REFERENCES organizations(id),
  created_by TEXT NOT NULL REFERENCES "user"(id), created_at TEXT NOT NULL,
  withdrawn_at TEXT, withdrawn_by TEXT REFERENCES "user"(id),
  UNIQUE(lead_id,reference)
);
CREATE INDEX sales_proposals_created ON sales_proposals(created_at,id);
CREATE INDEX sales_proposals_lead ON sales_proposals(lead_id,created_at);
CREATE TABLE sales_links (
  id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES lead_submissions(id),
  proposal_id TEXT REFERENCES sales_proposals(id),
  kind TEXT NOT NULL CHECK(kind IN ('order','enrollment')),
  order_id TEXT REFERENCES orders(id), enrollment_id TEXT REFERENCES enrollments(id),
  created_by TEXT NOT NULL REFERENCES "user"(id), created_at TEXT NOT NULL,
  revoked_at TEXT, revoked_by TEXT REFERENCES "user"(id),
  CHECK((kind='order' AND order_id IS NOT NULL AND enrollment_id IS NULL AND proposal_id IS NULL)
    OR (kind='enrollment' AND enrollment_id IS NOT NULL AND order_id IS NULL))
);
CREATE UNIQUE INDEX sales_order_active ON sales_links(order_id) WHERE revoked_at IS NULL AND order_id IS NOT NULL;
CREATE UNIQUE INDEX sales_enrollment_active ON sales_links(enrollment_id) WHERE revoked_at IS NULL AND enrollment_id IS NOT NULL;
CREATE INDEX sales_links_lead ON sales_links(lead_id,created_at);
CREATE INDEX sales_links_proposal ON sales_links(proposal_id,revoked_at);
CREATE TRIGGER sales_link_identity_immutable BEFORE UPDATE ON sales_links
WHEN NEW.id IS NOT OLD.id OR NEW.lead_id IS NOT OLD.lead_id OR NEW.proposal_id IS NOT OLD.proposal_id
 OR NEW.kind IS NOT OLD.kind OR NEW.order_id IS NOT OLD.order_id OR NEW.enrollment_id IS NOT OLD.enrollment_id
 OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR OLD.revoked_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'sales link history immutable'); END;
CREATE TRIGGER sales_link_no_delete BEFORE DELETE ON sales_links BEGIN SELECT RAISE(ABORT,'sales link history immutable'); END;
CREATE TRIGGER sales_proposal_identity_immutable BEFORE UPDATE ON sales_proposals
WHEN NEW.id IS NOT OLD.id OR NEW.lead_id IS NOT OLD.lead_id OR NEW.sent_at IS NOT OLD.sent_at OR NEW.reference IS NOT OLD.reference
 OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
 OR (OLD.organization_id IS NOT NULL AND NEW.organization_id IS NOT OLD.organization_id) OR OLD.status='withdrawn'
BEGIN SELECT RAISE(ABORT,'proposal history immutable'); END;
CREATE TRIGGER sales_proposal_no_delete BEFORE DELETE ON sales_proposals BEGIN SELECT RAISE(ABORT,'proposal history immutable'); END;
CREATE INDEX sales_enrollments_created ON enrollments(created_at,id);
CREATE INDEX sales_credentials_created ON credentials(created_at,id);
CREATE INDEX sales_attempts_enrollment ON attempts(enrollment_id,created_at);
CREATE INDEX sales_orders_enrollment ON orders(enrollment_id);
