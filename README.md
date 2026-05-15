# Habit Command Center

A private habit, planning, task, notes, scoring, and analytics app. The current implementation is a Next.js + Supabase app intended for Vercel deployment, with the original static prototype files kept for reference.

## Run

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hpvkbsszvtdmnbueecwp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
APP_ALLOWED_EMAILS=your_email@example.com
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Deploy to Vercel

1. Push this project to GitHub.
2. In Vercel, import the repository as a Next.js project.
3. Add these environment variables in Project Settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
APP_ALLOWED_EMAILS=your_email@example.com
```

4. In Supabase, run the SQL migration in `supabase/migrations/202605150001_initial_schema.sql`.
5. Deploy. Vercel should use `npm run build` automatically.

See `PLAN.md` for the longer Next.js + Supabase migration plan, including database schema, RLS policies, auth flow, dark mode requirements, environment variables, and deployment safety.

Do not commit real `.env` files. Use `.env.example` as the template and store production variables in Vercel Project Settings.

## Implemented

- Supabase Auth protected Next.js app.
- Supabase schema migration with RLS policies in `supabase/migrations`.
- Dashboard with daily, weekly, and monthly weighted grades.
- Calendar heatmap.
- Pie chart for monthly hours by category.
- Bar chart for weekly hours by category.
- Today logging for scheduled work.
- Extra unscheduled work with bonus credit capped at 5%.
- Weekly planner with schedule toggles and target overrides.
- Freeform weekly notes.
- Dedicated task list with required start date and deadline date.
- Task validation: deadline must be on or after start date.
- Dynamic trackable item creation and editing.
- Weighted priorities: Low 1, Normal 2, High 3, Critical 5.
- JSON backup export.
- Dark mode.

## Scoring

Only scheduled work affects the base score. Unscheduled extra work is tracked separately and can add up to 5 bonus percentage points.

```text
planned_score = sum(item_score * item_weight) / sum(item_weight)
```

Blank planned items from dates before today are treated as missed. Blank planned items for today or future dates remain pending.
