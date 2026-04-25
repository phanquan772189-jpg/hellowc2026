-- Lưu HLV trưởng hiện tại của mỗi đội. Mỗi đội đúng một row.
-- Khi đội đổi HLV, pipeline upsert đè lên row cũ.

CREATE TABLE IF NOT EXISTS public.team_coaches (
  team_id     integer       PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_id    integer       NOT NULL,

  name        text          NOT NULL,
  first_name  text,
  last_name   text,
  birth_date  date,
  birth_place text,
  birth_country text,
  nationality text,
  height_cm   integer,
  weight_kg   integer,
  photo_url   text,

  -- Mảng "career" trả từ /coachs (team, start, end). Dùng cho phần timeline ở UI.
  career      jsonb,

  updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_coaches_coach_id
  ON public.team_coaches(coach_id);

ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_coaches'
      AND policyname = 'Public read team_coaches'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read team_coaches" ON public.team_coaches FOR SELECT USING (true)';
  END IF;
END
$$;
