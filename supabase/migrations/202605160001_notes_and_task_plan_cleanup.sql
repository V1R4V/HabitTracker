create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_created_idx on public.notes(user_id, created_at desc);

alter table public.notes enable row level security;

drop policy if exists "notes own select" on public.notes;
drop policy if exists "notes own insert" on public.notes;
drop policy if exists "notes own update" on public.notes;
drop policy if exists "notes own delete" on public.notes;
create policy "notes own select" on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes own insert" on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes own update" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes own delete" on public.notes for delete to authenticated using ((select auth.uid()) = user_id);

-- Tasks are no longer scheduled through the weekly planner grid; they live on
-- their own in the Tasks tab. Drop existing task-plan rows and their logs so
-- scoring no longer sees them. Habit (item) plans are untouched.
delete from public.logs where task_id is not null;
delete from public.plans where task_id is not null;
