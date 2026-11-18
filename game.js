'use strict';
/* ===== Wild Run: Trap & Blast — Stage 1 (tes): canvas, game loop, kamera, gerak pemain ===== */
const VW = 960, VH = 540, TILE = 64;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VW; canvas.height = VH;

/* ---------- Aset (versi ringan dari folder assets/ — lihat assets_game/) ---------- */
const FILES = {
  bg: 'stage1/bg.jpg', top: 'stage1/top.png', dirt: 'stage1/dirt.png', plat_thin: 'stage1/plat_thin.png', plat_root: 'stage1/plat_root.png',
  fence: 'stage1/fence.png', fence2: 'stage1/fence2.png', hay: 'stage1/hay.png', sign: 'stage1/sign.png', barrel: 'stage1/barrel.png',
  crate: 'item/crate.png', coin: 'item/coin.png', gate: 'item/gate.png', checkpoint: 'item/checkpoint.png',
  idle: 'player/idle.png', walk: 'player/walk.png', jump: 'player/jump.png'
};
const IMG = {};
const loadAll = () => Promise.all(Object.entries(FILES).map(([k, f]) => new Promise(res => {
  const i = new Image();
  i.onload = () => { IMG[k] = i; res(); };
  i.onerror = () => { console.warn('Gagal memuat assets_game/' + f); res(); };
  i.src = 'assets_game/' + f;
})));
const lw = k => IMG[k].width / 2, lh = k => IMG[k].height / 2;   // aset disimpan 2x supaya tajam, ukuran logis = setengahnya
const ANIM = { idle: { n: 4, fps: 5 }, walk: { n: 4, fps: 10 }, jump: { n: 3, fps: 0 } };
const CELL_W = 213, CELL_H = 141, ANCHOR_X = 91.5, DS = 0.473;   // sel frame, titik pijakan badan, skala tampil karakter

/* ---------- Level (Stage 1): tanah tebal berundak. Jalur bawah = koridor tanah, jalur atas = slab & pulau melayang ---------- */
const G = 10 * TILE, LH = 12 * TILE, LW = 64 * TILE;   // permukaan tanah (640), tinggi & lebar dunia
const solids = [], oneway = [], deco = [], coins = [];
const mass = (c0, c1, top, bot = LH, kind = 'mass') => solids.push({ x: c0 * TILE, y: top, w: (c1 - c0 + 1) * TILE, h: bot - top, kind });
[[0, 14], [17, 31], [34, 63]].forEach(([a, b]) => mass(a, b, G));                                         // jalur bawah (jurang kolom 15-16 & 32-33)
[[8, 9, 544], [10, 11, 480], [42, 43, 448], [44, 45, 544], [48, 53, 544]].forEach(([a, b, t]) => mass(a, b, t, G)); // undakan (tiap langkah <= 96px)
mass(12, 25, 416, 512, 'slab'); mass(28, 41, 384, 480, 'slab');                                            // jalur atas: slab tebal melayang
[[1560, 212], [1608, 212], [1584, 164]].forEach(([x, y]) => solids.push({ x, y, w: 48, h: 48, kind: 'crate' }));
// platform satu arah [x, y, lebar, gambar] — pulau atas (lebar 384) digambar tebal. Tekan S/↓ untuk turun
[[1340, 340, 96, 'plat_root'], [1472, 260, 384, null], [3200, 456, 96, 'plat_thin']].forEach(([x, y, w, img]) => oneway.push({ x, y, w, img }));
// dekorasi [nama, x, y-bawah]
[['fence',40,G],['sign',200,G],['barrel',380,G],
 ['hay',800,G],['barrel',1150,G],['fence',1330,G],['hay',1520,G],['barrel',1740,G],['fence2',1880,G],
 ['barrel',2230,G],['hay',2400,G],['fence',2560,G],['sign',2880,G],['fence',3500,G],['hay',3650,G],['barrel',3780,G],
 ['hay',830,416],['barrel',1020,416],['fence',1100,416],['hay',1230,416],['barrel',1590,416],
 ['barrel',1860,384],['hay',2000,384],['fence2',2180,384],['sign',2380,384],['hay',2520,384],
 ['barrel',1780,260],['barrel',3110,544],['fence2',3350,544]]
  .forEach(([img, x, y]) => deco.push({ img, x, y: y + 4 }));
const addCoins = (x, y, n, dx = 44) => { for (let i = 0; i < n; i++) coins.push({ x: x + i * dx, y, got: false }); };
const addArc = (cx, y, n, hgt, dx = 36) => { for (let i = 0; i < n; i++) { const t = i / (n - 1) * 2 - 1; coins.push({ x: cx + t * (n - 1) * dx / 2, y: y - hgt * (1 - t * t), got: false }); } };
addCoins(250, 590, 2); addCoins(880, 590, 3); addArc(1024, 598, 5, 46); addCoins(1170, 590, 3); addCoins(1560, 590, 4); addCoins(1990, 590, 2);
addArc(2112, 598, 5, 46); addCoins(2260, 590, 3); addCoins(3500, 590, 3);
addCoins(860, 366, 4); addCoins(1100, 366, 3); addArc(1728, 366, 6, 60); addCoins(1900, 334, 3); addCoins(2200, 334, 4);
addCoins(1388, 296, 1); addCoins(1700, 215, 3); addCoins(1520, 215, 1);
addCoins(545, 500, 1); addCoins(690, 436, 1); addCoins(3150, 500, 4); addCoins(3248, 412, 1);
const FINISH = { x: 3900, y: G - 110, w: 40, h: 110 };
const CHECKPOINT = { x: 3010, y: G, on: false };

/* ---------- Pemain ---------- */
let spawn = { x: 100, y: G - 60 };
const P = { x: 0, y: 0, w: 28, h: 60, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, buffer: 0, dropT: 0, t: 0, anim: 'idle', stand: null };
const SPEED = 270, GRAV = 1900, JUMP_V = -650;
const state = { lives: 3, score: 0, time: 0, paused: false, done: false, debug: false, msg: '', msgT: 0 };
function respawn() { Object.assign(P, { x: spawn.x, y: spawn.y, vx: 0, vy: 0, face: 1 }); }
function resetGame() {
  Object.assign(state, { lives: 3, score: 0, time: 0, done: false }); CHECKPOINT.on = false; spawn = { x: 100, y: G - 60 };
  coins.forEach(c => c.got = false); respawn(); updateCamera(0, true);
}

/* ---------- Input ---------- */
const keys = new Set();
const is = (...n) => n.some(k => keys.has(k));
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!e.repeat) {
    if (k === ' ' || k === 'w' || k === 'ArrowUp') P.buffer = 0.12;
    if (k === 'Escape') state.paused = !state.paused;
    if (k === 'h') state.debug = !state.debug;
    if (k === 'r') resetGame();
  }
  keys.add(k);
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener('blur', () => keys.clear());

/* ---------- Fisika & tabrakan ---------- */
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function update(dt) {
  if (state.paused || state.done) return;
  state.time += dt; state.msgT -= dt;
  const dir = (is('d', 'ArrowRight') ? 1 : 0) - (is('a', 'ArrowLeft') ? 1 : 0);
  const jumpHeld = is(' ', 'w', 'ArrowUp'), down = is('s', 'ArrowDown');
  const acc = P.onGround ? 2600 : 1500, fr = P.onGround ? 3000 : 500;
  if (dir) { P.vx += dir * acc * dt; P.face = dir; P.vx = Math.max(-SPEED, Math.min(SPEED, P.vx)); }
  else { const d = fr * dt; P.vx = Math.abs(P.vx) <= d ? 0 : P.vx - Math.sign(P.vx) * d; }
  P.coyote = P.onGround ? 0.1 : P.coyote - dt; P.buffer -= dt; P.dropT -= dt;
  if (P.buffer > 0 && P.coyote > 0) { P.vy = JUMP_V; P.buffer = 0; P.coyote = 0; P.onGround = false; }
  P.vy += GRAV * dt * (P.vy < 0 && !jumpHeld ? 2.4 : 1);          // lepas tombol = lompatan lebih pendek
  P.vy = Math.min(P.vy, 900);
  if (down && P.onGround && P.stand) { P.dropT = 0.25; P.y += 2; P.onGround = false; }
  P.x += P.vx * dt;
  for (const s of solids) if (hit(P, s)) { P.x = P.vx > 0 ? s.x - P.w : s.x + s.w; P.vx = 0; }
  P.x = Math.max(0, Math.min(LW - P.w, P.x));
  const prevBottom = P.y + P.h; P.y += P.vy * dt; P.onGround = false; P.stand = null;
  for (const s of solids) if (hit(P, s)) {
    if (P.vy > 0) { P.y = s.y - P.h; P.onGround = true; } else if (P.vy < 0) P.y = s.y + s.h;
    P.vy = 0;
  }
  if (P.vy >= 0 && P.dropT <= 0) for (const o of oneway)
    if (P.x + P.w > o.x && P.x < o.x + o.w && prevBottom <= o.y + 1 && P.y + P.h >= o.y) { P.y = o.y - P.h; P.vy = 0; P.onGround = true; P.stand = o; }
  if (P.y > LH + 120) { if (--state.lives <= 0) resetGame(); else respawn(); }
  for (const c of coins) if (!c.got && Math.hypot(c.x - (P.x + P.w / 2), c.y - (P.y + P.h / 2)) < 32) { c.got = true; state.score += 10; }
  if (!CHECKPOINT.on && Math.abs(P.x + P.w / 2 - CHECKPOINT.x) < 40 && P.y + P.h >= CHECKPOINT.y - 80 && P.y < CHECKPOINT.y) {
    CHECKPOINT.on = true; spawn = { x: CHECKPOINT.x - P.w / 2, y: G - P.h }; state.msg = 'Checkpoint!'; state.msgT = 1.4;
  }
  if (hit(P, FINISH)) { state.done = true; state.score += 100; }
  P.anim = !P.onGround ? 'jump' : Math.abs(P.vx) > 20 ? 'walk' : 'idle'; P.t += dt;
}

/* ---------- Kamera (halus, melihat sedikit ke arah hadap, tidak keluar dunia) ---------- */
const cam = { x: 0, y: 0 };
function updateCamera(dt, snap) {
  const tx = Math.max(0, Math.min(LW - VW, P.x + P.w / 2 - VW / 2 + P.face * 70));
  const ty = Math.max(0, Math.min(LH - VH, P.y + P.h / 2 - VH * 0.55));
  const k = snap ? 1 : 1 - Math.exp(-8 * dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
}

/* ---------- Render ---------- */
let PAT = null;
function massBody(m) {           // isi tanah + bayangan dalam + garis tepi tebal
  const R = 14, bot = m.y + m.h >= LH ? 0 : R, rr = [R, R, bot, bot];
  if (!PAT) { PAT = ctx.createPattern(IMG.dirt, 'repeat'); try { PAT.setTransform(new DOMMatrix([.5, 0, 0, .5, 0, 0])); } catch (e) {} }
  ctx.save(); ctx.beginPath(); ctx.roundRect(m.x, m.y, m.w, m.h, rr); ctx.clip();
  ctx.fillStyle = PAT; ctx.fillRect(m.x, m.y, m.w, m.h);
  const g = ctx.createLinearGradient(0, m.y, 0, m.y + Math.min(m.h, 220));
  g.addColorStop(0, 'rgba(70,40,15,0)'); g.addColorStop(1, 'rgba(45,22,6,.5)');
  ctx.fillStyle = g; ctx.fillRect(m.x, m.y, m.w, m.h); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#3a2210'; ctx.beginPath(); ctx.roundRect(m.x, m.y, m.w, m.h, rr); ctx.stroke();
}
function massTop(m) {            // rumput di permukaan; lebar tile disesuaikan agar pas di kedua ujung
  const n = Math.max(1, Math.round(m.w / 128)), tw = m.w / n, th = lh('top') + 4;
  for (let i = 0; i < n; i++) ctx.drawImage(IMG.top, m.x + i * tw, m.y - 10, tw + 1, th);
}
function drawPlayer() {
  const a = ANIM[P.anim]; let f;
  if (P.anim === 'jump') f = P.vy < -150 ? 0 : P.vy > 150 ? 2 : 1; else f = Math.floor(P.t * a.fps) % a.n;
  ctx.save(); ctx.translate(Math.round(P.x + P.w / 2), Math.round(P.y + P.h + 2)); ctx.scale(P.face * DS, DS);
  ctx.drawImage(IMG[P.anim], f * CELL_W, 0, CELL_W, CELL_H, -ANCHOR_X, -CELL_H, CELL_W, CELL_H);
  ctx.restore();
}
function pill(x, y, w, h) { ctx.fillStyle = 'rgba(25,40,65,.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); }
function hud() {
  ctx.textBaseline = 'middle'; pill(12, 12, 360, 40);
  ctx.fillStyle = '#ff4d5e'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillText('♥'.repeat(state.lives), 26, 33);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('SKOR ' + String(state.score).padStart(4, '0') + '     STAGE 1/5', 120, 33);
  pill(VW - 172, 12, 160, 40);
  const t = Math.floor(state.time), m = String(Math.floor(t / 60)).padStart(2, '0'), s = String(t % 60).padStart(2, '0');
  ctx.fillStyle = '#fff'; ctx.fillText('⏱ ' + m + ':' + s + '   ESC', VW - 158, 33);
  if (state.msgT > 0) { ctx.textAlign = 'center'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillText(state.msg, VW / 2, 90); ctx.textAlign = 'left'; }
}
function centerText(t, sub) {
  ctx.fillStyle = 'rgba(10,20,35,.65)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 44px system-ui, sans-serif'; ctx.fillText(t, VW / 2, VH / 2 - 10);
  ctx.font = '18px system-ui, sans-serif'; ctx.fillText(sub, VW / 2, VH / 2 + 34); ctx.textAlign = 'left';
}
function render() {
  const bw = IMG.bg.width * VH / IMG.bg.height, off = cam.x / (LW - VW) * (bw - VW);
  ctx.drawImage(IMG.bg, -off, 0, bw, VH);                                  // latar bergeser lebih pelan (parallax)
  ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  const vis = o => o.x + (o.w || 120) > cam.x - 120 && o.x < cam.x + VW + 120;
  deco.filter(vis).forEach(d => {
    const w = lw(d.img), h = lh(d.img);
    ctx.fillStyle = 'rgba(30,50,20,.22)'; ctx.beginPath(); ctx.ellipse(d.x + w / 2, d.y - 3, w * .5, 5, 0, 0, 7); ctx.fill();
    ctx.drawImage(IMG[d.img], d.x, d.y - h, w, h);
  });
  const M = solids.filter(m => m.kind !== 'crate' && vis(m)), isl = oneway.filter(o => !o.img);
  M.forEach(massBody); isl.forEach(o => massBody({ x: o.x, y: o.y, w: o.w, h: 64 }));
  M.forEach(massTop); isl.forEach(o => massTop({ x: o.x, y: o.y, w: o.w }));
  solids.filter(s => s.kind === 'slab').forEach(s => { const g = ctx.createLinearGradient(0, s.y + s.h, 0, s.y + s.h + 26); g.addColorStop(0, 'rgba(20,40,20,.3)'); g.addColorStop(1, 'rgba(20,40,20,0)'); ctx.fillStyle = g; ctx.fillRect(s.x, s.y + s.h, s.w, 26); });
  solids.filter(s => s.kind === 'crate').forEach(s => ctx.drawImage(IMG.crate, s.x, s.y, s.w, s.h));
  oneway.filter(o => o.img).forEach(o => ctx.drawImage(IMG[o.img], o.x, o.y - 8, o.w, lh(o.img) * o.w / lw(o.img)));
  ctx.globalAlpha = CHECKPOINT.on ? 1 : .6; ctx.drawImage(IMG.checkpoint, CHECKPOINT.x - lw('checkpoint') / 2, CHECKPOINT.y + 4 - lh('checkpoint'), lw('checkpoint'), lh('checkpoint')); ctx.globalAlpha = 1;
  ctx.drawImage(IMG.gate, FINISH.x - 52, G + 4 - lh('gate'), lw('gate'), lh('gate'));
  const bob = Math.sin(performance.now() / 250) * 3;
  coins.filter(c => !c.got && vis(c)).forEach(c => ctx.drawImage(IMG.coin, c.x - lw('coin') / 2, c.y + bob - lh('coin') / 2, lw('coin'), lh('coin')));
  drawPlayer();
  if (state.debug) { ctx.lineWidth = 2; ctx.strokeStyle = '#f0f'; ctx.strokeRect(P.x, P.y, P.w, P.h);
    ctx.strokeStyle = '#0ff'; solids.forEach(s => ctx.strokeRect(s.x, s.y, s.w, s.h)); ctx.strokeStyle = '#ff0'; oneway.forEach(o => ctx.strokeRect(o.x, o.y, o.w, 4)); }
  ctx.restore();
  hud();
  if (state.paused) centerText('JEDA', 'Tekan Esc untuk lanjut');
  if (state.done) centerText('STAGE COMPLETE', 'Skor ' + state.score + '  ·  tekan R untuk main lagi');
}

/* ---------- Game loop (langkah waktu tetap 60 Hz) ---------- */
const STEP = 1 / 60; let last = 0, acc = 0;
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now; acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  if (!state.paused) updateCamera(dt, false);
  render(); requestAnimationFrame(loop);
}
loadAll().then(() => { resetGame(); requestAnimationFrame(t => { last = t; loop(t); }); });
