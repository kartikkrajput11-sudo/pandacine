# Rebuild Tank Shot Presentation

## Goal
Turn Tank Shot into a polished portrait-first mobile mini-game while preserving its current shot physics, damage rules, multiplayer synchronization, authentication, and stored game systems.

## What will change
- Replace the generic game card with an open, full-height illustrated battlefield that visually dominates the screen.
- Add a compact symmetrical player header with avatars, names, animated health bars, damage trails, and a centered turn indicator.
- Redraw both tanks as rounded character-like machines with tracks, wheels, turrets, shadows, subtle idle motion, and smoothly rotating cannons.
- Add a live dotted trajectory preview tied to the existing angle and power values.
- Reorganize controls into a reachable bottom dock: angle, power slider, and a prominent Fire control.
- Enrich the existing projectile animation with a trail, recoil, muzzle flash, smoke, impact particles, damage feedback, and restrained battlefield shake.
- Add polished turn transitions and an end-of-match overlay with result summary and restart/back actions.
- Add a lightweight pause sheet with sound, rules, resume, and exit actions, using the app’s existing sound preference.
- Add a portrait-orientation prompt for short landscape phone layouts and safe-area spacing for modern phones.
- Keep shared room status and in-game chat available without letting them crowd the battlefield.

## Technical details
- Limit gameplay changes to presentation state inside the Tank Shot route; continue calling the existing `tankFire` result function unchanged.
- Build the environment and tanks as responsive inline SVG so visuals remain crisp without new image assets.
- Use semantic PandaCine theme tokens and scoped Tank Shot styles/animations, with reduced-motion fallbacks.
- Use the existing Button component for commands and preserve `DuoGameFrame`, room routing, invite flow, reset behavior, and GameChat.
- Complete route metadata with Tank Shot-specific Open Graph and Twitter fields.

## Validation
- Check type safety.
- Verify the game loads and remains usable at mobile portrait and desktop sizes.
- Confirm angle/power controls, firing, impact feedback, restart, rules, pause, sound toggle, and result state remain operable.
