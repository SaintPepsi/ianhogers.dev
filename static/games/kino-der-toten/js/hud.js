// In-game HUD. Black Ops pieces (round tallies, points, perk icons, prompts) around a
// League-style champion bar (abilities, health and mana, items) and a minimap.

import { $, clamp, fmt } from './util.js';
import { drawRound } from './tally.js';
import { icon, iconEl } from './icons.js';
import { CHAMPS, FLASH, xpFor } from './champdata.js';
import { PERKS } from './rules.js';
import { PORO } from './items.js';
import { POWERUP_INFO, SPECIAL_WALL } from './game.js';
import { CELL } from './grid.js';
import { ROOMS, toZ } from './map.js';

const PERK_ICON = {
  jugg: { bg: ['#b0141c', '#4a0508'], glyph: 'shield', fg: '#ffd8d8', round: true, border: '#ffcf6a' },
  speed: { bg: ['#1f8a3a', '#06240e'], glyph: 'bolt', fg: '#eaffea', round: true, border: '#d0ffd0' },
  tap: { bg: ['#d99a1b', '#4a2a04'], glyph: 'bullets', fg: '#fff3d0', round: true, border: '#ffe9a0' },
  revive: { bg: ['#4fb6ff', '#0b3a66'], glyph: 'cross', fg: '#ffffff', round: true, border: '#d8f0ff' },
};
const ITEM_KEYS = ['1', '2', '3', '5', '6', '7'];

export function createHud(holder, settings, opts) {
  const G = () => holder.game;
  const els = {
    hud: $('hud'), points: $('points'), pops: $('pops'), round: $('round'), roundSvg: $('roundSvg'), perks: $('perks'),
    announce: $('announce'), sub: $('subannounce'), toasts: $('toasts'), prompt: $('prompt'), channel: $('channel'), channelLbl: $('channelLbl'), channelBar: $('channelBar'),
    abilities: $('abilities'), hpFill: $('hpFill'), hpShield: $('hpShield'), hpTxt: $('hpTxt'), manaRow: $('manaRow'), manaFill: $('manaFill'), manaTxt: $('manaTxt'),
    items: $('items'), stats: $('stats'), lvl: $('lvl'), xpRing: document.querySelector('#xpRing circle'), portrait: $('portraitCv'),
    powerups: $('powerups'), downed: $('downed'), downedMsg: $('downedMsg'), downedBar: $('downedBar'), swap: $('swap'), swapTtl: $('swapTtl'),
    papMenu: $('papMenu'), papOpts: $('papOpts'), papSub: $('papSub'), hurt: $('hurt'), gasfx: $('gasfx'), flashfx: $('flashfx'), fade: $('fade'),
    minimap: $('minimap'), roomName: $('roomName'), gl: $('gl'), vision: $('vision'),
  };
  const mm = els.minimap.getContext('2d');
  let abilityEls = {};
  let itemEls = [];
  let puEls = {};
  let lastPoints = -1;
  let hurtV = 0;
  let shell = 0;
  let after = null;
  let lastRound = -1;
  let blinkT = 0;
  let mmStatic = null;
  let mmKey = '';
  const seenBox = new Set();

  const keyLabels = () => {
    const wasd = settings.scheme === 'wasd';
    return wasd ? { Q: 'RMB', W: 'SHFT', E: 'E', R: 'R', flash: 'Q', use: 'F' } : { Q: 'Q', W: 'W', E: 'E', R: 'R', flash: 'D', use: 'F' };
  };

  // ------------------------------------------------------------------ tooltips
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  const showTip = (e, html) => {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = e.currentTarget.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - 310, r.left - 120)) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 10) + 'px';
  };
  const hideTip = () => (tip.hidden = true);

  const ui = {
    // ---------------------------------------------------------------- points
    pop(v) {
      if (!v) return;
      const e = document.createElement('div');
      e.className = 'pop' + (v < 0 ? ' neg' : '');
      e.textContent = (v > 0 ? '+' : '') + v;
      e.style.bottom = Math.random() * 22 + 'px';
      els.pops.appendChild(e);
      setTimeout(() => e.remove(), 1000);
      while (els.pops.children.length > 14) els.pops.firstChild.remove();
    },
    flashPoints() {
      els.points.animate([{ color: '#ff5050' }, { color: '#fff' }], { duration: 500 });
    },
    // ---------------------------------------------------------------- messages
    announce(text, sub, color = '#fff', big) {
      if (text) {
        els.announce.textContent = text;
        els.announce.style.setProperty('--glow', color);
        els.announce.style.color = big ? color : '#fff';
        els.announce.classList.remove('show');
        void els.announce.offsetWidth;
        els.announce.classList.add('show');
      }
      if (sub) {
        els.sub.textContent = sub;
        els.sub.classList.remove('show');
        void els.sub.offsetWidth;
        els.sub.classList.add('show');
      }
    },
    toast(text, bad) {
      const e = document.createElement('div');
      e.className = 'toast' + (bad ? ' bad' : '');
      e.textContent = text;
      els.toasts.appendChild(e);
      while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
      setTimeout(() => e.remove(), 3400);
    },
    prompt(it, points) {
      if (!it) {
        if (els.prompt.dataset.k) {
          els.prompt.innerHTML = '';
          els.prompt.dataset.k = '';
        }
        return;
      }
      const k = keyLabels().use;
      const key = opts.touch ? '<kbd>USE</kbd>' : `<kbd>${k}</kbd>`;
      let html;
      if (it.bare) html = it.text;
      else {
        html = `${it.hold ? 'Hold' : 'Press'} ${key} ${it.text}`;
        if (it.cost) html += ` <span class="${points >= it.cost ? 'cost' : 'need'}">[Cost: ${fmt(it.cost)}]</span>`;
      }
      if (els.prompt.dataset.k !== html) {
        els.prompt.innerHTML = html;
        els.prompt.dataset.k = html;
      }
    },
    roomName(name) {
      els.roomName.textContent = name;
    },
    // ---------------------------------------------------------------- round
    round(n, blink) {
      if (n !== lastRound) {
        lastRound = n;
        drawRound(els.roundSvg, n);
      }
      if (blink) {
        els.round.classList.remove('blink');
        void els.round.offsetWidth;
        els.round.classList.add('blink');
      }
    },
    // ---------------------------------------------------------------- perks
    perks(set) {
      els.perks.innerHTML = '';
      for (const k of set) {
        const c = iconEl(PERK_ICON[k], 76);
        c.title = PERKS[k].name;
        els.perks.appendChild(c);
      }
    },
    // ---------------------------------------------------------------- champion bar
    abilities() {
      const p = G().player;
      if (!p) return;
      const def = CHAMPS[p.id];
      els.abilities.innerHTML = '';
      abilityEls = {};
      const kl = keyLabels();
      const mk = (key, spec, small) => {
        const d = document.createElement('div');
        d.className = 'ab' + (small ? ' small' : '');
        d.appendChild(iconEl(spec.icon, 96));
        const shade = document.createElement('div');
        shade.className = 'shade';
        d.appendChild(shade);
        const cd = document.createElement('div');
        cd.className = 'cd';
        d.appendChild(cd);
        if (key !== 'P') {
          const k = document.createElement('div');
          k.className = 'key';
          k.textContent = key === 'flash' ? kl.flash : kl[key];
          d.appendChild(k);
        }
        const cost = document.createElement('div');
        cost.className = 'cost';
        d.appendChild(cost);
        let pips = null, up = null, charges = null;
        if ('QWER'.includes(key) && key.length === 1) {
          pips = document.createElement('div');
          pips.className = 'pips';
          const n = key === 'R' ? 3 : 5;
          for (let i = 0; i < n; i++) pips.appendChild(document.createElement('i'));
          d.appendChild(pips);
          up = document.createElement('button');
          up.className = 'up';
          up.textContent = '+';
          up.title = 'Rank up (Alt + ' + key + ')';
          up.hidden = true;
          up.addEventListener('click', (e) => {
            e.stopPropagation();
            p.rankUp(key);
          });
          d.appendChild(up);
          charges = document.createElement('div');
          charges.className = 'charges';
          d.appendChild(charges);
        }
        d.addEventListener('mouseenter', (e) => {
          const pap = key in p.pap && p.pap[key];
          const name = pap ? `${spec.pap} <small style="color:#c27cff">(Pack-a-Punched)</small>` : spec.name;
          const body = pap ? spec.papText + '<br><br>' + spec.text : spec.text;
          showTip(e, `<b>${name}</b><br>${body}`);
        });
        d.addEventListener('mouseleave', hideTip);
        els.abilities.appendChild(d);
        abilityEls[key] = { d, shade, cd, cost, pips, up, charges, lastCd: '' };
      };
      mk('P', def.passive, true);
      for (const k of ['Q', 'W', 'E', 'R']) mk(k, def[k]);
      mk('flash', FLASH, true);
      // portrait
      opts.drawPortrait(els.portrait, p.id);
    },
    items() {
      const p = G().player;
      if (!p) return;
      els.items.innerHTML = '';
      itemEls = [];
      for (let i = 0; i < 6; i++) {
        const it = p.items[i];
        const d = document.createElement('div');
        d.className = 'it';
        if (it) d.appendChild(iconEl(it.def.icon, 64));
        const k = document.createElement('div');
        k.className = 'k';
        k.textContent = ITEM_KEYS[i];
        d.appendChild(k);
        const cd = document.createElement('div');
        cd.className = 'cd';
        cd.hidden = true;
        d.appendChild(cd);
        d.addEventListener('click', () => {
          if (G().swap) G().chooseSwap(i);
        });
        d.addEventListener('mouseenter', (e) => {
          const cur = G().player.items[i];
          if (cur) showTip(e, `<b>${cur.def.name}</b><br>${cur.def.text}${cur.def.active ? '<br><i>Active: press ' + ITEM_KEYS[i] + '</i>' : ''}`);
        });
        d.addEventListener('mouseleave', hideTip);
        els.items.appendChild(d);
        itemEls.push({ d, cd });
      }
    },
    swap(def) {
      els.swap.hidden = !def;
      if (def) els.swapTtl.textContent = `Inventory full: replace an item with ${def.name}?`;
      for (const it of itemEls) it.d.classList.toggle('swap', !!def);
    },
    papMenu(on) {
      els.papMenu.hidden = !on;
      if (!on) return;
      const p = G().player;
      const def = CHAMPS[p.id];
      els.papOpts.innerHTML = '';
      els.papSub.textContent = `Choose an ability to upgrade (5,000). Esc to cancel.`;
      for (const k of ['Q', 'W', 'E', 'R']) {
        const b = document.createElement('button');
        b.className = 'papo';
        b.disabled = p.ranks[k] <= 0 || p.pap[k] || G().points < 5000;
        b.appendChild(iconEl(def[k].icon, 64));
        const t = document.createElement('b');
        t.textContent = `${k}: ${def[k].name} → ${def[k].pap}`;
        const s = document.createElement('small');
        s.textContent = p.pap[k] ? 'Already upgraded' : p.ranks[k] <= 0 ? 'Not learned yet' : def[k].papText;
        b.append(t, s);
        b.addEventListener('click', () => G().papChoose(k));
        els.papOpts.appendChild(b);
      }
    },
    downed(on, msg) {
      els.downed.hidden = !on;
      els.downedMsg.textContent = msg || '';
      els.gl.style.filter = on ? 'grayscale(0.85) brightness(0.8)' : '';
    },
    downedProgress(f) {
      els.downedBar.style.width = clamp(f, 0, 1) * 100 + '%';
    },
    hurt(v) {
      hurtV = Math.max(hurtV, v);
    },
    shellshock(t) {
      shell = Math.max(shell, t);
    },
    whiteFlash() {
      els.flashfx.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
    },
    fog(on) {
      opts.setFog(on);
    },
    gas(on) {
      els.gasfx.style.opacity = on ? '1' : '0';
      els.gasfx.style.transition = 'opacity 0.6s';
    },
    fadeTo(v, dur) {
      els.fade.style.transition = `opacity ${dur}s ease`;
      els.fade.style.opacity = String(v);
    },
    aftereffect(i) {
      const fx = [
        { f: 'none', fov: true, t: 0.5 },
        { f: 'blur(3px) brightness(1.4)', t: 3 },
        { f: 'blur(2px) hue-rotate(160deg) saturate(2)', t: 3 },
        { f: 'grayscale(1)', t: 2 },
        { f: 'sepia(1) saturate(4) hue-rotate(-40deg)', t: 1.6 },
        { f: 'contrast(1.6) brightness(1.5)', t: 1.25 },
      ][i % 6];
      if (fx.fov) opts.fovPunch();
      after = { f: fx.f, t: fx.t };
    },
    // ---------------------------------------------------------------- per frame
    frame(dt) {
      const p = G().player;
      if (!p) return;
      // points
      if (G().points !== lastPoints) {
        lastPoints = G().points;
        els.points.textContent = fmt(G().points);
      }
      // health / mana
      const hpF = clamp(p.hp / p.maxHp, 0, 1);
      els.hpFill.style.width = hpF * 100 + '%';
      const sh = clamp(p.shield / p.maxHp, 0, 1 - hpF);
      els.hpShield.style.left = hpF * 100 + '%';
      els.hpShield.style.width = sh * 100 + '%';
      els.hpTxt.textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
      if (p.maxMana > 0) {
        els.manaRow.hidden = false;
        els.manaFill.style.width = clamp(p.mana / p.maxMana, 0, 1) * 100 + '%';
        els.manaTxt.textContent = `${Math.floor(p.mana)} / ${Math.round(p.maxMana)}`;
      } else els.manaRow.hidden = true;
      // level and xp
      els.lvl.textContent = p.level;
      const xpF = p.level >= 18 ? 1 : p.xp / xpFor(p.level);
      els.xpRing.style.strokeDashoffset = String(289 * (1 - xpF));
      // abilities
      const kl = keyLabels();
      for (const [k, a] of Object.entries(abilityEls)) {
        if (k === 'P') continue;
        let cd = 0, max = 1, locked = false, nomana = false, active = false;
        if (k === 'flash') {
          cd = p.cd.flash;
          max = FLASH.cd;
        } else {
          cd = p.cd[k];
          max = p.cdMax[k] || 1;
          locked = p.ranks[k] <= 0 || p.papBusy === k;
          const cost = p.kit.cost(k);
          nomana = !locked && cost > p.mana;
          a.cost.textContent = cost > 0 && p.maxMana > 0 ? cost : '';
          a.pips && [...a.pips.children].forEach((pip, i) => pip.classList.toggle('on', i < p.ranks[k]));
          a.up.hidden = !p.canRank(k) || settings.autoLevel;
          active =
            (k === 'W' && p.id === 'amumu' && p.kit.despair) ||
            (k === 'E' && p.id === 'yi' && p.buffs.wuju > 0) ||
            (k === 'R' && p.id === 'yi' && p.buffs.highlander > 0) ||
            (k === 'R' && p.channel && p.channel.kind === 'lotus') ||
            (k === 'W' && p.channel && p.channel.kind === 'meditate');
          a.d.classList.toggle('pap', !!p.pap[k]);
          if (p.id === 'amumu' && k === 'Q') {
            const q = p.kit.q;
            a.charges.textContent = p.ranks.Q > 0 ? q.n : '';
            if (q.n > 0 && q.lock <= 0) cd = 0;
          }
        }
        a.d.classList.toggle('locked', locked);
        a.d.classList.toggle('nomana', nomana);
        a.d.classList.toggle('active', active);
        const frac = cd > 0 ? clamp(cd / max, 0, 1) : 0;
        a.shade.style.background = frac > 0 ? `conic-gradient(rgba(0,0,0,0.72) ${frac * 360}deg, transparent 0)` : '';
        const txt = cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
        if (a.lastCd !== txt) {
          a.lastCd = txt;
          a.cd.textContent = txt;
        }
      }
      // items cooldowns, trinket and traps
      for (let i = 0; i < itemEls.length; i++) {
        const it = p.items[i];
        const c = p.itemCd[i];
        itemEls[i].cd.hidden = !(it && c > 0);
        if (it && c > 0) itemEls[i].cd.textContent = Math.ceil(c);
      }
      // stats
      const s = p.s;
      els.stats.innerHTML = `<span>AD <b>${Math.round(s.ad)}</b></span><span>AP <b>${Math.round(s.ap)}</b></span><span>AS <b>${s.as.toFixed(2)}</b></span><span>ARM <b>${Math.round(s.armor)}</b></span><span>MS <b>${Math.round(s.ms * 100)}</b></span><span>AH <b>${Math.round(s.ah)}</b></span>`;
      // timed power-ups
      for (const k of ['instakill', 'double', 'firesale']) {
        const t = G().timers[k];
        if (t > 0 && !puEls[k]) {
          const d = document.createElement('div');
          d.className = 'pu';
          d.appendChild(iconEl({ bg: ['#1a1a1a', '#000'], glyph: POWERUP_INFO[k].glyph, fg: POWERUP_INFO[k].color, round: true, border: POWERUP_INFO[k].color }, 64));
          const sp = document.createElement('span');
          d.appendChild(sp);
          els.powerups.appendChild(d);
          puEls[k] = { d, sp };
        }
        if (puEls[k]) {
          if (t <= 0) {
            puEls[k].d.remove();
            delete puEls[k];
          } else {
            puEls[k].sp.textContent = Math.ceil(t);
            puEls[k].d.classList.toggle('blink', t < 5);
          }
        }
      }
      // extra counters: poro-snax and noxious traps shown as pseudo powerups
      const tr = p.trinket && p.trinket.charges > 0 ? p.trinket.charges : 0;
      counter('poro', tr, { bg: ['#5a7a9a', '#16212a'], glyph: 'poro', fg: '#fff', round: true }, '4');
      counter('shroom', G().hasShrooms ? G().shroomCharges : 0, { bg: ['#3a5a1a', '#0e1806'], glyph: 'flame', fg: '#c8ff6a', round: true }, 'G');
      // channel bar (Meditate, Death Lotus, rebuilding, teleporter, Pack-a-Punch)
      let ch = null;
      if (p.channel) ch = { lbl: p.channel.kind === 'lotus' ? 'Death Lotus' : 'Meditate', f: 1 - p.channel.t / p.channel.max };
      else if (G().tele.trip && G().tele.trip.phase === 'pap') ch = { lbl: 'Projector room', f: 1 - G().tele.trip.t / 30 };
      else if (G().tele.trip && G().tele.trip.phase === 'charge') ch = { lbl: 'Teleporting', f: G().tele.trip.t / 1.8 };
      else if (G().papState.state === 'working') ch = { lbl: 'Pack-a-Punch', f: G().papState.t / 4.35 };
      else if (G().papState.state === 'ready') ch = { lbl: 'Take it before it slides back in!', f: 1 - G().papState.t / 15 };
      else if (G().elixir) ch = null;
      els.channel.classList.toggle('on', !!ch);
      if (ch) {
        els.channelLbl.textContent = ch.lbl;
        els.channelBar.style.width = clamp(ch.f, 0, 1) * 100 + '%';
      }
      // hurt vignette: recent damage plus low health
      hurtV = Math.max(0, hurtV - dt * 1.4);
      const low = p.downed ? 0.9 : hpF < 0.35 ? (0.35 - hpF) * 2.2 : 0;
      els.hurt.style.opacity = String(clamp(Math.max(hurtV, low), 0, 1));
      // shellshock and teleport after-effects drive a CSS filter on the canvas
      shell = Math.max(0, shell - dt);
      if (after) {
        after.t -= dt;
        if (after.t <= 0) after = null;
      }
      if (!p.downed) {
        const f = shell > 0 ? `blur(${Math.min(4, shell * 2)}px)` : after ? after.f : '';
        if (els.gl.style.filter !== f) els.gl.style.filter = f;
      }
      // round blink between rounds
      if (G().phase === 'intermission') {
        blinkT += dt;
      }
      ui.minimap();
    },
    minimap() {
      const map = G().map;
      const grid = G().grid;
      const W = els.minimap.width, H = els.minimap.height;
      // main map only (the teleport rooms sit far south)
      const zMax = toZ(-1720) / CELL;
      const cols = grid.w, rows = Math.floor(zMax);
      const sc = Math.min(W / cols, H / rows);
      const ox = (W - cols * sc) / 2, oy = (H - rows * sc) / 2;
      const key = map.doors.map((d) => (d.open ? 1 : 0)).join('') + (G().power ? 'p' : '');
      if (key !== mmKey) {
        mmKey = key;
        mmStatic = document.createElement('canvas');
        mmStatic.width = W;
        mmStatic.height = H;
        const g = mmStatic.getContext('2d');
        const reach = G().field;
        for (let cz = 0; cz < rows; cz++) {
          for (let cx = 0; cx < cols; cx++) {
            const i = cz * cols + cx;
            if (map.room[i] < 0 || map.wall[i]) continue;
            const r = ROOMS[map.room[i]];
            if (r.isolated) continue;
            const open = reach[i] < 0x3fffffff || map.seatCells[i];
            g.fillStyle = map.seatCells[i] ? '#3a1416' : open ? '#5b5246' : '#26221e';
            g.fillRect(ox + cx * sc, oy + cz * sc, Math.ceil(sc), Math.ceil(sc));
          }
        }
        for (const d of map.doors) {
          if (d.kind !== 'door' || d.open) continue;
          g.fillStyle = '#c8aa6e';
          g.fillRect(ox + (d.x / CELL) * sc - 2, oy + (d.z / CELL) * sc - 2, 4, 4);
        }
      }
      mm.clearRect(0, 0, W, H);
      mm.drawImage(mmStatic, 0, 0);
      const P = (x, z) => [ox + (x / CELL) * sc, oy + (z / CELL) * sc];
      // perks once the power is on, box when seen
      if (G().power) {
        for (const pm of Object.values(G().world.perks)) {
          if (pm.gone) continue;
          const [x, y] = P(pm.x, pm.z);
          mm.fillStyle = pm.mesh.userData.color;
          mm.fillRect(x - 2, y - 2, 4, 4);
        }
      }
      const B = G().box;
      if (B) {
        const b = G().world.boxes[B.spot];
        const p = G().player;
        if (Math.hypot(b.x - p.x, b.z - p.z) < 14 || G().power) seenBox.add(B.spot + ':' + B.moves);
        if (seenBox.has(B.spot + ':' + B.moves) && B.state !== 'teddy') {
          const [x, y] = P(b.x, b.z);
          mm.fillStyle = '#9fd3ff';
          mm.fillRect(x - 3, y - 2, 6, 4);
        }
      }
      // zombies
      mm.fillStyle = '#ff3b3b';
      for (const z of G().zombies) {
        if (z.dead || !z.inside) continue;
        const [x, y] = P(z.x, z.z);
        mm.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      // power-ups
      for (const pu of G().powerups) {
        const [x, y] = P(pu.x, pu.z);
        mm.fillStyle = POWERUP_INFO[pu.kind].color;
        mm.beginPath();
        mm.arc(x, y, 3, 0, 7);
        mm.fill();
      }
      // you
      const p = G().player;
      const [px, py] = P(p.x, p.z);
      if (py < H) {
        mm.save();
        mm.translate(px, py);
        mm.rotate(p.ang + Math.PI / 2);
        mm.fillStyle = '#7dff9a';
        mm.beginPath();
        mm.moveTo(0, -5);
        mm.lineTo(4, 4);
        mm.lineTo(-4, 4);
        mm.closePath();
        mm.fill();
        mm.restore();
      }
    },
    reset() {
      els.pops.innerHTML = '';
      els.toasts.innerHTML = '';
      els.powerups.innerHTML = '';
      puEls = {};
      els.announce.classList.remove('show');
      els.sub.classList.remove('show');
      els.prompt.innerHTML = '';
      els.prompt.dataset.k = '';
      els.downed.hidden = true;
      els.swap.hidden = true;
      els.papMenu.hidden = true;
      els.gl.style.filter = '';
      els.hurt.style.opacity = '0';
      els.gasfx.style.opacity = '0';
      els.fade.style.opacity = '0';
      lastPoints = -1;
      lastRound = -1;
      mmKey = '';
      hurtV = 0;
      shell = 0;
      after = null;
      seenBox.clear();
    },
  };

  const counters = {};
  function counter(id, n, spec, key) {
    if (n > 0 && !counters[id]) {
      const d = document.createElement('div');
      d.className = 'pu';
      d.appendChild(iconEl(spec, 64));
      const sp = document.createElement('span');
      d.appendChild(sp);
      els.powerups.appendChild(d);
      counters[id] = { d, sp };
    }
    if (counters[id]) {
      if (n <= 0) {
        counters[id].d.remove();
        delete counters[id];
      } else counters[id].sp.textContent = `${n} [${key}]`;
    }
  }
  const baseReset = ui.reset;
  ui.reset = () => {
    baseReset();
    for (const k of Object.keys(counters)) delete counters[k];
  };
  return ui;
}

export { PERK_ICON, SPECIAL_WALL };
