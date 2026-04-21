-- Cập nhật refresh_ketquawc_cron_jobs với schedule agressive hơn để tận dụng 6000 req/ngày
-- Ước tính: ~2200 req quiet day / ~6000 req peak match day

CREATE OR REPLACE FUNCTION public.refresh_ketquawc_cron_jobs(
  target_base_url text DEFAULT 'https://ketquawc.vn'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url    text := rtrim(trim(coalesce(target_base_url, '')), '/');
  cron_secret text := private.ketquawc_secret('ketquawc_cron_secret');
  bearer_token text;
  scheduled_jobs text[] := ARRAY[
    'sync-foundation',
    'sync-squads',
    'sync-live',
    'sync-fixtures',
    'sync-standings',
    'sync-match-stats',
    'sync-lineups',
    'sync-events',
    'auto-preview',
    'sync-topscorers'
  ];
BEGIN
  IF base_url = '' THEN
    RAISE NOTICE 'Skipping cron refresh: target_base_url is empty.';
    RETURN jsonb_build_object('scheduled', false, 'reason', 'missing_base_url');
  END IF;

  IF coalesce(cron_secret, '') = '' THEN
    RAISE NOTICE 'Skipping cron refresh: ketquawc_cron_secret not set in private.app_secrets.';
    RETURN jsonb_build_object('scheduled', false, 'reason', 'missing_secret');
  END IF;

  bearer_token := 'Bearer ' || cron_secret;

  -- Xóa jobs cũ trước khi đăng ký lại
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = ANY(scheduled_jobs);

  -- sync-live: mỗi 1 phút — 1.440 req/ngày
  PERFORM cron.schedule('sync-live', '* * * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-live', bearer_token));

  -- sync-match-stats: mỗi 3 phút — ~2.400 req/ngày peak
  PERFORM cron.schedule('sync-match-stats', '*/3 * * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-match-stats', bearer_token));

  -- sync-lineups: mỗi 5 phút — ~860 req/ngày peak
  PERFORM cron.schedule('sync-lineups', '*/5 * * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-lineups', bearer_token));

  -- sync-events: mỗi 5 phút — ~580 req/ngày peak
  PERFORM cron.schedule('sync-events', '*/5 * * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-events', bearer_token));

  -- sync-fixtures: mỗi 1 giờ — 480 req/ngày (tăng từ 6 giờ)
  PERFORM cron.schedule('sync-fixtures', '7 * * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-fixtures', bearer_token));

  -- sync-standings: mỗi 4 giờ — 120 req/ngày (tăng từ 1 lần/ngày)
  PERFORM cron.schedule('sync-standings', '0 */4 * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-standings', bearer_token));

  -- auto-preview: mỗi 15 phút — 0 API-Football calls (chỉ gọi Gemini)
  PERFORM cron.schedule('auto-preview', '*/15 * * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/auto-preview', bearer_token));

  -- sync-topscorers: 3AM daily — 60 req/ngày
  PERFORM cron.schedule('sync-topscorers', '0 3 * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-topscorers', bearer_token));

  -- sync-foundation: 8:10 PM UTC daily — ~23 req/ngày
  PERFORM cron.schedule('sync-foundation', '10 20 * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-foundation', bearer_token));

  -- sync-squads: 8:40 PM UTC daily — ~25 req/ngày
  PERFORM cron.schedule('sync-squads', '40 20 * * *',
    format($j$SELECT net.http_get(url:=%L, headers:=jsonb_build_object('Authorization',%L));$j$,
      base_url || '/api/cron/sync-squads', bearer_token));

  RETURN jsonb_build_object('scheduled', true, 'base_url', base_url, 'jobs', scheduled_jobs);
END;
$$;

-- Áp dụng ngay (sẽ skip nếu secret chưa được set — xem hướng dẫn bên dưới)
SELECT public.refresh_ketquawc_cron_jobs();

-- ============================================================
-- SAU KHI CHẠY MIGRATION NÀY, vào Supabase SQL Editor chạy:
--
-- 1. Insert secret (phải TRÙNG với CRON_SECRET trên Vercel):
--    INSERT INTO private.app_secrets (name, secret)
--    VALUES ('ketquawc_cron_secret', 'your-cron-secret-here')
--    ON CONFLICT (name) DO UPDATE SET secret = excluded.secret;
--
-- 2. Kích hoạt cron jobs:
--    SELECT public.refresh_ketquawc_cron_jobs();
--
-- 3. Kiểm tra đã schedule chưa:
--    SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- ============================================================
