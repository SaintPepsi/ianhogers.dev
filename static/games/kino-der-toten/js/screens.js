// Menus: title, champion select, how to play, settings, pause, game over.

import { $, store, fmt } from './util.js';
import { CHAMPS, FLASH } from './champdata.js';
import { iconEl } from './icons.js';
import { sfx } from './audio.js';

const SCREENS = ['menu', 'select', 'help', 'settings', 'pause', 'over'];

export function createScreens(o) {
  const { settings, saveSettings, start, drawCard, applySettings, isTouch } = o;
  let picked = store.get('kino.lastChamp', 'katarina');
  if (!CHAMPS[picked]) picked = 'katarina';
  let backTo = 'menu';
  let lastChamp = picked;

  const show = (name) => {
    for (const s of SCREENS) $(s).hidden = s !== name;
    if (name === 'menu') renderRecords();
    if (name === 'select') renderSelect();
    if (name === 'help') renderHelp();
    if (name === 'settings') renderSettings();
    const first = $(name).querySelector('.mbtn.primary, .mbtn, button');
    if (first && !isTouch) first.focus({ preventScroll: true });
  };
  const hideAll = () => {
    for (const s of SCREENS) $(s).hidden = true;
  };
  for (const b of document.querySelectorAll('[data-back]')) {
    b.addEventListener('click', () => {
      sfx.click();
      show(backTo);
    });
  }
  for (const b of document.querySelectorAll('button')) b.addEventListener('mouseenter', () => sfx.hover());

  $('mPlay').addEventListener('click', () => {
    sfx.click();
    backTo = 'menu';
    show('select');
  });
  $('mHelp').addEventListener('click', () => {
    sfx.click();
    backTo = 'menu';
    show('help');
  });
  $('mSettings').addEventListener('click', () => {
    sfx.click();
    backTo = 'menu';
    show('settings');
  });
  $('lockIn').addEventListener('click', () => {
    sfx.click();
    store.set('kino.lastChamp', picked);
    lastChamp = picked;
    hideAll();
    start(picked);
  });
  $('pResume').addEventListener('click', () => {
    sfx.click();
    hideAll();
    o.onResume();
  });
  $('pHelp').addEventListener('click', () => {
    sfx.click();
    backTo = 'pause';
    show('help');
  });
  $('pSettings').addEventListener('click', () => {
    sfx.click();
    backTo = 'pause';
    show('settings');
  });
  $('pQuit').addEventListener('click', () => {
    sfx.click();
    hideAll();
    o.onQuit();
  });
  $('oAgain').addEventListener('click', () => {
    sfx.click();
    hideAll();
    start(lastChamp);
  });
  $('oChamp').addEventListener('click', () => {
    sfx.click();
    o.onQuit();
    backTo = 'menu';
    show('select');
  });
  $('oMenu').addEventListener('click', () => {
    sfx.click();
    o.onQuit();
  });

  function renderRecords() {
    const best = store.get('kino.best', {});
    const el = $('records');
    el.innerHTML = '';
    for (const id of ['amumu', 'katarina', 'yi']) {
      if (!best[id]) continue;
      const s = document.createElement('span');
      s.innerHTML = `${CHAMPS[id].name}: round <b>${best[id]}</b>`;
      el.appendChild(s);
    }
  }

  function renderSelect() {
    const box = $('champCards');
    box.innerHTML = '';
    const best = store.get('kino.best', {});
    for (const id of ['amumu', 'katarina', 'yi']) {
      const c = CHAMPS[id];
      const b = document.createElement('button');
      b.className = 'ccard' + (id === picked ? ' on' : '');
      const cv = document.createElement('canvas');
      cv.width = 320;
      cv.height = 240;
      b.appendChild(cv);
      try {
        drawCard(cv, id);
      } catch (e) {
        console.warn(e);
      }
      const body = document.createElement('div');
      body.className = 'cbody';
      body.innerHTML = `<div class="cname">${c.name}</div><div class="ctitle">${c.title}</div><div class="crole">${c.role}</div>`;
      b.appendChild(body);
      if (best[id]) {
        const r = document.createElement('div');
        r.className = 'cbest';
        r.textContent = `Best: round ${best[id]}`;
        b.appendChild(r);
      }
      b.addEventListener('click', () => {
        sfx.click();
        picked = id;
        for (const el of box.children) el.classList.remove('on');
        b.classList.add('on');
        renderInfo();
      });
      box.appendChild(b);
    }
    renderInfo();
    $('lockIn').disabled = false;
  }
  function renderInfo() {
    const c = CHAMPS[picked];
    const el = $('champInfo');
    el.innerHTML = '';
    const keys = settings.scheme === 'wasd' ? { Q: 'RMB', W: 'Shift', E: 'E', R: 'R' } : { Q: 'Q', W: 'W', E: 'E', R: 'R' };
    const row = (spec, label) => {
      const d = document.createElement('div');
      d.className = 'abl';
      d.appendChild(iconEl(spec.icon, 88));
      const b = document.createElement('b');
      b.innerHTML = `<small>${label}</small>${spec.name}`;
      const p = document.createElement('p');
      p.innerHTML = spec.text + (spec.pap ? `<br><span style="color:#c27cff">Pack-a-Punch: ${spec.pap}. ${spec.papText}</span>` : '');
      d.append(b, p);
      el.appendChild(d);
    };
    row(c.passive, 'Passive');
    for (const k of ['Q', 'W', 'E', 'R']) row(c[k], `${k} [${keys[k]}]`);
    row(FLASH, settings.scheme === 'wasd' ? 'Flash [Q]' : 'Flash [D]');
  }

  function renderHelp() {
    const wasd = settings.scheme === 'wasd';
    const k = (s) => `<kbd>${s}</kbd>`;
    $('helpBody').innerHTML = `
      <h3>The idea</h3>
      <p>Kino der Toten, the Black Ops zombies map, rebuilt from its own layout and rules: same rooms, doors and prices, same perks, the Mystery Box, the teleporter to Pack-a-Punch, traps, Hellhound rounds and Nova 6 crawlers. The guns are gone. You hold the line with a League of Legends champion and their real kit instead. Survive as many rounds as you can.</p>
      <h3>Controls (${wasd ? 'WASD' : 'Classic'}${isTouch ? ', touch' : ''})</h3>
      ${isTouch ? `<p>Left stick moves. The big button attacks the nearest zombie. Tap an ability to cast it at the nearest zombie, or drag from it to aim. <b>USE</b> buys, opens and rebuilds (hold it at a window).</p>` : ''}
      <table>
      ${wasd
        ? `<tr><td>${k('W')}${k('A')}${k('S')}${k('D')}</td><td>Move</td></tr>
           <tr><td>${k('Left mouse')}</td><td>Basic attack (hold to keep swinging at whatever is in reach)</td></tr>
           <tr><td>${k('Right mouse')} ${k('Shift')} ${k('E')} ${k('R')}</td><td>Abilities Q, W, E, R (League's own WASD layout), aimed at the cursor</td></tr>
           <tr><td>${k('Q')}</td><td>Flash</td></tr>`
        : `<tr><td>${k('Right mouse')}</td><td>Move, or attack the zombie you click (hold to keep moving)</td></tr>
           <tr><td>${k('A')}</td><td>Attack-move towards the cursor; ${k('S')} stops</td></tr>
           <tr><td>${k('Q')}${k('W')}${k('E')}${k('R')}</td><td>Abilities, aimed at the cursor</td></tr>
           <tr><td>${k('D')}</td><td>Flash</td></tr>`}
      <tr><td>${k('F')}</td><td>Buy, open, take, use. Hold it at a broken window to rebuild boards (10 points each).</td></tr>
      <tr><td>${k('Alt')} + ${k('Q')}/${k('W')}/${k('E')}/${k('R')}</td><td>Rank up an ability, or click the + over it (or turn on auto ranking in Settings)</td></tr>
      <tr><td>${k('1')}${k('2')}${k('3')}${k('5')}${k('6')}${k('7')}</td><td>Item actives (League's item keys)</td></tr>
      <tr><td>${k('4')}</td><td>Throw Poro-Snax (the Cymbal Monkey) if the box gave you some</td></tr>
      <tr><td>${k('G')}</td><td>Plant a Noxious Trap (the Claymores from the stage wall)</td></tr>
      <tr><td>${k('Mouse wheel')}</td><td>Zoom</td></tr>
      <tr><td>${k('Esc')} / ${k('P')}</td><td>Pause</td></tr>
      </table>
      <h3>Black Ops rules, kept</h3>
      <ul>
        <li>Zombie numbers per round, spawn speed, walkers turning into runners and sprinters: all from the original scripts. Health follows the original curve at half strength, since a champion hits far slower than a gun: round 1 has 6 walkers with 75 health, round 10 zombies have 523.</li>
        <li>Points: 10 per hit that doesn't kill, 60 for a kill, 100 for a crit or a landed skillshot kill (the headshot), 130 for a basic-attack kill (the knife kill). Board repairs pay 10 each, capped per round. Going down costs 5%.</li>
        <li>Two bites put a champion without Juggernog close to going down; Juggernog multiplies your health by 2.5, like 100 to 250 in Black Ops. Health comes back on its own a few seconds after you stop getting hit.</li>
        <li>Perks: Juggernog 2500, Speed Cola 3000 (cooldowns instead of reloads), Double Tap 2000 (attack speed instead of fire rate), Quick Revive 500 in solo (gets you back up once; the machine leaves after three). Going down loses them all.</li>
        <li>Turn on the power backstage, either way round: Lower Hall, Alley, Back Room, Stage (750, 1000, 1250, 1250) or Upper Hall, Foyer, Dressing Room, Stage (750, 1000, 1250, 1250).</li>
        <li>Teleporter: start the link at the stage pad, finish it at the mainframe in the Lobby, then step on the pad. 30 seconds in the projector room with Pack-a-Punch, then home. Re-link every trip.</li>
        <li>Mystery Box (950) gives League items instead of guns. Tibbers is the teddy bear. Fire Sale makes every box 10.</li>
        <li>Wall chalk sells items at the price of the gun that used to hang there. Traps cost 1000 and kill anything that walks in, including you without Juggernog.</li>
        <li>Hellhound rounds start on round 5, 6 or 7. Nova 6 crawlers come through the roof once the curtains open; kill them in melee to stop the gas.</li>
      </ul>
      <h3>League rules, kept</h3>
      <ul>
        <li>Abilities use live patch numbers. Level 1 to 18 from kills, a skill point per level, R at 6, 11 and 16.</li>
        <li>Zombies have no armor or magic resist and count as monsters (so Alpha Strike and Sunfire get their monster bonus); League's damage caps against monsters are switched off.</li>
        <li>Champion health doesn't grow with level here. Black Ops decides how many bites you can take; items and Juggernog are how you get tougher.</li>
        <li>You fight in melee, where guns never had to, so zombies take turns: at most two swing at you at the same time.</li>
      </ul>
      <p class="dim">Unofficial fan tribute, made with love for both games. Not affiliated with or endorsed by Activision, Treyarch or Riot Games. Every model, texture, sound and tune here is original.</p>`;
  }

  function renderSettings() {
    const el = $('settingsBody');
    el.innerHTML = '';
    const seg = (label, small, key, opts) => {
      const r = document.createElement('div');
      r.className = 'set-row';
      r.innerHTML = `<label>${label}<small>${small}</small></label>`;
      const s = document.createElement('div');
      s.className = 'seg';
      for (const [v, t] of opts) {
        const b = document.createElement('button');
        b.textContent = t;
        b.className = settings[key] === v ? 'on' : '';
        b.addEventListener('click', () => {
          settings[key] = v;
          for (const x of s.children) x.classList.remove('on');
          b.classList.add('on');
          applySettings();
          sfx.click();
        });
        s.appendChild(b);
      }
      r.appendChild(s);
      el.appendChild(r);
    };
    const slider = (label, key) => {
      const r = document.createElement('div');
      r.className = 'set-row';
      r.innerHTML = `<label>${label}</label>`;
      const i = document.createElement('input');
      i.type = 'range';
      i.min = '0';
      i.max = '1';
      i.step = '0.05';
      i.value = String(settings[key]);
      i.addEventListener('input', () => {
        settings[key] = +i.value;
        applySettings();
      });
      r.appendChild(i);
      el.appendChild(r);
    };
    seg('Controls', "WASD is League's keyboard mode (left click attacks, right click is Q). Classic is right-click to move.", 'scheme', [['wasd', 'WASD'], ['classic', 'Classic']]);
    if (!isTouch) seg('Auto rank abilities', 'Spend skill points for you in the usual order', 'autoLevel', [[true, 'On'], [false, 'Off']]);
    seg('Graphics', 'Low turns off bloom and renders at 1x', 'quality', [['high', 'High'], ['low', 'Low']]);
    seg('Damage numbers', '', 'numbers', [[true, 'On'], [false, 'Off']]);
    seg('Screen shake', '', 'shake', [[true, 'On'], [false, 'Off']]);
    slider('Master volume', 'master');
    slider('Music', 'music');
    slider('Sound effects', 'sfx');
  }

  return {
    show,
    hideAll,
    pause(game) {
      backTo = 'pause';
      const p = game.player;
      $('pauseInfo').innerHTML = `${CHAMPS[p.id].name}, level ${p.level} · Round ${game.round} · ${fmt(game.points)} points · ${game.stats.kills} kills`;
      show('pause');
    },
    over(info, prevBest) {
      const s = info.stats;
      const champ = CHAMPS[info.champ];
      const rounds = info.round;
      $('overSub').innerHTML = `${champ.name} survived <b>${rounds}</b> round${rounds === 1 ? '' : 's'}${rounds > prevBest && prevBest > 0 ? ' (new best!)' : ''}`;
      const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
      const stat = (label, v) => `<div><span>${label}</span><b>${v}</b></div>`;
      $('overStats').innerHTML =
        stat('Kills', fmt(s.kills)) + stat('Knife kills', fmt(s.knife)) + stat('Headshots', fmt(s.headshots)) + stat('Hellhounds', fmt(s.dogs)) +
        stat('Crawlers', fmt(s.crawlers)) + stat('Downs', s.downs) + stat('Revives', s.revives) + stat('Doors opened', s.doors) +
        stat('Box pulls', s.boxes) + stat('Pack-a-Punches', s.paps) + stat('Damage', fmt(s.damage)) + stat('Time', `${mins}:${String(secs).padStart(2, '0')}`);
      backTo = 'menu';
      show('over');
    },
  };
}
