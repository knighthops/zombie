# UI pass 1 (2026-11-27, after slice 2)

Phone first (390x844), then desktop (1440x900). No game rules or numbers changed. Files: `zombie-v1.1/dist/` index.html, styles.css (new block at the end, "ui pass 1"), app.js (visual-only edits), plus new `manifest.webmanifest`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`.

## Home-screen app
- `manifest.webmanifest`: standalone, portrait, relative `start_url`/`scope` (`./`), dark background and theme color, 192 and 512 icons (512 is also maskable).
- `apple-touch-icon` 180px: a red pulse line through a cyan ring on the dark grid, which matches the favicon.
- The status bar is now `black-translucent`, so the app fills the screen behind the notch. Every top bar pads by `safe-area-inset-top`. Story, result, ops and combat pad for the home bar, and in landscape they pad the sides too. `viewport-fit=cover` was already there.
- Also added `color-scheme: dark`, `format-detection: telephone=no`, no text-size inflation, no long-press callout or selection on buttons and the canvas, and `100dvh` screens.
- A live mission pauses itself when the app goes to the background (`visibilitychange`). Before this, an unattended mission kept running and its crises timed out to defaults.

## Per screen
- **All screens (bug):** on phones, the slice 2 rule `.combat-screen{display:flex}` overrode `.screen{display:none}`. An empty combat screen rendered under the story, ops and prep pages, which made them about 840px too tall. Only `.active` shows it now.
- **Story:** the eyebrow on the paper uses ink red instead of cyan, which you couldn't read there. The top and bottom are safe-area padded.
- **Ops map:**
  - On a phone, the "Sector 7" caption has moved to the top left, so it no longer collides with the HOME label.
  - The day report (what the last day did) now also shows at the top of the brief on a phone. Before, it was below the objectives, at the very bottom.
  - Disabled actions read as status plates instead of live buttons. For example, "Joel is recovering · 2 days" is now amber on a dashed plate, and recon and scavenge are dimmed.
- **Deployment:** on a phone, the Deploy button is fixed above the home bar, so you no longer scroll about 1500px to find it. FIT status is green, not amber. The selected cards get a green edge.
- **Combat HUD:**
  - The objective is back on phones as a strip under the title. It was hidden on mobile.
  - Squad chips have an HP bar. When a trooper is down, the bar is a bleed-out bar on a red chip. Below 40% HP the chip turns amber.
  - Command pips are larger.
  - Noise shows the next wave: "27 / 30". It blinks amber within 8 of the wave.
  - Pause, speed and stance buttons are 44px. Pause turns amber while paused.
- **Battlefield canvas:** when the canvas is drawn small (a phone), it scales room labels, door timers, ENTRY, the civilians' %, unit and zombie markers and the "?" fog up, up to about 2x for text and 1.3x for markers. It changes drawing only, not hit areas or sim positions. Downed troopers get a pulsing red ring.
- **Feedback:** short screen-edge flashes play on the battlefield:
  - red when a trooper goes down
  - amber for a noise wave, a scream, or a sealed door giving way
  - yellow-green when a bloater bursts

  All of them respect `prefers-reduced-motion`.
- **Crisis:** the card has a heavier red top edge. In the last 4 seconds the card pulses and the timer turns orange. On a phone it has a solid backing, so the log no longer bleeds under it.
- **Results:** the card's tone follows the outcome: green for success, amber for a retreat or the chapter end, and a red card and backdrop for overrun or "The squad is gone". Wounded rows are amber and dead rows are struck through. On a phone the button is full width.

## Verified
- At 390x844:
  - Story, ops, rest day, prep and combat.
  - Crises: a trooper down, "who comes out", and the bloater.
  - The results screen, the game over (forced by setting the roster dead in devtools) and the new campaign.
  - Seal through the pick bar, with 44px buttons.
- At 1440x900: ops and combat with a crisis.
- The manifest and icons load with 200. The console has no errors apart from a stale 404 from loading the wrong path first.

## Not verified
- A real iPhone home-screen install: the safe-area insets, the translucent status bar and the icon mask. The local server sends no content type for `.webmanifest`. GitHub Pages does.
- The chapter-end screen ("The long night is coming").
- Scavenge with fit troopers.
- The reduced-motion path. It is code only, not seen.

## Notes for DESIGNER
1. **Orders during a crisis.** While a crisis is open you can still arm Advance or Seal and spend command, because the sim is paused. On a phone the pick bar then pushes the crisis options off screen. Should orders lock while a window is open?
2. **The canvas is small on phones.** The map is 390x240. Markers are readable now, but the squad stacks into one blob, and zombies in a group overlap. A zoom or a "follow squad" camera would help, and so would wider slot spacing, which is a sim change.
3. **The mission clock is hidden on phones** because the log head is hidden. Is elapsed time something the player should track?
4. **No day transition.** Rest and Scavenge re-render the page in place. The only feedback is the report line. A short "Day 13" beat would make the day choice feel weighty.
5. **A downed Joel stops command regen.** The chip says DOWN, but nothing on the HUD says "no regen". The text only shows in the desktop log panel, and that row is hidden on a phone.
6. **Story copy says "six people"** and the roster is 6 including Joel. Check this is intended.
