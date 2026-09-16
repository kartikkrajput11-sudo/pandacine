# Rebuild Archery as a complete 1v1 duel

## Goal
Replace the current target-drag shortcut with a genuine mobile-first archery duel where aim, launch angle, draw power, gravity, distance, and fixed per-round wind determine every shot.

## Gameplay
- Keep live partner and side-by-side modes, alternating turns, five arrows per player per round, three rounds, sudden death, restart, chat, and mute support.
- Separate aiming from charging: drag across the range to adjust horizontal and vertical aim, then hold the shoot control to draw the bow and release it to fire.
- Simulate each arrow frame-by-frame using deterministic projectile physics with velocity, gravity, wind acceleration, flight time, and velocity-based rotation.
- Compute the exact target-plane impact point and ring score; misses remain possible. Store each shot’s aim, power, wind, impact, score, and timestamp in synchronized match state.
- Use one shared wind value for both players in each round and keep it fixed throughout a shot.

## Presentation
- Recompose the game as a compact landscape shooting range that remains playable on portrait phones.
- Place the archer and animated bow on the left, the distant target down the center lane, player score panels across the top, and wind/aim/power controls along the bottom.
- Add an approximate fading trajectory guide, embedded arrows, hit particles, short score feedback, turn transitions, and a final score overlay with replay and exit actions.
- Keep the interface original, premium, uncluttered, and consistent with PandaCine’s existing colors and controls.

## Technical details
- Centralize all archery physics and scoring values in one configuration object.
- Extend the shared Archery state and pure shot reducer so both clients reproduce the same validated result instead of broadcasting a client-selected score.
- Preserve the current real-time room channel and host synchronization model; reject shots made out of turn or with out-of-range aim/power values.
- Respect reduced motion and the global sound setting.

## Validation
- Verify drag aim, hold-to-charge, one-shot-per-release, gravity/wind trajectory, collision, scoring, turns, final result, and restart.
- Check portrait phone, landscape phone, and desktop layouts for clipping and touch scrolling.
- Confirm multiplayer synchronization and run the project type check.
