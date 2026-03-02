-- One row per agent created across all Birdhouse installations
CREATE TABLE public.telemetry_agent_created (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  install_id  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per assistant message completion across all Birdhouse installations
CREATE TABLE public.telemetry_tokens (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  install_id     text    NOT NULL,
  input_tokens   integer NOT NULL,
  output_tokens  integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS: anon can INSERT but never SELECT
ALTER TABLE public.telemetry_agent_created ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_agent_created"
  ON public.telemetry_agent_created FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_tokens"
  ON public.telemetry_tokens FOR INSERT TO anon WITH CHECK (true);

-- Read-only aggregate function for the marketing site
-- SECURITY DEFINER runs as postgres so anon can call it without table SELECT access
CREATE OR REPLACE FUNCTION public.get_telemetry_totals()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'agents_created', (SELECT COUNT(*) FROM public.telemetry_agent_created),
    'total_tokens',   (SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM public.telemetry_tokens)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_telemetry_totals() TO anon;
