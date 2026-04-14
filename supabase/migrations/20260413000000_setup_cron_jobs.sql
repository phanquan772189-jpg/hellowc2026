-- Enable required extensions for scheduled ingestion.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Job registration is centralized in
-- 20260414233000_secure_supabase_cron_jobs.sql so secrets do not live in
-- migration files. This migration now only guarantees the required extensions.
