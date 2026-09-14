# Direct-drag Tank Shot aiming

## Goal
Replace the angle controls and Fire button with a harder, touch-first aiming gesture while keeping each tank’s cannon direction independent.

## Changes
- Remove the angle and power bars and the separate Fire button.
- Add a draggable aiming target directly over the battlefield for the active player.
- Convert the target’s position into shot angle and power, showing the dotted path while dragging.
- Fire immediately when the player releases their finger or pointer.
- Store separate aim values for tank 1 and tank 2 so one cannon never mirrors the other.
- Update the quick rules and small aiming status to explain the new gesture.
- Preserve current damage, turns, multiplayer synchronization, sound, pause, and match-result behavior.

## Validation
- Check touch and mouse dragging on portrait mobile and desktop.
- Confirm releasing fires once, inactive players cannot aim, and both cannons retain independent directions.
- Confirm the page remains type-safe and visually unclipped.
