# TESTER report — Zombie v1.1 (2026-11-27)

**Fun: 3/10.** The shell is moody and promising: the journal, ops map, deployment screen and crisis window. The mission itself is a 22-second auto-win with a scripted crisis, so nothing is at stake.

## Runs
- **Run 1:** full 6-squad, no recon, vehicle, controlled doctrine, command mode, at 4x. Cleared 29 zombies in 22s. David went down at exactly 00:15, and Emergency rescue saved him. 0 losses.
- **Run 2:** Joel, Ruiz and Gustave only, with recon, on foot, aggressive doctrine, observe mode. The forecast said RISKY (power 44). It still won in 18s with 0 losses and 75% ammo left. The scripted down-man was Gustave.

## Hooks
- The prologue and journal tone.
- The ops-map framing and the forecast panel.
- The crisis modal: its three options and countdown bar.
- Red dots swarming a floor plan.

## Boredom and confusion
- **No tactics in the fight.** Units auto-walk to a hardcoded x (330, 650 or 820) and auto-shoot. There is no cover, doors, noise, line of sight or pathing.
- **HP-sponge zombies.** They have 32 HP, or 110 for the armoured type, and beeline straight at the squad.
- **Commands barely do anything.** MEDKIT is +35 HP to the lowest unit. FOCUS is -70 HP on one armoured zombie. RALLY and HOLD do nothing you would notice.
- **Command points never regenerate.** The pool is 3, and a rescue costs 2.
- **The crisis text is generic.** It is the same for everyone, and the doorway it mentions never collapses.
- **Promised content is missing.** Civilians and the stockroom are only painted rectangles.

## Bugs
- The squad strip shows only 4 of 6 chips at 1024 width.
- **Result race:** results show after 500ms, but observe-mode downs resolve after 2400ms. A unit can be listed as DOWN while Team Losses reads 0.
- `dt=min(.04,…)`, so the speed controls barely work on a slow device.
- The crisis timer ticks per frame, not per second.
- The player can't act during a crisis.
- **Hollow success condition:** the win check is "all zombies dead OR elapsed > 70". A timeout counts as a win, and "rescued = 3" is hardcoded.
- The success text says "everyone is coming home" even when a trooper is injured or down.

## Do choices matter? Barely (checked in app.js)
- **Recon:** 24 zombies instead of 29, and +12 to the forecast. It has no time or supply cost.
- **Route:** only changes a label and one log line.
- **Doctrine:** changes movement, target x and fire cooldown. Defensive hardly changes the outcome.
- **Squad:** only Mike's shotgun and the scout's damage differ. Traits are ignored, and forecast power is `count*10 + recon + doctrine`.
- **Mode:** observe mode rolls a 45% death chance when a unit goes down.
- **Crisis:** always at 15s, always the same victim, always scripted.
- **Forecast:** never fed into the sim.
- **Persistence:** nothing carries over. Of the coreloop.png loop (Plan, Deploy, Traverse, Engage, Resolve, Upgrade, Expand), only 3 of 7 steps exist.

## Notes for DESIGNER (ranked)
1. **Make choices causal.** Recon, route, roles and traits should change spawns, noise and outcome. Remove the timeout win and the fixed crisis.
2. **Add real stakes.** Losses, a failure state, permadeath or lasting injuries, scarce ammo and meds, and persistence across missions.
3. **Give combat spatial depth.** Doors, chokes, cover, line of sight, noise, a stockroom incursion, and real civilians. Make the commands matter.
4. **Make crises dynamic.** Trigger them on real events, pick the victim from who is really in danger, and give the options real costs.
5. **Fix the bugs above.**
6. **Make the forecast honest.**
7. **Pace the mission.** Add waves and escalation to build dread.
