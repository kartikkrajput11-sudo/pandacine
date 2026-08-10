-- ============ Luvies economy ============

CREATE TABLE public.luvies_settings (
  id integer PRIMARY KEY DEFAULT 1,
  recovery_tiers jsonb NOT NULL DEFAULT '[
    {"max_days": 7, "cost": 100},
    {"max_days": 30, "cost": 250},
    {"max_days": 100, "cost": 500},
    {"max_days": 365, "cost": 1000},
    {"max_days": 100000, "cost": 2500}
  ]'::jsonb,
  max_recoveries_per_cycle integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT luvies_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.luvies_settings TO authenticated;
GRANT ALL ON public.luvies_settings TO service_role;
ALTER TABLE public.luvies_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can read economy settings"
  ON public.luvies_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.luvies_settings (id) VALUES (1);

CREATE TABLE public.panda_shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('outfit','accessory','prop','effect','environment','expression')),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🐼',
  description text,
  price integer NOT NULL CHECK (price >= 0),
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','legendary')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.panda_shop_items TO authenticated;
GRANT ALL ON public.panda_shop_items TO service_role;
ALTER TABLE public.panda_shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can browse the panda shop"
  ON public.panda_shop_items FOR SELECT TO authenticated USING (active);
CREATE TRIGGER panda_shop_items_touch BEFORE UPDATE ON public.panda_shop_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.panda_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL REFERENCES public.panda_shop_items(item_key) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
CREATE INDEX panda_inventory_user_idx ON public.panda_inventory (user_id);
GRANT SELECT ON public.panda_inventory TO authenticated;
GRANT ALL ON public.panda_inventory TO service_role;
ALTER TABLE public.panda_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own panda items"
  ON public.panda_inventory FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.streak_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid,
  cycle_key text NOT NULL,
  lost_days integer NOT NULL,
  cost integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cycle_key)
);
GRANT SELECT ON public.streak_recoveries TO authenticated;
GRANT ALL ON public.streak_recoveries TO service_role;
ALTER TABLE public.streak_recoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own streak recoveries"
  ON public.streak_recoveries FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Reconcile the two legacy balance columns into one Luvies balance.
UPDATE public.profiles
  SET panda_coins = GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)),
      coins = GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0))
  WHERE COALESCE(panda_coins,0) <> COALESCE(coins,0);

-- ============ Wallet ============

CREATE OR REPLACE FUNCTION public.luvies_wallet()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  bal integer;
  earned integer;
  spent integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal FROM public.profiles WHERE id = me;
  SELECT COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0),
         COALESCE(-SUM(delta) FILTER (WHERE delta < 0), 0)
    INTO earned, spent
    FROM public.coin_ledger WHERE user_id = me;
  RETURN jsonb_build_object('balance', COALESCE(bal,0), 'earned', earned, 'spent', spent);
END;
$$;

-- ============ Panda shop ============

CREATE OR REPLACE FUNCTION public.buy_panda_item(_item_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  item public.panda_shop_items;
  bal integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Serialize concurrent purchases by the same user (double-click / replay safety).
  PERFORM pg_advisory_xact_lock(hashtext('luvies:' || me::text));

  SELECT * INTO item FROM public.panda_shop_items WHERE item_key = _item_key AND active;
  IF item.id IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.panda_inventory WHERE user_id = me AND item_key = _item_key) THEN
    SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal FROM public.profiles WHERE id = me;
    RETURN jsonb_build_object('balance', bal, 'item_key', _item_key, 'already_owned', true);
  END IF;

  SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal
    FROM public.profiles WHERE id = me FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF bal < item.price THEN
    RAISE EXCEPTION 'Not enough Luvies: need %, have %', item.price, bal;
  END IF;

  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles
    SET panda_coins = bal - item.price, coins = bal - item.price
    WHERE id = me;

  INSERT INTO public.panda_inventory (user_id, item_key) VALUES (me, _item_key);

  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (me, -item.price, 'panda_item:' || item.category, 'item:' || _item_key);

  RETURN jsonb_build_object('balance', bal - item.price, 'item_key', _item_key, 'already_owned', false, 'price', item.price);
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_panda_item(_item_key text, _equip boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  cat text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.panda_inventory WHERE user_id = me AND item_key = _item_key) THEN
    RAISE EXCEPTION 'You do not own this item';
  END IF;
  SELECT category INTO cat FROM public.panda_shop_items WHERE item_key = _item_key;

  IF _equip THEN
    UPDATE public.panda_inventory i
      SET equipped = false
      FROM public.panda_shop_items s
      WHERE i.user_id = me AND i.item_key = s.item_key AND s.category = cat;
    UPDATE public.panda_inventory SET equipped = true WHERE user_id = me AND item_key = _item_key;
  ELSE
    UPDATE public.panda_inventory SET equipped = false WHERE user_id = me AND item_key = _item_key;
  END IF;

  RETURN jsonb_build_object('item_key', _item_key, 'equipped', _equip);
END;
$$;

-- ============ Streak recovery ============

CREATE OR REPLACE FUNCTION public.streak_recovery_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p_id uuid;
  last_both date;
  d date;
  lost integer := 0;
  gap_start date;
  gap_end date := current_date - 1;
  cost integer := 0;
  tier jsonb;
  cfg public.luvies_settings;
  used integer := 0;
  bal integer;
  cycle text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT partner_id INTO p_id FROM public.profiles WHERE id = me;
  SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal FROM public.profiles WHERE id = me;
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_partner', 'balance', COALESCE(bal,0));
  END IF;

  SELECT MAX(a.date) INTO last_both
    FROM public.daily_checkins a
    JOIN public.daily_checkins b ON b.user_id = p_id AND b.date = a.date
    WHERE a.user_id = me;

  IF last_both IS NULL OR last_both >= current_date - 1 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'streak_intact', 'balance', COALESCE(bal,0));
  END IF;

  gap_start := last_both + 1;

  -- Length of the streak that was broken (consecutive days both checked in, ending at last_both).
  d := last_both;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.daily_checkins a
      JOIN public.daily_checkins b ON b.user_id = p_id AND b.date = a.date
      WHERE a.user_id = me AND a.date = d
    );
    lost := lost + 1;
    d := d - 1;
    EXIT WHEN lost > 3650;
  END LOOP;

  SELECT * INTO cfg FROM public.luvies_settings WHERE id = 1;
  FOR tier IN SELECT * FROM jsonb_array_elements(cfg.recovery_tiers) LOOP
    IF lost <= (tier->>'max_days')::int THEN
      cost := (tier->>'cost')::int;
      EXIT;
    END IF;
  END LOOP;
  IF cost = 0 THEN cost := 2500; END IF;

  cycle := gap_start::text;
  SELECT COUNT(*) INTO used FROM public.streak_recoveries WHERE user_id = me AND cycle_key = cycle;

  RETURN jsonb_build_object(
    'eligible', used < cfg.max_recoveries_per_cycle,
    'reason', CASE WHEN used >= cfg.max_recoveries_per_cycle THEN 'already_recovered' ELSE 'ok' END,
    'lost_days', lost,
    'gap_start', gap_start,
    'gap_end', gap_end,
    'missed_days', (gap_end - gap_start) + 1,
    'cost', cost,
    'balance', COALESCE(bal,0),
    'cycle_key', cycle
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p_id uuid;
  st jsonb;
  cost integer;
  bal integer;
  cycle text;
  gs date;
  ge date;
  d date;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('luvies:' || me::text));

  st := public.streak_recovery_state();
  IF NOT (st->>'eligible')::boolean THEN
    RAISE EXCEPTION 'Streak recovery unavailable (%)', COALESCE(st->>'reason','unknown');
  END IF;

  SELECT partner_id INTO p_id FROM public.profiles WHERE id = me;
  cost := (st->>'cost')::int;
  cycle := st->>'cycle_key';
  gs := (st->>'gap_start')::date;
  ge := (st->>'gap_end')::date;

  SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal
    FROM public.profiles WHERE id = me FOR UPDATE;
  IF bal < cost THEN
    RAISE EXCEPTION 'Not enough Luvies: need %, have %', cost, bal;
  END IF;

  INSERT INTO public.streak_recoveries (user_id, partner_id, cycle_key, lost_days, cost)
    VALUES (me, p_id, cycle, (st->>'lost_days')::int, cost);

  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET panda_coins = bal - cost, coins = bal - cost WHERE id = me;

  d := gs;
  WHILE d <= ge LOOP
    INSERT INTO public.daily_checkins (user_id, partner_id, date, note)
      VALUES (me, p_id, d, 'streak recovery')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.daily_checkins (user_id, partner_id, date, note)
      VALUES (p_id, me, d, 'streak recovery')
      ON CONFLICT DO NOTHING;
    d := d + 1;
  END LOOP;

  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (me, -cost, 'streak_recovery', 'streak:' || cycle);

  RETURN jsonb_build_object(
    'balance', bal - cost,
    'cost', cost,
    'restored_days', (st->>'lost_days')::int,
    'streak', public.couple_streak(me, p_id)
  );
END;
$$;

-- ============ Shop catalogue ============

INSERT INTO public.panda_shop_items (item_key, category, name, emoji, description, price, rarity, sort_order) VALUES
('hoodie-pink','outfit','Pink Hoodie','🧥','Soft cotton, perfect for lazy movie nights.',250,'common',1),
('pajamas-cloud','outfit','Cloud Pajamas','🩳','Fluffy sleepwear with tiny cloud prints.',300,'common',2),
('sweater-cable','outfit','Cable Sweater','🧶','Hand-knit warmth for winter cuddles.',400,'common',3),
('tshirt-panda','outfit','Panda Tee','👕','A panda wearing a panda tee. Very meta.',150,'common',4),
('jacket-leather','outfit','Leather Jacket','🧥','Cool panda energy, zero effort.',650,'rare',5),
('outfit-santa','outfit','Santa Suit','🎅','Seasonal cheer, extra pockets for snacks.',900,'rare',6),
('suit-tycoon','outfit','Golden Tycoon Suit','💼','Gold pinstripe, silk tie, briefcase of bamboo.',2500,'legendary',7),
('hat-beanie','accessory','Cosy Beanie','🧢','Keeps the ears warm.',120,'common',10),
('cap-cinema','accessory','Cinema Cap','🎬','For the director in every panda.',200,'common',11),
('crown-golden','accessory','Golden Crown','👑','Royalty of the bamboo grove.',1500,'legendary',12),
('glasses-round','accessory','Round Glasses','👓','Intellectual, slightly sleepy.',180,'common',13),
('headphones-rose','accessory','Rose Headphones','🎧','Noise-cancelling, heart-amplifying.',450,'rare',14),
('bow-ribbon','accessory','Silk Ribbon','🎀','A tiny bow, a big statement.',140,'common',15),
('prop-backpack','prop','Little Backpack','🎒','Full of snacks and love letters.',220,'common',20),
('prop-plushie','prop','Mini Plushie','🧸','A panda holding a panda plushie.',260,'common',21),
('prop-flowers','prop','Rose Bouquet','💐','Freshly picked, never wilts.',350,'rare',22),
('prop-phone','prop','Tiny Phone','📱','Always texting your partner.',300,'common',23),
('prop-book','prop','Poetry Book','📖','Bookmarked at your favourite line.',240,'common',24),
('prop-guitar','prop','Ukulele','🎸','Serenades on demand.',520,'rare',25),
('effect-hearts','effect','Heart Aura','💗','Floating hearts follow your panda.',750,'rare',30),
('effect-sparkles','effect','Sparkle Trail','✨','Glitter, tastefully applied.',600,'rare',31),
('effect-petals','effect','Falling Petals','🌸','A slow rose-petal drift.',680,'rare',32),
('effect-snow','effect','Winter Snowfall','❄️','Seasonal snow around the stage.',700,'rare',33),
('effect-fireflies','effect','Fireflies','🪄','Warm glowing dots at dusk.',820,'legendary',34),
('env-bedroom','environment','Cosy Bedroom','🛏️','Fairy lights and a soft duvet.',500,'common',40),
('env-cafe','environment','Corner Café','☕','Rain outside, coffee inside.',650,'rare',41),
('env-garden','environment','Moonlit Garden','🌿','Bamboo, lanterns, night air.',700,'rare',42),
('env-rain','environment','Rainy Room','🌧️','Window streaks and thunder hush.',720,'rare',43),
('env-winter','environment','Winter Cabin','🏔️','Fireplace crackle included.',780,'rare',44),
('env-romantic','environment','Candlelit Room','🕯️','Warm bloom, slow music.',1200,'legendary',45),
('expr-happy','expression','Happy','😊','Beaming, ears up.',100,'common',50),
('expr-sleepy','expression','Sleepy','😴','Half-lidded, very soft.',100,'common',51),
('expr-excited','expression','Excited','🤩','Stars in the eyes.',180,'common',52),
('expr-angrycute','expression','Angry-Cute','😾','Furious. Adorable. Both.',220,'rare',53),
('expr-dancing','expression','Dancing','💃','A little shimmy loop.',420,'rare',54),
('expr-crying','expression','Teary','🥺','For dramatic apologies.',200,'common',55),
('expr-blushing','expression','Blushing','😊','Rosy cheeks on cue.',260,'rare',56),
('expr-love','expression','In Love','😍','Heart eyes, full commitment.',480,'legendary',57);