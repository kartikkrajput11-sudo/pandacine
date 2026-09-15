# First-person Archery rebuild

## Goal
Rebuild Archery to match the supplied reference: an over-the-shoulder shooting range with the archer and bow in the foreground, a movable crosshair, and a clear front-facing target.

## Changes
- Replace the current side-view range with a portrait-first, first-person/over-the-shoulder archery scene.
- Show the bow and archer along the left edge, a centered outdoor target lane, and a draggable crosshair over the range.
- Let the active player drag the crosshair to aim, hold to draw the bow, and release to shoot.
- Animate the arrow travelling toward the front-facing target, then leave the hit visibly embedded in the correct scoring ring.
- Keep wind and hand sway so accurate shots still require timing and skill.
- Add bow-draw, arrow-release, target-hit, miss, and match-result sound feedback that respects the existing sound setting.
- Preserve alternating turns, 3 rounds, scores, sudden death, multiplayer synchronization, reset, chat, and match results.
- Update the short instructions and status text for the new viewpoint and controls.

## Validation
- Test mouse and touch aiming in portrait mobile and desktop layouts.
- Confirm one release fires exactly one arrow and inactive players cannot shoot.
- Confirm ring scoring, turn changes, sounds, and multiplayer state still work.
- Confirm the scene is unclipped and readable on a narrow mobile screen.
