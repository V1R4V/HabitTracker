# Vercel + Supabase Deployment Plan

## 1. Target Architecture

Convert the current static `localStorage` app into a private, deployed web app:

- **Frontend/app**: Next.js App Router deployed on Vercel.
- **Auth**: Supabase Auth with cookie-based sessions.
- **Database**: Supabase Postgres.
- **Authorization**: Postgres Row Level Security on every app table.
- **User model**: every user-owned row has `user_id uuid not null references auth.users(id)`.
- **Personal use**: sign-in required for the whole app; optionally restrict signups/logins to your email through an app allowlist and Supabase Auth settings.
- **UI**: keep the current dashboard-first product, improve polish, add dark mode, and preserve desktop-first UX.

Supabase project:

```text
Project ref: hpvkbsszvtdmnbueecwp
Project URL: https://hpvkbsszvtdmnbueecwp.supabase.co
REST base: https://hpvkbsszvtdmnbueecwp.supabase.co/rest/v1/
```

## 2. Security Requirements

### Secrets and environment variables

- Keep all real `.env` files out of git.
- Commit only `.env.example` with placeholders and public project URL.
- Use Vercel Project Settings for production environment variables.
- Use `.env.local` only for local development.
- Never expose these in browser code:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`
  - Supabase database password
  - Any access token from MCP, Vercel, or Supabase CLI
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-exposed.
- Service role key is allowed only in trusted server-only scripts or admin migration tooling, never in Client Components.

### Git hygiene

The repo must keep this `.gitignore` policy:

```text
.env
.env.*
!.env.example
.vercel/
.next/
node_modules/
*.sqlite
*.db
backups/
exports/
.supabase/
```

Before first commit after migration, run:

```bash
git status --short
git diff -- .gitignore .env.example PLAN.md
```

If any real key appears in a tracked file, stop and rotate the key before deploying.

### Supabase RLS

Enable RLS on every public app table. Policies must be scoped to authenticated users and their own rows only:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

Do not create permissive `anon` policies for app data. The browser may hold a publishable/anon key, but data access must rely on authenticated sessions plus RLS.

### Authentication

Recommended for personal use:

- Email/password login.
- Disable public open signup if you do not need it.
- If signup remains enabled, enforce `APP_ALLOWED_EMAILS` in app logic and add Supabase-side controls where available.
- Protect all app routes except login.
- Use Supabase SSR cookie helpers so sessions work correctly on Vercel.

## 3. Environment Variables

Local `.env.local`, not committed:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hpvkbsszvtdmnbueecwp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_or_anon_key
APP_ALLOWED_EMAILS=your_email@example.com
```

Server/admin-only values, only if needed:

```bash
SUPABASE_SERVICE_ROLE_KEY=server_only_value
SUPABASE_DB_URL=postgres_connection_string
```

Vercel production variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_ALLOWED_EMAILS`

Only add `SUPABASE_SERVICE_ROLE_KEY` to Vercel if a server route truly needs privileged admin work. V1 should avoid needing it in production.

## 4. Database Schema

Create these tables in Supabase Postgres.

```sql
create type tracking_type as enum ('done', 'count', 'hours');
create type priority_level as enum ('low', 'normal', 'high', 'critical');
create type task_status as enum ('not_started', 'in_progress', 'done', 'paused');
create type log_status as enum ('pending', 'complete', 'missed');
create type plan_source as enum ('weekly_plan', 'one_off', 'imported');
```

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  tracking_type tracking_type not null,
  default_target numeric not null default 1 check (default_target >= 0),
  unit text not null default 'unit',
  priority priority_level not null default 'normal',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category_id uuid references public.categories(id) on delete set null,
  linked_item_id uuid references public.items(id) on delete set null,
  priority priority_level not null default 'normal',
  status task_status not null default 'not_started',
  start_date date not null,
  deadline_date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_deadline_after_start check (deadline_date >= start_date)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  item_id uuid references public.items(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  scheduled boolean not null default true,
  target numeric check (target is null or target >= 0),
  source plan_source not null default 'weekly_plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_exactly_one_subject check (
    (item_id is not null and task_id is null) or
    (item_id is null and task_id is not null)
  )
);

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  item_id uuid references public.items(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actual_value numeric not null default 0 check (actual_value >= 0),
  status log_status not null default 'pending',
  is_extra boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint logs_exactly_one_subject check (
    (item_id is not null and task_id is null) or
    (item_id is null and task_id is not null)
  )
);

create table public.weekly_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);
```

Recommended indexes:

```sql
create index categories_user_idx on public.categories(user_id);
create index items_user_active_idx on public.items(user_id, active);
create index tasks_user_dates_idx on public.tasks(user_id, start_date, deadline_date);
create index plans_user_date_idx on public.plans(user_id, date);
create index logs_user_date_idx on public.logs(user_id, date);
create unique index plans_unique_item_day on public.plans(user_id, date, item_id) where item_id is not null;
create unique index plans_unique_task_day on public.plans(user_id, date, task_id) where task_id is not null;
create unique index logs_unique_item_day_extra on public.logs(user_id, date, item_id, is_extra) where item_id is not null;
create unique index logs_unique_task_day_extra on public.logs(user_id, date, task_id, is_extra) where task_id is not null;
```

RLS policy template:

```sql
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.tasks enable row level security;
alter table public.plans enable row level security;
alter table public.logs enable row level security;
alter table public.weekly_notes enable row level security;

create policy "own rows read categories" on public.categories
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows write categories" on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Repeat the same own-row read/write policy shape for items, tasks, plans, logs, weekly_notes.
```

## 5. App Implementation Plan

### Framework migration

- Create a Next.js App Router project in this repo.
- Move the current UI into React components.
- Preserve screens:
  - Dashboard
  - Today
  - Weekly Planner
  - Tasks
  - Settings
- Replace `localStorage` reads/writes with Supabase queries/mutations.
- Keep scoring logic in shared TypeScript utility functions.

### Auth flow

- Add `/login`.
- Add protected app routes using Supabase SSR middleware.
- Show login state and logout action in the shell.
- On first login, seed default categories/items/tasks/plans for that `user_id` if none exist.

### Data flow

- Client components handle interactive UI.
- Server actions or route handlers perform writes where validation is important.
- All writes include the authenticated user id.
- Dashboard reads only the active user’s rows.
- Scheduled tasks affect scoring only if a `plans` row exists for that task/date.

### Scoring rules

Keep the current planned scoring behavior:

```text
planned_score = sum(item_score * item_weight) / sum(item_weight)
```

- Low = `1`
- Normal = `2`
- High = `3`
- Critical = `5`
- DSA and Job Applications seed as `critical`.
- Extra unscheduled work bonus is capped at `+5%`.
- Final score is capped at `100%`.
- Blank planned items before today count as missed.
- Blank today/future items remain pending.

## 6. UI / UX Requirements

Do not downgrade the UI during the migration.

- Keep dashboard dense, useful, and desktop-first.
- Preserve:
  - score cards
  - heatmap
  - hours pie chart
  - weekly bar chart
  - score driver table
  - task risk summary
- Add dark mode:
  - Use a theme toggle in the app shell.
  - Persist preference per browser.
  - Respect `prefers-color-scheme` on first visit.
  - Implement with CSS variables or Tailwind theme tokens.
- Keep controls ergonomic:
  - fast daily logging
  - inline planner toggles
  - task filters
  - item/category settings
- Keep task forms strict:
  - title required
  - start date required
  - deadline date required
  - deadline must be on or after start date

## 7. Deployment Plan

1. Convert app to Next.js locally.
2. Add Supabase client/server helpers.
3. Add schema SQL in `supabase/migrations`.
4. Apply migration to project `hpvkbsszvtdmnbueecwp`.
5. Create your personal user in Supabase Auth.
6. Seed default data for that user.
7. Connect repo to Vercel.
8. Add Vercel environment variables.
9. Deploy preview.
10. Test login, RLS, planning, scoring, tasks, and exports.
11. Promote to production.

## 8. Supabase MCP Setup

The MCP setup modifies global Codex config and requires interactive authentication, so it should be done deliberately.

Commands:

```bash
codex mcp add supabase --url https://mcp.supabase.com/mcp?project_ref=hpvkbsszvtdmnbueecwp
```

Add to `~/.codex/config.toml`:

```toml
[mcp]
remote_mcp_client_enabled = true
```

Authenticate:

```bash
codex mcp login supabase
```

Verify inside Codex:

```text
/mcp
```

Optional Supabase skills:

```bash
npx skills add supabase/agent-skills
```

Do not commit MCP tokens, global config, or generated secret files to this repo.

## 9. Acceptance Tests

- `.env.local` is ignored by git.
- `.env.example` contains no secret values.
- App cannot load private screens while signed out.
- Signed-in user can only read/write rows with their own `user_id`.
- RLS blocks unauthenticated data access.
- Task creation rejects missing `start_date`.
- Task creation rejects missing `deadline_date`.
- Task creation rejects `deadline_date < start_date`.
- New trackable item affects score after it is scheduled.
- Unscheduled task appears in task list but does not affect score.
- Scheduled task affects score for the scheduled date.
- Extra work bonus never exceeds `+5%`.
- Dashboard updates after edits.
- Dark mode persists across reloads.
- Vercel production has only necessary environment variables.

## 10. References

- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Next.js Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase SSR Auth docs: https://supabase.com/docs/guides/auth/server-side
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel env CLI: https://vercel.com/docs/cli/env
