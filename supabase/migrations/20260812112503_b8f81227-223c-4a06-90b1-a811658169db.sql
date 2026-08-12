REVOKE EXECUTE ON FUNCTION public.revive_pet(), public.retire_pet(text), public.bond_pet(),
  public.award_activity(text, integer), public.record_game_result(text, boolean, text),
  public.current_tournament(), public.settle_tournament(uuid),
  public.leaderboard_messages(integer), public.leaderboard_wins(integer),
  public.tournament_vote_count() FROM PUBLIC, anon;