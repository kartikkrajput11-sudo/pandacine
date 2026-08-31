CREATE TABLE IF NOT EXISTS public.dm_chat_themes (
  pair_key text PRIMARY KEY,
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'velvet',
  photo_path text,
  glow boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_chat_themes TO authenticated;
GRANT ALL ON public.dm_chat_themes TO service_role;

ALTER TABLE public.dm_chat_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants read dm theme" ON public.dm_chat_themes;
CREATE POLICY "participants read dm theme" ON public.dm_chat_themes
FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "participants write dm theme" ON public.dm_chat_themes;
CREATE POLICY "participants write dm theme" ON public.dm_chat_themes
FOR INSERT TO authenticated
WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND pair_key = least(user_a::text, user_b::text) || '__' || greatest(user_a::text, user_b::text));

DROP POLICY IF EXISTS "participants update dm theme" ON public.dm_chat_themes;
CREATE POLICY "participants update dm theme" ON public.dm_chat_themes
FOR UPDATE TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_chat_themes;

-- Wallpapers are shared between both chat participants: allow either id in the
-- "<uuid>__<uuid>" folder prefix to read/write the object.
DROP POLICY IF EXISTS "pair read chat wallpapers" ON storage.objects;
CREATE POLICY "pair read chat wallpapers" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-wallpapers' AND (
    auth.uid()::text = split_part((storage.foldername(name))[1], '__', 1)
    OR auth.uid()::text = split_part((storage.foldername(name))[1], '__', 2)
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "pair write chat wallpapers" ON storage.objects;
CREATE POLICY "pair write chat wallpapers" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-wallpapers' AND (
    auth.uid()::text = split_part((storage.foldername(name))[1], '__', 1)
    OR auth.uid()::text = split_part((storage.foldername(name))[1], '__', 2)
  )
);

DROP POLICY IF EXISTS "pair delete chat wallpapers" ON storage.objects;
CREATE POLICY "pair delete chat wallpapers" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-wallpapers' AND (
    auth.uid()::text = split_part((storage.foldername(name))[1], '__', 1)
    OR auth.uid()::text = split_part((storage.foldername(name))[1], '__', 2)
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);