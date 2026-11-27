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

# UI pass 3: less text (2026-11-27, after slice 3)

The request: don't overexplain. Cut sublines and tutorial sentences, keep name + one number, and spend the space on bigger key text. No rules or numbers changed. Cache-bust is now `?v=3.1`. Files: `index.html`, `app.js` (copy strings, `showResults`, `showEnd`, `updateForecast`, crisis cards, a `narrow` class in `fitView`), `styles.css` (new block at the end, "ui pass 3").

## Word count (visible copy, 844x390)
Counted with `#app.innerText` on the active screen, same flow before and after (fresh campaign, police-car road event, first crisis, the chapter ending with the same seeded end state).

| Screen | Before | After |
|---|---|---|
| Prologue | 86 | 64 |
| Ops map (brief + chapter panel) | 195 | 136 |
| Deployment | 162 | 91 |
| Road event | 26 | 22 |
| Combat HUD | 81 | 63 |
| Combat + "Who comes out" crisis | 145 | 98 |
| After-action | 76 | 54 |
| Ending | 98 | 60 |
| **Total** | **869** | **588 (−32%)** |

The after-action runs were different outcomes (withdrawn vs overrun), so that row is close, not exact.

## Tester notes done
- **Sticky button over rows (after-action, ending, also Deploy).** The card is now a flex column: `.result-body` (and `.doctrine-body` on deployment) scrolls, and the button sits under it, outside the scroll. Nothing slides under a button any more, in either orientation.
- **Crisis scrollbar.** The copy is one short line, so the card fits the map at 667x375, 844x390 and rotated (scrollHeight = clientHeight, measured). Overflow is hidden and the scrollbar is suppressed as a backstop.
- **Scavenge odds.** Its own line: `60% ok 30% hurt 10% KIA` at 14-15px, coloured green, amber, red. Who goes and the haul sit on the line above.
- **404.** The icon link now points at `icon-192.png` (was an inline SVG data URI). Every request on a fresh load is 200. A browser that asks for `/favicon.ico` on its own would still get a 404; there is no .ico in dist.

## What was cut, by screen
- **Prologue:** both paragraphs shortened, the hand note is one line ("Tess: survivors at the shop."), the button says "Open the map". The journal voice stays.
- **Ops:** removed the zone tagline, "HIGH PRIORITY", "OPERATIONS HUB", "Signal triangulation", the APPROACH label, and the STRUCTURE and LOOT tiles (flavour). The place moved into the brief header. Briefs are one line. INFECTED and BARRICADE are 24px. Recon is one line ("Recon · Barricade −10 · map · −3 infected"). The hub line bolds the numbers. Chapter rows show only non-zero counts. Build buttons: name, cost in amber, a 2-3 word effect.
- **Deployment:** no eyebrow or "Standing orders" heading. Stances are one row of three with a 2-3 word tag each. Traits are 1-2 words ("Close · loud", "Fast · quiet"; Joel "Can't die · scars", or "Scars 1/3 · −20 HP · cmd 16s"). Intel rows: INFECTED, SPECIALS, BARRICADE, NOISE ("15 / 30"), TEAM. At night the labels switch to RAIDS ("7 · dawn at 02:30"), SHELTER and WAYS IN.
- **Road event:** title, one short line, then the choices as big side-by-side cards with the cost in amber ("+40 rds · +10 noise", "—" for no cost).
- **Combat:** the OBJECTIVE label is gone, so the objective itself is 16px. Command pips are 24px, noise 22px, ammo 20px. Order costs use the command pip ("●", "● · 20s"). The opening log lines (they flash in the ticker) are short.
- **Crises:** header "PAUSED" plus the seconds; a one-line situation ("Checkout · 5 close · bleeds out 20s"); options are verbs with their cost ("Drag clear · ●● · Mike carries 6s", "Patch up · ● + med · 22%", "Leave · Free · lost for good"); footer "No call → focus fire". Title 30px, options 18px.
- **After-action:** one line that says only what the numbers don't (e.g. "3 lost in the scramble.", "Marco joined."). Tiles: SAVED 3/6, KILLS, ROUNDS, TEAM LOST at 32px. Rows: name + "OK", "Out 2d", "KIA", "Dragged out 3d", "Out 2d · scar 1/3". The base line is one row of numbers.
- **Ending:** one summary line, the same tiles, places as three tiles, and the team in three columns ("Alive", "Wounded", "KIA · day 15", "2 scars"). The "progress stays on this device" sentence is gone.
- **Day reports** (the amber note on the ops map) are about half as long: "Day 14: 4 rescued, lost David. +8 infected overnight."

## Slice-3 screens laid out
- **Road event:** a centred card, the choices fill the width, 96-110px tall.
- **Upgrades:** a 3-column grid of name + cost + effect. Built ones turn green with a ✓.
- **Long Night:** the brief, the "Ammo 119 · night needs ~250" line and "Man the walls" fit the first screen. Deployment intel is night-specific. The HUD objective reads "Dawn in 01:51 · shelter 31%".
- **Endings:** Dawn, The base fell, Into the rain, and the campaign-over cards all use the same layout and tone colour.

## Narrow rail
At 667 wide the rail is 236px, and "CONTROLLED" did not fit (86px of text in a 69px button). That bug was already there before this pass. `fitView` now sets `html.narrow` when the app is under 760px wide. The stance buttons then show DEF / CTRL / AGGR (with aria-labels), and the order buttons drop their letter spacing. At 844 and up the full words fit at 13px.

## Verified (browser pane, Chrome emulation)
- 844x390, 667x375 and rotated 390x844. Every screen: story, ops (day and night), deployment (day and night), road event, combat, a crisis, after-action, ending. An automated check found no text under 13px, no button under 44px and no button text overflowing. The one exception is the map node label "NO SIGNAL", which sits outside its node, as before.
- Real taps through the rotation (390x844): a road choice, "Take 3" in a crisis, Retreat.
- A full Long Night at 4x, ending on The base fell, then the ending screen.
- Console: no errors from the game. All requests on a fresh load returned 200.

## Not verified
- A real iPhone. The pane's screenshots were often stale or cropped, so layout was checked by measuring with JS, plus the screenshots that did render.
- True desktop width: the pane is phone-sized, and the "desktop" preset is also 390x844.

## Notes for DESIGNER
1. In one Long Night with Walls, the shelter fell from 100% to 31% in about 40s of sim while the team stood in the courtyard, and it fell before dawn. That may be intended, but it felt fast.
2. In combat, the chip status after "·" still truncates at 667 ("Shann…"). An icon for ESCORT or CARRYING would help.

# UI pass 4 (v3.3, after slice 3.1)

## Fixes
- **Portrait clipped (TESTER bug 1).** Root cause: the reduced-motion rule set `transition-duration:.01ms` on every element, so `#app` "transitioned" into its rotation. In a throttled or background page the transition never finished and the frame stayed unrotated at 844x844, clipping every screen, the ending included. Reduced motion now uses `transition:none`, and `html, body, #app` never transition. Rotated 390x844 (and 390x664) now measures 390x844 with every screen fitting; long panels scroll inside.
- **Crisis text in page text (bug 3).** The journal was an `<article>`, so text tools read the hidden prologue instead of `<main>`. It is a `<div>` now; the crisis title, copy, options and queue all show in page text.
- **Tired.** "All 6 tired · out yesterday · −15% hit · a day off clears" (names when 1-2). Rest says "Heal · clears tired".
- **Walls.** "Shelter 100% · 2 ways in" (was "back shut"). The night brief now shows SHELTER and WAYS IN, plus a WALLS row: "✓ Built" or "Not built", then "+30% shelter · −1 way in · drains ¼ slower".
- **Slice 3.1 labels.** Scavenge and Rest each get a cost line: amber "Barricade −15", or red "1 civilian dies". The dawn clock's pause is an amber "Ⅱ paused" tag. The brief has a REWARD row: "3+ saved · +3 parts · Safe house", "1+ saved · +1 part", turning green ✓ when met. The after-action base line says "is ours", "few saved" or "is lost · no reward". Civilian deaths are numbered rows ("Civilian 2 · taken by a crawler · checkout") in their own two-column block, with the room dropped when the cause already names it. At night the breach crisis is titled "Shelter breached", to match the HUD.

## Verified (browser pane, measured with JS)
- 844x390 and rotated 390x844 (plus 390x664): story, ops (day and night), deployment, road event, combat, crisis, after-action (with civilian rows), ending. Nothing outside the app, no clipped text, no text under 13px, no button under 44px.
- Console: no errors.
- The pane's screenshots were often stale, so layout was checked by measuring.

## Notes for DESIGNER
1. The "Who comes out" crisis offers Take all 6 / 3 / 1, but "No call → take 4", which is not one of the choices.
2. A run showed "SAVED 0/6" while the building paid "+1 part": `rescued` was 1 with 6 lost (7 of 6). Someone saved outside the mission (a road event?) seems to count toward the building's payout.

# UI pass 5: 3D battlefield (v4.0)

## What changed
- **New render layer, `battle3d.js`.** three.js r128 loads from cdnjs before `app.js`. When THREE is present and WebGL starts, `#battlefield` gets a WebGL context and `draw()` hands the live state to `Battle3D` (`m`, ROOMS, DOORS, EDGES, the building key and labels). It only reads that state. Game logic, rules and numbers are unchanged. Without THREE or WebGL, the old 2D canvas renderer runs as before.
- **Same taps.** The camera is an oblique orthographic view: the floor plane maps exactly onto the same 1100x680 canvas box, and height leans up the screen. `toMap`, `doorReach` (44px / ~80px), Advance and Seal are untouched, rotation included.
- **The look (approved mock v1.1).** Ruined, desaturated interior with soft non-repeating floors, ruined walls and debris. No base rings. The squad has teal facing cones and two-handed weapons; Joel has a gold star and the white reticle. Civilians have a dashed ring. Downed units show a pulsing red ring and pool. Infected are red with a faint haze. Elites (armoured, bloater) are purple with a glow and an icon. The screamer shows wave rings. Runners leave fading afterimages when sprinting. Skulls mark where a trooper or civilian died, and a crisis bubble sits over the unit or place it concerns. Sealed doors show planks and a countdown, and Seal arming shows the tap ring. Advance outlines rooms. Unseen rooms are fogged with "?". The civilians' corner is a fence whose colour follows the barricade.
- **Three maps, three prop lists.** Convenience Shop (shelves, counters, fridges, desks, dock, forklift). Cold Storage (chest freezers, conveyors, pallet racks, pumps and tanks, frosted floors). Home base at night (sandbags, fire pit, bunks, lockers, workbench, motor-pool truck, drums; moonlight and firelight).
- **Performance.** One WebGL context. Each figure is baked to about 6 draw calls and cloned from a template per type, and entity views are pooled. Walls, props and debris are instanced. Shadows are static (rendered once per map; units use blob shadows). The pixel ratio is capped at 2. The view renders only on the game's own draw ticks, and skips frames while the page is hidden. Reduced motion stops bobbing, pulses and spins.
- `?v=4.0` on styles, battle3d.js and app.js.

## Verified (browser pane)
- At 844x390: a mission on each map (shop, cold storage, Long Night). Seal was armed and a door tapped (shop, cold, night). Advance was armed and a room tapped (shop, night). Taps were dispatched to the canvas at computed map points, and `elementFromPoint` was the canvas.
- Rotated 390x844: Seal by tapping the shelter / motor pool door through the CSS rotation.
- 1440x900: renders at the larger size.
- Console: no errors.
- `docs/guide/img/map-hold.png` and `map-night.png` were recaptured from the 3D view (render, then `toDataURL`).

## Not verified
- A real iPhone (frame rate, heat, WebGL memory).
- The offline 2D fallback (code path kept, not exercised).
- Physical touch taps. Taps were synthesized click events with real coordinates.
