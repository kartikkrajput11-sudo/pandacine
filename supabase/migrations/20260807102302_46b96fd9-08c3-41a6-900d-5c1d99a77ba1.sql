ALTER TABLE public.pet_pandas
  ADD COLUMN IF NOT EXISTS fullness integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_fed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS alive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS died_at timestamptz,
  ADD COLUMN IF NOT EXISTS pantry jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unlocked_expressions text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS unlocked_costumes text[] NOT NULL DEFAULT '{}'::text[];