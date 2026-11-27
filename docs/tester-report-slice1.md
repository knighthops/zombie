# TESTER report: Zombie slice 1 (2026-11-27)

**Fun: 6/10** (was 3/10). The shop is now a fight I can lose. Four troopers died across the runs. Two crisis windows made me sweat. The loop falls apart after the first building.

## Runs (4 missions across 3 campaigns)
1. **6-man squad, no recon, controlled.** Won. 46 infected down, 0 lost. A bloater burst killed 2 civilians while I was away from the crisis window. 2 of 6 civilians rescued.
2. **Joel, Mike and David, recon, aggressive, all tired.** Lost Mike and David. The squad was overrun in 25s with 12 infected down, and Joel went down too. A death-spiral start.
3. **Joel, Shannon, Ruiz and Gustave on day 3 with 7 rounds left.** Lost Ruiz and Gustave. Played at 375x812.
4. **New campaign, 4-man, recon, fire-at-will off then on.** Lost Ruiz and Gustave again. Last run was Joel, Mike and David on foot, defensive: 0 lost, 1 of 6 civilians out.

## What improved
- **Real stakes.** Permadeath, "KIA" in the roster, ammo and meds that carry over, and fatigue ("TIRED") all work.
- **Crises are tied to real events.** Examples: "Mike is down... bleeds out in 15s", drag/stabilize/leave, "barricade is down", "who comes out". They carry real costs: command points, a med, the carrier can't fire. The sim slows to 0.25x while a window is open.
- **Choices cause outcomes.**
  - Hold fire kept noise at 34 where run 1 reached 66.
  - Foot gives arrival noise 0 against 25 by vehicle. The vehicle is the silent default's opposite, and it is selected by default.
  - Recon revealed the bloater room.
  - Seal Door logs "wedged shut, about 20 seconds" and the barricade gives way later, so it works on desktop.
  - A Push order saved 5 civilians in run 4.
- **Noise waves land at 30, 60 and 90.** That gives pacing.
- **The after-action report is honest about losses.** "Killed in action", "Killed, left behind" and "Wounded, out 2 days" all show.

## Still flat
- Zombies are a swarm of identical red dots. There are no special types beyond armoured and the bloater.
- The bloater and the barricade collapse happen on a timer I can't influence. Barricade on arrival drops with every failed day, so day 3 starts at 7-16% and the first crisis is forced.
- Run 1 was too easy: 6 troopers killed 46 with 0 losses. Run 3 was unwinnable: 7 rounds, 4 civilians dead before I acted.
- The prompt says "Cover and stabilize... may fail", but it never failed in my 3 tries, so the risk isn't felt.

## New bugs
1. **Mobile (375x812): MAP, ROSTER, ARCHIVE and New campaign are hidden.** The buttons exist (`display:inline-block`) but `offsetParent` is null. There is no way to reach the roster or restart on a phone.
2. **Mobile mission layout.**
   - The title "Convenience Sh..." is clipped and "MISSION 01 · LIVE" wraps.
   - The page scrolls vertically at 884px against a 812px viewport.
   - There is dead space above the map.
   - The map is about 375px wide, so the doors are ~8px targets.
   - Crisis modals cover the title.
   - I could not confirm that Seal Door works on a phone. A crisis popup intercepted my tap.
3. **Defensive stance stalls extraction.** In run 4 the squad sat in the stockroom at "Extract 1 civilian · west door" for over 90s (the clock reached 03:47) with no hint. Switching to Controlled finished it immediately.
4. **Crisis timeout is easy to miss at 4x.** Runs 1 and 4 resolved to "No order" because my reply lagged. Run 1 killed 2 civilians that way. The countdown should pause or slow more.
5. **Result text is wrong.** "For once, everyone is coming home" showed with 1 civilian dead and 4 left behind.
6. **After a failed building there is no way forward.**
   - Day 15, mission 01 "Resolved - 2 rescued, 4 lost", 1 trooper ready, 0 rounds.
   - Cold Storage stays "NO SIGNAL" and nothing else can be played.
   - There is no game-over screen and no prompt to restart on mobile.
7. **Seal mode stays armed.** The "Seal: click a door on the map" prompt stays after a crisis window opens.
8. **A downed Joel gets auto-extracted ("dragged out, barely").** He was fine (90 HP) before the squad went down. Story protection removes the tension of losing the leader.

## Old v1.1 bugs
- **Fixed:** the 22s auto-win; the scripted victim; the timeout win; the fixed crisis; command points not regenerating; crisis timers running per frame; "observe" mode and its result race; the crisis blocking the player (it is now a pause with a slow-down); hardcoded rescue count; recon and route having no effect; losses reading 0 while a unit is down.
- **Not fixed:** the success text ignoring casualties (bug 5). The strip showing only 4 chips at 1024 width was not re-tested. The speed controls are not slowed by a low frame rate. The sim now runs on real time.

## Notes for DESIGNER (ranked)
1. **Fix the mobile shell.** Bring back the nav, New campaign and roster, and make the doors tappable (bugs 1 and 2).
2. **Add a fail state and a recovery path.** A zero-rounds, half-dead roster needs a rescue mission, a supply run, or a game over (bug 6).
3. **Smooth the difficulty curve.** Barricade decay and ammo drain make day 3 hopeless after one bad day.
4. **Make crisis windows time-safe.** Pause or lengthen the countdown, and keep the default "No order" from being a punishment (bug 4).
5. **Fix the Defensive stall and the "everyone is coming home" text** (bugs 3 and 5).
6. **Give the zombies more variety** than red dots, and make Cover and stabilize actually fail sometimes.
7. **Add Cold Storage**, so the loop extends beyond one building.
