CREATE TABLE IF NOT EXISTS public.match_previews (
  id             bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fixture_id     integer      NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  home_team_name text         NOT NULL DEFAULT '',
  away_team_name text         NOT NULL DEFAULT '',
  league_name    text         NOT NULL DEFAULT '',
  content        text         NOT NULL,
  generated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_previews_fixture_id
  ON public.match_previews(fixture_id);

ALTER TABLE public.match_previews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'match_previews'
      AND policyname = 'Public read match_previews'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read match_previews" ON public.match_previews FOR SELECT USING (true)';
  END IF;
END
$$;
