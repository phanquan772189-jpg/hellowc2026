-- Lưu rating + key stats của từng cầu thủ trong từng trận đấu.
-- Dữ liệu từ /fixtures/players của API-Football, chỉ có ý nghĩa với trận đã kết thúc.

CREATE TABLE IF NOT EXISTS public.fixture_player_ratings (
  fixture_id        integer       NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id           integer       NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id         integer       NOT NULL,

  rating            numeric(3, 1),    -- 0.0 → 10.0
  minutes           integer,
  position          text,
  is_substitute     boolean,
  is_captain        boolean,

  goals             integer,
  assists           integer,
  shots_total       integer,
  shots_on          integer,
  passes_total      integer,
  passes_key        integer,
  passes_accuracy   integer,
  tackles_total     integer,
  duels_total       integer,
  duels_won         integer,
  yellow_cards      integer,
  red_cards         integer,

  -- Denormalized cho fast read
  player_name       text          NOT NULL,
  player_photo_url  text,

  updated_at        timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (fixture_id, team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_fpr_fixture
  ON public.fixture_player_ratings(fixture_id);

ALTER TABLE public.fixture_player_ratings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fixture_player_ratings'
      AND policyname = 'Public read fixture_player_ratings'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read fixture_player_ratings" ON public.fixture_player_ratings FOR SELECT USING (true)';
  END IF;
END
$$;
