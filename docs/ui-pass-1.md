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

# UI pass 2: landscape (2026-11-27)

The request: the phone should always play sideways so it uses the whole screen, and the text was too small. No game rules or numbers changed. Files: `index.html` (crisis seconds, log ticker), `styles.css` (new blocks at the end, "ui pass 2"), `app.js` (`fitView`, `toMap`, `doorReach`, `draw` scale), `manifest.webmanifest`.

## How the landscape is forced
- `manifest.webmanifest` says `"orientation": "landscape"`, and `screen.orientation.lock("landscape")` is tried on load and on the first tap, inside try/catch. iOS ignores both, so:
- `fitView()` measures the visible size (`visualViewport` × scale, which follows the iOS toolbars; `innerWidth` can grow when a page lays out too wide). A phone is any screen with a short side ≤ 500 and a long side ≤ 1000.
  - Phone held sideways: `html.land`. `#app` is fixed to the measured size.
  - Phone held upright: `html.land.rot`. `#app` is sized to the swapped size and turned with `translateX(screen width) rotate(90deg)` from its top-left corner. The game reads correctly when the phone is turned counter-clockwise (top to the left).
  - It refits on resize, orientationchange (also 250 and 700 ms later, since iOS reports late) and visualViewport resize.
- Safe areas use `--sat/--sar/--sab/--sal`. In the turned mode they are remapped: the app's left edge is the notch (`safe-area-inset-top`), its right edge is the home bar (`-bottom`).
- In land mode the page never scrolls. A screen, or a panel inside it, scrolls instead, because a page scroll would run the wrong way when turned. `show()` resets those scroll positions.
- The old phone-portrait rules (`max-width:760px`) now apply only to narrow windows that are not phones (for example a 568px desktop pane), so they no longer fight the landscape layout.

## Input through the rotation
- `toMap()` takes the pointer and the canvas box back into the app's own frame before the letterbox math: app x = screen y, and app y = screen width − screen x. The box is rebuilt from `getBoundingClientRect` the same way. Buttons need nothing, because the browser hit-tests transformed elements itself. There is no drag in the game.
- Doors: a tap now takes the nearest door within `clamp(40/scale, 80, 120)` map units, about an 80px circle on a phone. Doors are at least 160 units apart. While Seal is armed, every door shows a pulsing ring of that size.

## Phone landscape layout (844x390, checked at 667x375 and 932x430)
- **Combat:** the map fills the left, height-limited. The rail width is whatever the map can't use, between 236 and 330px.
  - Right rail: the objective (2 lines), squad chips (3×2, with a 3px HP bar), the command pips with regen, noise "26 / 30" at 18px, ammo and meds, and the three stances in one row.
  - The orders strip under the map is 60px tall: Advance, Seal, Focus, Medkit, Retreat, plus Fire at will as its own cell. The speed controls are under the rail.
  - Arming Advance or Seal swaps the lower rail for the pick buttons.
  - The log is hidden. The latest line shows for 5s as a ticker at the top of the map.
  - A crisis covers only the map. Orders, stances and Retreat stay in view.
- **Ops:** the map sits on the left and stays put. The brief, the day actions and the chapter list scroll on the right.
- **Prep / roster:** two panels that scroll on their own. Deploy is pinned to the bottom of the right one.
- **Story:** a two-column journal that scrolls about 160px to reach the button at 375 tall.
- **Results / end:** one scrolling card with a 4-up stat row and casualties in two columns. The button is pinned at the bottom.
- An automated check on every screen at 667x375 and 844x390 found no text under 13px, no button under 44px and no sideways overflow. Body text is 15–17px. The canvas labels scale to about 12–13px on screen, and the markers about 1.7×. The backing store follows devicePixelRatio, so the map is sharp.

## Tester notes done
- The triangulation caption sits top left on every size, away from HOME.
- The crisis countdown is a 10–12px bar with a big seconds counter. Both turn orange in the last 4s.
- Door targets are big, as above.

## Verified (browser pane, Chrome emulation)
- 390x844 (turned):
  - Ops, prep, combat and results.
  - A real click on a crisis option (David is down; Bloater closing).
  - Seal by tapping the canvas: a real click 10px off the office/loading bay door sealed that door.
  - Advance by tapping the Aisles room.
- 844x390: the same taps (door 15px off centre, and a room), plus the pick bar.
- 667x375 and 932x430: rail fit measured, with no overlap. All screens audited at 667x375.
- The end screen at 844x390.
- 1440x900: desktop combat, with seal and advance taps through the unchanged desktop path. A narrow 568px pane gets the old portrait layout, not turned.
- Console: no errors apart from the 404 from loading the wrong path first.

## Not verified
- A real iPhone. Still to check there:
  - whether iOS hands touch scrolling correctly to the turned panels;
  - the safe-area remap with a real notch;
  - Safari's toolbar in the browser, not standalone, while turned;
  - the status bar, which will sit sideways along the app's left edge when the phone is upright.
- The pane's screenshots cropped the emulated view at times, so some checks were measured with JS, not seen.
- On the 844x390 real-landscape iPhone (bottom inset 21px), the rail has about 1px to spare. A two-line objective plus long chips is the edge case.

## Notes for DESIGNER
1. On a phone the squad markers still stack into a blob (ui-pass-1 note 2). The map is bigger now, but the slot spacing is a sim change.
2. When a chip is narrow, the status after "· " (ESCORT, CARRYING) can be cut off. Consider a shorter status word or an icon.
