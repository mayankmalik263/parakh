-- MASS: per-user history and chat (run once in Supabase → SQL Editor; safe to re-run).
-- Adds columns and one table. Deletes nothing.

-- 1. The backend saves an alignment score with every simulation. Without this column every
--    save has failed since July 2026, so no run reached anyone's history.
alter table public.simulations
  add column if not exists alignment_score double precision;

-- 2. Council chat history: one row per message, owned by the user who sent it.
create table if not exists public.chat_messages (
  id            bigint generated always as identity primary key,
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists chat_messages_simulation_idx
  on public.chat_messages (simulation_id, created_at);

-- The backend uses the secret key and bypasses RLS; these policies only govern direct
-- access with the public (publishable) key from a browser.
alter table public.chat_messages enable row level security;
drop policy if exists "Users can view their own chat" on public.chat_messages;
create policy "Users can view their own chat"
  on public.chat_messages for select to authenticated
  using (auth.uid() = user_id);

-- 3. Evaluation runs belong to the user who ran them. Existing rows have no owner and
--    stop showing on the Evals page (they stay in the table).
alter table public.evaluation_runs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists evaluation_runs_user_idx
  on public.evaluation_runs (user_id, created_at desc);

-- The old policy let any logged-in user read every user's evaluations.
drop policy if exists "Users can view evaluations" on public.evaluation_runs;
drop policy if exists "Users can view their own evaluations" on public.evaluation_runs;
create policy "Users can view their own evaluations"
  on public.evaluation_runs for select to authenticated
  using (auth.uid() = user_id);
