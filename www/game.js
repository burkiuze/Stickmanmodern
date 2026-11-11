'use strict';
// ===== Canvas =====
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let SC = 1, OX = 0, OY = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const w = innerWidth, h = innerHeight; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  SC = Math.min(w / W, h / H); OX = (w - W * SC) / 2; OY = (h - H * SC) / 2; bgCache = {};
}
addEventListener('resize', resize);

// ===== Game state =====
const G = window.G = {
  time: 0, fighters: [], projs: [], fx: [], tasks: [], map: MAPS[1], state: 'menu', paused: false,
  hitstop: 0, ts: 1, tsT: 0, shake: 0, flash: 0, domain: null, banner: null, cfg: null, wins: [0, 0], round: 1,
  wave: 0, kills: 0, endT: 0, intro: 0
};
function after(t, fn) { G.tasks.push({ t, fn }); }
function foes(f) { return G.fighters.filter(e => !e.dead && e.team !== f.team); }

// ===== Fighter =====
class Fighter {
  constructor(o) {
    Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, face: 1, hp: 100, maxhp: 100, en: 25, s: 1, team: 0, onG: false, jumps: 0,
      atkT: 0, atkDur: 1, atkCd: 0, atkKind: 'swing', stun: 0, inv: 0, lock: 0, dead: false, rag: null, anim: 0, flash: 0,
      minion: false, life: 1e9, burn: 0, burnTick: 0, kills: 0, input: null, ai: null, dash: null, charging: 0, aim: 0,
      mark: null, slam: false, boss: false, hpShow: 100, pi: -1, ghostT: 0 }, o);
    const L = o.load || save.load[0];
    this.c1 = L.c1; this.c2 = L.c2; this.head = L.head; this.back = L.back; this.name = o.name || L.name;
    let wid = L.weapon; if (wid === 'random') wid = pick(WLIST.filter(w => save.owned.w.includes(w.id) || w.price === 0)).id;
    this.weapon = wid; this.wp = WEAPONS[wid] || WEAPONS.fists;
    this.hp = this.maxhp = o.hp || 100; this.hpShow = this.hp;
  }
  cy() { return this.y - 50 * this.s; }
  update(dt) {
    if (this.dead) { if (this.rag) updRag(this.rag, dt); return; }
    const inp = this.ai ? this.ai.think(this, dt) : (this.input ? this.input() : {});
    this.atkT = Math.max(0, this.atkT - dt); this.atkCd -= dt; this.stun -= dt; this.inv -= dt; this.lock -= dt; this.flash -= dt;
    this.charging = Math.max(0, this.charging - dt);
    this.hpShow = lerp(this.hpShow, this.hp, Math.min(1, dt * 4));
    if (this.mark) { this.mark.t -= dt; if (this.mark.t <= 0) this.mark = null; }
    if (this.burn > 0) { this.burn -= dt; this.burnTick -= dt; if (Math.random() < .5) P({ x: this.x + rnd(-12, 12) * this.s, y: this.y - rnd(10, 90) * this.s, vy: -120, size: rnd(4, 8), col: pick(['#000', '#1e1b2e', '#4c1d95']), life: .4 });
      if (this.burnTick <= 0) { this.burnTick = .25; this.hp -= 1.3; this.flash = .05; if (this.hp <= 0) { this.kill(0, -200, this.burnSrc); return; } } }
    if (this.minion) { this.life -= dt; if (this.life <= 0) { this.kill(0, 0); return; } }
    if (G.intro > 0) inp.l = inp.r = inp.a = inp.jp = inp.sp = 0;
    const ctl = this.stun <= 0 && this.lock <= 0 && !this.dash;
    let mv = 0; if (ctl) { if (inp.l) mv -= 1; if (inp.r) mv += 1; }
    if (this.dash) {
      const d = this.dash; d.t -= dt; this.vx = d.vx; this.vy = 0;
      this.ghostT -= dt; if (this.ghostT <= 0) { this.ghostT = .025; P({ type: 'ghost', f: this, x: this.x, y: this.y, col: d.o.col, life: .22 }); }
      if (d.o.bolt && Math.random() < .5) bolt(this.x, this.cy(), this.x - this.face * rnd(40, 120), this.cy() + rnd(-30, 30), d.o.col, .12);
      for (const e of foes(this)) if (!d.hits.has(e) && Math.abs(e.x - this.x) < 34 * this.s + 14 * e.s && Math.abs(e.cy() - this.cy()) < 50 * this.s + 40 * e.s) {
        d.hits.add(e); if (hit(e, d.o.dmg, this.face * d.o.kx, d.o.ky, this, d.o) && d.o.fx) d.o.fx(e);
      }
      if (d.t <= 0) { this.dash = null; this.vx *= .25; }
    } else {
      const spd = (this.boss ? 260 : 390), tgt = mv * spd;
      if (ctl) this.vx += (tgt - this.vx) * Math.min(1, dt * (this.onG ? 16 : 7));
      else this.vx *= Math.max(0, 1 - dt * (this.onG ? 7 : 1.2));
      if (mv && this.atkT <= 0) this.face = mv;
      if (ctl && inp.face && (inp.a || inp.sp)) this.face = inp.face;
      if (ctl && inp.jp && this.jumps < 2) { this.vy = this.jumps ? -760 : -840; if (this.boss) this.vy *= .8; this.jumps++; this.onG = false; sfx('jump'); if (this.jumps === 2) ring(this.x, this.y, 30, 'rgba(255,255,255,.6)', .25, 3); else smoke(this.x, this.y, 3, 'rgba(255,255,255,.25)'); }
      if (ctl && inp.a && this.atkCd <= 0) this.wp.atk(this);
      if (ctl && inp.sp && this.en >= this.wp.cost && this.atkCd <= .15) { this.en -= this.wp.cost; this.atkCd = .2; this.wp.sp(this); }
      this.vy += GRAV * dt * (this.charging > 0 || this.lock > 0 && this.atkKind === 'cast' ? .15 : 1);
      if (this.vy > 1500) this.vy = 1500;
    }
    if (!this.minion) this.en = Math.min(100, this.en + dt * 7);
    this.physics(dt);
    this.anim += this.onG ? Math.abs(this.vx) * dt * .028 : dt * 4;
  }
  physics(dt) {
    const prevY = this.y; this.x += this.vx * dt; this.y += this.vy * dt; const was = this.onG; this.onG = false;
    if (this.vy >= 0) for (const p of G.map.plats) {
      if (this.x > p[0] - 4 && this.x < p[0] + p[2] + 4 && prevY <= p[1] + 1 && this.y >= p[1]) {
        this.y = p[1]; if (!was && this.vy > 900) smoke(this.x, this.y, 4, 'rgba(255,255,255,.3)');
        this.vy = 0; this.onG = true; this.jumps = 0;
        if (this.slam) { this.slam = false; doSlam(this); } break;
      }
    }
    if (this.x < 16) { this.x = 16; this.vx = Math.abs(this.vx) * .3; } if (this.x > W - 16) { this.x = W - 16; this.vx = -Math.abs(this.vx) * .3; }
    if (this.y > H + 180) this.kill(0, 0, this.lastHitBy, true);
  }
  kill(kx = 0, ky = 0, src, fell) {
    if (this.dead) return; this.dead = true; this.hp = 0; this.dash = null; this.charging = 0;
    if (this.minion) { smoke(this.x, this.cy(), 10); ring(this.x, this.cy(), 50, '#fff', .3); G.onDeath(this, src); return; }
    if (!fell) this.rag = makeRag(this, kx, ky);
    burst(this.x, this.cy(), 30, [this.c1, this.c2, '#fff'], 500, .7, 4); ring(this.x, this.cy(), 90, this.c1, .5, 8); sfx('ko');
    if (src && src !== this && !src.dead) src.kills++;
    G.onDeath(this, src);
  }
}

function hit(e, dmg, kx, ky, src, o = {}) {
  if (!e || e.dead || e.inv > 0) return false;
  const wg = e.boss ? 3.2 : 1; e.hp -= dmg; e.lastHitBy = src;
  if (kx !== undefined) e.vx = kx / wg; if (ky) { e.vy = ky / wg; e.onG = false; }
  e.stun = Math.max(e.stun, (o.stun !== undefined ? o.stun : .14 + dmg * .009) / (e.boss ? 2 : 1)); e.flash = .1;
  if (e.dash && !e.boss) e.dash = null;
  if (src && !src.dead && !src.minion) src.en = Math.min(100, src.en + dmg * .9);
  e.en = Math.min(100, e.en + dmg * .35);
  const hx = e.x, hy = e.cy();
  burst(hx, hy, Math.min(22, 3 + dmg | 0), o.hitCol || [e.c1, '#fff'], 220 + dmg * 14, .35, 3, 500);
  if (!o.quiet) {
    if (dmg >= 4) txt(hx + rnd(-10, 10), hy - 60 * e.s, Math.round(dmg), dmg >= 18 ? '#ffd23f' : '#fff', 18 + Math.min(18, dmg), .7);
    G.hitstop = Math.max(G.hitstop, Math.min(.09, dmg * .0035)); G.shake = Math.max(G.shake, Math.min(16, dmg * .45));
    sfx(dmg >= 15 ? 'heavy' : 'hit'); if (dmg >= 10) ring(hx, hy, 40 + dmg, 'rgba(255,255,255,.8)', .25, 4);
  }
  if (e.hp <= 0) e.kill(kx, ky, src);
  return true;
}

function melee(f, o) {
  const s = f.s; f.atkKind = o.kind || 'swing'; f.atkT = f.atkDur = o.dur || .24; f.atkCd = o.cd !== undefined ? o.cd : .35;
  if (o.snd !== null) sfx(o.snd || 'swing');
  after(o.delay !== undefined ? o.delay : .07, () => {
    if (f.dead) return; const R = (o.range || 70) * s, hh = (o.h || 80) * s, cy = f.cy(); let any = false;
    for (const e of foes(f)) {
      const dx = (e.x - f.x) * f.face;
      if ((o.both ? Math.abs(dx) < R + 12 * e.s : (dx > -18 * s && dx < R + 12 * e.s)) && Math.abs(e.cy() - cy) < hh / 2 + 40 * e.s) {
        if (hit(e, o.dmg, (o.both ? Math.sign(e.x - f.x) || 1 : f.face) * (o.kx !== undefined ? o.kx : 350), o.ky !== undefined ? o.ky : -220, f, o)) { any = true; o.onHit && o.onHit(e); }
      }
    }
    if (o.fx !== false && o.dmg > 0) slashFx(f.x + f.face * 8 * s, cy - 6 * s, f.face > 0 ? 0 : Math.PI, R * .75, o.col || 'rgba(255,255,255,.9)', .17, (o.w || 6) * s);
  });
}
function aimAt(f) {
  let best = null, bd = 900;
  for (const e of foes(f)) { const dx = (e.x - f.x) * f.face; if (dx > 0 && dx < bd) { bd = dx; best = e; } }
  if (!best) return 0; const lim = f.boss ? 1.1 : .45;
  return clamp(Math.atan2(best.cy() - (f.y - 72 * f.s), Math.abs(best.x - f.x)), -lim, lim);
}
function shoot(f, o) {
  f.atkKind = o.kind || (f.wp.kind === 'gun' ? 'shoot' : 'cast'); f.atkT = f.atkDur = o.dur || .16; f.atkCd = o.cd !== undefined ? o.cd : .3;
  if (o.snd !== null) sfx(o.snd || 'shoot');
  const a0 = aimAt(f); f.aim = a0; const mx = f.x + f.face * 48 * f.s, my = f.y - 72 * f.s + Math.sin(a0) * 40 * f.s, n = o.n || 1;
  for (let i = 0; i < n; i++) {
    const a = a0 + (n > 1 ? (i / (n - 1) - .5) * o.spread : 0);
    const p = new Proj(Object.assign({}, o, { x: mx, y: my, vx: Math.cos(a) * o.speed * f.face, vy: Math.sin(a) * o.speed + (o.vy0 || 0), owner: f }));
    G.projs.push(p);
  }
  if (f.wp.kind === 'gun') { burst(mx, my, 5, o.col, 160, .12, 3, 0); glowFlash(mx, my, o.col); }
}
function glowFlash(x, y, col) { P({ x, y, type: 'dot', size: 14, col, life: .06, g: 0 }); }
function dash(f, dist, time, o) { f.dash = { t: time, vx: f.face * dist / time * f.s, hits: new Set(), o }; f.inv = time + .05; f.atkKind = 'punch'; f.atkT = f.atkDur = time + .12; f.atkCd = .25; }
function charge(f, time, col, then, drawFn) {
  f.lock = time + .05; f.charging = time; f.chargeMax = time; f.chargeCol = col; f.chargeDraw = drawFn; f.atkKind = 'cast'; f.atkT = f.atkDur = time;
  sfx('special'); after(time, () => { if (f.dead) return; f.charging = 0; then(); });
}
function rayHit(f, o) {
  const a = aimAt(f), x0 = f.x + f.face * 50 * f.s, y0 = f.y - 72 * f.s, dx = Math.cos(a) * f.face, dy = Math.sin(a), len = 1500;
  const c = [];
  for (const e of foes(f)) { const ex = e.x - x0, ey = e.cy() - y0, t = ex * dx + ey * dy; if (t < 0 || t > len) continue; const px = ex - dx * t, py = ey - dy * t; if (Math.abs(px) < 16 * e.s + o.th && Math.abs(py) < 50 * e.s + o.th) c.push([t, e]); }
  c.sort((a, b) => a[0] - b[0]); let end = len;
  for (const [t, e] of c) { hit(e, o.dmg, f.face * o.kx, o.ky, f, o); if (!o.pierce) { end = t; break; } }
  const x2 = x0 + dx * end, y2 = y0 + dy * end;
  P({ type: 'line', x: x0, y: y0, x2, y2, col: o.col, w: o.th * 2 + 6, life: .3 }); P({ type: 'line', x: x0, y: y0, x2, y2, col: '#fff', w: o.th * .8 + 2, life: .25 });
  burst(x2, y2, 10, o.col, 300, .3, 3, 0); f.aim = a; f.vx -= f.face * (o.pierce ? 500 : 150);
}
function explode(x, y, r, dmg, owner, col) {
  sfx('boom'); G.shake = Math.max(G.shake, 12); ring(x, y, r, col, .4, 10); ring(x, y, r * .6, '#fff', .3, 6);
  burst(x, y, 26, [col, '#ffd23f', '#fff'], 500, .5, 4, 300); smoke(x, y, 8, 'rgba(60,60,70,.6)');
  for (const e of G.fighters) { if (e.dead || e.team === owner.team) continue; const dx = e.x - x, dy = e.cy() - y, d = Math.hypot(dx, dy); if (d < r + 30 * e.s) { const k = 1 - d / (r + 40); hit(e, dmg * (.5 + k * .5), Math.sign(dx || 1) * (300 + 500 * k), -300 - 400 * k, owner); } }
}
function doSlam(f) {
  sfx('boom'); G.shake = 16; ring(f.x, f.y, 160, '#5eead4', .5, 10); burst(f.x, f.y, 30, ['#5eead4', '#fff', '#94a3b8'], 500, .5, 4, 800);
  for (const e of foes(f)) { const d = Math.abs(e.x - f.x); if (d < 170 * f.s && Math.abs(e.y - f.y) < 90) hit(e, 22, Math.sign(e.x - f.x || 1) * 600, -650, f); }
  for (const d of [-1, 1]) G.projs.push(new Proj({ x: f.x, y: f.y - 18, vx: d * 700, vy: 0, owner: f, r: 18, dmg: 10, pierce: true, life: .55, kx: 400, ky: -500, solid: false, col: '#5eead4',
    drawFn: (c, p) => { c.fillStyle = 'rgba(94,234,212,.7)'; c.beginPath(); c.moveTo(p.x - 20, p.y + 18); c.lineTo(p.x, p.y - 22 * (p.life / .55) - 6); c.lineTo(p.x + 20, p.y + 18); c.fill(); } }));
}
function blackFlash(f, e) {
  after(0, () => {
    if (e.dead) return; hit(e, 13, f.face * 900, -500, f, { hitCol: ['#000', '#dc2626', '#000'] });
    G.ts = .2; G.tsT = .45; G.flash = .15; sfx('flash');
    for (let i = 0; i < 8; i++) bolt(e.x, e.cy(), e.x + rnd(-150, 150), e.cy() + rnd(-150, 150), i % 2 ? '#000' : '#dc2626', .35, 5);
    ring(e.x, e.cy(), 130, '#000', .4, 14); ring(e.x, e.cy(), 90, '#dc2626', .35, 8); txt(e.x, e.y - 130 * e.s, 'KARA ŞİMŞEK!', '#ef4444', 34, 1.2);
  });
}
function slashCut(e) { const a = rnd(0, Math.PI), l = 60 * e.s, x = e.x + rnd(-10, 10), y = e.cy() + rnd(-30, 30); P({ type: 'line', x: x - Math.cos(a) * l, y: y - Math.sin(a) * l, x2: x + Math.cos(a) * l, y2: y + Math.sin(a) * l, col: '#fff', w: 3, life: .18 }); burst(x, y, 3, '#ef4444', 200, .3, 2.5); }
function spawnClone(f, d) {
  if (G.fighters.filter(c => c.minion && c.owner === f && !c.dead).length >= 4) return;
  const c = new Fighter({ x: clamp(f.x + d * 40, 30, W - 30), y: f.y - 2, team: f.team, load: { weapon: 'clone', head: f.head, back: f.back, c1: f.c1, c2: f.c2, name: 'Klon' }, minion: true, life: 8, hp: 20, ai: new AI(1, true), owner: f });
  c.face = f.face; c.vy = -400; smoke(c.x, c.cy(), 10); G.fighters.push(c);
}
function kiBeam(f) {
  f.lock = 1.35; f.atkKind = 'cast'; f.atkT = f.atkDur = 1.35;
  return { t: 1.25, tick: 0,
    update(dt) { this.t -= dt; if (f.dead) { this.t = 0; return; } this.tick -= dt; const y = f.y - 66 * f.s, x0 = f.x + f.face * 34 * f.s;
      if (this.tick <= 0) { this.tick = .06; for (const e of foes(f)) { const dx = (e.x - x0) * f.face; if (dx > -10 && Math.abs(e.cy() - y) < 40 * f.s + 45 * e.s) hit(e, 1.9, f.face * 450, -100, f, { stun: .2, quiet: 1, hitCol: ['#38bdf8', '#fff'] }); } }
      G.shake = Math.max(G.shake, 5); },
    draw(c) { const y = f.y - 66 * f.s, x0 = f.x + f.face * 34 * f.s, k = Math.min(1, this.t * 5), th = (30 + Math.sin(G.time * 70) * 5) * k * f.s, x1 = f.face > 0 ? W + 50 : -50;
      c.globalAlpha = .35; c.fillStyle = '#38bdf8'; c.fillRect(Math.min(x0, x1), y - th * 1.6, Math.abs(x1 - x0), th * 3.2);
      c.globalAlpha = .9; c.fillStyle = '#7dd3fc'; c.fillRect(Math.min(x0, x1), y - th, Math.abs(x1 - x0), th * 2);
      c.fillStyle = '#fff'; c.fillRect(Math.min(x0, x1), y - th * .45, Math.abs(x1 - x0), th * .9); c.globalAlpha = 1;
      orb(c, x0, y, th * 1.4 + 6, '#fff', '#38bdf8', G.time); } };
}

// ===== Projectiles =====
class Proj {
  constructor(o) { Object.assign(this, { r: 6, life: 1.5, grav: 0, pierce: false, dmg: 5, kx: 200, ky: -100, col: '#0ff', solid: true, t: 0 }, o); this.hits = new Set(); this.team = this.owner.team; }
  step(dt) {
    this.t += dt; this.life -= dt; if (this.upd) this.upd(this, dt);
    if (this.home && this.t > .15) { let b = null, bd = 1e9; for (const e of foes(this.owner)) { const d = Math.hypot(e.x - this.x, e.cy() - this.y); if (d < bd) { bd = d; b = e; } }
      if (b) { const sp = Math.hypot(this.vx, this.vy), a = Math.atan2(this.vy, this.vx), ta = Math.atan2(b.cy() - this.y, b.x - this.x); let da = ta - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; const na = a + clamp(da, -5 * dt, 5 * dt); this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp; } }
    this.vy += this.grav * dt; this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.trail) this.trail(this);
    for (const e of G.fighters) {
      if (e.dead || e.team === this.team || this.hits.has(e)) continue;
      if (Math.abs(e.x - this.x) < 14 * e.s + this.r && this.y > e.y - 100 * e.s - this.r && this.y < e.y + this.r) {
        this.hits.add(e); const d = Math.sign(this.vx) || 1;
        if (hit(e, this.dmg, d * this.kx, this.ky, this.owner, this) && this.onHit) this.onHit(this, e);
        if (!this.pierce) { this.die(); return; }
      }
    }
    if (this.solid) for (const p of G.map.plats) if (this.x > p[0] && this.x < p[0] + p[2] && this.y > p[1] && this.y < p[1] + p[3]) { this.die(true); return; }
    if (this.life <= 0 || this.x < -80 || this.x > W + 80 || this.y > H + 80) this.die();
  }
  die(wall) { if (this.dead) return; this.dead = true; if (this.onDie) this.onDie(this, wall); else burst(this.x, this.y, 5, this.col, 180, .25, 2.5, 200); }
  draw(c) { if (this.drawFn) return this.drawFn(c, this); glow(c, this.x, this.y, this.r * 3, this.col, .8); c.fillStyle = '#fff'; c.beginPath(); c.arc(this.x, this.y, this.r * .7, 0, TAU); c.fill();
    c.strokeStyle = this.col; c.lineWidth = this.r; c.lineCap = 'round'; c.globalAlpha = .5; c.beginPath(); c.moveTo(this.x, this.y); c.lineTo(this.x - this.vx * .025, this.y - this.vy * .025); c.stroke(); c.globalAlpha = 1; }
}

// ===== Ragdoll =====
function makeRag(f, kx, ky) {
  const J = f.J || pose(f), k = STEP;
  const pts = [J.head, J.neck, J.hip, J.k1, J.f1, J.k2, J.f2, J.e1, J.h1, J.e2, J.h2].map(p => {
    const vx = (kx || f.vx) * rnd(.7, 1.3) + rnd(-80, 80), vy = (ky || f.vy || -300) * rnd(.7, 1.3) + rnd(-80, 80);
    return { x: p[0], y: p[1], ox: p[0] - vx * k, oy: p[1] - vy * k };
  });
  const L = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [1, 7], [7, 8], [1, 9], [9, 10], [0, 2]].map(([a, b]) => [a, b, Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)]);
  return { pts, L, f };
}
function updRag(r, dt) {
  for (const p of r.pts) { const vx = (p.x - p.ox) * .995, vy = (p.y - p.oy) * .995; p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + GRAV * dt * dt; }
  for (let it = 0; it < 4; it++) for (const [a, b, l] of r.L) { const A = r.pts[a], B = r.pts[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, df = (d - l) / d * .5; A.x += dx * df; A.y += dy * df; B.x -= dx * df; B.y -= dy * df; }
  for (const p of r.pts) {
    for (const pl of G.map.plats) if (p.x > pl[0] && p.x < pl[0] + pl[2] && p.y > pl[1] && p.oy <= pl[1] + 2) { p.y = pl[1]; p.ox = p.x - (p.x - p.ox) * .6; }
    if (p.x < 5) { p.x = 5; p.ox = p.x + (p.x - p.ox) * .5; } if (p.x > W - 5) { p.x = W - 5; p.ox = p.x + (p.x - p.ox) * .5; }
  }
}

// ===== Pose & drawing =====
function pose(f) {
  const s = f.s, F = f.face, x = f.x, y = f.y, t = G.time, run = f.onG ? clamp(Math.abs(f.vx) / 320, 0, 1) : 0, ph = f.anim;
  let a1, b1, a2, b2;
  if (!f.onG) { a1 = .75; b1 = -1.2; a2 = -.3; b2 = .5; }
  else if (run > .12) { a1 = Math.sin(ph) * .8 * run; a2 = -a1; b1 = -Math.max(0, Math.sin(ph + 1.7)) * 1.3 * run - .05; b2 = -Math.max(0, Math.sin(ph + 1.7 + Math.PI)) * 1.3 * run - .05; }
  else { const br = Math.sin(t * 3 + f.x) * .04; a1 = .55 + br; b1 = -.15; a2 = -.55 - br; b2 = .15; }
  const legH = Math.max(Math.cos(a1) * 24 + Math.cos(a1 + b1) * 24, Math.cos(a2) * 24 + Math.cos(a2 + b2) * 24);
  const bob = f.onG && run < .12 ? Math.sin(t * 3 + f.x) * 1.2 : 0;
  const lean = clamp(f.vx * F / 1700, -.18, .22) + (f.atkT > 0 && f.atkKind !== 'shoot' && f.atkKind !== 'cast' ? .14 : 0) + (f.stun > 0 ? -.2 : 0);
  const hip = [x, y - (f.onG ? legH : 46) * s + bob * s];
  const neck = [hip[0] + Math.sin(lean) * 34 * s * F, hip[1] - Math.cos(lean) * 34 * s];
  const head = [neck[0] + Math.sin(lean) * 15 * s * F, neck[1] - 15 * s];
  const leg = (a, b) => { const k = [hip[0] + Math.sin(a) * 24 * s * F, hip[1] + Math.cos(a) * 24 * s]; return [k, [k[0] + Math.sin(a + b) * 24 * s * F, k[1] + Math.cos(a + b) * 24 * s]]; };
  const [k1, f1] = leg(a1, b1), [k2, f2] = leg(a2, b2);
  const sh = [lerp(neck[0], hip[0], .1), lerp(neck[1], hip[1], .1)];
  // arms (angle 0 = forward, + = down)
  const wp = f.wp, pr = f.atkT > 0 ? 1 - f.atkT / f.atkDur : 1;
  let ua, ub = 0, ext = 1, hold = wp.hold, ua2 = 1.9 - Math.sin(ph) * .9 * run, ub2 = -.7;
  if (f.atkT > 0) {
    switch (f.atkKind) {
      case 'swing': ua = lerp(-2.3, 1.0, ease(pr)); hold = lerp(-.4, .3, pr); ub = 0; break;
      case 'slam': ua = f.onG ? 1.2 : -2.6; hold = 0; break;
      case 'punch': { const e = Math.sin(pr * Math.PI); ua = -.05; ub = (1 - e) * 1.8; ext = 1 + e * .15; ua2 = .6; ub2 = -1.8; break; }
      case 'stretch': { const e = Math.sin(pr * Math.PI); ua = -.03; ext = 1 + e * 5.2; ua2 = .7; ub2 = -1.8; break; }
      case 'gatling': ua = rnd(-.3, .3); ext = 1 + rnd(1.5, 3.8); ua2 = rnd(-.3, .3); ub2 = 0; break;
      case 'shoot': ua = f.aim; ub = 0; ext = 1 - (1 - pr) * .15; hold = 0; ua2 = f.aim + .35; ub2 = -.3; break;
      case 'cast': ua = -.05; ub = 0; ua2 = .05; ub2 = 0; hold = 0; break;
    }
  } else if (wp.kind === 'gun') { ua = .25; ub = -.25; ua2 = .7; ub2 = -.9; hold = -.1; }
  else if (wp.kind === 'fist') { ua = .55; ub = -2.0; ua2 = .9; ub2 = -2.1; }
  else { ua = .5; ub = -1.1; hold = wp.hold; }
  if (f.stun > 0 && f.atkT <= 0) { ua = -1.8; ub = .3; ua2 = -2; ub2 = .3; }
  const dir = a => [Math.cos(a) * F, Math.sin(a)];
  const arm = (a, b, e) => { const d1 = dir(a), el = [sh[0] + d1[0] * 19 * s * Math.min(e, 1.1), sh[1] + d1[1] * 19 * s * Math.min(e, 1.1)], d2 = dir(a + b), fl = e > 1.1 ? 19 + (e - 1) * 19 : 19 * e; return [el, [el[0] + d2[0] * fl * s, el[1] + d2[1] * fl * s]]; };
  const [e1, h1] = arm(ua, ub, ext), [e2, h2] = arm(ua2, ub2, 1);
  return { hip, neck, head, k1, f1, k2, f2, sh, e1, h1, e2, h2, wa: ua + ub + hold, ext };
}

function drawBody(c, f, alpha, tint) {
  const J = pose(f), s = f.s, col = tint || (f.flash > 0 ? '#ffffff' : f.c1);
  c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  const segs = [[J.sh, J.e2, J.h2], [J.hip, J.k2, J.f2], [J.neck, J.hip], [J.hip, J.k1, J.f1], [J.sh, J.e1, J.h1]];
  const path = p => { c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.stroke(); };
  if (!tint) { c.strokeStyle = '#0a0d1a'; c.lineWidth = 12.5 * s; segs.forEach(path); }
  c.strokeStyle = col; c.lineWidth = 7.5 * s;
  segs.forEach((p, i) => { c.strokeStyle = i < 2 && !tint ? shade(col, -.25) : col; path(p); });
  c.fillStyle = col; c.strokeStyle = '#0a0d1a'; c.lineWidth = 2.5 * s;
  c.beginPath(); c.arc(J.head[0], J.head[1], 13 * s, 0, TAU); c.fill(); if (!tint) c.stroke();
  c.restore(); return J;
}

function drawFighter(c, f) {
  if (f.dead) { if (f.rag) drawRag(c, f.rag); return; }
  const s = f.s, J = f.J = pose(f), F = f.face, alpha = f.minion ? .8 : (f.inv > 0 && !f.dash && (G.time * 20 | 0) % 2 ? .55 : 1);
  // shadow
  let gy = null; for (const p of G.map.plats) if (f.x > p[0] && f.x < p[0] + p[2] && p[1] >= f.y - 2 && (gy === null || p[1] < gy)) gy = p[1];
  if (gy !== null) { c.fillStyle = 'rgba(0,0,0,.35)'; const k = clamp(1 - (gy - f.y) / 400, .2, 1); c.beginPath(); c.ellipse(f.x, gy, 30 * s * k, 6 * s * k, 0, 0, TAU); c.fill(); }
  if (f.charging > 0) { const k = 1 - f.charging / f.chargeMax; glow(c, f.x, f.cy(), (70 + k * 50) * s, f.chargeCol, .5 + k * .3); if (Math.random() < .6) { const a = rnd(0, TAU), r = 90 * s; P({ x: f.x + Math.cos(a) * r, y: f.cy() + Math.sin(a) * r, vx: -Math.cos(a) * 300, vy: -Math.sin(a) * 300, size: 3, col: f.chargeCol, life: .3, drag: 0 }); } }
  c.save(); c.globalAlpha = alpha;
  const back = BACKS[f.back]; if (back) back.draw(c, f, J);
  c.restore();
  drawBody(c, f, alpha);
  c.save(); c.globalAlpha = alpha;
  // head extras
  const hd = HEADS[f.head] || HEADS.none, r = 13 * s;
  c.save(); c.translate(J.head[0], J.head[1]); c.scale(F, 1);
  if (hd.eyes !== 'none') {
    const ec = hd.eyes === 'red' ? '#ef4444' : '#fff';
    const blink = (G.time * 0.7 + f.x * .01) % 4 < .06; c.fillStyle = ec;
    const ey = f.stun > 0 ? 0 : -1 * s;
    for (const ex of [3 * s, 9 * s]) { c.beginPath(); c.ellipse(ex, ey, 2.4 * s, blink ? .5 : 3.8 * s, 0, 0, TAU); c.fill(); }
    if (hd.eyes === 'red') { c.fillStyle = '#000'; for (const ex of [3 * s, 9 * s]) { c.beginPath(); c.arc(ex, ey, 1 * s, 0, TAU); c.fill(); } }
    if (hd.eyes === 'four') { c.fillStyle = '#fff'; for (const ex of [4 * s, 10 * s]) { c.beginPath(); c.ellipse(ex, ey + 6 * s, 1.5 * s, 2 * s, 0, 0, TAU); c.fill(); } }
  }
  hd.draw(c, r, f.c1, f.c2);
  c.restore();
  // weapon
  if (f.wp.kind !== 'fist' || f.wp.draw) {
    c.save(); c.translate(J.h1[0], J.h1[1]); c.scale(F, 1); c.rotate(J.wa); c.scale(s, s); f.wp.draw(c, f); c.restore();
  }
  if (f.wp.kind === 'fist' && f.wp.id !== 'rubber' && f.atkT <= 0) { c.save(); c.translate(J.h2[0], J.h2[1]); c.scale(F * s, s); fist(c, f.c1); c.restore(); }
  if (f.chargeDraw && f.charging > 0) f.chargeDraw(c, f, f.charging / f.chargeMax);
  c.restore();
  if (f.mark) { const m = f.mark; c.save(); c.translate(m.x, m.y); c.rotate(-Math.PI / 2 - .3); WEAPONS.kunai.draw(c); c.restore(); glow(c, m.x, m.y - 10, 22, 'rgba(251,191,36,.6)'); }
}
function drawRag(c, r) {
  const p = r.pts, f = r.f, s = f.s; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, col] of [[12.5 * s, '#0a0d1a'], [7.5 * s, shade(f.c1, -.15)]]) { c.strokeStyle = col; c.lineWidth = w; for (const [a, b] of r.L.slice(0, 10)) { c.beginPath(); c.moveTo(p[a].x, p[a].y); c.lineTo(p[b].x, p[b].y); c.stroke(); } }
  c.fillStyle = shade(f.c1, -.15); c.strokeStyle = '#0a0d1a'; c.lineWidth = 2.5 * s; c.beginPath(); c.arc(p[0].x, p[0].y, 13 * s, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(p[0].x - 4 * s, p[0].y - 4 * s); c.lineTo(p[0].x + 4 * s, p[0].y + 4 * s); c.moveTo(p[0].x + 4 * s, p[0].y - 4 * s); c.lineTo(p[0].x - 4 * s, p[0].y + 4 * s); c.stroke();
}

// ===== AI =====
function groundBelow(x, y, depth = 700) { for (const p of G.map.plats) if (x > p[0] + 6 && x < p[0] + p[2] - 6 && p[1] >= y - 4 && p[1] < y + depth) return p; return null; }
class AI {
  constructor(lv, minion) { this.lv = lv; this.t = 0; this.mv = 0; this.atk = 0; this.minion = minion; this.jcd = 0; }
  think(f, dt) {
    const o = { l: 0, r: 0, a: 0, jp: 0, sp: 0, face: 0 }, lv = this.lv;
    let tg = null, bd = 1e9; for (const e of foes(f)) { const d = Math.abs(e.x - f.x) + Math.abs(e.y - f.y) * .7; if (d < bd) { bd = d; tg = e; } }
    if (!tg) return o;
    this.t -= dt; this.jcd -= dt;
    const dx = tg.x - f.x, dy = tg.y - f.y, adx = Math.abs(dx), wp = f.wp, R = wp.range * f.s, ranged = wp.range > 150;
    if (this.t <= 0) {
      this.t = [.38, .22, .1][lv] * rnd(.6, 1.4);
      if (ranged) this.mv = adx > R * .9 ? Math.sign(dx) : adx < R * .35 ? -Math.sign(dx) * (Math.random() < .6 ? 1 : 0) : (Math.random() < .25 ? pick([-1, 0, 1]) : 0);
      else this.mv = adx > R * .65 ? Math.sign(dx) : (Math.random() < .15 ? -Math.sign(dx) : 0);
      const vOk = Math.abs(tg.cy() - f.cy()) < (ranged ? 110 : 60) * f.s + 30 * tg.s;
      this.atk = adx < R * 1.1 + 10 && vOk && Math.random() < [.45, .7, .92][lv];
      if (dy < -80 && adx < 380 && f.onG && Math.random() < .6) this.jump = 1;
      if (Math.random() < [.02, .05, .08][lv]) this.jump = 1;
      if (!this.minion && f.en >= wp.cost && adx < R * wp.spR + 80 && Math.abs(dy) < 130 * f.s && Math.random() < [.2, .4, .65][lv]) this.spec = 1;
      for (const p of G.projs) if (p.team !== f.team && Math.abs(p.y - f.cy()) < 60 && Math.sign(p.vx) === Math.sign(f.x - p.x) && Math.abs(p.x - f.x) < 260 && Math.random() < [.1, .35, .6][lv]) this.jump = 1;
    }
    if (f.onG && this.mv) { if (!groundBelow(f.x + this.mv * 45, f.y)) { if (groundBelow(f.x + this.mv * 230, f.y + 150) && (Math.sign(dx) === this.mv)) this.jump = 1; else this.mv = 0; } }
    if (!f.onG && !groundBelow(f.x, f.y)) {
      let best = null, bd2 = 1e9; for (const p of G.map.plats) { if (p[1] < f.y - 160) continue; const cx = clamp(f.x, p[0] + 30, p[0] + p[2] - 30), d = Math.abs(cx - f.x) + Math.abs(p[1] - f.y) * .3; if (d < bd2) { bd2 = d; best = cx; } }
      if (best !== null) this.mv = Math.sign(best - f.x); if (f.vy > 0 && f.jumps < 2 && this.jcd <= 0) { this.jump = 1; this.jcd = .3; }
    }
    o.l = this.mv < 0; o.r = this.mv > 0;
    if (this.atk) { o.a = 1; o.face = Math.sign(dx) || f.face; if (adx < R && !ranged) { o.l = o.r = 0; } }
    if (this.jump) { o.jp = 1; this.jump = 0; }
    if (this.spec) { o.sp = 1; o.face = Math.sign(dx) || f.face; this.spec = 0; }
    return o;
  }
}

// ===== Input =====
const KB = [{}, {}], LATCH = [{ j: 0, s: 0 }, { j: 0, s: 0 }], TB = [{}, {}];
const KEYMAP = { Space: [0, 'j'], KeyJ: [0, 'a'], KeyA: [0, 'l'], KeyD: [0, 'r'], KeyW: [0, 'j'], KeyF: [0, 'a'], KeyG: [0, 's'], KeyH: [0, 's'],
  ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'], ArrowUp: [1, 'j'], KeyK: [1, 'a'], KeyL: [1, 's'], Period: [1, 'a'], Slash: [1, 's'], Numpad1: [1, 'a'], Numpad2: [1, 's'], Numpad0: [1, 'a'] };
addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') togglePause(); return; }
  const m = KEYMAP[e.code]; if (!m) return; let [p, k] = m; if (G.cfg && G.cfg.players === 1) p = 0;
  if (e.code === 'Space') k = 'j';
  if (!e.repeat) { if (k === 'j') LATCH[p].j = 1; if (k === 's') LATCH[p].s = 1; }
  KB[p][k] = 1; if (G.state === 'play') e.preventDefault();
});
addEventListener('keyup', e => { const m = KEYMAP[e.code]; if (!m) return; let [p, k] = m; if (G.cfg && G.cfg.players === 1) p = 0; KB[p][k] = 0; });
function readInput(p) { const k = KB[p], t = TB[p], L = LATCH[p]; const o = { l: k.l || t.l, r: k.r || t.r, a: k.a || t.a, jp: L.j, sp: L.s }; L.j = 0; L.s = 0; return o; }

let BTNS = [];
function layoutButtons() {
  BTNS = []; if (!G.cfg) return; const two = G.cfg.players === 2, R = 54;
  const set = (p, x0, mirror) => {
    const X = x => mirror ? W - x : x;
    if (!two) return;
    BTNS.push({ p, k: 'l', x: X(mirror ? 205 : 80), y: 652, r: R }, { p, k: 'r', x: X(mirror ? 80 : 205), y: 652, r: R },
      { p, k: 'j', x: X(318), y: 640, r: R - 4 }, { p, k: 'a', x: X(155), y: 535, r: R - 2 }, { p, k: 's', x: X(270), y: 520, r: R - 8 });
  };
  if (two) { set(0, 0, false); set(1, 0, true); }
  else BTNS.push({ p: 0, k: 'l', x: 85, y: 645, r: 62 }, { p: 0, k: 'r', x: 225, y: 645, r: 62 },
    { p: 0, k: 'j', x: W - 95, y: 625, r: 64 }, { p: 0, k: 'a', x: W - 240, y: 650, r: 60 }, { p: 0, k: 's', x: W - 170, y: 505, r: 52 });
}
const TOUCHES = {}; let isTouch = false;
function tpos(t) { return [(t.clientX - OX) / SC, (t.clientY - OY) / SC]; }
function findBtn(x, y) { let b = null, bd = 1e9; for (const B of BTNS) { const d = Math.hypot(B.x - x, B.y - y); if (d < B.r * 1.35 && d < bd) { bd = d; b = B; } } return b; }
function recomputeTouch() { TB[0] = {}; TB[1] = {}; for (const id in TOUCHES) { const b = TOUCHES[id]; if (b) TB[b.p][b.k] = 1; } }
cv.addEventListener('touchstart', e => {
  isTouch = true; e.preventDefault(); audio();
  for (const t of e.changedTouches) { const [x, y] = tpos(t);
    if (G.state === 'play' && Math.hypot(x - W / 2, y - 30) < 40) { togglePause(); continue; }
    const b = findBtn(x, y); TOUCHES[t.identifier] = b; if (b) { if (b.k === 'j') LATCH[b.p].j = 1; if (b.k === 's') LATCH[b.p].s = 1; } }
  recomputeTouch();
}, { passive: false });
cv.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const [x, y] = tpos(t), b = findBtn(x, y), old = TOUCHES[t.identifier];
  if (b && old && b !== old && b.p === old.p && (b.k === 'l' || b.k === 'r')) TOUCHES[t.identifier] = b; else if (b && !old) TOUCHES[t.identifier] = b; } recomputeTouch(); }, { passive: false });
const tend = e => { e.preventDefault(); for (const t of e.changedTouches) delete TOUCHES[t.identifier]; recomputeTouch(); };
cv.addEventListener('touchend', tend, { passive: false }); cv.addEventListener('touchcancel', tend, { passive: false });
cv.addEventListener('mousedown', e => { if (G.state === 'play') { const x = (e.clientX - OX) / SC, y = (e.clientY - OY) / SC; if (Math.hypot(x - W / 2, y - 30) < 40) togglePause(); } });

// ===== Match flow =====
function mkPlayer(i, team, x, y) { return new Fighter({ x, y, team, load: save.load[i], input: () => readInput(i), pi: i, face: x < W / 2 ? 1 : -1 }); }
function cpuLoad() { const c = pick(CHARS); return Object.assign({}, c); }
function startGame(cfg) {
  G.cfg = cfg; G.wins = [0, 0]; G.round = 1; G.wave = 0; G.kills = 0; G.earned = 0; G.cpuLoad = cpuLoad();
  layoutButtons(); startRound();
}
function pickMap() { const c = G.cfg; G.map = c.map >= 0 ? MAPS[c.map] : pick(MAPS); }
function resetWorld() { G.fighters = []; G.projs = []; G.fx = []; G.tasks = []; parts = []; G.domain = null; G.ts = 1; G.tsT = 0; G.hitstop = 0; G.state = 'play'; G.paused = false; for (const k in TOUCHES) delete TOUCHES[k]; recomputeTouch(); }
function startRound() {
  const c = G.cfg; resetWorld(); if (c.mode !== 'survival' || G.wave === 0) pickMap(); const sp = G.map.spawn;
  if (c.mode === 'cpu') {
    G.fighters.push(mkPlayer(0, 0, sp[0][0], sp[0][1]));
    const e = new Fighter({ x: sp[1][0], y: sp[1][1], team: 1, load: G.cpuLoad, name: 'CPU · ' + G.cpuLoad.name, ai: new AI(c.diff), face: -1 }); G.fighters.push(e);
    banner('TUR ' + G.round, 'DÖVÜŞ!');
  } else if (c.mode === 'pvp') {
    G.fighters.push(mkPlayer(0, 0, sp[0][0], sp[0][1]), mkPlayer(1, 1, sp[1][0], sp[1][1])); banner('TUR ' + G.round, 'DÖVÜŞ!');
  } else if (c.mode === 'survival') {
    for (let i = 0; i < c.players; i++) G.fighters.push(mkPlayer(i, 0, sp[i][0], sp[i][1]));
    G.wave = 0; nextWave();
  } else if (c.mode === 'boss') {
    for (let i = 0; i < c.players; i++) G.fighters.push(mkPlayer(i, 0, sp[i][0], sp[i][1]));
    const bw = pick(['moonfang', 'hammer', 'shrine', 'ki', 'void', 'cursed', 'blackflame']);
    const b = new Fighter({ x: W / 2, y: -100, team: 1, s: 2.1, boss: true, hp: 520 * c.players + c.diff * 120, load: { weapon: bw, head: pick(['horns', 'crown', 'kabuto', 'marks']), back: 'aura', c1: '#3b0764', c2: '#ef4444' }, name: 'LANET LORDU', ai: new AI(Math.max(1, c.diff)) });
    G.fighters.push(b); G.boss = b; banner('BOSS', 'LANET LORDU uyandı!');
  }
}
function banner(t, sub, dur = 1.6) { G.banner = { t, sub, life: dur, max: dur }; G.intro = Math.min(1.1, dur * .7); }
function nextWave() {
  const c = G.cfg; G.wave++; const n = Math.min(6, 1 + Math.floor(G.wave * .7)), lv = Math.min(2, Math.floor((G.wave - 1) / 3) + (c.diff > 1 ? 1 : 0));
  for (const f of G.fighters) if (f.team === 0 && f.dead && !f.minion) { const i = f.pi; const nf = mkPlayer(i, 0, G.map.spawn[i][0], G.map.spawn[i][1] - 200); nf.hp = 60; G.fighters[G.fighters.indexOf(f)] = nf; }
  G.fighters = G.fighters.filter(f => !(f.team === 1));
  for (let i = 0; i < n; i++) {
    const mb = G.wave % 5 === 0 && i === 0, L = cpuLoad();
    after(i * .6 + .8, () => { if (G.state !== 'play') return; const e = new Fighter({ x: rnd(100, W - 100), y: -60, team: 1, load: L, name: L.name, ai: new AI(lv), hp: mb ? 260 : 50 + G.wave * 6, s: mb ? 1.5 : 1, boss: mb, face: -1 }); smoke(e.x, 40, 6); G.fighters.push(e); });
  }
  G.pendingSpawn = n; G.spawnT = n * .6 + 1;
  banner('DALGA ' + G.wave, n + ' düşman geliyor', 1.4);
}
G.onDeath = function (f, src) {
  if (f.minion || G.state !== 'play') return;
  const c = G.cfg;
  if (c.mode === 'cpu' || c.mode === 'pvp') {
    const teams = new Set(G.fighters.filter(e => !e.dead && !e.minion).map(e => e.team));
    if (teams.size <= 1) endRound([...teams][0]);
  } else if (c.mode === 'survival') {
    if (f.team === 1) { G.kills++; G.earned += 15; txt(f.x, f.y - 140, '+15', '#ffd23f', 26); }
    if (!G.fighters.some(e => e.team === 0 && !e.dead && !e.minion)) { finishMatch(false); return; }
    if (f.team === 1 && G.spawnT <= 0 && !G.fighters.some(e => e.team === 1 && !e.dead && !e.minion)) { G.earned += 40; G.state = 'play'; after(1.4, () => G.state === 'play' && nextWave()); txt(W / 2, H / 2, 'DALGA TEMİZLENDİ!', '#22d3ee', 44, 1.4); }
  } else if (c.mode === 'boss') {
    if (f.boss) finishMatch(true); else if (!G.fighters.some(e => e.team === 0 && !e.dead && !e.minion)) finishMatch(false);
  }
};
function endRound(team) {
  G.state = 'roundEnd'; G.ts = .3; G.tsT = 1.1; G.endT = 2.4; sfx('win');
  const w = G.fighters.find(e => e.team === team && !e.minion);
  if (team !== undefined) G.wins[team]++;
  G.banner = { t: w ? w.name.toUpperCase() : 'BERABERE', sub: 'TURU KAZANDI', life: 2.4, max: 2.4 };
  G.afterEnd = () => {
    if (G.wins[0] >= G.cfg.target || G.wins[1] >= G.cfg.target) finishMatch(G.wins[0] > G.wins[1]);
    else { G.round++; startRound(); }
  };
}
function finishMatch(p1won) {
  const c = G.cfg; G.state = 'over'; G.ts = .3; G.tsT = 1;
  let title, sub, coins = 0;
  if (c.mode === 'cpu') { coins = p1won ? 80 + c.diff * 60 : 25; title = p1won ? 'ZAFER!' : 'YENİLGİ'; sub = `${G.wins[0]} - ${G.wins[1]} · CPU (${['Kolay', 'Orta', 'Zor'][c.diff]})`; }
  else if (c.mode === 'pvp') { coins = 60; const wn = save.load[p1won ? 0 : 1].name; title = wn.toUpperCase() + ' KAZANDI!'; sub = `${G.wins[0]} - ${G.wins[1]}`; }
  else if (c.mode === 'survival') { coins = G.earned; title = 'OYUN BİTTİ'; sub = `Dalga ${G.wave} · ${G.kills} leş`; }
  else { coins = p1won ? 350 + c.diff * 100 : 40; title = p1won ? 'BOSS YENİLDİ!' : 'BOSS KAZANDI'; sub = p1won ? 'Lanet Lordu yok edildi' : 'Tekrar dene!'; }
  addCoins(coins); addXP(Math.round(coins * .8 + 20));
  setTimeout(() => UI.results(title, sub, coins, p1won), 1300);
}
function togglePause() { if (G.state !== 'play' && !G.paused) return; G.paused = !G.paused; UI.pause(G.paused); }

// ===== Step =====
function step(dt) {
  G.time += dt; if (G.intro > 0) G.intro -= dt;
  if (G.spawnT > 0) G.spawnT -= dt;
  for (let i = G.tasks.length - 1; i >= 0; i--) { const t = G.tasks[i]; t.t -= dt; if (t.t <= 0) { G.tasks.splice(i, 1); t.fn(); } }
  for (const f of G.fighters.slice()) f.update(dt);
  // fighter separation
  const al = G.fighters.filter(f => !f.dead);
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) { const a = al[i], b = al[j]; const dx = b.x - a.x, md = 18 * (a.s + b.s); if (Math.abs(dx) < md && Math.abs(a.y - b.y) < 60 && !a.dash && !b.dash) { const p = (md - Math.abs(dx)) * .5 * (Math.sign(dx) || 1) * .2; a.x -= p; b.x += p; } }
  for (const p of G.projs) p.step(dt); G.projs = G.projs.filter(p => !p.dead);
  for (const fx of G.fx) fx.update(dt); G.fx = G.fx.filter(f => f.t > 0);
  if (G.domain) { const d = G.domain; d.t -= dt; d.tick -= dt; if (d.tick <= 0) { d.tick = .09; for (const e of foes(d.owner)) { hit(e, 1.6, rnd(-140, 140), -60, d.owner, { stun: .25, quiet: 1, hitCol: '#ef4444' }); slashCut(e); } } if (d.t <= 0 || d.owner.dead) G.domain = null; }
  G.fighters = G.fighters.filter(f => !(f.minion && f.dead));
  ambient(dt); updParts(dt);
}
function ambient(dt) {
  const th = G.map.theme;
  if (th === 'dojo' && Math.random() < dt * 8) P({ type: 'petal', x: rnd(0, W + 200), y: -10, vx: rnd(-90, -30), vy: rnd(40, 90), size: rnd(3, 5), col: pick(['#fbcfe8', '#f9a8d4', '#fce7f3']), life: 9, g: 0, drag: 0 });
  if (th === 'cursed' && Math.random() < dt * 10) P({ x: rnd(0, W), y: H + 10, vx: rnd(-20, 20), vy: rnd(-90, -40), size: rnd(1.5, 3), col: pick(['#f43f5e', '#a855f7', '#fb923c']), life: 7, g: 0, drag: 0 });
  if (th === 'city' && Math.random() < dt * 6) P({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: -10, size: 1.5, col: pick(['#22d3ee', '#f472b6']), life: 3, g: 0, drag: 0 });
  if (th === 'sky' && Math.random() < dt * 3) P({ x: rnd(0, W), y: rnd(0, H * .6), vx: rnd(10, 30), vy: 0, size: 2, col: 'rgba(255,255,255,.7)', life: 4, g: 0, drag: 0 });
}

// ===== Backgrounds =====
let bgCache = {};
function getBG(m) {
  const key = m.name; if (bgCache[key]) return bgCache[key];
  const k = Math.min(2, DPR * SC) || 1, b = document.createElement('canvas'); b.width = W * k; b.height = H * k; const c = b.getContext('2d'); c.scale(k, k);
  const th = m.theme, sr = mulberry(7);
  const grad = (stops) => { const g = c.createLinearGradient(0, 0, 0, H); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  if (th === 'city') {
    grad(['#05051a', '#1a0b3d', '#4a1260', '#7a1e6c']);
    for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${sr() * .8})`; c.fillRect(sr() * W, sr() * 300, 1.5, 1.5); }
    glow(c, W * .7, 380, 260, 'rgba(255,60,140,.35)'); c.fillStyle = '#ff5fa2'; c.globalAlpha = .9; c.beginPath(); c.arc(W * .7, 360, 110, 0, TAU); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#7a1e6c'; for (let i = 0; i < 8; i++) c.fillRect(W * .7 - 120, 330 + i * 14, 240, 4 + i * .8);
    for (const [col, base, hmin, hmax, win] of [['#1b0f3a', 640, 120, 330, .25], ['#0e0822', 640, 80, 260, .5]]) {
      let x = -20; while (x < W) { const w = 50 + sr() * 90, h = hmin + sr() * (hmax - hmin); c.fillStyle = col; c.fillRect(x, base - h, w, h);
        for (let wy = base - h + 12; wy < base - 20; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 13) if (sr() < win * .5) { c.fillStyle = pick(['#22d3ee', '#f472b6', '#fde047', '#a78bfa']); c.globalAlpha = .4 + sr() * .5; c.fillRect(wx, wy, 6, 8); c.globalAlpha = 1; }
        if (sr() < .3) { const nc = pick(['#22d3ee', '#f472b6', '#a3e635']); glow(c, x + w / 2, base - h - 10, 40, nc, .5); c.fillStyle = nc; c.fillRect(x + w / 2 - 14, base - h - 14, 28, 6); }
        x += w + 4; } }
  } else if (th === 'dojo') {
    grad(['#0b1026', '#25184a', '#6b2a5a', '#c2566a']);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${sr() * .7})`; c.fillRect(sr() * W, sr() * 280, 1.5, 1.5); }
    glow(c, 330, 210, 260, 'rgba(255,230,200,.35)'); c.fillStyle = '#fff1e0'; c.beginPath(); c.arc(330, 210, 105, 0, TAU); c.fill();
    c.fillStyle = 'rgba(200,170,160,.25)'; c.beginPath(); c.arc(300, 190, 18, 0, TAU); c.arc(360, 240, 12, 0, TAU); c.fill();
    c.fillStyle = '#3a1d47'; mountains(c, sr, 520, 140); c.fillStyle = '#24112f'; mountains(c, sr, 590, 90);
    // torii
    c.fillStyle = '#b91c1c'; c.fillRect(905, 380, 18, 260); c.fillRect(1085, 380, 18, 260); c.fillRect(870, 372, 270, 20); c.fillRect(890, 410, 230, 12);
    c.fillStyle = '#1a0a14'; c.fillRect(860, 362, 290, 12);
    for (const [tx, ty] of [[120, 640], [1240, 640], [640, 640]]) { c.fillStyle = '#2a1420'; c.fillRect(tx - 6, ty - 220, 12, 220); for (let i = 0; i < 26; i++) { c.fillStyle = pick(['#f9a8d4', '#f472b6', '#fbcfe8', '#ec4899']); c.globalAlpha = .55; c.beginPath(); c.arc(tx + (sr() - .5) * 220, ty - 220 + (sr() - .5) * 120, 20 + sr() * 25, 0, TAU); c.fill(); } c.globalAlpha = 1; }
  } else if (th === 'cursed') {
    grad(['#030106', '#14031c', '#2e0726', '#4a0b1e']);
    glow(c, 640, 230, 320, 'rgba(220,38,38,.35)'); c.fillStyle = '#b91c1c'; c.beginPath(); c.arc(640, 230, 120, 0, TAU); c.fill(); c.fillStyle = '#7f1d1d'; c.beginPath(); c.arc(610, 210, 26, 0, TAU); c.arc(680, 260, 18, 0, TAU); c.fill();
    c.fillStyle = '#12040f'; mountains(c, sr, 560, 120);
    for (let i = 0; i < 6; i++) { const x = 80 + i * 220 + sr() * 60, y = 120 + sr() * 220, w = 50 + sr() * 70; c.fillStyle = '#1c0a1f'; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x + w, y); c.lineTo(x + w * .3, y + w * 1.1); c.lineTo(x - w * .4, y + w * .8); c.fill(); }
    // shrine silhouette
    c.fillStyle = '#0a0208'; c.fillRect(540, 450, 200, 190); c.beginPath(); c.moveTo(500, 460); c.lineTo(640, 380); c.lineTo(780, 460); c.fill(); c.beginPath(); c.moveTo(520, 520); c.lineTo(640, 470); c.lineTo(760, 520); c.fill();
    const fog = c.createLinearGradient(0, 450, 0, H); fog.addColorStop(0, 'rgba(126,34,206,0)'); fog.addColorStop(1, 'rgba(126,34,206,.35)'); c.fillStyle = fog; c.fillRect(0, 450, W, 270);
  } else {
    grad(['#1e3a8a', '#6d28d9', '#db2777', '#fb923c']);
    glow(c, 640, 560, 380, 'rgba(253,224,71,.5)'); c.fillStyle = '#fde68a'; c.beginPath(); c.arc(640, 560, 120, 0, TAU); c.fill();
    for (let i = 0; i < 14; i++) cloud(c, sr() * W, 80 + sr() * 450, 40 + sr() * 70, `rgba(255,${200 + sr() * 55 | 0},${220 + sr() * 35 | 0},${.35 + sr() * .4})`);
  }
  // platforms
  for (const p of m.plats) drawPlat(c, p, th, sr);
  bgCache[key] = b; return b;
}
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mountains(c, sr, base, h) { c.beginPath(); c.moveTo(0, H); let x = 0; c.lineTo(0, base); while (x < W) { x += 60 + sr() * 120; c.lineTo(x, base - sr() * h); } c.lineTo(W, H); c.fill(); }
function cloud(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.arc(x + r * .9, y + r * .2, r * .75, 0, TAU); c.arc(x - r * .9, y + r * .25, r * .7, 0, TAU); c.arc(x + r * .2, y + r * .4, r * .8, 0, TAU); c.fill(); }
function drawPlat(c, p, th, sr) {
  const [x, y, w, h] = p, floor = h > 30;
  if (th === 'city') {
    c.fillStyle = floor ? '#120c26' : '#1b1338'; rr(c, x, y, w, floor ? H - y + 20 : h, floor ? 0 : 6); c.fill();
    if (floor) { c.strokeStyle = 'rgba(244,114,182,.25)'; c.lineWidth = 1.5; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x, y + i * 14); c.lineTo(x + w, y + i * 14); c.stroke(); } for (let gx = x; gx < x + w; gx += 60) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + (gx - 640) * .4, H); c.stroke(); } }
    c.save(); c.shadowColor = '#22d3ee'; c.shadowBlur = 16; c.fillStyle = '#22d3ee'; c.fillRect(x, y - 1, w, 4); c.restore();
  } else if (th === 'dojo') {
    c.fillStyle = floor ? '#3b2416' : '#5b3a29'; c.fillRect(x, y, w, floor ? H - y : h);
    c.fillStyle = '#8b5a3c'; c.fillRect(x, y, w, floor ? 10 : 5);
    if (floor) { c.fillStyle = 'rgba(0,0,0,.2)'; for (let gx = x; gx < x + w; gx += 80) c.fillRect(gx, y + 10, 3, H - y); } else { c.fillStyle = '#2a170e'; c.fillRect(x + 12, y + h, 8, 20); c.fillRect(x + w - 20, y + h, 8, 20); }
  } else if (th === 'cursed') {
    c.fillStyle = floor ? '#1f0d22' : '#2a1530'; rr(c, x, y, w, floor ? H - y + 20 : h + 6, 4); c.fill();
    c.save(); c.shadowColor = '#e11d48'; c.shadowBlur = 14; c.fillStyle = '#be123c'; c.fillRect(x, y - 1, w, 3); c.restore();
    c.strokeStyle = 'rgba(225,29,72,.5)'; c.lineWidth = 1.5; for (let i = 0; i < w / 60; i++) { const cx = x + sr() * w; c.beginPath(); c.moveTo(cx, y + 2); c.lineTo(cx + rnd(-10, 10), y + 14); c.lineTo(cx + rnd(-14, 14), y + 26); c.stroke(); }
  } else {
    c.fillStyle = '#6b4226'; c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x + w, y + 8); c.quadraticCurveTo(x + w * .8, y + h + 60 * (w / 400), x + w * .5, y + h + 80 * (w / 400)); c.quadraticCurveTo(x + w * .2, y + h + 60 * (w / 400), x, y + 8); c.fill();
    c.fillStyle = '#4ade80'; rr(c, x - 4, y, w + 8, 12, 6); c.fill(); c.fillStyle = '#86efac'; c.fillRect(x + 4, y + 1, w - 8, 3);
  }
}

// ===== Render =====
function render(rdt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05060d'; ctx.fillRect(0, 0, cv.width, cv.height);
  const sh = save.shake && G.state !== 'menu' ? G.shake : 0, sx = sh ? rnd(-sh, sh) : 0, sy = sh ? rnd(-sh, sh) : 0;
  G.shake *= Math.pow(.02, rdt);
  ctx.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (OX + sx * SC), DPR * (OY + sy * SC));
  const c = ctx;
  c.drawImage(getBG(G.map), 0, 0, W, H);
  if (G.domain) { const k = Math.min(1, G.domain.t * 2, (3 - G.domain.t) * 4); c.fillStyle = `rgba(30,0,5,${.6 * k})`; c.fillRect(0, 0, W, H); glow(c, W / 2, H * .35, 400, `rgba(220,38,38,${.4 * k})`); c.strokeStyle = `rgba(255,255,255,${.5 * k})`; c.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const x = rnd(0, W), y = rnd(0, H), a = rnd(0, Math.PI), l = rnd(60, 200); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); } }
  if (G.state === 'menu' || G.state === 'custom') drawShowcase(c);
  else {
    for (const f of G.fighters) if (f.dead) drawFighter(c, f);
    for (const f of G.fighters) if (!f.dead) drawFighter(c, f);
    for (const p of G.projs) p.draw(c);
    for (const fx of G.fx) fx.draw(c);
  }
  drawParts(c);
  if (G.flash > 0) { c.fillStyle = `rgba(255,255,255,${G.flash * 2.5})`; c.fillRect(0, 0, W, H); G.flash -= rdt; }
  if (G.state !== 'menu' && G.state !== 'custom') { drawHUD(c, rdt); if (isTouch && G.state === 'play') drawButtons(c); }
  // letterbox
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05060d';
  if (OX > 0) { ctx.fillRect(0, 0, OX * DPR, cv.height); ctx.fillRect(cv.width - OX * DPR - 1, 0, OX * DPR + 1, cv.height); }
  if (OY > 0) { ctx.fillRect(0, 0, cv.width, OY * DPR); ctx.fillRect(0, cv.height - OY * DPR - 1, cv.width, OY * DPR + 1); }
}
let SHOW = [];
function drawShowcase(c) {
  if (G.state === 'custom') { const f = SHOW[UI.cp]; if (f) { f.x = 990; f.y = 560; f.s = 2.6; f.face = -1; drawFighter(c, f); } return; }
  SHOW[0].x = 500; SHOW[0].y = 560; SHOW[0].s = 1.8; SHOW[0].face = 1; SHOW[1].x = 690; SHOW[1].y = 560; SHOW[1].s = 1.8; SHOW[1].face = -1;
  drawFighter(c, SHOW[0]); drawFighter(c, SHOW[1]);
}
function refreshShowcase() {
  SHOW = [0, 1].map(i => { const f = new Fighter({ load: Object.assign({}, save.load[i], { weapon: save.load[i].weapon === 'random' ? 'fists' : save.load[i].weapon }) }); f.onG = true; return f; });
  if (save.load[0].weapon === 'random') SHOW[0].wp = WEAPONS.fists; if (save.load[1].weapon === 'random') SHOW[1].wp = WEAPONS.fists;
}

function bar(c, x, y, w, h, k, col, bg = 'rgba(0,0,0,.5)', right) {
  c.fillStyle = bg; rr(c, x, y, w, h, h / 2); c.fill(); k = clamp(k, 0, 1); if (k <= 0) return;
  c.fillStyle = col; const ww = Math.max(h, w * k); rr(c, right ? x + w - ww : x, y, ww, h, h / 2); c.fill();
}
function card(c, f, x, y, right, wins) {
  const w = 330, X = right ? x - w : x;
  c.fillStyle = 'rgba(8,10,24,.62)'; rr(c, X, y, w, 78, 14); c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5; c.stroke();
  // portrait
  const px = right ? X + w - 40 : X + 40; c.save(); c.beginPath(); c.arc(px, y + 39, 28, 0, TAU); c.fillStyle = shade(f.c1, -.5); c.fill(); c.clip();
  c.fillStyle = f.c1; c.beginPath(); c.arc(px, y + 34, 12, 0, TAU); c.fill(); c.strokeStyle = f.c1; c.lineWidth = 7; c.beginPath(); c.moveTo(px, y + 44); c.lineTo(px, y + 80); c.stroke();
  c.save(); c.translate(px, y + 34); c.scale(right ? -1 : 1, 1); (HEADS[f.head] || HEADS.none).draw(c, 12, f.c1, f.c2); c.restore(); c.restore();
  const bx = right ? X + 14 : X + 78, bw = w - 92;
  c.font = '800 16px system-ui,Segoe UI,sans-serif'; c.fillStyle = '#fff'; c.textAlign = right ? 'right' : 'left';
  c.fillText(f.name, right ? bx + bw : bx, y + 22);
  c.font = '600 11px system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.textAlign = right ? 'left' : 'right'; c.fillText(f.wp.name.toUpperCase(), right ? bx : bx + bw, y + 22);
  bar(c, bx, y + 30, bw, 16, f.hpShow / f.maxhp, 'rgba(255,255,255,.85)', 'rgba(0,0,0,.55)', right);
  const hk = f.hp / f.maxhp; c.save(); const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, hk < .3 ? '#ef4444' : f.c1); g.addColorStop(1, hk < .3 ? '#f97316' : shade(f.c1, .35)); bar(c, bx, y + 30, bw, 16, hk, g, 'rgba(0,0,0,0)', right); c.restore();
  const ek = f.en / 100, full = f.en >= f.wp.cost; bar(c, bx, y + 52, bw, 9, ek, full ? `hsl(${190 + Math.sin(G.time * 8) * 20},95%,60%)` : '#3b82f6', 'rgba(0,0,0,.55)', right);
  const ck = f.wp.cost / 100; c.fillStyle = '#fff'; c.fillRect(right ? bx + bw - bw * ck : bx + bw * ck, y + 50, 2, 13);
  if (full) { c.font = '800 10px system-ui,sans-serif'; c.fillStyle = '#7dd3fc'; c.textAlign = right ? 'right' : 'left'; c.fillText('ÖZEL HAZIR', right ? bx + bw : bx, y + 74); }
  if (wins !== undefined) for (let i = 0; i < G.cfg.target; i++) { c.fillStyle = i < wins ? '#ffd23f' : 'rgba(255,255,255,.18)'; c.beginPath(); const cx = right ? X + w - 12 - i * 18 : X + 12 + i * 18; c.arc(cx, y + 92, 6, 0, TAU); c.fill(); }
}
function drawHUD(c, rdt) {
  const cf = G.cfg; if (!cf) return; const pl = G.fighters.filter(f => f.team === 0 && !f.minion), en = G.fighters.filter(f => f.team === 1 && !f.minion);
  if (cf.mode === 'cpu' || cf.mode === 'pvp') { if (pl[0]) card(c, pl[0], 16, 14, false, G.wins[0]); if (en[0]) card(c, en[0], W - 16, 14, true, G.wins[1]); }
  else { if (pl[0]) card(c, pl[0], 16, 14, false); if (pl[1]) card(c, pl[1], W - 16, 14, true); }
  // pause btn
  c.fillStyle = 'rgba(8,10,24,.6)'; c.beginPath(); c.arc(W / 2, 32, 22, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(W / 2 - 7, 23, 5, 18); c.fillRect(W / 2 + 2, 23, 5, 18);
  c.textAlign = 'center'; c.font = '800 15px system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,.8)';
  if (cf.mode === 'survival') c.fillText(`DALGA ${G.wave} · ${G.kills} LEŞ · +${G.earned}🪙`, W / 2, 76);
  else if (cf.mode === 'boss' && G.boss) { const b = G.boss, bw = 520; c.fillText(b.name + ' · ' + b.wp.name, W / 2, 112); bar(c, W / 2 - bw / 2, 120, bw, 18, b.hpShow / b.maxhp, '#fff'); bar(c, W / 2 - bw / 2, 120, bw, 18, b.hp / b.maxhp, '#dc2626', 'rgba(0,0,0,0)'); }
  else c.fillText('TUR ' + G.round, W / 2, 76);
  if (G.banner) { const b = G.banner; b.life -= rdt; if (b.life <= 0) G.banner = null; else {
    const k = 1 - b.life / b.max, a = Math.min(1, b.life * 3, k * 8), sc = 1 + Math.max(0, .3 - k * 2);
    c.save(); c.globalAlpha = a; c.translate(W / 2, H / 2 - 40); c.scale(sc, sc);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(-W, -55, W * 2, 110);
    c.font = 'italic 900 64px system-ui,Segoe UI,sans-serif'; c.lineWidth = 8; c.strokeStyle = '#0a0d1a'; c.strokeText(b.t, 0, 10);
    const g = c.createLinearGradient(0, -40, 0, 20); g.addColorStop(0, '#fff'); g.addColorStop(1, '#ffd23f'); c.fillStyle = g; c.fillText(b.t, 0, 10);
    c.font = '800 22px system-ui,sans-serif'; c.fillStyle = '#7dd3fc'; c.fillText(b.sub, 0, 42); c.restore(); } }
  if (G.state === 'roundEnd') { G.endT -= rdt; if (G.endT <= 0) { G.state = 'wait'; G.afterEnd(); } }
}
function drawButtons(c) {
  for (const B of BTNS) {
    const on = TB[B.p][B.k], f = G.fighters.find(x => x.pi === B.p && !x.minion);
    const col = f ? f.c1 : '#fff';
    c.globalAlpha = on ? .55 : .28; c.fillStyle = on ? col : '#0b1020'; c.beginPath(); c.arc(B.x, B.y, B.r, 0, TAU); c.fill();
    c.globalAlpha = on ? .9 : .5; c.strokeStyle = col; c.lineWidth = 3; c.stroke();
    c.globalAlpha = .85; c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
    const r = B.r * .32;
    if (B.k === 'l' || B.k === 'r') { const d = B.k === 'l' ? -1 : 1; c.beginPath(); c.moveTo(B.x + d * r, B.y); c.lineTo(B.x - d * r * .7, B.y - r); c.lineTo(B.x - d * r * .7, B.y + r); c.fill(); }
    else if (B.k === 'j') { c.beginPath(); c.moveTo(B.x - r, B.y + r * .5); c.lineTo(B.x, B.y - r * .6); c.lineTo(B.x + r, B.y + r * .5); c.stroke(); }
    else if (B.k === 'a') { c.beginPath(); c.moveTo(B.x - r, B.y + r); c.lineTo(B.x + r, B.y - r); c.moveTo(B.x - r * .9, B.y + r * .2); c.lineTo(B.x - r * .2, B.y + r * .9); c.stroke(); }
    else if (B.k === 's') {
      if (f) { const k = f.en / 100, ok = f.en >= f.wp.cost; c.globalAlpha = 1; c.strokeStyle = ok ? '#7dd3fc' : '#3b82f6'; c.lineWidth = 6; c.beginPath(); c.arc(B.x, B.y, B.r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke(); if (ok) glow(c, B.x, B.y, B.r * 1.4, 'rgba(125,211,252,.35)'); }
      c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r * 1.05; c.lineTo(B.x + Math.cos(a) * rad, B.y + Math.sin(a) * rad); } c.fill();
    }
  }
  c.globalAlpha = 1;
}

// ===== Main loop =====
let acc = 0, last = 0;
function frame(t) {
  const rdt = Math.min(.05, (t - last) / 1000 || 0); last = t;
  if (G.state === 'menu' || G.state === 'custom') { G.time += rdt; updParts(rdt); ambient(rdt); for (const f of SHOW) { f.anim += rdt * 3; f.flash = 0; } }
  else if (!G.paused) {
    if (G.hitstop > 0) G.hitstop -= rdt;
    else { acc += rdt * G.ts; let n = 0; while (acc >= STEP && n < 12) { acc -= STEP; step(STEP); n++; } }
    if (G.tsT > 0) { G.tsT -= rdt; if (G.tsT <= 0) G.ts = 1; }
  }
  render(rdt);
  requestAnimationFrame(frame);
}
