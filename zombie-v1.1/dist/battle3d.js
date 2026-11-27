// UI pass 5: the 3D battlefield. A render layer only: every frame it reads the same sim state the 2D canvas drew
// (rooms, doors, units, infected, civilians, shots, blasts) and never writes to it. Map units stay 1100 x 680.
// The camera is an oblique orthographic view: the floor plane maps exactly onto the canvas (the same box the 2D map used),
// so a tap's map point is the same as before; height leans "up" the screen by tan(26°).
(function(){
"use strict";
const T = window.THREE;
if(!T) return;
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TILT = 26 * Math.PI / 180, TAN = Math.tan(TILT), COS = Math.cos(TILT);
let seed = 7;
function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const R = (a, b) => a + rnd() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const C = {human:0x2fe39a, civ:0xa8dcff, inf:0xff3a2e, elite:0xb565ff, gold:0xd6ad55, down:0xff2b2b, cyan:0x61d4cf};
const HEX = {inf:"#ff3a2e", elite:"#b565ff", gold:"#d6ad55"};

/* ---------- shared geometry ---------- */
const G = {
  box:new T.BoxGeometry(1, 1, 1), ico:new T.IcosahedronGeometry(1, 0), ico1:new T.IcosahedronGeometry(1, 1),
  cyl:new T.CylinderGeometry(1, 1, 1, 8), cone:new T.ConeGeometry(1, 1, 5), plane:new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
};
const flatG = g => { g.rotateX(-Math.PI / 2); return g; };
function arcRing(ri, ro, arcs, fill){
  const pos = [], idx = [], seg = 6;
  for(let a = 0; a < arcs; a++){
    const a0 = a / arcs * Math.PI * 2, a1 = a0 + fill / arcs * Math.PI * 2, b = pos.length / 3;
    for(let i = 0; i <= seg; i++){ const t = a0 + (a1 - a0) * i / seg; pos.push(Math.cos(t) * ri, 0, Math.sin(t) * ri, Math.cos(t) * ro, 0, Math.sin(t) * ro); }
    for(let i = 0; i < seg; i++){ const k = b + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function sectorGeo(len, half, seg){
  const pos = [0, 0, 0], col = [1, 1, 1], idx = [];
  for(let i = 0; i <= seg; i++){ const a = -half + 2 * half * i / seg; pos.push(Math.sin(a) * len, 0, Math.cos(a) * len); col.push(0, 0, 0); }
  for(let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}
const BG = {
  disc:flatG(new T.CircleGeometry(1, 28)), thin:flatG(new T.RingGeometry(.9, 1, 40)), ring:flatG(new T.RingGeometry(.72, 1, 32)),
  dash:arcRing(.72, 1, 8, .62), squad:arcRing(.96, 1, 18, .55), cone:sectorGeo(2.7, .46, 12)
};

/* ---------- textures ---------- */
function ctex(w, h, draw){ const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); draw(x, w, h); const t = new T.CanvasTexture(c); return t; }
const TX = {
  glow:ctex(128, 128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
  blood:ctex(128, 128, (x) => { x.translate(64, 64); for(let i = 0; i < 14; i++){ const a = R(0, 6.3), d = i ? R(10, 52) : 0, s = i ? R(4, 14) : 34; x.fillStyle = `rgba(${R(70, 105) | 0},${R(10, 18) | 0},${R(10, 16) | 0},${R(.75, .95)})`; x.beginPath(); x.ellipse(Math.cos(a) * d, Math.sin(a) * d, s, s * R(.6, 1), R(0, 3), 0, 7); x.fill(); } }),
  skull:ctex(128, 128, (x) => {
    x.translate(64, 66);
    const bone = r => { x.save(); x.rotate(r); x.fillRect(-44, -6, 88, 12); [[-44, -7], [-44, 7], [44, -7], [44, 7]].forEach(p => { x.beginPath(); x.arc(p[0], p[1], 8, 0, 7); x.fill(); }); x.restore(); };
    x.shadowColor = "rgba(0,0,0,.9)"; x.shadowBlur = 10; x.fillStyle = "#f2f2ee"; bone(.7); bone(-.7);
    x.beginPath(); x.arc(0, -14, 30, 0, 7); x.fill(); x.fillRect(-19, 2, 38, 26);
    x.shadowBlur = 0; x.fillStyle = "#141414";
    x.beginPath(); x.arc(-12, -12, 9, 0, 7); x.fill(); x.beginPath(); x.arc(12, -12, 9, 0, 7); x.fill();
    x.beginPath(); x.moveTo(0, 0); x.lineTo(-5, 9); x.lineTo(5, 9); x.fill();
    x.fillRect(-11, 18, 3, 10); x.fillRect(-2, 18, 3, 10); x.fillRect(7, 18, 3, 10);
  }),
  bubble:ctex(128, 128, (x) => {
    x.shadowColor = "rgba(0,0,0,.8)"; x.shadowBlur = 10; x.fillStyle = "#f4f4f0";
    x.beginPath(); if(x.roundRect) x.roundRect(10, 14, 108, 74, 30); else x.rect(10, 14, 108, 74); x.fill();
    x.beginPath(); x.moveTo(34, 80); x.lineTo(26, 114); x.lineTo(60, 84); x.fill();
    x.shadowBlur = 0; x.fillStyle = "#d42a20"; x.font = "900 64px Inter, Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("!", 64, 54);
  }),
  reticle:ctex(256, 256, (x) => {
    x.translate(128, 128); x.strokeStyle = "#ffffff"; x.lineWidth = 7; x.shadowColor = "rgba(0,0,0,.9)"; x.shadowBlur = 8;
    x.beginPath(); x.arc(0, 0, 96, 0, 7); x.stroke(); x.fillStyle = "#fff";
    for(let i = 0; i < 4; i++){ x.save(); x.rotate(i * Math.PI / 2); x.beginPath(); x.moveTo(0, -82); x.lineTo(-13, -116); x.lineTo(13, -116); x.closePath(); x.fill(); x.restore(); }
  }),
  drop:ctex(64, 64, (x) => { x.shadowColor = "rgba(0,0,0,.9)"; x.shadowBlur = 6; x.fillStyle = "#ff3b30"; x.beginPath(); x.moveTo(32, 6); x.quadraticCurveTo(54, 34, 46, 46); x.arc(32, 42, 14, 0, Math.PI); x.quadraticCurveTo(10, 34, 32, 6); x.fill(); }),
  fog:ctex(64, 64, (x) => { x.fillStyle = "#070c0b"; x.fillRect(0, 0, 64, 64); })
};
function icon(col, glyph){
  return ctex(128, 128, (x) => {
    x.translate(64, 64); x.shadowColor = "rgba(0,0,0,.9)"; x.shadowBlur = 8;
    x.fillStyle = "#0d1110"; x.beginPath(); x.arc(0, 0, 50, 0, 7); x.fill();
    x.shadowBlur = 0; x.lineWidth = 7; x.strokeStyle = col; x.stroke();
    x.fillStyle = col; x.strokeStyle = col; x.lineCap = "round"; x.lineJoin = "round"; glyph(x);
  });
}
const ICON = {
  star:icon(HEX.gold, x => { x.beginPath(); for(let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 13 : 31; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); }),
  shield:icon(HEX.elite, x => { x.beginPath(); x.moveTo(0, -30); x.lineTo(25, -20); x.quadraticCurveTo(24, 16, 0, 32); x.quadraticCurveTo(-24, 16, -25, -20); x.closePath(); x.fill(); }),
  burst:icon(HEX.elite, x => { x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; x.beginPath(); x.arc(Math.cos(a) * 27, Math.sin(a) * 27, 6, 0, 7); x.fill(); } }),
  waves:icon(HEX.inf, x => { x.lineWidth = 7; x.beginPath(); x.arc(-14, 0, 6, 0, 7); x.fill(); [16, 30].forEach(r => { x.beginPath(); x.arc(-14, 0, r + 4, -.9, .9); x.stroke(); }); })
};
const spriteMat = (tex, op) => new T.SpriteMaterial({map:tex, depthTest:false, depthWrite:false, transparent:true, opacity:op == null ? 1 : op});
const SM = {star:spriteMat(ICON.star), shield:spriteMat(ICON.shield), burst:spriteMat(ICON.burst), waves:spriteMat(ICON.waves), drop:spriteMat(TX.drop), skull:spriteMat(TX.skull), bubble:spriteMat(TX.bubble)};
function sprite(mat, size, y){ const s = new T.Sprite(mat); s.scale.set(size, size, 1); s.position.y = y; s.renderOrder = 30; return s; }
const B = (hex, op, add) => new T.MeshBasicMaterial({color:hex, transparent:true, opacity:op == null ? 1 : op, depthWrite:false, side:T.DoubleSide, blending:add ? T.AdditiveBlending : T.NormalBlending});
const MAPM = {}; // shared lit materials for props
const PM = hex => MAPM[hex] || (MAPM[hex] = new T.MeshLambertMaterial({color:hex}));

/* text sprite: redrawn only when its text changes */
function TextSprite(cw, ch, font, align){
  const c = document.createElement("canvas"); c.width = cw; c.height = ch; const x = c.getContext("2d");
  const tex = new T.CanvasTexture(c); const mat = new T.SpriteMaterial({map:tex, depthTest:false, depthWrite:false, transparent:true});
  this.sprite = new T.Sprite(mat); this.sprite.renderOrder = 40; this.txt = null;
  this.set = (txt, color) => {
    const key = txt + "|" + color; if(key === this.txt) return; this.txt = key;
    x.clearRect(0, 0, cw, ch); x.font = font; x.textBaseline = "middle"; x.textAlign = align || "center";
    x.lineWidth = 6; x.strokeStyle = "rgba(0,0,0,.85)"; const px = align === "right" ? cw - 6 : align === "left" ? 6 : cw / 2;
    x.strokeText(txt, px, ch / 2); x.fillStyle = color; x.fillText(txt, px, ch / 2); tex.needsUpdate = true;
  };
}

/* ---------- figures: built from parts, then baked to ~6 draw calls each and cloned per entity ---------- */
const PC = {};
const P = (hex, emis) => { const k = hex + "|" + (emis || 0); return PC[k] || (PC[k] = {color:new T.Color(hex), emissive:new T.Color(emis || 0)}); };
function part(geo, mat, sx, sy, sz, x, y, z, parent, rx, ry, rz){
  const m = new T.Mesh(geo); m.userData.mat = mat; m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  if(rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(m); return m;
}
function rig(o){
  const s = o.s || 1, w = o.w || 1;
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const hip = .6 * s * (o.legLen || 1);
  const legs = [-1, 1].map(k => { const p = new T.Group(); p.position.set(.15 * k * s * w, hip, 0); body.add(p); part(G.box, o.pants, .22 * s * w, hip, .24 * s, 0, -hip / 2, 0, p); return p; });
  const torso = new T.Group(); torso.position.y = hip; body.add(torso);
  const th = .62 * s * (o.torsoH || 1);
  if(o.torsoBox !== false) part(G.box, o.cloth, .62 * s * w, th, .38 * s * (o.depth || 1), 0, th / 2, 0, torso);
  const neck = new T.Group(); neck.position.y = th; torso.add(neck);
  const hr = .2 * s * (o.headS || 1);
  part(G.ico, o.skin, hr, hr * 1.12, hr, 0, hr * 1.05, 0, neck);
  const al = .56 * s * (o.armLen || 1), aw = .15 * s * (o.armW || 1);
  const arms = [-1, 1].map(k => { const p = new T.Group(); p.position.set((.31 * w * s + aw * .55) * k, th - .06 * s, 0); torso.add(p);
    part(G.box, o.armMat || o.cloth, aw, al, aw, 0, -al / 2, 0, p); part(G.box, o.skin, aw * .9, aw * .8, aw * .9, 0, -al - aw * .3, 0, p); return p; });
  root.name = "fig"; body.name = "body"; torso.name = "torso"; legs[0].name = "legL"; legs[1].name = "legR"; arms[0].name = "armL"; arms[1].name = "armR";
  return {root, body, torso, neck, legs, arms, s, hr, th, hip, al};
}
const eyes = (r, col) => { const m = P(0x220000, col); [-1, 1].forEach(k => part(G.box, m, r.hr * .28, r.hr * .18, r.hr * .1, k * r.hr * .38, r.hr * 1.15, r.hr * .95, r.neck)); };
const H = {skin:P(0xb39c8a), fat:P(0x4f7d71, 0x04120d), vest:P(0x24342f), helm:P(0x3f675d, 0x04120d), pants:P(0x343e3b), gun:P(0x2b3232), metal:P(0x5a6260)};
const I = {skin:P(0xa8a290), cloth:P(0x9a2c23, 0x3a0603), pants:P(0x2f2b2a), rag:P(0x4a2a28, 0x120000)};
const E = {skin:P(0x6f5f7d, 0x1a0630), cloth:P(0x4a3a55, 0x14062a), plate:P(0x5d5b68), dark:P(0x262230), glowM:P(0x8a3fd0, 0x7a2fd0)};

function buildFig(type){
  let r;
  const soldier = o => {
    r = rig(Object.assign({skin:H.skin, cloth:H.fat, pants:H.pants, armLen:1.2}, o));
    if(o.helmet !== false) part(G.ico1, o.helmM || H.helm, r.hr * 1.22, r.hr * .86, r.hr * 1.25, 0, r.hr * 1.38, -.01, r.neck);
    if(o.vest !== false) part(G.box, o.vestM || H.vest, .7 * r.s * (o.w || 1), .4 * r.s, .46 * r.s, 0, r.th * .58, 0, r.torso);
  };
  const reach = (arm, x, y, z) => { const d = new T.Vector3(x, y, z).sub(arm.position); const L = d.length(); arm.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), d.normalize()); arm.scale.y = Math.min(1.4, Math.max(.8, L / (r.al + .06))); };
  const longGun = (len, thick, pump) => {
    const gy = r.th * .5, gx = .1 * r.s, gz = .16;
    const g = new T.Group(); g.position.set(gx, gy, gz); g.rotation.x = .08; r.torso.add(g);
    part(G.box, H.gun, .09 * thick, .11 * thick, len, 0, 0, len * .5, g);
    part(G.box, H.gun, .11, .15, .26, 0, -.03, -.02, g);
    part(G.box, H.gun, .07, .2, .09, 0, -.13, len * .28, g);
    if(pump) part(G.box, H.metal, .14, .14, .24, 0, -.03, len * .62, g);
    reach(r.arms[1], gx + .02, gy - .07, gz + len * .28); reach(r.arms[0], gx - .03, gy - .06, gz + len * .6);
  };
  switch(type){
    case "joel":
      soldier({cloth:P(0x3d4b49), helmet:false});
      part(G.cyl, P(0x262b29), r.hr * 1.05, r.hr * .55, r.hr * 1.05, 0, r.hr * 1.75, 0, r.neck);
      part(G.box, P(0x262b29), r.hr * 1.6, r.hr * .12, r.hr * 1.1, 0, r.hr * 1.55, r.hr * .9, r.neck);
      part(G.box, P(C.gold, 0x3a2a08), .56, .14, .44, 0, r.th - .02, 0, r.torso);
      longGun(1.0, 1); break;
    case "rifle":
      soldier({}); longGun(1.05, 1); part(G.box, P(0x3e4a45), .42, .4, .2, 0, r.th * .55, -.3, r.torso); break;
    case "breacher":
      soldier({w:1.18, vestM:P(0x1e2624)});
      [-1, 1].forEach(s => part(G.box, P(0x2d3834), .26, .14, .36, s * .42, r.th - .02, 0, r.torso));
      part(G.box, P(0x101414), .3, .08, .05, 0, r.hr * 1.1, r.hr * 1.05, r.neck);
      longGun(.78, 1.5, true); break;
    case "scout":
      soldier({w:.9, cloth:P(0x4a5a53), helmet:false, vest:false});
      part(G.ico1, P(0x46574f), r.hr * 1.3, r.hr * 1.1, r.hr * 1.35, 0, r.hr * 1.2, -.05, r.neck);
      part(G.box, P(0x46574f), .78, .5, .5, 0, r.th * .62, -.02, r.torso);
      part(G.box, P(0x4a5450), .5, .62, .3, 0, r.th * .55, -.36, r.torso);
      longGun(.6, 1); break;
    case "medic": {
      soldier({cloth:P(0x60736f)});
      part(G.box, P(0xdfe5e2), .5, .56, .26, 0, r.th * .55, -.34, r.torso);
      const cm = P(C.human, 0x0d5a3c);
      part(G.box, cm, .1, .34, .03, 0, r.th * .6, -.48, r.torso); part(G.box, cm, .32, .1, .03, 0, r.th * .6, -.48, r.torso);
      part(G.box, cm, .1, .02, .3, 0, r.th * .55 + .29, -.34, r.torso); part(G.box, cm, .3, .02, .1, 0, r.th * .55 + .29, -.34, r.torso);
      r.arms[1].rotation.set(-1.0, 0, .2); r.arms[0].rotation.set(-.9, 0, -.25);
      part(G.box, P(0xdfe5e2), .3, .2, .14, 0, -r.al - .12, 0, r.arms[1]); break; }
    case "civ":
      r = rig({skin:H.skin, cloth:P(0x8fa5b1), pants:P(0x3a4552), w:.92});
      part(G.ico, P(0x2b2523), r.hr * 1.08, r.hr * .75, r.hr * 1.1, 0, r.hr * 1.45, -.03, r.neck);
      r.arms[0].rotation.set(-2.5, 0, -.35); r.arms[1].rotation.set(-2.6, 0, .35); break;
    case "shambler":
      r = rig({skin:I.skin, cloth:I.cloth, pants:I.pants});
      r.torso.rotation.x = .35; r.neck.rotation.set(.25, 0, .35);
      r.arms[0].rotation.set(-1.55, 0, -.1); r.arms[1].rotation.set(-1.15, 0, .2);
      part(G.box, I.rag, .2, .3, .05, .15, -.05, .2, r.torso, .3, 0, .2); eyes(r, 0xff2a1a); break;
    case "runner":
      r = rig({skin:I.skin, cloth:I.cloth, pants:I.pants, w:.84});
      r.torso.rotation.x = .75; r.neck.rotation.x = -.5;
      r.arms[0].rotation.set(1.0, 0, -.25); r.arms[1].rotation.set(.8, 0, .25); eyes(r, 0xff2a1a); break;
    case "crawler":
      r = rig({skin:I.skin, cloth:I.cloth, pants:I.pants, torsoH:.85});
      r.legs.forEach(l => l.children.length = 0);
      r.body.rotation.x = Math.PI / 2; r.body.position.set(0, .2, -.45); r.neck.rotation.x = -.6;
      r.arms[0].rotation.set(-2.7, 0, -.35); r.arms[1].rotation.set(-2.9, 0, .35); eyes(r, 0xff2a1a);
      part(G.box, I.rag, .3, .08, .5, 0, .05, -.55, r.root); break;
    case "screamer":
      r = rig({skin:I.skin, cloth:I.cloth, pants:I.pants, w:.8, armLen:1.15});
      r.neck.rotation.x = -.7; r.torso.rotation.x = -.12;
      r.arms[0].rotation.set(-.4, 0, -1.25); r.arms[1].rotation.set(-.4, 0, 1.25);
      part(G.box, P(0x0a0606, 0x3a0000), r.hr * .6, r.hr * .55, r.hr * .2, 0, r.hr * .85, r.hr * .95, r.neck); eyes(r, 0xff2a1a); break;
    case "armoured":
      r = rig({skin:E.skin, cloth:E.cloth, pants:E.dark, s:1.22, w:1.3, armW:1.4});
      part(G.box, E.plate, .9 * 1.22, .5, .55 * 1.22, 0, r.th * .6, .02, r.torso);
      [-1, 1].forEach(s => part(G.box, E.plate, .4, .2, .5, s * .55, r.th + .02, 0, r.torso, 0, 0, s * .25));
      part(G.ico1, E.plate, r.hr * 1.3, r.hr * 1.05, r.hr * 1.3, 0, r.hr * 1.25, 0, r.neck);
      part(G.box, E.glowM, r.hr * 1.4, r.hr * .16, .04, 0, r.hr * 1.1, r.hr * 1.25, r.neck);
      r.torso.rotation.x = .15; r.arms[0].rotation.set(-.7, 0, -.2); r.arms[1].rotation.set(-.9, 0, .2); break;
    case "bloater":
      r = rig({skin:E.skin, cloth:E.cloth, pants:E.dark, s:1.25, torsoBox:false, headS:.7, armLen:.7, legLen:.8});
      part(G.ico1, E.skin, .95, .85, .9, 0, .55, .05, r.torso);
      [[.5, .9, .5], [-.6, .6, .4], [.2, .3, .85], [-.3, 1.1, .3], [.7, .4, -.3], [-.5, .3, -.55], [0, 1.2, -.3]].forEach(p => part(G.ico, E.glowM, .2, .2, .2, p[0], p[1], p[2], r.torso));
      r.neck.position.y = 1.25; r.arms.forEach((a, i) => { a.position.x = (i ? 1 : -1) * .95; a.rotation.set(-.4, 0, (i ? 1 : -1) * .5); }); break;
  }
  bake(r.root, [r.root, r.body, r.torso, r.legs[0], r.legs[1], r.arms[0], r.arms[1]]);
  return r.root;
}
const LIT = new T.MeshLambertMaterial({vertexColors:true}), UNLIT = new T.MeshBasicMaterial({vertexColors:true});
function bake(root, pivots){
  root.updateMatrixWorld(true);
  const isPivot = new Set(pivots), inv = new T.Matrix4(), mm = new T.Matrix4(), col = new T.Color();
  pivots.forEach(pv => {
    const lit = {p:[], n:[], c:[]}, un = {p:[], n:[], c:[]}, kill = [];
    const walk = o => o.children.forEach(ch => { if(isPivot.has(ch)) return; if(ch.isMesh) kill.push(ch); walk(ch); });
    walk(pv); inv.copy(pv.matrixWorld).invert();
    kill.forEach(mesh => {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      mm.multiplyMatrices(inv, mesh.matrixWorld); g.applyMatrix4(mm);
      const mat = mesh.userData.mat, e = mat.emissive, glow = e.r + e.g + e.b > .45, d = glow ? un : lit;
      col.copy(mat.color).add(e);
      const pa = g.attributes.position.array, na = g.attributes.normal.array;
      for(let i = 0; i < pa.length; i++){ d.p.push(pa[i]); d.n.push(na[i]); }
      for(let i = 0; i < pa.length / 3; i++) d.c.push(col.r, col.g, col.b);
      g.dispose();
    });
    kill.forEach(mesh => mesh.parent.remove(mesh));
    [[lit, LIT], [un, UNLIT]].forEach(([d, mat]) => { if(!d.p.length) return; const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(d.p, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(d.n, 3)); g.setAttribute("color", new T.Float32BufferAttribute(d.c, 3));
      g.computeBoundingSphere(); pv.add(new T.Mesh(g, mat)); });
  });
}
const FIG = {};
function cloneFig(type){
  const root = (FIG[type] || (FIG[type] = buildFig(type))).clone(true);
  const n = k => root.getObjectByName(k);
  return {root, body:n("body"), torso:n("torso"), legs:[n("legL"), n("legR")], arms:[n("armL"), n("armR")]};
}

/* ---------- entity views (pooled) ---------- */
const BASE_R = {joel:1.05, rifle:1, breacher:1.05, scout:1, medic:1, civ:.95, shambler:1, runner:.95, crawler:.85, screamer:1, armoured:1.4, bloater:1.6};
const KIND = {joel:"human", rifle:"human", breacher:"human", scout:"human", medic:"human", civ:"civ", shambler:"inf", runner:"inf", crawler:"inf", screamer:"inf", armoured:"elite", bloater:"elite"};
const SHADOW_M = new T.MeshBasicMaterial({map:TX.glow, color:0x000000, transparent:true, opacity:.8, depthWrite:false});
const HAZE_M = B(C.inf, .22, true); HAZE_M.map = TX.glow;
const GLOW_M = B(C.elite, .6, true); GLOW_M.map = TX.glow;
const DASH_M = B(C.civ, 1);
const CONE_M = new T.MeshBasicMaterial({color:0x7dffd0, vertexColors:true, transparent:true, opacity:.8, depthWrite:false, blending:T.AdditiveBlending, side:T.DoubleSide});
const PULSE_M = B(C.down, 1), PULSE2_M = B(C.down, .95), POOL_M = B(C.down, .2);
const GHOST_M = [B(C.inf, .18, true), B(C.inf, .1, true), B(C.inf, .05, true)];
const SCREAM_M = [B(C.inf, .8), B(C.inf, .8)], LURK_M = B(0xd6ad55, .8), FOCUS_M = B(C.cyan, 1);
const RETICLE_M = B(0xffffff, 1); RETICLE_M.map = TX.reticle;
function flat(geo, mat, s, y, ro, parent){ const m = new T.Mesh(geo, mat); m.scale.setScalar(s); m.position.y = y; m.renderOrder = ro || 2; parent.add(m); return m; }
function Ent(type){
  this.type = type; this.kind = KIND[type]; this.root = new T.Group();
  const f = cloneFig(type); this.fig = f; this.root.add(f.root);
  const r = BASE_R[type] || 1; this.r = r;
  const sh = new T.Mesh(G.plane, SHADOW_M); sh.scale.set(r * 2.2, 1, r * 2.2); sh.position.y = .04; sh.renderOrder = 1; this.root.add(sh);
  if(this.kind === "inf"){ const m = new T.Mesh(G.plane, HAZE_M); m.scale.set(r * 2.6, 1, r * 2.6); m.position.y = .05; m.renderOrder = 1; this.root.add(m); }
  if(this.kind === "elite"){ const m = new T.Mesh(G.plane, GLOW_M); m.scale.set(r * 3.4, 1, r * 3.4); m.position.y = .05; m.renderOrder = 1; this.root.add(m); }
  if(this.kind === "civ") flat(BG.dash, DASH_M, r, .08, 2, this.root);
  if(this.kind === "human"){ this.cone = new T.Mesh(BG.cone, CONE_M); this.cone.position.y = .08; this.cone.renderOrder = 1; f.root.add(this.cone);
    this.drop = sprite(SM.drop, .8, 2.45); this.root.add(this.drop); }
  const ic = {joel:SM.star, armoured:SM.shield, bloater:SM.burst, screamer:SM.waves}[type];
  if(ic){ this.icon = sprite(ic, type === "joel" ? 1.05 : 1.2, type === "bloater" ? 3.5 : type === "armoured" ? 3.2 : 2.7); this.root.add(this.icon); this.iconY = this.icon.position.y; }
  if(type === "joel"){ this.reticle = new T.Mesh(G.plane, RETICLE_M); this.reticle.scale.set(3.6, 1, 3.6); this.reticle.position.y = .1; this.reticle.renderOrder = 4; this.root.add(this.reticle); }
  if(type === "runner"){ this.ghosts = new T.Group(); GHOST_M.forEach((gm, i) => { const gh = FIG.runner.clone(true); gh.traverse(o => { if(o.isMesh){ o.material = gm; o.renderOrder = 1; } });
      const lg = gh.getObjectByName("legL"), lr = gh.getObjectByName("legR"); lg.rotation.x = i % 2 ? .8 : -.8; lr.rotation.x = -lg.rotation.x;
      gh.position.set(0, 0, -.62 * (i + 1)); this.ghosts.add(gh); }); f.root.add(this.ghosts); }
  if(type === "screamer") this.waves = [flat(BG.thin, SCREAM_M[0], 1, .09, 3, this.root), flat(BG.thin, SCREAM_M[1], 1, .09, 3, this.root)];
  if(type === "crawler") this.lurk = flat(BG.thin, LURK_M, 1.6, .09, 3, this.root);
  this.focus = flat(BG.thin, FOCUS_M, r * 1.5, .1, 3, this.root);
  this.px = 0; this.py = 0; this.face = 0; this.moveT = -9; this.ph = R(0, 6.28); this.frame = 0; this.down = false;
}
Ent.prototype.setDown = function(on){
  if(on === this.down) return; this.down = on; const b = this.fig.body;
  if(on){ b.rotation.x = -Math.PI / 2; b.position.set(0, .26, .75);
    if(!this.pulse){ this.pool = flat(BG.disc, POOL_M, 2.4, .03, 1, this.root); this.pulse = flat(BG.thin, PULSE_M, 1.4, .07, 3, this.root); this.pulse2 = flat(BG.ring, PULSE2_M, 1.45, .065, 3, this.root); } }
  else { b.rotation.x = 0; b.position.set(0, 0, 0); }
  if(this.pulse){ this.pool.visible = this.pulse.visible = this.pulse2.visible = on; }
  if(this.cone) this.cone.visible = !on;
};

/* ---------- the view ---------- */
function View(canvas){
  const gl = new T.WebGLRenderer({canvas, antialias:true, powerPreference:"high-performance"});
  this.r = gl; gl.setPixelRatio(1); gl.setClearColor(0x111916);
  gl.shadowMap.enabled = true; gl.shadowMap.type = T.PCFSoftShadowMap; gl.shadowMap.autoUpdate = false;
  this.canvas = canvas; this.scene = new T.Scene(); this.key = null; this.bw = 0; this.bh = 0; this.cs = 1; this.us = 13;
  this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 10, 3000);
  this.mapG = new T.Group(); this.dynG = new T.Group(); this.fxG = new T.Group(); this.scene.add(this.mapG, this.dynG, this.fxG);
  this.live = new Map(); this.pools = {}; this.skulls = new Map(); this.skullPool = []; this.frame = 0; this.last = performance.now() / 1000;
  this.tv = new T.Vector3(); this.tv2 = new T.Vector3(); this.colCache = new Map();
  // lights (per map preset)
  this.hemi = new T.HemisphereLight(0xb0bcb8, 0x121413, .5); this.sun = new T.DirectionalLight(0xe6ecea, .7);
  this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
  Object.assign(this.sun.shadow.camera, {left:-720, right:720, top:520, bottom:-520, near:50, far:2400}); this.sun.shadow.bias = -.0008; this.sun.shadow.radius = 3;
  this.lampA = new T.PointLight(0xcfe6ff, 1, 340, 2); this.lampB = new T.PointLight(0xff3020, 1.2, 180, 2);
  this.scene.add(this.hemi, this.sun, this.sun.target, this.lampA, this.lampB);
  this.buildFx();
}
View.prototype.buildFx = function(){
  const fx = this.fxG;
  this.tracers = []; for(let i = 0; i < 28; i++){ const m = new T.Mesh(G.box, B(0xffe9a8, 0, true)); m.renderOrder = 5; m.visible = false; fx.add(m); this.tracers.push(m); }
  this.blasts = []; for(let i = 0; i < 8; i++){ const m = new T.Mesh(G.plane, B(C.elite, 0, true)); m.material.map = TX.glow; m.renderOrder = 6; m.visible = false; fx.add(m);
    const ring = new T.Mesh(BG.thin, B(C.inf, 0)); ring.renderOrder = 6; ring.visible = false; fx.add(ring);
    const ts = new TextSprite(256, 64, "800 44px ui-monospace, Menlo, monospace"); ts.sprite.visible = false; fx.add(ts.sprite); this.blasts.push({m, ring, ts}); }
  const N = 256; this.pGeo = new T.BufferGeometry(); this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3);
  this.pGeo.setAttribute("position", new T.BufferAttribute(this.pPos, 3)); this.pGeo.setAttribute("color", new T.BufferAttribute(this.pCol, 3)); this.pGeo.setDrawRange(0, 0);
  this.pts = new T.Points(this.pGeo, new T.PointsMaterial({size:4, sizeAttenuation:false, vertexColors:true, transparent:true, depthWrite:false})); this.pts.frustumCulled = false; this.pts.renderOrder = 7; fx.add(this.pts);
  this.bubble = sprite(SM.bubble, 1, 0); this.bubble.visible = false; fx.add(this.bubble);
  this.squadRing = new T.Mesh(BG.squad, B(C.cyan, .35)); this.squadRing.scale.setScalar(48); this.squadRing.position.y = 1; this.squadRing.renderOrder = 2; fx.add(this.squadRing);
};
View.prototype.col = function(s){ let c = this.colCache.get(s); if(!c){ c = new T.Color(s.slice(0, 7)); this.colCache.set(s, c); } return c; };

/* ---------- maps ---------- */
const FLOORS = {
  shop:["#434644", "#474a48", "#3c3f3d", "#414442", "#383c3a", "#3a3c3a"],
  cold:["#3e4446", "#42484a", "#4b5459", "#3f4446", "#383d3e", "#465055"],
  night:["#3b3a33", "#403f3a", "#3b3d3a", "#3d3f3d", "#383a38", "#363733"]
};
const CONCRETE = {shop:[0, 0, 1, 0, 0, 1], cold:[0, 1, 0, 1, 1, 0], night:[1, 1, 0, 0, 1, 1]};
function paintFloor(s, key){
  const W = s.W, Hh = s.H, cw = 2048, ch = 1024, sx = cw / W, sz = ch / Hh;
  const c = document.createElement("canvas"); c.width = cw; c.height = ch; const x = c.getContext("2d");
  x.setTransform(sx, 0, 0, sz, 0, 0);
  x.fillStyle = "#111916"; x.fillRect(0, 0, W, Hh);
  for(let k = 0; k < 120; k++){ x.fillStyle = `rgba(${rnd() < .5 ? "0,0,0" : "60,66,62"},${R(.2, .5)})`; x.beginPath(); x.ellipse(R(0, W), R(0, Hh), R(2, 9), R(2, 7), R(0, 3), 0, 7); x.fill(); }
  const cols = FLOORS[key] || FLOORS.shop;
  s.rooms.forEach((rm, i) => {
    x.fillStyle = cols[i]; x.fillRect(rm.x - 2, rm.y - 2, rm.w + 4, rm.h + 4);
    x.save(); x.beginPath(); x.rect(rm.x, rm.y, rm.w, rm.h); x.clip();
    for(let k = 0; k < 14; k++){ const px = R(rm.x, rm.x + rm.w), pz = R(rm.y, rm.y + rm.h), rr = R(50, 140); const g = x.createRadialGradient(px, pz, 0, px, pz, rr); const lt = rnd() < .45;
      g.addColorStop(0, lt ? `rgba(200,204,198,${R(.025, .05)})` : `rgba(8,10,9,${R(.05, .1)})`); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(px - rr, pz - rr, rr * 2, rr * 2); }
    for(let k = 0; k < 4; k++){ x.save(); x.translate(R(rm.x + 20, rm.x + rm.w - 20), R(rm.y + 20, rm.y + rm.h - 20)); x.rotate(R(-.05, .05)); x.fillStyle = `rgba(${rnd() < .5 ? "0,0,0" : "210,212,206"},${R(.025, .045)})`; x.fillRect(0, 0, R(30, 80), R(20, 60)); x.restore(); }
    if((CONCRETE[key] || CONCRETE.shop)[i]){ x.strokeStyle = "rgba(0,0,0,.09)"; x.lineWidth = .5; x.beginPath(); for(let a = rm.x + 80; a < rm.x + rm.w; a += 80){ x.moveTo(a, rm.y); x.lineTo(a + R(-3, 3), rm.y + rm.h); } x.stroke(); }
    if(key === "cold" && (i === 2 || i === 5)) for(let k = 0; k < 10; k++){ const px = R(rm.x, rm.x + rm.w), pz = R(rm.y, rm.y + rm.h), rr = R(20, 60); const g = x.createRadialGradient(px, pz, 0, px, pz, rr); g.addColorStop(0, "rgba(190,215,230,.07)"); g.addColorStop(1, "rgba(190,215,230,0)"); x.fillStyle = g; x.fillRect(px - rr, pz - rr, rr * 2, rr * 2); }
    if(key === "night" && i < 2) for(let k = 0; k < 400; k++){ x.fillStyle = `rgba(${rnd() < .5 ? "20,20,16" : "120,116,100"},${R(.08, .2)})`; x.fillRect(R(rm.x, rm.x + rm.w), R(rm.y, rm.y + rm.h), R(1, 3), R(1, 3)); }
    x.restore();
  });
  for(let k = 0; k < 70; k++){ const px = R(0, W), pz = R(0, Hh), rr = R(12, 45); const g = x.createRadialGradient(px, pz, 0, px, pz, rr); g.addColorStop(0, `rgba(14,15,13,${R(.08, .18)})`); g.addColorStop(.6, `rgba(14,15,13,${R(.03, .07)})`); g.addColorStop(1, "rgba(14,15,13,0)"); x.fillStyle = g; x.beginPath(); x.ellipse(px, pz, rr, rr * R(.5, 1), R(0, 3), 0, 7); x.fill(); }
  x.strokeStyle = "rgba(15,16,16,.28)"; x.lineWidth = .6;
  for(let k = 0; k < 18; k++){ let px = R(0, W), pz = R(0, Hh), a = R(0, 6.3); x.beginPath(); x.moveTo(px, pz); const n = R(4, 10) | 0; for(let i = 0; i < n; i++){ a += R(-.7, .7); px += Math.cos(a) * R(4, 12); pz += Math.sin(a) * R(4, 12); x.lineTo(px, pz); } x.stroke(); }
  for(let k = 0; k < 50; k++){ x.save(); x.translate(R(40, W - 40), R(40, Hh - 40)); x.rotate(R(0, 6.3)); x.fillStyle = `rgba(190,190,182,${R(.1, .22)})`; x.fillRect(-3, -2, R(3.5, 7), R(2.5, 5)); x.restore(); }
  const blood = (px, pz, rr, n) => { for(let i = 0; i < n; i++){ const a = R(0, 6.3), d = i ? R(0, rr * 1.4) : 0, sz2 = i ? R(1, rr * .45) : rr; x.fillStyle = `rgba(${R(70, 105) | 0},${R(10, 18) | 0},${R(10, 16) | 0},${R(.6, .85)})`; x.beginPath(); x.ellipse(px + Math.cos(a) * d, pz + Math.sin(a) * d, sz2, sz2 * R(.6, 1), R(0, 3), 0, 7); x.fill(); } };
  blood(330, 150, 10, 10); blood(560, 285, 9, 8); blood(1045, 465, 11, 9); blood(120, 210, 8, 7);
  if(key === "shop" || key === "cold"){ x.save(); x.beginPath(); x.rect(760, 374, 240, 10); x.clip(); x.fillStyle = "rgba(150,142,98,.35)"; for(let a = 740; a < 1010; a += 12){ x.beginPath(); x.moveTo(a, 374); x.lineTo(a + 6, 374); x.lineTo(a + 17, 384); x.lineTo(a + 11, 384); x.fill(); } x.restore(); }
  // room names, stencilled
  x.textBaseline = "top";
  s.rooms.forEach((rm, i) => { x.save(); x.translate(rm.x + 14, rm.y + 10); x.scale(.5, .5); x.font = "800 40px ui-monospace, Menlo, Consolas, monospace"; x.fillStyle = "rgba(225,228,222,.32)"; x.fillText((s.labels ? s.labels[i] : rm.label), 0, 0); x.restore(); });
  x.save(); x.translate(64, 592); x.scale(.5, .5); x.font = "800 40px ui-monospace, Menlo, Consolas, monospace"; x.fillStyle = "rgba(141,187,114,.6)"; x.fillText("ENTRY", 0, 0); x.restore();
  const tx = new T.CanvasTexture(c); return tx;
}
View.prototype.buildMap = function(s){
  const key = s.key; seed = key === "shop" ? 7 : key === "cold" ? 31 : 77;
  const shared = new Set(Object.values(G).concat(Object.values(BG))); this.mapG.children.slice().forEach(o => { this.mapG.remove(o); if(o.isInstancedMesh) o.dispose(); if(o.userData.own){ if(!shared.has(o.geometry)) o.geometry.dispose(); if(o.material.map && o.material.map !== TX.glow) o.material.map.dispose(); o.material.dispose(); } });
  const W = s.W, Hh = s.H, g = this.mapG;
  const floor = new T.Mesh(new T.PlaneGeometry(W, Hh).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({map:paintFloor(s, key)}));
  floor.position.set(W / 2, 0, Hh / 2); floor.receiveShadow = true; floor.userData.own = true; g.add(floor);
  // walls: raster the map at 5 units: inside the outer box, outside every room, outside every opening
  const CS = 5, nx = Math.ceil(W / CS), ny = Math.ceil(Hh / CS), wall = new Uint8Array(nx * ny);
  const rooms = s.rooms, open = [];
  s.doors.forEach(d => open.push(d.axis === "v" ? [d.x - 16, d.y - 22, d.x + 16, d.y + 22] : [d.x - 22, d.y - 16, d.x + 22, d.y + 16]));
  s.edges.forEach(e => { const r = rooms[e.room]; open.push(e.room === 0 ? [e.x - 22, r.y - 16, e.x + 22, r.y + 2] : [r.x + r.w - 2, e.y - 22, r.x + r.w + 16, e.y + 22]); });
  open.push([18, 438, 38, 482]); // the entry
  const ox0 = 23, oy0 = 33, ox1 = 1072, oy1 = 642, inR = (px, py) => rooms.some(r => px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h);
  const inO = (px, py) => open.some(o => px > o[0] && px < o[2] && py > o[1] && py < o[3]);
  for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++){ const px = i * CS + CS / 2, py = j * CS + CS / 2; if(px > ox0 && px < ox1 && py > oy0 && py < oy1 && !inR(px, py) && !inO(px, py)) wall[j * nx + i] = 1; }
  // merge into rectangles: row runs, then equal runs down
  const rects = [], used = new Uint8Array(nx * ny);
  for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++){
    if(!wall[j * nx + i] || used[j * nx + i]) continue;
    let i2 = i; while(i2 + 1 < nx && wall[j * nx + i2 + 1] && !used[j * nx + i2 + 1]) i2++;
    let j2 = j; outer: while(j2 + 1 < ny){ for(let k = i; k <= i2; k++) if(!wall[(j2 + 1) * nx + k] || used[(j2 + 1) * nx + k]) break outer; j2++; }
    for(let jj = j; jj <= j2; jj++) for(let k = i; k <= i2; k++) used[jj * nx + k] = 1;
    rects.push([i * CS, j * CS, (i2 + 1) * CS, (j2 + 1) * CS]);
  }
  const breach = s.edges.map(e => { const r = rooms[e.room]; return e.room === 0 ? [e.x, r.y] : [r.x + r.w, e.y]; }).concat([[28, 460]]);
  const chunks = [];
  rects.forEach(([x0, y0, x1, y1]) => { const horiz = x1 - x0 >= y1 - y0, L = horiz ? x1 - x0 : y1 - y0, n = Math.max(1, Math.round(L / 26));
    for(let k = 0; k < n; k++){ const a = (horiz ? x0 : y0) + L * k / n, b = (horiz ? x0 : y0) + L * (k + 1) / n;
      const cx = horiz ? (a + b) / 2 : (x0 + x1) / 2, cz = horiz ? (y0 + y1) / 2 : (a + b) / 2;
      let near = 999; breach.forEach(p => near = Math.min(near, Math.hypot(p[0] - cx, p[1] - cz)));
      const h = 26 * (near < 60 ? R(.35, .85) : R(.9, 1.02));
      chunks.push([cx, cz, horiz ? b - a + .2 : x1 - x0, horiz ? y1 - y0 : b - a + .2, h]); } });
  const wm = new T.InstancedMesh(G.box, PM(0x2c2f2e), chunks.length), cm = new T.InstancedMesh(G.box, PM(0x9a9e9b), chunks.length);
  const mx = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3();
  chunks.forEach((c, i) => { mx.compose(v.set(c[0], c[4] / 2, c[1]), q, sc.set(c[2], c[4], c[3])); wm.setMatrixAt(i, mx); mx.compose(v.set(c[0], c[4] + .6, c[1]), q, sc.set(c[2] + 1.2, 1.2, c[3] + 1.2)); cm.setMatrixAt(i, mx); });
  wm.castShadow = wm.receiveShadow = true; cm.castShadow = true; g.add(wm, cm);
  // props: one list per map
  const props = [];
  const box = (x0, z0, x1, z1, h, hex, ry, y0) => { props.push([(x0 + x1) / 2, (y0 || 0) + h / 2, (z0 + z1) / 2, Math.abs(x1 - x0), h, Math.abs(z1 - z0), ry || 0, hex]); };
  const shelf = (x0, z0, x1, z1, h, hex) => { box(x0, z0, x1, z1, h || 15, hex || 0x585c5a); const along = x1 - x0 > z1 - z0, L = along ? x1 - x0 : z1 - z0;
    for(let i = 0; i < L / 7; i++){ if(rnd() < .45) continue; const px = along ? x0 + R(2, L - 2) : R(x0 + 1, x1 - 1), pz = along ? R(z0 + 1, z1 - 1) : z0 + R(2, L - 2); box(px - 1.8, pz - 1.5, px + 1.8, pz + 1.5, R(2.5, 5), [0x7d807e, 0x6a706c, 0x8a8a84, 0x5f6662][i % 4], R(0, 1), h || 15); } };
  const crates = (list) => list.forEach((p, i) => box(p[0], p[1], p[0] + 20, p[1] + 20, i % 3 ? 14 : 24, i % 2 ? 0x6e6455 : 0x62594c));
  const cyl = (px, pz, r, h, hex) => props.push([px, h / 2, pz, r, h, r, 0, hex, 1]);
  if(key === "shop"){
    shelf(50, 80, 150, 92); shelf(50, 125, 150, 137); box(70, 205, 170, 218, 9, 0x4f5351, .42);
    box(230, 52, 310, 72, 12, 0x7b807d); box(232, 53, 308, 71, .6, 0x9aa3a6, 0, 12);
    box(590, 60, 606, 175, 12, 0x6f7370); box(520, 175, 606, 191, 12, 0x6f7370); box(592, 80, 604, 92, 5, 0x2a2e2d, 0, 12); box(592, 130, 604, 142, 5, 0x2a2e2d, 0, 12);
    box(475, 52, 555, 63, 14, 0x535856); for(let z = 70; z < 250; z += 36) box(650, z, 664, z + 32, 20, 0x4b5250);
    crates([[700, 95], [722, 95], [700, 117], [744, 95], [700, 210], [722, 232]]); box(780, 200, 820, 240, 3, 0x5a5246); box(782, 202, 800, 220, 13, 0x6e6455);
    box(830, 48, 935, 62, 20, 0x585c5a);
    shelf(300, 340, 316, 570); shelf(355, 340, 371, 570); shelf(60, 318, 240, 332); shelf(60, 368, 240, 382); box(90, 520, 200, 533, 9, 0x4f5351, -.3);
    box(255, 585, 269, 605, 9, 0x868b88, .5); box(282, 600, 296, 620, 9, 0x868b88, 1.5);
    [[470, 335, 560, 367], [590, 335, 680, 367], [470, 430, 560, 462], [590, 430, 680, 462]].forEach((d, i) => { box(d[0], d[1], d[2], d[3], 10, 0x5b524a, i === 2 ? .1 : 0); box(d[0] + 12 + i * 6, d[3] + 4, d[0] + 24 + i * 6, d[3] + 16, 7, 0x2f3432, R(0, 1)); box(d[0] + 15, d[1] + 5, d[0] + 27, d[1] + 13, 4.5, 0x2a2e2d, 0, 10); });
    box(688, 300, 700, 380, 19, 0x5d6462); box(450, 600, 470, 620, 12, 0x3b403e);
    box(760, 350, 1000, 374, 8, 0x575a57);
    crates([[750, 400], [772, 400], [750, 422], [990, 520], [1012, 520], [990, 542], [800, 580]]);
    box(905, 420, 935, 470, 14, 0x77735f); box(907, 469, 933, 473, 32, 0x3a3d3c); box(909, 445, 931, 465, 9, 0x2a2e2d, 0, 14);
  } else if(key === "cold"){
    box(60, 110, 160, 140, 10, 0x5b524a); box(90, 145, 102, 157, 7, 0x2f3432, .4); box(300, 55, 325, 140, 19, 0x5d6462); for(let xx = 50; xx < 160; xx += 22) box(xx, 235, xx + 20, 255, 22, 0x4f5a5e);
    [90, 200].forEach(z => { box(380, z, 640, z + 22, 9, 0x3d4244); for(let xx = 384; xx < 640; xx += 12) box(xx, z + 1, xx + 4, z + 21, .6, 0x6a7072, 0, 9); });
    crates([[400, 135], [430, 140], [600, 135]]);
    [[700, 90], [700, 150], [790, 90], [790, 150]].forEach(p => { box(p[0], p[1], p[0] + 70, p[1] + 34, 13, 0xb7c3c8); box(p[0] + 3, p[1] + 3, p[0] + 67, p[1] + 31, .6, 0x8fa2ab, 0, 13); });
    box(705, 222, 900, 238, 22, 0x8f9da3); for(let xx = 712; xx < 900; xx += 26) cyl(xx, 230, 3, 3, 0xd0d8dc);
    shelf(300, 340, 316, 570, 26, 0x7a6248); shelf(355, 340, 371, 570, 26, 0x7a6248); shelf(60, 318, 240, 332, 22, 0x7a6248);
    crates([[70, 380], [92, 380], [70, 402], [150, 520], [172, 520], [80, 560]]);
    box(455, 610, 695, 620, 6, 0x4b5050); box(455, 335, 465, 620, 6, 0x4b5050); cyl(520, 520, 28, 34, 0x6b7476); cyl(640, 560, 22, 28, 0x6b7476);
    box(560, 360, 600, 395, 16, 0x56605e); box(620, 360, 660, 395, 16, 0x56605e); cyl(580, 450, 6, 30, 0x5d6462);
    [[760, 350], [840, 350], [920, 350]].forEach(p => { box(p[0], p[1], p[0] + 70, p[1] + 34, 13, 0xb7c3c8); box(p[0] + 3, p[1] + 3, p[0] + 67, p[1] + 31, .6, 0x8fa2ab, 0, 13); });
    box(905, 440, 935, 490, 14, 0x77735f); box(907, 489, 933, 493, 32, 0x3a3d3c); crates([[990, 520], [1012, 520], [990, 542], [800, 580]]);
  } else {
    for(let xx = 60; xx < 320; xx += 18) box(xx, 90, xx + 16, 100, 7, 0x6b6656, R(-.1, .1));
    cyl(90, 140, 9, 16, 0x4a524e); cyl(110, 150, 9, 16, 0x5c4a3c); cyl(270, 220, 12, 4, 0x1e1f1e); cyl(270, 220, 6, 5, 0x1e1f1e);
    cyl(512, 160, 16, 3, 0x4d4a44); this.fire = [512, 160];
    box(420, 120, 470, 132, 6, 0x5b524a); box(560, 220, 620, 232, 6, 0x5b524a); cyl(630, 80, 18, 30, 0x55605c); box(380, 100, 440, 140, .8, 0x4a5547, .2, 16);
    for(let i = 0; i < 4; i++){ box(705 + i * 50, 95, 745 + i * 50, 135, 8, 0x55605c); box(708 + i * 50, 98, 742 + i * 50, 110, 2, 0x8c8a7e, 0, 8); }
    crates([[870, 200], [892, 200], [700, 200]]); for(let xx = 700; xx < 860; xx += 16) box(xx, 240, xx + 14, 250, 7, 0x6b6656);
    for(let z = 330; z < 600; z += 32) box(40, z, 54, z + 28, 22, 0x4f5a5e); box(150, 420, 260, 450, 9, 0x5b524a); box(150, 400, 260, 410, 5, 0x5b524a); box(150, 460, 260, 470, 5, 0x5b524a);
    box(470, 340, 600, 370, 11, 0x5b524a); box(620, 300, 690, 320, 14, 0x6a5f4f); box(480, 540, 530, 580, 14, 0x55605c); for(let i = 0; i < 12; i++){ const px = R(560, 680), pz = R(530, 610); box(px, pz, px + R(4, 12), pz + R(3, 9), R(2, 6), [0x5d6462, 0x6a5f4f, 0x4b4f4c][i % 3], R(0, 3)); }
    box(840, 500, 980, 570, 22, 0x4b4f4c, .05); box(980, 505, 1020, 565, 26, 0x3f4542, .05); box(850, 505, 970, 565, 1, 0x2a2e2d, .05, 22);
    [[760, 340], [778, 340], [760, 358], [1020, 360]].forEach(p => cyl(p[0], p[1], 8, 15, 0x6e3b2e)); [[780, 600], [800, 606], [1030, 420]].forEach(p => cyl(p[0], p[1], 10, 5, 0x1e1f1e));
  }
  if(props.length){
    const pm = new T.InstancedMesh(G.box, new T.MeshLambertMaterial({color:0xffffff}), props.filter(p => !p[8] && p[3] > 0).length);
    const cm2 = new T.InstancedMesh(G.cyl, new T.MeshLambertMaterial({color:0xffffff}), Math.max(1, props.filter(p => p[8]).length));
    const e = new T.Euler(), col = new T.Color(); let bi = 0, ci = 0;
    props.forEach(p => { if(!p[8] && !(p[3] > 0)) return; q.setFromEuler(e.set(0, p[6], 0)); mx.compose(v.set(p[0], p[1], p[2]), q, sc.set(p[3], p[4], p[5])); col.setHex(p[7]);
      if(p[8]){ cm2.setMatrixAt(ci, mx); cm2.setColorAt(ci++, col); } else { pm.setMatrixAt(bi, mx); pm.setColorAt(bi++, col); } });
    cm2.count = ci; pm.castShadow = pm.receiveShadow = cm2.castShadow = cm2.receiveShadow = true; g.add(pm, cm2);

  }
  // debris
  const N = 420, dm = new T.InstancedMesh(G.ico, new T.MeshLambertMaterial({color:0xffffff}), N), col = new T.Color(), eu = new T.Euler();
  for(let i = 0; i < N; i++){ const r = rooms[(rnd() * rooms.length) | 0]; let px, pz;
    if(rnd() < .6){ const side = (rnd() * 4) | 0; px = side < 2 ? R(r.x + 4, r.x + r.w - 4) : side === 2 ? R(r.x + 3, r.x + 22) : R(r.x + r.w - 22, r.x + r.w - 3); pz = side >= 2 ? R(r.y + 4, r.y + r.h - 4) : side === 0 ? R(r.y + 3, r.y + 22) : R(r.y + r.h - 22, r.y + r.h - 3); }
    else { px = R(r.x + 5, r.x + r.w - 5); pz = R(r.y + 5, r.y + r.h - 5); }
    const sz = R(.8, 3); mx.compose(v.set(px, sz * .4, pz), q.setFromEuler(eu.set(R(0, 3), R(0, 3), R(0, 3))), sc.set(sz * R(.8, 1.6), sz * R(.5, 1), sz * R(.8, 1.6))); dm.setMatrixAt(i, mx); const gg = R(.2, .4); dm.setColorAt(i, col.setRGB(gg, gg * 1.01, gg * .98)); }
  dm.castShadow = dm.receiveShadow = true; g.add(dm);
  // door-way glows: red where they come in, green for the entry
  const pool = (px, pz, hex, sz, op) => { const m = new T.Mesh(G.plane, B(hex, op, true)); m.material.map = TX.glow; m.scale.set(sz, 1, sz); m.position.set(px, .3, pz); m.userData.own = true; g.add(m); return m; };
  this.redPools = breach.slice(0, 3).map(p => pool(p[0], p[1], C.inf, 80, .4)); pool(28, 460, C.human, 80, .4);
  // per-room overlays: advance outline and the unseen fog
  this.roomFx = rooms.map(r => {
    const o = new T.Group(); const mat = B(C.cyan, .9); [[r.x + r.w / 2, r.y, r.w, 3], [r.x + r.w / 2, r.y + r.h, r.w, 3], [r.x, r.y + r.h / 2, 3, r.h], [r.x + r.w, r.y + r.h / 2, 3, r.h]].forEach(b => { const m = new T.Mesh(G.plane, mat); m.scale.set(b[2], 1, b[3]); m.position.set(b[0], 1.5, b[1]); m.renderOrder = 8; o.add(m); }); o.visible = false; g.add(o);
    const fog = new T.Mesh(G.plane, new T.MeshBasicMaterial({color:0x070c0b, transparent:true, opacity:.87, depthTest:false, depthWrite:false})); const fh = 40; fog.scale.set(r.w, 1, r.h); fog.position.set(r.x + r.w / 2, fh, r.y + r.h / 2 + fh * TAN); fog.renderOrder = 60; fog.userData.own = true; g.add(fog);
    const ts = new TextSprite(128, 128, "800 90px ui-monospace, Menlo, monospace"); ts.set("?", "#3d4a45"); ts.sprite.scale.set(60, 60, 1); ts.sprite.position.set(r.x + r.w / 2, fh + 1, r.y + r.h / 2 + (fh + 1) * TAN); ts.sprite.renderOrder = 61; g.add(ts.sprite);
    return {o, fog, q:ts.sprite};
  });
  // doors: planks when sealed, the countdown, and the tap ring when arming Seal
  this.doorFx = s.doors.map(d => {
    const o = new T.Group(); o.position.set(d.x, 0, d.y); if(d.axis === "v") o.rotation.y = Math.PI / 2;
    [-8, 0, 8].forEach((dz, i) => { const m = new T.Mesh(G.box, PM(i === 1 ? 0xb08a46 : 0x8a6c3a)); m.scale.set(50, 4, 3.4); m.position.set(0, 5 + i * 6, dz * .3); m.rotation.z = (i - 1) * .12; m.castShadow = false; o.add(m); });
    o.visible = false; g.add(o);
    const ts = new TextSprite(128, 64, "800 44px ui-monospace, Menlo, monospace"); ts.sprite.scale.set(36, 18, 1); ts.sprite.position.set(d.x + 18, 30, d.y - 18 + 30 * TAN); ts.sprite.visible = false; g.add(ts.sprite);
    const ring = new T.Mesh(BG.thin, B(C.cyan, .6)); ring.position.set(d.x, 2, d.y); ring.renderOrder = 9; ring.visible = false; g.add(ring);
    const fill = new T.Mesh(BG.disc, B(C.cyan, .08)); fill.position.set(d.x, 1.8, d.y); fill.renderOrder = 9; fill.visible = false; g.add(fill);
    return {o, ts, ring, fill};
  });
  // civilians' corner: a fence that shows the barricade
  this.fenceM = PM(0x8b7a55); this.fenceRails = [];
  const pts = [[945, 55], [945, 160], [1055, 160]];
  for(let k = 0; k < 2; k++){ const a = pts[k], b = pts[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 16);
    for(let i = 0; i <= n; i++){ const m = new T.Mesh(G.box, this.fenceM); m.scale.set(2.4, 16, 2.4); m.position.set(a[0] + (b[0] - a[0]) * i / n, 8, a[1] + (b[1] - a[1]) * i / n); m.castShadow = true; g.add(m); }
    [6, 13].forEach(hy => { const m = new T.Mesh(G.box, this.fenceM); const horiz = a[1] === b[1]; m.scale.set(horiz ? L : 1.6, 1.6, horiz ? 1.6 : L); m.position.set((a[0] + b[0]) / 2, hy, (a[1] + b[1]) / 2); m.castShadow = true; g.add(m); this.fenceRails.push(m); }); }
  this.civLabel = new TextSprite(512, 64, "800 40px ui-monospace, Menlo, monospace", "right"); this.civLabel.sprite.scale.set(140, 17.5, 1); this.civLabel.sprite.position.set(985, 20, 182 + 20 * TAN); g.add(this.civLabel.sprite);
  // lights per map
  const night = key === "night";
  this.hemi.color.setHex(night ? 0x8796b0 : key === "cold" ? 0xa9bcc6 : 0xb0bcb8); this.hemi.intensity = night ? .46 : .5;
  this.sun.color.setHex(night ? 0x9fb4d8 : 0xe6ecea); this.sun.intensity = night ? .5 : .7;
  this.sun.position.set(W / 2 - 300, 800, Hh / 2 + 220); this.sun.target.position.set(W / 2, 0, Hh / 2);
  if(key === "shop"){ this.lampA.color.setHex(0xcfe6ff); this.lampA.position.set(512, 70, 150); this.lampB.position.set(185, 40, 30); }
  else if(key === "cold"){ this.lampA.color.setHex(0xbfe4ff); this.lampA.position.set(830, 70, 150); this.lampB.position.set(1045, 40, 460); }
  else { this.lampA.color.setHex(0xff9a4a); this.lampA.position.set(512, 40, 160); this.lampB.position.set(185, 40, 30); }
  this.lampBase = night ? 1.5 : 1;
  this.r.shadowMap.needsUpdate = true; this.key = key;
  // props cast static shadows
  g.traverse(o => { if(o.isMesh && o !== floor && o.material && o.material.isMeshLambertMaterial && !o.isInstancedMesh) o.castShadow = true; });
};

/* ---------- per-frame ---------- */
View.prototype.resize = function(s){
  const c = this.canvas, cw = c.clientWidth, ch = c.clientHeight; if(!cw || !ch) return false;
  const cs = Math.min(cw / s.W, ch / s.H) || 1, k = clamp(cs * (window.devicePixelRatio || 1), 1, 2);
  const bw = Math.round(s.W * k), bh = Math.round(s.H * k);
  if(bw !== this.bw || bh !== this.bh){ this.r.setSize(bw, bh, false); this.bw = bw; this.bh = bh; }
  this.cs = cs; this.us = 13 * clamp(.95 / cs, 1, 2.6);
  const cam = this.cam; Object.assign(cam, {left:-s.W / 2, right:s.W / 2, top:s.H * COS / 2, bottom:-s.H * COS / 2}); cam.updateProjectionMatrix();
  cam.position.set(s.W / 2, 1200 * COS, s.H / 2 + 1200 * Math.sin(TILT)); cam.lookAt(s.W / 2, 0, s.H / 2);
  this.pts.material.size = 3 * k;
  return true;
};
View.prototype.ent = function(obj, type){
  let e = this.live.get(obj);
  if(e && e.type !== type){ this.drop(obj, e); e = null; }
  if(!e){ const pool = this.pools[type] || (this.pools[type] = []); e = pool.pop() || new Ent(type); this.dynG.add(e.root); this.live.set(obj, e);
    e.px = obj.x; e.py = obj.y; e.moveT = -9; e.face = type === "civ" ? Math.PI : 0; e.setDown(false); }
  e.frame = this.frame; return e;
};
View.prototype.drop = function(obj, e){ this.live.delete(obj); this.dynG.remove(e.root); this.pools[e.type].push(e); };
View.prototype.skull = function(obj){
  let s = this.skulls.get(obj);
  if(!s){ s = this.skullPool.pop(); if(!s){ s = new T.Group(); const b = new T.Mesh(G.plane, new T.MeshBasicMaterial({map:TX.blood, transparent:true, depthWrite:false})); b.scale.set(3.2, 1, 3.2); b.position.y = .06; b.renderOrder = 1; b.rotation.y = R(0, 6); s.add(b); s.add(sprite(SM.skull, 2.4, 1.2)); }
    this.dynG.add(s); this.skulls.set(obj, s); s.position.set(obj.x, 0, obj.y); }
  s.userData.frame = this.frame; s.scale.setScalar(this.us);
};
const UNIT_TYPE = u => u.id === "joel" ? "joel" : u.role === "Shotgun" ? "breacher" : u.role === "Scout" ? "scout" : u.role === "Medic" ? "medic" : "rifle";
const wrapA = a => { while(a > Math.PI) a -= Math.PI * 2; while(a < -Math.PI) a += Math.PI * 2; return a; };
View.prototype.place = function(e, obj, t, dt, aim){
  const dx = obj.x - e.px, dy = obj.y - e.py, d2 = dx * dx + dy * dy;
  e.spd = Math.sqrt(d2) / Math.max(.016, dt);
  if(d2 > .04){ e.moveT = t; e.tf = Math.atan2(dx, dy); }
  else if(aim != null) e.tf = aim;
  e.px = obj.x; e.py = obj.y;
  if(e.tf != null) e.face += wrapA(e.tf - e.face) * Math.min(1, dt * 9);
  e.root.position.set(obj.x, 0, obj.y); e.fig.root.rotation.y = e.face;
  return t - e.moveT < .3;
};
function animate(e, t, moving, alert){
  const f = e.fig, ph = e.ph; if(REDUCE || e.down) return;
  const k = e.type;
  if(e.kind === "human" || k === "civ"){
    if(moving){ const s = t * 9 + ph; f.legs[0].rotation.x = Math.sin(s) * .55; f.legs[1].rotation.x = -Math.sin(s) * .55; f.body.position.y = Math.abs(Math.sin(s)) * .06; }
    else { f.legs[0].rotation.x = f.legs[1].rotation.x = 0; f.body.position.y = Math.sin(t * 1.9 + ph) * .03; f.torso.rotation.z = Math.sin(t * .9 + ph) * .04; }
  } else if(k === "runner" && moving){ const s = t * 13 + ph; f.legs[0].rotation.x = Math.sin(s) * .95; f.legs[1].rotation.x = -Math.sin(s) * .95;
    f.arms[0].rotation.x = .9 + Math.sin(s) * .5; f.arms[1].rotation.x = .9 - Math.sin(s) * .5; f.body.position.y = Math.abs(Math.sin(s)) * .12; }
  else if(k === "crawler"){ const s = t * (moving ? 5 : 1.2) + ph; f.arms[0].rotation.x = -2.6 + Math.sin(s) * .35; f.arms[1].rotation.x = -2.6 - Math.sin(s) * .35; }
  else { const s = t * (moving ? 2.6 : alert ? 1.4 : .7) + ph, a = moving ? .35 : .08; f.legs[0].rotation.x = Math.sin(s) * a; f.legs[1].rotation.x = -Math.sin(s) * a;
    f.body.position.y = Math.abs(Math.sin(s)) * .05; f.torso.rotation.z = Math.sin(s * .5) * .14; }
}
View.prototype.draw = function(s){
  if(document.hidden) return;
  if(!this.resize(s)) return;
  if(this.key !== s.key || this.labelsRef !== s.labels){ this.buildMap(s); this.labelsRef = s.labels; }
  const now = performance.now() / 1000, dt = Math.min(.1, now - this.last); this.last = now; const t = REDUCE ? 3 : now;
  const m = s.m, us = this.us; this.frame++;
  const pulse = REDUCE ? .35 : (t * 1.1) % 1, beat = REDUCE ? .5 : (Math.sin(t * 6.9) + 1) / 2;
  PULSE_M.opacity = 1 - pulse; POOL_M.opacity = .16 + beat * .12; PULSE2_M.opacity = .7 + .3 * beat; GLOW_M.opacity = .5 + .2 * beat;
  // lights flicker
  if(!REDUCE){ this.lampA.intensity = this.lampBase * (this.key === "night" ? .85 + .15 * Math.sin(t * 9) * Math.sin(t * 5.3) : (Math.sin(t * 37) > .97 || (t % 7) < .12) ? .35 : 1); const rp = .7 + .3 * Math.sin(t * 3.2); this.lampB.intensity = 1.2 * rp; this.redPools.forEach(p => p.material.opacity = .28 + .18 * rp); }
  else { this.lampA.intensity = this.lampBase; }
  // rooms / doors / fence
  const armA = m && m.arm === "advance", armS = m && m.arm === "seal";
  this.roomFx.forEach((rf, i) => { rf.o.visible = !!armA && i !== m.squadRoom; const hid = !!m && !m.seen[i]; rf.fog.visible = rf.q.visible = hid; });
  const ringR = s.doorReach(this.cs) * .8, rp2 = REDUCE ? .5 : (Math.sin(now * 1000 / 220) + 1) / 2;
  s.doors.forEach((d, i) => { const df = this.doorFx[i], sealed = d.sealed > 0; df.o.visible = sealed; df.ts.sprite.visible = sealed; if(sealed) df.ts.set(Math.ceil(d.sealed) + "s", "#d6ad55");
    const showR = !sealed && armS; df.ring.visible = df.fill.visible = showR; if(showR){ df.ring.scale.setScalar(ringR); df.fill.scale.setScalar(ringR); df.ring.material.opacity = .35 + rp2 * .35; } });
  const bar = m ? m.barricade : 100;
  this.fenceM.color.setHex(bar > 40 ? 0x8b7a55 : bar > 0 ? 0xb4472f : 0x6a2a22); this.fenceRails.forEach(r => r.visible = bar > 0);
  const showCiv = !m || m.objective === "reach"; this.civLabel.sprite.visible = showCiv; if(showCiv) this.civLabel.set(`CIVILIANS ${Math.ceil(bar)}%`, "#8dbb72");
  this.squadRing.visible = !!m; this.bubble.visible = false;
  if(m){
    const R0 = s.rooms[m.squadRoom]; this.squadRing.position.set(R0.cx, 1, R0.cy);
    // aim: the freshest shot from each unit
    m.units.forEach(u => {
      if(u.status === "DEAD"){ this.skull(u); return; }
      const e = this.ent(u, UNIT_TYPE(u)); let aim = null;
      for(let i = m.shots.length - 1; i >= 0; i--){ const sh = m.shots[i]; if(Math.abs(sh.x1 - u.x) < 3 && Math.abs(sh.y1 - u.y) < 3){ aim = Math.atan2(sh.x2 - sh.x1, sh.y2 - sh.y1); break; } }
      const mv = this.place(e, u, now, dt, aim); e.setDown(u.status === "DOWN"); e.root.scale.setScalar(us);
      if(e.down){ const sc = 1.4 + pulse * 1.6; e.pulse.scale.setScalar(sc); }
      e.drop.visible = u.status === "INJURED"; e.focus.visible = false;
      if(e.reticle){ e.reticle.rotation.y = REDUCE ? 0 : t * .6; const rs = REDUCE ? 3.6 : 3.6 + Math.sin(t * 3) * .14; e.reticle.scale.set(rs, 1, rs); }
      if(e.icon) e.icon.position.y = e.iconY + (REDUCE ? 0 : Math.sin(t * 2 + e.ph) * .06);
      animate(e, t, mv, false);
    });
    m.civs.forEach(c => { if(c.status === "out") return; if(c.status === "dead"){ this.skull(c); return; }
      const e = this.ent(c, "civ"); const mv = this.place(e, c, now, dt, null); e.root.scale.setScalar(us * .92); e.focus.visible = false; animate(e, t, mv, false); });
    const fz = m.focus && m.focus.z;
    m.zombies.forEach(z => {
      if(!z.alive || !m.seen[z.room] || s.hiddenZ(z)) return;
      const e = this.ent(z, z.type); const mv = this.place(e, z, now, dt, null); e.root.scale.setScalar(us);
      if(e.ghosts) e.ghosts.visible = mv && e.spd > 30;
      if(e.waves){ const on = z.type === "screamer" && z.scream > 0 && z.alert; e.waves.forEach((w, i) => { w.visible = on; if(on){ const f = REDUCE ? .3 + i * .35 : ((t * .8) + i * .5) % 1; w.scale.setScalar(1.2 + f * 2.6); SCREAM_M[i].opacity = (1 - f) * .8; } }); }
      if(e.lurk){ e.lurk.visible = !!z.lurk; if(z.lurk) e.lurk.scale.setScalar(1.6 + beat * .3); }
      e.focus.visible = fz === z; if(fz === z) e.focus.scale.setScalar(e.r * (1.5 + beat * .15));
      if(e.icon) e.icon.position.y = e.iconY + (REDUCE ? 0 : Math.sin(t * 2 + e.ph) * .06);
      animate(e, t, mv, z.alert);
    });
    // crisis bubble over who it is about
    const c = m.crises[0];
    if(c){ const who = c.unit || c.z || (c.kind === "barricade" ? {x:1000, y:110} : m.units.find(u => u.id === "joel") || m.units[0]);
      if(who){ this.bubble.visible = true; const hy = 3.4 * us + (REDUCE ? 0 : Math.abs(Math.sin(t * 3)) * .25 * us); this.bubble.position.set(who.x, hy, who.y); this.bubble.scale.set(2.4 * us, 2.4 * us, 1); } }
  }
  this.live.forEach((e, obj) => { if(e.frame !== this.frame) this.drop(obj, e); });
  this.skulls.forEach((sk, obj) => { if(sk.userData.frame !== this.frame){ this.skulls.delete(obj); this.dynG.remove(sk); this.skullPool.push(sk); } });
  // shots
  let ti = 0;
  if(m) for(let i = 0; i < m.shots.length && ti < this.tracers.length; i++){ const sh = m.shots[i], tr = this.tracers[ti++];
    const a = this.tv.set(sh.x1, us * 1.05, sh.y1), b = this.tv2.set(sh.x2, us * .9, sh.y2); const L = a.distanceTo(b);
    tr.scale.set(1.6, 1.6, L); tr.position.copy(a).lerp(b, .5); tr.lookAt(b); tr.visible = true; tr.material.opacity = Math.min(1, sh.t * 8) * (sh.miss ? .35 : .95); }
  for(; ti < this.tracers.length; ti++) this.tracers[ti].visible = false;
  // blasts
  let bi = 0;
  if(m) for(let i = 0; i < m.blasts.length && bi < this.blasts.length; i++){ const b = m.blasts[i], fx = this.blasts[bi++];
    fx.m.visible = fx.ring.visible = fx.ts.sprite.visible = false;
    if(b.stash){ fx.ts.set("+1 PART", "#d6ad55"); fx.ts.sprite.visible = true; fx.ts.sprite.material.opacity = b.t; const h = 30 + (1 - b.t) * 40; fx.ts.sprite.position.set(b.x, h, b.y - 30 + h * TAN); fx.ts.sprite.scale.set(80, 20, 1); continue; }
    const rad = 95 * (1.2 - b.t / 2);
    if(b.scream){ fx.ring.visible = true; fx.ring.position.set(b.x, 2, b.y); fx.ring.scale.setScalar(rad); fx.ring.material.opacity = b.t * .8; }
    else { fx.m.visible = true; fx.m.position.set(b.x, 2, b.y); fx.m.scale.set(rad * 2.2, 1, rad * 2.2); fx.m.material.opacity = b.t; }
  }
  for(; bi < this.blasts.length; bi++){ const fx = this.blasts[bi]; fx.m.visible = fx.ring.visible = fx.ts.sprite.visible = false; }
  // particles
  let pn = 0;
  if(m) for(let i = 0; i < m.particles.length && pn < 256; i++){ const p = m.particles[i], c = this.col(p.color); if(p.t <= 0) continue;
    this.pPos[pn * 3] = p.x; this.pPos[pn * 3 + 1] = 8; this.pPos[pn * 3 + 2] = p.y; this.pCol[pn * 3] = c.r; this.pCol[pn * 3 + 1] = c.g; this.pCol[pn * 3 + 2] = c.b; pn++; }
  this.pGeo.setDrawRange(0, pn); if(pn){ this.pGeo.attributes.position.needsUpdate = true; this.pGeo.attributes.color.needsUpdate = true; }
  this.r.render(this.scene, this.cam);
};
View.prototype.capture = function(){ this.r.render(this.scene, this.cam); return this.canvas.toDataURL("image/png"); };

window.Battle3D = {
  create(canvas){
    try { const v = new View(canvas); window.Battle3D.view = v; return v; }
    catch(e){ console.warn("3D battlefield unavailable, using 2D", e); return null; }
  }
};
})();
