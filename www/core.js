'use strict';
// ===== Core utilities, save, audio, particles =====
const W = 1280, H = 720, STEP = 1 / 120, GRAV = 2300, TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[(Math.random() * a.length) | 0];
const ease = t => 1 - Math.pow(1 - t, 3);

function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function glow(c, x, y, r, col, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  const o = c.globalAlpha; c.globalAlpha = o * a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = o;
}
function shade(hex, f) { // f<0 darken, f>0 lighten
  let n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ===== Save =====
const SAVE_KEY = 'neonduel_v1';
let save = {
  coins: 600, xp: 0, level: 1, lastGift: '', sfx: true, shake: true,
  owned: { w: [], h: ['none'], b: ['none'] },
  load: [
    { weapon: 'katana', head: 'headband', back: 'scarf', c1: '#ff3b5c', c2: '#ffd23f', name: 'Oyuncu 1' },
    { weapon: 'plasma', head: 'visor', back: 'none', c1: '#22d3ee', c2: '#a78bfa', name: 'Oyuncu 2' }
  ]
};
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) { save = Object.assign(save, s); } } catch (e) { }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
function addCoins(n) { save.coins += n; persist(); }
function addXP(n) { save.xp += n; while (save.xp >= save.level * 120) { save.xp -= save.level * 120; save.level++; } persist(); }

// ===== Audio (synth) =====
let AC = null, MASTER = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); MASTER = AC.createGain(); MASTER.gain.value = 0.35; MASTER.connect(AC.destination); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d, type = 'square', v = .3, slide = 0, delay = 0) {
  const a = AC; if (!a) return; const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(MASTER); o.start(t); o.stop(t + d + .02);
}
let NOISE = null;
function noise(d, v = .3, freq = 1200, type = 'lowpass', delay = 0) {
  const a = AC; if (!a) return; const t = a.currentTime + delay;
  if (!NOISE) { NOISE = a.createBuffer(1, a.sampleRate, a.sampleRate); const ch = NOISE.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(); s.buffer = NOISE; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
  const g = a.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(fl); fl.connect(g); g.connect(MASTER); s.start(t); s.stop(t + d + .02);
}
let lastSfx = {};
function sfx(n) {
  if (!save.sfx || !audio()) return;
  const now = performance.now(); if (lastSfx[n] && now - lastSfx[n] < 35) return; lastSfx[n] = now;
  switch (n) {
    case 'swing': noise(.12, .25, 2500, 'bandpass'); break;
    case 'hit': noise(.08, .5, 900); tone(160, .08, 'square', .15, -80); break;
    case 'heavy': noise(.25, .7, 500); tone(90, .25, 'sawtooth', .3, -50); break;
    case 'shoot': tone(700, .08, 'square', .12, -500); noise(.05, .2, 3000, 'highpass'); break;
    case 'laser': tone(1400, .18, 'sawtooth', .12, -1200); break;
    case 'boom': noise(.6, .9, 400); tone(60, .5, 'sine', .5, -30); break;
    case 'jump': tone(300, .1, 'sine', .15, 300); break;
    case 'special': tone(220, .5, 'sawtooth', .18, 660); tone(330, .5, 'triangle', .15, 990); break;
    case 'zap': for (let i = 0; i < 4; i++) tone(rnd(800, 2000), .05, 'square', .08, -400, i * .03); noise(.2, .3, 4000, 'highpass'); break;
    case 'ko': tone(400, .5, 'sawtooth', .2, -350); noise(.4, .5, 600); break;
    case 'coin': tone(988, .08, 'square', .12); tone(1319, .2, 'square', .12, 0, .08); break;
    case 'click': tone(600, .05, 'triangle', .15); break;
    case 'flash': tone(80, .4, 'sawtooth', .4, -40); noise(.3, .8, 300); tone(1800, .3, 'square', .1, -1500); break;
    case 'domain': tone(55, 1.5, 'sawtooth', .3, 20); tone(110, 1.5, 'triangle', .2, 55); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'square', .12, 0, i * .12)); break;
  }
}

// ===== Particles =====
let parts = [];
function P(o) {
  if (parts.length > 650) parts.splice(0, 50);
  const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: .5, size: 3, col: '#fff', g: 0, drag: 2, type: 'dot' }, o);
  p.max = p.life; parts.push(p); return p;
}
function burst(x, y, n, col, sp = 300, life = .4, size = 3, g = 600) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.2, 1) * sp; P({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * rnd(.6, 1.2), size: size * rnd(.6, 1.3), col: Array.isArray(col) ? pick(col) : col, g }); }
}
function ring(x, y, r, col, life = .35, w = 5) { P({ x, y, type: 'ring', r, col, life, w }); }
function txt(x, y, s, col, size = 26, life = .9) { P({ x, y, vy: -70, drag: 1.5, type: 'text', s, col, size, life }); }
function slashFx(x, y, ang, r, col, life = .18, w = 7) { P({ x, y, type: 'slash', ang, r, col, life, w }); }
function bolt(x, y, x2, y2, col, life = .15, w = 3) { P({ type: 'bolt', x, y, x2, y2, col, life, w }); }
function smoke(x, y, n, col = 'rgba(200,200,220,.5)') { for (let i = 0; i < n; i++) P({ x: x + rnd(-15, 15), y: y + rnd(-15, 15), vx: rnd(-80, 80), vy: rnd(-120, -20), type: 'smoke', size: rnd(10, 22), col, life: rnd(.4, .8), g: 0 }); }

function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function jag(c, x, y, x2, y2, segs, amp) {
  c.beginPath(); c.moveTo(x, y);
  for (let i = 1; i < segs; i++) { const t = i / segs; c.lineTo(lerp(x, x2, t) + rnd(-amp, amp), lerp(y, y2, t) + rnd(-amp, amp)); }
  c.lineTo(x2, y2); c.stroke();
}
function drawParts(c) {
  for (const p of parts) {
    const k = p.life / p.max; c.globalAlpha = Math.min(1, k * 1.5);
    switch (p.type) {
      case 'dot': c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * (.4 + k * .6), 0, TAU); c.fill(); break;
      case 'smoke': c.fillStyle = p.col; c.globalAlpha = k * .6; c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - k * .6), 0, TAU); c.fill(); break;
      case 'ring': c.strokeStyle = p.col; c.lineWidth = p.w * k; c.beginPath(); c.arc(p.x, p.y, p.r * (1 - k * k) + 4, 0, TAU); c.stroke(); break;
      case 'text': c.font = `900 ${p.size}px system-ui,Segoe UI,sans-serif`; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = '#0a0d1a'; c.strokeText(p.s, p.x, p.y); c.fillStyle = p.col; c.fillText(p.s, p.x, p.y); break;
      case 'slash': {
        c.strokeStyle = p.col; c.lineCap = 'round'; const sw = (1 - k);
        c.lineWidth = p.w * k; c.beginPath(); c.arc(p.x, p.y, p.r, p.ang - 1.2 + sw * .6, p.ang + 1.2 - sw * .2); c.stroke();
        c.globalAlpha *= .35; c.lineWidth = p.w * k * 3; c.stroke(); break;
      }
      case 'line': c.strokeStyle = p.col; c.lineWidth = p.w * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x2, p.y2); c.stroke(); break;
      case 'bolt': c.strokeStyle = p.col; c.lineWidth = p.w; c.lineCap = 'round'; jag(c, p.x, p.y, p.x2, p.y2, 7, 14); c.strokeStyle = '#fff'; c.lineWidth = p.w * .4; jag(c, p.x, p.y, p.x2, p.y2, 5, 6); break;
      case 'beam': {
        const th = p.th * (k < .5 ? k * 2 : 1);
        c.fillStyle = p.col; c.globalAlpha = k * .5; c.fillRect(Math.min(p.x, p.x2), p.y - th, Math.abs(p.x2 - p.x), th * 2);
        c.globalAlpha = k; c.fillStyle = '#fff'; c.fillRect(Math.min(p.x, p.x2), p.y - th * .35, Math.abs(p.x2 - p.x), th * .7); break;
      }
      case 'ghost': if (p.f && !p.f.dead) { const ox = p.f.x, oy = p.f.y, oa = p.f.atkT; p.f.x = p.x; p.f.y = p.y; drawBody(c, p.f, k * .45, p.col); p.f.x = ox; p.f.y = oy; p.f.atkT = oa; } break;
      case 'petal': c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.life * 3); c.beginPath(); c.ellipse(0, 0, p.size, p.size * .5, 0, 0, TAU); c.fill(); c.restore(); break;
    }
  }
  c.globalAlpha = 1;
}
