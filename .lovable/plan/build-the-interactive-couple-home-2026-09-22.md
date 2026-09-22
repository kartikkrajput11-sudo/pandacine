# Build the interactive Couple Home

## Goal
Replace the current card-heavy home screen with a living shared space that makes the couple, their panda, and today’s shared activities the center of the app. Existing pages and data stay intact.

## What will change

### 1. Shared home scene
- Add a large first-screen couple scene showing both partners, their shared panda, current mood, and whether the partner is online or keeping activity private.
- Use the existing panda artwork and lifecycle state rather than creating a second pet system.
- Add restrained ambient motion, tap reactions, and sound effects that respect the existing sound setting and reduced-motion preference.

### 2. Today together
- Combine the existing streak, daily question, mood check-in, memory of the day, and anniversary countdown into one ordered daily journey.
- Show clear completed, waiting-for-partner, and next-action states.
- Keep each existing action and its current real-time behavior; this is a presentation and composition upgrade, not a replacement of working logic.

### 3. Fast couple actions
- Surface Hug, Kiss, Nudge, Chat, Watch, Play, and Memory directly beneath the shared scene.
- Reuse the current message and navigation flows, including partner-required checks and feedback.

### 4. Date and story destinations
- Replace the long tile catalogue with focused groups for “Tonight”, “Our story”, and “Our world”.
- Connect the existing Movies, Games, Letters, Timeline, Memories, Calendar, Journal, Panda Shop, Wallet, and Arena pages.
- Preserve access to every current home destination while reducing visual clutter.

### 5. Empty and private states
- Give users without a partner a purposeful invite-first home.
- Respect the existing activity visibility setting everywhere partner presence appears.
- Handle loading, missing panda, unbonded panda, and unavailable partner states without blank areas.

## Technical details
- Rebuild the authenticated `/app` home and extract focused home-only components where helpful.
- Reuse `useProfile`, current presence, panda lifecycle, daily question, streak, memories, wallet, and existing quick-action logic.
- Avoid new database tables or migrations for this first release.
- Use existing semantic theme tokens and button components; support both current light and dark themes.
- Add unique home-page metadata.
- Validate the signed-in flow, interactions, sound preference, reduced motion, and layouts at phone and desktop widths.

## Result
The first screen becomes the app’s emotional and functional center: users immediately see their shared world, what their partner is doing, what remains today, and the fastest ways to spend time together.
