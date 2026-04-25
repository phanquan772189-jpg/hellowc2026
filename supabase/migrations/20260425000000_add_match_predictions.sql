-- Lưu kết quả phân tích trận đấu từ /predictions của API-Football.
-- Cố tình bỏ qua các field liên quan tới cá độ (under_over, advice, goals
-- prediction line) — chỉ lưu xác suất thắng/hoà và các chỉ số so sánh.

CREATE TABLE IF NOT EXISTS public.match_predictions (
  fixture_id          integer       PRIMARY KEY REFERENCES public.fixtures(id) ON DELETE CASCADE,
  predicted_winner_id integer       REFERENCES public.teams(id) ON DELETE SET NULL,
  winner_comment      text,
  win_or_draw         boolean,

  percent_home        smallint,
  percent_draw        smallint,
  percent_away        smallint,

  -- Comparison block: form / att / def / h2h / goals / total — toàn bộ là %
  comparison          jsonb,

  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_predictions_winner
  ON public.match_predictions(predicted_winner_id);

ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'match_predictions'
      AND policyname = 'Public read match_predictions'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read match_predictions" ON public.match_predictions FOR SELECT USING (true)';
  END IF;
END
$$;
