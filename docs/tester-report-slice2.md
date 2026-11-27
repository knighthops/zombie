# TESTER report: Zombie slice 2, live build (2026-11-27)

**Fun: 7/10** (was 6/10). Phone shell is fixed and a real day loop now exists: crisis, loss, scavenge/rest, recovery, rescue, Cold Storage. Early missions bite. The second building is a walkover.

## Hosting check: PASS with one gap
- https://knighthops.github.io/zombie/ redirects to zombie-v1.1/dist/ (200). styles.css and app.js load (200). Console is clean.
- **No manifest.** `manifest.webmanifest` is 404 and the page has no `<link rel=manifest>`. The only icon is an inline SVG data URI. icon.svg, icons/icon-192.png and favicon.ico are all 404. "Add to Home Screen" works as a plain bookmark. There is no standalone mode, no home-screen icon and no start_url to test.

## Played (390x844, 4 missions, days 12-17)
1. Day 12, 5-man, no recon, vehicle. Lost: Ruiz and David KIA, Joel dragged out, 0/6 civilians.
2. Days 13-14 Scavenge then Rest.
3. Day 15 recon, foot, 4 troopers. Barricade fell at once, I pushed, took 2 of 3 civilians. Marco joined.
4. Day 16 finished Convenience Shop. Day 17 Cold Storage cleared with 0 losses.

## What improved
- **Phone shell works.** MAP, ROSTER and Home are reachable. New campaign is now a single button at the bottom of Home. The mission HUD (map, roster strip, stance, 5 commands) fits one screen.
- **Crises have teeth.** Cover and stabilize at 22% worked, then Ruiz dropped again 20s later. "It didn't take. The med is gone and Joel is still down" is a real failure.
- **The "No order in time: squad leader's call" default is now fair.** The window pauses and shows a countdown.
- **There is a recovery path.** After the wipe: "Joel can't lead 2 days: scavenge or rest", with Shannon solo (+80 rounds, +1 med). Rest drops the barricade -20.
- **The "Who comes out today?" trade-off (escort vs shooter) is good.** Recruits (Marco, Anya) and a "New signal" unlock give forward pull. Infected drift in overnight.

## Still flat
- **Scavenge is a free action.** +80 rounds and +1 med with no real risk. It is the dominant move.
- **Cold Storage is too easy.** It was cleared in 33s, 0 losses, the bloater "Hold ground" was free, and the ending came as a bare "last signal". I never saw an ending screen: "SEE HOW IT ENDS" just left me on the mission HUD.
- **Zombies are still red dots.** Only armoured, screamer and bloater are named.
- **The last rescue is a one-button window.** "Take all 1" is not a decision.
- **Joel is still protected** ("dragged out... at a price"), so his death is never at stake.

## Bugs (phone first)
1. **"SEE HOW IT ENDS" dead-ends** on the stale mission HUD. Hidden DOM: after returning to Home the old mission text stays in the page.
2. **Map overlap.** "Signal triangulation: 61%" overlaps the HOME label. The map's "?" and HOME markers are cramped.
3. **Bloater crisis fires at 00:00**, as the team enters. Recon was meant to give warning. Command Window countdown (9-12s real time) runs while paused and is tight when tapping a phone.
4. I could not verify Seal Door by tapping doors on a phone. The map was ~370px wide.
5. The Day 12 first screen reads like a loaded save: "Day 12" with a stale Prologue.

## Notes for DESIGNER (ranked)
1. Make Scavenge risky (injury or noise roll, and the barricade -20 hurts).
2. Scale Cold Storage up: more runners, a crisis that cannot be solved by Hold.
3. Let Joel die or be maimed, so the leader is not protected.
4. Add a proper ending/credits screen.
5. Add more zombie types (runner pack, crawler) so rooms differ.

## Notes for UI (ranked)
1. Ship a manifest and icons (192/512 PNG, start_url `./`).
2. Fix "SEE HOW IT ENDS" and clear stale mission DOM on Home.
3. Move the triangulation label off HOME; enlarge door tap targets.
4. Give the crisis countdown a visible bar.
