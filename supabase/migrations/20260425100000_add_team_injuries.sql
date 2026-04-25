-- Lưu danh sách cầu thủ chấn thương / treo giò của từng đội theo mùa.
-- Mỗi lần sync (lazy theo team page hoặc cron), pipeline sẽ xoá toàn bộ
-- entry cho team+league+season rồi insert lại — đảm bảo không có rác cũ.

CREATE TABLE IF NOT EXISTS public.team_injuries (
  id                bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  player_id         integer       NOT NULL,
  team_id           integer       NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  league_id         integer       NOT NULL,
  season_year       integer       NOT NULL,
  fixture_id        integer,

  type              text          NOT NULL,
  reason            text,

  -- Denormalized — đỡ phải join sang players khi render
  player_name       text          NOT NULL,
  player_photo_url  text,

  updated_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_injuries_team_season
  ON public.team_injuries(team_id, season_year);

CREATE INDEX IF NOT EXISTS idx_team_injuries_league_season
  ON public.team_injuries(league_id, season_year);

ALTER TABLE public.team_injuries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_injuries'
      AND policyname = 'Public read team_injuries'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read team_injuries" ON public.team_injuries FOR SELECT USING (true)';
  END IF;
END
$$;
