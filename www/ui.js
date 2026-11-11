'use strict';
// ===== UI =====
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const UI = {
  cp: 0, tab: 'chars', setup: { mode: 'cpu', map: -1, diff: 1, target: 3, players: 1 },
  show(id) { $$('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + id)); this.cur = id; },
  toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('on'), 1600); },
  refreshTop() {
    $('#coins').textContent = save.coins; $$('.coinsv').forEach(e => e.textContent = save.coins);
    $('#lv').textContent = save.level; $('#xpbar').style.width = (save.xp / (save.level * 120) * 100) + '%'; $('#pname').textContent = save.load[0].name;
    const today = new Date().toDateString(); $('#giftsub').textContent = save.lastGift === today ? 'Yarın tekrar gel' : '+200 altın hazır!';
  },
  menu() { G.state = 'menu'; G.paused = false; G.cfg = null; G.map = MAPS[1]; G.fighters = []; G.projs = []; G.fx = []; G.domain = null; parts = []; refreshShowcase(); this.refreshTop(); this.show('menu'); },
  openSetup(mode) {
    const s = this.setup; s.mode = mode; s.players = mode === 'pvp' ? 2 : (mode === 'cpu' ? 1 : s.players);
    $('#setup-title').textContent = { cpu: '⚔️ 1 OYUNCU', pvp: '🤝 2 OYUNCU', survival: '💀 HAYATTA KAL', boss: '👹 BOSS SAVAŞI' }[mode];
    $('#opt-diff').style.display = mode === 'pvp' ? 'none' : ''; $('#opt-target').style.display = (mode === 'cpu' || mode === 'pvp') ? '' : 'none';
    $('#opt-players').style.display = (mode === 'survival' || mode === 'boss') ? '' : 'none';
    const mp = $('#maps'); mp.innerHTML = '';
    [-1, ...MAPS.map((_, i) => i)].forEach(i => {
      const d = document.createElement('button'); d.className = 'mapc' + (s.map === i ? ' on' : ''); const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 144; d.appendChild(cvs);
      const cx = cvs.getContext('2d');
      if (i < 0) { const g = cx.createLinearGradient(0, 0, 256, 144); g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#22d3ee'); cx.fillStyle = g; cx.fillRect(0, 0, 256, 144); cx.font = '900 64px system-ui'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.fillText('?', 128, 95); }
      else cx.drawImage(getBG(MAPS[i]), 0, 0, 256, 144);
      const b = document.createElement('b'); b.textContent = i < 0 ? 'Rastgele' : MAPS[i].name; d.appendChild(b);
      d.onclick = () => { sfx('click'); s.map = i; $$('.mapc').forEach(x => x.classList.remove('on')); d.classList.add('on'); }; mp.appendChild(d);
    });
    this.syncSeg(); this.show('setup');
  },
  syncSeg() { $$('#s-setup .seg').forEach(sg => { const k = sg.dataset.k; sg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === this.setup[k])); }); },
  start() {
    audio(); const s = this.setup; const cfg = Object.assign({}, s); if (cfg.mode === 'cpu') cfg.players = 1; if (cfg.mode === 'pvp') cfg.players = 2;
    this.show('none'); startGame(cfg);
  },
  pause(on) { this.show(on ? 'pause' : 'none'); },
  results(title, sub, coins, won) {
    $('#r-title').textContent = title; $('#r-sub').textContent = sub; $('#r-coins').textContent = coins; this.show('results'); sfx(won ? 'win' : 'coin'); this.refreshTop();
  },
  modal(html) { $('#m-body').innerHTML = html; this.show('modal'); },
  // ---- customize ----
  openCustom() { G.state = 'custom'; refreshShowcase(); this.backTo = this.cur === 'setup' ? 'setup' : 'menu'; this.show('custom'); this.renderCustom(); },
  renderCustom() {
    const L = save.load[this.cp];
    $$('#ptoggle button').forEach(b => b.classList.toggle('on', +b.dataset.p === this.cp));
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab));
    $('#pnameIn').value = L.name; $$('.coinsv').forEach(e => e.textContent = save.coins);
    const g = $('#grid'); g.innerHTML = ''; const scroll = g.scrollTop;
    const add = (o) => {
      const d = document.createElement('button'); d.className = 'card' + (o.locked ? ' locked' : '') + (o.sel ? ' sel' : '');
      const cvs = document.createElement('canvas'); cvs.width = 200; cvs.height = 150; d.appendChild(cvs);
      if (o.tag) { const t = document.createElement('span'); t.className = 'tag' + (o.tag === 'MODERN' ? ' m' : ''); t.textContent = o.tag; d.appendChild(t); }
      const b = document.createElement('b'); b.textContent = o.name; d.appendChild(b);
      const p = document.createElement('div'); p.className = 'pr'; p.innerHTML = o.locked ? `<i class="coin s"></i>${o.price}` : (o.sel ? '<span style="color:#4ade80">✔ Seçili</span>' : '<span style="color:#9ca3af">Sahipsin</span>'); d.appendChild(p);
      d.onclick = () => o.click(); g.appendChild(d); o.draw(cvs.getContext('2d'));
    };
    const owned = (t, id) => { const list = t === 'w' ? WEAPONS : t === 'h' ? HEADS : BACKS; return list[id].price === 0 || save.owned[t].includes(id); };
    const buy = (items, then) => {
      const cost = items.reduce((a, [t, id]) => a + (owned(t, id) ? 0 : (t === 'w' ? WEAPONS : t === 'h' ? HEADS : BACKS)[id].price), 0);
      if (cost > save.coins) { this.toast('Yetersiz altın! (' + cost + ' gerekli)'); sfx('hit'); return; }
      if (cost > 0) { save.coins -= cost; items.forEach(([t, id]) => { if (!owned(t, id)) save.owned[t].push(id); }); this.toast('Satın alındı! -' + cost); sfx('coin'); } else sfx('click');
      then(); persist(); refreshShowcase(); this.renderCustom();
    };
    const info = (t, d) => { $('#ci-t').textContent = t; $('#ci-d').textContent = d; };
    if (this.tab === 'chars') {
      info('Karakterler', 'Hazır anime ve modern karakter setleri. Silah, kafa, sırt aksesuarı ve renkleri tek dokunuşla giyer.');
      for (const ch of CHARS) {
        const items = [['w', ch.weapon], ['h', ch.head], ['b', ch.back]], cost = items.reduce((a, [t, id]) => a + (owned(t, id) ? 0 : (t === 'w' ? WEAPONS : t === 'h' ? HEADS : BACKS)[id].price), 0);
        const sel = L.weapon === ch.weapon && L.head === ch.head && L.back === ch.back && L.c1 === ch.c1;
        add({ name: ch.name, price: cost, locked: cost > 0, sel, tag: WEAPONS[ch.weapon].cat === 'anime' ? 'ANİME' : 'MODERN', draw: c => miniFighter(c, ch),
          click: () => { info(ch.name, WEAPONS[ch.weapon].name + ' — ' + WEAPONS[ch.weapon].desc); buy(items, () => Object.assign(L, { weapon: ch.weapon, head: ch.head, back: ch.back, c1: ch.c1, c2: ch.c2 })); } });
      }
    } else if (this.tab === 'weapons') {
      const cur = WEAPONS[L.weapon]; info(cur ? cur.name : 'Rastgele', cur ? cur.desc : 'Her turda sahip olduğun silahlardan biri.');
      add({ name: 'Rastgele', price: 0, sel: L.weapon === 'random', draw: c => { c.font = '900 80px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('🎲', 100, 105); }, click: () => { L.weapon = 'random'; sfx('click'); persist(); refreshShowcase(); this.renderCustom(); } });
      for (const w of WLIST) add({ name: w.name, price: w.price, locked: !owned('w', w.id), sel: L.weapon === w.id, tag: w.cat === 'anime' ? 'ANİME' : 'MODERN', draw: c => weaponIcon(c, w),
        click: () => { info(w.name + (owned('w', w.id) ? '' : ' · ' + w.price + ' altın'), w.desc); buy([['w', w.id]], () => L.weapon = w.id); } });
    } else if (this.tab === 'head' || this.tab === 'back') {
      const isH = this.tab === 'head', list = isH ? HLIST : BLIST, t = isH ? 'h' : 'b';
      info(isH ? 'Kafa Aksesuarları' : 'Sırt Aksesuarları', 'Saçlar, maskeler, şapkalar, pelerinler, kanatlar ve daha fazlası.');
      for (const it of list) add({ name: it.name, price: it.price, locked: !owned(t, it.id), sel: (isH ? L.head : L.back) === it.id,
        draw: c => miniFighter(c, Object.assign({}, L, isH ? { head: it.id } : { back: it.id }), isH),
        click: () => buy([[t, it.id]], () => { if (isH) L.head = it.id; else L.back = it.id; }) });
    } else {
      info('Renkler', 'Renk 1 vücut, Renk 2 aksesuar ve enerji parıltısı.');
      for (const [k, lab] of [['c1', 'RENK 1 · VÜCUT'], ['c2', 'RENK 2 · DETAY']]) {
        const h = document.createElement('h3'); h.textContent = lab; h.style.gridColumn = '1/-1'; g.appendChild(h);
        const wrap = document.createElement('div'); wrap.className = 'swg'; wrap.style.gridColumn = '1/-1';
        for (const col of COLORS) { const b = document.createElement('button'); b.className = 'sw' + (L[k] === col ? ' sel' : ''); b.style.background = col; b.onclick = () => { L[k] = col; sfx('click'); persist(); refreshShowcase(); this.renderCustom(); }; wrap.appendChild(b); }
        g.appendChild(wrap);
      }
    }
    g.scrollTop = scroll;
  }
};

function miniFighter(c, load, headZoom) {
  const f = new Fighter({ load: Object.assign({}, load, { weapon: load.weapon === 'random' ? 'fists' : load.weapon }) });
  f.onG = true; f.face = 1; const savedMap = G.map; G.map = G.map || MAPS[0];
  c.save(); if (headZoom) { c.translate(100, 205); f.s = 2.5; f.x = -10; f.y = 0; } else { f.s = 1.15; f.x = 92; f.y = 138; }
  if (headZoom) f.y = 0; drawFighter(c, f); c.restore(); G.map = savedMap;
}
function weaponIcon(c, w) {
  c.save(); const t = G.time;
  glow(c, 100, 75, 70, 'rgba(125,211,252,.25)');
  switch (w.id) {
    case 'spiral': orb(c, 100, 75, 28, '#bfe9ff', '#38bdf8', t); break;
    case 'chidori': glow(c, 100, 75, 60, 'rgba(147,197,253,.8)'); c.strokeStyle = '#eff6ff'; c.lineWidth = 3; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; jag(c, 100, 75, 100 + Math.cos(a) * 60, 75 + Math.sin(a) * 50, 4, 8); } break;
    case 'void': orb(c, 70, 75, 18, '#bfdbfe', '#3b82f6', t); orb(c, 130, 75, 18, '#fecaca', '#ef4444', t); orb(c, 100, 75, 12, '#f5d0fe', '#a855f7', t); break;
    case 'shrine': c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(40 + i * 25, 30); c.lineTo(70 + i * 25, 120); c.stroke(); } glow(c, 100, 75, 60, 'rgba(239,68,68,.5)'); break;
    case 'ki': glow(c, 100, 75, 70, 'rgba(56,189,248,.8)'); c.fillStyle = '#e0f2fe'; c.fillRect(100, 62, 100, 26); orb(c, 90, 75, 24, '#fff', '#38bdf8', t); break;
    case 'blackflame': glow(c, 100, 75, 60, 'rgba(76,29,149,.9)'); c.fillStyle = '#000'; c.beginPath(); c.moveTo(70, 115); c.quadraticCurveTo(60, 60, 100, 25); c.quadraticCurveTo(95, 60, 120, 55); c.quadraticCurveTo(145, 90, 130, 115); c.fill(); break;
    case 'rubber': c.strokeStyle = '#e8b796'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(20, 80); c.lineTo(140, 72); c.stroke(); c.save(); c.translate(150, 72); fist(c, '#ef4444', null, 2.6); c.restore(); for (let i = 0; i < 3; i++) { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(40 + i * 25, 55); c.lineTo(70 + i * 25, 55); c.stroke(); } break;
    case 'shadow': drawWolf(c, { x: 95, y: 82, vx: 1, t }); break;
    case 'clone': for (const [x, a] of [[60, .5], [140, .5], [100, 1]]) { c.globalAlpha = a; c.fillStyle = '#e2e8f0'; c.beginPath(); c.arc(x, 55, 15, 0, TAU); c.fill(); c.fillRect(x - 4, 68, 8, 50); } c.globalAlpha = 1; smoke && 0; break;
    case 'cursed': glow(c, 100, 75, 60, 'rgba(220,38,38,.8)'); c.save(); c.translate(90, 75); fist(c, '#111', 'rgba(0,0,0,.6)', 3.5); c.restore(); c.strokeStyle = '#dc2626'; c.lineWidth = 3; jag(c, 40, 30, 160, 120, 6, 12); break;
    case 'fists': c.save(); c.translate(90, 75); fist(c, '#f1f5f9', null, 4); c.restore(); break;
    default: c.translate(w.kind === 'gun' ? 50 : 40, w.kind === 'gun' ? 78 : 112); c.rotate(w.kind === 'gun' ? 0 : -.75); const sc = w.kind === 'gun' ? 1.6 : 1.45; c.scale(sc, sc); w.draw(c);
  }
  c.restore();
}

// ---- events ----
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; audio();
  const act = b.dataset.act, mode = b.dataset.mode;
  if (mode) { sfx('click'); UI.openSetup(mode); return; }
  if (b.parentElement && b.parentElement.classList.contains('seg') && b.parentElement.dataset.k) { UI.setup[b.parentElement.dataset.k] = +b.dataset.v; sfx('click'); UI.syncSeg(); return; }
  if (b.dataset.p !== undefined) { UI.cp = +b.dataset.p; sfx('click'); UI.renderCustom(); return; }
  if (b.dataset.t) { UI.tab = b.dataset.t; sfx('click'); UI.renderCustom(); return; }
  if (!act) return; sfx('click');
  switch (act) {
    case 'menu': if (UI.cur === 'custom' && UI.backTo === 'setup') { G.state = 'menu'; UI.openSetup(UI.setup.mode); } else UI.menu(); break;
    case 'custom': UI.openCustom(); break;
    case 'start': UI.start(); break;
    case 'resume': G.paused = false; UI.show('none'); break;
    case 'restart': UI.show('none'); startGame(G.cfg); break;
    case 'closemodal': UI.show('menu'); break;
    case 'gift': { const today = new Date().toDateString(); if (save.lastGift === today) UI.toast('Bugünkü hediyeni aldın. Yarın gel!'); else { save.lastGift = today; addCoins(200); sfx('coin'); UI.toast('+200 altın! 🎁'); burst(W / 2, H / 2, 40, ['#ffd23f', '#fff'], 500, 1, 5, 400); } UI.refreshTop(); break; }
    case 'howto': UI.modal(`<h2>🎮 KONTROLLER</h2><div class="howto">
      <div><b>📱 Dokunmatik</b><br>1 oyuncu: sol alt ◀ ▶ hareket; sağda ZIPLA, SALDIR ve ★ ÖZEL.<br>2 oyuncu: her oyuncunun kendi köşesinde 5 tuşu var (P1 sol, P2 sağ). Telefonu yatay tutun, karşılıklı oynayın!</div>
      <div><b>⌨️ Klavye</b><br>P1: <kbd>A</kbd><kbd>D</kbd> hareket, <kbd>W</kbd> zıpla, <kbd>F</kbd> saldır, <kbd>G</kbd> özel<br>P2: <kbd>←</kbd><kbd>→</kbd> hareket, <kbd>↑</kbd> zıpla, <kbd>K</kbd> saldır, <kbd>L</kbd> özel<br><kbd>Esc</kbd> duraklat</div>
      <div><b>⚡ Enerji</b><br>Vurdukça ve zamanla enerji dolar. Mavi çubuk silahın özel maliyetine ulaşınca ★ ÖZEL hazırdır.</div>
      <div><b>🪙 Altın</b><br>Maç kazan, dalga temizle, boss yen. Altınla anime silahları, saçlar, maskeler, pelerinler ve karakterler aç.</div></div>`); break;
    case 'settings': UI.modal(`<h2>⚙️ AYARLAR</h2><div class="seg" style="gap:16px"><button id="t-sfx" class="${save.sfx ? 'on' : ''}">🔊 Ses: ${save.sfx ? 'Açık' : 'Kapalı'}</button><button id="t-shake" class="${save.shake ? 'on' : ''}">📳 Ekran sarsıntısı: ${save.shake ? 'Açık' : 'Kapalı'}</button></div>`);
      $('#t-sfx').onclick = () => { save.sfx = !save.sfx; persist(); UI.show('menu'); }; $('#t-shake').onclick = () => { save.shake = !save.shake; persist(); UI.show('menu'); }; break;
  }
});
$('#pnameIn').addEventListener('input', e => { save.load[UI.cp].name = e.target.value.slice(0, 14) || ('Oyuncu ' + (UI.cp + 1)); persist(); });
$('#pnameIn').addEventListener('keydown', e => e.stopPropagation());
// Android back button hook
window.androidBack = function () {
  if (UI.cur === 'none' && G.state === 'play') { togglePause(); return true; }
  if (UI.cur === 'pause' || UI.cur === 'results' || UI.cur === 'setup' || UI.cur === 'custom' || UI.cur === 'modal') { UI.menu(); return true; }
  return false;
};
// keep icons animated in customize
setInterval(() => { if (UI.cur === 'custom' && UI.tab === 'weapons') { /* static icons are fine */ } }, 1000);

// ===== Boot =====
loadSave();
['fists', 'katana', 'plasma'].forEach(id => { if (!save.owned.w.includes(id)) save.owned.w.push(id); });
resize(); UI.menu();
if (location.search.includes('demo')) { // CPU vs CPU demo
  UI.show('none'); startGame({ mode: 'cpu', map: -1, diff: 2, target: 3, players: 1 }); G.fighters[0].ai = new AI(2);
}
requestAnimationFrame(frame);
