-- One row per install script execution across all Birdhouse installations
CREATE TABLE public.telemetry_installs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  arch       text,
  version    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: anon can INSERT but never SELECT
ALTER TABLE public.telemetry_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_installs"
  ON public.telemetry_installs FOR INSERT TO anon WITH CHECK (true);
