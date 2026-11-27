(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const screens = $$(".screen");
  const SAVE_KEY = "zombie.campaign.v1";
  const START_DAY = 12;
  const W = 1100, H = 680;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // ---------- roster (traits are real modifiers) ----------
  const ROSTER = [
    {id:"joel",name:"Joel",role:"Leader",trait:"Steady · story protected",hp:120,color:"#d6ad55",dmg:22,rof:.75},
    {id:"shannon",name:"Shannon",role:"Rifle",trait:"Accurate · +15% hit",hp:95,color:"#61d4cf",dmg:26,rof:.7,acc:.15},
    {id:"mike",name:"Mike",role:"Breacher",trait:"Shotgun · brutal up close, loud",hp:110,color:"#8dbb72",dmg:14,close:46,rof:.95,noise:1.8},
    {id:"ruiz",name:"Ruiz",role:"Scout",trait:"Fast · +30% move, quiet",hp:85,color:"#72a6bb",dmg:18,rof:.5,speed:1.3,noise:.6},
    {id:"gustave",name:"Gustave",role:"Medic",trait:"Trauma care · stronger medkits",hp:90,color:"#b494d0",dmg:16,rof:.85,medic:true},
    {id:"david",name:"David",role:"Rifle",trait:"Rookie · +50% noise",hp:90,color:"#c6c6b5",dmg:24,rof:.7,rookie:true}
  ];

  // ---------- building: rooms + doors (room graph) ----------
  const ROOMS = [
    {x:35,y:45,w:300,h:220,label:"SHOP FLOOR"},{x:355,y:45,w:315,h:220,label:"CHECKOUT"},{x:690,y:45,w:370,h:220,label:"STOCKROOM"},
    {x:35,y:290,w:390,h:340,label:"AISLES"},{x:445,y:290,w:260,h:340,label:"OFFICE"},{x:725,y:290,w:335,h:340,label:"LOADING BAY"}
  ];
  ROOMS.forEach(r => { r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2; });
  ROOMS[2].cx = 830; // stockroom: hold away from the civilians' corner
  const DOORS = [[0,1,345,155,"v"],[1,2,680,155,"v"],[0,3,185,277,"h"],[1,4,575,277,"h"],[2,5,890,277,"h"],[3,4,435,460,"v"],[4,5,715,460,"v"]]
    .map(([a,b,x,y,axis]) => ({a,b,x,y,axis,sealed:0,cd:0}));
  const EDGES = [{room:0,x:185,y:64,label:"shop front"},{room:5,x:1040,y:460,label:"loading dock"},{room:2,x:1040,y:215,label:"stockroom back door"}];
  const ADJ = ROOMS.map((_, r) => DOORS.filter(d => d.a === r || d.b === r).map(d => ({d, r: d.a === r ? d.b : d.a})));
  function bfs(from, to, avoidSealed){
    if(from === to) return [];
    const prev = new Array(ROOMS.length).fill(-1); prev[from] = from; const q = [from];
    while(q.length){
      const c = q.shift();
      for(const {d, r} of ADJ[c]){
        if(prev[r] !== -1 || (avoidSealed && d.sealed > 0)) continue;
        prev[r] = c;
        if(r === to){ const p = [r]; let k = c; while(k !== from){ p.unshift(k); k = prev[k]; } return p; }
        q.push(r);
      }
    }
    return null;
  }
  const RDIST = ROOMS.map((_, a) => ROOMS.map((_, b) => bfs(a, b, false).length));
  const nextStep = (from, to) => { if(from === to) return from; const p = bfs(from, to, true) || bfs(from, to, false); return p ? p[0] : from; };
  const doorBetween = (a, b) => DOORS.find(d => (d.a === a && d.b === b) || (d.a === b && d.b === a));
  const roomName = r => ROOMS[r].label.toLowerCase();
  const doorName = d => `${roomName(d.a)} / ${roomName(d.b)} door`;
  const bloaterRoomFor = day => [4, 5, 1][day % 3];

  const ZT = {
    shambler:{hp:20,speed:[18,26],dmg:9,r:7},
    armoured:{hp:110,speed:[10,12],dmg:12,r:11},
    bloater:{hp:50,speed:[9,10],dmg:0,r:13}
  };

  // ---------- persistence ----------
  function freshCampaign(){
    return {v:1,day:START_DAY,ammo:240,meds:4,civilians:6,civStart:6,rescued:0,lost:0,barricade:100,infected:30,missions:0,report:"",
      roster:Object.fromEntries(ROSTER.map(p => [p.id, {status:"fit", out:0, lastDay:-99}]))};
  }
  function loadCampaign(){
    try { const raw = localStorage.getItem(SAVE_KEY); if(raw){ const c = JSON.parse(raw); if(c && c.v === 1 && c.roster) return c; } } catch(e) {}
    return freshCampaign();
  }
  function saveCampaign(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(camp)); } catch(e) {} }
  let camp = loadCampaign();
  const rec = id => camp.roster[id];
  const available = id => id === "joel" || rec(id).status === "fit";
  const isTired = id => rec(id).lastDay === camp.day - 1;
  const campaignOver = () => camp.civilians <= 0;
  function statusLabel(id){
    const r = rec(id);
    if(r.status === "dead") return "KIA";
    if(r.status === "wounded") return id === "joel" ? "HURT" : `WOUNDED ${r.out}D`;
    return isTired(id) ? "TIRED" : "FIT";
  }

  const state = {screen:"story-screen", recon:false, route:"vehicle", stance:"controlled", selected:new Set(), speed:1, paused:false, carryAmmo:150, carryMeds:2, confirmWipe:false};
  let m = null, crisisSeq = 0;

  function show(id){ screens.forEach(s => s.classList.toggle("active", s.id === id)); state.screen = id; window.scrollTo(0, 0); }
  function selectButtons(container, key, value){ $$(`button[data-${key}]`, container).forEach(b => b.classList.toggle("selected", b.dataset[key] === value)); }

  // ---------- ops map ----------
  const missionThreat = () => Math.max(6, camp.infected - (state.recon ? 3 : 0));
  const arrivalBarricade = () => Math.max(0, Math.round(camp.barricade - (state.recon ? 15 : 0) - (state.route === "foot" ? 10 : 0)));
  function threatText(){ const n = missionThreat(); return state.recon ? `${n} confirmed` : `${Math.round(n * .7)}–${Math.round(n * 1.3)}`; }

  function renderOps(){
    const alive = ROSTER.filter(p => rec(p.id).status !== "dead").length;
    const ready = ROSTER.filter(p => available(p.id)).length;
    $("#day-state").textContent = `DAY ${camp.day}`;
    $("#roster-count").textContent = alive;
    $("#hub-line").textContent = `${ready} ready · ${camp.ammo} rounds · ${camp.meds} meds`;
    $("#obj-sub").textContent = campaignOver() ? `Resolved · ${camp.rescued} rescued, ${camp.lost} lost` : `${camp.civilians} trapped · ${camp.rescued} rescued · ${camp.lost} lost`;
    $("#ops-report").textContent = camp.report || ""; $("#ops-report").hidden = !camp.report;
    $("#threat-value").textContent = threatText();
    $("#structure-value").textContent = state.recon ? "Mapped" : "Partial";
    $("#loot-value").textContent = state.recon ? "Medical cache" : "Possible";
    $("#window-value").textContent = `~${arrivalBarricade()}%`;
    $("#recon-btn").innerHTML = state.recon ? "<span>✓</span> Recon complete <small>Rooms mapped · bloater located · 3 thinned</small>" : "<span>◉</span> Send recon team <small>Barricade −15 · maps rooms, thins 3, finds the bloater</small>";
    $("#recon-btn").disabled = campaignOver();
    selectButtons($("#route-choice"), "route", state.route);
    $("#depart-time").textContent = state.route === "vehicle" ? "07:18" : "07:35";
    const over = campaignOver();
    $("#prepare-btn").disabled = over; $("#prepare-btn").textContent = over ? "Building resolved" : "Prepare deployment";
    $("#mission-node small").textContent = over ? "RESOLVED" : "MISSION";
    $("#mission-node").classList.toggle("resolved", over);
    $("#new-campaign").textContent = state.confirmWipe ? "Confirm: wipe this campaign" : "New campaign";
    $("#new-campaign").classList.toggle("danger-outline", state.confirmWipe);
  }

  $("#open-ops").onclick = () => { renderOps(); show("ops-screen"); };
  $("#prepare-btn").onclick = () => { if(campaignOver()) return; preparePrep(); show("prep-screen"); };
  $("#back-map").onclick = () => { renderOps(); show("ops-screen"); };
  $("#return-ops").onclick = () => { m = null; state.recon = false; renderOps(); show("ops-screen"); };
  $("#roster-jump").onclick = () => $("#prepare-btn").click();
  $("#mission-node").onclick = () => $(".brief-panel").scrollIntoView({behavior:"smooth"});
  $("#recon-btn").onclick = () => { if(state.recon || campaignOver()) return; state.recon = true; renderOps(); $("#mission-node").animate([{filter:"brightness(2)"},{filter:"brightness(1)"}], {duration:650}); };
  $("#route-choice").onclick = e => { const b = e.target.closest("button[data-route]"); if(!b) return; state.route = b.dataset.route; renderOps(); };
  $("#new-campaign").onclick = () => {
    if(!state.confirmWipe){ state.confirmWipe = true; renderOps(); return; }
    camp = freshCampaign(); saveCampaign(); state.confirmWipe = false; state.recon = false; state.route = "vehicle"; renderOps();
  };

  // ---------- deployment ----------
  function preparePrep(){
    state.confirmWipe = false;
    state.selected = new Set(ROSTER.filter(p => available(p.id)).map(p => p.id));
    state.carryAmmo = Math.min(camp.ammo, 150); state.carryMeds = Math.min(camp.meds, 2);
    selectButtons($("#doctrine-choice"), "doctrine", state.stance);
    renderRoster(); renderLoadout(); updateForecast();
  }
  function renderRoster(){
    $("#squad-list").innerHTML = ROSTER.map(p => {
      const ok = available(p.id), sel = state.selected.has(p.id), s = statusLabel(p.id);
      const label = p.id === "joel" ? (s === "FIT" ? "LEADER" : `LEADER · ${s}`) : s;
      const tone = s === "KIA" ? "st-dead" : s.startsWith("WOUNDED") || s === "HURT" ? "st-hurt" : s === "TIRED" ? "st-tired" : "";
      return `<button class="trooper-card ${!ok ? "unavailable" : sel ? "selected" : "unselected"}" data-id="${p.id}" ${ok ? "" : "disabled"}><span class="portrait" style="color:${p.color}">${p.name.slice(0,2).toUpperCase()}</span><span><strong>${p.name}</strong><small>${p.role} · ${p.trait}</small></span><span class="level ${tone}">${label}</span></button>`;
    }).join("");
    $$(".trooper-card").forEach(card => card.onclick = () => {
      const id = card.dataset.id; if(id === "joel" || !available(id)) return;
      if(state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      renderRoster(); updateForecast();
    });
  }
  $("#loadout").onclick = e => {
    const b = e.target.closest("button[data-load]"); if(!b) return; const dir = +b.dataset.dir;
    if(b.dataset.load === "ammo") state.carryAmmo = clamp(state.carryAmmo + dir * 30, 0, camp.ammo);
    else state.carryMeds = clamp(state.carryMeds + dir, 0, Math.min(3, camp.meds));
    renderLoadout();
  };
  function renderLoadout(){
    $("#load-ammo").textContent = state.carryAmmo; $("#load-ammo-base").textContent = `${camp.ammo - state.carryAmmo} stay at base`;
    $("#load-meds").textContent = state.carryMeds; $("#load-meds-base").textContent = `${camp.meds - state.carryMeds} stay at base`;
  }
  $("#doctrine-choice").onclick = e => { const b = e.target.closest("button[data-doctrine]"); if(!b) return; state.stance = b.dataset.doctrine; selectButtons($("#doctrine-choice"), "doctrine", state.stance); };
  function updateForecast(){
    $("#f-threat").textContent = state.recon ? threatText() : `${threatText()} · no recon`;
    $("#f-bloater").textContent = state.recon ? ROOMS[bloaterRoomFor(camp.day)].label : "Unknown";
    $("#f-barricade").textContent = `${arrivalBarricade()}%`;
    $("#f-noise").textContent = state.route === "vehicle" ? "25 · first wave at 30" : "0 · silent";
    $("#f-squad").textContent = `${state.selected.size} · ${[...state.selected].filter(isTired).length} tired`;
  }
  $("#deploy-btn").onclick = () => { if(campaignOver()) return; initMission(); show("combat-screen"); startLoop(); };

  // ---------- mission setup ----------
  const randIn = (r, inset = 25) => ({x:r.x + inset + Math.random() * (r.w - inset * 2), y:r.y + inset + Math.random() * (r.h - inset * 2)});
  function addZombie(type, room, x, y, alert){
    const t = ZT[type];
    m.zombies.push({kind:"z", id:m.zombies.length, type, room, x, y, hp:t.hp, maxHp:t.hp, speed:t.speed[0] + Math.random() * (t.speed[1] - t.speed[0]), alert, cd:0, alive:true, wp:null, tgt:null, retarget:0});
  }
  function zombiePoint(room){
    const r = ROOMS[room];
    for(let i = 0; i < 20; i++){
      const p = randIn(r);
      if(room === 3 && p.x < 260) continue;           // not on top of the entry
      if(room === 2 && p.x > 930 && p.y < 160) continue; // not inside the civilians' corner
      return p;
    }
    return {x:r.cx, y:r.cy};
  }
  function initMission(){
    DOORS.forEach(d => { d.sealed = 0; d.cd = 0; });
    const picks = ROSTER.filter(p => state.selected.has(p.id) && available(p.id));
    m = {running:true, elapsed:0, kills:0, cp:2, cpRegen:0, noise:state.route === "vehicle" ? 25 : 0, wavesFired:0,
      ammo:state.carryAmmo, ammoStart:state.carryAmmo, meds:state.carryMeds, medsStart:state.carryMeds, loot:false,
      stance:state.stance, faw:true, squadRoom:3, prevRoom:3, holdT:0, push:false, objective:"reach",
      barricade:arrivalBarricade(), seen:ROOMS.map((_, i) => state.recon || i === 3), recon:state.recon, route:state.route,
      units:[], zombies:[], civs:[], shots:[], particles:[], blasts:[], crises:[], arm:null, focus:null,
      bloaterWarned:new Set(), escorts:new Set(), crisisSig:"", hudSig:"", civStart:camp.civilians, report:null};
    m.units = picks.map((p, i) => {
      const hurt = p.id === "joel" && rec("joel").status === "wounded";
      return {...p, kind:"unit", x:62 + (i % 2) * 26, y:430 + Math.floor(i / 2) * 28, room:3, maxHp:p.hp, hp:hurt ? Math.round(p.hp * .6) : p.hp,
        status:"ACTIVE", cool:Math.random() * .5, bleed:0, carry:0, lastHit:-99, tired:isTired(p.id)};
    });
    const n = missionThreat(), bRoom = bloaterRoomFor(camp.day);
    const bp = zombiePoint(bRoom); addZombie("bloater", bRoom, bp.x, bp.y, false);
    const weights = [3, 3, 4, .5, 3, 3], total = weights.reduce((a, b) => a + b, 0);
    for(let i = 1; i < n; i++){
      let room;
      if(i <= 3) room = 2; // the stockroom always has company
      else { let roll = Math.random() * total; room = 0; while(roll > weights[room]){ roll -= weights[room]; room++; } }
      const p = zombiePoint(room); addZombie(i % 7 === 0 ? "armoured" : "shambler", room, p.x, p.y, false);
    }
    for(let i = 0; i < camp.civilians; i++) m.civs.push({kind:"civ", room:2, x:975 + (i % 2) * 30, y:76 + Math.floor(i / 2) * 24, hp:30, status:"trapped"});
    $("#log-stream").innerHTML = "";
    addLog(`Day ${camp.day}. Team entered through the western service door.`);
    addLog(state.recon ? `Recon mapped every room. Bloater sighted in the ${roomName(bRoom)}.` : "No recon. Most rooms are blind until the team is next to them.");
    if(state.route === "vehicle") addLog("The engine noise carried. Noise starts at 25.", "critical");
    else addLog("Came in on foot. Nothing heard them. Yet.");
    addLog(`Stockroom barricade at ${Math.round(m.barricade)}%. Anything left in there is clawing at it.`);
    $("#pause-btn").classList.remove("selected"); $("#pause-btn").textContent = "Ⅱ"; state.paused = false;
    m.hudSig = ""; renderHud(); renderCrisis();
  }

  // ---------- movement ----------
  function moveToward(a, b, amount){ const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; const k = Math.min(amount, d); a.x += dx / d * k; a.y += dy / d * k; return d; }
  function clampRoom(e){ const r = ROOMS[e.room]; e.x = clamp(e.x, r.x + 10, r.x + r.w - 10); e.y = clamp(e.y, r.y + 10, r.y + r.h - 10); }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function innerPoint(d, room){ const R = ROOMS[room]; return d.axis === "v" ? {x:d.x + Math.sign(R.x + R.w / 2 - d.x) * 22, y:d.y} : {x:d.x, y:d.y + Math.sign(R.y + R.h / 2 - d.y) * 22}; }
  // walks e toward pt in room, through doors. Zombies queue at doors: one crossing per 0.45s (the choke).
  function navigate(e, room, pt, amount, zombie){
    if(e.room === room){ moveToward(e, pt, amount); clampRoom(e); return; }
    const nr = nextStep(e.room, room); if(nr === e.room) return;
    const d = doorBetween(e.room, nr);
    if(dist(e, d) > amount + 2){ moveToward(e, d, amount); return; }
    if(d.sealed > 0) return;
    if(zombie){ if(d.cd > 0) return; d.cd = .45; }
    e.room = nr; const p = innerPoint(d, nr); e.x = p.x; e.y = p.y;
  }
  function slot(room, i){
    const r = ROOMS[room], dx = (i % 3 - 1) * 30, dy = Math.floor(i / 3) * 30 - 15;
    return {x:clamp(r.cx + dx, r.x + 14, r.x + r.w - 14), y:clamp(r.cy + dy, r.y + 14, r.y + r.h - 14)};
  }
  const arrived = () => m.units.every(u => u.status !== "ACTIVE" || u.room === m.squadRoom) && (m.objective !== "extract" || m.civs.every(c => c.status !== "following" || c.room === m.squadRoom));
  const roomHasZombies = r => m.zombies.some(z => z.alive && z.room === r);

  // ---------- sim ----------
  function update(step){
    m.elapsed += step;
    DOORS.forEach(d => { if(d.cd > 0) d.cd -= step; if(d.sealed > 0){ d.sealed -= step; if(d.sealed <= 0){ d.sealed = 0; addLog(`The ${doorName(d)} barricade gave way.`); } } });
    if(m.focus && (!m.focus.z.alive || (m.focus.t -= step) <= 0)) m.focus = null;
    m.units.forEach(u => { if(u.status === "DEAD") return; m.seen[u.room] = true; ADJ[u.room].forEach(n => { m.seen[n.r] = true; }); });
    updateUnits(step); updateZombies(step); updateCivs(step); separate();
    if(m.objective === "reach" && m.barricade > 0){
      const n = m.zombies.filter(z => z.alive && !z.alert && z.room === 2).length;
      m.barricade = Math.max(0, m.barricade - n * .18 * step);
      if(m.barricade <= 0) barricadeBroke();
    } else if(m.objective === "reach" && roomHasZombies(2)){
      // barricade down: one trapped civilian lost every 10s while infected hold the stockroom
      m.civClock = (m.civClock || 0) + step;
      if(m.civClock >= 10){ m.civClock = 0; const c = m.civs.find(c => c.status === "trapped"); if(c) civDies(c); }
    }
    m.noise = Math.max(0, m.noise - .5 * step + ((m.stance === "aggressive" || m.push) && !arrived() ? .5 * step : 0));
    checkWaves();
    const joel = m.units.find(u => u.id === "joel");
    if(m.cp >= 3) m.cpRegen = 0;
    else if(joel && joel.status === "ACTIVE" && m.elapsed - joel.lastHit > 3){ m.cpRegen += step; if(m.cpRegen >= 12){ m.cpRegen = 0; m.cp++; addLog("Joel has the picture again. +1 command."); } }
    autoAdvance(step); checkObjective();
    m.shots.forEach(s => s.t -= step); m.shots = m.shots.filter(s => s.t > 0);
    m.particles.forEach(p => { p.x += p.vx * step; p.y += p.vy * step; p.t -= step; }); m.particles = m.particles.filter(p => p.t > 0);
    m.blasts.forEach(b => b.t -= step); m.blasts = m.blasts.filter(b => b.t > 0);
    checkEnd();
  }

  function assignEscorts(){
    const n = m.civs.filter(c => c.status === "following").length;
    const pool = m.units.filter(u => u.status === "ACTIVE").sort((a, b) => (a.id === "joel") - (b.id === "joel") || a.dmg - b.dmg);
    m.escorts = new Set(pool.slice(0, n));
  }
  function updateUnits(step){
    assignEscorts();
    const followers = m.units.filter(u => u.status === "ACTIVE" || u.status === "INJURED");
    const fast = m.stance === "aggressive" || m.push;
    followers.forEach((u, i) => {
      const sp = 40 * (u.speed || 1) * (u.tired ? .85 : 1) * (fast ? 1.35 : 1) * (u.status === "INJURED" ? .75 : 1);
      navigate(u, m.squadRoom, slot(m.squadRoom, i), sp * step, false);
    });
    for(const u of m.units){
      if(u.status === "DOWN"){
        u.bleed -= step;
        if(u.bleed <= 0){
          if(u.id === "joel") u.bleed = 0;
          else { u.status = "DEAD"; addLog(`${u.name} bled out in the ${roomName(u.room)}.`, "critical"); }
        }
        continue;
      }
      if(u.status !== "ACTIVE") continue;
      u.cool -= step;
      if(u.carry > 0){ u.carry -= step; continue; }
      if(m.escorts.has(u)) continue; // an escort can't shoot
      if(u.cool > 0) continue;
      if(m.ammo <= 0){ // melee only: slow, and they take more bites
        const z = m.zombies.filter(z => z.alive && z.room === u.room && dist(u, z) < 28).sort((a, b) => dist(u, a) - dist(u, b))[0];
        if(z){ damageZombie(z, z.type === "armoured" ? 4 : 10); u.cool = 1.1; burst(z.x, z.y, "#9f2d25"); }
        continue;
      }
      const z = pickTarget(u); if(z) shoot(u, z);
    }
  }
  function canShoot(u, z, range){
    if(z.room === u.room) return dist(u, z) <= range;
    if(!m.faw) return false; // fire at will off: only what is in the room with you
    const d = doorBetween(u.room, z.room);
    return !!d && d.sealed <= 0 && dist(z, d) < 90 && dist(u, z) <= range + 60;
  }
  function pickTarget(u){
    if(m.focus && m.focus.z.alive && canShoot(u, m.focus.z, 420)) return m.focus.z;
    let best = null, bd = 1e9;
    for(const z of m.zombies){
      if(!z.alive || !canShoot(u, z, 260)) continue;
      const d = dist(u, z) + (z.alert ? 0 : 80);
      if(d < bd){ bd = d; best = z; }
    }
    return best;
  }
  function wakeRoom(r){ m.zombies.forEach(z => { if(z.alive && z.room === r) z.alert = true; }); }
  function shoot(u, z){
    m.ammo--; const d = dist(u, z);
    m.noise += (u.noise || 1) * (u.rookie ? 1.5 : 1) * .45;
    z.alert = true; wakeRoom(u.room); wakeRoom(z.room);
    const hit = .72 + (u.acc || 0) + (m.stance === "defensive" ? .15 : m.stance === "aggressive" ? -.15 : 0) - (u.tired ? .15 : 0) - (d > 200 ? .12 : 0);
    const focused = m.focus && m.focus.z === z, landed = Math.random() < hit;
    m.shots.push({x1:u.x, y1:u.y, x2:z.x, y2:z.y, t:.12, color:u.color, miss:!landed});
    u.cool = u.rof * (m.stance === "defensive" ? 1.25 : m.stance === "aggressive" ? .75 : 1) * (u.tired ? 1.1 : 1);
    if(landed){ let dmg = u.close && d < 110 ? u.close : u.dmg; if(z.type === "armoured" && !focused) dmg *= .35; damageZombie(z, dmg); }
    if(m.ammo === 0) addLog("Out of ammo. The team is down to knives and rifle butts.", "critical");
  }
  function damageZombie(z, dmg){
    if(!z.alive) return; z.hp -= dmg;
    if(z.hp <= 0){
      z.alive = false; m.kills++; burst(z.x, z.y, "#9f2d25");
      if(z.type === "bloater") explode(z);
      else if(z.type === "armoured") addLog(`Armoured infected down in the ${roomName(z.room)}.`, "kill");
      else if(m.kills % 5 === 0) addLog(`${m.kills} infected down.`, "kill");
    }
  }
  function explode(z){
    z.alive = false; m.noise += 12; m.blasts.push({x:z.x, y:z.y, t:.6});
    const hurt = [];
    m.units.forEach(u => {
      const d = dist(u, z); if(d > 95) return;
      if(u.status === "ACTIVE"){ u.hp -= 45 * (1 - d / 140); u.lastHit = m.elapsed; hurt.push(u.name); if(u.hp <= 0) downUnit(u); }
      else if(u.status === "DOWN") u.bleed = Math.max(0, u.bleed - 6);
    });
    m.civs.forEach(c => { if((c.status === "following" || c.status === "trapped") && dist(c, z) < 95){ c.hp -= 30; if(c.hp <= 0) civDies(c); } });
    m.zombies.forEach(o => { if(o.alive && o !== z && dist(o, z) < 95) damageZombie(o, 60); });
    addLog(`The bloater burst in the ${roomName(z.room)}.${hurt.length ? ` ${hurt.join(", ")} caught in it.` : " No one was close."}`, "critical");
  }
  function downUnit(u){
    if(u.status !== "ACTIVE") return;
    u.status = "DOWN"; u.hp = 0; u.bleed = 20;
    addLog(`${u.name} is down in the ${roomName(u.room)}.`, "critical");
    if(u.id === "joel") addLog("Command is cut. No regen until Joel is back up.", "critical");
    pushCrisis({kind:"down", unit:u});
  }
  function civDies(c){ if(c.status === "dead") return; c.status = "dead"; addLog(`A civilian was killed in the ${roomName(c.room)}.`, "critical"); }

  function updateZombies(step){
    for(const z of m.zombies){
      if(!z.alive) continue;
      z.cd -= step;
      if(!z.alert && m.units.some(u => u.status !== "DEAD" && u.room === z.room)) z.alert = true;
      if(!z.alert){
        if(z.room === 2 && m.objective === "reach"){
          if(m.barricade > 0){ if(!z.wp || dist(z, z.wp) < 4) z.wp = {x:912 + Math.random() * 25, y:70 + Math.random() * 85}; moveToward(z, z.wp, z.speed * .4 * step); clampRoom(z); continue; }
          if(!z.wp || dist(z, z.wp) < 4) z.wp = {x:955 + Math.random() * 70, y:70 + Math.random() * 80};
          moveToward(z, z.wp, z.speed * .4 * step); clampRoom(z); continue;
        }
        if(!z.wp || dist(z, z.wp) < 4 || Math.random() < .002) z.wp = randIn(ROOMS[z.room], 20);
        moveToward(z, z.wp, z.speed * .25 * step); clampRoom(z); continue;
      }
      z.retarget -= step;
      if(z.retarget <= 0 || !validTarget(z.tgt)){ z.tgt = chooseTarget(z); z.retarget = .6; }
      if(z.tgt) chase(z, z.tgt, step);
      if(z.alive && z.type === "bloater" && !m.bloaterWarned.has(z.id)){
        const near = m.units.find(u => u.status === "ACTIVE" && RDIST[u.room][z.room] <= 1 && dist(u, z) < 170);
        if(near){ m.bloaterWarned.add(z.id); pushCrisis({kind:"bloater", z, unit:near}); }
      }
    }
  }
  const validTarget = t => !!t && (t.kind === "unit" ? (t.status === "ACTIVE" || t.status === "DOWN") : t.status === "following");
  function chooseTarget(z){
    let best = null, bs = 1e9;
    const consider = t => { if(!validTarget(t)) return; const s = RDIST[z.room][t.room] * 500 + dist(z, t) + (t.status === "DOWN" ? 120 : 0); if(s < bs){ bs = s; best = t; } };
    m.units.forEach(consider); m.civs.forEach(consider);
    return best;
  }
  function chase(z, t, step){
    if(z.room !== t.room){ navigate(z, t.room, t, z.speed * step, true); return; }
    const d = dist(z, t);
    if(d > 20){ moveToward(z, t, Math.min(z.speed * step, d - 18)); clampRoom(z); }
    else if(z.cd <= 0) zombieHit(z, t);
  }
  function zombieHit(z, t){
    if(z.type === "bloater"){ explode(z); return; }
    z.cd = 1; const dmg = ZT[z.type].dmg * (m.ammo <= 0 && t.kind === "unit" ? 1.4 : 1);
    burst(t.x, t.y, "#ff493d");
    if(t.kind === "unit"){
      if(t.status === "DOWN"){ t.bleed = Math.max(0, t.bleed - 3); return; }
      t.hp -= dmg; t.lastHit = m.elapsed; if(t.hp <= 0) downUnit(t);
    } else { t.hp -= dmg; if(t.hp <= 0) civDies(t); }
  }
  function updateCivs(step){
    let i = 0;
    m.civs.forEach(c => { if(c.status === "following") navigate(c, m.squadRoom, slot(m.squadRoom, 6 + i++), 34 * step, false); });
  }
  function separate(){
    const zs = m.zombies.filter(z => z.alive);
    for(let i = 0; i < zs.length; i++) for(let j = i + 1; j < zs.length; j++){
      const a = zs[i], b = zs[j]; if(a.room !== b.room) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01;
      if(d < 13){ const p = (13 - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
  }
  const WAVE_AT = [30, 60, 90], WAVE_SIZE = [5, 7, 9];
  function checkWaves(){
    while(m.wavesFired < 3 && m.noise >= WAVE_AT[m.wavesFired]){ spawnWave(WAVE_SIZE[m.wavesFired], WAVE_AT[m.wavesFired]); m.wavesFired++; }
    if(m.wavesFired >= 3 && m.noise >= 100){ spawnWave(6, 100); m.noise = 75; }
  }
  function spawnWave(size, at){
    const edge = m.wavesFired === 0 && m.route === "vehicle" ? EDGES[1] : EDGES[Math.floor(Math.random() * EDGES.length)];
    for(let i = 0; i < size; i++){
      const r = ROOMS[edge.room];
      addZombie(size >= 6 && i === 0 ? "armoured" : "shambler", edge.room, clamp(edge.x + (Math.random() - .5) * 40, r.x + 12, r.x + r.w - 12), clamp(edge.y + (Math.random() - .5) * 40, r.y + 12, r.y + r.h - 12), true);
    }
    wakeRoom(edge.room);
    addLog(`Noise ${at}: ${size} infected pushing in through the ${edge.label}.`, "critical");
  }
  function barricadeBroke(){
    addLog("The stockroom barricade is down. The civilians are exposed.", "critical");
    if(m.civs.some(c => c.status === "trapped")) pushCrisis({kind:"barricade"});
  }
  function autoAdvance(step){
    if(m.holdT > 0){ m.holdT -= step; return; }
    if(!arrived()) return;
    const goal = m.objective === "reach" ? 2 : m.objective === "extract" ? 3 : null;
    if(goal === null || m.squadRoom === goal){ if(m.squadRoom === 2) m.push = false; return; }
    const go = m.push || m.stance === "aggressive" || (m.stance === "controlled" && !roomHasZombies(m.squadRoom));
    if(!go) return;
    m.prevRoom = m.squadRoom; m.squadRoom = nextStep(m.squadRoom, goal);
    addLog(`Team moving into the ${roomName(m.squadRoom)}.`);
  }
  function checkObjective(){
    if(m.objective === "reach"){
      const alive = m.civs.filter(c => c.status === "trapped");
      if(!alive.length){ m.objective = "none"; addLog("No one is left alive in the stockroom.", "critical"); return; }
      if(m.units.some(u => u.status === "ACTIVE" && u.room === 2) && !roomHasZombies(2)){
        m.objective = "choose"; m.push = false; m.loot = true; m.ammo += 30; m.meds += 1;
        addLog(`Reached ${plural(alive.length, "civilian")}. Medical cache recovered: +30 rounds, +1 med.`, "kill");
        pushCrisis({kind:"split"});
      }
    } else if(m.objective === "extract" && !m.civs.some(c => c.status === "following")){
      m.objective = "none"; addLog("No survivors left to bring home.", "critical");
    }
  }
  function checkEnd(){
    if(!m.units.some(u => u.status === "ACTIVE")){ endMission("failure"); return; }
    if(m.objective === "extract"){
      const f = m.civs.filter(c => c.status === "following");
      if(f.length && f.every(c => c.room === 3) && m.units.every(u => u.status !== "ACTIVE" || u.room === 3)) endMission("success");
    }
  }

  // ---------- crises (real events, queued, real-time timers, sim slows to 0.25x) ----------
  function pushCrisis(c){ c.uid = ++crisisSeq; c.t = c.max = 8; m.crises.push(c); m.crisisSig = ""; renderCrisis(); }
  function crisisValid(c){
    if(c.kind === "down") return c.unit.status === "DOWN";
    if(c.kind === "bloater") return c.z.alive;
    if(c.kind === "split") return m.objective === "choose";
    if(c.kind === "barricade") return m.objective === "reach" && m.civs.some(x => x.status === "trapped");
    return false;
  }
  const threatNear = u => m.zombies.some(z => z.alive && dist(z, u) < 70);
  const nearestAlly = u => m.units.filter(a => a !== u && a.status === "ACTIVE" && a.carry <= 0).sort((a, b) => (RDIST[a.room][u.room] * 500 + dist(a, u)) - (RDIST[b.room][u.room] * 500 + dist(b, u)))[0];
  function stabilize(u){
    const medic = m.units.some(x => x.medic && x.status === "ACTIVE");
    if(!threatNear(u) || Math.random() < .5){ u.status = "ACTIVE"; u.hp = Math.round((medic ? 60 : 40) * .7); u.bleed = 0; addLog(`${u.name} is patched up and back on their feet.`, "critical"); }
    else addLog(`They couldn't hold the line around ${u.name}. The med is gone and ${u.name} is still down.`, "critical");
  }
  function crisisView(c){
    if(c.kind === "down"){
      const u = c.unit, ally = nearestAlly(u), near = m.zombies.filter(z => z.alive && dist(z, u) < 120).length;
      return {
        title:`${u.name} is down`,
        copy:u.id === "joel" ? `Joel is down in the ${roomName(u.room)}. He will live, but command will not recover until he is back up.`
          : `${u.name} is down in the ${roomName(u.room)} with ${near} infected close. Bleeds out in about ${Math.ceil(u.bleed)}s.`,
        options:[
          {id:"rescue", label:"Drag them clear", sub:ally ? `2 command · ${ally.name} carries, can't fire for 6s` : "2 command · no one free to carry", disabled:m.cp < 2 || !ally,
            run(){ m.cp -= 2; u.status = "INJURED"; u.hp = Math.max(1, Math.round(u.maxHp * .25)); ally.carry = 6; addLog(`${ally.name} dragged ${u.name} clear. Out of the fight, but alive.`, "critical"); }},
          {id:"cover", label:"Cover and stabilize", sub:`1 command + 1 med · ${threatNear(u) ? "under attack, may fail" : "area quiet"}`, disabled:m.cp < 1 || m.meds < 1,
            run(){ m.cp--; m.meds--; stabilize(u); }},
          u.id === "joel"
            ? {id:"leave", label:"Fight on without him", sub:"Free · no command regen while he is down", danger:true, run(){ addLog("The team fights on. Joel is still down.", "critical"); }}
            : {id:"leave", label:"Leave them", sub:"Free · they will not come back", danger:true, run(){ u.status = "DEAD"; addLog(`Joel ordered the team to leave ${u.name}.`, "critical"); }}
        ],
        expire(){ addLog(`No order came. ${u.name} is still down.`, "critical"); }
      };
    }
    if(c.kind === "bloater"){
      const z = c.z;
      return {
        title:"Bloater closing",
        copy:`A bloater is shambling at ${c.unit.name} in the ${roomName(z.room)}. If it bursts close, everyone within a few metres gets hit.`,
        options:[
          {id:"focus", label:"Focus fire", sub:"1 command · everyone on it, kill it at range", disabled:m.cp < 1, run(){ m.cp--; m.focus = {z, t:8}; addLog("All fire on the bloater.", "kill"); }},
          {id:"fallback", label:"Fall back", sub:m.prevRoom === m.squadRoom ? "Nowhere to fall back to" : `Free · back to the ${roomName(m.prevRoom)}, lose time`, disabled:m.prevRoom === m.squadRoom,
            run(){ const r = m.prevRoom; m.prevRoom = m.squadRoom; m.squadRoom = r; m.holdT = 8; addLog(`Team falling back to the ${roomName(r)}.`); }},
          {id:"hold", label:"Hold ground", sub:"Free · risk the blast", danger:true, run(){ addLog("Holding. Nobody breathes."); }}
        ],
        expire(){ addLog("No order. The team holds where it is."); }
      };
    }
    const left = m.civs.filter(x => x.status === "trapped").length;
    if(c.kind === "split"){
      const able = m.units.filter(u => u.status === "ACTIVE").length;
      const most = Math.min(left, able); // one escort per civilian
      const counts = [...new Set([most, Math.ceil(most / 2), 1])].filter(n => n >= 1);
      const take = n => () => {
        m.civs.filter(x => x.status === "trapped").slice(0, n).forEach(x => { x.status = "following"; });
        m.barricade = 60; m.objective = "extract";
        addLog(`${plural(n, "civilian")} fall in behind the team.${left - n ? ` ${left - n} stay behind a rebuilt barricade.` : ""} Out through the western service door, in the aisles.`);
      };
      const shooters = n => Math.max(0, able - n);
      return {
        title:"Who comes out today?",
        copy:`${plural(left, "civilian")} in the stockroom, ${able} troopers on their feet. Each civilian needs an escort, and an escort can't shoot. The rest wait for another day.`,
        options:counts.map(n => ({id:"take" + n, label:n === left ? `Take all ${n}` : `Take ${n}`, sub:`Free · ${shooters(n)} left shooting`, danger:shooters(n) === 0, run:take(n)})),
        expire(){ const n = Math.min(left, Math.max(1, able - 2)); addLog("No order. The team takes who it can protect."); take(n)(); }
      };
    }
    return {
      title:"The barricade is down",
      copy:`The stockroom barricade gave in. ${plural(left, "civilian")} and whatever was clawing at the door are in the same room now. One dies every 10 seconds until the stockroom is clear.`,
      options:[
        {id:"push", label:"Push to the stockroom", sub:"1 command · go now, fast and loud", disabled:m.cp < 1, run(){ m.cp--; m.push = true; m.holdT = 0; addLog(`Joel: "Move. Now. Stockroom."`, "critical"); }},
        {id:"hold", label:"Stay the course", sub:"Free · the civilians are on their own", danger:true, run(){ addLog("The team keeps its pace."); }}
      ],
      expire(){ addLog("No order. The team keeps its pace.", "critical"); }
    };
  }
  function resolveCrisis(id){
    const c = m && m.crises[0]; if(!c || !m.running) return;
    const opt = crisisView(c).options.find(o => o.id === id); if(!opt || opt.disabled) return;
    opt.run(); m.crises.shift(); m.crisisSig = ""; renderCrisis(); renderHud();
  }
  function tickCrises(real){
    while(m.crises.length && !crisisValid(m.crises[0])){ m.crises.shift(); m.crisisSig = ""; }
    const c = m.crises[0]; if(!c) return;
    c.t -= real;
    if(c.t <= 0){ crisisView(c).expire(); m.crises.shift(); m.crisisSig = ""; }
  }
  $("#crisis-actions").onclick = e => { const b = e.target.closest("button[data-opt]"); if(b && !b.disabled) resolveCrisis(b.dataset.opt); };
  function renderCrisis(){
    const ov = $("#crisis-overlay"), c = m && m.running && m.crises[0];
    if(!c){ ov.classList.remove("open"); return; }
    ov.classList.add("open");
    const v = crisisView(c);
    $("#crisis-title").textContent = v.title; $("#crisis-copy").textContent = v.copy;
    $("#crisis-timer-fill").style.width = `${Math.max(0, c.t / c.max) * 100}%`;
    $("#crisis-queue").textContent = m.crises.length > 1 ? `+${m.crises.length - 1} more waiting · sim slowed` : "Sim slowed while you decide";
    const sig = c.uid + "|" + v.options.map(o => `${o.disabled ? 0 : 1}${o.sub}`).join("|");
    if(sig === m.crisisSig) return; m.crisisSig = sig;
    $("#crisis-actions").style.gridTemplateColumns = `repeat(${v.options.length},1fr)`;
    $("#crisis-actions").innerHTML = v.options.map(o => `<button data-opt="${o.id}" class="${o.danger ? "danger-choice" : ""}" ${o.disabled ? "disabled" : ""}><strong>${o.label}</strong><small>${o.sub}</small></button>`).join("");
  }

  // ---------- orders + stances ----------
  function spend(n){ if(m.cp < n){ addLog("Not enough command. Joel needs time to read the situation."); return false; } m.cp -= n; return true; }
  $("#command-bar").onclick = e => {
    const b = e.target.closest("button[data-command]"); if(!b || !m || !m.running) return; const cmd = b.dataset.command;
    if(cmd === "retreat"){ addLog("Joel ordered an immediate retreat.", "critical"); endMission("retreat"); return; }
    if(cmd === "advance" || cmd === "seal"){
      if(m.arm === cmd){ m.arm = null; addLog("Order cancelled."); }
      else if(m.cp < 1) addLog("Not enough command. Joel needs time to read the situation.");
      else { m.arm = cmd; addLog(cmd === "advance" ? "Advance: click a room on the map." : "Seal: click a door on the map."); }
    } else if(cmd === "focus"){
      const live = m.zombies.filter(z => z.alive && m.units.some(u => u.status === "ACTIVE" && RDIST[u.room][z.room] <= 1));
      const pick = live.find(z => z.type === "bloater") || live.find(z => z.type === "armoured") || live.sort((a, b) => a.hp - b.hp)[0];
      if(!pick) addLog("Nothing in sight to focus on.");
      else if(spend(1)){ m.focus = {z:pick, t:8}; addLog(`All fire on the ${pick.type === "shambler" ? "nearest infected" : pick.type} in the ${roomName(pick.room)}.`, "kill"); }
    } else if(cmd === "gear"){
      if(m.meds < 1){ addLog("No meds left in the kit."); }
      else {
        const down = m.units.filter(u => u.status === "DOWN")[0];
        const low = m.units.filter(u => u.status === "ACTIVE" && u.hp < u.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if(!down && !low) addLog("No one needs a medkit.");
        else if(spend(1)){
          m.meds--;
          if(down){ stabilize(down); }
          else { const medic = m.units.some(x => x.medic && x.status === "ACTIVE"); low.hp = Math.min(low.maxHp, low.hp + (medic ? 60 : 40)); addLog(`${medic ? "Gustave" : "The team"} used a trauma kit on ${low.name}.`); }
        }
      }
    }
    renderHud(); renderCrisis();
  };
  $("#stance-bar").onclick = e => {
    const b = e.target.closest("button"); if(!b || !m || !m.running) return;
    if(b.dataset.stance){ m.stance = b.dataset.stance; addLog(`Stance: ${m.stance}.`); }
    else if(b.dataset.faw !== undefined){ m.faw = !m.faw; addLog(m.faw ? "Fire at will." : "Hold fire unless they are in the room."); }
    renderHud();
  };
  const canvas = $("#battlefield"), ctx = canvas.getContext("2d");
  function toMap(e){
    const r = canvas.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    return {x:(e.clientX - r.left - (r.width - W * s) / 2) / s, y:(e.clientY - r.top - (r.height - H * s) / 2) / s};
  }
  canvas.onclick = e => {
    if(!m || !m.arm || !m.running) return; const p = toMap(e);
    if(m.arm === "advance"){
      const r = ROOMS.findIndex(R => p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h);
      if(r < 0 || r === m.squadRoom){ addLog("Pick a different room."); return; }
      if(!spend(1)) { m.arm = null; return; }
      m.prevRoom = m.squadRoom; m.squadRoom = r; m.holdT = 0; m.arm = null;
      addLog(`Joel: "Move to the ${roomName(r)}."`);
    } else {
      const d = DOORS.filter(d => dist(d, p) < 55).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if(!d){ addLog("Click closer to a door."); return; }
      if(!spend(1)) { m.arm = null; return; }
      d.sealed = 20; m.noise += 3; m.arm = null;
      addLog(`The ${doorName(d)} is wedged shut. About 20 seconds.`);
    }
    renderHud();
  };

  // ---------- end of mission: resolve everything synchronously, then show ----------
  function endMission(reason){
    if(!m || !m.running) return;
    m.running = false; m.arm = null; m.crises = []; renderCrisis();
    const anyActive = m.units.some(u => u.status === "ACTIVE");
    m.units.forEach(u => {
      if(u.status !== "DOWN") return;
      const carried = u.id === "joel" || (reason === "success" && anyActive) || (reason === "retreat" && m.units.some(a => a.status === "ACTIVE" && a.room === u.room));
      if(carried){ u.status = "INJURED"; u.carriedOut = true; } else { u.status = "DEAD"; u.leftBehind = true; }
    });
    let rescued = 0, scrambled = 0;
    m.civs.forEach(c => {
      if(c.status !== "following") return;
      if(reason === "success" || (reason === "retreat" && (c.room === 3 || Math.random() < .5))){ c.status = "out"; rescued++; }
      else { c.status = "dead"; if(reason === "retreat") scrambled++; }
    });
    const lost = m.civs.filter(c => c.status === "dead").length;
    const ammoUsed = m.ammoStart + (m.loot ? 30 : 0) - m.ammo;
    m.report = {reason, rescued, lost, scrambled, ammoUsed, day:camp.day};
    writeBack(m.report);
    setTimeout(showResults, 700);
  }
  function writeBack(r){
    ROSTER.forEach(p => { const x = rec(p.id); if(x.status === "wounded"){ x.out--; if(x.out <= 0){ x.status = "fit"; x.out = 0; } } });
    m.units.forEach(u => {
      const x = rec(u.id); x.lastDay = camp.day;
      if(u.status === "DEAD"){ x.status = "dead"; x.out = 0; u.outcome = u.leftBehind ? "Killed · left behind" : "Killed in action"; }
      else if(u.status === "INJURED"){ x.status = "wounded"; x.out = 2; u.outcome = u.id === "joel" ? "Wounded · still leads, at reduced HP" : "Wounded · out 2 days"; }
      else if(u.hp < u.maxHp * .4){ x.status = "wounded"; x.out = 1; u.outcome = u.id === "joel" ? "Hurt · still leads, at reduced HP" : "Hurt · out 1 day"; }
      else { x.status = "fit"; x.out = 0; u.outcome = "Returned"; }
    });
    camp.ammo = Math.max(0, camp.ammo - m.ammoStart + m.ammo);
    camp.meds = Math.max(0, camp.meds - m.medsStart + m.meds);
    camp.civilians -= r.rescued + r.lost; camp.rescued += r.rescued; camp.lost += r.lost;
    const growth = 8 + Math.floor(m.noise / 15); // the noise you leave behind draws more in
    camp.infected = Math.max(6, m.zombies.filter(z => z.alive).length + growth);
    let night = "";
    if(camp.civilians > 0){
      camp.barricade = Math.round(m.barricade - 10);
      if(camp.barricade <= 0){ camp.civilians--; camp.lost++; camp.barricade = 40; night = " The barricade failed overnight. One more civilian was lost."; }
    }
    const what = r.reason === "success" ? `${r.rescued} rescued` : r.reason === "retreat" ? (r.rescued ? `withdrew with ${r.rescued}` : "withdrew empty-handed") : "the team was overrun";
    const dead = m.units.filter(u => u.status === "DEAD").map(u => u.name);
    camp.day++; camp.missions++;
    camp.report = `Day ${r.day}: ${what}${dead.length ? `, lost ${dead.join(" and ")}` : ""}. ${growth} more infected drifted in overnight.${night}`;
    saveCampaign();
  }
  function showResults(){
    if(!m || !m.report) return;
    const r = m.report, dead = m.units.filter(u => u.status === "DEAD"), hurt = m.units.filter(u => u.outcome && /^(Wounded|Hurt)/.test(u.outcome));
    const names = list => list.length > 1 ? list.slice(0, -1).map(u => u.name).join(", ") + " and " + list.at(-1).name : list.map(u => u.name).join("");
    $("#result-title").textContent = r.reason === "failure" ? "Signal lost" : r.reason === "retreat" ? "Team withdrawn" : "Team returning";
    let s;
    if(r.reason === "success") s = `${plural(r.rescued, "civilian")} brought out through the service door.${r.lost ? ` ${plural(r.lost, "civilian")} did not make it.` : ""}`;
    else if(r.reason === "retreat") s = r.rescued ? `The team pulled out early with ${plural(r.rescued, "civilian")}.${r.scrambled ? ` ${r.scrambled} lost in the scramble.` : ""}`
      : `The team pulled out empty-handed.${r.lost ? ` ${plural(r.lost, "civilian")} died in the stockroom.` : ""}${camp.civilians ? ` ${plural(camp.civilians, "civilian")} still trapped, the barricade at ${Math.max(0, camp.barricade)}%.` : ""}`;
    else s = `The team was overrun. Joel was dragged out of the shop, barely.${r.lost ? ` ${plural(r.lost, "civilian")} died in there.` : ""}`;
    if(dead.length) s += ` ${names(dead)} ${dead.length > 1 ? "are" : "is"} gone.`;
    if(hurt.length) s += ` ${names(hurt)} will need time.`;
    if(r.reason === "success" && !dead.length && !hurt.length) s += " For once, everyone is coming home.";
    $("#result-summary").textContent = s;
    $("#result-grid").innerHTML = `<div><span>INFECTED CLEARED</span><strong>${m.kills}</strong></div><div><span>CIVILIANS OUT</span><strong>${r.rescued} / ${m.civStart}</strong></div><div><span>AMMO USED</span><strong>${r.ammoUsed}</strong></div><div><span>TEAM LOSSES</span><strong>${dead.length}</strong></div>`;
    $("#result-base").textContent = campaignOver()
      ? `The shop is resolved: ${camp.rescued} rescued, ${camp.lost} lost. Start a new campaign from the operations map.`
      : `Base stock: ${camp.ammo} rounds · ${camp.meds} meds. ${plural(camp.civilians, "civilian")} still trapped. Day ${camp.day} next.`;
    $("#casualty-list").innerHTML = m.units.map(u => `<div class="casualty-row ${u.status === "DEAD" ? "is-dead" : ""}"><strong>${u.name} · ${u.role}</strong><span>${u.outcome}</span></div>`).join("");
    show("result-screen");
  }

  // ---------- loop: real elapsed time, fixed sub-steps, so speed works on slow frames ----------
  let timer = null, lastReal = 0;
  function startLoop(){ lastReal = performance.now(); clearInterval(timer); timer = setInterval(tick, 33); }
  function tick(){
    const now = performance.now(), real = Math.min(1, (now - lastReal) / 1000); lastReal = now;
    if(!m || state.screen !== "combat-screen"){ clearInterval(timer); timer = null; return; }
    if(m.running && !state.paused){
      tickCrises(real);
      let sim = real * state.speed * (m.crises.length ? .25 : 1);
      while(sim > 1e-6 && m.running){ const s = Math.min(.05, sim); update(s); sim -= s; }
    }
    draw(); renderHud(); renderCrisis();
  }
  $("#pause-btn").onclick = () => { state.paused = !state.paused; $("#pause-btn").classList.toggle("selected", state.paused); $("#pause-btn").textContent = state.paused ? "▶" : "Ⅱ"; };
  $$("[data-speed]").forEach(b => b.onclick = () => { state.speed = +b.dataset.speed; state.paused = false; $("#pause-btn").classList.remove("selected"); $("#pause-btn").textContent = "Ⅱ"; $$("[data-speed]").forEach(x => x.classList.toggle("selected", x === b)); });

  // ---------- HUD ----------
  const fmt = n => { const t = Math.floor(n); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  function chipText(u){
    if(u.status === "ACTIVE") return `${Math.max(0, Math.round(u.hp))} HP${u.carry > 0 ? " · CARRYING" : m.escorts.has(u) ? " · ESCORT" : ""}`;
    if(u.status === "DOWN") return u.id === "joel" ? "DOWN" : `DOWN · ${Math.ceil(u.bleed)}s`;
    if(u.status === "INJURED") return "CARRIED";
    return "KIA";
  }
  function renderHud(){
    if(!m) return;
    const joel = m.units.find(u => u.id === "joel"), joelUp = joel && joel.status === "ACTIVE";
    const chips = m.units.map(u => `<div class="unit-chip ${u.status.toLowerCase()}${u.tired ? " tired" : ""}"><strong>${u.name}</strong><small>${chipText(u)}</small></div>`).join("");
    const objective = m.objective === "reach" ? (m.barricade > 0 ? `Reach the civilians · barricade ${Math.ceil(m.barricade)}%` : `Barricade down · next civilian lost in ${Math.ceil(10 - (m.civClock || 0))}s`)
      : m.objective === "extract" ? `Extract ${plural(m.civs.filter(c => c.status === "following").length, "civilian")} · west door`
      : m.objective === "choose" ? "Decide who comes out" : "No one left to save · retreat";
    const sig = chips + objective + m.cp + m.stance + m.faw + m.arm + m.meds;
    if(sig !== m.hudSig){
      m.hudSig = sig;
      $("#squad-status").innerHTML = chips;
      $("#objective-text").textContent = objective;
      $("#command-points").textContent = "● ".repeat(m.cp) + "○ ".repeat(3 - m.cp);
      $$("#stance-bar [data-stance]").forEach(b => b.classList.toggle("selected", b.dataset.stance === m.stance));
      const faw = $("#stance-bar [data-faw]"); faw.textContent = m.faw ? "FIRE AT WILL: ON" : "FIRE AT WILL: OFF"; faw.classList.toggle("faw-off", !m.faw);
      $$("#command-bar [data-command]").forEach(b => {
        const c = b.dataset.command;
        b.classList.toggle("off", c !== "retreat" && (m.cp < 1 || (c === "gear" && m.meds < 1)));
        b.classList.toggle("armed", m.arm === c);
      });
    }
    $("#cp-regen-label").textContent = !joelUp ? "NO REGEN · JOEL DOWN" : m.cp >= 3 ? "FULL" : `+1 IN ${Math.ceil(12 - m.cpRegen)}s`;
    $("#bandwidth-fill").style.width = `${joelUp && m.cp < 3 ? m.cpRegen / 12 * 100 : m.cp >= 3 ? 100 : 0}%`;
    $("#noise-value").textContent = Math.round(m.noise);
    $("#noise-fill").style.width = `${Math.min(100, m.noise)}%`;
    $("#ammo-value").textContent = `${m.ammo} rds`;
    $("#meds-value").textContent = m.meds;
    $("#mission-clock").textContent = fmt(m.elapsed);
  }
  function addLog(text, type = "normal"){ $("#log-stream").insertAdjacentHTML("afterbegin", `<div class="log-entry ${type}"><time>${fmt(m ? m.elapsed : 0)}</time><span>${text}</span></div>`); }
  function burst(x, y, color){ for(let i = 0; i < 5; i++) m.particles.push({x, y, vx:(Math.random() - .5) * 80, vy:(Math.random() - .5) * 80, t:.35, color}); }

  // ---------- draw ----------
  function draw(){
    ctx.fillStyle = "#111916"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.lineWidth = 5;
    ROOMS.forEach((r, i) => {
      ctx.fillStyle = i % 2 ? "#17201d" : "#1b2421"; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = m && m.arm === "advance" && i !== m.squadRoom ? "#61d4cf" : "#34413c"; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "#53615b"; ctx.font = "11px monospace"; ctx.fillText(r.label, r.x + 14, r.y + 20);
    });
    for(let x = 300; x < 400; x += 55){ ctx.fillStyle = "#29342f"; ctx.fillRect(x, 340, 16, 230); }
    ctx.fillStyle = "#26322e"; ctx.fillRect(470, 335, 210, 32); ctx.fillRect(470, 430, 210, 32); ctx.fillRect(760, 350, 240, 24);
    // doors
    DOORS.forEach(d => {
      const vw = d.axis === "v", w = vw ? 26 : 44, h = vw ? 44 : 26;
      ctx.fillStyle = "#1e2a26"; ctx.fillRect(d.x - w / 2, d.y - h / 2, w, h);
      if(d.sealed > 0){ ctx.fillStyle = "#d6ad55"; ctx.fillRect(vw ? d.x - 4 : d.x - 22, vw ? d.y - 22 : d.y - 4, vw ? 8 : 44, vw ? 44 : 8); ctx.fillStyle = "#d6ad55"; ctx.font = "bold 10px monospace"; ctx.fillText(Math.ceil(d.sealed) + "s", d.x + 8, d.y - 8); }
      else if(m && m.arm === "seal"){ ctx.strokeStyle = "#61d4cf"; ctx.lineWidth = 2; ctx.strokeRect(d.x - w / 2, d.y - h / 2, w, h); }
    });
    ctx.fillStyle = "#8dbb72"; ctx.fillRect(27, 438, 10, 44); ctx.font = "bold 10px monospace"; ctx.fillText("ENTRY", 44, 618);
    EDGES.forEach(e => { ctx.fillStyle = "#5d211d"; const r = ROOMS[e.room]; if(e.room === 0) ctx.fillRect(e.x - 22, r.y - 6, 44, 8); else ctx.fillRect(r.x + r.w - 2, e.y - 22, 8, 44); });
    // civilians' corner + barricade
    const bar = m ? m.barricade : 100;
    ctx.strokeStyle = bar > 0 ? (bar > 40 ? "#8b7a55" : "#b4472f") : "#ff493d"; ctx.lineWidth = 3; ctx.setLineDash(bar > 0 ? [] : [4, 8]);
    ctx.beginPath(); ctx.moveTo(945, 55); ctx.lineTo(945, 160); ctx.lineTo(1055, 160); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#8dbb72"; ctx.font = "bold 10px monospace"; ctx.fillText(m && m.objective !== "reach" ? "" : `CIVILIANS ${Math.ceil(bar)}%`, 955, 180);
    if(m){
      // squad marker
      const R = ROOMS[m.squadRoom]; ctx.strokeStyle = "#61d4cf55"; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(R.cx, R.cy, 48, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      m.civs.forEach(c => { if(c.status !== "trapped" && c.status !== "following") return; ctx.fillStyle = "#8dbb72"; ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e8fff7"; ctx.lineWidth = 1; ctx.stroke(); });
      m.zombies.forEach(z => {
        if(!z.alive || !m.seen[z.room]) return;
        const t = ZT[z.type];
        ctx.fillStyle = z.type === "armoured" ? "#a68d67" : z.type === "bloater" ? "#9aa040" : z.alert ? "#b3372d" : "#6d2a25";
        ctx.beginPath(); ctx.arc(z.x, z.y, t.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#ff776d55"; ctx.lineWidth = 1; ctx.stroke();
        if(z.type === "armoured"){ ctx.fillStyle = "#d2bea0"; ctx.fillRect(z.x - 8, z.y - 2, 16, 4); }
        if(m.focus && m.focus.z === z){ ctx.strokeStyle = "#61d4cf"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, t.r + 6, 0, Math.PI * 2); ctx.stroke(); }
      });
      m.units.forEach(u => {
        ctx.globalAlpha = u.status === "DEAD" ? .25 : u.status === "INJURED" ? .55 : 1;
        ctx.fillStyle = u.status === "DOWN" ? "#ff493d" : u.color; ctx.beginPath(); ctx.arc(u.x, u.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#e8fff7"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#07100f"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.fillText(u.name[0], u.x, u.y + 3); ctx.textAlign = "left"; ctx.globalAlpha = 1;
      });
      m.shots.forEach(s => { ctx.globalAlpha = Math.min(1, s.t * 8) * (s.miss ? .35 : 1); ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); });
      m.blasts.forEach(b => { ctx.globalAlpha = b.t; ctx.fillStyle = "#c9d14a55"; ctx.beginPath(); ctx.arc(b.x, b.y, 95 * (1.2 - b.t / 2), 0, Math.PI * 2); ctx.fill(); });
      m.particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.t * 3); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });
      ctx.globalAlpha = 1;
      ROOMS.forEach((r, i) => { if(m.seen[i]) return; ctx.fillStyle = "#070c0bdd"; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = "#3d4a45"; ctx.font = "bold 34px monospace"; ctx.textAlign = "center"; ctx.fillText("?", r.x + r.w / 2, r.y + r.h / 2 + 12); ctx.textAlign = "left"; });
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function registerWebTools(){
    const mc = document.modelContext; if(!mc?.registerTool) return;
    Promise.resolve(mc.registerTool({name:"read_zombie_mission_status", title:"Read Mission Status", description:"Read the current prototype screen, campaign and live mission status.", inputSchema:{type:"object", properties:{}, additionalProperties:false}, annotations:{readOnlyHint:true, untrustedContentHint:false},
      execute:() => ({screen:state.screen, day:camp.day, civiliansTrapped:camp.civilians, ammo:camp.ammo, meds:camp.meds,
        mission:m ? {elapsed:Math.floor(m.elapsed), kills:m.kills, commandPoints:m.cp, noise:Math.round(m.noise), objective:m.objective, team:m.units.map(u => ({name:u.name, status:u.status, hp:Math.max(0, Math.round(u.hp))}))} : null})})).catch(() => {});
  }
  window.ZB = {get m(){ return m; }, get camp(){ return camp; }, state};
  renderOps(); registerWebTools(); draw();
})();
