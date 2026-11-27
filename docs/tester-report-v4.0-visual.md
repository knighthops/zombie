> **Correction (lead, 2026-11-27):** this check mostly saw the OLD 2D renderer. The browser had a cached index.html (Pages sends max-age=600), so app.js v3.3 ran with no three.js. The unit notes about letter discs, olive dots and dark floor describe the 2D map. Checked against the real 3D capture (docs/guide/img/map-hold.png), only note 1 holds: the six squad members stack on one spot. Notes 5 (rotated crop) and 6 (caching) still need checking.

# TESTER: v4.0 visual check (three.js battlefield)

Scope: Shop mission only (Cold Storage / Long Night not reached). 844x390 plus one 390x844 rotated check.

**Deploy:** GitHub Pages lagged. For several minutes the live site served index.html with app.js?v=3.3 and battle3d.js 404. After the build finished (commit 4e9e3b4) a reload loaded battle3d.js?v=4.0 and app.js?v=4.0. three.js r128 loaded from cdnjs (THREE, Battle3D defined, one 1100x680 canvas). Only console error: one unnamed 404 (probably favicon).

**Visual score:** old flat map 5/10, new 6.5/10. Rooms, doors, shelves and room labels are clearer. The units are what drags it down.

**Readability verdict:** map yes, units no. Rooms, doors and the entry arrow read instantly. At 844x390 the six squad members pile into one multicolour blob of letter discs. I could not see facing cones. Infected are small red dots that clump into red smears. I never saw an elite, runner afterimage, skull or downed ring in the short fight, so those are unjudged. Civilians (olive dots) are tiny and easy to miss. Floor and background are very dark, so contrast is low.

**Interaction:** room taps worked in both orientations (squad re-routed and the "moving into the shop floor" log line fired). I only tapped one door, with no clear result. Rotated, the whole UI is CSS-rotated and the map's right column (Stockroom) is cut by the edge.

**Smoothness:** not measured. The pane was hidden, so rAF stalled, and no stutter was visible in screenshots.

**Bugs:** none from z-fighting, clipping or wrong scale. The only issue is the 404.

**Notes for UI, ranked**
1. Spread or ring the squad, or add a leader marker, so six units are separable.
2. Bigger infected, with a darker outline against the floor, and clusters that stay countable.
3. Brighten the floor and wall contrast.
4. Enlarge civilian markers.
5. Fix the rotated crop on the right-hand room.
6. Bump the cache version on every release so Pages never serves a stale mix.
