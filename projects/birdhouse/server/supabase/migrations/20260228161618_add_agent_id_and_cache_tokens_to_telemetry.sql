-- Add agent_id and full token breakdown to telemetry_tokens
-- agent_id allows the marketing site to use latest-per-agent aggregation
-- cache/reasoning columns store raw data for flexible recalculation later
ALTER TABLE public.telemetry_tokens
  ADD COLUMN agent_id           text,
  ADD COLUMN cache_read_tokens  integer NOT NULL DEFAULT 0,
  ADD COLUMN cache_write_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN reasoning_tokens   integer NOT NULL DEFAULT 0;

-- Update aggregate function to use latest row per agent_id for context token sum.
-- For rows without agent_id (old data), fall back to treating each row independently.
CREATE OR REPLACE FUNCTION public.get_telemetry_totals()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'agents_created', (SELECT COUNT(*) FROM public.telemetry_agent_created),
    'total_tokens', (
      SELECT COALESCE(SUM(total_tokens), 0)
      FROM (
        SELECT DISTINCT ON (COALESCE(agent_id, id::text))
          (input_tokens + output_tokens + cache_read_tokens + cache_write_tokens + reasoning_tokens) AS total_tokens
        FROM public.telemetry_tokens
        ORDER BY COALESCE(agent_id, id::text), created_at DESC
      ) latest
    )
  );
$$;
