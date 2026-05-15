create extension if not exists pgcrypto;

do $$ begin
  create type public.tracking_type as enum ('done', 'count', 'hours');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.priority_level as enum ('low', 'normal', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('not_started', 'in_progress', 'done', 'paused');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.log_status as enum ('pending', 'complete', 'missed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_source as enum ('weekly_plan', 'one_off', 'imported');
exception when duplicate_object then null;
end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  tracking_type public.tracking_type not null,
  default_target numeric not null default 1 check (default_target >= 0),
  unit text not null default 'unit',
  priority public.priority_level not null default 'normal',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  category_id uuid references public.categories(id) on delete set null,
  linked_item_id uuid references public.items(id) on delete set null,
  priority public.priority_level not null default 'normal',
  status public.task_status not null default 'not_started',
  start_date date not null,
  deadline_date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_deadline_after_start check (deadline_date >= start_date)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  item_id uuid references public.items(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  scheduled boolean not null default true,
  target numeric check (target is null or target >= 0),
  source public.plan_source not null default 'weekly_plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_exactly_one_subject check (
    (item_id is not null and task_id is null) or
    (item_id is null and task_id is not null)
  )
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  item_id uuid references public.items(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actual_value numeric not null default 0 check (actual_value >= 0),
  status public.log_status not null default 'pending',
  is_extra boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logs_exactly_one_subject check (
    (item_id is not null and task_id is null) or
    (item_id is null and task_id is not null)
  )
);

create table if not exists public.weekly_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create index if not exists categories_user_idx on public.categories(user_id);
create index if not exists items_user_active_idx on public.items(user_id, active);
create index if not exists tasks_user_dates_idx on public.tasks(user_id, start_date, deadline_date);
create index if not exists plans_user_date_idx on public.plans(user_id, date);
create index if not exists logs_user_date_idx on public.logs(user_id, date);

create unique index if not exists plans_unique_item_day
  on public.plans(user_id, date, item_id)
  where item_id is not null;

create unique index if not exists plans_unique_task_day
  on public.plans(user_id, date, task_id)
  where task_id is not null;

create unique index if not exists logs_unique_item_day_extra
  on public.logs(user_id, date, item_id, is_extra)
  where item_id is not null;

create unique index if not exists logs_unique_task_day_extra
  on public.logs(user_id, date, task_id, is_extra)
  where task_id is not null;

alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.tasks enable row level security;
alter table public.plans enable row level security;
alter table public.logs enable row level security;
alter table public.weekly_notes enable row level security;

drop policy if exists "categories own select" on public.categories;
drop policy if exists "categories own insert" on public.categories;
drop policy if exists "categories own update" on public.categories;
drop policy if exists "categories own delete" on public.categories;
create policy "categories own select" on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories own insert" on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories own update" on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories own delete" on public.categories for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "items own select" on public.items;
drop policy if exists "items own insert" on public.items;
drop policy if exists "items own update" on public.items;
drop policy if exists "items own delete" on public.items;
create policy "items own select" on public.items for select to authenticated using ((select auth.uid()) = user_id);
create policy "items own insert" on public.items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "items own update" on public.items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "items own delete" on public.items for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "tasks own select" on public.tasks;
drop policy if exists "tasks own insert" on public.tasks;
drop policy if exists "tasks own update" on public.tasks;
drop policy if exists "tasks own delete" on public.tasks;
create policy "tasks own select" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks own insert" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks own update" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks own delete" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "plans own select" on public.plans;
drop policy if exists "plans own insert" on public.plans;
drop policy if exists "plans own update" on public.plans;
drop policy if exists "plans own delete" on public.plans;
create policy "plans own select" on public.plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "plans own insert" on public.plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plans own update" on public.plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plans own delete" on public.plans for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "logs own select" on public.logs;
drop policy if exists "logs own insert" on public.logs;
drop policy if exists "logs own update" on public.logs;
drop policy if exists "logs own delete" on public.logs;
create policy "logs own select" on public.logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "logs own insert" on public.logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "logs own update" on public.logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "logs own delete" on public.logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "weekly_notes own select" on public.weekly_notes;
drop policy if exists "weekly_notes own insert" on public.weekly_notes;
drop policy if exists "weekly_notes own update" on public.weekly_notes;
drop policy if exists "weekly_notes own delete" on public.weekly_notes;
create policy "weekly_notes own select" on public.weekly_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "weekly_notes own insert" on public.weekly_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weekly_notes own update" on public.weekly_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weekly_notes own delete" on public.weekly_notes for delete to authenticated using ((select auth.uid()) = user_id);
