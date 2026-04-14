CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.app_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON TABLE private.app_secrets FROM PUBLIC;
REVOKE ALL ON TABLE private.app_secrets FROM anon;
REVOKE ALL ON TABLE private.app_secrets FROM authenticated;
REVOKE ALL ON TABLE private.app_secrets FROM service_role;

CREATE OR REPLACE FUNCTION private.ketquawc_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT secret
  FROM private.app_secrets
  WHERE name = secret_name
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.ketquawc_secret(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.refresh_ketquawc_cron_jobs(
  target_base_url text DEFAULT 'https://ketquawc.vn'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text := rtrim(trim(coalesce(target_base_url, '')), '/');
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
    'auto-preview',
    'sync-topscorers'
  ];
BEGIN
  IF base_url = '' THEN
    RAISE NOTICE 'Skipping cron refresh because target_base_url is empty.';
    RETURN jsonb_build_object(
      'scheduled', false,
      'reason', 'missing_base_url'
    );
  END IF;

  IF coalesce(cron_secret, '') = '' THEN
    RAISE NOTICE 'Skipping cron refresh because private secret ketquawc_cron_secret is missing.';
    RETURN jsonb_build_object(
      'scheduled', false,
      'reason', 'missing_secret',
      'secret_name', 'ketquawc_cron_secret'
    );
  END IF;

  bearer_token := 'Bearer ' || cron_secret;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = ANY (scheduled_jobs);

  PERFORM cron.schedule(
    'sync-foundation',
    '10 20 * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-foundation',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-squads',
    '40 20 * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-squads',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-live',
    '*/2 * * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-live',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-match-stats',
    '*/5 * * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-match-stats',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-lineups',
    '*/10 * * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-lineups',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'auto-preview',
    '*/30 * * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/auto-preview',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-fixtures',
    '7 */6 * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-fixtures',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-standings',
    '0 22 * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-standings',
      bearer_token
    )
  );

  PERFORM cron.schedule(
    'sync-topscorers',
    '0 3 * * *',
    format(
      $job$SELECT net.http_get(url := %L, headers := jsonb_build_object('Authorization', %L)) AS request_id;$job$,
      base_url || '/api/cron/sync-topscorers',
      bearer_token
    )
  );

  RETURN jsonb_build_object(
    'scheduled', true,
    'base_url', base_url,
    'jobs', scheduled_jobs
  );
END;
$$;

COMMENT ON FUNCTION public.refresh_ketquawc_cron_jobs(text) IS
  'Registers KetquaWC pg_cron jobs using the ketquawc_cron_secret stored in private.app_secrets.';

SELECT public.refresh_ketquawc_cron_jobs();
