# Supabase Schema Notes

This project uses API-Football as the primary sports source, Supabase as the
long-lived store, and Upstash Redis as an optional hot cache for live pages.
The Supabase schema in `supabase/migrations` is intentionally focused on:

- stable reference data such as countries, leagues, teams, venues, and seasons
- competition membership via `team_league_seasons`
- season-aware roster data via `squads`
- fixture, lineup, event, statistic, and standings data needed on match pages
- editorial content such as match previews

Key adjustments from the original draft:

- `countries` also covers competition regions such as `World` or `Europe` via `kind`
- `players.age` was replaced with `birth_date` because age becomes stale
- `team_league_seasons` was added because teams can participate in multiple competitions in the same season
- `fixtures` is the stable shell and is enriched by adjacent tables for events,
  lineups, statistics, standings, and previews
- cron scheduling lives in Supabase `pg_cron`, not in `vercel.json`

How to apply:

1. Open the Supabase SQL editor and run the migration file.
2. Or, if you add Supabase CLI/config later, run `supabase db push`.

Recommended sync split:

- Supabase: countries, leagues, seasons, teams, squads, fixtures, events,
  lineups, statistics, standings, previews, and player leaderboards
- Redis: optional hot cache for the currently viewed live match

Scheduled ingestion exposed by this repo:

- `/api/cron/sync-bootstrap`: one-off bootstrap import for tracked leagues and current seasons
- `/api/cron/sync-foundation`: `/countries`, `/leagues/seasons`, `/leagues`, `/teams`
- `/api/cron/sync-squads`: `/players/squads`
- `/api/cron/sync-fixtures`: `/fixtures`
- `/api/cron/sync-live`: live score + event refresh
- `/api/cron/sync-match-stats`: possession, shots, corners, and other match stats
- `/api/cron/sync-lineups`: starting XI / bench close to kickoff and while live
- `/api/cron/auto-preview`: pre-match preview generation
- `/api/cron/sync-standings`: daily standings refresh
- `/api/cron/sync-topscorers`: daily leaderboard refresh

Supabase is the scheduler source of truth:

- `vercel.json` is intentionally empty for cron scheduling
- `public.refresh_ketquawc_cron_jobs()` registers or refreshes all jobs in
  `pg_cron`
- the bearer token is read from `private.app_secrets`
  using key `ketquawc_cron_secret`

Supabase setup for cron:

1. Add the same app `CRON_SECRET` to `private.app_secrets`:

   `insert into private.app_secrets(name, secret) values ('ketquawc_cron_secret', '<CRON_SECRET>') on conflict (name) do update set secret = excluded.secret, updated_at = now();`

2. Refresh jobs after the secret exists:

   `select public.refresh_ketquawc_cron_jobs();`

3. If the production domain changes, refresh with the new base URL:

   `select public.refresh_ketquawc_cron_jobs('https://your-domain.example');`
