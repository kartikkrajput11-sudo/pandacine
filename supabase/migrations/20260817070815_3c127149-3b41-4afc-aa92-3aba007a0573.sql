ALTER TABLE public.streak_recoveries ADD COLUMN IF NOT EXISTS declined boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.streak_recovery_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  declined_cnt integer := 0;
  bal integer;
  cycle text;
  broke_at timestamptz;
  expires_at timestamptz;
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
  SELECT COUNT(*) FILTER (WHERE NOT declined), COUNT(*) FILTER (WHERE declined)
    INTO used, declined_cnt
    FROM public.streak_recoveries WHERE user_id = me AND cycle_key = cycle;

  -- The streak officially breaks at midnight after the first missed day.
  broke_at := (gap_start + 1)::timestamptz;
  expires_at := broke_at + interval '48 hours';

  IF declined_cnt > 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'declined', 'balance', COALESCE(bal,0), 'cycle_key', cycle);
  END IF;
  IF used >= cfg.max_recoveries_per_cycle THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'already_recovered', 'balance', COALESCE(bal,0), 'cycle_key', cycle);
  END IF;
  IF now() >= expires_at THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'expired', 'balance', COALESCE(bal,0), 'cycle_key', cycle);
  END IF;
  IF COALESCE(bal,0) < cost THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'insufficient_luvies', 'cost', cost,
      'balance', COALESCE(bal,0), 'cycle_key', cycle);
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'ok',
    'lost_days', lost,
    'gap_start', gap_start,
    'gap_end', gap_end,
    'missed_days', (gap_end - gap_start) + 1,
    'cost', cost,
    'balance', COALESCE(bal,0),
    'cycle_key', cycle,
    'broke_at', broke_at,
    'expires_at', expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_streak_recovery()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  p_id uuid;
  st jsonb;
  cycle text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  st := public.streak_recovery_state();
  cycle := st->>'cycle_key';
  IF cycle IS NULL THEN RETURN jsonb_build_object('declined', false); END IF;
  SELECT partner_id INTO p_id FROM public.profiles WHERE id = me;
  INSERT INTO public.streak_recoveries (user_id, partner_id, cycle_key, lost_days, cost, declined)
    VALUES (me, p_id, cycle, COALESCE((st->>'lost_days')::int, 0), 0, true);
  RETURN jsonb_build_object('declined', true, 'cycle_key', cycle);
END;
$$;