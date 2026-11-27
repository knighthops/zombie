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

**Built in slice 2 (2026-11-27), answering `docs/tester-report-slice1.md`:**
- **Mobile shell (bugs 1, 2, 7).** At ≤760px the nav (MAP, ROSTER) and the mission panel with New campaign are visible again. ARCHIVE was cut because it did nothing. The mission screen is a fixed 100dvh column: header, map, chips, stances, orders, then the log. Nothing scrolls the page. Advance and Seal open a pick bar of 44px buttons (rooms, or the doors of the current room). Canvas door taps now hit within a circle of at least 60px on screen. On a phone a crisis docks over the log only. Opening a crisis drops an armed order ("Order on hold").
- **Crises are time-safe (bug 4).** The sim pauses while a window is open, at any speed. The timer is 12 real seconds. The card names the default ("no order in 7s: drag them clear"), which is the first affordable sensible option and never Leave.
- **Fail state and recovery (bug 6).** "Spend the day" offers SCAVENGE (the two freshest troopers, +50–90 rounds, 50% chance of a med, 20% chance each comes back hurt) or REST (wounds heal). Either one costs barricade −20 and +4 infected, and a civilian dies if the barricade breaks. Every second civilian rescued volunteers as a rookie recruit when there is room on the team. A resolved building opens Cold Storage. When Cold Storage is resolved the chapter ends. If every trooper but Joel is dead, the game ends on a "The squad is gone" screen with a restart.
- **Joel (bug 8).** Joel can't die, but if he is downed he can't lead for 1 day. Overrun with him down costs 2 days plus 40 rounds and a med, and going critical (his bleed timer hits 0) adds a day. Missions can't deploy without him.
- **Curve.** The overnight barricade is +5 with a floor of 25%. Arrival costs are recon −10 and foot −5. Infected are kept within 14–36. A team of 5+ draws +2 infected per extra trooper and bigger waves.
- **Smaller fixes.** Defensive now advances once the room has been clear for 3s and the next room is clear, and says why when it holds. The "everyone is coming home" text requires no civilian lost or left. Cover and stabilize shows its odds (fewer for each infected close, more with a medic) and can fail.
- **Variety.** Runners are fast and fragile and arrive in later waves. Screamers wake, then shriek after 5s (+10 noise, nearby rooms wake), and Focus prioritises them. Noise 45 pulls the infected off the barricade.
- **Cold Storage** reuses the shop's floor plan with new labels, 4 civilians, more armour, runners from the start and faster noise decay. It is a stopgap, not a new map.

**Built in slice 2.1 (2026-11-27), answering `docs/tester-report-slice2.md` and the DESIGNER notes in `docs/ui-pass-1.md`:**
- **Ending screen (bug 1).** "See how it ends" opens its own `#end-screen`: days, civilians out and lost, team lost, a line per building, the whole roster (killed on day N, wounded, Joel's scars) and a New campaign button that returns to the prologue. The same screen covers a wiped squad and a third Joel scar. Leaving any mission runs `clearMission()`: the sim, timer, log, chips, pick bar, crisis card and door seals are wiped, so no stale mission DOM survives.
- **Scavenge is a gamble.** The odds sit on the button before you press it: 60% clean (+50–90 rounds, 50% a med), 30% contact (haul ×0.6, one scavenger out 2 days), 10% ambush (one scavenger killed, half the haul). Each scavenge heats the streets (+8% death, +7% hurt, −20 rounds per step). A mission or a rest cools them by one step. Three scavenges in a row put the odds at 15/51/34. It also fixed an old bug where a scavenge wound healed a day early.
- **Cold Storage.** 28 infected, 6 runners from the start, +2 runners in every wave, 2 crawlers. The bloater is never placed in the entry room, and its window can't open before 0:08. With recon it opens at 260 units instead of 170, so you get more warning. **Freezer pack:** as the civilians fall in, 8 runners (24 HP, no door queue, they go for the civilians) burst out of the freezer bay. Your choices are Seal the freezer door (1 command, the right answer), Run for the door (free, loud) or Stand and fight (free, and it wiped my test squad). Recon flags the bowed doors in the brief and the log. "Who comes out" now carries into this window, because every escort is one less gun.
- **Hold ground is never free.** On a bloater, Hold means every gun stays on the other infected. The bloater speeds up and bursts on the line. In testing it caught 5 troopers. If the window expires with no affordable option, the result is the same.
- **Joel: scars, not death.** Any time he would have died (he bleeds out to critical, or he is left behind), he lives and takes a permanent scar: −20 max HP and +4s on command regen. The third scar ends the campaign ("Joel can't lead any more"). I picked this over a one-off maim or a chapter loss because it hits the command economy, the resource the whole game is built on. It stacks into a slow-burning fear, and the down-crisis card shows the count (1/3). Roster and prep cards show the scars.
- **Crawler (new type, small).** Each building has crawlers (1 in the shop, 2 in Cold Storage). A crawler lies still in a room off the route. Until it is spotted it is invisible and can't be shot, it ignores noise, and it doesn't stop "room clear". On the way out it comes up for the civilians (30 damage, so one bite kills a civilian). Recon spots it, and so does a Defensive hold in its room for 3s. Once spotted it is shootable. This gives Defensive and recon a reason to exist, and it makes Take all (0 shooters) a real gamble.
- **Orders lock during a crisis (ui-pass-1 note 1).** Advance, Seal, Focus and Medkit are greyed out, and a tap logs "Orders wait. Make the call first." The reason: the sim is paused, so command spent there is free planning, and on a phone the pick bar pushed the options off screen. Stances (free) and Retreat (a real answer to any crisis) stay live.
- **Last-rescue window.** "Who comes out" only opens when there are at least 2 options. Otherwise the log says "No choice to make" and the team moves. When it does open, it names any spotted crawler on the way out, or warns that rooms nobody swept may hide one.

**Built in slice 3 (2026-11-27), answering `docs/tester-report-slice2.1.md` and the missing loop steps:**

The loop as it now exists (Chapter 1, about 8-11 days, 5-7 missions, 20-30 minutes):
1. **Plan** (ops map): pick the day. Mission, Scavenge (ammo, a part, a risk), Rest (heal, clears TIRED), or Rest and build one upgrade with parts.
2. **Deploy**: team, stance, loadout (with a short "rec" hint), recon, route.
3. **Traverse**: one road event, one choice: barricade time, noise, ammo, a bite risk, a part, or one more survivor (6 events, route-aware, no repeats in a row).
4. **Engage**: reach the civilians, then **hold the room 14s** while they get ready (loud: +10 noise, the neighbouring rooms wake), then walk them out while a few more infected find the column every 18s.
5. **Resolve**: casualties, stock, parts (cache +1, crawler stash +1), volunteers.
6. **Upgrade**: Walls 4, Infirmary 3, Reload bench 3, Radio mast 2, Drill 2. A chapter earns about 8-10 parts, so you buy two or three, and each build costs a rest day.
7. **Expand**: the shop gives +2 parts and a Safe house (scavenge risk halved), and opens Cold Storage. Cold Storage gives +2 parts and a Cold room (+1 med a rest day), and starts the horde clock (2 prep days).
8. **The Long Night** (finale, home base): hold the shelter until dawn (2:30). There are 7 raids on a clock, with bloaters in raids 3 and 6, and from raid 4 they come two ways at once. Raiders walk for the shelter, not for you. All base stock is on hand ("the night takes ~250"). The Walls shut the back wall and start the shelter at 100%. It ends on Dawn, The base fell or Into the rain.

Balance: noise per shot .45 → .34, shop decay .5 → .7, vehicle noise 25 → 15, the repeat wave resets to 60. Shamblers 28 HP / 12 dmg, runner 8 dmg, armoured 16 dmg, unfocused armour ×.5. Melee 14 dmg. Base stock 300, default carry 180. Speed resets to 1x every mission. An overrun drags out about half of the downed (out 3 days). The first wipe brings two drifters, and only the second ends the campaign. A critical Joel is hauled up by the nearest trooper, and command regen runs at half pace while he is carried (this fixes the stuck DOWN chip). A reload resumes on ops or the end screen. A crawler killed before it moves drops a +1 part stash, and a spotted crawler is marked on the map. The brief shows a "Tired: …" line.

Not verified: phone (iOS) play, portrait rotation of the new screens, and a full human-paced run timed end to end.

**Built in slice 3.1 (2026-11-27), answering the DESIGNER notes in `docs/tester-report-slice3.md`:**
- **The Long Night (note 1).** Each infected inside the shelter room drains it every second: 0.12% with Walls, 0.16% without (it was 0.6%). At night this counts infected that are fighting there too, not only the ones at the wall. When no infected are in the shelter room, the people inside repair it: +1%/s with Walls, +0.5%/s without, up to the starting value. That also works from 0%, so a breached shelter can be shut again. Breached: 1 civilian dies every 10s while infected are inside. The breach window opens once a night; later breaches only log. The dawn clock reads "· paused" while a window is open (the freeze was that pause, and it now says so). In headless runs at 8x, Walls, 4 guns and 250 rds reached Dawn with 37-48 rds left. Without Walls (250 rds), passive play fell at 2:28. 3 guns, 150 rds and no Walls fell at 1:56 if they stayed put, or 1:15 if they pushed into a full shelter. Fighting from inside the shelter is the strong line, and ammo is its clock.
- **Payout by people saved (note 2).** Once a building is resolved: half or more saved gives +3 parts and its bonus (Safe house or Cold room). Fewer than half but at least 1 gives +1 part and no bonus. None saved gives nothing ("is lost"). The next building still opens. Every civilian brought home adds +20 rds.
- **Barricade (note 3).** Any day away (rest or scavenge) costs −15. If that would take the barricade below 40, a civilian dies instead and the barricade resets to 55. After a mission it is kept at 40 or more. It never starts a mission below 15. Both day buttons show the cost ("barricade −15" or "1 civilian dies"). Day drain per infected at the barricade is 0.12%/s (was 0.18).
- **Parts (note 4).** A build no longer spends the day: one build a day, on top of any day action. Costs are unchanged: Walls 4, Infirmary 3, Reload bench 3, Radio 2, Drill 2 (14 in all). Income: +1 for reaching the civilians (their cache), +1 for a crawler stash, +1 for a clean scavenge, +1 from some road events, +3 for each building resolved well. A clean chapter earned 12 (Walls, Bench and Drill bought, 4 left over). Walls is no longer a forced pick.
- **Wipe recovery (note 5).** The first wipe brings two drifters with 150 rds and a med, and it resets scavenge heat.
- **Traceability (note 6).** Every civilian death keeps its cause: bitten, run down by a runner, taken by a crawler, caught in a bloater burst, barricade down, shelter breached, lost in the retreat, team overrun, didn't get out the back. It is logged as "A civilian died in the X: cause" and shown as one row per civilian in the results.
- **Found in play, also fixed.** Cold Storage wiped squads at the cold-room door three runs out of four. Now at most one armoured starts in the civilians' room. The room next to the civilians triggers a pull: they hear the team, the room empties toward it, and the team holds the door for 5s. Ammo was the real death spiral (about 4 rds per kill, 150-200 per mission), so the start stock is now 400 and scavenging gives +60-100.

Player-guide numbers: start with 400 rds, 4 meds, 0 parts. Scavenge: +60-100 rds (−20 per heat step), clean 60/30/10 (80/15/5 with Safe house), a clean run gives +1 part and 50% a med. Reload bench: +20 rds a day. The night: dawn at 2:30, a raid every 20s from 0:08 (7 raids: 6, 8, 10, 12, 14, 16, 18 infected), bloaters in raids 3 and 6, two ways at once from raid 4. Ways in: 2 with Walls, 3 without. Shelter: 100% with Walls, 70% without. Ammo needed: about 250 (6 guns used 291 from inside the shelter). Sheltered: everyone brought home who did not volunteer.

Full chapter at 844x390 and 2x (run 4, sensible play: recon every mission, crises answered, retreat if dry). Shop: 3/6, then 3/3 plus a man off a roof. Walls on day 14. Cold Storage: 3/5, scavenge, then 2/2. Bench and Drill built, one scavenge, one rest. Night: 6 guns, 325 rds, 12 sheltered. Moved into the shelter at 0:45. Dawn with 12/12 and no one hurt, with 34 rds left (tight on ammo, comfortable on lives). The ending was **Dawn** in 9 days. Three earlier runs, before the Cold Storage and ammo fixes, collapsed at the cold room.

**Built in slice 4.1 (2026-11-28), answering the DESIGNER notes in `docs/tester-report-v3.3.md` (app.js?v=4.1):**
- **Mission 1 cliff (note 1).** Deploy asks once when half or more of the team (2+) is tired: the button turns amber and reads "4/6 tired · −15% hit · go?". A second tap deploys. Early burn: Controlled and Defensive no longer open fire on unaware infected in another room, because a shot wakes the whole room ("let sleeping rooms lie"). Aggressive still does. Raiders at night are exempt. The shop has fewer armoured (1 in 10, was 1 in 7) and none in its first noise wave. Measured at 4x with Controlled, carrying 210: 60–100 rds left at 0:40 (was 93), 125–180 used a mission. With a tired team carrying 150: 55–84 left at 1:00 (was 20).
- **Scavenge is a gamble (note 2).** There are four outcomes. At heat 0: Big find 18% (double haul, +1 part, +1 med), Clean 52% (+60–100 rds, +1 part, 50% a med), Hurt 24% (haul ×0.6, one scavenger out 2 days), KIA 6% (half haul). Each heat step adds +7 KIA, +8 hurt and −6 big. The Safe house halves KIA and hurt. The odds button shows all four.
- **Street report (note 6, Rest vs Scavenge).** Each day rolls one report, which a reload doesn't change, shown above the day buttons: Clear 35% (no line), Rain 20% (risk ×0.5, haul ×0.75), Smoke to the east 15% (risk ×1.4, haul ×1.4, big ×2), Herd passing 15% (risk ×2), Still day 15% (Rest heals wounds twice).
- **Defensive you can feel (note 6).** Stances are a table (`STANCE`). Defensive: +20% hit, fire interval ×1.5, shot noise ×0.6 (days only), move ×0.85. That is about 22% fewer rounds a kill, 40% less noise and 15% less firepower, and it still holds a room until the next one is quiet. Controlled is unchanged. Aggressive: −15% hit, interval ×0.75, move ×1.35, wakes rooms. Measured on the first mission at 0:40, carrying 210–240: Defensive 100–208 left, Controlled 41–98, Aggressive 0 (dry both runs). A stance change logs its trade.
- **Downed trooper (note 3).** When the medic is up and free, "Patch up" becomes "Gustave treats" (● + med): 92% −8% per infected close (−10% if critical), 45–95%, back on their feet at 42 HP, and the medic stops shooting for 5s. Without a medic, Patch up is 80% −14% per infected close, 15–80%. A new option, **Carry** (free), shoulders the casualty: the carrier can't shoot or escort for the rest of the mission, and the casualty comes home out 2 days. On a day mission the default chain is Drag, then Patch, then Carry. At night it stays Drag, then Patch, so an unanswered window is not softer.
- **Long Night unlock (note 4).** Objective row: "Opens after Cold Storage". Map node: "AFTER 02".
- **Long Night protected (note 5).** Raid sizes, clock, drain, repair, the ammo need and Controlled fire at night are unchanged. Stance noise doesn't apply at night. The new things the night can use are the medic's better odds and Carry, which costs a gun until dawn.

Player-guide numbers (4.1): tired = −15% hit, fire interval ×1.1, move ×0.85, cleared by a day off. Scavenge at heat 0: 18 big / 52 ok / 24 hurt / 6 KIA, haul +60–100 (−20 per heat step, ×2 on a big find). Street odds: Clear 35, Rain 20, Smoke 15, Herd 15, Still 15. Stances (hit / fire interval / shot noise / move): Defensive +20% / ×1.5 / ×0.6 / ×0.85, Controlled 0 / ×1 / ×1 / ×1, Aggressive −15% / ×0.75 / ×1 / ×1.35. Down options: Drag ●● (6s carry, out 2d), Patch ● + med (or the medic's treat), Carry free (a gun lost until extraction, out 2d), Leave.

Not verified: the Long Night replayed under 4.1, and phone (iOS) play. Small inline `<style>` in index.html for the amber deploy ask (styles.css untouched, so its `?v=` stays).

## 6. Open questions for the user

1. **Control depth:** is the player a commander (stances, room orders and crises only, as designed here) or should they also select and move individual troopers? This doc assumes commander.
2. **Permadeath:** confirm every trooper except Joel can die permanently. Should story characters (David, Gustave) also be protected for Chapter 1?
3. **Meta scope for the next build:** one building over several days (the slice), or go straight to the 3-building Chapter 1 map?
