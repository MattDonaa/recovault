-- Milestone 12 — Manual claim tracking
-- Sellers submit claims manually to the marketplace; RecoVault only TRACKS that
-- submission. No automatic submission occurs anywhere in this system. The two
-- deadline clocks are stored separately and never conflated:
--   * submission_deadline_at   — window to submit the claim (anchored on discovery)
--   * dispute_sla_deadline_at   — dispute-resolution SLA (anchored on submission)

alter table public.cases
  add column if not exists external_reference text;
alter table public.cases
  add column if not exists submitted_at timestamptz;
alter table public.cases
  add column if not exists submission_deadline_at timestamptz;
alter table public.cases
  add column if not exists dispute_sla_deadline_at timestamptz;
