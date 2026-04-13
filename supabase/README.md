# Supabase Schema Notes

This project currently uses API-Football plus Upstash Redis for live match data.
The Supabase schema in `supabase/migrations` is intentionally focused on:

- stable reference data such as countries, leagues, teams, venues, and seasons
- competition membership via `team_league_seasons`
- season-aware roster data via `squads`
- lightweight fixture shells for SEO, editorial linking, and scheduling
- editorial content in `match_analyses`

Key adjustments from the original draft:

- `countries` also covers competition regions such as `World` or `Europe` via `kind`
- `players.age` was replaced with `birth_date` because age becomes stale
- `team_league_seasons` was added because teams can participate in multiple competitions in the same season
- `fixtures` keeps status and schedule metadata, but not live scores, events, or stats
- `match_analyses` uses draft/published status so public clients only read published content

How to apply:

1. Open the Supabase SQL editor and run the migration file.
2. Or, if you add Supabase CLI/config later, run `supabase db push`.

Recommended sync split:

- Supabase: countries, leagues, league seasons, teams, team-league memberships, players, squads, fixtures, analyses
- Redis/API-Football: live scores, lineups, events, statistics, short-term standings cache

Scheduled ingestion added in this repo:

- `/api/cron/sync-bootstrap`: one-off bootstrap import for tracked leagues and current seasons
- `/api/cron/sync-foundation`: `/countries`, `/leagues/seasons`, `/leagues`, `/teams`
- `/api/cron/sync-squads`: `/players/squads`
- `/api/cron/sync-fixtures`: `/fixtures`

Default Vercel cron schedule:

- `10 20 * * *` UTC -> 03:10 Asia/Ho_Chi_Minh for foundation sync
- `40 20 * * *` UTC -> 03:40 Asia/Ho_Chi_Minh for squad sync
- `7 * * * *` UTC -> minute 07 every hour for fixture sync
