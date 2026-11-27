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
    {id:"joel",name:"Joel",role:"Leader",trait:"Can't die",hp:120,color:"#d6ad55",dmg:22,rof:.75},
    {id:"shannon",name:"Shannon",role:"Rifle",trait:"+15% hit",hp:95,color:"#61d4cf",dmg:26,rof:.7,acc:.15},
    {id:"mike",name:"Mike",role:"Shotgun",trait:"Close · loud",hp:110,color:"#8dbb72",dmg:14,close:46,rof:.95,noise:1.8},
    {id:"ruiz",name:"Ruiz",role:"Scout",trait:"Fast · quiet",hp:85,color:"#72a6bb",dmg:18,rof:.5,speed:1.3,noise:.6},
    {id:"gustave",name:"Gustave",role:"Medic",trait:"Better medkits",hp:90,color:"#b494d0",dmg:16,rof:.85,medic:true},
    {id:"david",name:"David",role:"Rifle",trait:"Rookie · loud",hp:90,color:"#c6c6b5",dmg:24,rof:.7,rookie:true}
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
      brief:"Civilians barricaded in. The shutters are failing.",
      labels:["SHOP FLOOR","CHECKOUT","STOCKROOM","AISLES","OFFICE","LOADING BAY"], civ:6, infected:30,
      armouredEvery:10, runnersStart:0, waveRunners:0, crawlers:1, pack:0, noiseDecay:.7, softStart:true, bloaterRooms:[4,5,1], screamerRooms:[5,0,4]}, // slice 4.1: fewer armoured, none in the first noise wave
    {key:"cold", mission:"Cold Storage", title:"Cold Storage", place:"COLD STORAGE · 5.1 KM",
      brief:"Five workers in the cold room. Armoured and runners. Compressors hide noise.",
      labels:["DOCK OFFICE","SORTING","COLD ROOM","PALLET HALL","PUMP ROOM","FREEZER BAY"], civ:5, infected:34,
      armouredEvery:5, runnersStart:6, waveRunners:2, crawlers:2, pack:8, noiseDecay:1, bloaterRooms:[5,1,4], screamerRooms:[1,5,0]}, // slice 2.1: bloater never in the entry room
    // slice 3: the finale. Home base, one night, hold the shelter until dawn. Same floor plan, waves on a clock.
    {key:"night", mission:"The Long Night", title:"Home Base", place:"HOME · 0 KM", night:true,
      brief:"Hold the shelter until dawn.",
      labels:["NORTH YARD","COURTYARD","SHELTER","WEST HALL","WORKSHOP","MOTOR POOL"], civ:0, infected:0,
      armouredEvery:99, runnersStart:0, waveRunners:1, crawlers:0, pack:0, noiseDecay:1.2, bloaterRooms:[], screamerRooms:[]}
  ];
  // slice 3 (Upgrade): parts buy one base build per rest day. Few options, more than you can afford.
  const UPGRADES = [
    {id:"walls", name:"Walls", cost:4, sub:"Shelter 100% · 2 ways in"},
    {id:"infirmary", name:"Infirmary", cost:3, sub:"Heal ×2"},
    {id:"bench", name:"Reload bench", cost:3, sub:"+20 rds a day"},
    {id:"radio", name:"Radio mast", cost:2, sub:"Free recon"},
    {id:"drill", name:"Drill", cost:2, sub:"Rookies quiet"}
  ];
  const has = id => !!(camp.up && camp.up[id]);
  // slice 3 (Expand): what a resolved building gives the base, for good
  const REWARDS = {shop:{id:"safehouse", name:"Safe house", sub:"scavenge risk ½"}, cold:{id:"coldroom", name:"Cold room", sub:"+1 med a rest"}};
  const NIGHT_PREP = 2, DAWN = 150, NIGHT_AMMO = 250;
  const IDLE_DECAY = 15, BAR_FLOOR = 40, BAR_RESET = 55, DAY_DRAIN = .12, DRIFT_AMMO = 150, CIV_AMMO = 20, START_AMMO = 400;
  const payout = s => { const k = s.rescued / Math.max(1, s.civStart); return k >= .5 ? {parts:3, bonus:true} : s.rescued > 0 ? {parts:1, bonus:false} : {parts:0, bonus:false}; };
  // slice 3.1: the shelter. Each raider at the wall takes NIGHT_DRAIN % a second; with no infected in the room the people inside
  // shore it back up (NIGHT_REPAIR % a second, up to NIGHT_CAP). Walls: start full, one way in fewer, slower drain, faster repair.
  const NIGHT_CAP = () => has("walls") ? 100 : 70;
  const NIGHT_DRAIN = () => has("walls") ? .12 : .16;
  const NIGHT_REPAIR = () => has("walls") ? 1 : .5, NIGHT_FIGHT = 1;
  let B = BUILDINGS[0];
  function applyBuilding(){ B = BUILDINGS[Math.min(camp.bIdx, BUILDINGS.length - 1)]; ROOMS.forEach((r, i) => { r.label = B.labels[i]; });
    EDGES[0].label = B.night ? "north fence" : B.key === "shop" ? "shop front" : "dock office door"; EDGES[2].label = B.night ? "shelter's back wall" : `${B.labels[CIV].toLowerCase()} back door`;
    EDGES[1].label = B.night ? "motor pool gate" : "loading dock"; }
  const bloaterRoomFor = day => B.bloaterRooms[day % 3];
  const screamerRoomFor = day => { const b = bloaterRoomFor(day); const rs = B.screamerRooms.filter(r => r !== b); return rs[day % rs.length]; };

  const ZT = {
    shambler:{hp:28,speed:[20,28],dmg:12,r:7},
    runner:{hp:14,speed:[46,56],dmg:8,r:6},     // fast and fragile: they punish noise, not aim
    armoured:{hp:110,speed:[10,12],dmg:16,r:11},
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
    return {v:2,day:START_DAY,ammo:START_AMMO,meds:4,parts:0,up:{},missions:0,report:"",bIdx:0,b:BUILDINGS.map(freshBuilding),recruits:[],rescuedTotal:0,ended:null,
      roster:Object.fromEntries(ROSTER.map(p => [p.id, {status:"fit", out:0, lastDay:-99}]))};
  }
  // slice 3: older saves get the new fields
  function upgradeSave(c){
    c.parts = c.parts || 0; c.up = c.up || {};
    while(c.b.length < BUILDINGS.length) c.b.push(freshBuilding(BUILDINGS[c.b.length]));
    return c;
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
    try { const raw = localStorage.getItem(SAVE_KEY); if(raw){ const c = migrate(JSON.parse(raw)); if(c && c.v === 2 && c.roster && c.b) return upgradeSave(c); } } catch(e) {}
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
  const nightWait = () => B.night ? Math.max(0, camp.nightIn || 0) : 0;
  const canDeploy = () => !camp.ended && !campaignOver() && (B.night ? !nightWait() : !joelOut()); // at home, Joel fights hurt or not
  // the night comes when it comes: on the last day there is no scavenging or resting, only the fight
  const dayFree = () => !camp.ended && !(B.night && !nightWait());
  function statusLabel(id){
    const r = rec(id);
    if(r.status === "dead") return "KIA";
    if(id === "joel") return r.status === "wounded" ? `OUT ${r.out}D` : r.status === "hurt" ? "HURT" : isTired(id) ? "TIRED" : "FIT";
    if(r.status === "wounded") return `WOUNDED ${r.out}D`;
    return isTired(id) ? "TIRED" : "FIT";
  }
  applyBuilding();

  const state = {screen:"story-screen", recon:false, route:"vehicle", stance:"controlled", selected:new Set(), speed:1, paused:false, carryAmmo:180, carryMeds:2, confirmWipe:false, trav:null};
  let m = null, crisisSeq = 0;

  // ---------- ui pass 2: a phone always plays in landscape ----------
  // iOS ignores orientation locks, so a phone held upright gets the whole app turned 90° in CSS (html.rot), and a phone held
  // sideways shows it unturned. Both use the landscape layout (html.land). The measured size follows the iOS toolbars; 100vh does not.
  const view = {land:false, rot:false, sw:innerWidth, sh:innerHeight, ready:false};
  function fitView(){
    // visualViewport × scale: the visible size at scale 1. innerWidth can grow when a page lays out wider than the screen.
    const vv = window.visualViewport, w = Math.round(vv ? vv.width * vv.scale : document.documentElement.clientWidth), h = Math.round(vv ? vv.height * vv.scale : innerHeight), land = Math.min(w, h) <= 500 && Math.max(w, h) <= 1000, rot = land && h > w;
    const R = document.documentElement, was = `${view.land}${view.rot}${view.sw}x${view.sh}`;
    Object.assign(view, {land, rot, sw:w, sh:h});
    R.classList.toggle("land", land); R.classList.toggle("rot", rot); R.classList.toggle("narrow", land && (rot ? h : w) < 760); // ui pass 3: short stance tags in a narrow rail
    R.style.setProperty("--app-w", `${rot ? h : w}px`); R.style.setProperty("--app-h", `${rot ? w : h}px`); R.style.setProperty("--scr-w", `${w}px`);
    if(view.ready && was !== `${land}${rot}${w}x${h}`){ draw(); if(m) renderCrisis(); }
  }
  function lockLandscape(){ try { const o = screen.orientation; if(o && o.lock) o.lock("landscape").catch(() => {}); } catch(e) {} }
  fitView(); lockLandscape();
  addEventListener("resize", fitView);
  addEventListener("orientationchange", () => { fitView(); setTimeout(fitView, 250); setTimeout(fitView, 700); }); // iOS reports the new size late
  if(window.visualViewport) visualViewport.addEventListener("resize", fitView);
  document.addEventListener("pointerdown", lockLandscape, {once:true});

  function show(id){ screens.forEach(s => s.classList.toggle("active", s.id === id)); state.screen = id; document.body.classList.toggle("in-mission", id === "combat-screen"); window.scrollTo(0, 0);
    $$(".screen, .ops-layout, .roster-panel, .doctrine-panel, .doctrine-body, .result-body, .brief-panel, .mission-panel").forEach(el => { el.scrollTop = 0; }); } // land mode scrolls inside panels, not the page
  function selectButtons(container, key, value){ $$(`button[data-${key}]`, container).forEach(b => b.classList.toggle("selected", b.dataset[key] === value)); }

  // ---------- ops map ----------
  const missionThreat = () => Math.max(6, cur().infected - (state.recon ? 3 : 0));
  const arrivalBarricade = () => B.night ? NIGHT_CAP() : Math.max(15, Math.round(cur().barricade - (state.recon && !has("radio") ? 10 : 0) - (state.route === "foot" ? 5 : 0)));
  // a short loadout hint: roughly 6 rounds per infected you expect, in steps of 30
  const recAmmo = () => clamp(Math.round(missionThreat() * 7.5 / 30) * 30, 150, 240);
  function threatText(){ const n = missionThreat(); return state.recon ? `${n} confirmed` : `${Math.round(n * .7)}–${Math.round(n * 1.3)}`; }
  const scavengers = () => team().filter(p => p.id !== "joel" && available(p.id)).sort((a, b) => isTired(a.id) - isTired(b.id) || a.dmg - b.dmg).slice(0, 2);

  function renderOps(){
    applyBuilding();
    const alive = team().filter(p => rec(p.id).status !== "dead").length;
    const ready = team().filter(p => available(p.id)).length;
    $("#day-state").textContent = `DAY ${camp.day}`;
    $("#roster-count").textContent = alive;
    $("#hub-line").innerHTML = `<b>${ready}</b> ready · <b>${camp.ammo}</b> rds · <b>${camp.meds}</b> meds · <b>${camp.parts}</b> parts`;
    const owned = UPGRADES.filter(u => has(u.id)).map(u => u.name).concat(Object.values(REWARDS).filter(r => has(r.id)).map(r => r.name));
    $("#hub-tags").textContent = owned.join(" · "); $("#hub-tags").hidden = !owned.length;
    BUILDINGS.forEach((b, i) => {
      const s = camp.b[i], done = i < camp.bIdx || (i === camp.bIdx && campaignOver()), active = i === camp.bIdx && !done, locked = i > camp.bIdx;
      $(`#obj-${i}`).classList.toggle("locked", locked);
      $(`#obj-${i} small`).textContent = locked ? (b.night ? "Clear Cold Storage first" : "No signal")
        : b.night ? (nightWait() ? `Horde in ${plural(nightWait(), "day")}` : "Tonight")
        : done ? `✓ ${s.rescued} saved${s.lost ? ` · ${s.lost} lost` : ""}` : [`${s.civilians} trapped`, s.rescued ? `${s.rescued} saved` : "", s.lost ? `${s.lost} lost` : ""].filter(Boolean).join(" · ");
      const node = $(`#node-${i}`);
      node.classList.toggle("mission-node", active); node.classList.toggle("resolved", done); node.classList.toggle("unknown-node", locked && !b.night);
      node.classList.toggle("selected", active);
      $("span", node).textContent = b.night ? (active ? "!" : "⌂") : locked ? "?" : done ? "✓" : "!";
      $("small", node).textContent = b.night ? (locked ? `AFTER ${plural(i - camp.bIdx, "MISSION").toUpperCase()}` : "HOME") : locked ? "NO SIGNAL" : done ? `${s.rescued} SAVED` : "MISSION";
      node.classList.toggle("locked-node", locked && !!b.night);
    });
    // ui pass 6: the lit route and its time token follow the open mission, so a cleared node never looks like the target
    const paths = $$(".routes path"), act = camp.bIdx;
    paths.forEach((p, i) => p.classList.toggle("route-dim", i !== act));
    const tok = $(".route-token"); tok.hidden = act > 1;
    if(act <= 1) Object.assign(tok.style, act ? {left:"34%", top:"79%"} : {left:"39%", top:"51%"});
    $(".chapter-progress span").style.width = `${Math.round(camp.bIdx / 3 * 100) || 6}%`;
    $("#brief-num").textContent = `MISSION 0${camp.bIdx + 1}`;
    $("#brief-title").textContent = B.mission; $("#brief-place").textContent = B.place; $("#brief-copy").textContent = B.brief;
    // tired troopers: say it where the decision is made (slice 3, TESTER note 4)
    const tired = team().filter(p => available(p.id) && isTired(p.id)).map(p => p.name);
    // ui pass 4: say why (out yesterday) and the fix (a day off), in one short line each
    const fitN = team().filter(p => available(p.id)).length, who = tired.length <= 2 ? tired.join(" & ") : tired.length === fitN ? `All ${fitN}` : `${tired.length}`;
    const tl = [tired.length ? `${who} tired · out yesterday · −15% hit · a day off clears` : "", B.night ? `Ammo ${camp.ammo} · night needs ~${NIGHT_AMMO}` : ""].filter(Boolean);
    $("#tired-line").innerHTML = tl.map(t => `<span>${t}</span>`).join(""); $("#tired-line").hidden = !tl.length;
    // ui pass 6: the report is about the day just gone; "Day 21:" under a "DAY 22" header read as a wrong count
    const rep = (camp.report || "").replace(/^Day (\d+):/, (all, n) => +n === camp.day - 1 ? "Yesterday:" : +n === camp.day ? "Today:" : all);
    $("#ops-report").textContent = rep; $("#ops-report").hidden = !camp.report;
    $("#brief-report").textContent = rep; $("#brief-report").hidden = !camp.report; // phone copy, at the top of the brief
    // ui pass 4: the night brief shows the shelter, the ways in and what Walls change; a building brief shows its reward tiers
    $("#threat-label").textContent = B.night ? "SHELTER" : "INFECTED"; $("#window-label").textContent = B.night ? "WAYS IN" : "BARRICADE";
    $("#threat-value").textContent = B.night ? `${NIGHT_CAP()}%` : threatText();
    $("#window-value").textContent = B.night ? (has("walls") ? "2" : "3") : `~${arrivalBarricade()}%`;
    const rwd = REWARDS[B.key], cs = cur().civStart || 0;
    $("#reward-cell small").textContent = B.night ? "WALLS" : "REWARD";
    $("#reward-value").innerHTML = B.night
      ? `<span class="${has("walls") ? "ok" : "no"}">${has("walls") ? "✓ Built" : "Not built"}</span><span>+30% shelter · −1 way in · drains ¼ slower</span>`
      : rwd ? [[Math.ceil(cs / 2), `+3 parts · ${rwd.name}`], [1, "+1 part"]].map(([n, t]) => `<span${(cur().rescued || 0) >= n ? ` class="met"` : ""}><b>${n}+</b> saved · ${t}</span>`).join("") : "";
    $("#recon-btn").innerHTML = state.recon ? "<span>✓</span> Recon done" : `<span>◉</span> Recon <small>${has("radio") ? "Free" : "Barricade −10"} · map · −3 infected</small>`;
    const over = campaignOver();
    $("#recon-btn").disabled = !canDeploy();
    $("#recon-btn").hidden = !!B.night; $("#route-block").hidden = !!B.night;
    $(".intel-grid").hidden = over;
    selectButtons($("#route-choice"), "route", state.route);
    $("#depart-time").textContent = state.route === "vehicle" ? "07:18" : "07:35";
    $("#prepare-btn").disabled = !canDeploy();
    $("#prepare-btn").textContent = over ? "Building resolved" : B.night ? (nightWait() ? `Horde in ${plural(nightWait(), "day")}` : "Man the walls")
      : joelOut() ? `Joel out · ${rec("joel").out}d` : "Prepare team";
    const sc = scavengers(), free = dayFree();
    $("#scavenge-btn").disabled = !free || !sc.length;
    const so = scavOdds();
    const idle = B.night || over ? "" : cur().barricade - IDLE_DECAY < BAR_FLOOR ? "1 civilian dies" : `barricade −${IDLE_DECAY}`; // slice 3.1: any day away costs the same, so both buttons say it
    $("#scav-who").textContent = sc.length ? `${sc.map(p => p.name).join(" + ")} · +${so.lo}–${so.hi} rds` : "No one fit";
    $("#scav-odds").innerHTML = sc.length ? `${so.big ? `<b class="ok">${so.big}%</b> big ` : ""}<b class="ok">${so.clean}%</b> ok <b class="hu">${so.hurt}%</b> hurt <b class="ki">${so.killed}%</b> KIA` : "";
    $("#rest-btn").disabled = !free;
    const st = free ? street() : STREETS[0];
    $("#rest-btn small").textContent = st.rest > 1 ? "Heal ×2 · clears tired" : "Heal · clears tired";
    $("#street-line").textContent = st.line; $("#street-line").hidden = !st.line || !free;
    // ui pass 4: the cost of a day away gets its own line on both buttons, red when it is a life
    $$(".day-cost").forEach(e => { e.textContent = idle.replace(/^b/, "B"); e.hidden = !idle; e.classList.toggle("life", idle === "1 civilian dies"); });
    $("#parts-count").textContent = plural(camp.parts, "PART").toUpperCase(); $(".day-actions").hidden = B.night && !nightWait();
    $("#build-choice").innerHTML = UPGRADES.map(u => `<button data-build="${u.id}" class="${has(u.id) ? "built" : ""}" ${has(u.id) || !free || camp.parts < u.cost || camp.builtDay === camp.day ? "disabled" : ""}><strong>${has(u.id) ? "✓ " : ""}${u.name}${has(u.id) ? "" : ` <i>${u.cost}</i>`}</strong><small>${u.sub}</small></button>`).join("");
    $("#new-campaign").textContent = state.confirmWipe ? "Confirm: wipe this campaign" : "New campaign";
    $("#new-campaign").classList.toggle("danger-outline", state.confirmWipe);
  }

  // a day with no mission: wounds heal, the building gets worse
  // every day, mission or not: wounds heal (twice as fast with the infirmary), the bench reloads brass
  function healDay(){
    team().forEach(p => { const x = rec(p.id); if(x.status === "wounded"){ x.out -= has("infirmary") ? 2 : 1; if(x.out <= 0){ x.status = "fit"; x.out = 0; } } else if(x.status === "hurt") x.status = "fit"; });
    if(has("bench")) camp.ammo += 20;
  }
  function quietDay(note){
    healDay();
    let night = "";
    const s = cur();
    if(B.night) camp.nightIn = Math.max(0, (camp.nightIn || 0) - 1);
    else if(s.civilians > 0){
      // slice 3.1: a day away costs IDLE_DECAY; it never goes under BAR_FLOOR. At the floor, the day costs a civilian instead
      // (the survivors patch it back to BAR_RESET), so waiting has a price but never leaves a 1% barricade for the next mission.
      s.infected = Math.min(36, s.infected + 4);
      if(s.barricade - IDLE_DECAY < BAR_FLOOR){ s.civilians--; s.lost++; s.barricade = BAR_RESET; night = ` Barricade failed: 1 civilian lost.`; }
      else s.barricade -= IDLE_DECAY;
      if(s.civilians <= 0) night += ` No one left alive in the ${B.title.toLowerCase()}.`;
    }
    if(B.night && camp.nightIn <= 0) night += " The horde comes tonight.";
    camp.report = `Day ${camp.day}: ${note}${night}`;
    camp.day++; checkBuilding(); checkEnded(); saveCampaign();
  }
  // after any day: a resolved building pays out (Expand) and opens the next one; the night is the last
  function checkBuilding(){
    if(B.night || cur().civilians > 0 || camp.ended) return;
    // slice 3.1: the payout follows the people. Half or more out: +3 parts and the building's bonus. Fewer: +1 part. None: nothing.
    const rw = REWARDS[B.key], pay = payout(cur());
    camp.parts += pay.parts; if(pay.bonus) camp.up[rw.id] = true;
    camp.report += pay.bonus ? ` ${B.title} is ours: +${pay.parts} parts, ${rw.name} (${rw.sub}).` : pay.parts ? ` ${B.title}: few got out. +${pay.parts} part.` : ` ${B.title} is lost. Nothing to show for it.`;
    camp.bIdx++; applyBuilding(); state.recon = false;
    if(B.night){
      // everyone you brought home is in the shelter tonight (the volunteers fight instead); Tess and the cook at least
      const n = Math.max(2, (camp.rescuedTotal || 0) - (camp.recruitsEarned || 0));
      Object.assign(cur(), {civilians:n, civStart:n, rescued:0, lost:0, barricade:100});
      camp.nightIn = NIGHT_PREP;
      camp.report += ` A horde is coming: ${NIGHT_PREP} days.`;
    } else camp.report += ` New signal: ${B.mission}.`;
  }
  // a lost squad is not the end the first time: drifters find the base (slice 3, TESTER note 5)
  const DRIFTERS = [{name:"Tomas",color:"#b0a27a"},{name:"Ines",color:"#8ac0c9"}];
  function checkEnded(){
    if(!camp.ended && team().every(p => p.id === "joel" || rec(p.id).status === "dead")){
      if(!camp.drifted){
        camp.drifted = true;
        DRIFTERS.forEach((d, i) => { const id = "d" + i; camp.recruits.push({id, name:d.name, role:"Drifter", trait:"Rookie · loud", hp:85, color:d.color, dmg:20, rof:.75, rookie:true}); camp.roster[id] = {status:"fit", out:0, lastDay:-99}; });
        // slice 3.1: they bring what they carried, so a lost squad has a real way back
        camp.ammo += DRIFT_AMMO; camp.meds += 1; camp.scavHeat = 0;
        camp.report += ` Two drifters walked in: Tomas and Ines, with ${DRIFT_AMMO} rds and a med.`;
      } else camp.ended = "wiped";
    }
    if(!camp.ended && scars() >= MAX_SCARS) camp.ended = "joel";
  }
  // ---------- scavenge: a gamble, and the streets near base run dry if you lean on it ----------
  // slice 4.1: four outcomes (big find, clean, hurt, KIA), and the day's street report moves the odds and the haul,
  // so Scavenge vs Rest is a different call on a rain day, a herd day or a smoke day
  function scavOdds(){
    const h = Math.min(3, camp.scavHeat || 0), st = street();
    const safe = has("safehouse") ? .5 : 1, r = (st.risk || 1) * safe;
    const killed = Math.round((6 + h * 7) * r), hurt = Math.round((24 + h * 8) * r);
    const big = Math.min(100 - killed - hurt, Math.round(Math.max(0, 18 - h * 6) * (st.big || 1))), clean = 100 - killed - hurt - big;
    const k = st.haul || 1, step10 = v => Math.round(v * k / 10) * 10;
    return {big, clean, hurt, killed, lo:step10(Math.max(30, 60 - h * 20)), hi:step10(Math.max(50, 100 - h * 20))};
  }
  // slice 4.1: one street report a day, fixed for that day (a reload doesn't reroll it)
  const STREETS = [
    {id:"clear", w:35, line:""},
    {id:"rain", w:20, line:"Rain · scavenge safer, smaller haul", risk:.5, haul:.75},
    {id:"smoke", w:15, line:"Smoke to the east · bigger haul, riskier", risk:1.4, haul:1.4, big:2},
    {id:"herd", w:15, line:"Herd passing · scavenge risk ×2", risk:2},
    {id:"still", w:15, line:"Still day · rest heals double", rest:2}
  ];
  function street(){
    if(!camp.street || camp.street.day !== camp.day){
      let roll = Math.random() * 100, s = STREETS[0];
      for(const x of STREETS){ if(roll < x.w){ s = x; break; } roll -= x.w; }
      camp.street = {day:camp.day, id:s.id}; saveCampaign();
    }
    return STREETS.find(x => x.id === camp.street.id) || STREETS[0];
  }
  const coolStreets = () => { camp.scavHeat = Math.max(0, (camp.scavHeat || 0) - 1); };
  $("#scavenge-btn").onclick = () => {
    const sc = scavengers(); if(!sc.length || !dayFree()) return;
    const o = scavOdds(), roll = Math.random() * 100;
    let rounds = o.lo + Math.floor(Math.random() * ((o.hi - o.lo) / 10 + 1)) * 10, med = Math.random() < .5, note;
    sc.forEach(p => { rec(p.id).lastDay = camp.day; });
    const names = sc.map(p => p.name).join(" and "), victim = sc[Math.floor(Math.random() * sc.length)];
    if(roll < o.killed){
      rounds = Math.round(rounds / 2 / 10) * 10; med = false;
      const x = rec(victim.id); x.status = "dead"; x.out = 0; x.diedDay = camp.day;
      note = `Scavenge ambushed. ${victim.name} did not come back.${sc.length > 1 ? ` +${rounds} rds.` : ""}`;
    } else if(roll < o.killed + o.hurt){
      rounds = Math.round(rounds * .6 / 10) * 10; med = false;
      const x = rec(victim.id); x.status = "wounded"; x.out = 3; // quietDay below heals one day of it at once: 2 days out
      note = `Scavenge hit trouble: +${rounds} rds. ${victim.name} hurt, out 2 days.`;
    } else if(roll < o.killed + o.hurt + o.big){
      // slice 4.1: the upside. A cache nobody has found: double haul, a part and a med, guaranteed
      rounds = Math.round(rounds * 2 / 10) * 10; med = true; camp.parts++;
      note = `Big find: +${rounds} rds, +1 part, +1 med.`;
    } else { camp.parts++; note = `Clean scavenge: +${rounds} rds, +1 part${med ? ", +1 med" : ""}.`; }
    if(rec(victim.id).status === "dead") rounds = sc.length > 1 ? rounds : 0;
    camp.ammo += rounds; if(med) camp.meds++;
    camp.scavHeat = (camp.scavHeat || 0) + 1;
    quietDay(note + (camp.scavHeat > 1 ? " Streets picked over." : ""));
    state.recon = false; afterDay();
  };
  // a rest day (slice 3.1: building is separate now, one a day, and does not spend the day)
  function restDay(build){
    if(!dayFree()) return;
    coolStreets();
    let note = "Rested.";
    if(build){ camp.parts -= build.cost; camp.up[build.id] = true; note = `Rested and built the ${build.name.toLowerCase()}.`; }
    if(has("coldroom")){ camp.meds++; note += " +1 med (cold room)."; }
    // slice 4.1: a still day heals twice (the bench doesn't load twice)
    if(street().rest > 1 && team().some(p => rec(p.id).status === "wounded")){ const a = camp.ammo; healDay(); camp.ammo = a; note += " A still day: wounds heal double."; }
    quietDay(note); state.recon = false; afterDay();
  }
  $("#rest-btn").onclick = () => restDay(null);
  $("#build-choice").onclick = e => {
    const b = e.target.closest("button[data-build]"); if(!b || b.disabled) return;
    const u = UPGRADES.find(x => x.id === b.dataset.build); if(!u || has(u.id) || camp.parts < u.cost || camp.builtDay === camp.day) return;
    // slice 3.1: a build no longer spends the day. One build a day, on top of whatever the day is for; parts are the limit
    camp.parts -= u.cost; camp.up[u.id] = true; camp.builtDay = camp.day;
    camp.report = `Day ${camp.day}: built the ${u.name.toLowerCase()}.`; saveCampaign(); renderOps();
  };
  function afterDay(){ state.confirmWipe = false; if(camp.ended) showEnd(); else renderOps(); }

  $("#open-ops").onclick = () => { if(camp.ended){ showEnd(); return; } renderOps(); show("ops-screen"); };
  $("#prepare-btn").onclick = () => { if(!canDeploy()) return; preparePrep(); show("prep-screen"); };
  $("#back-map").onclick = () => { renderOps(); show("ops-screen"); };
  // leaving a mission: drop the sim and wipe every trace of it from the page, so nothing stale shows later
  function clearMission(){
    m = null; clearInterval(timer); timer = null; setPaused(false);
    DOORS.forEach(d => { d.sealed = 0; d.cd = 0; });
    $("#log-stream").innerHTML = ""; $("#log-ticker").textContent = ""; $("#log-ticker").className = "log-ticker"; $("#squad-status").innerHTML = ""; $("#objective-text").textContent = "";
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
    // slice 3: the chapter ends on the night. Dawn, the base falls, or Joel gives it up; or earlier, a lost squad or a broken Joel
    const kind = camp.ended, good = kind === "chapter", night = camp.b[2] || {rescued:0, lost:0, civStart:0};
    $("#end-card").className = `result-card ending-${good || kind === "fled" ? "chapter" : "wiped"}`; // tone only
    const all = camp.b.slice(0, 2).reduce((a, s) => ({r:a.r + s.rescued, l:a.l + s.lost}), {r:0, l:0});
    const dead = team().filter(p => rec(p.id).status === "dead"), days = camp.day - START_DAY;
    $("#end-eyebrow").textContent = good || kind === "fell" || kind === "fled" ? "CHAPTER 1 · CLOSED" : "CAMPAIGN OVER";
    $("#end-title").textContent = {chapter:"Dawn", fell:"The base fell", fled:"Into the rain", joel:"Joel can't lead any more"}[kind] || "The squad is gone";
    const cost = dead.length ? ` It cost ${dead.map(p => p.name).join(", ")}.` : " The team all lived.";
    $("#end-summary").textContent = good ? `The base held.${cost}`
      : kind === "fell" ? `The shelter went before dawn.${cost}`
      : kind === "fled" ? `Joel gave up the base and drove south.${cost}`
      : kind === "joel" ? "The third time, he did not get up."
      : "No one is left to send.";
    const sawDawn = camp.bIdx >= 2 && kind !== "wiped" && kind !== "joel";
    // ui pass 6: "SAVED 7" (brought home from the buildings) sat next to the night's "4/6 safe"; name each count for what it is
    $("#end-grid").innerHTML = `<div><span>DAYS</span><strong>${days}</strong></div><div><span>SAVED</span><strong>${all.r}</strong></div><div><span>${sawDawn ? (good ? "SAW DAWN" : "GOT OUT") : "CIV. LOST"}</span><strong>${sawDawn ? `${night.rescued}<small>/${night.civStart}</small>` : all.l}</strong></div><div><span>TEAM LOST</span><strong>${dead.length}</strong></div>`;
    $("#end-buildings").innerHTML = BUILDINGS.map((b, i) => {
      const s = camp.b[i], reached = i <= camp.bIdx, trips = s.trips ? ` · ${plural(s.trips, "trip")}` : "";
      const txt = !reached ? "—" : b.night ? (camp.missions && kind && kind !== "wiped" && kind !== "joel" ? `${s.rescued}/${s.civStart} ${good ? "saw dawn" : "got out"}` : "—")
        : `${s.rescued} saved · ${s.lost} lost${s.civilians > 0 ? ` · ${s.civilians} inside` : ""}${trips}`;
      return `<div class="casualty-row ${reached && (s.lost || s.civilians > 0) ? "is-hurt" : ""}"><strong>${b.title}</strong><span>${txt}</span></div>`;
    }).join("");
    $("#end-roster").innerHTML = team().map(p => {
      const x = rec(p.id), isDead = x.status === "dead";
      const st = p.id === "joel" ? (scars() ? plural(scars(), "scar") : "Unhurt")
        : isDead ? `KIA${x.diedDay ? ` · day ${x.diedDay}` : ""}` : x.status === "wounded" ? "Wounded" : "Alive";
      return `<div class="casualty-row ${isDead ? "is-dead" : x.status === "wounded" || (p.id === "joel" && scars()) ? "is-hurt" : ""}"><strong>${p.name}</strong><span>${st}</span></div>`;
    }).join("");
    $("#end-base").textContent = `${plural(camp.missions, "deployment")} · ${camp.ammo} rds · ${plural(camp.meds, "med")} left`;
    show("end-screen");
  }

  // ---------- deployment ----------
  function preparePrep(){
    state.confirmWipe = false;
    state.selected = new Set(team().filter(p => available(p.id) || (B.night && p.id === "joel")).map(p => p.id));
    // at home the whole stock is on hand
    state.carryAmmo = B.night ? camp.ammo : Math.min(camp.ammo, recAmmo()); state.carryMeds = B.night ? camp.meds : Math.min(camp.meds, 2);
    selectButtons($("#doctrine-choice"), "doctrine", state.stance);
    const d = $("#deploy-btn"); d.disabled = !canDeploy();
    d.textContent = camp.ended ? "Campaign over" : campaignOver() ? "Building resolved" : B.night ? (nightWait() ? `Horde in ${plural(nightWait(), "day")}` : "Hold until dawn")
      : joelOut() ? `Joel out · ${rec("joel").out}d` : "Deploy team";
    renderRoster(); renderLoadout(); updateForecast();
  }
  const traitOf = p => p.id !== "joel" ? p.trait : scars()
    ? `Scars ${scars()}/${MAX_SCARS} · −${scars() * 20} HP · cmd ${regenSeconds()}s`
    : "Can't die · scars";
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
    if(B.night) return; // at home, everything is on hand
    if(b.dataset.load === "ammo") state.carryAmmo = clamp(state.carryAmmo + dir * 30, 0, camp.ammo);
    else state.carryMeds = clamp(state.carryMeds + dir, 0, Math.min(3, camp.meds));
    renderLoadout();
  };
  function renderLoadout(){
    $("#load-ammo").textContent = state.carryAmmo; $("#load-meds").textContent = state.carryMeds;
    $("#load-ammo-base").textContent = B.night ? "all" : `rec ${recAmmo()} · base ${camp.ammo - state.carryAmmo}`;
    $("#load-meds-base").textContent = B.night ? "all" : `rec 2 · base ${camp.meds - state.carryMeds}`;
  }
  $("#doctrine-choice").onclick = e => { const b = e.target.closest("button[data-doctrine]"); if(!b) return; state.stance = b.dataset.doctrine; selectButtons($("#doctrine-choice"), "doctrine", state.stance); };
  function updateForecast(){
    const lbl = (id, t) => { $(id).previousElementSibling.textContent = t; };
    lbl("#f-threat", B.night ? "RAIDS" : "INFECTED"); lbl("#f-noise", B.night ? "WAYS IN" : "NOISE"); lbl("#f-barricade", B.night ? "SHELTER" : "BARRICADE");
    if(B.night){
      $("#f-threat").textContent = `7 · dawn at ${fmt(DAWN)}`; $("#f-bloater").textContent = "Bloaters: raids 3, 6";
      $("#f-barricade").textContent = `${arrivalBarricade()}%`; $("#f-noise").textContent = has("walls") ? "2" : "3 · 1 via shelter";
      $("#f-squad").textContent = `${state.selected.size} · ${cur().civilians} sheltered`; return;
    }
    $("#f-threat").textContent = threatText();
    $("#f-bloater").textContent = state.recon ? `Bloater ${roomName(bloaterRoomFor(camp.day))} · screamer ${roomName(screamerRoomFor(camp.day))} · crawler ${crawlerRoomsFor(camp.day, B.crawlers).map(roomName).join(", ")}${B.pack ? ` · pack ${roomName(PACK_ROOM)}` : ""}` : `? · ${plural(B.crawlers, "crawler")} hidden`;
    $("#f-barricade").textContent = `${arrivalBarricade()}%`;
    $("#f-noise").textContent = `${state.route === "vehicle" ? VEHICLE_NOISE : 0} / 30`;
    const extra = Math.max(0, state.selected.size - 4), tiredN = [...state.selected].filter(isTired).length;
    $("#f-squad").textContent = `${state.selected.size}${tiredN ? ` · ${tiredN} tired` : ""}${extra ? ` · +${extra * 2} infected` : ""}`;
    $("#f-squad").classList.toggle("warn", tiredRisk());
    state.tiredAsk = false; deployLabel();
  }
  // slice 4.1 (TESTER: Mission 1 is a cliff): half or more of the team tired asks once before it goes
  const tiredCount = () => B.night ? 0 : [...state.selected].filter(isTired).length;
  const tiredRisk = () => { const n = tiredCount(); return n >= 2 && n * 2 >= state.selected.size; };
  function deployLabel(){
    const d = $("#deploy-btn"); d.classList.toggle("tired-warn", !!state.tiredAsk);
    if(!canDeploy() || B.night) return;
    d.textContent = state.tiredAsk ? `${tiredCount()}/${state.selected.size} tired · −15% hit · deploy?` : "Deploy team";
  }
  $("#deploy-btn").onclick = () => {
    if(!canDeploy()) return;
    if(tiredRisk() && !state.tiredAsk){ state.tiredAsk = true; deployLabel(); return; }
    state.tiredAsk = false; state.trav = null;
    if(B.night){ launch(); return; }
    showTravel();
  };
  function launch(){ initMission(); show("combat-screen"); startLoop(); }

  // ---------- slice 3: Traverse. One event on the road, one real choice: time, noise, ammo or risk ----------
  // fx: bar (barricade on arrival), noise, ammo (carried), med, parts, hurt (chance one trooper starts at 60%), saved (+1 civilian home), gamble
  const TRAVEL = [
    {id:"wreck", route:"vehicle", title:"Bus across the road", copy:"Something moves behind the glass.",
      options:[{label:"Ram it", sub:"+10 noise", fx:{noise:10}}, {label:"Go round", sub:"Barricade −10", fx:{bar:-10}}, {label:"Strip it", sub:"+1 part · +15 noise", fx:{parts:1, noise:15}}]},
    {id:"pharmacy", title:"Pharmacy, shutter half up", copy:"Dark inside.",
      options:[{label:"Check it", sub:"+1 med · 35% bite", fx:{med:1, hurt:.35}}, {label:"Keep moving", sub:"—", fx:{}}]},
    {id:"herd", title:"Herd in the street", copy:"Forty of them, drifting your way.",
      options:[{label:"Wait it out", sub:"Barricade −15", fx:{bar:-15}}, {label:"Shoot through", sub:"−30 rds · +10 noise", fx:{ammo:-30, noise:10}}, {label:"Slip past", sub:"40%: +20 noise", fx:{gamble:.4, noise:20}}]},
    {id:"roof", title:"A man on a roof", copy:"Waving. Shouting.",
      options:[{label:"Get him down", sub:"Barricade −10 · +1 saved", fx:{bar:-10, saved:1}}, {label:"Leave him", sub:"—", fx:{}}]},
    {id:"cruiser", title:"Police car, doors open", copy:"The trunk is still shut.",
      options:[{label:"Pry it open", sub:"+40 rds · +10 noise", fx:{ammo:40, noise:10}}, {label:"Leave it", sub:"—", fx:{}}]},
    {id:"wire", route:"foot", title:"Wire across the alley", copy:"Cans tied to it. A trap, or an alarm.",
      options:[{label:"Cut it slowly", sub:"Barricade −5", fx:{bar:-5}}, {label:"Climb the fence", sub:"30% cut", fx:{hurt:.3}}, {label:"Take the cans", sub:"+1 part · +10 noise", fx:{parts:1, noise:10}}]}
  ];
  function pickTravel(){
    const seen = camp.travelSeen || [], fits = TRAVEL.filter(t => !t.route || t.route === state.route);
    const fresh = fits.filter(t => !seen.includes(t.id)), pool = fresh.length ? fresh : fits.filter(t => t.id !== seen.at(-1));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function showTravel(){
    const t = pickTravel(); state.travEvent = t;
    $("#travel-eyebrow").textContent = `ON THE ROAD · ${state.route === "vehicle" ? "VEHICLE" : "ON FOOT"}`;
    $("#travel-title").textContent = t.title; $("#travel-copy").textContent = t.copy;
    $("#travel-actions").innerHTML = t.options.map((o, i) => `<button data-trav="${i}"><strong>${o.label}</strong><small>${o.sub}</small></button>`).join("");
    show("travel-screen");
  }
  $("#travel-actions").onclick = e => {
    const b = e.target.closest("button[data-trav]"), t = state.travEvent; if(!b || !t) return;
    const o = t.options[+b.dataset.trav], fx = {...o.fx};
    if(fx.gamble){ if(Math.random() >= fx.gamble) fx.noise = 0; fx.turned = fx.noise > 0; }
    if(fx.hurt){ fx.hurt = Math.random() < fx.hurt; }
    camp.travelSeen = (camp.travelSeen || []).filter(id => id !== t.id).concat(t.id).slice(-4); state.trav = {...fx, label:o.label, title:t.title};
    launch();
  };

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
  const VEHICLE_NOISE = 15;
  function initMission(){
    DOORS.forEach(d => { d.sealed = 0; d.cd = 0; });
    applyBuilding();
    const N = !!B.night, tv = state.trav || {};
    const picks = team().filter(p => state.selected.has(p.id) && (available(p.id) || (N && p.id === "joel")));
    const start = N ? 1 : ENTRY; // at night the team starts in the courtyard, next to the shelter
    // slice 3: every mission starts at 1x; the speed never carries over
    state.speed = 1; $$("[data-speed]").forEach(x => x.classList.toggle("selected", x.dataset.speed === "1"));
    m = {running:true, elapsed:0, kills:0, cp:2, cpRegen:0, noise:Math.max(0, (!N && state.route === "vehicle" ? VEHICLE_NOISE : 0) + (tv.noise || 0)), wavesFired:0,
      ammo:Math.max(0, state.carryAmmo + (tv.ammo || 0)), ammoStart:0, meds:state.carryMeds + (tv.med || 0), medsStart:0, loot:false,
      stance:state.stance, faw:true, squadRoom:start, prevRoom:start, holdT:0, push:false, objective:N ? "hold" : "reach", clearT:0, holdNoted:false, pulled:false,
      barricade:Math.max(B.night ? 1 : 15, arrivalBarricade() + (tv.bar || 0)), seen:ROOMS.map((_, i) => N || state.recon || i === ENTRY), recon:state.recon, route:state.route,
      units:[], zombies:[], civs:[], shots:[], particles:[], blasts:[], crises:[], arm:null, focus:null, extra:Math.max(0, picks.length - 4),
      bloaterWarned:new Set(), escorts:new Set(), crisisSig:"", hudSig:"", civStart:cur().civilians, report:null, night:N, nightWave:0, nextWave:8};
    // the road's changes come out of (or into) base stock now; what is carried is what the mission starts with
    m.ammoStart = m.ammo; m.medsStart = m.meds; camp.meds += tv.med || 0; camp.ammo = Math.max(0, camp.ammo + (tv.ammo || 0)); camp.parts += tv.parts || 0;
    if(tv.saved){ cur().rescued++; camp.rescuedTotal = (camp.rescuedTotal || 0) + 1; }
    m.units = picks.map((p, i) => {
      const hurt = p.id === "joel" && rec("joel").status !== "fit";
      const max = p.id === "joel" ? p.hp - scars() * 20 : p.hp;
      const pos = N ? slot(start, i) : {x:62 + (i % 2) * 26, y:430 + Math.floor(i / 2) * 28};
      return {...p, kind:"unit", x:pos.x, y:pos.y, room:start, maxHp:max, hp:hurt ? Math.round(max * .6) : max,
        status:"ACTIVE", cool:Math.random() * .5, bleed:0, carry:0, lastHit:-99, tired:isTired(p.id)};
    });
    let bitten = null;
    if(tv.hurt){ const pool = m.units.filter(u => u.id !== "joel"); bitten = pool[Math.floor(Math.random() * pool.length)]; if(bitten) bitten.hp = Math.round(bitten.maxHp * .6); }
    let bRoom = -1, sRoom = -1, cRooms = [];
    if(!N){
      const n = missionThreat() + m.extra * 2; bRoom = bloaterRoomFor(camp.day); sRoom = screamerRoomFor(camp.day);
      const bp = zombiePoint(bRoom); addZombie("bloater", bRoom, bp.x, bp.y, false);
      const sp = zombiePoint(sRoom); addZombie("screamer", sRoom, sp.x, sp.y, false);
      const weights = [3, 3, 4, .5, 3, 3], total = weights.reduce((a, b) => a + b, 0);
      for(let i = 2; i < n; i++){
        let room;
        if(i <= 4) room = CIV; // the civilians' room always has company
        else { let roll = Math.random() * total; room = 0; while(roll > weights[room]){ roll -= weights[room]; room++; } }
        const type = i % B.armouredEvery === 0 ? "armoured" : i > n - 1 - B.runnersStart ? "runner" : "shambler";
        // slice 3.1: at most one armoured starts in the civilians' room; three there made the room a wipe whatever you did
        if(type === "armoured" && room === CIV && m.zombies.some(z => z.type === "armoured" && z.room === CIV)) room = [1, 4, 5, 0][i % 4];
        const p = zombiePoint(room);
        addZombie(type, room, p.x, p.y, false);
      }
      cRooms = crawlerRoomsFor(camp.day, B.crawlers);
      cRooms.forEach((r, i) => { const R = ROOMS[r]; const z = addZombie("crawler", r, R.cx + (Math.random() - .5) * 60 + i * 10, R.cy + (Math.random() - .5) * 50, false); z.lurk = true; z.spotted = state.recon; z.spot = 0; });
    }
    m.regenT = regenSeconds();
    for(let i = 0; i < cur().civilians; i++) m.civs.push({kind:"civ", room:CIV, x:975 + (i % 2) * 30, y:76 + Math.floor(i / 2) * 24, hp:30, status:"trapped"});
    $("#combat-title").textContent = B.title; $("#combat-eyebrow").textContent = N ? `THE LONG NIGHT · DAY ${camp.day}` : `MISSION 0${camp.bIdx + 1} · DAY ${camp.day}`;
    $("#log-stream").innerHTML = "";
    if(N){
      addLog(`Night. ${plural(m.civs.length, "survivor")} in the shelter. Hold until dawn.`);
      addLog(has("walls") ? "They come by the north yard and the motor pool." : "They come by the yard, the motor pool and the shelter's back wall.", "critical");
    } else {
      addLog(`Day ${camp.day}. In through the service door.`);
      if(state.trav) addLog(`Road: ${state.trav.label.toLowerCase()}.${bitten ? ` ${bitten.name} bitten.` : ""}${state.trav.turned ? " The herd turned." : ""}${tv.saved ? " +1 saved." : ""}`, bitten || state.trav.turned ? "critical" : "normal");
      addLog(state.recon ? `Recon: bloater in the ${roomName(bRoom)}, screamer in the ${roomName(sRoom)}, crawler in the ${[...new Set(cRooms)].map(roomName).join(" and ")}.`
        : "No recon. Rooms are blind until you're next to them.");
      if(B.pack && state.recon) addLog(`Recon: a pack behind the ${roomName(PACK_ROOM)} doors. Keep a seal for the way out.`, "critical");
      addLog(m.noise > 0 ? `Noise ${Math.round(m.noise)}.` : "Came in quiet.", m.noise > 0 ? "critical" : "normal");
      addLog(`${B.labels[CIV][0] + B.labels[CIV].slice(1).toLowerCase()} barricade ${Math.round(m.barricade)}%. Noise pulls them off it.`);
    }
    if(scars()) addLog(`Joel: ${plural(scars(), "scar")}, command every ${m.regenT}s.`);
    setPaused(false);
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
    const guard = m.objective === "reach" || m.objective === "hold";
    if(guard && m.barricade > 0){
      // at night anything inside the shelter room hits the wall, fighting or not: meet them before they get in
      const n = m.zombies.reduce((a, z) => a + (z.alive && z.room === CIV && !hiddenZ(z) ? (!z.alert ? 1 : m.night ? NIGHT_FIGHT : 0) : 0), 0);
      m.barricade = Math.max(0, m.barricade - n * (m.night ? NIGHT_DRAIN() : DAY_DRAIN) * step);
      if(m.barricade <= 0) barricadeBroke();
    } else if(guard && roomHasZombies(CIV)){
      // barricade down: one trapped civilian lost every 10s while infected hold the room
      m.civClock = (m.civClock || 0) + step;
      if(m.civClock >= 10){ m.civClock = 0; const c = m.civs.find(c => c.status === "trapped"); if(c) civDies(c, m.night ? "shelter breached" : "barricade down"); }
    }
    // slice 3.1: at night the people inside shore the shelter up whenever no infected are in its room, breached or not
    if(m.night && m.objective === "hold" && !m.zombies.some(z => z.alive && z.room === CIV) && m.barricade < NIGHT_CAP()){
      const was = m.barricade; m.barricade = Math.min(NIGHT_CAP(), m.barricade + NIGHT_REPAIR() * step);
      if(was <= 0 && m.barricade > 0){ m.civClock = 0; addLog("The shelter is shut again.", "kill"); }
    }
    // the trade-off: loud enough and the infected at the barricade turn toward the gunfire
    if(m.objective === "reach" && m.noise >= 45 && !m.pulled && m.zombies.some(z => z.alive && !z.alert && z.room === CIV)){
      m.pulled = true; wakeRoom(CIV); addLog(`Noise 45: the infected in the ${roomName(CIV)} turn from the barricade toward the gunfire.`, "kill");
    }
    // slice 3.1: next door to the civilians, the team is heard. The room empties toward them and the team holds the door 5s,
    // so the fight is at the choke and not inside a full room (Cold Storage wiped squads on that step)
    if(m.objective === "reach" && !m.pulled && m.squadRoom !== CIV && ADJ[CIV].some(a => a.r === m.squadRoom) && arrived() && m.zombies.some(z => z.alive && !z.alert && z.room === CIV)){
      m.pulled = true; wakeRoom(CIV); m.holdT = Math.max(m.holdT, 5);
      addLog(`They heard you next door. The ${roomName(CIV)} empties toward the ${roomName(m.squadRoom)}: hold the door.`, "kill");
    }
    m.noise = Math.max(0, m.noise - B.noiseDecay * step + ((m.stance === "aggressive" || m.push) && !arrived() ? .5 * step : 0));
    checkWaves(); if(m.night) nightWaves();
    if(m.objective === "gather" && (m.gatherT -= step) <= 0) startExtract();
    // slice 3: a column with civilians is slow and seen. Every 18s on the way out, a few more find it, loud or not
    if(m.objective === "extract"){ m.trickle = (m.trickle || 0) + step; if(m.trickle >= 18){ m.trickle = 0; spawnWave(2 + B.waveRunners, null, {trickle:true}); } }
    const joel = m.units.find(u => u.id === "joel");
    // slice 3: a carried Joel still talks on the radio, at half pace; a Joel on the floor gives nothing
    const talk = joel && (joel.status === "ACTIVE" ? (m.elapsed - joel.lastHit > 3 ? 1 : 0) : joel.status === "INJURED" ? .5 : 0);
    if(m.cp >= 3) m.cpRegen = 0;
    else if(talk){ m.cpRegen += step * talk; if(m.cpRegen >= m.regenT){ m.cpRegen = 0; m.cp++; addLog("Joel has the picture again. +1 command."); } }
    autoAdvance(step); checkObjective();
    m.shots.forEach(s => s.t -= step); m.shots = m.shots.filter(s => s.t > 0);
    m.particles.forEach(p => { p.x += p.vx * step; p.y += p.vy * step; p.t -= step; }); m.particles = m.particles.filter(p => p.t > 0);
    m.blasts.forEach(b => b.t -= step); m.blasts = m.blasts.filter(b => b.t > 0);
    checkEnd();
  }

  function assignEscorts(){
    const n = m.civs.filter(c => c.status === "following").length;
    const pool = m.units.filter(u => u.status === "ACTIVE" && !(u.carry > 0)).sort((a, b) => (a.id === "joel") - (b.id === "joel") || a.dmg - b.dmg);
    m.escorts = new Set(pool.slice(0, n));
  }
  function updateUnits(step){
    assignEscorts();
    const followers = m.units.filter(u => u.status === "ACTIVE" || u.status === "INJURED");
    const pace = m.push ? 1.35 : (STANCE[m.stance] || STANCE.controlled).move;
    followers.forEach((u, i) => {
      const sp = 40 * (u.speed || 1) * (u.tired ? .85 : 1) * pace * (u.status === "INJURED" ? .75 : 1);
      navigate(u, m.squadRoom, slot(m.squadRoom, i), sp * step, false);
    });
    for(const u of m.units){
      if(u.status === "DOWN"){
        u.bleed -= step;
        if(u.bleed <= 0){
          if(u.id === "joel"){
            u.bleed = 0;
            if(!u.critical){ u.critical = true; addLog("Joel is critical. He will live, but he will be out of the fight for longer.", "critical"); }
            // slice 3: nobody leaves him on the floor for good. The nearest free trooper drags him; he talks again, slowly
            const a = nearestAlly(u);
            if(a){ u.status = "INJURED"; u.hp = 1; a.carry = 6; addLog(`${a.name} hauled Joel up. He's on the radio again, barely.`, "critical"); }
          }
          else { u.status = "DEAD"; addLog(`${u.name} bled out in the ${roomName(u.room)}.`, "critical"); }
        }
        continue;
      }
      if(u.status !== "ACTIVE") continue;
      u.cool -= step;
      if(u.carry > 0){ u.carry -= step; if(u.carry <= 0) u.treating = false; continue; }
      if(m.escorts.has(u)) continue; // an escort can't shoot
      if(u.cool > 0) continue;
      if(m.ammo <= 0){ // melee only: slow, and they take more bites
        const z = m.zombies.filter(z => z.alive && z.room === u.room && dist(u, z) < 28).sort((a, b) => dist(u, a) - dist(u, b))[0];
        if(z){ damageZombie(z, z.type === "armoured" ? 6 : 14); u.cool = 1; burst(z.x, z.y, "#9f2d25"); }
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
    // slice 4.1: let sleeping rooms lie. Only Aggressive opens fire on infected that are still unaware in another room
    // (a shot wakes the whole room). Raiders at night are exempt: they are walking at the shelter.
    const wake = m.stance === "aggressive";
    for(const z of m.zombies){
      if(!z.alive || hiddenZ(z) || (z.ignored && dist(u, z) > 50) || !canShoot(u, z, 260)) continue;
      if(!wake && !z.alert && !z.raid && z.room !== u.room) continue;
      const d = dist(u, z) + (z.alert ? 0 : 80);
      if(d < bd){ bd = d; best = z; }
    }
    return best;
  }
  const NOISE_PER_SHOT = .34; // slice 3: was .45, which fired a wave every ~7s with six guns
  // slice 4.1: stances you can feel. Defensive: aimed and quiet, ~25% fewer rounds a kill and ~40% less noise, but ~15% less
  // firepower and it holds a room until the next one is quiet. Aggressive: fast, more firepower, wakes rooms, ~25% more rounds a kill.
  const STANCE = {defensive:{hit:.2, rof:1.5, noise:.6, move:.85}, controlled:{hit:0, rof:1, noise:1, move:1}, aggressive:{hit:-.15, rof:.75, noise:1, move:1.35}};
  function wakeRoom(r){ m.zombies.forEach(z => { if(z.alive && z.room === r && !z.lurk) z.alert = true; }); } // a crawler ignores noise: it waits
  function shoot(u, z){
    m.ammo--; const d = dist(u, z), S = STANCE[m.stance] || STANCE.controlled;
    // slice 4.1: stance noise is a day thing; the night comes on a clock whatever you do
    m.noise += (u.noise || 1) * (u.rookie && !has("drill") ? 1.5 : 1) * NOISE_PER_SHOT * (m.night ? 1 : S.noise);
    z.alert = true; wakeRoom(u.room); wakeRoom(z.room);
    const hit = .72 + (u.acc || 0) + S.hit - (u.tired ? .15 : 0) - (d > 200 ? .12 : 0);
    const focused = m.focus && m.focus.z === z, landed = Math.random() < hit;
    m.shots.push({x1:u.x, y1:u.y, x2:z.x, y2:z.y, t:.12, color:u.color, miss:!landed});
    u.cool = u.rof * S.rof * (u.tired ? 1.1 : 1);
    if(landed){ let dmg = u.close && d < 110 ? u.close : u.dmg; if(z.type === "armoured" && !focused) dmg *= .5; damageZombie(z, dmg); }
    if(m.ammo === 0) addLog("Out of ammo. The team is down to knives and rifle butts.", "critical");
  }
  function damageZombie(z, dmg){
    if(!z.alive) return; z.hp -= dmg;
    if(z.hp <= 0){
      z.alive = false; m.kills++; burst(z.x, z.y, "#9f2d25");
      if(z.type === "bloater") explode(z);
      else if(z.type === "armoured") addLog(`Armoured infected down in the ${roomName(z.room)}.`, "kill");
      // slice 3: the crawler's payoff. Caught before it moved, it was lying on someone's stash
      else if(z.type === "crawler" && z.lurk){ camp.parts++; m.stash = (m.stash || 0) + 1; m.blasts.push({x:z.x, y:z.y, t:1, stash:true}); addLog(`Crawler dead before it moved. It was lying on a stash: +1 part.`, "kill"); }
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
    m.civs.forEach(c => { if((c.status === "following" || c.status === "trapped" || c.status === "gathering") && dist(c, z) < 95){ c.hp -= 30; if(c.hp <= 0) civDies(c, "caught in a bloater burst"); } });
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
  // slice 3.1: every civilian death keeps its cause, so the log and the results can say how
  function civDies(c, how){ if(c.status === "dead") return; c.status = "dead"; c.how = `${how} · ${roomName(c.room)}`; addLog(`A civilian died in the ${roomName(c.room)}: ${how}.`, "critical"); }
  const biteName = z => ({shambler:"bitten", runner:"run down by a runner", armoured:"killed by an armoured", crawler:"taken by a crawler", screamer:"bitten by a screamer"})[z.type] || "bitten";

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
        // the night: raiders walk for the shelter and only turn on the team if it is in their room or shooting at them
        if(z.raid && z.room !== CIV){ navigate(z, CIV, {x:915, y:110}, z.speed * .8 * step, true); continue; }
        if(z.room === CIV && (m.objective === "reach" || m.objective === "hold")){
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
    z.cd = 1; const dmg = z.type === "crawler" && t.kind === "civ" ? 30 : ZT[z.type].dmg * (m.ammo <= 0 && t.kind === "unit" ? 1.2 : 1);
    burst(t.x, t.y, "#ff493d");
    if(t.kind === "unit"){
      if(t.status === "DOWN"){ t.bleed = Math.max(0, t.bleed - 3); return; }
      t.hp -= dmg; t.lastHit = m.elapsed; if(t.hp <= 0) downUnit(t);
    } else { t.hp -= dmg; if(t.hp <= 0) civDies(t, biteName(z)); }
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
  const WAVE_AT = [30, 60, 90], WAVE_SIZE = [6, 8, 10];
  function checkWaves(){
    while(m.wavesFired < 3 && m.noise >= WAVE_AT[m.wavesFired]){ spawnWave(WAVE_SIZE[m.wavesFired], WAVE_AT[m.wavesFired]); m.wavesFired++; }
    if(m.wavesFired >= 3 && m.noise >= 100){ spawnWave(6, 100); m.noise = 60; }
  }
  // the night's clock: a raid every 20s, bigger each time, bloaters in the third and sixth. From the fourth they come two ways at once.
  // They walk for the shelter, not for you: stand in their way, or let them pass and save the noise.
  const NIGHT_EVERY = 20;
  function nightWaves(){
    if(m.elapsed < m.nextWave || m.elapsed >= DAWN - 10) return;
    m.nextWave += NIGHT_EVERY; m.nightWave++;
    const n = 4 + m.nightWave * 2, bl = m.nightWave === 3 || m.nightWave === 6, edges = nightEdges();
    if(m.nightWave < 4) spawnWave(n, null, {raid:true, bloater:bl, edge:edges[m.nightWave % edges.length]});
    else { const k = m.nightWave; spawnWave(Math.ceil(n / 2), null, {raid:true, bloater:bl, edge:edges[k % edges.length]}); spawnWave(Math.floor(n / 2), null, {raid:true, edge:edges[(k + 1) % edges.length]}); }
  }
  const nightEdges = () => m.night && has("walls") ? EDGES.slice(0, 2) : EDGES;
  function scream(z){
    m.noise += 10; wakeRoom(z.room); ADJ[z.room].forEach(n => wakeRoom(n.r));
    m.blasts.push({x:z.x, y:z.y, t:.6, scream:true}); jolt("wave");
    addLog(`Screamer in the ${roomName(z.room)}: +10 noise, rooms awake.`, "critical");
  }
  function spawnWave(size, at, o = {}){
    if(!m.night && !o.trickle) size += Math.ceil(m.extra / 2); // a bigger team is a bigger signal
    const edges = nightEdges();
    const edge = o.edge ? o.edge : m.wavesFired === 0 && m.route === "vehicle" && !m.night ? EDGES[1] : edges[Math.floor(Math.random() * edges.length)];
    const runners = Math.min(size, (m.wavesFired >= 1 || o.raid ? Math.floor(size / 3) : 0) + B.waveRunners);
    const r = ROOMS[edge.room], spot = () => ({x:clamp(edge.x + (Math.random() - .5) * 40, r.x + 12, r.x + r.w - 12), y:clamp(edge.y + (Math.random() - .5) * 40, r.y + 12, r.y + r.h - 12)});
    for(let i = 0; i < size; i++){
      const p = spot(), z = addZombie(size >= 6 && i === 0 && !(B.softStart && m.wavesFired === 0 && !o.trickle) ? "armoured" : i >= size - runners ? "runner" : "shambler", edge.room, p.x, p.y, !o.raid);
      if(o.raid) z.raid = true;
    }
    if(o.bloater){ const p = spot(), z = addZombie("bloater", edge.room, p.x, p.y, false); z.raid = true; }
    if(!o.raid) wakeRoom(edge.room);
    jolt("wave");
    addLog(`${at ? `Noise ${at}` : o.trickle ? "The column was seen" : `Wave ${m.nightWave}`}: ${size} infected${o.bloater ? " and a bloater" : ""}${runners ? (runners === 1 ? ", one of them a runner," : `, ${runners} of them runners,`) : ""} ${o.raid ? "coming over" : "pushing in through"} the ${edge.label}.`, "critical");
  }
  function barricadeBroke(){
    addLog(m.night ? "The shelter is breached. 1 dies every 10s while they're inside." : `The ${roomName(CIV)} barricade is down. The civilians are exposed.`, "critical");
    // the night can breach more than once (it gets shored up again); the window opens once, the log says the rest
    if(m.civs.some(c => c.status === "trapped") && !(m.night && m.breachAsked)){ m.breachAsked = true; pushCrisis({kind:"barricade"}); }
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
      if(m.holding && m.clearT >= 6 && !m.holdNoted){ m.holdNoted = true; addLog(`Defensive: holding until the ${roomName(next)} is clear.`); }
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
        m.objective = "choose"; m.push = false; m.loot = true; m.ammo += 30; m.meds += 1; camp.parts++;
        addLog(`Reached ${plural(alive.length, "civilian")}. Their cache: +30 rounds, +1 med, +1 part.`, "kill");
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
    if(m.night && m.elapsed >= DAWN){ addLog("Grey light over the fence. They're drifting off. Dawn.", "kill"); endMission("success"); return; }
    if(m.night && !m.civs.some(c => c.status === "trapped")){ addLog("The shelter is quiet. Nobody in it is left.", "critical"); endMission("failure"); return; }
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
    if(c.kind === "barricade") return (m.objective === "reach" || m.objective === "hold") && m.civs.some(x => x.status === "trapped") && m.squadRoom !== CIV;
    if(c.kind === "pack") return m.objective === "extract";
    return false;
  }
  const threatNear = u => m.zombies.some(z => z.alive && dist(z, u) < 70);
  const nearestAlly = u => m.units.filter(a => a !== u && a.status === "ACTIVE" && a.carry <= 0).sort((a, b) => (RDIST[a.room][u.room] * 500 + dist(a, u)) - (RDIST[b.room][u.room] * 500 + dist(b, u)))[0];
  // honest odds: every infected close to the casualty makes the patch-up less likely; a medic helps
  const closeInfected = u => m.zombies.filter(z => z.alive && z.room === u.room && dist(z, u) < 130).length;
  // slice 4.1: a free medic (up, not carrying) treats instead: much better odds, more HP back, but he stops shooting for 5s
  const freeMedic = u => m.units.find(x => x.medic && x.status === "ACTIVE" && x !== u && !(x.carry > 0));
  function stabilizeChance(u){
    if(freeMedic(u)) return clamp(.92 - closeInfected(u) * .08 - (u.critical ? .1 : 0), .45, .95);
    return clamp(.8 - closeInfected(u) * .14 - (u.critical ? .15 : 0), .15, .8);
  }
  function stabilize(u){
    const medic = freeMedic(u), p = stabilizeChance(u);
    if(medic){ medic.carry = 5; medic.treating = true; }
    if(Math.random() < p){ u.status = "ACTIVE"; u.hp = Math.round((medic ? 60 : 40) * .7); u.bleed = 0; u.patched = true; addLog(`${medic ? `${medic.name} got ${u.name}` : `${u.name} is patched up and`} back on their feet.`, "critical"); }
    else { u.bleed = Math.max(1, u.bleed - 4); addLog(`It didn't take. The med is gone and ${u.name} is still down, worse than before.`, "critical"); }
  }
  function takeCounts(){
    const left = m.civs.filter(x => x.status === "trapped").length, able = m.units.filter(u => u.status === "ACTIVE" && u.carry !== Infinity).length;
    const most = Math.min(left, able); // one escort per civilian
    return [...new Set([most, Math.ceil(most / 2), 1])].filter(n => n >= 1);
  }
  // slice 3: getting people out from behind a barricade takes time and makes noise. The team holds the room while they get ready.
  const GATHER = 14;
  function takeCivs(n){
    m.civs.filter(x => x.status === "trapped").slice(0, n).forEach(x => { x.status = "gathering"; });
    m.objective = "gather"; m.gatherT = GATHER; m.noise += 10; ADJ[CIV].forEach(a => wakeRoom(a.r)); jolt("wave");
    addLog(`Pulling the barricade apart. Loud. ${plural(n, "civilian")} need ${GATHER}s to get ready: hold the ${roomName(CIV)}.`, "critical");
  }
  function startExtract(){
    const n = m.civs.filter(x => x.status === "gathering").length, left = m.civs.filter(x => x.status === "trapped").length;
    m.civs.forEach(x => { if(x.status === "gathering") x.status = "following"; });
    m.barricade = 60; m.objective = "extract";
    addLog(`${plural(n, "civilian")} ${n === 1 ? "falls" : "fall"} in behind the team.${left ? ` ${left} ${left === 1 ? "stays" : "stay"} behind a rebuilt barricade.` : ""} Out through the western service door, in the ${roomName(ENTRY)}.`);
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
        copy:u.id === "joel" ? `${roomName(u.room)} · ${near} close · no command · scar ${scars()}/${MAX_SCARS} if lost`
          : `${roomName(u.room)} · ${near} close · bleeds out ${Math.ceil(u.bleed)}s`,
        options:[
          {id:"rescue", label:"Drag clear", sub:ally ? `●● · ${ally.name} carries 6s` : "●● · no one free", disabled:m.cp < 2 || !ally,
            run(){ m.cp -= 2; u.status = "INJURED"; u.hp = Math.max(1, Math.round(u.maxHp * .25)); ally.carry = 6; addLog(`${ally.name} dragged ${u.name} clear. Out of the fight, but alive.`, "critical"); }},
          {id:"cover", label:freeMedic(u) ? `${freeMedic(u).name} treats` : "Patch up", sub:`● + med · ${pct}%`, disabled:m.cp < 1 || m.meds < 1,
            run(){ m.cp--; m.meds--; stabilize(u); }},
          // slice 4.1: no command needed, but it costs a gun. The carrier holds them for the rest of the mission and can't shoot.
          {id:"carry", label:"Carry", sub:ally ? `Free · costs ${ally.name}'s gun` : "No one free", disabled:!ally,
            run(){ u.status = "INJURED"; u.hp = Math.max(1, Math.round(u.maxHp * .25)); ally.carry = Infinity; addLog(`${ally.name} shoulders ${u.name}. One gun fewer until you're out.`, "critical"); }},
          u.id === "joel"
            ? {id:"leave", label:"Fight on", sub:"Free · no command", danger:true, run(){ addLog("The team fights on. Joel is still down.", "critical"); }}
            : {id:"leave", label:"Leave", sub:"Free · lost for good", danger:true, run(){ u.status = "DEAD"; addLog(`Joel ordered the team to leave ${u.name}.`, "critical"); }}
        ], defaults:m.night ? ["rescue", "cover"] : ["rescue", "cover", "carry"],
        expire(){ addLog(`No order came. ${u.name} is still down.`, "critical"); }
      };
    }
    if(c.kind === "bloater"){
      const z = c.z;
      return {
        title:"Bloater closing",
        copy:`On ${c.unit.name} · ${roomName(z.room)} · bursts up close`,
        options:[
          {id:"focus", label:"Focus fire", sub:"● · kill it at range", disabled:m.cp < 1, run(){ m.cp--; z.ignored = false; m.focus = {z, t:8}; addLog("All fire on the bloater.", "kill"); }},
          {id:"fallback", label:"Fall back", sub:m.prevRoom === m.squadRoom ? "No room behind" : `Free · ${roomName(m.prevRoom)}, −8s`, disabled:m.prevRoom === m.squadRoom,
            run(){ const r = m.prevRoom; m.prevRoom = m.squadRoom; m.squadRoom = r; m.holdT = 8; addLog(`Team falling back to the ${roomName(r)}.`); }},
          // slice 2.1: holding is not free. The team stays on the other targets, so the bloater walks into the line and bursts there.
          {id:"hold", label:"Hold", sub:"Free · it bursts on the line", danger:true, run(){ holdOnBloater(z); }}
        ], defaults:["focus", "fallback"],
        expire(){ holdOnBloater(z); }
      };
    }
    if(c.kind === "pack"){
      const d = doorBetween(CIV, PACK_ROOM), guns = m.units.filter(u => u.status === "ACTIVE" && !m.escorts.has(u)).length;
      return {
        title:"Freezer bay open",
        copy:`${B.pack} runners · after the civilians · ${plural(guns, "gun")} free`,
        options:[
          {id:"seal", label:"Seal door", sub:"● · 25s", disabled:m.cp < 1 || d.sealed > 0,
            run(){ m.cp--; d.sealed = 25; m.noise += 3; addLog(`The ${doorName(d)} is wedged shut. The pack goes round.`, "kill"); }},
          {id:"run", label:"Run", sub:"Free · loud, they follow", run(){ m.push = true; m.holdT = 0; addLog(`Joel: "Go, go, go."`, "critical"); }},
          {id:"hold", label:"Fight", sub:`Free · ${guns} vs ${B.pack}`, danger:true, run(){ m.holdT = 10; addLog("The team plants its feet in the cold room.", "critical"); }}
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
      const warn = seen.length ? ` · crawler in the ${[...new Set(seen.map(z => z.room))].map(roomName).join(" and ")}`
        : !m.recon && lurkers.length ? " · a crawler may hide" : "";
      return {
        title:"Who comes out?",
        copy:`1 escort per civilian · escorts can't shoot${warn}`,
        // ui pass 6: "3 shooting" read as "the 3 you take shoot"; say what is left to fight
        options:counts.map(n => ({id:"take" + n, label:n === left ? `Take all ${n}` : `Take ${n}`, sub:shooters(n) ? `${plural(shooters(n), "gun")} left` : "No guns left", danger:shooters(n) === 0, run:take(n)})), defaults:[],
        defaultLabel:`take ${Math.min(left, Math.max(1, able - 2))}`,
        expire(){ const n = Math.min(left, Math.max(1, able - 2)); addLog("No order. The team takes who it can protect."); take(n)(); }
      };
    }
    return {
      title:m.night ? "Shelter breached" : "Barricade down", // ui pass 4: match the HUD's word at night
      copy:`${plural(left, "civilian")} exposed · 1 dies every 10s`,
      options:[
        {id:"push", label:"Push", sub:`● · to the ${roomName(CIV)}, loud`, disabled:m.cp < 1, run(){ m.cp--; m.push = true; m.holdT = 0; if(m.night){ m.prevRoom = m.squadRoom; m.squadRoom = CIV; } addLog(`Joel: "Move. Now. Get to them."`, "critical"); }},
        {id:"hold", label:"Stay", sub:"Free · they're alone", danger:true, run(){ addLog("The team keeps its pace."); }}
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
    if(!view.land && matchMedia("(max-width:760px)").matches){ const lp = $(".battle-log-panel"), sc = $("#combat-screen"); ov.style.top = `${lp.getBoundingClientRect().top - sc.getBoundingClientRect().top}px`; }
    else ov.style.top = "";
    const v = crisisView(c);
    $("#crisis-title").textContent = v.title; $("#crisis-copy").textContent = v.copy;
    $("#crisis-timer-fill").style.width = `${Math.max(0, c.t / c.max) * 100}%`; $("#crisis-secs").textContent = `${Math.ceil(Math.max(0, c.t))}s`;
    $(".crisis-card").classList.toggle("urgent", c.t <= 4);
    const d = defaultOption(v), dl = d ? d.label.toLowerCase() : v.defaultLabel || "nothing changes";
    $("#crisis-queue").textContent = `No call → ${dl}${m.crises.length > 1 ? ` · +${m.crises.length - 1} waiting` : ""}`;
    const sig = c.uid + "|" + v.options.map(o => `${o.disabled ? 0 : 1}${o.sub}`).join("|");
    if(sig === m.crisisSig) return; m.crisisSig = sig;
    $("#crisis-actions").style.gridTemplateColumns = `repeat(${v.options.length},1fr)`;
    $("#crisis-actions").innerHTML = v.options.map(o => `<button data-opt="${o.id}" class="${o.danger ? "danger-choice" : ""}" ${o.disabled ? "disabled" : ""}><strong>${o.label}</strong><small>${o.sub}</small></button>`).join("");
  }

  // ---------- orders + stances ----------
  function spend(n){ if(m.cp < n){ addLog("Not enough command."); return false; } m.cp -= n; return true; }
  $("#command-bar").onclick = e => {
    const b = e.target.closest("button[data-command]"); if(!b || !m || !m.running) return; const cmd = b.dataset.command;
    if(cmd === "retreat"){ addLog("Joel ordered an immediate retreat.", "critical"); endMission("retreat"); return; }
    // slice 2.1: orders lock while a command window is open. The sim is paused, so spending command there is free planning,
    // and the crisis is the decision on the table. Stances (free) and Retreat (a real answer to any crisis) stay open.
    if(m.crises.length){ addLog("Orders wait. Make the call first."); return; }
    if(cmd === "advance" || cmd === "seal"){
      if(m.arm === cmd){ m.arm = null; addLog("Order cancelled."); }
      else if(m.cp < 1) addLog("Not enough command.");
      else { m.arm = cmd; addLog(cmd === "advance" ? "Advance: pick a room." : "Seal: pick a door."); }
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
    if(b.dataset.stance){ m.stance = b.dataset.stance; addLog(`Stance: ${m.stance}${({defensive:" · aimed, quiet, slow", aggressive:" · fast, loud, wakes rooms"})[m.stance] || ""}.`); }
    else if(b.dataset.faw !== undefined){ m.faw = !m.faw; addLog(m.faw ? "Fire at will." : "Hold fire unless they are in the room."); }
    renderHud();
  };
  // ui pass 5: the 3D battlefield (battle3d.js) when three.js loaded and WebGL works; otherwise the 2D canvas below, as before.
  // It reads the same state each frame and draws into the same canvas box, so taps (toMap, doorReach) are unchanged.
  const canvas = $("#battlefield"), b3d = window.THREE && window.Battle3D ? window.Battle3D.create(canvas) : null, ctx = b3d ? null : canvas.getContext("2d");
  const s3 = {m:null, key:"", labels:null, rooms:ROOMS, doors:DOORS, edges:EDGES, W, H, hiddenZ, doorReach:s => doorReach(s)};
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // the pointer in map units. When the app is rotated (a portrait phone), getBoundingClientRect gives the turned box on screen,
  // so both the pointer and the box go back into the app's own frame first: app x = screen y, app y = screen width - screen x.
  function toMap(e){
    const r = canvas.getBoundingClientRect();
    let x = e.clientX, y = e.clientY, left = r.left, top = r.top, w = r.width, h = r.height;
    if(view.rot){ x = e.clientY; y = view.sw - e.clientX; left = r.top; top = view.sw - r.right; w = r.height; h = r.width; }
    const s = Math.min(w / W, h / H);
    return {x:(x - left - (w - W * s) / 2) / s, y:(y - top - (h - H * s) / 2) / s, s};
  }
  // ui pass 2: a big door target, about an 80px circle on a phone (doors sit at least 160 map units apart, and the nearest wins)
  const doorReach = s => clamp(40 / s, 80, 120);
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
    if(m.arm === "advance") orderAdvance(ROOMS.findIndex(R => p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h));
    else orderSeal(DOORS.filter(d => dist(d, p) < doorReach(p.s)).sort((a, b) => dist(a, p) - dist(b, p))[0]);
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
      // slice 3: an overrun is not a wipe. The base's runners drag out who they can reach: about half the downed live, badly hurt
      else if(reason === "failure" && (m.night || Math.random() < .5)){ u.status = "INJURED"; u.overrun = true; }
      else { u.status = "DEAD"; u.leftBehind = true; }
    });
    let rescued = 0, scrambled = 0;
    m.civs.forEach(c => { if(c.status === "gathering") c.status = "trapped"; }); // not out yet: they stay behind the barricade
    // the night: whoever is still alive in the shelter at dawn is saved; on a fall or a retreat, half get out the back
    if(m.night) m.civs.forEach(c => { if(c.status !== "trapped") return; if(reason === "success" || Math.random() < .5){ c.status = "out"; rescued++; } else { c.status = "dead"; c.how = "didn't get out the back"; } });
    m.civs.forEach(c => {
      if(c.status !== "following") return;
      if(reason === "success" || (reason === "retreat" && (c.room === ENTRY || Math.random() < .5))){ c.status = "out"; rescued++; }
      else { c.status = "dead"; c.how = `${reason === "retreat" ? "lost in the retreat" : "team overrun"} · ${roomName(c.room)}`; if(reason === "retreat") scrambled++; }
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
      const k = camp.recruitsEarned || 0, pick = RECRUITS[k];
      if(alive >= 6 || !pick) break; // no room yet: the volunteer waits until there is
      camp.recruitsEarned = k + 1;
      const id = "r" + k;
      camp.recruits.push({id, name:pick.name, role:"Volunteer", trait:"Rookie · +50% noise, learning fast", hp:80, color:pick.color, dmg:18, rof:.8, rookie:true});
      camp.roster[id] = {status:"fit", out:0, lastDay:-99};
      out.push(pick.name);
    }
    return out;
  }
  function writeBack(r){
    coolStreets(); healDay();
    let toll = "";
    m.units.forEach(u => {
      const x = rec(u.id); x.lastDay = camp.day;
      if(u.id === "joel"){
        if(u.status === "INJURED" || u.patched){
          // Joel can't die, but a downed Joel costs days of command, and an overrun costs the base
          const days = (u.overrun ? 2 : 1) + (u.critical ? 1 : 0);
          x.status = "wounded"; x.out = days;
          if(u.overrun){ toll = " Joel's rescue: −40 rds, −1 med."; }
          // slice 2.1: a near-death leaves a scar for good: −20 max HP and +4s on command regen. The third ends the campaign.
          const scarred = u.overrun || u.critical;
          if(scarred){ camp.joelScars = scars() + 1; toll += ` Joel scar ${scars()}/${MAX_SCARS}.`; }
          u.hurtOut = true; u.outcome = `${u.overrun ? "Dragged out" : "Out"} ${days}d${scarred ? ` · scar ${scars()}/${MAX_SCARS}` : ""}`;
        } else if(u.hp < u.maxHp * .4){ x.status = "hurt"; x.out = 0; u.hurtOut = true; u.outcome = "Hurt · leads"; }
        else { x.status = "fit"; x.out = 0; u.outcome = "OK"; }
        return;
      }
      if(u.status === "DEAD"){ x.status = "dead"; x.out = 0; x.diedDay = camp.day; u.outcome = u.leftBehind ? "KIA · left" : "KIA"; }
      else if(u.status === "INJURED" && u.overrun){ x.status = "wounded"; x.out = 3; u.hurtOut = true; u.outcome = "Dragged out 3d"; }
      else if(u.status === "INJURED"){ x.status = "wounded"; x.out = 2; u.hurtOut = true; u.outcome = "Out 2d"; }
      else if(u.hp < u.maxHp * .4){ x.status = "wounded"; x.out = 1; u.hurtOut = true; u.outcome = "Out 1d"; }
      else { x.status = "fit"; x.out = 0; u.outcome = "OK"; }
    });
    camp.ammo = Math.max(0, camp.ammo - m.ammoStart + m.ammo);
    camp.meds = Math.max(0, camp.meds - m.medsStart + m.meds);
    if(m.units.some(u => u.id === "joel" && u.overrun)){ camp.ammo = Math.max(0, camp.ammo - 40); camp.meds = Math.max(0, camp.meds - 1); }
    const s = cur(); s.trips = (s.trips || 0) + 1; // ui pass 6: a count only, for the ending's rows
    if(m.night){
      // the finale ends the chapter whatever happens: dawn, a fall, or Joel giving the base up
      s.rescued = r.rescued; s.lost = r.lost; s.civilians = 0; r.title = B.title; r.left = 0;
      camp.ended = r.reason === "success" ? "chapter" : r.reason === "retreat" ? "fled" : "fell";
      camp.day++; camp.missions++; saveCampaign(); return;
    }
    s.civilians -= r.rescued + r.lost; s.rescued += r.rescued; s.lost += r.lost; camp.rescuedTotal = (camp.rescuedTotal || 0) + r.rescued;
    camp.ammo += r.rescued * CIV_AMMO; // slice 3.1: the people you bring home bring what they had
    // smoother curve: what you leave behind still grows, but within a band, so one bad day is not a death spiral
    const growth = 6 + Math.floor(m.noise / 15);
    s.infected = clamp(m.zombies.filter(z => z.alive).length + growth, 18, 36);
    let night = "";
    if(s.civilians > 0){
      if(m.barricade <= 0){ s.civilians--; s.lost++; s.barricade = BAR_RESET; night = " Barricade failed: 1 lost."; }
      else s.barricade = clamp(Math.round(m.barricade + 5), BAR_FLOOR, 100); // the survivors shore it up overnight
    }
    r.left = s.civilians; r.barricade = s.barricade; r.title = B.title; r.key = B.key;
    const what = r.reason === "success" ? `${r.rescued} rescued (+${r.rescued * CIV_AMMO} rds)` : r.reason === "retreat" ? (r.rescued ? `withdrew with ${r.rescued}` : "withdrew empty-handed") : "the team was overrun";
    const dead = m.units.filter(u => u.status === "DEAD").map(u => u.name);
    const joined = volunteers();
    r.joined = joined;
    camp.report = `Day ${r.day}: ${what}${dead.length ? `, lost ${dead.length > 1 ? dead.slice(0, -1).join(", ") + " and " + dead.at(-1) : dead[0]}` : ""}.${toll}${s.civilians > 0 ? ` +${growth} infected overnight.` : ""}${night}${joined.length ? ` ${joined.join(" and ")} joined.` : ""}`;
    camp.day++; camp.missions++;
    r.resolved = s.civilians <= 0; if(r.resolved) r.pay = payout(s);
    checkBuilding(); checkEnded();
    saveCampaign();
  }
  function showResults(){
    if(!m || !m.report) return;
    state.endMode = false;
    $("#result-eyebrow").textContent = `AFTER-ACTION · ${m.report.title.toUpperCase()}`; $("#return-ops").textContent = camp.ended ? "See how it ends" : "Continue";
    const r = m.report, dead = m.units.filter(u => u.status === "DEAD"), hurt = m.units.filter(u => u.hurtOut);
    $("#result-screen .result-card").className = `result-card outcome-${r.reason}`; // tone only
    $("#result-title").textContent = m.night ? (r.reason === "success" ? "Dawn" : r.reason === "retreat" ? "Base abandoned" : "The shelter fell")
      : r.reason === "failure" ? "Signal lost" : r.reason === "retreat" ? "Team withdrawn" : "Team returning";
    // one line: what the grid and the rows don't already say
    const bits = [];
    if(m.night) bits.push(r.reason === "success" ? "They saw the morning." : r.reason === "retreat" ? "Joel gave up the base." : "Survivors got out the back.");
    else if(r.reason === "failure") bits.push("Overrun. The base dragged out who it could.");
    else if(r.reason === "retreat" && r.scrambled) bits.push(`${r.scrambled} lost in the scramble.`);
    else if(r.lost) bits.push(`${plural(r.lost, "civilian")} lost.`);
    else if(r.reason === "success" && !dead.length && !hurt.length) bits.push(r.left ? "The team came back whole." : "Everyone is coming home.");
    if(r.joined && r.joined.length) bits.push(`${r.joined.join(" and ")} joined.`);
    $("#result-summary").textContent = bits.join(" "); $("#result-summary").hidden = !bits.length;
    $("#result-grid").innerHTML = `<div><span>${m.night ? (r.reason === "success" ? "SAW DAWN" : "GOT OUT") : "SAVED"}</span><strong>${r.rescued}<small>/${m.civStart}</small></strong></div><div><span>KILLS</span><strong>${m.kills}</strong></div><div><span>ROUNDS</span><strong>${r.ammoUsed}</strong></div><div><span>TEAM LOST</span><strong>${dead.length}</strong></div>`;
    const rw = REWARDS[r.key], pay = r.pay || {};
    $("#result-base").textContent = m.night ? "" : r.resolved
      ? `${r.title} ${pay.bonus ? "is ours" : pay.parts ? "· few saved" : "is lost"} · ${pay.parts ? `+${pay.parts} ${pay.parts > 1 ? "parts" : "part"}` : "no reward"}${rw && pay.bonus ? ` · ${rw.name}` : ""} · next: ${B.mission}`
      : `Base ${camp.ammo} rds · ${camp.meds} meds · ${r.left} trapped · barricade ${r.barricade}%`;
    // slice 3.1: one row per civilian lost, with how
    // ui pass 4: numbered, so a count can be traced row by row ("Civilian 2 · bitten · checkout")
    const civRows = m.civs.filter(c => c.status === "dead").map((c, i) => { const h = (c.how || "lost").split(" · "); if(h[1] && h[0].includes(h[1])) h.pop(); return `<div class="casualty-row is-dead civ-row"><strong>Civilian ${i + 1}</strong><span>${h.join(" · ")}</span></div>`; });
    $("#casualty-list").innerHTML = m.units.map(u => `<div class="casualty-row ${u.status === "DEAD" ? "is-dead" : hurt.includes(u) ? "is-hurt" : ""}"><strong>${u.name}</strong><span>${u.outcome}</span></div>`).join("") + (civRows.length ? `<div class="civ-list">${civRows.join("")}</div>` : "");
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
  // ui pass 6: a pause always says why, and one tap on the map resumes at the speed you had. Only two things pause:
  // you (Ⅱ), or leaving the app. A crisis holds the sim inside its own card, which already says PAUSED.
  function setPaused(on, why){
    state.paused = on; state.pauseWhy = on ? why || "you" : null;
    $("#pause-btn").classList.toggle("selected", on); $("#pause-btn").textContent = on ? "▶" : "Ⅱ";
    $("#pause-why").textContent = state.pauseWhy === "away" ? "PAUSED · YOU LEFT THE APP" : "PAUSED";
    $("#pause-go").textContent = `▶ RESUME ${state.speed}×`;
    $("#pause-banner").hidden = !on;
  }
  $("#pause-btn").onclick = () => setPaused(!state.paused, "you");
  $("#pause-banner").onclick = () => setPaused(false);
  // leaving the app (home button, app switch, lock) pauses a live mission instead of letting crises time out unseen
  document.addEventListener("visibilitychange", () => { if(document.hidden && m && m.running && !state.paused) setPaused(true, "away"); });
  $$("[data-speed]").forEach(b => b.onclick = () => { state.speed = +b.dataset.speed; setPaused(false); $$("[data-speed]").forEach(x => x.classList.toggle("selected", x === b)); });

  // ---------- HUD ----------
  const fmt = n => { const t = Math.floor(n); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  function chipText(u){
    if(u.status === "ACTIVE") return `${Math.max(0, Math.round(u.hp))} HP${u.carry > 0 ? (u.treating && u.carry < 99 ? " · TREATING" : " · CARRYING") : m.escorts.has(u) ? " · ESCORT" : ""}`;
    if(u.status === "DOWN") return u.id === "joel" ? (u.critical ? "DOWN · CRITICAL" : `DOWN · ${Math.ceil(u.bleed)}s`) : `DOWN · ${Math.ceil(u.bleed)}s`;
    if(u.status === "INJURED") return "CARRIED";
    return "KIA";
  }
  function renderHud(){
    if(!m) return;
    const joel = m.units.find(u => u.id === "joel"), joelUp = joel && joel.status === "ACTIVE";
    const chips = m.units.map(u => `<div class="unit-chip ${u.status.toLowerCase()}${u.tired ? " tired" : ""}${u.status === "ACTIVE" && u.hp < u.maxHp * .4 ? " low" : ""}" style="--hp:${u.status === "ACTIVE" ? Math.max(0, Math.round(u.hp / u.maxHp * 100)) : u.status === "DOWN" ? Math.round(clamp(u.bleed / 20, 0, 1) * 100) : 0}%"><strong>${u.name}</strong><small>${chipText(u)}</small></div>`).join("");
    const objective = m.objective === "gather" ? `Hold the ${roomName(CIV)} · ${Math.ceil(m.gatherT)}s` : m.objective === "hold" ? `Dawn in ${fmt(Math.max(0, DAWN - m.elapsed))}${m.crises.length ? ` <em class="paused">Ⅱ paused</em>` : ""} · shelter ${m.barricade > 0 ? Math.ceil(m.barricade) + "%" : "breached"}`
      : m.objective === "reach" ? (m.barricade > 0 ? `Reach civilians · barricade ${Math.ceil(m.barricade)}%` : `Barricade down · 1 lost in ${Math.ceil(10 - (m.civClock || 0))}s`)
      : m.objective === "extract" ? `Walk ${m.civs.filter(c => c.status === "following").length} out · west door${m.holding ? " · holding" : ""}`
      : m.objective === "choose" ? "Who comes out" : "No one left · retreat";
    const locked = m.running && m.crises.length > 0;
    const sig = chips + objective + m.cp + m.stance + m.faw + m.arm + m.meds + m.squadRoom + m.holding + locked;
    if(sig !== m.hudSig){
      m.hudSig = sig;
      $("#squad-status").innerHTML = chips;
      $("#objective-text").innerHTML = objective; // ui pass 4: "paused" is a tag, not more text
      $("#command-points").textContent = "● ".repeat(m.cp) + "○ ".repeat(3 - m.cp);
      // ui pass 6: a point coming back is felt where you spend it: the dots and the orders flash once, and the orders stay lit while one is in hand
      if(m.cpSeen != null && m.cp > m.cpSeen){ [$(".bandwidth"), $("#command-bar")].forEach(el => { el.classList.remove("cp-up"); void el.offsetWidth; el.classList.add("cp-up"); }); }
      m.cpSeen = m.cp; $("#command-bar").classList.toggle("cp-ready", m.cp > 0 && !locked);
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
    const carried = joel && joel.status === "INJURED";
    $("#cp-regen-label").textContent = m.cp >= 3 ? "FULL" : carried ? `+1 IN ${Math.ceil((m.regenT - m.cpRegen) * 2)}s · CARRIED` : !joelUp ? "JOEL DOWN" : `+1 IN ${Math.ceil(m.regenT - m.cpRegen)}s`;
    $("#bandwidth-fill").style.width = `${(joelUp || carried) && m.cp < 3 ? m.cpRegen / m.regenT * 100 : m.cp >= 3 ? 100 : 0}%`;
    const nextWave = m.wavesFired < 3 ? WAVE_AT[m.wavesFired] : 100;
    $("#noise-value").textContent = `${Math.round(m.noise)} / ${nextWave}`;
    $(".bandwidth").classList.toggle("noise-near", nextWave - m.noise <= 8);
    $("#noise-fill").style.width = `${Math.min(100, m.noise)}%`;
    $$(".noise-line i").forEach((t, i) => t.classList.toggle("hit", i < m.wavesFired)); // ui pass 6: waves already pulled are ticked off
    $("#ammo-value").textContent = `${m.ammo} rds`;
    $("#meds-value").textContent = m.meds;
    $("#mission-clock").textContent = fmt(m.elapsed);
  }
  function addLog(text, type = "normal"){ $("#log-stream").insertAdjacentHTML("afterbegin", `<div class="log-entry ${type}"><time>${fmt(m ? m.elapsed : 0)}</time><span>${text}</span></div>`);
    const t = $("#log-ticker"); t.innerHTML = text; t.className = "log-ticker"; void t.offsetWidth; t.className = `log-ticker show ${type}`; } // land: the latest line over the map
  // a short screen-edge flash that carries what happened: a trooper down, a wave, a blast, a door giving way
  function jolt(kind){ const w = $(".battlefield-wrap"); if(!w) return; w.classList.remove("jolt-down", "jolt-wave", "jolt-blast", "jolt-door"); void w.offsetWidth; w.classList.add("jolt-" + kind); }
  function burst(x, y, color){ for(let i = 0; i < 5; i++) m.particles.push({x, y, vx:(Math.random() - .5) * 80, vy:(Math.random() - .5) * 80, t:.35, color}); }

  // ---------- draw ----------
  function draw(){
    if(b3d){ s3.m = m; s3.key = B.key; s3.labels = B.labels; b3d.draw(s3); return; }
    // the backing store follows the drawn size and the screen density, so the map stays sharp on a phone; map units stay 1100 x 680
    const cs = Math.min((canvas.clientWidth || W) / W, (canvas.clientHeight || H) / H) || 1, k = clamp(cs * (window.devicePixelRatio || 1), 1, 2.5);
    if(Math.abs(canvas.width - Math.round(W * k)) > 2){ canvas.width = Math.round(W * k); canvas.height = Math.round(H * k); }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.fillStyle = "#111916"; ctx.fillRect(0, 0, W, H);
    // visual scale only: when the canvas is drawn small (a phone), labels and markers grow so they stay readable. Hit areas and sim are untouched.
    const vs = view.land ? clamp(1.15 / cs, 1, 2.8) : clamp(.7 / cs, 1, 2), mk = view.land ? 1.7 : 1.3;
    const ur = 10 * Math.min(mk, vs), zr = Math.min(mk, vs), px = n => `${Math.round(n * vs)}px monospace`;
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
      else if(m && m.arm === "seal"){ ctx.strokeStyle = "#61d4cf"; ctx.lineWidth = 2; ctx.strokeRect(d.x - w / 2, d.y - h / 2, w, h);
        // the tap target, drawn: a pulsing ring close to what a tap accepts
        const p = RM ? .5 : (Math.sin(performance.now() / 220) + 1) / 2; ctx.strokeStyle = `rgba(97,212,207,${.35 + p * .35})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(d.x, d.y, doorReach(cs) * .8, 0, Math.PI * 2); ctx.fillStyle = "rgba(97,212,207,.08)"; ctx.fill(); ctx.stroke(); }
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
      m.civs.forEach(c => { if(c.status === "dead" || c.status === "out") return; ctx.fillStyle = "#8dbb72"; ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e8fff7"; ctx.lineWidth = 1; ctx.stroke(); });
      m.zombies.forEach(z => {
        if(!z.alive || !m.seen[z.room] || hiddenZ(z)) return;
        const t = ZT[z.type];
        ctx.fillStyle = z.type === "armoured" ? "#a68d67" : z.type === "bloater" ? "#9aa040" : z.type === "screamer" ? "#b48ad6" : z.type === "crawler" ? (z.lurk ? "#5d6a3c" : "#c4cf63") : z.type === "runner" ? (z.alert ? "#ff7a3d" : "#7a3a22") : z.alert ? "#b3372d" : "#6d2a25";
        ctx.beginPath(); ctx.arc(z.x, z.y, t.r * zr, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#ff776d55"; ctx.lineWidth = 1; ctx.stroke();
        if(z.type === "armoured"){ ctx.fillStyle = "#d2bea0"; ctx.fillRect(z.x - 8, z.y - 2, 16, 4); }
        if(z.type === "screamer" && z.scream > 0 && z.alert){ ctx.strokeStyle = "#d8b6ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, t.r + 4 + z.scream * 4, 0, Math.PI * 2); ctx.stroke(); }
        if(z.type === "crawler"){ ctx.strokeStyle = "#c4cf63"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z.x - 10, z.y + 3); ctx.lineTo(z.x + 10, z.y + 3); ctx.stroke();
          // slice 3: a spotted crawler is marked, so the sweep that found it pays off on screen
          if(z.lurk){ const p = RM ? .5 : (Math.sin(performance.now() / 300) + 1) / 2; ctx.strokeStyle = `rgba(196,207,99,${.4 + p * .4})`; ctx.beginPath(); ctx.arc(z.x, z.y, 16 + p * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#c4cf63"; ctx.font = "bold " + px(9); ctx.textAlign = "center"; ctx.fillText("CRAWLER", z.x, z.y - 22); ctx.textAlign = "left"; } }
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
      m.blasts.forEach(b => { ctx.globalAlpha = b.t;
        if(b.stash){ ctx.fillStyle = "#d6ad55"; ctx.font = "bold " + px(12); ctx.textAlign = "center"; ctx.fillText("+1 PART", b.x, b.y - 30 - (1 - b.t) * 40); ctx.textAlign = "left"; return; }
        ctx.fillStyle = b.scream ? "#b48ad633" : "#c9d14a55"; ctx.beginPath(); ctx.arc(b.x, b.y, 95 * (1.2 - b.t / 2), 0, Math.PI * 2); ctx.fill(); });
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
  window.ZB = {get m(){ return m; }, get camp(){ return camp; }, state, view, toMap};
  renderOps(); registerWebTools(); view.ready = true; draw();
  // slice 3: a reload resumes where the save is. The prologue is only for a campaign that has not started
  const started = camp.missions > 0 || camp.day > START_DAY;
  if(camp.ended) showEnd(); else if(started) show("ops-screen");
})();
