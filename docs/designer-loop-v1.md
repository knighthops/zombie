# DESIGNER — Core loop v1 (2026-11-27)

Inputs: `zombie-v1.1/dist/app.js`, `docs/tester-report-v1.1.md` (3/10), `screens/` (coreloop, combat-1, map day/night, enemy ideas, deployment reference, story).

## 1. What's there

v1.1 is a well-dressed shell around a 22-second screensaver. The front end (journal, ops map with recon/route, prep screen with roster and doctrine, forecast panel, crisis modal) reads like a real command game. The fight underneath does not. `update()` walks every unit to a hardcoded x (330/650/820), auto-shoots the nearest zombie, and wins on `all dead || elapsed > 70`. The crisis at 15s always downs David. Nothing carries over between missions. **Strongest asset to keep: the commander fantasy.** You are Joel on a radio, not a soldier. You set intent, spend scarce attention (command points), and make the hard call when someone goes down. The crisis modal (three options, countdown, a name on it) is the best moment in the build, and combat-1.png shows the same idea grown up: a stance bar plus an "INTERVENTION NEEDED" queue. Build everything around making that call hard and earned.

## 2. Response to TESTER

1. **Make choices causal: Accept.** Every prep choice must feed a sim variable (noise, time, spawns, ammo). If a choice doesn't, cut it.
2. **Add real stakes: Accept.** Persistent roster, injuries and deaths, plus base stock of ammo and meds. Permadeath for everyone except Joel (story-protected, as the roster already says).
3. **Spatial depth: Adapt.** Use a room graph with doors and chokes, not free pathing, cover or line of sight. That gives about 80% of the decisions for 20% of the code.
4. **Dynamic crises: Accept.** Crises come from real events (a unit down, the bloater about to pop, civilians reached, ammo out). The victim is whoever is really in trouble. Options cost CP, ammo or time.
5. **Fix bugs: Accept.** Do these first. The result race, `dt` clamp, per-frame crisis timer, timeout win and hardcoded `rescued=3` all undercut any new design.
6. **Honest forecast: Adapt.** Don't hand-tune the formula. Run the real sim headless about 30 times and report the spread. Then it is honest by construction.
7. **Pace the mission: Accept, merged into noise.** Waves come from noise, not from a timer. The player causes the escalation, so the dread is their own fault.

## 3. The loop

The coreloop.png chain is Plan → Deploy → Traverse → Engage → Resolve → Upgrade → Expand, repeated within a Zone.

### Meta (Zone map, days)
- **Clock:** each day has a Day and a Night phase (map-daytime-1 and map-nighttime-1). A mission costs hours: recon +1h, on foot +1h, the vehicle +0h. Night missions get +40% spawns and a shorter warning before waves, but zombies are dormant, so the starting noise is lower.
- **Zone heat:** each building on the map has a threat level. Noise from a mission raises the heat of its neighbours ("Vehicle 2 alerted a massive horde!"). Leaving buildings alone lets the heat creep up each day.
- **Base stock:** ammo, meds and food. Missions draw from it, and loot and rescued civilians feed it. Food is consumed per trooper per day.
- **Roster:** 6 named troopers with HP, an injury state (Fit, Wounded for 1-2 days, Dead) and fatigue (deploying on consecutive missions gives -15% accuracy and speed). Traits are real modifiers.
- **Expand:** a cleared building becomes safe (lower heat around it, and sometimes a recruit or a supply cache). Clear 3 buildings to finish Chapter 1 (matches the map mock).

### Mission
- **Plan:** pick a building and spend time on recon or not. Recon reveals the room layout, which rooms hold zombies, and where the bloater is. Without recon, rooms show "?".
- **Deploy:** choose 3-6 troopers and split the ammo and meds you carry from base stock. Carrying more leaves less for tomorrow. Pick the route: vehicle (fast, +noise on arrival, carries civilians out) or on foot (silent, +1h, civilians must walk out).
- **Traverse:** a one-screen beat. The route's noise and the time of day roll one event (clear, ambush in the street, a lost hour). Keep it short and text-only, using the journal voice.
- **Engage:** room-graph combat (see below). The objective is to reach the civilians and extract them, not to kill everything.
- **Resolve:** casualties, injuries, ammo and meds used, loot, civilians saved, and the heat change are all written back to the meta. Retreat is always available. It costs the objective, not the team.

### Moment-to-moment
- **Stance (squad-wide, at any time, free):** Defensive, Controlled or Aggressive, plus Fire at Will on or off (combat-1.png). Defensive holds at the current door, so zombies funnel and accuracy rises, but the objective clock keeps running. Aggressive pushes into the next room, fast but loud. Fire at Will off means troopers only shoot zombies within 1 room, which saves ammo and noise.
- **Orders (cost CP):** Advance to room X (1), Seal door (1, a timed barricade), Focus target (1, everyone shoots one target, the way to deal with armour and bloaters), Medkit (1 + a med item), Extract civilian (0, but the unit carrying the civilian can't shoot).
- **CP regen:** 1 CP per 12s while Joel is ACTIVE and not under attack. If Joel is down, there is no regen. That makes protecting the leader a real priority.
- **Crisis queue:** events stack in the intervention panel. Each has a timer counted in real seconds, and the sim keeps running at 0.25x instead of freezing.

### What feeds what
Noise → waves in the mission → ammo spent → base stock → how much you can carry tomorrow. Time spent → day or night → spawns. Injuries → who is free tomorrow → fatigue on the rest. Civilians saved → food drain, but also recruits and trust. Heat → which buildings are still doable.

### Tension resources
**Noise** (in the mission, escalates waves), **ammo** (carried, finite, refilled from base), **CP** (attention, regenerates slowly), **time of day** (meta pacing), **fatigue and injury** (roster depth). Each one has a clear way to spend it and a clear cost.

## 4. Top 10 ideas (ranked by fun per effort)

| # | Name | Player decision | Size | TESTER note |
|---|------|-----------------|------|-------------|
| 1 | **Noise meter → waves** | Shoot now, or let zombies come to the door? Vehicle or foot? Every shot adds noise. At thresholds (30/60/90), a wave spawns at a map edge door. | S | 1, 7 |
| 2 | **Carried ammo and meds** | How much to take versus keep at base. Out of ammo means melee only (slow, +bite risk). Armour shot in the body wastes rounds. | S | 2 |
| 3 | **Persistent roster (localStorage)** | Who to risk today? Injuries last 1-2 days, death is permanent, and fatigue punishes over-using the best troopers. | S | 2 |
| 4 | **Real crises** | Crises trigger on actual downs, a bloater fuse or ammo running out. The victim is real. Rescue costs 2 CP and pulls a unit off firing for 6s. Cover costs 1 CP and a med. Abandon is free and permanent. | S | 4, 5 |
| 5 | **Stance bar in combat** | Hold the choke or push the objective, with live trade-offs (accuracy against noise against clock). Replaces HOLD/RALLY, which do nothing. | S | 3 |
| 6 | **Room graph with doors** | Zombies sit in rooms and move door to door. A door is a choke, where only 2 can pass at a time. "Seal door" buys time. Advancing is a deliberate order. | M | 3 |
| 7 | **Civilians extraction objective** | Civilians are real units in the stockroom. Reaching them triggers a stockroom incursion crisis. You win by getting them out, not by killing everything. Escorts can't shoot. | M | 1, 3 |
| 8 | **Bloater + armour per spec** | Bloater: focus it at range or retreat out of the 10-tile radius. Armour: focus fire or waste 3-4x the ammo. Shambler drops to 20 HP, so it dies in 1-2 shots and stops being an HP sponge. | S | 3 |
| 9 | **Monte Carlo forecast** | Read real odds before committing: run `update()` headless 30x and show success %, expected losses and ammo use. Recon narrows the spread. | M | 6 |
| 10 | **Day/night zone map** | Which building to hit, and when? Recon and walking cost hours, night changes spawns, heat spreads. | L | 1, 2 |

Traits as modifiers ride along with #3 (Accurate +15% hit, Fast +30% move, Cautious stays 1 room back, Rookie +noise). Size S.

## 5. First playable slice (3 → about 6)

One building with honest stakes, replayable across a few days.

1. **Bug and honesty pass (S).** Fix `dt` (clamp to 0.1, then multiply by speed), count the crisis timer in real seconds, await pending downs before results, drop the `elapsed>70` win and `rescued=3`, make the result text truthful, and fit the squad strip at 1024px.
2. **Noise → waves + carried ammo (S).** Ideas #1 and #2 together make every shot matter and make recon (fewer starting zombies, known bloater) and route (vehicle noise) causal.
3. **Real crises + CP regen tied to Joel (S).** Idea #4 plus the regen rule. The best moment in the build stops being scripted.
4. **Persistent roster + base stock (S).** Idea #3 with a "Day N" counter on the ops map. Losses now hurt tomorrow.
5. **Stances + civilians to extract (M).** Ideas #5 and #7, using the existing 6 rooms as the room graph, with doors between adjacent rooms only. This is the minimum of #6.

**Cut or park:**
- **Quick Resolve mode.** It hides the game and fakes the outcome.
- **Observe mode.** Keep it only as "stance-only, no CP orders" once the stances work.
- **The forecast `power` formula.** Show only intel-based ranges until #9 lands.
- **The log filter UI.**
- **RALLY and HOLD.** Stances replace them.
- **Level labels** on trooper cards (`LV 2+i%3` is fake).

**Park:** the full zone map (#10), the Monte Carlo forecast (#9), traverse events.

**Built in slice 1 (2026-11-27):** Items 1–5 are in `zombie-v1.1/dist`. The bug pass is done. Noise sets off waves at 30/60/90 (and again at 100), and ammo and meds are carried. Crises fire on real events (a down, a bloater closing, the barricade breaking, who to take out). They queue, run on real-second timers and slow the sim to 0.25x. CP regens 1 per 12s while Joel is up and not under attack. Roster, base stock, day, civilians and infected count persist in localStorage, with a New campaign button. Stances, Fire at Will, Advance/Seal/Focus/Medkit and extraction run on the 6-room graph. Additions: each civilian needs an escort who can't shoot, so the building takes several days. A broken barricade costs one civilian every 10s. Noise left behind grows the infected count overnight. All the listed cuts are made. Observe mode was cut, not kept. The forecast shows intel only.

## 6. Open questions for the user

1. **Control depth:** is the player a commander (stances, room orders and crises only, as designed here) or should they also select and move individual troopers? This doc assumes commander.
2. **Permadeath:** confirm every trooper except Joel can die permanently. Should story characters (David, Gustave) also be protected for Chapter 1?
3. **Meta scope for the next build:** one building over several days (the slice), or go straight to the 3-building Chapter 1 map?
