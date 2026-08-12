-- ===== 1. Panda life story ==================================================
ALTER TABLE public.pet_pandas
  ADD COLUMN IF NOT EXISTS born_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS death_reason text,
  ADD COLUMN IF NOT EXISTS revives integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bond_id uuid;

CREATE TABLE IF NOT EXISTS public.pet_memorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  costume text,
  born_at timestamptz NOT NULL,
  died_at timestamptz NOT NULL DEFAULT now(),
  death_reason text NOT NULL DEFAULT 'starvation',
  affection integer NOT NULL DEFAULT 0,
  interactions integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  days_lived integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pet_memorials TO authenticated;
GRANT ALL ON public.pet_memorials TO service_role;
ALTER TABLE public.pet_memorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memorials readable" ON public.pet_memorials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== 2. Paired pandas =====================================================
CREATE TABLE IF NOT EXISTS public.pet_bonds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);
GRANT SELECT ON public.pet_bonds TO authenticated;
GRANT ALL ON public.pet_bonds TO service_role;
ALTER TABLE public.pet_bonds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bond members read" ON public.pet_bonds
  FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Revive a fallen panda for Luvies.
CREATE OR REPLACE FUNCTION public.revive_pet()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cost int := 3000; _bal int; _p pet_pandas%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM pet_pandas WHERE user_id = auth.uid();
  IF _p IS NULL OR NOT _p.unlocked THEN RAISE EXCEPTION 'No panda to revive'; END IF;
  IF _p.alive THEN RAISE EXCEPTION 'Your panda is alive'; END IF;
  _bal := public.spend_luvies(auth.uid(), _cost, 'panda_revive', 'pet:revive');
  UPDATE pet_pandas
     SET alive = true, died_at = NULL, death_reason = NULL,
         fullness = 60, last_fed_at = now(), revives = revives + 1,
         updated_at = now()
   WHERE user_id = auth.uid();
  RETURN jsonb_build_object('balance', _bal, 'cost', _cost);
END $$;

-- Retire the current panda into the memorial so a new one can be adopted.
CREATE OR REPLACE FUNCTION public.retire_pet(_reason text DEFAULT 'let go')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p pet_pandas%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM pet_pandas WHERE user_id = auth.uid();
  IF _p IS NULL OR NOT _p.unlocked THEN RAISE EXCEPTION 'No panda to retire'; END IF;
  INSERT INTO pet_memorials (user_id, name, costume, born_at, died_at, death_reason,
                             affection, interactions, streak, days_lived)
  VALUES (_p.user_id, _p.name, _p.costume, _p.born_at, COALESCE(_p.died_at, now()),
          COALESCE(_p.death_reason, _reason), _p.affection, _p.interactions, _p.streak,
          GREATEST(0, EXTRACT(DAY FROM (COALESCE(_p.died_at, now()) - _p.born_at))::int));
  DELETE FROM pet_pandas WHERE user_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END $$;

-- Merge pandas with your partner (one shared pet).
CREATE OR REPLACE FUNCTION public.bond_pet()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cost int := 999; _partner uuid; _bal int; _a uuid; _b uuid; _bond uuid;
BEGIN
  SELECT partner_id INTO _partner FROM profiles WHERE id = auth.uid();
  IF _partner IS NULL THEN RAISE EXCEPTION 'Pair with your partner first'; END IF;
  _a := LEAST(auth.uid(), _partner); _b := GREATEST(auth.uid(), _partner);
  SELECT id INTO _bond FROM pet_bonds WHERE user_a = _a AND user_b = _b;
  IF _bond IS NOT NULL THEN RETURN jsonb_build_object('bond_id', _bond, 'already', true); END IF;
  _bal := public.spend_luvies(auth.uid(), _cost, 'panda_bond', 'pet:bond');
  INSERT INTO pet_bonds (user_a, user_b, owner_user) VALUES (_a, _b, auth.uid())
  RETURNING id INTO _bond;
  UPDATE pet_pandas SET bond_id = _bond, updated_at = now()
   WHERE user_id = auth.uid();
  RETURN jsonb_build_object('bond_id', _bond, 'balance', _bal, 'cost', _cost);
END $$;

-- ===== 3. Earning Luvies through activity ===================================
CREATE TABLE IF NOT EXISTS public.activity_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('watch','game','game_win','win_streak')),
  minutes integer NOT NULL DEFAULT 0,
  luvies integer NOT NULL DEFAULT 0,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_rewards_user_day ON public.activity_rewards (user_id, day);
GRANT SELECT ON public.activity_rewards TO authenticated;
GRANT ALL ON public.activity_rewards TO service_role;
ALTER TABLE public.activity_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity readable" ON public.activity_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game text NOT NULL,
  won boolean NOT NULL DEFAULT false,
  room_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_results_user_time ON public.game_results (user_id, created_at DESC);
GRANT SELECT ON public.game_results TO authenticated;
GRANT ALL ON public.game_results TO service_role;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results readable" ON public.game_results
  FOR SELECT TO authenticated USING (true);

-- Award Luvies for watch/play minutes, with daily caps.
CREATE OR REPLACE FUNCTION public.award_activity(_kind text, _minutes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rate int; _cap int; _today int; _mins int; _award int; _bal int;
BEGIN
  IF _kind NOT IN ('watch','game') THEN RAISE EXCEPTION 'Unknown activity'; END IF;
  _mins := GREATEST(0, LEAST(120, COALESCE(_minutes, 0)));
  IF _mins = 0 THEN RETURN jsonb_build_object('luvies', 0); END IF;
  _rate := CASE WHEN _kind = 'watch' THEN 2 ELSE 3 END;
  _cap  := CASE WHEN _kind = 'watch' THEN 240 ELSE 300 END;
  SELECT COALESCE(SUM(luvies), 0) INTO _today
    FROM activity_rewards
   WHERE user_id = auth.uid() AND kind = _kind AND day = (now() AT TIME ZONE 'utc')::date;
  _award := LEAST(_mins * _rate, GREATEST(0, _cap - _today));
  IF _award <= 0 THEN RETURN jsonb_build_object('luvies', 0, 'capped', true); END IF;
  _bal := public.credit_luvies(auth.uid(), _award, 'activity_' || _kind, _kind || ':' || _mins || 'm');
  INSERT INTO activity_rewards (user_id, kind, minutes, luvies) VALUES (auth.uid(), _kind, _mins, _award);
  RETURN jsonb_build_object('luvies', _award, 'balance', _bal, 'capped', false);
END $$;

-- Record a finished game; pays win bonus + streak bonus.
CREATE OR REPLACE FUNCTION public.record_game_result(_game text, _won boolean, _room text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _streak int := 0; _award int := 0; _bal int; _r record;
BEGIN
  INSERT INTO game_results (user_id, game, won, room_key) VALUES (auth.uid(), _game, COALESCE(_won,false), _room);
  IF NOT COALESCE(_won, false) THEN RETURN jsonb_build_object('luvies', 0, 'streak', 0); END IF;
  FOR _r IN SELECT won FROM game_results WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 20 LOOP
    EXIT WHEN NOT _r.won;
    _streak := _streak + 1;
  END LOOP;
  _award := 25 + LEAST(100, GREATEST(0, _streak - 1) * 10);
  _bal := public.credit_luvies(auth.uid(), _award, 'game_win', _game);
  INSERT INTO activity_rewards (user_id, kind, luvies, meta)
  VALUES (auth.uid(), 'game_win', _award, jsonb_build_object('game', _game, 'streak', _streak));
  RETURN jsonb_build_object('luvies', _award, 'streak', _streak, 'balance', _bal);
END $$;

-- ===== 4. Weekly drawing tournaments ========================================
CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'drawing',
  theme text NOT NULL,
  week_key text NOT NULL UNIQUE,
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','voting','closed')),
  prizes jsonb NOT NULL DEFAULT '[3000,1500,750]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournaments TO authenticated, anon;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments readable" ON public.tournaments FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid,
  title text NOT NULL DEFAULT 'Untitled',
  image_url text NOT NULL,
  votes integer NOT NULL DEFAULT 0,
  rank integer,
  awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries readable" ON public.tournament_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "own entry insert" ON public.tournament_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entry update" ON public.tournament_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entry delete" ON public.tournament_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tournament_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.tournament_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.tournament_votes TO authenticated;
GRANT ALL ON public.tournament_votes TO service_role;
ALTER TABLE public.tournament_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes readable" ON public.tournament_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "own vote insert" ON public.tournament_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vote delete" ON public.tournament_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tournament_vote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournament_entries SET votes = votes + 1 WHERE id = NEW.entry_id;
  ELSE
    UPDATE tournament_entries SET votes = GREATEST(0, votes - 1) WHERE id = OLD.entry_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tournament_votes_count ON public.tournament_votes;
CREATE TRIGGER tournament_votes_count
AFTER INSERT OR DELETE ON public.tournament_votes
FOR EACH ROW EXECUTE FUNCTION public.tournament_vote_count();

-- Current or newest weekly tournament, creating this week's if missing.
CREATE OR REPLACE FUNCTION public.current_tournament()
RETURNS tournaments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t tournaments%ROWTYPE; _wk text; _themes text[] := ARRAY[
  'Draw your first date','Draw your partner as a panda','Your dream house',
  'A memory that made you laugh','Somewhere you want to travel','Your love in one symbol'];
BEGIN
  _wk := to_char(now() AT TIME ZONE 'utc', 'IYYY-"W"IW');
  SELECT * INTO _t FROM tournaments WHERE week_key = _wk;
  IF _t IS NULL THEN
    INSERT INTO tournaments (theme, week_key, closes_at)
    VALUES (_themes[1 + (abs(hashtext(_wk)) % array_length(_themes,1))],
            _wk,
            date_trunc('week', now() AT TIME ZONE 'utc') + interval '7 days')
    ON CONFLICT (week_key) DO NOTHING;
    SELECT * INTO _t FROM tournaments WHERE week_key = _wk;
  END IF;
  RETURN _t;
END $$;

-- Close a finished tournament and pay the top three couples.
CREATE OR REPLACE FUNCTION public.settle_tournament(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t tournaments%ROWTYPE; _e record; _i int := 0; _prize int; _paid int := 0;
BEGIN
  SELECT * INTO _t FROM tournaments WHERE id = _id;
  IF _t IS NULL THEN RAISE EXCEPTION 'No tournament'; END IF;
  IF _t.status = 'closed' THEN RETURN jsonb_build_object('already', true); END IF;
  IF now() < _t.closes_at AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Tournament still running';
  END IF;
  FOR _e IN SELECT * FROM tournament_entries WHERE tournament_id = _id ORDER BY votes DESC, created_at ASC LIMIT 3 LOOP
    _i := _i + 1;
    _prize := COALESCE((_t.prizes ->> (_i - 1))::int, 0);
    UPDATE tournament_entries SET rank = _i, awarded = _prize WHERE id = _e.id;
    IF _prize > 0 THEN
      PERFORM public.credit_luvies(_e.user_id, _prize, 'tournament_prize', _t.week_key);
      IF _e.partner_id IS NOT NULL THEN
        PERFORM public.credit_luvies(_e.partner_id, _prize, 'tournament_prize', _t.week_key);
      END IF;
      _paid := _paid + 1;
    END IF;
  END LOOP;
  UPDATE tournaments SET status = 'closed' WHERE id = _id;
  RETURN jsonb_build_object('winners', _paid);
END $$;

-- ===== 5. Leaderboards ======================================================
CREATE OR REPLACE FUNCTION public.leaderboard_messages(_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.avatar_url, count(m.id) AS total
    FROM messages m
    JOIN profiles p ON p.id = m.sender_id
   WHERE m.created_at >= date_trunc('month', now())
   GROUP BY p.id
   ORDER BY total DESC
   LIMIT GREATEST(1, LEAST(100, _limit));
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_wins(_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.username, p.avatar_url, count(g.id) AS total
    FROM game_results g
    JOIN profiles p ON p.id = g.user_id
   WHERE g.won AND g.created_at >= date_trunc('month', now())
   GROUP BY p.id
   ORDER BY total DESC
   LIMIT GREATEST(1, LEAST(100, _limit));
$$;

GRANT EXECUTE ON FUNCTION public.revive_pet(), public.retire_pet(text), public.bond_pet(),
  public.award_activity(text, integer), public.record_game_result(text, boolean, text),
  public.current_tournament(), public.settle_tournament(uuid),
  public.leaderboard_messages(integer), public.leaderboard_wins(integer) TO authenticated;