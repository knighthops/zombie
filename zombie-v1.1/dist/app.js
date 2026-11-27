(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const screens = $$(".screen");
  const state = {
    screen: "story-screen", recon: false, route: "vehicle", doctrine: "controlled", mode: "command",
    selected: new Set(["joel", "shannon", "mike", "ruiz", "gustave", "david"]), speed: 1, paused: false,
    command: 3, elapsed: 0, crisis: null, crisisLeft: 0, logFilter: "all", running: false,
    units: [], zombies: [], particles: [], shots: [], kills: 0, rescued: 0, ammo: 100, crisisTriggered: false
  };
  const roster = [
    {id:"joel",name:"Joel",role:"Leader",trait:"Steady · story protected",hp:120,color:"#d6ad55"},
    {id:"shannon",name:"Shannon",role:"Rifle",trait:"Accurate · calm",hp:95,color:"#61d4cf"},
    {id:"mike",name:"Mike",role:"Breacher",trait:"Shotgun · loyal",hp:110,color:"#8dbb72"},
    {id:"ruiz",name:"Ruiz",role:"Scout",trait:"Fast · observant",hp:85,color:"#72a6bb"},
    {id:"gustave",name:"Gustave",role:"Medic",trait:"Trauma care · cautious",hp:90,color:"#b494d0"},
    {id:"david",name:"David",role:"Rifle",trait:"Disciplined · rookie",hp:90,color:"#c6c6b5"}
  ];

  function show(id){ screens.forEach(s=>s.classList.toggle("active",s.id===id)); state.screen=id; window.scrollTo(0,0); }
  function selectButtons(container, key, value){
    $$(`button[data-${key}]`,container).forEach(b=>b.classList.toggle("selected",b.dataset[key]===value));
  }
  $("#open-ops").onclick=()=>show("ops-screen");
  $("#prepare-btn").onclick=()=>{renderRoster();updateForecast();show("prep-screen")};
  $("#back-map").onclick=()=>show("ops-screen");
  $("#return-ops").onclick=()=>{resetMission();show("ops-screen")};
  $("#retry-mission").onclick=()=>{resetMission();renderRoster();show("prep-screen")};
  $("#roster-jump").onclick=()=>{$("#prepare-btn").click()};
  $("#mission-node").onclick=()=>{$(".brief-panel").scrollIntoView({behavior:"smooth"})};

  $("#recon-btn").onclick=()=>{
    if(state.recon) return;
    state.recon=true; $("#recon-btn").innerHTML="<span>✓</span> Recon complete <small>Conditions advanced by 20 min</small>";
    $("#threat-value").textContent="22–28"; $("#structure-value").textContent="Mapped"; $("#loot-value").textContent="Medical";
    $("#window-value").textContent="~25 min"; $("#ops-time").textContent="07:30"; logPreviewPulse();
  };
  function logPreviewPulse(){ $("#mission-node").animate([{filter:"brightness(2)"},{filter:"brightness(1)"}],{duration:650}); }
  $("#route-choice").onclick=e=>{const b=e.target.closest("button[data-route]");if(!b)return;state.route=b.dataset.route;selectButtons($("#route-choice"),"route",state.route);$("#depart-time").textContent=state.route==="vehicle"?"07:18":"07:35";};
  $("#doctrine-choice").onclick=e=>{const b=e.target.closest("button[data-doctrine]");if(!b)return;state.doctrine=b.dataset.doctrine;selectButtons($("#doctrine-choice"),"doctrine",state.doctrine);updateForecast();};
  $("#mode-choice").onclick=e=>{const b=e.target.closest("button[data-mode]");if(!b)return;state.mode=b.dataset.mode;selectButtons($("#mode-choice"),"mode",state.mode);updateForecast();};

  function renderRoster(){
    $("#squad-list").innerHTML=roster.map((p,i)=>`<button class="trooper-card ${state.selected.has(p.id)?"selected":"unselected"}" data-id="${p.id}"><span class="portrait" style="color:${p.color}">${p.name.slice(0,2).toUpperCase()}</span><span><strong>${p.name}</strong><small>${p.role} · ${p.trait}</small></span><span class="level">${i===0?"LEADER":"LV "+(2+i%3)}</span></button>`).join("");
    $$(".trooper-card").forEach(card=>card.onclick=()=>{const id=card.dataset.id;if(id==="joel")return;if(state.selected.has(id)){if(state.selected.size>3)state.selected.delete(id)}else if(state.selected.size<6)state.selected.add(id);renderRoster();updateForecast();});
  }
  function updateForecast(){
    const count=state.selected.size, recon=state.recon?12:0, doctrine=state.doctrine==="controlled"?7:state.doctrine==="defensive"?4:2;
    const power=Math.round(count*10+recon+doctrine); $("#power-score").textContent=power;
    $("#success-forecast").textContent=power>=72?"VERY LIKELY":power>=60?"LIKELY":"RISKY";
    $("#loss-forecast").textContent=power>=72?(state.mode==="command"?"0–1":"0–2"):"1–3";
    $("#intel-forecast").textContent=state.recon?"HIGH":"LOW";
  }

  $("#deploy-btn").onclick=()=>{
    if(state.mode==="resolve"){quickResolve();return;}
    initMission();show("combat-screen");requestAnimationFrame(loop);
  };
  function quickResolve(){
    resetMission(); const risk=state.recon?0.18:0.36; const injured=Math.random()<risk?[roster[2]]:[];
    state.kills=24;state.elapsed=1;state.units=roster.filter(p=>state.selected.has(p.id)).map(p=>({...p,status:injured.includes(p)?"INJURED":"SAFE",hp:injured.includes(p)?34:p.hp}));state.rescued=3;showResults("resolved");
  }

  const canvas=$("#battlefield"),ctx=canvas.getContext("2d");
  const rooms=[
    {x:35,y:45,w:300,h:220,label:"SHOP FLOOR"},{x:355,y:45,w:315,h:220,label:"CHECKOUT"},{x:690,y:45,w:370,h:220,label:"STOCKROOM"},
    {x:35,y:290,w:390,h:340,label:"AISLES"},{x:445,y:290,w:260,h:340,label:"OFFICE"},{x:725,y:290,w:335,h:340,label:"LOADING BAY"}
  ];
  function initMission(){
    resetMission();state.running=true;state.speed=1;state.command=3;
    const picks=roster.filter(p=>state.selected.has(p.id));
    state.units=picks.map((p,i)=>({...p,x:78+(i%2)*32,y:330+Math.floor(i/2)*46,maxHp:p.hp,hp:p.hp,status:"ACTIVE",cool:Math.random(),downTimer:0,hold:false,target:null}));
    const amount=state.recon?24:29;
    state.zombies=Array.from({length:amount},(_,i)=>({id:i,x:480+Math.random()*520,y:80+Math.random()*520,hp:i%11===0?110:32,maxHp:i%11===0?110:32,speed:i%11===0?7:12+Math.random()*8,type:i%11===0?"armoured":"shambler",attack:0,alive:true}));
    addLog("Team entered through the western service door.");
    addLog(state.recon?"Recon map synchronized. Stockroom movement confirmed.":"Signal weak. Interior layout is incomplete.");
    if(state.route==="vehicle")addLog("Vehicle noise is drawing movement from the east.","critical");
    $("#command-bar").classList.toggle("disabled",state.mode!=="command"); renderStatus();
  }
  function resetMission(){state.running=false;state.elapsed=0;state.crisis=null;state.crisisTriggered=false;state.kills=0;state.rescued=0;state.ammo=100;state.units=[];state.zombies=[];state.particles=[];state.shots=[];$("#log-stream").innerHTML="";$("#crisis-overlay").classList.remove("open");}

  function update(dt){
    if(!state.running||state.paused||state.crisis)return;
    const step=dt*state.speed;state.elapsed+=step;
    const active=state.units.filter(u=>u.status==="ACTIVE");
    for(const u of active){
      u.cool-=step;
      const live=state.zombies.filter(z=>z.alive);
      let target=live.sort((a,b)=>dist(u,a)-dist(u,b))[0];
      const nearest=target?dist(u,target):999;
      if(!u.hold&&nearest>125){const tx=state.doctrine==="defensive"?330:state.doctrine==="aggressive"?820:650;moveToward(u,{x:tx,y:340},(state.doctrine==="aggressive"?31:23)*step)}
      if(target&&nearest<210&&u.cool<=0&&state.ammo>0){
        const dmg=u.role==="Breacher"&&nearest<120?55:u.role==="Scout"?24:31;target.hp-=dmg;u.cool=state.doctrine==="aggressive"?.45:.65;state.ammo=Math.max(0,state.ammo-.45);state.shots.push({x1:u.x,y1:u.y,x2:target.x,y2:target.y,t:.12,color:u.color});
        if(target.hp<=0&&target.alive){target.alive=false;state.kills++;burst(target.x,target.y,"#9f2d25");if(state.kills%3===0)addLog(`${u.name} neutralized ${target.type==="armoured"?"an armoured infected":"a zombie"}.`,"kill");}
      }
    }
    for(const z of state.zombies.filter(z=>z.alive)){
      const targets=state.units.filter(u=>u.status==="ACTIVE");if(!targets.length)break;
      const target=targets.sort((a,b)=>dist(z,a)-dist(z,b))[0];const d=dist(z,target);z.attack-=step;
      if(d>24)moveToward(z,target,z.speed*step);else if(z.attack<=0){target.hp-=z.type==="armoured"?15:9;z.attack=.9;burst(target.x,target.y,"#ff493d");if(target.hp<=0)downUnit(target);}
    }
    state.shots.forEach(s=>s.t-=step);state.shots=state.shots.filter(s=>s.t>0);state.particles.forEach(p=>{p.x+=p.vx*step;p.y+=p.vy*step;p.t-=step});state.particles=state.particles.filter(p=>p.t>0);
    if(!state.crisisTriggered&&state.elapsed>15&&state.units.some(u=>u.status==="ACTIVE")){const candidate=state.units.find(u=>u.id==="david")||state.units.at(-1);candidate.hp=0;downUnit(candidate,true)}
    if(state.zombies.every(z=>!z.alive)||state.elapsed>70){state.rescued=3;endMission("success")}
    if(!state.units.some(u=>u.status==="ACTIVE")){endMission("failure")}
    renderStatus();
  }
  function downUnit(u,scripted=false){if(u.status!=="ACTIVE")return;u.status="DOWN";u.downTimer=15;state.crisisTriggered=true;addLog(`${u.name} is down and exposed.`,"critical");if(state.mode==="command")openCrisis(u);else{setTimeout(()=>{if(u.status==="DOWN"){u.status=Math.random()<.45?"DEAD":"INJURED";addLog(`${u.name} ${u.status==="DEAD"?"did not make it":"was dragged to cover by the team"}.`,"critical")}},2400)};}
  function openCrisis(u){state.crisis=u;state.crisisLeft=8;$("#crisis-title").textContent=`${u.name} is down`;$("#crisis-copy").textContent=`${u.name} is bleeding near the centre aisle. The eastern doorway is collapsing.`;$("#crisis-overlay").classList.add("open");}
  $$("[data-crisis]").forEach(b=>b.onclick=()=>resolveCrisis(b.dataset.crisis));
  function resolveCrisis(choice){const u=state.crisis;if(!u)return;if(choice==="rescue"&&state.command>=2){state.command-=2;u.status="INJURED";u.hp=35;addLog(`${u.name} was extracted under emergency cover.`,"critical")}else if(choice==="cover"&&state.command>=1){state.command--;if(Math.random()<.72){u.status="ACTIVE";u.hp=28;addLog(`${u.name} is stabilized and back on their feet.`,"critical")}else{u.status="INJURED";addLog(`${u.name} was stabilized but cannot continue.`,"critical")}}else if(choice==="abandon"){u.status="DEAD";addLog(`Joel ordered the team to leave ${u.name}.`,"critical")}else{addLog("Not enough command bandwidth.","critical");return}state.crisis=null;$("#crisis-overlay").classList.remove("open");renderStatus();}

  function moveToward(a,b,amount){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;a.x+=dx/d*amount;a.y+=dy/d*amount;a.x=Math.max(45,Math.min(1050,a.x));a.y=Math.max(55,Math.min(625,a.y));}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function burst(x,y,color){for(let i=0;i<5;i++)state.particles.push({x,y,vx:(Math.random()-.5)*80,vy:(Math.random()-.5)*80,t:.35,color})}
  function draw(){
    ctx.fillStyle="#111916";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.strokeStyle="#34413c";ctx.lineWidth=5;ctx.fillStyle="#18211e";
    rooms.forEach((r,i)=>{ctx.fillStyle=i%2?"#17201d":"#1b2421";ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillStyle="#53615b";ctx.font="11px monospace";ctx.fillText(r.label,r.x+14,r.y+20)});
    for(let x=80;x<400;x+=55){ctx.fillStyle="#29342f";ctx.fillRect(x,340,16,230)}
    ctx.fillStyle="#26322e";ctx.fillRect(470,335,210,32);ctx.fillRect(470,430,210,32);ctx.fillRect(760,350,240,24);
    ctx.strokeStyle="#53635c";ctx.setLineDash([7,7]);ctx.strokeRect(890,250,125,170);ctx.setLineDash([]);ctx.fillStyle="#8dbb72";ctx.font="bold 12px monospace";ctx.fillText("CIVILIANS",915,330);
    ctx.globalAlpha=.08;ctx.fillStyle="#61d4cf";ctx.beginPath();ctx.arc(90,340,155,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    state.zombies.filter(z=>z.alive).forEach(z=>{ctx.fillStyle=z.type==="armoured"?"#a68d67":"#8d332c";ctx.beginPath();ctx.arc(z.x,z.y,z.type==="armoured"?11:7,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#ff776d55";ctx.stroke();if(z.type==="armoured"){ctx.fillStyle="#d2bea0";ctx.fillRect(z.x-8,z.y-2,16,4)}});
    state.units.forEach(u=>{ctx.globalAlpha=u.status==="DEAD"?.25:1;ctx.fillStyle=u.status==="DOWN"?"#ff493d":u.color;ctx.beginPath();ctx.arc(u.x,u.y,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e8fff7";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#07100f";ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.fillText(u.name[0],u.x,u.y+3);ctx.textAlign="left";ctx.globalAlpha=1});
    state.shots.forEach(s=>{ctx.globalAlpha=Math.min(1,s.t*8);ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke()});
    state.particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.t*3);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3)});ctx.restore();ctx.globalAlpha=1;
  }
  function loop(ts){if(!state.lastTs)state.lastTs=ts;const dt=Math.min(.04,(ts-state.lastTs)/1000);state.lastTs=ts;if(state.screen==="combat-screen"){update(dt);draw();updateClock();requestAnimationFrame(loop)}}
  function updateClock(){const t=Math.floor(state.elapsed);$("#mission-clock").textContent=`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;if(state.crisis){state.crisisLeft=Math.max(0,state.crisisLeft-.016);$("#crisis-timer-fill").style.width=`${state.crisisLeft/8*100}%`;if(state.crisisLeft<=0)resolveCrisis("abandon")}}
  function renderStatus(){
    $("#squad-status").innerHTML=state.units.map(u=>`<div class="unit-chip ${u.status.toLowerCase()}"><strong>${u.name}</strong><small>${u.status} · ${Math.max(0,Math.round(u.hp))} HP</small></div>`).join("");
    $("#command-points").textContent="● ".repeat(state.command)+"○ ".repeat(3-state.command);$("#bandwidth-fill").style.width=`${state.command/3*100}%`;
  }
  function addLog(text,type="normal"){$("#log-stream").insertAdjacentHTML("afterbegin",`<div class="log-entry ${type}" data-type="${type}"><time>${formatTime(state.elapsed)}</time><span>${text}</span></div>`);applyLogFilter()}
  function formatTime(n){const t=Math.floor(n);return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}
  function applyLogFilter(){$$(".log-entry").forEach(e=>e.hidden=state.logFilter!=="all"&&e.dataset.type!==state.logFilter)}
  $(".log-filters").onclick=e=>{const b=e.target.closest("button[data-filter]");if(!b)return;state.logFilter=b.dataset.filter;selectButtons($(".log-filters"),"filter",state.logFilter);applyLogFilter()};
  $("#pause-btn").onclick=()=>{state.paused=!state.paused;$("#pause-btn").classList.toggle("selected",state.paused);$("#pause-btn").textContent=state.paused?"▶":"Ⅱ"};
  $$("[data-speed]").forEach(b=>b.onclick=()=>{state.speed=+b.dataset.speed;state.paused=false;$("#pause-btn").classList.remove("selected");$("#pause-btn").textContent="Ⅱ";$$('[data-speed]').forEach(x=>x.classList.toggle("selected",x===b))});
  $("#command-bar").onclick=e=>{const b=e.target.closest("button[data-command]");if(!b)return;const cmd=b.dataset.command;if(cmd==="retreat"){addLog("Joel ordered an immediate retreat.","critical");endMission("retreat");return}if(cmd==="gear"){const u=state.units.filter(x=>x.status==="ACTIVE").sort((a,b)=>a.hp-b.hp)[0];if(u&&state.command){state.command--;u.hp=Math.min(u.maxHp,u.hp+35);addLog(`Gustave used a trauma kit on ${u.name}.`)}}else if(cmd==="hold"){state.units.forEach(u=>u.hold=true);addLog("Team is holding position.")}else if(cmd==="rally"){state.units.forEach(u=>{u.hold=false;moveToward(u,{x:300,y:340},25)});addLog("Team rallied to Joel's marker.")}else if(cmd==="focus"){const z=state.zombies.find(z=>z.alive&&z.type==="armoured");if(z){z.hp-=70;addLog("All fire focused on the armoured infected.","kill")}}renderStatus()};

  function endMission(reason){if(!state.running)return;state.running=false;setTimeout(()=>showResults(reason),500)}
  function showResults(reason){
    const dead=state.units.filter(u=>u.status==="DEAD"),injured=state.units.filter(u=>u.status==="INJURED"||u.status==="DOWN");
    $("#result-title").textContent=reason==="failure"?"Signal lost":reason==="retreat"?"Team withdrawn":"Team returning";
    $("#result-summary").textContent=reason==="success"||reason==="resolved"?`The civilians are secure. ${dead.length?"The victory has a cost.":"For once, everyone is coming home."}`:reason==="retreat"?"The team escaped, but the civilians remain trapped and conditions will worsen.":"No one responded to Joel's final transmission.";
    $("#result-grid").innerHTML=`<div><span>INFECTED CLEARED</span><strong>${state.kills}</strong></div><div><span>CIVILIANS</span><strong>${state.rescued}</strong></div><div><span>AMMO LEFT</span><strong>${Math.round(state.ammo)}%</strong></div><div><span>TEAM LOSSES</span><strong>${dead.length}</strong></div>`;
    $("#casualty-list").innerHTML=state.units.map(u=>`<div class="casualty-row"><strong>${u.name} · ${u.role}</strong><span>${u.status==="ACTIVE"?"Returned":u.status}</span></div>`).join("");show("result-screen");
  }

  function registerWebTools(){
    const mc=document.modelContext;if(!mc?.registerTool)return;
    const modes=["observe","command","resolve"];
    Promise.resolve(mc.registerTool({name:"start_zombie_mission",title:"Start Zombie Mission",description:"Start the Desperate Measures prototype mission in the selected play mode.",inputSchema:{type:"object",properties:{mode:{type:"string",enum:modes}},required:["mode"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:({mode})=>{if(!modes.includes(mode))throw new Error("Invalid mission mode");state.mode=mode;renderRoster();updateForecast();show("prep-screen");selectButtons($("#mode-choice"),"mode",mode);return{screen:"deployment",mode}}})).catch(()=>{});
    Promise.resolve(mc.registerTool({name:"read_zombie_mission_status",title:"Read Mission Status",description:"Read the current prototype screen and live mission status.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({screen:state.screen,elapsed:Math.floor(state.elapsed),kills:state.kills,commandPoints:state.command,team:state.units.map(u=>({name:u.name,status:u.status,hp:Math.max(0,Math.round(u.hp))}))})})).catch(()=>{});
  }
  renderRoster();updateForecast();registerWebTools();draw();
})();
