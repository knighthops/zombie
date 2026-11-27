# Tester report: slice 2.1 (live build)

Fun: 6.5/10 against the 7/10 bar. Recon, defensive stance and 1x with full ammo made a tense, readable run. At default settings it is a fast wipe.

Build check: the live page served the OLD app.js from the browser cache after the push. I had to force-reload to see the new one. Manifest has "orientation": "landscape".

## Readability (844x390)
Readable. Buttons are 46-62px tall and body text is 13-16px. The map room labels and the room strip are small but legible. Two weak spots:
- Crisis body text is long and sits behind an inner scrollbar.
- The top bar plus the mission panel leave a cramped reading window on the Map tab.
Verdict: good enough, not generous.

## Rotated input (390x844)
Taps landed: the node, Prepare, Deploy, Advance, the crisis options (Focus fire, Fall back, Leave them), the after-action button, and New campaign. Elementfrompoint matched. I did not test a door or room tap on the canvas, because crises kept interrupting.
Gotcha for automated tools: screenshot coordinates are 488x1055, not 390x844 (about 0.8x).
Cosmetic issues:
- The sticky bottom button overlaps the content rows on the Campaign Over and after-action screens.
- A grey bar sits at the bottom edge.

## What I saw
- Risky Scavenge shows its odds: 60% clean, 30% hurt, 10% one killed. It works.
- Crises lock orders (greyed out) and a paused countdown is shown. Fine.
- Joel scar: the report said "scar 1/3, can't lead for 3 days". Works.
- Cold Storage is clearly harder: the intel shows 2 crawlers and a pack behind the freezer doors. My team entered all tired and was out of ammo about 20s in.
- Chapter ending ("The long night is coming") showed from a stale save. I could not trigger it myself.
- The crawler never appeared in Mission 01, only in the intel text.

## Bugs
1. (Phone) Stale cache after deploy serves the old build, with no version bump visible.
2. (Phone) Reloading mid-session always shows the Prologue journal first.
3. The scavenge odds text is tiny and wraps in portrait.
4. The Joel-down crisis text still shows "DOWN" in the roster after the objective changes.
5. After one lost mission the first campaign ended: "squad is gone". Harsh.
6. The console was clean.

## Notes for DESIGNER (ranked)
1. Ammo is the real killer. 150 rounds are gone in about 25s at 4x. The speed setting persisted at 4x between runs. Default to 1x.
2. A wipe on Mission 1 with the default loadout is too punishing and feels unfair.
3. Show the starting loadout max or a "recommended" hint.
4. Cold Storage starts everyone tired. Resting should be signposted.
5. The crawler needs an on-screen payoff.

## Notes for UI
1. Fix the overlap of the sticky button on the end screens.
2. Hide the crisis scrollbar or shorten the text.
3. Enlarge the scavenge subline.
4. Cache-bust app.js and styles.css.
