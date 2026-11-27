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
  const CIV = 2, ENTRY = 3; // the civilians' room and the entry room (same plan in both buildings)

  // ---------- buildings (slice 2: Cold Storage reuses the floor plan with its own threat mix) ----------
  const BUILDINGS = [
    {key:"shop", mission:"Desperate Measures", title:"Convenience Shop", place:"CONVENIENCE SHOP · 3.8 KM",
      brief:"Civilians are barricaded inside. The shutters are failing and something has entered through the stockroom.",
      labels:["SHOP FLOOR","CHECKOUT","STOCKROOM","AISLES","OFFICE","LOADING BAY"], civ:6, infected:26,
      armouredEvery:7, runnersStart:0, waveRunners:0, crawlers:1, pack:0, noiseDecay:.5, bloaterRooms:[4,5,1], screamerRooms:[5,0,4]},
    {key:"cold", mission:"Cold Storage", title:"Cold Storage", place:"COLD STORAGE · 5.1 KM",
      brief:"Four workers locked themselves in the cold room. The compressors still run and hide some of your noise, but the plant is full of armoured infected and runners.",
      labels:["DOCK OFFICE","SORTING","COLD ROOM","PALLET HALL","PUMP ROOM","FREEZER BAY"], civ:4, infected:28,
      armouredEvery:5, runnersStart:6, waveRunners:2, crawlers:2, pack:8, noiseDecay:.8, bloaterRooms:[5,1,4], screamerRooms:[1,5,0]} // slice 2.1: bloater never in the entry room
  ];
  let B = BUILDINGS[0];
  function applyBuilding(){ B = BUILDINGS[Math.min(camp.bIdx, BUILDINGS.length - 1)]; ROOMS.forEach((r, i) => { r.label = B.labels[i]; });
    EDGES[0].label = B.key === "shop" ? "shop front" : "dock office door"; EDGES[2].label = `${B.labels[CIV].toLowerCase()} back door`; }
  const bloaterRoomFor = day => B.bloaterRooms[day % 3];
  const screamerRoomFor = day => { const b = bloaterRoomFor(day); const rs = B.screamerRooms.filter(r => r !== b); return rs[day % rs.length]; };

  const ZT = {
    shambler:{hp:20,speed:[18,26],dmg:9,r:7},
    runner:{hp:14,speed:[46,56],dmg:6,r:6},     // fast and fragile: they punish noise, not aim
    armoured:{hp:110,speed:[10,12],dmg:12,r:11},
    screamer:{hp:30,speed:[8,10],dmg:5,r:9},     // once awake it screams: +noise, wakes nearby rooms
    bloater:{hp:50,speed:[9,10],dmg:0,r:13},
    crawler:{hp:16,speed:[34,40],dmg:14,r:6}     // lies still in a room you walked through; comes up when the column walks back
  };
  // crawlers lurk off the main rooms; recon or a defensive sweep spots them
  const crawlerRoomsFor = (day, n) => { const pool = [1, 4, 0, 5]; return Array.from({length:n}, (_, i) => pool[(day + i * 2) % pool.length]); };
  // Joel can't die, but every time he would have (bled out, or left behind), he takes a scar that never heals
  const scars = () => camp.joelScars || 0;
  const MAX_SCARS = 3;
  const regenSeconds = () => 12 + scars() * 4;

  // ---------- persistence ----------
  const freshBuilding = b => ({civilians:b.civ, civStart:b.civ, rescued:0, lost:0, barricade:100, infected:b.infected});
  function freshCampaign(){
    return {v:2,day:START_DAY,ammo:240,meds:4,missions:0,report:"",bIdx:0,b:BUILDINGS.map(freshBuilding),recruits:[],rescuedTotal:0,ended:null,
      roster:Object.fromEntries(ROSTER.map(p => [p.id, {status:"fit", out:0, lastDay:-99}]))};
  }
  function migrate(c){
    if(c.v === 1){ // slice 1 save: one building, Joel's "wounded" meant hurt
      const b0 = {civilians:c.civilians, civStart:c.civStart, rescued:c.rescued, lost:c.lost, barricade:c.barricade, infected:Math.min(36, c.infected)};
      c = {v:2, day:c.day, ammo:c.ammo, meds:c.meds, missions:c.missions, report:c.report, roster:c.roster, recruits:[], rescuedTotal:c.rescued,
        bIdx:c.civilians <= 0 ? 1 : 0, b:[b0, freshBuilding(BUILDINGS[1])], ended:null};
      if(c.roster.joel.status === "wounded") c.roster.joel = {...c.roster.joel, status:"hurt", out:0};
    }
    return c;
  }
  function loadCampaign(){
    try { const raw = localStorage.getItem(SAVE_KEY); if(raw){ const c = migrate(JSON.parse(raw)); if(c && c.v === 2 && c.roster && c.b) return c; } } catch(e) {}
    return freshCampaign();
  }
  function saveCampaign(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(camp)); } catch(e) {} }
  let camp = loadCampaign();
  const cur = () => camp.b[Math.min(camp.bIdx, camp.b.length - 1)];
  const team = () => ROSTER.concat(camp.recruits || []);
  const rec = id => camp.roster[id];
  const available = id => id === "joel" ? rec(id).status !== "wounded" : rec(id).status === "fit";
  const isTired = id => rec(id).lastDay === camp.day - 1;
  const campaignOver = () => cur().civilians <= 0; // this building is resolved
  const joelOut = () => !available("joel");
  const canDeploy = () => !camp.ended && !campaignOver() && !joelOut();
  function statusLabel(id){
    const r = rec(id);
    if(r.status === "dead") return "KIA";
    if(id === "joel") return r.status === "wounded" ? `OUT ${r.out}D` : r.status === "hurt" ? "HURT" : isTired(id) ? "TIRED" : "FIT";
    if(r.status === "wounded") return `WOUNDED ${r.out}D`;
    return isTired(id) ? "TIRED" : "FIT";
  }
  applyBuilding();

  const state = {screen:"story-screen", recon:false, route:"vehicle", stance:"controlled", selected:new Set(), speed:1, paused:false, carryAmmo:150, carryMeds:2, confirmWipe:false};
  let m = null, crisisSeq = 0;

  function show(id){ screens.forEach(s => s.classList.toggle("active", s.id === id)); state.screen = id; document.body.classList.toggle("in-mission", id === "combat-screen"); window.scrollTo(0, 0); }
  function selectButtons(container, key, value){ $$(`button[data-${key}]`, container).forEach(b => b.classList.toggle("selected", b.dataset[key] === value)); }

  // ---------- ops map ----------
  const missionThreat = () => Math.max(6, cur().infected - (state.recon ? 3 : 0));
  const arrivalBarricade = () => Math.max(10, Math.round(cur().barricade - (state.recon ? 10 : 0) - (state.route === "foot" ? 5 : 0)));
  function threatText(){ const n = missionThreat(); return state.recon ? `${n} confirmed` : `${Math.round(n * .7)}–${Math.round(n * 1.3)}`; }
  const scavengers = () => team().filter(p => p.id !== "joel" && available(p.id)).sort((a, b) => isTired(a.id) - isTired(b.id) || a.dmg - b.dmg).slice(0, 2);

  function renderOps(){
    applyBuilding();
    const alive = team().filter(p => rec(p.id).status !== "dead").length;
    const ready = team().filter(p => available(p.id)).length;
    $("#day-state").textContent = `DAY ${camp.day}`;
    $("#roster-count").textContent = alive;
    $("#hub-line").textContent = `${ready} ready · ${camp.ammo} rounds · ${camp.meds} meds`;
    BUILDINGS.forEach((b, i) => {
      const s = camp.b[i], done = s.civilians <= 0, active = i === camp.bIdx && !done, locked = i > camp.bIdx;
      $(`#obj-${i}`).classList.toggle("locked", locked);
      $(`#obj-${i} small`).textContent = locked ? "Unknown location" : done ? `Resolved · ${s.rescued} rescued, ${s.lost} lost` : `${s.civilians} trapped · ${s.rescued} rescued · ${s.lost} lost`;
      const node = $(`#node-${i}`);
      node.classList.toggle("mission-node", active); node.classList.toggle("resolved", done); node.classList.toggle("unknown-node", locked);
      node.classList.toggle("selected", active);
      $("span", node).textContent = locked ? "?" : done ? "✓" : "!";
      $("small", node).textContent = locked ? "NO SIGNAL" : done ? "RESOLVED" : "MISSION";
    });
    $(".chapter-progress span").style.width = `${Math.round(camp.b.filter(s => s.civilians <= 0).length / 3 * 100) || 6}%`;
    $("#brief-num").textContent = `MISSION 0${camp.bIdx + 1}`;
    $("#brief-title").textContent = B.mission; $("#brief-place").textContent = B.place; $("#brief-copy").textContent = B.brief;
    $("#ops-report").textContent = camp.report || ""; $("#ops-report").hidden = !camp.report;
    $("#brief-report").textContent = camp.report || ""; $("#brief-report").hidden = !camp.report; // phone copy, at the top of the brief
    $("#threat-value").textContent = threatText();
    $("#structure-value").textContent = state.recon ? "Mapped" : "Partial";
    $("#loot-value").textContent = state.recon ? "Medical cache" : "Possible";
    $("#window-value").textContent = `~${arrivalBarricade()}%`;
    $("#recon-btn").innerHTML = state.recon ? "<span>✓</span> Recon complete <small>Rooms mapped · specials located · 3 thinned</small>" : "<span>◉</span> Send recon team <small>Barricade −10 · maps rooms, thins 3, finds the bloater, screamer and crawlers</small>";
    const over = campaignOver();
    $("#recon-btn").disabled = !canDeploy();
    selectButtons($("#route-choice"), "route", state.route);
    $("#depart-time").textContent = state.route === "vehicle" ? "07:18" : "07:35";
    $("#prepare-btn").disabled = !canDeploy();
    $("#prepare-btn").textContent = over ? "Building resolved" : joelOut() ? `Joel is recovering · ${rec("joel").out} ${rec("joel").out === 1 ? "day" : "days"}` : "Prepare deployment";
    const sc = scavengers();
    $("#scavenge-btn").disabled = !!camp.ended || !sc.length;
    const so = scavOdds();
    $("#scavenge-btn small").textContent = sc.length ? `${sc.map(p => p.name).join(" + ")} · +${so.lo}–${so.hi} rds · ${so.clean}% clean, ${so.hurt}% hurt, ${so.killed}% one killed` : "No one fit to send";
    $("#rest-btn").disabled = !!camp.ended;
    $("#rest-btn small").textContent = over ? "Heal up · the day passes" : `Heal up · barricade −20 while no one comes`;
    $("#new-campaign").textContent = state.confirmWipe ? "Confirm: wipe this campaign" : "New campaign";
    $("#new-campaign").classList.toggle("danger-outline", state.confirmWipe);
  }

  // a day with no mission: wounds heal, the building gets worse
  function quietDay(note){
    team().forEach(p => { const x = rec(p.id); if(x.status === "wounded"){ x.out--; if(x.out <= 0){ x.status = "fit"; x.out = 0; } } else if(x.status === "hurt") x.status = "fit"; });
    let night = "";
    const s = cur();
    if(s.civilians > 0){
      s.barricade -= 20; s.infected = Math.min(36, s.infected + 4);
      if(s.barricade <= 0){ s.civilians--; s.lost++; s.barricade = 40; night = ` With no one coming, the ${B.labels[CIV].toLowerCase()} barricade failed. One civilian was lost.`; }
      if(s.civilians <= 0) night += ` No one is left alive in the ${B.title.toLowerCase()}.`;
    }
    camp.report = `Day ${camp.day}: ${note}${night}`;
    camp.day++; checkBuilding(); checkEnded(); saveCampaign();
  }
  // after any day: a resolved building opens the next one; the last one ends the chapter
  function checkBuilding(){
    if(cur().civilians > 0 || camp.ended) return;
    if(camp.bIdx < BUILDINGS.length - 1){ camp.bIdx++; applyBuilding(); state.recon = false; camp.report += ` Tess picked up a new signal: ${B.mission}, ${B.place.split(" · ")[1]} out.`; }
    else camp.ended = "chapter";
  }
  function checkEnded(){
    if(!camp.ended && team().every(p => p.id === "joel" || rec(p.id).status === "dead")) camp.ended = "wiped";
    if(!camp.ended && scars() >= MAX_SCARS) camp.ended = "joel";
  }
  // ---------- scavenge: a gamble, and the streets near base run dry if you lean on it ----------
  function scavOdds(){
    const h = Math.min(3, camp.scavHeat || 0);
    const killed = 10 + h * 8, hurt = 30 + h * 7, clean = 100 - killed - hurt;
    return {clean, hurt, killed, lo:Math.max(20, 50 - h * 20), hi:Math.max(40, 90 - h * 20)};
  }
  const coolStreets = () => { camp.scavHeat = Math.max(0, (camp.scavHeat || 0) - 1); };
  $("#scavenge-btn").onclick = () => {
    const sc = scavengers(); if(!sc.length || camp.ended) return;
    const o = scavOdds(), roll = Math.random() * 100;
    let rounds = o.lo + Math.floor(Math.random() * ((o.hi - o.lo) / 10 + 1)) * 10, med = Math.random() < .5, note;
    sc.forEach(p => { rec(p.id).lastDay = camp.day; });
    const names = sc.map(p => p.name).join(" and "), victim = sc[Math.floor(Math.random() * sc.length)];
    if(roll < o.killed){
      rounds = Math.round(rounds / 2 / 10) * 10; med = false;
      const x = rec(victim.id); x.status = "dead"; x.out = 0; x.diedDay = camp.day;
      note = `Ambush on the scavenge run. ${victim.name} did not come back.${sc.length > 1 ? ` ${sc.find(p => p !== victim).name} made it home with +${rounds} rounds.` : ""}`;
    } else if(roll < o.killed + o.hurt){
      rounds = Math.round(rounds * .6 / 10) * 10; med = false;
      const x = rec(victim.id); x.status = "wounded"; x.out = 3; // quietDay below heals one day of it at once: 2 days out
      note = `${names} ran into infected on the scavenge run: +${rounds} rounds. ${victim.name} was hurt, out 2 days.`;
    } else note = `${names} scavenged the streets clean: +${rounds} rounds${med ? ", +1 med" : ""}.`;
    if(rec(victim.id).status === "dead") rounds = sc.length > 1 ? rounds : 0;
    camp.ammo += rounds; if(med) camp.meds++;
    camp.scavHeat = (camp.scavHeat || 0) + 1;
    quietDay(note + (camp.scavHeat > 1 ? " The streets near base are picked over." : ""));
    state.recon = false; afterDay();
  };
  $("#rest-btn").onclick = () => { if(camp.ended) return; coolStreets(); quietDay("The team stayed in and patched each other up."); state.recon = false; afterDay(); };
  function afterDay(){ state.confirmWipe = false; if(camp.ended) showEnd(); else renderOps(); }

  $("#open-ops").onclick = () => { if(camp.ended){ showEnd(); return; } renderOps(); show("ops-screen"); };
  $("#prepare-btn").onclick = () => { if(!canDeploy()) return; preparePrep(); show("prep-screen"); };
  $("#back-map").onclick = () => { renderOps(); show("ops-screen"); };
  // leaving a mission: drop the sim and wipe every trace of it from the page, so nothing stale shows later
  function clearMission(){
    m = null; clearInterval(timer); timer = null; state.paused = false;
    DOORS.forEach(d => { d.sealed = 0; d.cd = 0; });
    $("#log-stream").innerHTML = ""; $("#squad-status").innerHTML = ""; $("#objective-text").textContent = "";
    $("#pick-bar").hidden = true; $("#pick-bar").innerHTML = "";
    $("#crisis-overlay").classList.remove("open"); $("#crisis-actions").innerHTML = ""; $("#crisis-title").textContent = ""; $("#crisis-copy").textContent = ""; $("#crisis-queue").textContent = "";
    draw();
  }
  $("#return-ops").onclick = () => {
    clearMission(); state.recon = false;
    if(camp.ended){ showEnd(); return; }
    renderOps(); show("ops-screen");
  };
  $("#end-new").onclick = () => {
    camp = freshCampaign(); saveCampaign(); clearMission(); state.recon = false; state.route = "vehicle"; state.confirmWipe = false;
    renderOps(); show("story-screen");
  };
  $("#nav-map").onclick = () => { renderOps(); show("ops-screen"); };
  $("#roster-jump").onclick = () => { preparePrep(); show("prep-screen"); };
  $$(".map-node[id^=node-]").forEach(n => n.onclick = () => $(".brief-panel").scrollIntoView({behavior:"smooth"}));
  $("#recon-btn").onclick = () => { if(state.recon || !canDeploy()) return; state.recon = true; renderOps(); $(`#node-${camp.bIdx}`).animate([{filter:"brightness(2)"},{filter:"brightness(1)"}], {duration:650}); };
  $("#route-choice").onclick = e => { const b = e.target.closest("button[data-route]"); if(!b) return; state.route = b.dataset.route; renderOps(); };
  $("#new-campaign").onclick = () => {
    if(!state.confirmWipe){ state.confirmWipe = true; renderOps(); return; }
    camp = freshCampaign(); saveCampaign(); state.confirmWipe = false; state.recon = false; state.route = "vehicle"; renderOps();
  };

  // ---------- end of the campaign: chapter done, or the squad is gone ----------
  // its own screen (slice 2.1): the chapter ending, a wiped squad, or a Joel too scarred to lead
  function showEnd(){
    clearMission();
    const kind = camp.ended, good = kind === "chapter";
    $("#end-card").className = `result-card ending-${good ? "chapter" : "wiped"}`; // tone only
    const all = camp.b.reduce((a, s) => ({r:a.r + s.rescued, l:a.l + s.lost}), {r:0, l:0});
    const dead = team().filter(p => rec(p.id).status === "dead"), days = camp.day - START_DAY;
    $("#end-eyebrow").textContent = good ? "CHAPTER 1 · CLOSED" : "CAMPAIGN OVER";
    $("#end-title").textContent = good ? "The long night is coming" : kind === "joel" ? "Joel can't lead any more" : "The squad is gone";
    $("#end-summary").textContent = good
      ? `Both signals are answered in ${plural(days, "day")}. ${plural(all.r, "civilian")} came home, ${all.l} did not.${dead.length ? ` It cost ${dead.map(p => p.name).join(", ")}.` : " Nobody on the team was lost."}`
      : kind === "joel" ? `Three times the team dragged Joel back from the edge. The third time, he did not get up to give orders. ${plural(all.r, "civilian")} came home before the end.`
      : `Joel is the last one standing. No one is left to send. ${plural(all.r, "civilian")} came home before the end.`;
    $("#end-grid").innerHTML = `<div><span>DAYS</span><strong>${days}</strong></div><div><span>CIVILIANS OUT</span><strong>${all.r}</strong></div><div><span>CIVILIANS LOST</span><strong>${all.l}</strong></div><div><span>TEAM LOST</span><strong>${dead.length}</strong></div>`;
    $("#end-buildings").innerHTML = BUILDINGS.map((b, i) => {
      const s = camp.b[i], reached = i <= camp.bIdx;
      return `<div class="casualty-row ${reached && s.civilians > 0 ? "is-hurt" : ""}"><strong>${b.title}</strong><span>${!reached ? "Never reached" : `${s.rescued} rescued · ${s.lost} lost${s.civilians > 0 ? ` · ${s.civilians} left inside` : ""}`}</span></div>`;
    }).join("");
    $("#end-roster").innerHTML = team().map(p => {
      const x = rec(p.id), isDead = x.status === "dead";
      const st = p.id === "joel" ? (scars() ? `Led to the end · ${plural(scars(), "scar")}` : "Led to the end · unhurt")
        : isDead ? `Killed${x.diedDay ? ` · day ${x.diedDay}` : ""}` : x.status === "wounded" ? "Survived · wounded" : "Survived";
      return `<div class="casualty-row ${isDead ? "is-dead" : x.status === "wounded" || (p.id === "joel" && scars()) ? "is-hurt" : ""}"><strong>${p.name} · ${p.role}</strong><span>${st}</span></div>`;
    }).join("");
    $("#end-base").textContent = `${camp.missions} missions · ${camp.ammo} rounds and ${camp.meds} meds left at base. Your progress stays on this device.`;
    show("end-screen");
  }

  // ---------- deployment ----------
  function preparePrep(){
    state.confirmWipe = false;
    state.selected = new Set(team().filter(p => available(p.id)).map(p => p.id));
    state.carryAmmo = Math.min(camp.ammo, 150); state.carryMeds = Math.min(camp.meds, 2);
    selectButtons($("#doctrine-choice"), "doctrine", state.stance);
    const d = $("#deploy-btn"); d.disabled = !canDeploy();
    d.textContent = camp.ended ? "Campaign over" : campaignOver() ? "Building resolved" : joelOut() ? `Joel is recovering · ${rec("joel").out}d` : "Deploy team";
    renderRoster(); renderLoadout(); updateForecast();
  }
  const traitOf = p => p.id !== "joel" ? p.trait : scars()
    ? `Scarred ${scars()}/${MAX_SCARS} · −${scars() * 20} HP, command every ${regenSeconds()}s · ${MAX_SCARS} ends it`
    : `Steady · can't die, but scars if he bleeds out or is left`;
  function renderRoster(){
    $("#squad-list").innerHTML = team().map(p => {
      const ok = available(p.id), sel = state.selected.has(p.id), s = statusLabel(p.id);
      const label = p.id === "joel" ? (s === "FIT" ? "LEADER" : `LEADER · ${s}`) : s;
      const tone = s === "KIA" ? "st-dead" : s.startsWith("WOUNDED") || s.startsWith("OUT") || s === "HURT" ? "st-hurt" : s === "TIRED" ? "st-tired" : "";
      return `<button class="trooper-card ${!ok ? "unavailable" : sel ? "selected" : "unselected"}" data-id="${p.id}" ${ok ? "" : "disabled"}><span class="portrait" style="color:${p.color}">${p.name.slice(0,2).toUpperCase()}</span><span><strong>${p.name}</strong><small>${p.role} · ${traitOf(p)}</small></span><span class="level ${tone}">${label}</span></button>`;
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
    $("#f-bloater").textContent = state.recon ? `Bloater: ${roomName(bloaterRoomFor(camp.day))} · screamer: ${roomName(screamerRoomFor(camp.day))} · ${plural(B.crawlers, "crawler")}: ${crawlerRoomsFor(camp.day, B.crawlers).map(roomName).join(", ")}${B.pack ? ` · ${roomName(PACK_ROOM)} doors bowed: a pack inside` : ""}` : `Unknown · ${B.crawlers > 1 ? "crawlers" : "a crawler"} may hide in rooms you pass`;
    $("#f-barricade").textContent = `${arrivalBarricade()}%`;
    $("#f-noise").textContent = state.route === "vehicle" ? "25 · first wave at 30" : "0 · silent";
    const extra = Math.max(0, state.selected.size - 4);
    $("#f-squad").textContent = `${state.selected.size} · ${[...state.selected].filter(isTired).length} tired${extra ? ` · a big team draws +${extra * 2} infected, bigger waves` : ""}`;
  }
  $("#deploy-btn").onclick = () => { if(!canDeploy()) return; initMission(); show("combat-screen"); startLoop(); };

  // ---------- mission setup ----------
  const randIn = (r, inset = 25) => ({x:r.x + inset + Math.random() * (r.w - inset * 2), y:r.y + inset + Math.random() * (r.h - inset * 2)});
  function addZombie(type, room, x, y, alert){
    const t = ZT[type];
    const z = {kind:"z", id:m.zombies.length, type, room, x, y, hp:t.hp, maxHp:t.hp, speed:t.speed[0] + Math.random() * (t.speed[1] - t.speed[0]), alert, cd:0, alive:true, wp:null, tgt:null, retarget:0, scream:0};
    m.zombies.push(z); return z;
  }
  // a lurking crawler is invisible, can't be shot and doesn't count as "in the room" until spotted
  const hiddenZ = z => z.lurk && !z.spotted;
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
    applyBuilding();
    const picks = team().filter(p => state.selected.has(p.id) && available(p.id));
    m = {running:true, elapsed:0, kills:0, cp:2, cpRegen:0, noise:state.route === "vehicle" ? 25 : 0, wavesFired:0,
      ammo:state.carryAmmo, ammoStart:state.carryAmmo, meds:state.carryMeds, medsStart:state.carryMeds, loot:false,
      stance:state.stance, faw:true, squadRoom:ENTRY, prevRoom:ENTRY, holdT:0, push:false, objective:"reach", clearT:0, holdNoted:false, pulled:false,
      barricade:arrivalBarricade(), seen:ROOMS.map((_, i) => state.recon || i === ENTRY), recon:state.recon, route:state.route,
      units:[], zombies:[], civs:[], shots:[], particles:[], blasts:[], crises:[], arm:null, focus:null, extra:Math.max(0, picks.length - 4),
      bloaterWarned:new Set(), escorts:new Set(), crisisSig:"", hudSig:"", civStart:cur().civilians, report:null};
    m.units = picks.map((p, i) => {
      const hurt = p.id === "joel" && rec("joel").status === "hurt";
      const max = p.id === "joel" ? p.hp - scars() * 20 : p.hp;
      return {...p, kind:"unit", x:62 + (i % 2) * 26, y:430 + Math.floor(i / 2) * 28, room:3, maxHp:max, hp:hurt ? Math.round(max * .6) : max,
        status:"ACTIVE", cool:Math.random() * .5, bleed:0, carry:0, lastHit:-99, tired:isTired(p.id)};
    });
    const n = missionThreat() + m.extra * 2, bRoom = bloaterRoomFor(camp.day), sRoom = screamerRoomFor(camp.day);
    const bp = zombiePoint(bRoom); addZombie("bloater", bRoom, bp.x, bp.y, false);
    const sp = zombiePoint(sRoom); addZombie("screamer", sRoom, sp.x, sp.y, false);
    const weights = [3, 3, 4, .5, 3, 3], total = weights.reduce((a, b) => a + b, 0);
    for(let i = 2; i < n; i++){
      let room;
      if(i <= 4) room = CIV; // the civilians' room always has company
      else { let roll = Math.random() * total; room = 0; while(roll > weights[room]){ roll -= weights[room]; room++; } }
      const p = zombiePoint(room);
      addZombie(i % B.armouredEvery === 0 ? "armoured" : i > n - 1 - B.runnersStart ? "runner" : "shambler", room, p.x, p.y, false);
    }
    const cRooms = crawlerRoomsFor(camp.day, B.crawlers);
    cRooms.forEach((r, i) => { const R = ROOMS[r]; const z = addZombie("crawler", r, R.cx + (Math.random() - .5) * 60 + i * 10, R.cy + (Math.random() - .5) * 50, false); z.lurk = true; z.spotted = state.recon; z.spot = 0; });
    m.regenT = regenSeconds();
    for(let i = 0; i < cur().civilians; i++) m.civs.push({kind:"civ", room:CIV, x:975 + (i % 2) * 30, y:76 + Math.floor(i / 2) * 24, hp:30, status:"trapped"});
    $("#combat-title").textContent = B.title; $("#combat-eyebrow").textContent = `MISSION 0${camp.bIdx + 1} · DAY ${camp.day}`;
    $("#log-stream").innerHTML = "";
    addLog(`Day ${camp.day}. Team entered through the western service door.`);
    addLog(state.recon ? `Recon mapped every room. Bloater in the ${roomName(bRoom)}, a screamer in the ${roomName(sRoom)}, ${cRooms.length > 1 ? "crawlers" : "a crawler"} lying still in the ${[...new Set(cRooms)].map(roomName).join(" and ")}.`
      : "No recon. Most rooms are blind until the team is next to them. Defensive sweeps the rooms it holds.");
    if(B.pack && state.recon) addLog(`Recon: the ${roomName(PACK_ROOM)} doors are bowed outward. Something is packed in there, right next to the ${roomName(CIV)}. Keep a door seal for the way out.`, "critical");
    if(scars()) addLog(`Joel carries ${plural(scars(), "scar")}. Command comes back every ${m.regenT}s.`);
    if(state.route === "vehicle") addLog("The engine noise carried. Noise starts at 25.", "critical");
    else addLog("Came in on foot. Nothing heard them. Yet.");
    if(B.noiseDecay > .5) addLog("The compressors drown out some of your noise. It fades faster here.");
    addLog(`${B.labels[CIV][0] + B.labels[CIV].slice(1).toLowerCase()} barricade at ${Math.round(m.barricade)}%. Anything in there is clawing at it. Loud noise pulls them off it.`);
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
    if(zombie && !e.hunt){ if(d.cd > 0) return; d.cd = .45; } // the freezer pack floods a door, no queue
    e.room = nr; const p = innerPoint(d, nr); e.x = p.x; e.y = p.y;
  }
  function slot(room, i){
    const r = ROOMS[room], dx = (i % 3 - 1) * 30, dy = Math.floor(i / 3) * 30 - 15;
    return {x:clamp(r.cx + dx, r.x + 14, r.x + r.w - 14), y:clamp(r.cy + dy, r.y + 14, r.y + r.h - 14)};
  }
  const arrived = () => m.units.every(u => u.status !== "ACTIVE" || u.room === m.squadRoom) && (m.objective !== "extract" || m.civs.every(c => c.status !== "following" || c.room === m.squadRoom));
  const roomHasZombies = r => m.zombies.some(z => z.alive && z.room === r && !hiddenZ(z));

  // ---------- sim ----------
  function update(step){
    m.elapsed += step;
    DOORS.forEach(d => { if(d.cd > 0) d.cd -= step; if(d.sealed > 0){ d.sealed -= step; if(d.sealed <= 0){ d.sealed = 0; addLog(`The ${doorName(d)} barricade gave way.`); jolt("door"); } } });
    if(m.focus && (!m.focus.z.alive || (m.focus.t -= step) <= 0)) m.focus = null;
    m.units.forEach(u => { if(u.status === "DEAD") return; m.seen[u.room] = true; ADJ[u.room].forEach(n => { m.seen[n.r] = true; }); });
    updateUnits(step); updateZombies(step); updateCivs(step); separate();
    if(m.objective === "reach" && m.barricade > 0){
      const n = m.zombies.filter(z => z.alive && !z.alert && z.room === CIV).length;
      m.barricade = Math.max(0, m.barricade - n * .18 * step);
      if(m.barricade <= 0) barricadeBroke();
    } else if(m.objective === "reach" && roomHasZombies(CIV)){
      // barricade down: one trapped civilian lost every 10s while infected hold the room
      m.civClock = (m.civClock || 0) + step;
      if(m.civClock >= 10){ m.civClock = 0; const c = m.civs.find(c => c.status === "trapped"); if(c) civDies(c); }
    }
    // the trade-off: loud enough and the infected at the barricade turn toward the gunfire
    if(m.objective === "reach" && m.noise >= 45 && !m.pulled && m.zombies.some(z => z.alive && !z.alert && z.room === CIV)){
      m.pulled = true; wakeRoom(CIV); addLog(`Noise 45: the infected in the ${roomName(CIV)} turn from the barricade toward the gunfire.`, "kill");
    }
    m.noise = Math.max(0, m.noise - B.noiseDecay * step + ((m.stance === "aggressive" || m.push) && !arrived() ? .5 * step : 0));
    checkWaves();
    const joel = m.units.find(u => u.id === "joel");
    if(m.cp >= 3) m.cpRegen = 0;
    else if(joel && joel.status === "ACTIVE" && m.elapsed - joel.lastHit > 3){ m.cpRegen += step; if(m.cpRegen >= m.regenT){ m.cpRegen = 0; m.cp++; addLog("Joel has the picture again. +1 command."); } }
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
          if(u.id === "joel"){ u.bleed = 0; if(!u.critical){ u.critical = true; addLog("Joel is critical. He will live, but he will be out of the fight for longer.", "critical"); } }
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
      if(!z.alive || hiddenZ(z) || (z.ignored && dist(u, z) > 50) || !canShoot(u, z, 260)) continue;
      const d = dist(u, z) + (z.alert ? 0 : 80);
      if(d < bd){ bd = d; best = z; }
    }
    return best;
  }
  function wakeRoom(r){ m.zombies.forEach(z => { if(z.alive && z.room === r && !z.lurk) z.alert = true; }); } // a crawler ignores noise: it waits
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
    z.alive = false; m.noise += 12; m.blasts.push({x:z.x, y:z.y, t:.6}); jolt("blast");
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
    addLog(`${u.name} is down in the ${roomName(u.room)}.`, "critical"); jolt("down");
    if(u.id === "joel") addLog("Command is cut. No regen until Joel is back up.", "critical");
    pushCrisis({kind:"down", unit:u});
  }
  function civDies(c){ if(c.status === "dead") return; c.status = "dead"; addLog(`A civilian was killed in the ${roomName(c.room)}.`, "critical"); }

  // crawler: lies still. A defensive hold in its room spots it (3s). Unspotted, it comes up when the column walks back past it.
  function lurk(z, step){
    if(!z.spotted && m.stance === "defensive" && m.units.some(u => u.status === "ACTIVE" && u.room === z.room)){
      z.spot += step;
      if(z.spot >= 3){ z.spotted = true; addLog(`Defensive sweep: a crawler lying still in the ${roomName(z.room)}.`, "kill"); }
    }
    if(m.objective !== "extract") return;
    const near = m.civs.some(c => c.status === "following" && c.room === z.room && dist(c, z) < 110) || m.units.some(u => u.status === "ACTIVE" && u.room === z.room && dist(u, z) < 70);
    if(!near) return;
    z.lurk = false; z.alert = true; z.retarget = 0;
    addLog(`A crawler came up off the ${roomName(z.room)} floor, going for the civilians.${z.spotted ? "" : " Nobody had seen it."}`, "critical"); jolt("down");
  }
  function updateZombies(step){
    for(const z of m.zombies){
      if(!z.alive) continue;
      z.cd -= step;
      if(z.lurk){ lurk(z, step); continue; }
      if(!z.alert && m.units.some(u => u.status !== "DEAD" && u.room === z.room)) z.alert = true;
      if(z.type === "screamer"){
        if(!z.alert && m.noise >= 60) z.alert = true; // anything that loud wakes it
        if(z.alert){
          if(z.scream === 0){ addLog(`A screamer in the ${roomName(z.room)} is drawing breath. Kill it before it brings the street.`, "critical"); z.scream = .01; }
          z.scream += step;
          if(z.scream >= 5){ z.scream = -9; scream(z); }
        }
      }
      if(!z.alert){
        if(z.room === CIV && m.objective === "reach"){
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
      if(z.alive && z.type === "bloater" && !m.bloaterWarned.has(z.id) && m.elapsed >= 8){
        // never on entry; recon means you see it coming from further off, so the window opens earlier
        const near = m.units.find(u => u.status === "ACTIVE" && RDIST[u.room][z.room] <= 1 && dist(u, z) < (m.recon ? 260 : 170));
        if(near){ m.bloaterWarned.add(z.id); pushCrisis({kind:"bloater", z, unit:near}); }
      }
    }
  }
  const validTarget = t => !!t && (t.kind === "unit" ? (t.status === "ACTIVE" || t.status === "DOWN") : t.status === "following");
  function chooseTarget(z){
    let best = null, bs = 1e9;
    const consider = t => { if(!validTarget(t)) return; const s = RDIST[z.room][t.room] * 500 + dist(z, t) + (t.status === "DOWN" ? 120 : 0) - ((z.type === "crawler" || z.hunt) && t.kind === "civ" ? 400 : 0); if(s < bs){ bs = s; best = t; } };
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
    z.cd = 1; const dmg = z.type === "crawler" && t.kind === "civ" ? 30 : ZT[z.type].dmg * (m.ammo <= 0 && t.kind === "unit" ? 1.4 : 1);
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
  function scream(z){
    m.noise += 10; wakeRoom(z.room); ADJ[z.room].forEach(n => wakeRoom(n.r));
    m.blasts.push({x:z.x, y:z.y, t:.6, scream:true}); jolt("wave");
    addLog(`The screamer in the ${roomName(z.room)} shrieked. +10 noise, and the rooms around it are awake.`, "critical");
  }
  function spawnWave(size, at){
    size += Math.ceil(m.extra / 2); // a bigger team is a bigger signal
    const edge = m.wavesFired === 0 && m.route === "vehicle" ? EDGES[1] : EDGES[Math.floor(Math.random() * EDGES.length)];
    const runners = Math.min(size, (m.wavesFired >= 1 ? Math.floor(size / 3) : 0) + B.waveRunners);
    for(let i = 0; i < size; i++){
      const r = ROOMS[edge.room];
      addZombie(size >= 6 && i === 0 ? "armoured" : i >= size - runners ? "runner" : "shambler", edge.room, clamp(edge.x + (Math.random() - .5) * 40, r.x + 12, r.x + r.w - 12), clamp(edge.y + (Math.random() - .5) * 40, r.y + 12, r.y + r.h - 12), true);
    }
    wakeRoom(edge.room); jolt("wave");
    addLog(`Noise ${at}: ${size} infected${runners ? (runners === 1 ? ", one of them a runner," : `, ${runners} of them runners,`) : ""} pushing in through the ${edge.label}.`, "critical");
  }
  function barricadeBroke(){
    addLog(`The ${roomName(CIV)} barricade is down. The civilians are exposed.`, "critical");
    if(m.civs.some(c => c.status === "trapped")) pushCrisis({kind:"barricade"});
  }
  function autoAdvance(step){
    m.holding = false;
    if(m.holdT > 0){ m.holdT -= step; return; }
    if(!arrived()) return;
    const goal = m.objective === "reach" ? CIV : m.objective === "extract" ? ENTRY : null;
    if(goal === null || m.squadRoom === goal){ if(m.squadRoom === CIV) m.push = false; return; }
    const clear = !roomHasZombies(m.squadRoom);
    m.clearT = clear ? m.clearT + step : 0;
    const next = nextStep(m.squadRoom, goal);
    // defensive: still moves, but only once this room has been quiet for 3s and nothing is seen in the next one
    const nextQuiet = !(m.seen[next] && roomHasZombies(next));
    const go = m.push || m.stance === "aggressive" || (m.stance === "controlled" && clear) || (m.stance === "defensive" && m.clearT >= 3 && nextQuiet);
    if(!go){
      m.holding = m.stance === "defensive" && clear;
      if(m.holding && m.clearT >= 6 && !m.holdNoted){ m.holdNoted = true; addLog(`Defensive: holding until the ${roomName(next)} is clear. Switch stance or order Advance to move now.`); }
      return;
    }
    m.holdNoted = false; m.clearT = 0;
    m.prevRoom = m.squadRoom; m.squadRoom = next;
    addLog(`Team moving into the ${roomName(m.squadRoom)}.`);
  }
  function checkObjective(){
    if(m.objective === "reach"){
      const alive = m.civs.filter(c => c.status === "trapped");
      if(!alive.length){ m.objective = "none"; addLog(`No one is left alive in the ${roomName(CIV)}.`, "critical"); return; }
      if(m.units.some(u => u.status === "ACTIVE" && u.room === CIV) && !roomHasZombies(CIV)){
        m.objective = "choose"; m.push = false; m.loot = true; m.ammo += 30; m.meds += 1;
        addLog(`Reached ${plural(alive.length, "civilian")}. Medical cache recovered: +30 rounds, +1 med.`, "kill");
        // slice 2.1: only open the window when there is a real choice
        const counts = takeCounts();
        if(counts.length > 1) pushCrisis({kind:"split"});
        else { addLog(counts[0] === alive.length ? "No choice to make: everyone comes out." : `No choice to make: only ${plural(counts[0], "trooper")} can escort.`); takeCivs(counts[0]); }
      }
    } else if(m.objective === "extract" && !m.civs.some(c => c.status === "following")){
      m.objective = "none"; addLog("No survivors left to bring home.", "critical");
    }
  }
  function checkEnd(){
    if(!m.units.some(u => u.status === "ACTIVE")){ endMission("failure"); return; }
    if(m.objective === "extract"){
      const f = m.civs.filter(c => c.status === "following");
      if(f.length && f.every(c => c.room === ENTRY) && m.units.every(u => u.status !== "ACTIVE" || u.room === ENTRY)) endMission("success");
    }
  }

  // ---------- crises (real events, queued; the sim pauses while one is open, so game speed never eats the window) ----------
  const CRISIS_SECONDS = 12;
  function pushCrisis(c){
    c.uid = ++crisisSeq; c.t = c.max = CRISIS_SECONDS; m.crises.push(c); m.crisisSig = "";
    if(m.arm){ m.arm = null; addLog("Order on hold. Deal with this first."); }
    renderCrisis();
  }
  function crisisValid(c){
    if(c.kind === "down") return c.unit.status === "DOWN";
    if(c.kind === "bloater") return c.z.alive;
    if(c.kind === "split") return m.objective === "choose";
    if(c.kind === "barricade") return m.objective === "reach" && m.civs.some(x => x.status === "trapped");
    if(c.kind === "pack") return m.objective === "extract";
    return false;
  }
  const threatNear = u => m.zombies.some(z => z.alive && dist(z, u) < 70);
  const nearestAlly = u => m.units.filter(a => a !== u && a.status === "ACTIVE" && a.carry <= 0).sort((a, b) => (RDIST[a.room][u.room] * 500 + dist(a, u)) - (RDIST[b.room][u.room] * 500 + dist(b, u)))[0];
  // honest odds: every infected close to the casualty makes the patch-up less likely; a medic helps
  const closeInfected = u => m.zombies.filter(z => z.alive && z.room === u.room && dist(z, u) < 130).length;
  function stabilizeChance(u){
    const medic = m.units.some(x => x.medic && x.status === "ACTIVE" && x !== u);
    return clamp(.8 - closeInfected(u) * .14 + (medic ? .12 : 0) - (u.critical ? .15 : 0), .15, .92);
  }
  function stabilize(u){
    const medic = m.units.some(x => x.medic && x.status === "ACTIVE" && x !== u), p = stabilizeChance(u);
    if(Math.random() < p){ u.status = "ACTIVE"; u.hp = Math.round((medic ? 60 : 40) * .7); u.bleed = 0; u.patched = true; addLog(`${u.name} is patched up and back on their feet.`, "critical"); }
    else { u.bleed = Math.max(1, u.bleed - 4); addLog(`It didn't take. The med is gone and ${u.name} is still down, worse than before.`, "critical"); }
  }
  function takeCounts(){
    const left = m.civs.filter(x => x.status === "trapped").length, able = m.units.filter(u => u.status === "ACTIVE").length;
    const most = Math.min(left, able); // one escort per civilian
    return [...new Set([most, Math.ceil(most / 2), 1])].filter(n => n >= 1);
  }
  function takeCivs(n){
    const left = m.civs.filter(x => x.status === "trapped").length;
    m.civs.filter(x => x.status === "trapped").slice(0, n).forEach(x => { x.status = "following"; });
    m.barricade = 60; m.objective = "extract";
    addLog(`${plural(n, "civilian")} ${n === 1 ? "falls" : "fall"} in behind the team.${left - n ? ` ${left - n} ${left - n === 1 ? "stays" : "stay"} behind a rebuilt barricade.` : ""} Out through the western service door, in the ${roomName(ENTRY)}.`);
    if(B.pack && !m.packFired) freezerPack();
  }
  // Cold Storage (slice 2.1): as the workers step out, the freezer bay gives way. A runner pack, right next to the column.
  // More escorts means fewer guns for this, so the "who comes out" call carries into it.
  const PACK_ROOM = 5;
  function freezerPack(){
    m.packFired = true;
    const d = doorBetween(CIV, PACK_ROOM);
    for(let i = 0; i < B.pack; i++) { const z = addZombie("runner", PACK_ROOM, d.x - 30 + Math.random() * 60, d.y + 30 + Math.random() * 60, true); z.hunt = true; z.hp = z.maxHp = 24; } // the pack goes for the column, and takes two hits
    m.noise += 6; jolt("wave"); assignEscorts();
    addLog(`The ${roomName(PACK_ROOM)} doors burst. ${B.pack} runners, right behind the ${roomName(CIV)}.`, "critical");
    pushCrisis({kind:"pack"});
  }
  function holdOnBloater(z){ z.ignored = true; z.alert = true; z.speed *= 1.6; addLog("Holding. Every gun stays on the others. The bloater keeps coming.", "critical"); }
  function crisisView(c){
    if(c.kind === "down"){
      const u = c.unit, ally = nearestAlly(u), near = closeInfected(u), pct = Math.round(stabilizeChance(u) * 100);
      return {
        title:`${u.name} is down`,
        copy:u.id === "joel" ? `Joel is down in the ${roomName(u.room)} with ${near} infected close. No command regen while he is down. If he bleeds out or is left behind he lives, but takes a scar for good (${scars()}/${MAX_SCARS}; the ${MAX_SCARS === 3 ? "third" : "last"} ends the campaign).`
          : `${u.name} is down in the ${roomName(u.room)} with ${near} infected close. Bleeds out in about ${Math.ceil(u.bleed)}s.`,
        options:[
          {id:"rescue", label:"Drag them clear", sub:ally ? `2 command · ${ally.name} carries, can't fire for 6s` : "2 command · no one free to carry", disabled:m.cp < 2 || !ally,
            run(){ m.cp -= 2; u.status = "INJURED"; u.hp = Math.max(1, Math.round(u.maxHp * .25)); ally.carry = 6; addLog(`${ally.name} dragged ${u.name} clear. Out of the fight, but alive.`, "critical"); }},
          {id:"cover", label:"Cover and stabilize", sub:`1 command + 1 med · ${pct}% to hold${near ? `, ${near} infected close` : ", area quiet"}`, disabled:m.cp < 1 || m.meds < 1,
            run(){ m.cp--; m.meds--; stabilize(u); }},
          u.id === "joel"
            ? {id:"leave", label:"Fight on without him", sub:"Free · no command regen while he is down", danger:true, run(){ addLog("The team fights on. Joel is still down.", "critical"); }}
            : {id:"leave", label:"Leave them", sub:"Free · they will not come back", danger:true, run(){ u.status = "DEAD"; addLog(`Joel ordered the team to leave ${u.name}.`, "critical"); }}
        ], defaults:["rescue", "cover"],
        expire(){ addLog(`No order came. ${u.name} is still down.`, "critical"); }
      };
    }
    if(c.kind === "bloater"){
      const z = c.z;
      return {
        title:"Bloater closing",
        copy:`A bloater is shambling at ${c.unit.name} in the ${roomName(z.room)}. If it bursts close, everyone within a few metres gets hit.`,
        options:[
          {id:"focus", label:"Focus fire", sub:"1 command · everyone on it, kill it at range", disabled:m.cp < 1, run(){ m.cp--; z.ignored = false; m.focus = {z, t:8}; addLog("All fire on the bloater.", "kill"); }},
          {id:"fallback", label:"Fall back", sub:m.prevRoom === m.squadRoom ? "Nowhere to fall back to" : `Free · back to the ${roomName(m.prevRoom)}, lose 8s`, disabled:m.prevRoom === m.squadRoom,
            run(){ const r = m.prevRoom; m.prevRoom = m.squadRoom; m.squadRoom = r; m.holdT = 8; addLog(`Team falling back to the ${roomName(r)}.`); }},
          // slice 2.1: holding is not free. The team stays on the other targets, so the bloater walks into the line and bursts there.
          {id:"hold", label:"Hold ground", sub:"Free · it walks into the line and bursts on it", danger:true, run(){ holdOnBloater(z); }}
        ], defaults:["focus", "fallback"],
        expire(){ holdOnBloater(z); }
      };
    }
    if(c.kind === "pack"){
      const d = doorBetween(CIV, PACK_ROOM), guns = m.units.filter(u => u.status === "ACTIVE" && !m.escorts.has(u)).length;
      return {
        title:"The freezer bay is open",
        copy:`${B.pack} runners are coming through the ${roomName(PACK_ROOM)} and they want the civilians. ${plural(guns, "trooper")} can shoot; escorts can't.`,
        options:[
          {id:"seal", label:"Seal the freezer door", sub:"1 command · 25s, they take the long way round", disabled:m.cp < 1 || d.sealed > 0,
            run(){ m.cp--; d.sealed = 25; m.noise += 3; addLog(`The ${doorName(d)} is wedged shut. The pack goes round.`, "kill"); }},
          {id:"run", label:"Run for the door", sub:"Free · fast and loud, the pack follows", run(){ m.push = true; m.holdT = 0; addLog(`Joel: "Go, go, go."`, "critical"); }},
          {id:"hold", label:"Stand and fight", sub:`Free · ${guns} guns against ${B.pack} runners`, danger:true, run(){ m.holdT = 10; addLog("The team plants its feet in the cold room.", "critical"); }}
        ], defaults:["seal", "run"],
        expire(){ addLog("No order. The team keeps moving."); }
      };
    }
    const left = m.civs.filter(x => x.status === "trapped").length;
    if(c.kind === "split"){
      const able = m.units.filter(u => u.status === "ACTIVE").length;
      const counts = takeCounts();
      const take = n => () => takeCivs(n);
      const shooters = n => Math.max(0, able - n);
      // the crawler is what makes "take everyone" a gamble: with no shooters, nobody answers it
      const lurkers = m.zombies.filter(z => z.alive && z.lurk), seen = lurkers.filter(z => z.spotted);
      const warn = seen.length ? ` A crawler still lies in the ${[...new Set(seen.map(z => z.room))].map(roomName).join(" and ")}, on the way out.`
        : !m.recon && lurkers.length ? " Rooms nobody swept may hide a crawler. Only shooters can answer one." : "";
      return {
        title:"Who comes out today?",
        copy:`${plural(left, "civilian")} in the ${roomName(CIV)}, ${able} troopers on their feet. Each civilian needs an escort, and an escort can't shoot. The rest wait for another day.${warn}`,
        options:counts.map(n => ({id:"take" + n, label:n === left ? `Take all ${n}` : `Take ${n}`, sub:`Free · ${shooters(n)} left shooting`, danger:shooters(n) === 0, run:take(n)})), defaults:[],
        defaultLabel:`the team takes ${Math.min(left, Math.max(1, able - 2))}`,
        expire(){ const n = Math.min(left, Math.max(1, able - 2)); addLog("No order. The team takes who it can protect."); take(n)(); }
      };
    }
    return {
      title:"The barricade is down",
      copy:`The ${roomName(CIV)} barricade gave in. ${plural(left, "civilian")} and whatever was clawing at the door are in the same room now. One dies every 10 seconds until the room is clear.`,
      options:[
        {id:"push", label:`Push to the ${roomName(CIV)}`, sub:"1 command · go now, fast and loud", disabled:m.cp < 1, run(){ m.cp--; m.push = true; m.holdT = 0; addLog(`Joel: "Move. Now. Get to them."`, "critical"); }},
        {id:"hold", label:"Stay the course", sub:"Free · the civilians are on their own", danger:true, run(){ addLog("The team keeps its pace."); }}
      ], defaults:["push"],
      expire(){ addLog("No order. The team keeps its pace.", "critical"); }
    };
  }
  function resolveCrisis(id){
    const c = m && m.crises[0]; if(!c || !m.running) return;
    const opt = crisisView(c).options.find(o => o.id === id); if(!opt || opt.disabled) return;
    opt.run(); m.crises.shift(); m.crisisSig = ""; renderCrisis(); renderHud();
  }
  // the default when no order comes: the first affordable sensible option, never the cruel one
  const defaultOption = v => (v.defaults || []).map(id => v.options.find(o => o.id === id)).find(o => o && !o.disabled);
  function tickCrises(real){
    while(m.crises.length && !crisisValid(m.crises[0])){ m.crises.shift(); m.crisisSig = ""; }
    const c = m.crises[0]; if(!c) return;
    c.t -= real;
    if(c.t <= 0){
      const v = crisisView(c), d = defaultOption(v);
      if(d){ addLog(`No order in time. The squad leader's call: ${d.label.toLowerCase()}.`); d.run(); } else v.expire();
      m.crises.shift(); m.crisisSig = "";
    }
  }
  $("#crisis-actions").onclick = e => { const b = e.target.closest("button[data-opt]"); if(b && !b.disabled) resolveCrisis(b.dataset.opt); };
  function renderCrisis(){
    const ov = $("#crisis-overlay"), c = m && m.running && m.crises[0];
    if(!c){ ov.classList.remove("open"); return; }
    ov.classList.add("open");
    // phone: the card docks over the log only, so the map, stances and orders stay usable
    if(matchMedia("(max-width:760px)").matches){ const lp = $(".battle-log-panel"), sc = $("#combat-screen"); ov.style.top = `${lp.getBoundingClientRect().top - sc.getBoundingClientRect().top}px`; }
    else ov.style.top = "";
    const v = crisisView(c);
    $("#crisis-title").textContent = v.title; $("#crisis-copy").textContent = v.copy;
    $("#crisis-timer-fill").style.width = `${Math.max(0, c.t / c.max) * 100}%`;
    $(".crisis-card").classList.toggle("urgent", c.t <= 4);
    const d = defaultOption(v), dl = d ? d.label.toLowerCase() : v.defaultLabel || "nothing changes";
    $("#crisis-queue").textContent = `Paused · no order in ${Math.ceil(Math.max(0, c.t))}s: ${dl}${m.crises.length > 1 ? ` · +${m.crises.length - 1} more waiting` : ""}`;
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
    // slice 2.1: orders lock while a command window is open. The sim is paused, so spending command there is free planning,
    // and the crisis is the decision on the table. Stances (free) and Retreat (a real answer to any crisis) stay open.
    if(m.crises.length){ addLog("Orders wait. Make the call first."); return; }
    if(cmd === "advance" || cmd === "seal"){
      if(m.arm === cmd){ m.arm = null; addLog("Order cancelled."); }
      else if(m.cp < 1) addLog("Not enough command. Joel needs time to read the situation.");
      else { m.arm = cmd; addLog(cmd === "advance" ? "Advance: tap a room on the map, or pick one below." : "Seal: tap a door on the map, or pick one below."); }
    } else if(cmd === "focus"){
      const live = m.zombies.filter(z => z.alive && !hiddenZ(z) && m.units.some(u => u.status === "ACTIVE" && RDIST[u.room][z.room] <= 1));
      const pick = live.find(z => z.type === "screamer" && z.alert) || live.find(z => z.type === "bloater") || live.find(z => z.type === "armoured") || live.find(z => z.type === "screamer") || live.sort((a, b) => a.hp - b.hp)[0];
      if(!pick) addLog("Nothing in sight to focus on.");
      else if(spend(1)){ m.focus = {z:pick, t:8}; addLog(`All fire on the ${pick.type === "shambler" || pick.type === "runner" ? "nearest infected" : pick.type} in the ${roomName(pick.room)}.`, "kill"); }
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
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function toMap(e){
    const r = canvas.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    return {x:(e.clientX - r.left - (r.width - W * s) / 2) / s, y:(e.clientY - r.top - (r.height - H * s) / 2) / s};
  }
  function orderAdvance(r){
    if(r < 0 || r === m.squadRoom){ addLog("Pick a different room."); return; }
    if(!spend(1)) { m.arm = null; return; }
    m.prevRoom = m.squadRoom; m.squadRoom = r; m.holdT = 0; m.arm = null; m.clearT = 0;
    addLog(`Joel: "Move to the ${roomName(r)}."`);
  }
  function orderSeal(d){
    if(!d){ addLog("Tap closer to a door."); return; }
    if(!spend(1)) { m.arm = null; return; }
    d.sealed = 20; m.noise += 3; m.arm = null;
    addLog(`The ${doorName(d)} is wedged shut. About 20 seconds.`);
  }
  canvas.onclick = e => {
    if(!m || !m.arm || !m.running || m.crises.length) return; const p = toMap(e);
    const rr = canvas.getBoundingClientRect(), s = Math.min(rr.width / W, rr.height / H);
    if(m.arm === "advance") orderAdvance(ROOMS.findIndex(R => p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h));
    else orderSeal(DOORS.filter(d => dist(d, p) < Math.max(55, 30 / s)).sort((a, b) => dist(a, p) - dist(b, p))[0]); // at least a 60px tap circle on screen
    renderHud();
  };
  // the same orders as buttons: big tap targets on a phone
  $("#pick-bar").onclick = e => {
    const b = e.target.closest("button[data-pick]"); if(!b || !m || !m.running || !m.arm) return;
    const v = +b.dataset.pick;
    if(b.dataset.kind === "room") orderAdvance(v); else orderSeal(DOORS[v]);
    renderHud();
  };
  function renderPick(){
    const bar = $("#pick-bar");
    if(!m || !m.arm){ bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false;
    if(m.arm === "advance") bar.innerHTML = ROOMS.map((R, i) => i === m.squadRoom ? "" : `<button data-kind="room" data-pick="${i}">${m.seen[i] ? R.label : "? " + R.label}</button>`).join("");
    else bar.innerHTML = ADJ[m.squadRoom].map(({d, r}) => `<button data-kind="door" data-pick="${DOORS.indexOf(d)}">${d.sealed > 0 ? "▣ " : ""}DOOR TO ${ROOMS[r].label}</button>`).join("");
  }

  // ---------- end of mission: resolve everything synchronously, then show ----------
  function endMission(reason){
    if(!m || !m.running) return;
    m.running = false; m.arm = null; m.crises = []; renderCrisis();
    const anyActive = m.units.some(u => u.status === "ACTIVE");
    m.units.forEach(u => {
      if(u.status !== "DOWN") return;
      const carried = (reason === "success" && anyActive) || (reason === "retreat" && m.units.some(a => a.status === "ACTIVE" && a.room === u.room));
      if(carried){ u.status = "INJURED"; u.carriedOut = true; }
      else if(u.id === "joel"){ u.status = "INJURED"; u.overrun = true; } // story-protected, but not free: see writeBack
      else { u.status = "DEAD"; u.leftBehind = true; }
    });
    let rescued = 0, scrambled = 0;
    m.civs.forEach(c => {
      if(c.status !== "following") return;
      if(reason === "success" || (reason === "retreat" && (c.room === ENTRY || Math.random() < .5))){ c.status = "out"; rescued++; }
      else { c.status = "dead"; if(reason === "retreat") scrambled++; }
    });
    const lost = m.civs.filter(c => c.status === "dead").length;
    const ammoUsed = m.ammoStart + (m.loot ? 30 : 0) - m.ammo;
    m.report = {reason, rescued, lost, scrambled, ammoUsed, day:camp.day};
    writeBack(m.report);
    setTimeout(showResults, 700);
  }
  const RECRUITS = [
    {name:"Marco",color:"#c98f6b"},{name:"Anya",color:"#8fb3d9"},{name:"Lev",color:"#a3c27a"},{name:"Priya",color:"#d99ab8"},{name:"Omar",color:"#c7b46a"},{name:"Hana",color:"#7fc9b0"}
  ];
  // every second civilian brought home, one of them picks up a rifle (if there is room on the team)
  function volunteers(){
    const out = [];
    while(Math.floor(camp.rescuedTotal / 2) > (camp.recruitsEarned || 0)){
      const alive = team().filter(p => rec(p.id).status !== "dead").length;
      const pick = RECRUITS[camp.recruits.length];
      if(alive >= 6 || !pick) break; // no room yet: the volunteer waits until there is
      camp.recruitsEarned = (camp.recruitsEarned || 0) + 1;
      const id = "r" + camp.recruits.length;
      camp.recruits.push({id, name:pick.name, role:"Volunteer", trait:"Rookie · +50% noise, learning fast", hp:80, color:pick.color, dmg:18, rof:.8, rookie:true});
      camp.roster[id] = {status:"fit", out:0, lastDay:-99};
      out.push(pick.name);
    }
    return out;
  }
  function writeBack(r){
    coolStreets();
    team().forEach(p => { const x = rec(p.id); if(x.status === "wounded"){ x.out--; if(x.out <= 0){ x.status = "fit"; x.out = 0; } } else if(x.status === "hurt") x.status = "fit"; });
    let toll = "";
    m.units.forEach(u => {
      const x = rec(u.id); x.lastDay = camp.day;
      if(u.id === "joel"){
        if(u.status === "INJURED" || u.patched){
          // Joel can't die, but a downed Joel costs days of command, and an overrun costs the base
          const days = (u.overrun ? 2 : 1) + (u.critical ? 1 : 0);
          x.status = "wounded"; x.out = days;
          if(u.overrun){ toll = " Getting Joel back cost the base 40 rounds and a med."; }
          // slice 2.1: a near-death leaves a scar for good: −20 max HP and +4s on command regen. The third ends the campaign.
          const scarred = u.overrun || u.critical;
          if(scarred){ camp.joelScars = scars() + 1; toll += ` Joel will carry this one: scar ${scars()} of ${MAX_SCARS}.`; }
          u.outcome = `${u.overrun ? "Dragged out by the base" : "Downed"} · can't lead for ${plural(days, "day")}${scarred ? ` · scar ${scars()}/${MAX_SCARS}` : ""}`;
        } else if(u.hp < u.maxHp * .4){ x.status = "hurt"; x.out = 0; u.outcome = "Hurt · still leads, at reduced HP"; }
        else { x.status = "fit"; x.out = 0; u.outcome = "Returned"; }
        return;
      }
      if(u.status === "DEAD"){ x.status = "dead"; x.out = 0; x.diedDay = camp.day; u.outcome = u.leftBehind ? "Killed · left behind" : "Killed in action"; }
      else if(u.status === "INJURED"){ x.status = "wounded"; x.out = 2; u.outcome = "Wounded · out 2 days"; }
      else if(u.hp < u.maxHp * .4){ x.status = "wounded"; x.out = 1; u.outcome = "Hurt · out 1 day"; }
      else { x.status = "fit"; x.out = 0; u.outcome = "Returned"; }
    });
    camp.ammo = Math.max(0, camp.ammo - m.ammoStart + m.ammo);
    camp.meds = Math.max(0, camp.meds - m.medsStart + m.meds);
    if(m.units.some(u => u.id === "joel" && u.overrun)){ camp.ammo = Math.max(0, camp.ammo - 40); camp.meds = Math.max(0, camp.meds - 1); }
    const s = cur();
    s.civilians -= r.rescued + r.lost; s.rescued += r.rescued; s.lost += r.lost; camp.rescuedTotal = (camp.rescuedTotal || 0) + r.rescued;
    // smoother curve: what you leave behind still grows, but within a band, so one bad day is not a death spiral
    const growth = 6 + Math.floor(m.noise / 15);
    s.infected = clamp(m.zombies.filter(z => z.alive).length + growth, 14, 36);
    let night = "";
    if(s.civilians > 0){
      if(m.barricade <= 0){ s.civilians--; s.lost++; s.barricade = 40; night = " The barricade failed overnight. One more civilian was lost."; }
      else s.barricade = clamp(Math.round(m.barricade + 5), 25, 100); // the survivors shore it up overnight
    }
    r.left = s.civilians; r.barricade = s.barricade; r.title = B.title;
    const what = r.reason === "success" ? `${r.rescued} rescued` : r.reason === "retreat" ? (r.rescued ? `withdrew with ${r.rescued}` : "withdrew empty-handed") : "the team was overrun";
    const dead = m.units.filter(u => u.status === "DEAD").map(u => u.name);
    const joined = volunteers();
    r.joined = joined;
    camp.report = `Day ${r.day}: ${what}${dead.length ? `, lost ${dead.length > 1 ? dead.slice(0, -1).join(", ") + " and " + dead.at(-1) : dead[0]}` : ""}.${toll}${s.civilians > 0 ? ` ${growth} more infected drifted in overnight.` : ""}${night}${joined.length ? ` ${joined.join(" and ")} volunteered to join the team.` : ""}`;
    camp.day++; camp.missions++;
    r.resolved = s.civilians <= 0;
    checkBuilding(); checkEnded();
    saveCampaign();
  }
  function showResults(){
    if(!m || !m.report) return;
    state.endMode = false;
    $("#result-eyebrow").textContent = `AFTER-ACTION REPORT · ${m.report.title.toUpperCase()}`; $("#return-ops").textContent = camp.ended ? "See how it ends" : "Return to operations";
    const r = m.report, dead = m.units.filter(u => u.status === "DEAD"), hurt = m.units.filter(u => u.outcome && /^(Wounded|Hurt|Downed|Dragged)/.test(u.outcome));
    const names = list => list.length > 1 ? list.slice(0, -1).map(u => u.name).join(", ") + " and " + list.at(-1).name : list.map(u => u.name).join("");
    const joel = m.units.find(u => u.id === "joel");
    $(".result-card").className = `result-card outcome-${r.reason}`; // tone only
    $("#result-title").textContent = r.reason === "failure" ? "Signal lost" : r.reason === "retreat" ? "Team withdrawn" : "Team returning";
    let s;
    if(r.reason === "success") s = `${plural(r.rescued, "civilian")} brought out through the service door.${r.lost ? ` ${plural(r.lost, "civilian")} did not make it.` : ""}`;
    else if(r.reason === "retreat") s = r.rescued ? `The team pulled out early with ${plural(r.rescued, "civilian")}.${r.scrambled ? ` ${r.scrambled} lost in the scramble.` : ""}`
      : `The team pulled out empty-handed.${r.lost ? ` ${plural(r.lost, "civilian")} died inside.` : ""}`;
    else s = `The team was overrun. Runners from the base dragged Joel out, at a price.${r.lost ? ` ${plural(r.lost, "civilian")} died in there.` : ""}`;
    if(dead.length) s += ` ${names(dead)} ${dead.length > 1 ? "are" : "is"} gone.`;
    if(hurt.length) s += ` ${names(hurt)} will need time.`;
    const whole = !dead.length && !hurt.length;
    if(r.reason === "success" && whole && !r.lost && r.left === 0) s += " For once, everyone is coming home.";
    else if(r.reason === "success" && whole) s += ` The team came back whole${r.left ? `, but ${plural(r.left, "civilian")} still ${r.left === 1 ? "waits" : "wait"} inside` : ""}.`;
    if(r.joined && r.joined.length) s += ` ${r.joined.join(" and ")} asked to join the team.`;
    $("#result-summary").textContent = s;
    $("#result-grid").innerHTML = `<div><span>INFECTED CLEARED</span><strong>${m.kills}</strong></div><div><span>CIVILIANS OUT</span><strong>${r.rescued} / ${m.civStart}</strong></div><div><span>AMMO USED</span><strong>${r.ammoUsed}</strong></div><div><span>TEAM LOSSES</span><strong>${dead.length}</strong></div>`;
    $("#result-base").textContent = r.resolved
      ? `${r.title} is resolved. ${camp.ended ? "That was the last signal." : `New signal: ${B.mission}.`} Base stock: ${camp.ammo} rounds · ${camp.meds} meds.`
      : `Base stock: ${camp.ammo} rounds · ${camp.meds} meds. ${plural(r.left, "civilian")} still trapped, barricade ${r.barricade}%. Day ${camp.day} next.${joel && rec("joel").status === "wounded" ? ` Joel can't lead for ${plural(rec("joel").out, "day")}: scavenge or rest.` : ""}`;
    $("#casualty-list").innerHTML = m.units.map(u => `<div class="casualty-row ${u.status === "DEAD" ? "is-dead" : hurt.includes(u) ? "is-hurt" : ""}"><strong>${u.name} · ${u.role}</strong><span>${u.outcome}</span></div>`).join("");
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
      let sim = m.crises.length ? 0 : real * state.speed; // a crisis pauses the sim at any speed
      while(sim > 1e-6 && m.running){ const s = Math.min(.05, sim); update(s); sim -= s; }
    }
    draw(); renderHud(); renderCrisis();
  }
  $("#pause-btn").onclick = () => { state.paused = !state.paused; $("#pause-btn").classList.toggle("selected", state.paused); $("#pause-btn").textContent = state.paused ? "▶" : "Ⅱ"; };
  // leaving the app (home button, app switch, lock) pauses a live mission instead of letting crises time out unseen
  document.addEventListener("visibilitychange", () => { if(document.hidden && m && m.running && !state.paused) $("#pause-btn").click(); });
  $$("[data-speed]").forEach(b => b.onclick = () => { state.speed = +b.dataset.speed; state.paused = false; $("#pause-btn").classList.remove("selected"); $("#pause-btn").textContent = "Ⅱ"; $$("[data-speed]").forEach(x => x.classList.toggle("selected", x === b)); });

  // ---------- HUD ----------
  const fmt = n => { const t = Math.floor(n); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  function chipText(u){
    if(u.status === "ACTIVE") return `${Math.max(0, Math.round(u.hp))} HP${u.carry > 0 ? " · CARRYING" : m.escorts.has(u) ? " · ESCORT" : ""}`;
    if(u.status === "DOWN") return u.id === "joel" ? (u.critical ? "DOWN · CRITICAL" : `DOWN · ${Math.ceil(u.bleed)}s`) : `DOWN · ${Math.ceil(u.bleed)}s`;
    if(u.status === "INJURED") return "CARRIED";
    return "KIA";
  }
  function renderHud(){
    if(!m) return;
    const joel = m.units.find(u => u.id === "joel"), joelUp = joel && joel.status === "ACTIVE";
    const chips = m.units.map(u => `<div class="unit-chip ${u.status.toLowerCase()}${u.tired ? " tired" : ""}${u.status === "ACTIVE" && u.hp < u.maxHp * .4 ? " low" : ""}" style="--hp:${u.status === "ACTIVE" ? Math.max(0, Math.round(u.hp / u.maxHp * 100)) : u.status === "DOWN" ? Math.round(clamp(u.bleed / 20, 0, 1) * 100) : 0}%"><strong>${u.name}</strong><small>${chipText(u)}</small></div>`).join("");
    const objective = m.objective === "reach" ? (m.barricade > 0 ? `Reach the civilians · barricade ${Math.ceil(m.barricade)}%` : `Barricade down · next civilian lost in ${Math.ceil(10 - (m.civClock || 0))}s`)
      : m.objective === "extract" ? `Extract ${plural(m.civs.filter(c => c.status === "following").length, "civilian")} · west door${m.holding ? " · holding (defensive)" : ""}`
      : m.objective === "choose" ? "Decide who comes out" : "No one left to save · retreat";
    const locked = m.running && m.crises.length > 0;
    const sig = chips + objective + m.cp + m.stance + m.faw + m.arm + m.meds + m.squadRoom + m.holding + locked;
    if(sig !== m.hudSig){
      m.hudSig = sig;
      $("#squad-status").innerHTML = chips;
      $("#objective-text").textContent = objective;
      $("#command-points").textContent = "● ".repeat(m.cp) + "○ ".repeat(3 - m.cp);
      $$("#stance-bar [data-stance]").forEach(b => b.classList.toggle("selected", b.dataset.stance === m.stance));
      const faw = $("#stance-bar [data-faw]"); faw.textContent = m.faw ? "FIRE AT WILL: ON" : "FIRE AT WILL: OFF"; faw.classList.toggle("faw-off", !m.faw);
      $$("#command-bar [data-command]").forEach(b => {
        const c = b.dataset.command;
        b.classList.toggle("off", c !== "retreat" && (locked || m.cp < 1 || (c === "gear" && m.meds < 1)));
        b.setAttribute("aria-disabled", c !== "retreat" && locked ? "true" : "false");
        b.classList.toggle("armed", m.arm === c);
      });
      renderPick();
    }
    $("#cp-regen-label").textContent = !joelUp ? "NO REGEN · JOEL DOWN" : m.cp >= 3 ? "FULL" : `+1 IN ${Math.ceil(m.regenT - m.cpRegen)}s`;
    $("#bandwidth-fill").style.width = `${joelUp && m.cp < 3 ? m.cpRegen / m.regenT * 100 : m.cp >= 3 ? 100 : 0}%`;
    const nextWave = m.wavesFired < 3 ? WAVE_AT[m.wavesFired] : 100;
    $("#noise-value").textContent = `${Math.round(m.noise)} / ${nextWave}`;
    $(".bandwidth").classList.toggle("noise-near", nextWave - m.noise <= 8);
    $("#noise-fill").style.width = `${Math.min(100, m.noise)}%`;
    $("#ammo-value").textContent = `${m.ammo} rds`;
    $("#meds-value").textContent = m.meds;
    $("#mission-clock").textContent = fmt(m.elapsed);
  }
  function addLog(text, type = "normal"){ $("#log-stream").insertAdjacentHTML("afterbegin", `<div class="log-entry ${type}"><time>${fmt(m ? m.elapsed : 0)}</time><span>${text}</span></div>`); }
  // a short screen-edge flash that carries what happened: a trooper down, a wave, a blast, a door giving way
  function jolt(kind){ const w = $(".battlefield-wrap"); if(!w) return; w.classList.remove("jolt-down", "jolt-wave", "jolt-blast", "jolt-door"); void w.offsetWidth; w.classList.add("jolt-" + kind); }
  function burst(x, y, color){ for(let i = 0; i < 5; i++) m.particles.push({x, y, vx:(Math.random() - .5) * 80, vy:(Math.random() - .5) * 80, t:.35, color}); }

  // ---------- draw ----------
  function draw(){
    ctx.fillStyle = "#111916"; ctx.fillRect(0, 0, W, H);
    // visual scale only: when the canvas is drawn small (a phone), labels and markers grow so they stay readable
    const vs = clamp(W / (canvas.clientWidth || W) * .7, 1, 2), ur = 10 * Math.min(1.3, vs), zr = Math.min(1.3, vs), px = n => `${Math.round(n * vs)}px monospace`;
    ctx.save(); ctx.lineWidth = 5;
    ROOMS.forEach((r, i) => {
      ctx.fillStyle = i % 2 ? "#17201d" : "#1b2421"; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = m && m.arm === "advance" && i !== m.squadRoom ? "#61d4cf" : "#34413c"; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "#6b7a74"; ctx.font = "bold " + px(11); ctx.fillText(r.label, r.x + 14, r.y + 10 + 11 * vs);
    });
    for(let x = 300; x < 400; x += 55){ ctx.fillStyle = "#29342f"; ctx.fillRect(x, 340, 16, 230); }
    ctx.fillStyle = "#26322e"; ctx.fillRect(470, 335, 210, 32); ctx.fillRect(470, 430, 210, 32); ctx.fillRect(760, 350, 240, 24);
    // doors
    DOORS.forEach(d => {
      const vw = d.axis === "v", w = vw ? 26 : 44, h = vw ? 44 : 26;
      ctx.fillStyle = "#1e2a26"; ctx.fillRect(d.x - w / 2, d.y - h / 2, w, h);
      if(d.sealed > 0){ ctx.fillStyle = "#d6ad55"; ctx.fillRect(vw ? d.x - 4 : d.x - 22, vw ? d.y - 22 : d.y - 4, vw ? 8 : 44, vw ? 44 : 8); ctx.fillStyle = "#d6ad55"; ctx.font = "bold " + px(10); ctx.fillText(Math.ceil(d.sealed) + "s", d.x + 8, d.y - 8); }
      else if(m && m.arm === "seal"){ ctx.strokeStyle = "#61d4cf"; ctx.lineWidth = 2; ctx.strokeRect(d.x - w / 2, d.y - h / 2, w, h); }
    });
    ctx.fillStyle = "#8dbb72"; ctx.fillRect(27, 438, 10, 44); ctx.font = "bold " + px(10); ctx.fillText("ENTRY", 44, 620);
    EDGES.forEach(e => { ctx.fillStyle = "#5d211d"; const r = ROOMS[e.room]; if(e.room === 0) ctx.fillRect(e.x - 22, r.y - 6, 44, 8); else ctx.fillRect(r.x + r.w - 2, e.y - 22, 8, 44); });
    // civilians' corner + barricade
    const bar = m ? m.barricade : 100;
    ctx.strokeStyle = bar > 0 ? (bar > 40 ? "#8b7a55" : "#b4472f") : "#ff493d"; ctx.lineWidth = 3; ctx.setLineDash(bar > 0 ? [] : [4, 8]);
    ctx.beginPath(); ctx.moveTo(945, 55); ctx.lineTo(945, 160); ctx.lineTo(1055, 160); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#8dbb72"; ctx.font = "bold " + px(10); ctx.textAlign = "right"; ctx.fillText(m && m.objective !== "reach" ? "" : `CIVILIANS ${Math.ceil(bar)}%`, 1052, 172 + 10 * vs); ctx.textAlign = "left";
    if(m){
      // squad marker
      const R = ROOMS[m.squadRoom]; ctx.strokeStyle = "#61d4cf55"; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(R.cx, R.cy, 48, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      m.civs.forEach(c => { if(c.status !== "trapped" && c.status !== "following") return; ctx.fillStyle = "#8dbb72"; ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e8fff7"; ctx.lineWidth = 1; ctx.stroke(); });
      m.zombies.forEach(z => {
        if(!z.alive || !m.seen[z.room] || hiddenZ(z)) return;
        const t = ZT[z.type];
        ctx.fillStyle = z.type === "armoured" ? "#a68d67" : z.type === "bloater" ? "#9aa040" : z.type === "screamer" ? "#b48ad6" : z.type === "crawler" ? (z.lurk ? "#5d6a3c" : "#c4cf63") : z.type === "runner" ? (z.alert ? "#ff7a3d" : "#7a3a22") : z.alert ? "#b3372d" : "#6d2a25";
        ctx.beginPath(); ctx.arc(z.x, z.y, t.r * zr, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#ff776d55"; ctx.lineWidth = 1; ctx.stroke();
        if(z.type === "armoured"){ ctx.fillStyle = "#d2bea0"; ctx.fillRect(z.x - 8, z.y - 2, 16, 4); }
        if(z.type === "screamer" && z.scream > 0 && z.alert){ ctx.strokeStyle = "#d8b6ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, t.r + 4 + z.scream * 4, 0, Math.PI * 2); ctx.stroke(); }
        if(z.type === "crawler"){ ctx.strokeStyle = "#c4cf63"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z.x - 10, z.y + 3); ctx.lineTo(z.x + 10, z.y + 3); ctx.stroke(); }
        if(z.type === "runner"){ ctx.strokeStyle = "#ff7a3d88"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z.x - 9, z.y + 4); ctx.lineTo(z.x - 3, z.y); ctx.stroke(); }
        if(m.focus && m.focus.z === z){ ctx.strokeStyle = "#61d4cf"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, t.r + 6, 0, Math.PI * 2); ctx.stroke(); }
      });
      m.units.forEach(u => {
        ctx.globalAlpha = u.status === "DEAD" ? .25 : u.status === "INJURED" ? .55 : 1;
        if(u.status === "DOWN"){ const p = RM ? .5 : (Math.sin(performance.now() / 160) + 1) / 2; ctx.strokeStyle = `rgba(255,73,61,${.35 + p * .5})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(u.x, u.y, ur + 6 + p * 6, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = u.status === "DOWN" ? "#ff493d" : u.color; ctx.beginPath(); ctx.arc(u.x, u.y, ur, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#e8fff7"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#07100f"; ctx.font = `bold ${Math.round(ur * .9)}px monospace`; ctx.textAlign = "center"; ctx.fillText(u.name[0], u.x, u.y + ur * .32); ctx.textAlign = "left"; ctx.globalAlpha = 1;
      });
      m.shots.forEach(s => { ctx.globalAlpha = Math.min(1, s.t * 8) * (s.miss ? .35 : 1); ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); });
      m.blasts.forEach(b => { ctx.globalAlpha = b.t; ctx.fillStyle = b.scream ? "#b48ad633" : "#c9d14a55"; ctx.beginPath(); ctx.arc(b.x, b.y, 95 * (1.2 - b.t / 2), 0, Math.PI * 2); ctx.fill(); });
      m.particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.t * 3); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });
      ctx.globalAlpha = 1;
      ROOMS.forEach((r, i) => { if(m.seen[i]) return; ctx.fillStyle = "#070c0bdd"; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = "#3d4a45"; ctx.font = "bold " + px(34); ctx.textAlign = "center"; ctx.fillText("?", r.x + r.w / 2, r.y + r.h / 2 + 12); ctx.textAlign = "left"; });
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function registerWebTools(){
    const mc = document.modelContext; if(!mc?.registerTool) return;
    Promise.resolve(mc.registerTool({name:"read_zombie_mission_status", title:"Read Mission Status", description:"Read the current prototype screen, campaign and live mission status.", inputSchema:{type:"object", properties:{}, additionalProperties:false}, annotations:{readOnlyHint:true, untrustedContentHint:false},
      execute:() => ({screen:state.screen, day:camp.day, civiliansTrapped:cur().civilians, building:B.title, ammo:camp.ammo, meds:camp.meds,
        mission:m ? {elapsed:Math.floor(m.elapsed), kills:m.kills, commandPoints:m.cp, noise:Math.round(m.noise), objective:m.objective, team:m.units.map(u => ({name:u.name, status:u.status, hp:Math.max(0, Math.round(u.hp))}))} : null})})).catch(() => {});
  }
  window.ZB = {get m(){ return m; }, get camp(){ return camp; }, state};
  renderOps(); registerWebTools(); draw();
})();
