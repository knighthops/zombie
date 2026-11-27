# Tester report, slice 3 (v3.1)

**Fun 6.5/10 (was 6.5).** The loop has a real arc now, but one run showed a death spiral and a near-unwinnable finale. Only one chapter played, ending: bad ("The base fell").

**Chapter length:** day 12 to 29, 18 sim-days, roughly 20 real minutes (about 8 of them actual sim at 2x, the rest planning/idle).

**Run:** Mission 1 saved 1 of 6, then a retry saved 1 of 2 (+Marco). Mission 2 wiped twice. The base finally gave Cold Storage away for free. The Long Night fell with 2 defenders and 162 rds.

**Loop verdict:** the arc (mission, build, mission, night) reads well. Road events are the best new bit: short, one tap, with visible odds. Upgrades are plausible but I only afforded 2 in 18 days, so they never felt like a build. The hold/escort phase and the "Who comes out" card are good tension. Failing is too soft in one place and too hard in another:
- Abandoning Cold Storage (3 days of rest/scavenge while civilians die off) still resolved it: "+2 parts, Cold room". Failure pays.
- Resting or scavenging drops the barricade about 20 per day, so mission 2 started at 1% barricade and was unwinnable. It punishes the very choices the screen offers (REST says "barricade −20", fair, but scavenging does it too and says nothing).
- Wipe handling works (campaign continued), but a 3-soldier roster, 0 rds, and Joel at "−40 HP · cmd 20s" is a spiral with no recovery tool.

**Clarity verdict:** mostly good. Terse labels (Walls 4, Infirmary 3) were clear after one read. Cryptic: "Walls 4 / Night: 100%, back shut" (what is back shut?), "Horde in 1 day", and "Tired ... −15% hit" appearing with no fix shown. The "Ammo 162 · night needs ~250" warning is excellent and was accurate.

**Shelter finding: CONFIRMED.** With Walls built: 100%, 98, 84, 69, 51, 31, 9, breached, over about 18 real seconds at 2x (about 36-40 sim s). Ammo had barely been touched (162 to 131). Raid 1 alone broke it. The shelter drops 15-20% per 3s regardless of defenders. Then 1:42 of dawn remained, I ran dry 44s early. Ranking: Walls do not visibly matter; the night is lost in the first minute.

**Bugs:**
1. Portrait (390x844) renders the UI rotated 90 degrees and clipped; ending screen unreadable. (Intentional rotate?) Needs a message or a layout.
2. Dawn clock freezes for seconds at a time (1:42 held about 12s) while "breached"; ambiguous whether paused.
3. Crisis card text is not in page text/innerText main; the guide must quote from screenshots. Accessibility gap.
4. Escort phase: a civilian count mismatch ("3 civilians lost" after "Walk 4 out", 2 trapped, 1 saved on a 6-civilian job); losses are hard to trace on screen.
5. `map-hold` and `map-crisis` captures are byte-identical (same paused frame); `map-early2.png` is a stray from a timed-out run.

**Notes for DESIGNER:**
1. Shelter drain: slow it about 3x or make Walls matter (show the % it buys). Currently unwinnable with 2 defenders.
2. Do not pay "+2 parts, Cold room" when all civilians are dead; reward by civilians saved.
3. Stop barricade decay compounding into 1% at mission start; floor it or let rest repair it.
4. Parts income is too thin for 5 upgrades; Walls first is a forced pick.
5. Add a recovery path after a wipe (a recruit event, not only a lone volunteer).

**Notes for UI:**
1. Say why you are tired and how to clear it.
2. Explain "back shut" in 2 words.
3. Show the upgrade effect on the night briefing (Walls: shelter 100% to X% per raid).
4. Fix portrait.
5. Put crisis text in the DOM text.
