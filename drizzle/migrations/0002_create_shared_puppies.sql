CREATE TABLE public.pet_puppies (
  user_id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT 'Biscuit',
  unlocked boolean NOT NULL DEFAULT false,
  alive boolean NOT NULL DEFAULT true,
  born_at timestamptz NOT NULL DEFAULT now(),
  last_fed_at timestamptz NOT NULL DEFAULT now(),
  died_at timestamptz,
  fullness integer NOT NULL DEFAULT 100,
  affection integer NOT NULL DEFAULT 0,
  interactions integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_visit date,
  pantry jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_puppies TO authenticated;
GRANT ALL ON public.pet_puppies TO service_role;
ALTER TABLE public.pet_puppies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read puppies" ON public.pet_puppies FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners can add puppies" ON public.pet_puppies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can update puppies" ON public.pet_puppies FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can delete puppies" ON public.pet_puppies FOR DELETE TO authenticated USING (user_id = auth.uid());