-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing jobs if any (idempotent)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('sync-foundation', 'sync-squads', 'sync-fixtures');

-- sync-foundation: Daily at 20:10 UTC
SELECT cron.schedule(
  'sync-foundation',
  '10 20 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://ketquawc.vn/api/cron/sync-foundation',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization', 'Bearer cc7915b1fc064a63ec573c253049f47437c1fcd5f18791cbb2b30d313c61b63c',
        'Content-Type', 'application/json'
      )
    );
  $cron$
);

-- sync-squads: Daily at 20:40 UTC
SELECT cron.schedule(
  'sync-squads',
  '40 20 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://ketquawc.vn/api/cron/sync-squads',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization', 'Bearer cc7915b1fc064a63ec573c253049f47437c1fcd5f18791cbb2b30d313c61b63c',
        'Content-Type', 'application/json'
      )
    );
  $cron$
);

-- sync-fixtures: Daily at 21:07 UTC
SELECT cron.schedule(
  'sync-fixtures',
  '7 21 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://ketquawc.vn/api/cron/sync-fixtures',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization', 'Bearer cc7915b1fc064a63ec573c253049f47437c1fcd5f18791cbb2b30d313c61b63c',
        'Content-Type', 'application/json'
      )
    );
  $cron$
);
