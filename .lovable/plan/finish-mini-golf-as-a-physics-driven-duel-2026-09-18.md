# Finish Mini Golf as a physics-driven duel

## Goal
Turn Mini Golf into the same skill-first, synchronized experience as Archery: players choose a line and power, then watch one deterministic simulation decide the result.

## Gameplay
- Keep the nine-hole, two-player, alternating-turn format and sudden death.
- Use a pull-back putt gesture with pointer capture, a clear projected line, and a stable power meter.
- Simulate rolling with fixed time steps, velocity-based friction, sub-stepped collision, and deterministic stopping.
- Make course boundaries and walls rebound the ball, bumpers add a stronger kick, sand apply heavy drag, and water stop the shot and return the ball with a penalty.
- Give the cup a visible rim, flag, shadow, and capture animation; slow centered balls sink while fast or glancing shots lip out.

## Match state
- Centralize golf constants in one configuration object.
- Record each completed putt with its player, hole, angle, power, start/end position, outcome, and stroke cost.
- Apply completed putts through a pure reducer so both devices store the same validated result and turn progression.
- Preserve the current room synchronization, chat, restart, score totals, stroke limit, and nine-hole progression.

## Presentation and feedback
- Recompose the course as a wider, premium mobile-first play surface with clearly distinguishable turf, walls, bumpers, sand, water, cup, balls, and motion trail.
- Add rolling, collision, sand, splash, cup, and match-result sounds through the existing sound preference.
- Add concise shot feedback and a final-score overlay with replay and exit actions.

## Validation
- Verify ordinary rolls, wall and bumper rebounds, sand slowdown, water reset/penalty, cup capture, lip-outs, alternating turns, hole advancement, final scoring, restart, and sound toggle.
- Check desktop and narrow phone layouts for clipping and touch behavior.
- Run the project type check and a browser gameplay pass.
