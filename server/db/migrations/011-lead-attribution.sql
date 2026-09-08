CREATE TABLE public_journeys (
  id TEXT PRIMARY KEY, consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL, auth_confirmed_at TEXT
);
CREATE INDEX public_journeys_created ON public_journeys(created_at);
CREATE INDEX public_journeys_expiry ON public_journeys(expires_at);
CREATE TABLE public_journey_steps (
  id TEXT PRIMARY KEY, journey_id TEXT NOT NULL REFERENCES public_journeys(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 64),
  step TEXT NOT NULL CHECK(step IN ('landing','program','consultation','selection_start','selection_matched','selection_unmatched','auth_start')),
  context_json TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(journey_id,sequence)
);
CREATE TABLE lead_attributions (
  lead_id TEXT PRIMARY KEY REFERENCES lead_submissions(id) ON DELETE CASCADE,
  journey_id TEXT REFERENCES public_journeys(id) ON DELETE SET NULL,
  last_sequence INTEGER NOT NULL CHECK(last_sequence BETWEEN 1 AND 64),
  first_touch_json TEXT NOT NULL, last_touch_json TEXT NOT NULL,
  consent_version TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX lead_attributions_journey ON lead_attributions(journey_id);
CREATE INDEX lead_attributions_expiry ON lead_attributions(expires_at);
