# TESTER report v4.2 (live, app.js?v=4.2 + battle3d.js?v=4.2, THREE loaded; 844x390, one 390x844 check)

**Fun 8/10** (was 7.5). **Visual 8/10.** Stale cache (v4.0) cleared after ~3 min; v4.2 confirmed before testing.

## Chapter stats (3 campaigns, 4 deployments to an end each)
- Run A (Defensive then Aggressive): Shop wipe 0/6, Cold Storage wiped twice, Joel scar 3/3: ending "Joel can't lead any more". Day 22, 3 dead, 204 rds.
- Run B (winning): Day 12 to 22 (11 days), roughly 25 min. Shop 7 saved over 2 trips, Cold Storage lost (0 of 5, 2 trips), Night 5/5 saw dawn. Deaths 2 (Gustave, David). Ammo: 255 fired in the night, 0 rds at dawn, 20 left on the end screen. Ending: "Chapter 1 closed, the base held".
- Console: no errors.

## 3D at phone size
Good. Infected are red humanoids, elites are purple with a glow, civilians a pale cluster, squad small teal figures with cones, Joel starred, skulls for the dead. At 844x390 I could tell squad from horde at a glance. Elites are the clearest read. Weak spots: civilians read as an abstract crystal pile, not people. A carried trooper vanishes, so a 3-man escort looks like 1 figure. Rotated 390x844 turns the whole game 90 degrees but every room and the rail fit.

## What's fun
- The Shop loop: save 3, come back for 3 more. Fresh road events every run.
- Scavenge variance is real: 260-round Big find under "Smoke to the east", plus clean hauls. The street report changes the day call.
- Carry/Drag/Patch cards when a trooper drops, with disabled options when no command point or nobody is free. This is the best new thing.
- Tired warning ("5/5 tired - deploy?") works.
- Defensive now plays differently: quiet, slow, the barricade falls before you reach it.

## What's flat
- Night in run B was too safe: breached once, never lost anyone. Prep decides it, so it has less dread than v3.3.
- Scavenge ran clean 6 of 8 times with the Safe house. Back to a tax-free action.
- Aggressive = suicide (153 rds, 4 down in 3 min). Fine, but it is not a choice.

## Bugs, phone first
1. SOFT-LOCK: "No one left - retreat" with everyone carried or 0 rds. The sim idles forever (no noise, no ammo, no movement) until you press Retreat. Seen twice. Needs auto-end or a prompt.
2. Cold Storage is a cliff: 4 of 5 attempts ended in 0 saved. Four dead after one cascade because each Carry removes a gun. The death spiral then has no way back (3 men, 258 rds).
3. Barricade jumped 40% to 55% after a rest that says -15. Check the intel.
4. "Take all 6 - No guns left" is a trap that only warns in the label. Mild.
5. Greyed Drag/Patch look dead with no reason. Add "no command".

## Notes for DESIGNER
1. Fix the idle state at 0 rds or all-carried. 2. Soften the Cold Storage cascade (Carry should not strip a gun for a long mission) or give recruits sooner. 3. Make the night able to kill: add a second wave when ammo is high. 4. Make Aggressive worth it (faster rescue). 5. Scavenge bias is too kind with the Safe house.

## Notes for UI
1. Draw carried troopers on the carrier. 2. Make civilians read as people. 3. Explain greyed options ("no command", "no one free"). 4. The tired ask is good; show it for 2+ tired too.
