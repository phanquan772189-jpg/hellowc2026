-- Cập nhật lịch cron để dùng tối ưu 7500 req/ngày API-Football
-- Tổng: ~902 req/ngày thông thường

-- Dọn cron cũ
SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('sync-live', 'sync-standings', 'sync-fixtures');

-- sync-live: mỗi 2 phút → cập nhật tỷ số, events, lineup trực tiếp (720 req/ngày)
SELECT cron.schedule(
  'sync-live',
  '*/2 * * * *',
  $cron$
    SELECT net.http_get(
      url := 'https://ketquawc.vn/api/cron/sync-live',
      headers := jsonb_build_object(
        'Authorization', 'Bearer cc7915b1fc064a63ec573c253049f47437c1fcd5f18791cbb2b30d313c61b63c'
      )
    );
  $cron$
);

-- sync-fixtures: mỗi 6 tiếng → đảm bảo lineup có trước giờ đấu (80 req/ngày)
SELECT cron.schedule(
  'sync-fixtures',
  '7 */6 * * *',
  $cron$
    SELECT net.http_get(
      url := 'https://ketquawc.vn/api/cron/sync-fixtures',
      headers := jsonb_build_object(
        'Authorization', 'Bearer cc7915b1fc064a63ec573c253049f47437c1fcd5f18791cbb2b30d313c61b63c'
      )
    );
  $cron$
);

-- sync-standings: hằng ngày lúc 22:00 UTC (20 req/ngày)
SELECT cron.schedule(
  'sync-standings',
  '0 22 * * *',
  $cron$
    SELECT net.http_get(
      url := 'https://ketquawc.vn/api/cron/sync-standings',
      headers := jsonb_build_object(
        'Authorization', 'Bearer cc7915b1fc064a63ec573c253049f47437c1fcd5f18791cbb2b30d313c61b63c'
      )
    );
  $cron$
);
