'use strict';
// ===== Weapon drawing helpers (grip at origin, pointing +x) =====
function dHandle(c, col = '#2a2438', len = 16) { c.fillStyle = col; rr(c, -8, -3, len, 6, 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.15)'; for (let i = -6; i < len - 8; i += 4) c.fillRect(i, -3, 1.5, 6); }
function dBlade(c, x, len, w, col, edge, curve = 0) {
  const g = c.createLinearGradient(0, -w, 0, w); g.addColorStop(0, shade(col, .5)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.35));
  c.fillStyle = g; c.beginPath(); c.moveTo(x, -w / 2); c.quadraticCurveTo(x + len * .6, -w / 2 - curve, x + len, -curve); c.lineTo(x + len - 6, w / 2 - curve * .4);
  c.quadraticCurveTo(x + len * .5, w / 2, x, w / 2); c.closePath(); c.fill();
  if (edge) { c.strokeStyle = edge; c.lineWidth = 1.6; c.stroke(); }
}
function dGun(c, body, acc, len = 42, h = 11) {
  c.fillStyle = body; rr(c, -6, -h / 2, len, h, 3); c.fill(); rr(c, -4, 0, 9, 14, 2); c.fill();
  c.fillStyle = acc; c.fillRect(4, -h / 2 + 2, len - 16, 2.5); glow(c, len - 8, 0, 9, acc, .7);
  c.fillStyle = '#0d0f18'; c.fillRect(len - 6, -3, 9, 6);
}
function orb(c, x, y, r, inner, outer, t = 0) {
  glow(c, x, y, r * 2.2, outer, .8); c.fillStyle = inner; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.globalAlpha *= .8;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x, y, r * .7, t * 8 + i * 2.1, t * 8 + i * 2.1 + 1.4); c.stroke(); }
  c.globalAlpha = 1;
}
function fist(c, col, auraCol, big = 1) { if (auraCol) glow(c, 4, 0, 18 * big, auraCol, .8); c.fillStyle = col; c.beginPath(); c.arc(4, 0, 6.5 * big, 0, TAU); c.fill(); c.strokeStyle = '#0a0d1a'; c.lineWidth = 2; c.stroke(); }
const T = () => (window.G ? G.time : performance.now() / 1000);

// ===== WEAPONS =====
const WEAPONS = {}, WLIST = [];
function defW(o) { const w = Object.assign({ cat: 'modern', price: 0, range: 70, cost: 50, kind: 'melee', hold: -1, spR: 1.4 }, o); WEAPONS[w.id] = w; WLIST.push(w); }

defW({ id: 'fists', name: 'Yumruk', cat: 'modern', price: 0, kind: 'fist', range: 52, cost: 40, desc: 'Hızlı kombo, aparkat özel.',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd'); },
  atk(f) { melee(f, { kind: 'punch', range: 55, dmg: 6, cd: .26, dur: .2, kx: 220, ky: -150 }); },
  sp(f) { f.vy = -500; melee(f, { kind: 'swing', range: 65, h: 110, dmg: 15, kx: 200, ky: -1050, cd: .5, col: '#fff', snd: 'heavy' }); } });

defW({ id: 'katana', name: 'Neon Katana', price: 0, range: 78, cost: 45, desc: 'Hızlı kesik, özel: ışık hızında atılma.',
  draw(c) { dHandle(c); c.fillStyle = '#ffd23f'; c.fillRect(8, -6, 3, 12); dBlade(c, 11, 64, 6, '#dfe8ff', '#7df9ff', 4); glow(c, 45, -2, 26, 'rgba(125,249,255,.35)'); },
  atk(f) { melee(f, { range: 82, dmg: 10, cd: .3, col: '#7df9ff' }); },
  sp(f) { sfx('special'); dash(f, 420, .16, { dmg: 22, kx: 500, ky: -300, col: '#7df9ff', fx: e => slashFx(e.x, e.cy(), rnd(0, 3), 50, '#7df9ff', .3, 10) }); } });

defW({ id: 'plasma', name: 'Plazma Tüfeği', price: 0, kind: 'gun', range: 380, cost: 50, hold: 0, desc: 'Seri plazma; özel: patlayan plazma topu.',
  draw(c) { dGun(c, '#2b3550', '#22d3ee', 48); },
  atk(f) { shoot(f, { speed: 1100, dmg: 4.5, cd: .13, r: 5, col: '#22d3ee', kx: 120, ky: -60, snd: 'laser' }); },
  sp(f) { shoot(f, { speed: 650, dmg: 12, cd: .5, r: 16, col: '#a78bfa', kx: 300, snd: 'special', onDie: p => explode(p.x, p.y, 110, 22, p.owner, '#a78bfa'), onHit: p => p.die() }); } });

defW({ id: 'shotgun', name: 'Pompalı', price: 150, kind: 'gun', range: 200, cost: 45, hold: 0, desc: 'Yakında ölümcül; özel: roket zıplama.',
  draw(c) { dGun(c, '#3b2a20', '#ff8a3d', 46, 12); c.fillStyle = '#6b4a35'; c.fillRect(-14, -4, 10, 9); },
  atk(f) { shoot(f, { n: 6, spread: .35, speed: 1000, dmg: 3.2, cd: .75, life: .3, r: 4, col: '#ffb347', kx: 260, ky: -140, snd: 'heavy' }); f.vx -= f.face * 120; },
  sp(f) { shoot(f, { n: 10, spread: .6, speed: 1100, dmg: 3.5, cd: .4, life: .3, r: 5, col: '#ff6b3d', kx: 380, ky: -260, snd: 'boom' }); f.vx = -f.face * 850; f.vy = -750; f.stun = 0; burst(f.x, f.y - 70, 20, ['#ff6b3d', '#ffd23f'], 400); } });

defW({ id: 'sniper', name: 'Ray Sniper', price: 250, kind: 'gun', range: 600, cost: 60, hold: 0, desc: 'Anında ışın; özel: delici dev ışın.',
  draw(c) { dGun(c, '#1d2738', '#ff2e88', 66, 9); c.fillStyle = '#111'; c.fillRect(12, -11, 18, 5); },
  atk(f) { f.atkKind = 'shoot'; f.atkT = f.atkDur = .25; f.atkCd = 1.0; sfx('laser'); rayHit(f, { dmg: 18, th: 4, col: '#ff2e88', kx: 500, ky: -200 }); },
  sp(f) { f.atkKind = 'shoot'; f.atkT = f.atkDur = .4; f.atkCd = .6; sfx('flash'); G.shake = 12; rayHit(f, { dmg: 34, th: 18, col: '#ff2e88', kx: 900, ky: -400, pierce: true }); } });

defW({ id: 'rocket', name: 'Roketatar', price: 300, kind: 'gun', range: 420, cost: 70, hold: 0, desc: 'Patlayıcı roket; özel: güdümlü füze yağmuru.',
  draw(c) { c.fillStyle = '#3d4a2c'; rr(c, -14, -8, 64, 16, 5); c.fill(); c.fillStyle = '#ff4d4d'; c.fillRect(44, -8, 6, 16); c.fillStyle = '#222'; c.fillRect(-2, 6, 8, 12); },
  atk(f) { shoot(f, { speed: 750, dmg: 6, cd: 1.0, r: 8, col: '#ff6b3d', snd: 'shoot', drawFn: drawRocket, trail: p => P({ x: p.x, y: p.y, type: 'smoke', size: 6, life: .4, col: 'rgba(180,180,180,.5)' }), onDie: p => explode(p.x, p.y, 100, 18, p.owner, '#ff6b3d'), onHit: p => p.die() }); },
  sp(f) { for (let i = 0; i < 5; i++) after(i * .09, () => { if (f.dead) return; shoot(f, { speed: 520, dmg: 3, cd: .5, r: 6, col: '#ff4d4d', snd: 'shoot', vy0: -400 + i * 120, home: 1, life: 2.2, drawFn: drawRocket, trail: p => P({ x: p.x, y: p.y, type: 'smoke', size: 4, life: .3, col: 'rgba(200,200,200,.5)' }), onDie: p => explode(p.x, p.y, 60, 9, p.owner, '#ff4d4d'), onHit: p => p.die() }); }); } });

defW({ id: 'hammer', name: 'Yerçekimi Çekici', price: 200, range: 80, cost: 55, hold: -1.2, desc: 'Ağır vuruş; özel: zıpla ve yeri sars.',
  draw(c) { c.fillStyle = '#555c70'; c.fillRect(-8, -3, 50, 6); c.fillStyle = '#2b3042'; rr(c, 38, -18, 26, 36, 5); c.fill(); c.fillStyle = '#5eead4'; c.fillRect(48, -18, 5, 36); glow(c, 51, 0, 26, 'rgba(94,234,212,.5)'); },
  atk(f) { melee(f, { range: 88, dmg: 16, cd: .7, dur: .38, delay: .16, kx: 650, ky: -380, col: '#5eead4', snd: 'heavy', w: 10 }); },
  sp(f) { f.vy = -900; f.slam = true; f.atkKind = 'slam'; f.atkT = f.atkDur = .6; sfx('special'); } });

defW({ id: 'whip', name: 'Lazer Kırbaç', price: 200, range: 150, cost: 45, hold: 0, desc: 'Uzun menzil; özel: düşmanı kendine çek.',
  draw(c, f) { c.fillStyle = '#333'; rr(c, -6, -3, 16, 6, 2); c.fill(); const t = T(); c.strokeStyle = '#f472b6'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 0); for (let i = 1; i <= 8; i++) c.lineTo(10 + i * 5, Math.sin(t * 10 + i) * 4 + i * 2); c.stroke(); },
  atk(f) { melee(f, { range: 160, h: 50, dmg: 8, cd: .45, col: '#f472b6', kind: 'swing' }); after(.07, () => !f.dead && P({ type: 'line', x: f.x, y: f.cy() - 20, x2: f.x + f.face * 160 * f.s, y2: f.cy(), col: '#f472b6', w: 5, life: .15 })); },
  sp(f) { shoot(f, { speed: 1400, dmg: 6, cd: .4, r: 8, life: .45, col: '#f472b6', snd: 'zap', onHit: (p, e) => { e.vx = (f.x - e.x) * 3.2; e.vy = -350; e.stun = .6; bolt(f.x, f.cy(), e.x, e.cy(), '#f472b6', .3); } }); } });

// ---- Anime-inspired ----
defW({ id: 'spiral', name: 'Spiral Küre', cat: 'anime', price: 300, kind: 'fist', range: 55, cost: 60, desc: 'Avuçta dönen enerji küresi. Özel: küreyle atıl ve fırlat!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd'); if (f && f.charging > 0) orb(c, 14, 0, 6 + (1 - f.charging / .4) * 10, '#bfe9ff', '#38bdf8', T()); else orb(c, 12, 0, 4, '#bfe9ff', 'rgba(56,189,248,.5)', T()); },
  atk(f) { melee(f, { kind: 'punch', range: 58, dmg: 6, cd: .25, dur: .2, col: '#38bdf8', fx: false }); },
  sp(f) { charge(f, .4, '#38bdf8', () => { sfx('special'); dash(f, 380, .2, { dmg: 28, kx: 1100, ky: -550, col: '#38bdf8', fx: e => { ring(e.x, e.cy(), 120, '#38bdf8', .5, 10); burst(e.x, e.cy(), 30, ['#38bdf8', '#e0f2fe', '#fff'], 600); } }); }); } });

defW({ id: 'chidori', name: 'Şimşek Bıçağı', cat: 'anime', price: 300, kind: 'fist', range: 58, cost: 55, desc: 'Elde çıtırdayan şimşek. Özel: yıldırım hızında delici hamle.',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(147,197,253,.7)'); c.strokeStyle = '#dbeafe'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = rnd(0, TAU); jag(c, 4, 0, 4 + Math.cos(a) * 22, Math.sin(a) * 22, 3, 4); } },
  atk(f) { melee(f, { kind: 'punch', range: 60, dmg: 7, cd: .28, col: '#93c5fd', snd: 'zap', fx: false, onHit: e => bolt(f.x, f.cy(), e.x, e.cy(), '#93c5fd') }); },
  sp(f) { charge(f, .3, '#93c5fd', () => { sfx('zap'); dash(f, 540, .17, { dmg: 26, kx: 750, ky: -280, col: '#93c5fd', bolt: 1, fx: e => { for (let i = 0; i < 6; i++) bolt(e.x, e.cy(), e.x + rnd(-120, 120), e.cy() + rnd(-120, 120), '#93c5fd', .3); } }); }); } });

defW({ id: 'kunai', name: 'Işınlanma Kunaisi', cat: 'anime', price: 350, kind: 'gun', range: 300, cost: 35, hold: 0, desc: 'Mühürlü kunai fırlat. Özel: kunaiye ışınlan ve kes!',
  draw(c) { c.fillStyle = '#333'; c.fillRect(-6, -2, 14, 4); c.fillStyle = '#c0c8d8'; c.beginPath(); c.moveTo(8, -5); c.lineTo(30, 0); c.lineTo(8, 5); c.closePath(); c.fill(); c.fillStyle = '#9aa3b5'; c.beginPath(); c.moveTo(10, -3); c.lineTo(18, -9); c.lineTo(16, -2); c.fill(); c.beginPath(); c.moveTo(10, 3); c.lineTo(18, 9); c.lineTo(16, 2); c.fill(); },
  atk(f) { shoot(f, { speed: 1000, dmg: 7, cd: .4, r: 6, grav: 400, col: '#fbbf24', snd: 'swing', drawFn: drawKunai, solid: true, onDie: (p) => { f.mark = { x: p.x, y: p.y, t: 6 }; } }); },
  sp(f) {
    if (f.mark) { const m = f.mark; f.mark = null; smoke(f.x, f.cy(), 8, 'rgba(251,191,36,.5)'); ring(f.x, f.cy(), 60, '#fbbf24'); f.x = clamp(m.x, 20, W - 20); f.y = Math.min(m.y + 10, H + 50); f.vy = -250; f.vx = 0; f.inv = .2; sfx('special');
      ring(f.x, f.cy(), 90, '#fbbf24', .4, 8); melee(f, { range: 100, h: 140, dmg: 20, kx: 500, ky: -500, both: true, col: '#fbbf24', delay: .02, cd: .3 }); slashFx(f.x, f.cy(), Math.PI, 90, '#fbbf24', .25, 8); }
    else { for (let i = -1; i <= 1; i++) shoot(f, { speed: 1000, dmg: 7, cd: .4, r: 6, grav: 300, vy0: i * 220, col: '#fbbf24', drawFn: drawKunai, onDie: p => { f.mark = { x: p.x, y: p.y, t: 6 }; } }); } } });

defW({ id: 'clone', name: 'Gölge Klon', cat: 'anime', price: 350, kind: 'fist', range: 52, cost: 60, desc: 'Ninja kombosu. Özel: 2 gölge klon çağır!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd'); },
  atk(f) { melee(f, { kind: 'punch', range: 55, dmg: 6.5, cd: .24, dur: .2, kx: 240, ky: -160 }); },
  sp(f) { sfx('special'); for (const d of [-1, 1]) spawnClone(f, d); } });

defW({ id: 'cursed', name: 'Lanet Yumruğu', cat: 'anime', price: 400, kind: 'fist', range: 56, cost: 50, desc: 'Lanetli enerji. %20 şansla KARA ŞİMŞEK! Özel: gecikmeli çift darbe.',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(220,38,38,.55)'); },
  atk(f) { melee(f, { kind: 'punch', range: 58, dmg: 7, cd: .27, dur: .2, kx: 250, ky: -170, col: '#dc2626', fx: false, onHit: e => { if (Math.random() < .2) blackFlash(f, e); } }); },
  sp(f) { melee(f, { kind: 'punch', range: 62, dmg: 10, cd: .5, dur: .3, kx: 200, ky: -100, col: '#dc2626', snd: 'heavy', onHit: e => { after(.3, () => { if (e.dead) return; hit(e, 14, f.face * 700, -450, f, { hitCol: '#dc2626' }); ring(e.x, e.cy(), 80, '#7f1d1d', .4, 10); burst(e.x, e.cy(), 20, ['#000', '#dc2626'], 500); }); } }); } });

defW({ id: 'void', name: 'Sonsuzluk Tekniği', cat: 'anime', price: 600, kind: 'fist', range: 320, cost: 90, desc: 'Mavi: çeken küre. Özel: Kırmızı+Mavi = MOR yok edici küre!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(96,165,250,.6)'); const t = T(); orb(c, 6 + Math.cos(t * 3) * 10, Math.sin(t * 3) * 10 - 10, 3.5, '#bfdbfe', 'rgba(59,130,246,.6)', t); },
  atk(f) { f.atkKind = 'cast'; f.atkT = f.atkDur = .3; f.atkCd = .8; sfx('laser');
    G.projs.push(new Proj({ x: f.x + f.face * 40, y: f.y - 70 * f.s, vx: f.face * 380, vy: 0, owner: f, r: 14, dmg: 2, pierce: true, life: 1.4, col: '#3b82f6', kx: 0, ky: 0, solid: false,
      upd: (p, dt) => { p.tick = (p.tick || 0) - dt; for (const e of foes(f)) { const dx = p.x - e.x, dy = p.y - e.cy(), d = Math.hypot(dx, dy); if (d < 220 && !e.boss) { e.vx += dx / d * 2600 * dt; e.vy += dy / d * 1600 * dt; } } if (p.tick <= 0) { p.tick = .2; p.hits.clear(); } },
      drawFn: (c, p) => orb(c, p.x, p.y, 13, '#dbeafe', '#3b82f6', p.t) })); },
  sp(f) { charge(f, .7, '#a855f7', () => { sfx('flash'); G.shake = 16; G.flash = .25;
    G.projs.push(new Proj({ x: f.x + f.face * 50, y: f.y - 66 * f.s, vx: f.face * 950, vy: 0, owner: f, r: 42, dmg: 40, pierce: true, life: 1.6, col: '#a855f7', kx: 900, ky: -400, solid: false,
      trail: p => burst(p.x, p.y, 2, ['#a855f7', '#e9d5ff', '#3b82f6', '#ef4444'], 120, .4, 5, 0),
      drawFn: (c, p) => { glow(c, p.x, p.y, 110, 'rgba(168,85,247,.6)'); c.fillStyle = '#3b0764'; c.beginPath(); c.arc(p.x, p.y, 40, 0, TAU); c.fill(); c.strokeStyle = '#e9d5ff'; c.lineWidth = 4; c.stroke(); orb(c, p.x, p.y, 26, '#f5d0fe', '#a855f7', p.t); } })); }, (c, f, k) => { const hx = f.x + f.face * 40, hy = f.y - 66 * f.s; orb(c, hx - 18 * k, hy, 10, '#bfdbfe', '#3b82f6', T()); orb(c, hx + 18 * k, hy, 10, '#fecaca', '#ef4444', T()); }); } });

defW({ id: 'shrine', name: 'Kesik Tapınağı', cat: 'anime', price: 650, kind: 'fist', range: 300, cost: 100, desc: 'Görünmez kesikler fırlat. Özel: ALAN AÇILIMI — rakip kesiklerle doğranır!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(239,68,68,.45)'); },
  atk(f) { f.atkKind = 'cast'; f.atkT = f.atkDur = .22; f.atkCd = .45; sfx('swing');
    G.projs.push(new Proj({ x: f.x + f.face * 40, y: f.y - 72 * f.s, vx: f.face * 1300, vy: 0, owner: f, r: 16, dmg: 8, life: .5, col: '#fca5a5', kx: 260, ky: -120, solid: false,
      drawFn: (c, p) => { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x - 14, p.y - 18); c.lineTo(p.x + 14, p.y + 18); c.moveTo(p.x - 4, p.y - 22); c.lineTo(p.x + 20, p.y + 10); c.stroke(); },
      onHit: (p, e) => { for (let i = 0; i < 3; i++) slashCut(e); } })); },
  sp(f) { sfx('domain'); G.domain = { owner: f, t: 3, tick: 0 }; txt(W / 2, H / 2 - 60, 'ALAN AÇILIMI', '#ef4444', 64, 1.8); G.flash = .3; f.inv = .5; } });

defW({ id: 'ki', name: 'Ki Dalgası', cat: 'anime', price: 450, kind: 'fist', range: 360, cost: 100, desc: 'Ki mermileri. Özel: şarj et ve dev Ki ışını salla!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(250,204,21,.5)'); },
  atk(f) { f.atkKind = 'cast'; f.atkT = f.atkDur = .16; f.atkCd = .2; shoot(f, { speed: 900, dmg: 4, cd: .2, r: 8, col: '#fde047', snd: 'shoot', kind: 'cast', drawFn: (c, p) => orb(c, p.x, p.y, 7, '#fff7c2', '#facc15', p.t) }); },
  sp(f) { charge(f, .65, '#38bdf8', () => { sfx('flash'); G.shake = 14; G.fx.push(kiBeam(f)); }, (c, f, k) => orb(c, f.x - f.face * 6, f.y - 62 * f.s, 6 + k * 14, '#e0f2fe', '#38bdf8', T())); } });

defW({ id: 'moonfang', name: 'Ay Dişi Kılıcı', cat: 'anime', price: 450, range: 90, cost: 55, hold: -1, desc: 'Dev siyah kılıç. Özel: hilal şeklinde enerji dalgası!',
  draw(c) { dHandle(c, '#ddd', 18); c.strokeStyle = '#888'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-18, 8); c.lineTo(-24, 4); c.stroke(); dBlade(c, 10, 80, 15, '#1b1b22', '#e5e7eb', 2); glow(c, 50, 0, 30, 'rgba(56,189,248,.25)'); },
  atk(f) { melee(f, { range: 95, dmg: 12, cd: .42, dur: .3, kx: 420, ky: -260, col: '#93c5fd', w: 9 }); },
  sp(f) { melee(f, { range: 70, dmg: 0, cd: .5, fx: false }); sfx('special');
    G.projs.push(new Proj({ x: f.x + f.face * 50, y: f.y - 60 * f.s, vx: f.face * 900, vy: 0, owner: f, r: 50, dmg: 26, pierce: true, life: 1.1, kx: 650, ky: -350, solid: false, col: '#38bdf8',
      drawFn: (c, p) => { c.save(); c.translate(p.x, p.y); c.scale(Math.sign(p.vx), 1); glow(c, 0, 0, 80, 'rgba(56,189,248,.45)'); c.fillStyle = '#0b1020'; c.beginPath(); c.arc(-30, 0, 70, -1.1, 1.1); c.arc(-50, 0, 58, 1.0, -1.0, true); c.fill(); c.strokeStyle = '#7dd3fc'; c.lineWidth = 4; c.stroke(); c.restore(); } })); } });

defW({ id: 'water', name: 'Su Nefesi Katanası', cat: 'anime', price: 400, range: 80, cost: 55, desc: 'Akan su kesikleri. Özel: 3 hamlelik akış dansı!',
  draw(c) { dHandle(c, '#1e293b'); c.fillStyle = '#111'; c.beginPath(); c.arc(10, 0, 6, 0, TAU); c.fill(); dBlade(c, 12, 62, 6, '#1e40af', '#93c5fd', 4); },
  atk(f) { melee(f, { range: 84, dmg: 10, cd: .32, col: '#60a5fa', w: 12, onHit: e => burst(e.x, e.cy(), 10, ['#60a5fa', '#dbeafe'], 300) }); },
  sp(f) { sfx('special'); for (let i = 0; i < 3; i++) after(i * .22, () => { if (f.dead) return; if (i === 1) f.face *= 1; dash(f, 200, .14, { dmg: 10, kx: 300, ky: -260, col: '#60a5fa', fx: e => { slashFx(e.x, e.cy(), rnd(0, TAU), 55, '#60a5fa', .35, 12); burst(e.x, e.cy(), 14, ['#60a5fa', '#bfdbfe', '#fff'], 350); } }); for (let k = 0; k < 8; k++) P({ x: f.x, y: f.cy() + rnd(-30, 30), vx: rnd(-60, 60), vy: rnd(-60, 60), size: 6, col: '#60a5fa', life: .5, g: 0 }); }); } });

defW({ id: 'rubber', name: 'Lastik Yumruk', cat: 'anime', price: 400, kind: 'fist', range: 210, cost: 60, desc: 'Kolun uzar! Özel: makineli yumruk yağmuru.',
  draw(c, f) { fist(c, '#ef4444', null, 1.25); },
  atk(f) { melee(f, { kind: 'stretch', range: 220, h: 50, dmg: 8, cd: .45, dur: .32, delay: .1, kx: 380, ky: -220, fx: false }); },
  sp(f) { f.lock = 1.0; for (let i = 0; i < 14; i++) after(i * .07, () => { if (f.dead) return; f.atkKind = 'gatling'; f.atkT = f.atkDur = .07; melee(f, { kind: 'gatling', range: 170, h: 70, dmg: 2.6, cd: 0, dur: .07, delay: 0, kx: 160, ky: -60, stun: .25, fx: false, snd: 'hit' }); P({ x: f.x + f.face * rnd(60, 170), y: f.cy() + rnd(-25, 25), size: 9, col: '#ef4444', life: .12, g: 0 }); }); } });

defW({ id: 'shadow', name: 'On Gölge Kurdu', cat: 'anime', price: 450, kind: 'fist', range: 60, cost: 55, desc: 'Gölge pençesi. Özel: gölge kurt çağır ve saldırt!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(30,27,75,.7)'); },
  atk(f) { melee(f, { range: 66, dmg: 8, cd: .3, col: '#6366f1', w: 6, onHit: e => smoke(e.x, e.cy(), 4, 'rgba(30,27,75,.6)') }); },
  sp(f) { sfx('special'); smoke(f.x + f.face * 30, f.y - 20, 12, 'rgba(15,15,40,.7)');
    G.projs.push(new Proj({ x: f.x + f.face * 30, y: f.y - 22, vx: f.face * 650, vy: 0, owner: f, r: 22, dmg: 24, life: 1.6, pierce: true, kx: 550, ky: -450, solid: false, col: '#312e81', groundY: f.onG ? f.y : null,
      upd: (p, dt) => { for (const pl of G.map.plats) if (p.x > pl[0] && p.x < pl[0] + pl[2] && p.y + 22 >= pl[1] - 4 && p.y + 22 <= pl[1] + 30) { p.y = pl[1] - 22; p.vy = 0; return; } p.vy += 2000 * dt; },
      drawFn: drawWolf })); } });

defW({ id: 'blackflame', name: 'Kara Alev Gözü', cat: 'anime', price: 500, kind: 'gun', range: 340, cost: 60, hold: 0, desc: 'Ateş topu. Özel: sönmeyen kara alevler, rakibi yakar!',
  draw(c, f) { fist(c, f ? f.c1 : '#ddd', 'rgba(239,68,68,.4)'); },
  atk(f) { shoot(f, { kind: 'cast', speed: 800, dmg: 7, cd: .45, r: 11, col: '#f97316', snd: 'shoot', trail: p => P({ x: p.x, y: p.y, vy: -60, size: 7, col: pick(['#f97316', '#facc15', '#ef4444']), life: .3 }), drawFn: (c, p) => orb(c, p.x, p.y, 10, '#fde68a', '#f97316', p.t) }); },
  sp(f) { sfx('special'); txt(f.x, f.y - 140, '◉', '#dc2626', 50, .8); shoot(f, { kind: 'cast', speed: 1200, dmg: 10, cd: .5, r: 14, col: '#1e1b2e', snd: 'flash', onHit: (p, e) => { e.burn = 4; e.burnSrc = f; }, trail: p => P({ x: p.x, y: p.y, vy: -80, size: 9, col: pick(['#000', '#1e1b2e', '#4c1d95']), life: .4 }), drawFn: (c, p) => { glow(c, p.x, p.y, 30, 'rgba(76,29,149,.7)'); c.fillStyle = '#000'; c.beginPath(); c.arc(p.x, p.y, 12, 0, TAU); c.fill(); } }); } });

// projectile drawers
function drawRocket(c, p) { c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = '#ddd'; rr(c, -12, -4, 22, 8, 3); c.fill(); c.fillStyle = '#ef4444'; c.fillRect(6, -4, 6, 8); glow(c, -14, 0, 12, '#f97316'); c.restore(); }
function drawKunai(c, p) { c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.vy, p.vx)); WEAPONS.kunai.draw(c); c.restore(); glow(c, p.x, p.y, 14, 'rgba(251,191,36,.5)'); }
function drawWolf(c, p) {
  c.save(); c.translate(p.x, p.y); c.scale(Math.sign(p.vx) || 1, 1); const t = p.t * 18;
  glow(c, 0, 0, 50, 'rgba(49,46,129,.6)'); c.fillStyle = '#0b0a1a';
  c.beginPath(); c.ellipse(0, 0, 26, 12, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(20, -6); c.lineTo(40, -12); c.lineTo(44, -2); c.lineTo(22, 6); c.fill(); // head
  c.beginPath(); c.moveTo(26, -10); c.lineTo(30, -22); c.lineTo(34, -12); c.fill(); // ear
  c.beginPath(); c.moveTo(-24, -4); c.lineTo(-44, -14 + Math.sin(t) * 4); c.lineTo(-26, 2); c.fill(); // tail
  c.strokeStyle = '#0b0a1a'; c.lineWidth = 5; c.lineCap = 'round';
  for (const [x, ph] of [[-16, 0], [14, Math.PI]]) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x + Math.sin(t + ph) * 8, 22); c.stroke(); }
  c.fillStyle = '#e0e7ff'; c.beginPath(); c.arc(36, -6, 2.2, 0, TAU); c.fill();
  c.restore();
}

// ===== HEAD ACCESSORIES (head-local coords: center 0,0, radius r, facing +x) =====
const HEADS = {}, HLIST = [];
function defH(o) { HEADS[o.id] = Object.assign({ price: 100, eyes: 'normal' }, o); HLIST.push(HEADS[o.id]); }
defH({ id: 'none', name: 'Yok', price: 0, draw() { } });
defH({ id: 'headband', name: 'Ninja Bandanası', price: 0, draw(c, r, c1, c2) { c.fillStyle = '#1e3a8a'; c.fillRect(-r - 1, -r * .55, r * 2 + 2, r * .45); c.fillStyle = '#cbd5e1'; rr(c, r * .05, -r * .62, r * .8, r * .58, 2); c.fill(); c.strokeStyle = '#475569'; c.lineWidth = 1; c.beginPath(); c.arc(r * .45, -r * .33, r * .14, 0, TAU); c.stroke(); const t = T(); c.strokeStyle = '#1e3a8a'; c.lineWidth = r * .25; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r, -r * .35); c.lineTo(-r * 1.9, -r * .1 + Math.sin(t * 8) * 3); c.moveTo(-r, -r * .35); c.lineTo(-r * 1.7, r * .3 + Math.sin(t * 8 + 1) * 3); c.stroke(); } });
defH({ id: 'spikyGold', name: 'Altın Saç', price: 200, draw(c, r) { spiky(c, r, '#facc15', '#fde68a', 7); glow(c, 0, -r, r * 2.4, 'rgba(250,204,21,.25)'); } });
defH({ id: 'spikyPink', name: 'Pembe Diken Saç', price: 150, draw(c, r) { spiky(c, r, '#f472b6', '#fbcfe8', 5); } });
defH({ id: 'spikyBlack', name: 'Siyah Diken Saç', price: 150, draw(c, r) { spiky(c, r, '#111827', '#374151', 6, -1); } });
defH({ id: 'whiteHair', name: 'Beyaz Saç', price: 150, draw(c, r) { spiky(c, r, '#f1f5f9', '#fff', 6, 0); } });
defH({ id: 'blindfold', name: 'Göz Bandı', price: 250, eyes: 'none', draw(c, r) { spiky(c, r, '#f1f5f9', '#fff', 6, 0); c.fillStyle = '#0f172a'; c.fillRect(-r * .7, -r * .42, r * 1.75, r * .52); } });
defH({ id: 'strawhat', name: 'Hasır Şapka', price: 200, draw(c, r) { c.fillStyle = '#eab308'; c.beginPath(); c.ellipse(0, -r * .65, r * 1.9, r * .38, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, -r * .9, r * 1, r * .75, 0, Math.PI, TAU); c.fill(); c.fillStyle = '#dc2626'; c.fillRect(-r * .98, -r * 1.0, r * 1.96, r * .28); c.strokeStyle = '#a16207'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -r * .65, r * 1.9, r * .38, 0, 0, TAU); c.stroke(); } });
defH({ id: 'ninjamask', name: 'Ninja Maskesi', price: 150, draw(c, r) { c.fillStyle = '#334155'; c.beginPath(); c.arc(0, 0, r + .5, .05, Math.PI - .05); c.fill(); spiky(c, r, '#9ca3af', '#d1d5db', 5, 0); } });
defH({ id: 'horns', name: 'Oni Boynuzları', price: 200, eyes: 'red', draw(c, r) { c.fillStyle = '#fef3c7'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * .5, -r * .8); c.quadraticCurveTo(s * r * 1.1, -r * 1.6, s * r * .9, -r * 2.1); c.lineTo(s * r * .2, -r * .95); c.fill(); } } });
defH({ id: 'marks', name: 'Lanet Dövmeleri', price: 200, eyes: 'four', draw(c, r) { spiky(c, r, '#f9a8d4', '#fbcfe8', 5); c.strokeStyle = '#111'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(r * .1, r * .25); c.lineTo(r * .85, r * .25); c.moveTo(r * .2, r * .45); c.lineTo(r * .75, r * .45); c.stroke(); } });
defH({ id: 'crown', name: 'Taç', price: 300, draw(c, r) { c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(-r * .8, -r * .7); c.lineTo(-r * .8, -r * 1.5); c.lineTo(-r * .4, -r * 1.1); c.lineTo(0, -r * 1.7); c.lineTo(r * .4, -r * 1.1); c.lineTo(r * .8, -r * 1.5); c.lineTo(r * .8, -r * .7); c.fill(); c.fillStyle = '#ef4444'; c.beginPath(); c.arc(0, -r * .95, r * .15, 0, TAU); c.fill(); } });
defH({ id: 'halo', name: 'Hale', price: 250, draw(c, r) { glow(c, 0, -r * 1.5, r * 1.4, 'rgba(253,224,71,.5)'); c.strokeStyle = '#fde047'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -r * 1.5, r * .9, r * .28, 0, 0, TAU); c.stroke(); } });
defH({ id: 'cat', name: 'Kedi Kulakları', price: 120, draw(c, r, c1) { for (const s of [-1, 1]) { c.fillStyle = c1; c.beginPath(); c.moveTo(s * r * .2, -r * .9); c.lineTo(s * r * .75, -r * 1.65); c.lineTo(s * r * .95, -r * .55); c.fill(); c.fillStyle = '#f9a8d4'; c.beginPath(); c.moveTo(s * r * .4, -r * .85); c.lineTo(s * r * .72, -r * 1.35); c.lineTo(s * r * .82, -r * .7); c.fill(); } } });
defH({ id: 'phones', name: 'Kulaklık', price: 120, draw(c, r, c1, c2) { c.strokeStyle = '#1f2937'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * 1.15, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.fillStyle = c2; rr(c, -r * .45, -r * .4, r * .7, r * .9, 3); c.fill(); } });
defH({ id: 'visor', name: 'Siber Vizör', price: 150, eyes: 'none', draw(c, r, c1, c2) { c.fillStyle = '#0f172a'; rr(c, -r * .2, -r * .5, r * 1.3, r * .6, 4); c.fill(); c.fillStyle = c2; c.fillRect(r * .05, -r * .32, r * .9, r * .2); glow(c, r * .5, -r * .22, r, c2, .6); } });
defH({ id: 'kabuto', name: 'Samuray Kabutosu', price: 300, draw(c, r) { c.fillStyle = '#7f1d1d'; c.beginPath(); c.arc(0, -r * .1, r * 1.12, Math.PI, TAU); c.fill(); c.fillRect(-r * 1.3, -r * .2, r * .9, r * .5); c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(0, -r * .9); c.lineTo(-r * .8, -r * 2); c.lineTo(-r * .1, -r * 1.1); c.lineTo(r * .8, -r * 2); c.lineTo(r * .1, -r * .9); c.fill(); } });
defH({ id: 'foxmask', name: 'Tilki Maskesi', price: 200, draw(c, r) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-r * .55, -r * .2, r * .55, r * .75, -.3, 0, TAU); c.fill(); c.fillStyle = '#ef4444'; c.fillRect(-r * .8, -r * .35, r * .35, r * .1); c.fillRect(-r * .8, 0, r * .35, r * .1); spiky(c, r, '#f97316', '#fdba74', 5); } });
defH({ id: 'tophat', name: 'Silindir Şapka', price: 150, draw(c, r) { c.fillStyle = '#111827'; c.fillRect(-r * 1.2, -r * .9, r * 2.4, r * .3); c.fillRect(-r * .75, -r * 2.2, r * 1.5, r * 1.35); c.fillStyle = '#dc2626'; c.fillRect(-r * .75, -r * 1.15, r * 1.5, r * .25); } });
defH({ id: 'redeyes', name: 'Kızıl Gözler', price: 150, eyes: 'red', draw(c, r) { spiky(c, r, '#111827', '#1f2937', 4, -1); } });
function spiky(c, r, col, hi, n, dir = 0) {
  c.fillStyle = col; c.beginPath(); c.moveTo(-r * 1.05, r * .1);
  for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI, a2 = Math.PI + ((i + .5) / n) * Math.PI;
    c.lineTo(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02 - r * .05); if (i < n) c.lineTo(Math.cos(a2) * r * 1.75 - r * .3 + dir * 2, Math.sin(a2) * r * 1.75 - r * .15); }
  c.lineTo(r * 1.0, -r * .3); c.quadraticCurveTo(0, -r * .55, -r * .9, r * .15); c.closePath(); c.fill();
  c.fillStyle = hi; c.globalAlpha *= .5; c.beginPath(); c.arc(-r * .2, -r * .7, r * .35, 0, TAU); c.fill(); c.globalAlpha = 1;
}

// ===== BACK ACCESSORIES (drawn in world coords) =====
const BACKS = {}, BLIST = [];
function defB(o) { BACKS[o.id] = Object.assign({ price: 100 }, o); BLIST.push(BACKS[o.id]); }
defB({ id: 'none', name: 'Yok', price: 0, draw() { } });
defB({ id: 'scarf', name: 'Uçuşan Atkı', price: 0, draw(c, f, J) { const t = T(), F = f.face, [nx, ny] = J.neck, s = f.s; c.strokeStyle = f.c2; c.lineWidth = 6 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(nx, ny + 2 * s); let x = nx, y = ny; for (let i = 1; i <= 5; i++) { x -= F * (9 + Math.abs(f.vx) * .02) * s; y += (3 - Math.abs(f.vx) * .004 * i) * s + Math.sin(t * 10 + i) * 2.5 * s; c.lineTo(x, y); } c.stroke(); } });
defB({ id: 'cape', name: 'Pelerin', price: 200, draw(c, f, J) { const t = T(), F = f.face, s = f.s, [nx, ny] = J.neck, flow = clamp(Math.abs(f.vx) / 400, 0, 1); c.fillStyle = shade(f.c2, -.3); c.beginPath(); c.moveTo(nx - 6 * s, ny); c.lineTo(nx + 6 * s * F * 0, ny); c.quadraticCurveTo(nx - F * (20 + flow * 30) * s, ny + 30 * s, nx - F * (14 + flow * 50) * s + Math.sin(t * 8) * 4, ny + (60 - flow * 20) * s); c.lineTo(nx - F * (2 + flow * 25) * s, ny + (62 - flow * 15) * s); c.closePath(); c.fill(); } });
defB({ id: 'haori', name: 'Haori Ceket', price: 250, draw(c, f, J) { const s = f.s, [nx, ny] = J.neck, [hx, hy] = J.hip, F = f.face; c.fillStyle = f.c2; c.beginPath(); c.moveTo(nx - 8 * s * F, ny); c.lineTo(nx + 8 * s * F, ny); c.lineTo(hx + 14 * s * F, hy + 16 * s); c.lineTo(hx - 18 * s * F, hy + 16 * s); c.closePath(); c.globalAlpha = .9; c.fill(); c.globalAlpha = 1; c.strokeStyle = '#0a0d1a'; c.lineWidth = 2; c.stroke(); } });
defB({ id: 'wings', name: 'Melek Kanatları', price: 350, draw(c, f, J) { const t = T(), s = f.s, [nx, ny] = J.neck, F = f.face, fl = Math.sin(t * 6) * .25; c.fillStyle = 'rgba(255,255,255,.9)'; for (const k of [1, .7]) { c.save(); c.translate(nx - F * 4 * s, ny + 10 * s); c.scale(-F * k, 1); c.rotate(-.3 + fl); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(30 * s, -40 * s, 55 * s, -30 * s); c.quadraticCurveTo(40 * s, -10 * s, 45 * s, 0); c.quadraticCurveTo(25 * s, 5 * s, 0, 8 * s); c.fill(); c.restore(); } } });
defB({ id: 'jetpack', name: 'Jetpack', price: 300, draw(c, f, J) { const s = f.s, [nx, ny] = J.neck, F = f.face; c.fillStyle = '#475569'; rr(c, nx - F * 14 * s - 7 * s, ny + 4 * s, 14 * s, 26 * s, 4); c.fill(); c.fillStyle = f.c2; c.fillRect(nx - F * 14 * s - 5 * s, ny + 10 * s, 10 * s, 3 * s); if (!f.onG) { glow(c, nx - F * 14 * s, ny + 36 * s, 16 * s, '#f97316'); P({ x: nx - F * 14 * s, y: ny + 32 * s, vy: 200, size: 4, col: pick(['#f97316', '#facc15']), life: .2 }); } } });
defB({ id: 'sheath', name: 'Sırt Kılıcı', price: 150, draw(c, f, J) { const s = f.s, [nx, ny] = J.neck, F = f.face; c.save(); c.translate(nx - F * 5 * s, ny + 15 * s); c.rotate(F > 0 ? -2.3 : -.84); c.fillStyle = '#1f2937'; rr(c, -4 * s, -3 * s, 60 * s, 7 * s, 3); c.fill(); c.fillStyle = '#b91c1c'; c.fillRect(-14 * s, -2 * s, 10 * s, 5 * s); c.restore(); } });
defB({ id: 'tails', name: 'Tilki Kuyrukları', price: 300, draw(c, f, J) { const t = T(), s = f.s, [hx, hy] = J.hip, F = f.face; for (let i = 0; i < 3; i++) { c.strokeStyle = i % 2 ? '#fdba74' : '#f97316'; c.lineWidth = 7 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx - F * 25 * s, hy - (10 + i * 12) * s + Math.sin(t * 5 + i) * 5, hx - F * (30 + i * 4) * s, hy - (30 + i * 16) * s); c.stroke(); } } });
defB({ id: 'aura', name: 'Enerji Aurası', price: 400, draw(c, f, J) { const t = T(), s = f.s, [hx, hy] = J.hip; glow(c, hx, hy - 20 * s, 70 * s, f.c2, .35 + Math.sin(t * 9) * .1); if (Math.random() < .3) P({ x: hx + rnd(-25, 25) * s, y: hy + rnd(-30, 40) * s, vy: -160, size: 3, col: f.c2, life: .5 }); } });

// ===== CHARACTER PRESETS =====
const CHARS = [
  { id: 'kitsune', name: 'Kitsune', weapon: 'spiral', head: 'headband', back: 'tails', c1: '#f97316', c2: '#1e293b' },
  { id: 'raiko', name: 'Raiko', weapon: 'chidori', head: 'spikyBlack', back: 'scarf', c1: '#1e3a8a', c2: '#93c5fd' },
  { id: 'kiroi', name: 'Sarı Şimşek', weapon: 'kunai', head: 'headband', back: 'cape', c1: '#facc15', c2: '#f8fafc' },
  { id: 'kage', name: 'Kage', weapon: 'clone', head: 'ninjamask', back: 'sheath', c1: '#475569', c2: '#cbd5e1' },
  { id: 'infinity', name: 'Sonsuz', weapon: 'void', head: 'blindfold', back: 'none', c1: '#0f172a', c2: '#60a5fa' },
  { id: 'cursedking', name: 'Lanet Kral', weapon: 'shrine', head: 'marks', back: 'haori', c1: '#be185d', c2: '#f5f5f4' },
  { id: 'vessel', name: 'Kap', weapon: 'cursed', head: 'spikyPink', back: 'none', c1: '#1e293b', c2: '#dc2626' },
  { id: 'gold', name: 'Altın Savaşçı', weapon: 'ki', head: 'spikyGold', back: 'aura', c1: '#ea580c', c2: '#facc15' },
  { id: 'reaper', name: 'Ruh Biçen', weapon: 'moonfang', head: 'spikyGold', back: 'haori', c1: '#111827', c2: '#e5e7eb' },
  { id: 'tide', name: 'Gelgit', weapon: 'water', head: 'none', back: 'haori', c1: '#7f1d1d', c2: '#16a34a' },
  { id: 'straw', name: 'Hasır', weapon: 'rubber', head: 'strawhat', back: 'none', c1: '#dc2626', c2: '#2563eb' },
  { id: 'shadowh', name: 'Gölge Avcı', weapon: 'shadow', head: 'spikyBlack', back: 'none', c1: '#111827', c2: '#6366f1' },
  { id: 'crimson', name: 'Kızıl Göz', weapon: 'blackflame', head: 'redeyes', back: 'cape', c1: '#1f2937', c2: '#dc2626' },
  { id: 'cyber', name: 'Siber Op', weapon: 'plasma', head: 'visor', back: 'jetpack', c1: '#22d3ee', c2: '#a78bfa' },
  { id: 'ronin', name: 'Ronin', weapon: 'katana', head: 'kabuto', back: 'scarf', c1: '#ff3b5c', c2: '#ffd23f' },
  { id: 'tank', name: 'Tank', weapon: 'hammer', head: 'crown', back: 'cape', c1: '#14b8a6', c2: '#fbbf24' },
  { id: 'sniper', name: 'Keskin Nişancı', weapon: 'sniper', head: 'phones', back: 'none', c1: '#e11d48', c2: '#fda4af' },
  { id: 'boom', name: 'Bomba', weapon: 'rocket', head: 'tophat', back: 'jetpack', c1: '#65a30d', c2: '#fde047' },
];
const COLORS = ['#ff3b5c', '#f97316', '#facc15', '#84cc16', '#22c55e', '#14b8a6', '#22d3ee', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f5f5f4', '#94a3b8', '#475569', '#1e293b', '#0b0b12', '#7f1d1d', '#be185d', '#ffd23f', '#a78bfa'];

// ===== MAPS =====
const MAPS = [
  { name: 'Neon Şehir', theme: 'city', plats: [[0, 640, 1280, 80], [170, 470, 260, 16], [850, 470, 260, 16], [510, 320, 260, 16]], spawn: [[260, 640], [1020, 640], [640, 320], [640, 640]] },
  { name: 'Sakura Dojo', theme: 'dojo', plats: [[0, 640, 1280, 80], [100, 500, 220, 16], [960, 500, 220, 16], [400, 390, 480, 16], [560, 240, 160, 16]], spawn: [[200, 640], [1080, 640], [640, 390], [640, 640]] },
  { name: 'Lanetli Tapınak', theme: 'cursed', plats: [[0, 640, 480, 80], [800, 640, 480, 80], [540, 530, 200, 16], [170, 420, 230, 16], [880, 420, 230, 16], [520, 290, 240, 16]], spawn: [[220, 640], [1060, 640], [640, 290], [640, 530]] },
  { name: 'Gökyüzü Adası', theme: 'sky', plats: [[120, 610, 440, 34], [720, 610, 440, 34], [520, 440, 240, 18], [40, 380, 170, 18], [1070, 380, 170, 18], [560, 250, 160, 18]], spawn: [[300, 610], [980, 610], [640, 440], [640, 250]] },
];
