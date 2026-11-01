-- Parakh: opt-in public links for plans (run once in Supabase → SQL Editor; safe to re-run).
-- Every plan stays private unless its owner turns sharing on from the plan page.
alter table public.simulations
  add column if not exists is_public boolean not null default false;
