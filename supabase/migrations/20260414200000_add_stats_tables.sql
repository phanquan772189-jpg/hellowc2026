-- ─── fixture_statistics ──────────────────────────────────────────────────────
-- Lưu thống kê chi tiết (possession, shots, corners…) từng trận
CREATE TABLE IF NOT EXISTS public.fixture_statistics (
  fixture_id  BIGINT  NOT NULL,
  team_id     BIGINT  NOT NULL,
  stat_type   TEXT    NOT NULL,
  stat_value  TEXT    NOT NULL,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fixture_id, team_id, stat_type)
);

ALTER TABLE public.fixture_statistics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fixture_statistics' AND policyname = 'Public read fixture_statistics'
  ) THEN
    CREATE POLICY "Public read fixture_statistics"
      ON public.fixture_statistics FOR SELECT TO public USING (true);
  END IF;
END $$;

-- ─── players ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.players (
  id        BIGINT PRIMARY KEY,
  name      TEXT   NOT NULL,
  photo_url TEXT
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'players' AND policyname = 'Public read players'
  ) THEN
    CREATE POLICY "Public read players"
      ON public.players FOR SELECT TO public USING (true);
  END IF;
END $$;

-- ─── player_season_stats ─────────────────────────────────────────────────────
-- Vua phá lưới / kiến tạo / thẻ phạt theo giải + mùa
CREATE TABLE IF NOT EXISTS public.player_season_stats (
  id          BIGSERIAL PRIMARY KEY,
  player_id   BIGINT  NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id     BIGINT  REFERENCES public.teams(id) ON DELETE SET NULL,
  league_id   BIGINT  NOT NULL,
  season_year INT     NOT NULL,
  stat_type   TEXT    NOT NULL,   -- 'scorer' | 'assist' | 'yellowcard'
  stat_value  INT     NOT NULL DEFAULT 0,
  games       INT,
  rank        INT     NOT NULL DEFAULT 0,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, league_id, season_year, stat_type)
);

ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'player_season_stats' AND policyname = 'Public read player_season_stats'
  ) THEN
    CREATE POLICY "Public read player_season_stats"
      ON public.player_season_stats FOR SELECT TO public USING (true);
  END IF;
END $$;

-- ─── pg_cron jobs (requires pg_cron + pg_net extensions) ─────────────────────
-- Runs via Supabase scheduled jobs (registered separately via MCP/dashboard)
-- sync-match-stats  : */5 * * * *   (every 5 min, live & recent finished)
-- sync-topscorers   : 0 3 * * *     (daily 03:00 UTC, 60 API calls/day)
-- sync-standings    : 0 */8 * * *   (every 8h, 3x/day)
