-- Add group_label to standings so we can group cup competitions (World Cup, Champions League…)
-- by their bracket stage instead of collapsing everything into a single table.
alter table public.standings
  add column if not exists group_label text;

create index if not exists idx_standings_league_season_group
  on public.standings (league_id, season_year, group_label);
