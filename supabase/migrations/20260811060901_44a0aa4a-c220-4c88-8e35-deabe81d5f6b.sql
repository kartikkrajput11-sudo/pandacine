CREATE OR REPLACE FUNCTION public.spend_luvies(_user uuid, _amount integer, _reason text, _ref text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('luvies:' || _user::text));
  SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal
    FROM public.profiles WHERE id = _user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF bal < _amount THEN
    RAISE EXCEPTION 'Not enough Luvies: need %, have %', _amount, bal;
  END IF;
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET panda_coins = bal - _amount, coins = bal - _amount WHERE id = _user;
  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (_user, -_amount, _reason, _ref);
  RETURN bal - _amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_luvies(_user uuid, _amount integer, _reason text, _ref text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal integer;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('luvies:' || _user::text));
  SELECT GREATEST(COALESCE(panda_coins,0), COALESCE(coins,0)) INTO bal
    FROM public.profiles WHERE id = _user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Profile missing'; END IF;
  PERFORM set_config('app.privileged_profile_update', 'on', true);
  UPDATE public.profiles SET panda_coins = bal + _amount, coins = bal + _amount WHERE id = _user;
  INSERT INTO public.coin_ledger (user_id, delta, reason, ref_id)
    VALUES (_user, _amount, _reason, _ref);
  RETURN bal + _amount;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_luvies(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_luvies(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_luvies(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_luvies(uuid, integer, text, text) TO service_role;