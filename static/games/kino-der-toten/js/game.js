// The match: rounds, spawning, points, power-ups, perks, the box, Pack-a-Punch, the
// teleporter, traps, turrets, doors, power, going down. Rules follow Black Ops (2010).

import * as THREE from 'three';
import * as R from './rules.js';
import { CELL } from './grid.js';
import { setDoor, P, toX, toZ, ZONE_DOORS, RISERS, DROPS, QUAD_HOLES, POIS, SPAWNS, PAP_ARRIVE, EE_ROOMS, ROOMS, FOYER_ROOF_TRIGGER, MAINFRAME } from './map.js';
import { makeZombie, updateZombie, enterPlay, BITE } from './zombies.js';
import { Champion } from './champions.js';
import { ITEMS, WALL_ITEMS, PORO, createItemSystem, rollWeighted } from './items.js';
import { SpatialHash, bus, dist, dist2, rand, randInt, chance, pick, shuffle, clamp, TAU } from './util.js';
import { sfx, playMusic, stopMusic, musicPlaying } from './audio.js';
import { CHAMPS } from './champdata.js';

const EXTRA_ITEMS = {
  boots: { name: 'Boots', gold: 300, stats: { ms: 25 }, text: '+25 move speed.', icon: { bg: ['#4a3a2a', '#14100b'], glyph: 'boot', fg: '#e8d0b0' } },
  kindlegem: { name: 'Kindlegem', gold: 800, stats: { hp: 200, ah: 10 }, text: '+200 HP, +10 ability haste.', icon: { bg: ['#5a1a1a', '#180606'], glyph: 'gem', fg: '#ff9a9a' } },
  recurve: {
    name: 'Recurve Bow', gold: 700, stats: { as: 15 }, text: '+15% attack speed. Attacks deal 15 bonus physical damage.', icon: { bg: ['#3a4a2a', '#10140b'], glyph: 'claw', fg: '#d8f0a8' },
    onHit(c, z, eff, g) {
      if (!z.dead) g.damage(z, 15 * eff, { type: 'physical', src: 'item', noHitPoints: true });
    },
  },
  bami: {
    name: "Bami's Cinder", gold: 900, unique: 'immolate', stats: { hp: 150, ah: 5 }, text: '+150 HP, +5 haste. Immolate: after dealing or taking damage, burn zombies within 3.25m for 15 magic damage per second (doubled against zombies).', icon: { bg: ['#6a3a0a', '#1e1003'], glyph: 'flame', fg: '#ffcf6a' },
    tick(c, dt, g) {
      if (g.time - c.combatT > 3 || c.downed) return;
      c.stacks.immo = (c.stacks.immo || 0) + dt;
      if (c.stacks.immo < 1) return;
      c.stacks.immo -= 1;
      g.queryZombies(c.x, c.z, 3.25, (z) => {
        if (!z.dead && z.targetable && dist(c.x, c.z, z.x, z.z) <= 3.25 + z.r) g.damage(z, 30, { type: 'magic', src: 'dot' });
      });
      g.fx.ring(c.x, c.y, c.z, 2.2, 3.25, '#ffb040', 0.5, 0.2);
    },
  },
  sheen: {
    name: 'Sheen', gold: 900, stats: { ah: 10 }, text: '+10 haste. Spellblade: after an ability, your next attack deals 100% base AD bonus physical damage (1.5s).', icon: { bg: ['#2a3a6a', '#0a0f1e'], glyph: 'sword', fg: '#bfd6ff' },
    onCast(c) {
      if ((c.stacks.sheenCd || 0) <= c.g.time) c.stacks.sheen = c.g.time + 10;
    },
    onHit(c, z, eff, g, ctx) {
      if (!ctx.attack || !(c.stacks.sheen > g.time) || z.dead) return;
      c.stacks.sheen = 0;
      c.stacks.sheenCd = g.time + 1.5;
      g.damage(z, c.s.baseAD, { type: 'physical', src: 'item', noHitPoints: true });
      g.fx.burst(z.x, z.y + 1, z.z, 8, { color: '#bfd6ff', speed: 3, life: 0.3, size: 0.18 });
    },
  },
  tiamat: {
    name: 'Tiamat', gold: 1200, unique: 'tiamat', stats: { ad: 25 }, text: '+25 AD. Attacks cleave 40% AD to zombies within 3.5m of the target. Active: 75% AD to zombies within 4.5m (10s).', icon: { bg: ['#4a4a2a', '#14140b'], glyph: 'axe', fg: '#f0e8b0' },
    onAttack(c, z, g) {
      g.queryZombies(z.x, z.z, 3.5, (o) => {
        if (o !== z && !o.dead && o.targetable && dist(z.x, z.z, o.x, o.z) <= 3.5 + o.r) g.damage(o, 0.4 * c.s.ad, { type: 'physical', src: 'item', noHitPoints: true });
      });
    },
    active: {
      cd: 10,
      use(c, g) {
        g.queryZombies(c.x, c.z, 4.5, (o) => {
          if (!o.dead && o.targetable && dist(c.x, c.z, o.x, o.z) <= 4.5 + o.r) g.damage(o, 0.75 * c.s.ad, { type: 'physical', src: 'item' });
        });
        g.fx.ring(c.x, c.y, c.z, 0.5, 4.5, '#f0e8b0', 0.35, 0.8);
        sfx.tantrum(c);
        return true;
      },
    },
  },
  phage: {
    name: 'Phage', gold: 1100, stats: { ad: 15, hp: 200 }, text: '+15 AD, +200 HP. Rage: attacking grants 20 move speed for 2s.', icon: { bg: ['#5a2a1a', '#180b06'], glyph: 'axe', fg: '#ffb08a' },
    onAttack(c, z, g) {
      c.stacks.rage = g.time + 2;
    },
  },
  bfsword: { name: 'B. F. Sword', gold: 1300, stats: { ad: 40 }, text: '+40 AD.', icon: { bg: ['#4a4a5a', '#121218'], glyph: 'sword', fg: '#e0e0ff' } },
  rod: { name: 'Needlessly Large Rod', gold: 1200, stats: { ap: 65 }, text: '+65 AP.', icon: { bg: ['#3a2a6a', '#0e0a1e'], glyph: 'staff', fg: '#d0c0ff' } },
};

/** Consumables / upgrades that don't take an item slot. */
const SPECIAL_WALL = {
  shrooms: { name: 'Noxious Traps', text: 'Teemo-style mushrooms (Claymores): 2 per purchase, topped up to 2 every round. Press G to plant one at your feet; it arms after 1s and bursts for 1500 magic damage and a 40% slow when a zombie steps near.' },
  bowie: { name: 'Bowie Knife', text: 'Your basic attacks deal 50% more damage. Basic-attack kills still pay the knife-kill 130.' },
  elixirWrath: { name: 'Elixir of Wrath', text: '+30 AD and 12% physical vamp for 3 minutes.' },
  elixirSorcery: { name: 'Elixir of Sorcery', text: '+50 AP for 3 minutes, and hits deal 25 bonus true damage (5s per zombie).' },
  elixirIron: { name: 'Elixir of Iron', text: '+300 HP and a bigger frame for 3 minutes.' },
};
for (const [id, d] of Object.entries(EXTRA_ITEMS)) {
  d.id = id;
  WALL_ITEMS[id] = d;
}

export const POWERUP_INFO = {
  maxammo: { name: 'Max Ammo', color: '#8fe36a', glyph: 'ammo' },
  instakill: { name: 'Insta-Kill', color: '#f2f2f2', glyph: 'skull' },
  double: { name: 'Double Points', color: '#ffd23f', glyph: 'x2' },
  nuke: { name: 'Kaboom!', color: '#ff7a2a', glyph: 'nuke' },
  carpenter: { name: 'Carpenter', color: '#c99a5a', glyph: 'hammer' },
  firesale: { name: 'Fire Sale', color: '#ff4a4a', glyph: 'tag' },
};

export function createGame(env) {
  const { scene, fx, world, map, settings, ui } = env;
  const grid = map.grid;
  const g = {
    time: 0,
    settings,
    scene,
    fx,
    world,
    map,
    grid,
    events: bus(),
    zombies: [],
    tasks: [],
    hash: new SpatialHash(2.5),
    field: new Int32Array(grid.w * grid.h),
    pathField: new Int32Array(grid.w * grid.h),
    pathGoal: null,
    fieldT: 0,
    fieldCell: -1,
    round: 0,
    phase: 'intro',
    phaseT: 0,
    toSpawn: 0,
    spawnT: 0,
    zHealth: 150,
    dogRound: false,
    dogIndex: 0,
    nextDog: R.firstDogRound(),
    dogsSpawned: 0,
    dogsTotal: 0,
    points: R.START_POINTS,
    earned: R.START_POINTS,
    stats: { kills: 0, knife: 0, headshots: 0, downs: 0, revives: 0, doors: 0, boxes: 0, paps: 0, perks: 0, dogs: 0, crawlers: 0, damage: 0, time: 0 },
    dropNext: R.FIRST_DROP_AT,
    dropStep: R.DROP_STEP_START,
    dropFlag: false,
    dropsRound: 0,
    cycle: [],
    powerups: [],
    timers: { instakill: 0, double: 0, firesale: 0 },
    repairsRound: 0,
    power: false,
    curtain: 0,
    curtainT: -1,
    curtainsDone: false,
    screenDown: false,
    screenMode: 'off',
    roofs: { stage: false, theater: false, lobby: false, dining: false },
    activeZones: new Set(),
    playerZone: 'lobby',
    qrBuys: 0,
    qrLife: false,
    downed: null,
    over: false,
    godMode: false,
    away: null, // null | 'trip' | 'revive'
    shrooms: [],
    shroomCharges: 0,
    hasShrooms: false,
    bowie: false,
    elixir: null,
    meteorsDone: 0,
    reels: { carried: null, spots: [], inserted: 0 },
    papState: { state: 'idle', key: null, t: 0 },
    tele: { coreLinked: false, linked: false, cooldown: 0, trip: null },
    trapState: {},
    turretState: [],
    box: null,
    lastRoomName: '',
    interact: null,
    swap: null,
    papMenu: false,
  };
  g.items = createItemSystem(g);

  // ------------------------------------------------------------------ helpers used by kits/AI
  g.queryZombies = (x, z, r, fn) => g.hash.query(x, z, r + 0.5, fn);
  g.nearestZombie = (x, z, r, filter) => {
    let best = null, bd = Infinity;
    g.hash.query(x, z, r + 0.5, (o) => {
      if (o.dead || !o.targetable) return;
      if (filter && !filter(o)) return;
      const d = dist(x, z, o.x, o.z);
      if (d <= r + o.r && d < bd) {
        bd = d;
        best = o;
      }
    });
    return best;
  };
  g.nearestZombies = (x, z, r, n) => {
    const list = [];
    g.hash.query(x, z, r + 0.5, (o) => {
      if (o.dead || !o.targetable) return;
      const d = dist(x, z, o.x, o.z);
      if (d <= r + o.r) list.push([d, o]);
    });
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map((e) => e[1]);
  };
  g.addTask = (fn) => g.tasks.push(fn);
  g.shake = (a) => env.shake(a);
  g.heightAt = (x, z) => grid.heightAt(x, z);
  g.cc = (z, kind, t) => {
    if (z.dead) return;
    if (kind === 'stun') z.stun = Math.max(z.stun, t);
    if (kind === 'knock') z.knockup = Math.max(z.knockup, t);
    if (z.state === 'attack' || z.state === 'leap') {
      z.state = 'chase';
      z.yOff = 0;
    }
  };
  g.slowZombie = (z, pct, t) => {
    z.slow = Math.max(z.slow, pct);
    z.slowT = Math.max(z.slowT, t);
  };
  g.curse = (z, t) => (z.curse = Math.max(z.curse, t));
  g.burn = (z, dps, t, key) => {
    const b = z.burns.find((q) => q.key === key);
    if (b) {
      b.t = t;
      b.dps = dps;
    } else z.burns.push({ key, dps, t, acc: 0 });
  };

  // classic-mode pathing: a second distance field towards a clicked point
  g.planPath = (goal) => {
    g.pathGoal = goal;
    grid.flow(goal.x, goal.z, g.pathField);
  };
  g.pathDir = (x, z, tx, tz, useField) => {
    if (grid.los(x, z, tx, tz, 0.3)) {
      const d = dist(x, z, tx, tz) || 1;
      return { x: (tx - x) / d, z: (tz - z) / d };
    }
    if (useField && g.pathGoal) return grid.downhill(x, z, g.pathField);
    // chasing a zombie: plan towards it occasionally
    if (!g.pathGoal || dist2(g.pathGoal.x, g.pathGoal.z, tx, tz) > 4) g.planPath({ x: tx, z: tz });
    return grid.downhill(x, z, g.pathField);
  };
  g.flashAllowed = (x0, z0, x1, z1) => {
    // Flash may hop walls a couple of cells thick, but never into the void or between unrelated rooms
    const r0 = map.roomAt(x0, z0), r1 = map.roomAt(x1, z1);
    if (!r1) return false;
    if (r0 && r1 && r0.zone !== r1.zone && (r0.isolated || r1.isolated)) return false;
    if (r1.isolated !== (r0 ? r0.isolated : false)) return false;
    // no hopping into closed areas: target must be reachable on the current flow field
    return grid.distAt(x1, z1, g.field) < 0x3fffffff;
  };
  g.dirTo = (zb, tx, tz) => {
    // used for points of interest: steer on a field built for the POI
    const poi = zb.poi;
    if (poi && poi.field) return grid.downhill(zb.x, zb.z, poi.field);
    const d = dist(zb.x, zb.z, tx, tz) || 1;
    return { x: (tx - zb.x) / d, z: (tz - zb.z) / d };
  };

  // points of interest (theatre rear and front) with their own fields
  const poiList = POIS.map(([X, Y]) => {
    const p = P(X, Y);
    return { x: p.x, z: p.z, field: new Int32Array(grid.w * grid.h) };
  });
  const refreshPoiFields = () => {
    for (const p of poiList) grid.flow(p.x, p.z, p.field);
  };
  g.playerAway = () => g.away;
  g.pickPoi = (z, why) => {
    if (why === 'revive') {
      // walk off to a spawn point roughly 600 units (11 m) away
      const p = g.player;
      let best = null, bd = 0;
      for (const w of map.windows) {
        const d = dist(p.x, p.z, w.ix, w.iz);
        if (d > 9 && d < 22 && grid.distAt(w.ix, w.iz, g.field) < 0x3fffffff && (!best || Math.abs(d - 11) < bd)) {
          best = w;
          bd = Math.abs(d - 11);
        }
      }
      if (best) return { x: best.ix + rand(-1, 1), z: best.iz + rand(-1, 1), field: null };
      return null;
    }
    const p = pick(poiList);
    return { x: p.x + rand(-2, 2), z: p.z + rand(-2, 2), field: p.field };
  };

  // ------------------------------------------------------------------ points
  g.addPoints = (base, why, at) => {
    if (g.over) return 0;
    const v = R.award(base, g.timers.double > 0);
    g.points += v;
    g.earned += v;
    ui.pop(v);
    return v;
  };
  g.spend = (cost) => {
    if (g.points < cost) {
      sfx.deny();
      ui.flashPoints();
      return false;
    }
    g.points -= cost;
    ui.pop(-cost);
    sfx.buy();
    return true;
  };

  // ------------------------------------------------------------------ damage & kills
  g.damage = (z, amt, o = {}) => {
    if (!z || z.dead) return { killed: false, dealt: 0 };
    if (!z.targetable && o.src !== 'trap' && o.src !== 'nuke' && o.src !== 'explosion') return { killed: false, dealt: 0 };
    let dmg = amt;
    const p = g.player;
    if (p && o.src !== 'trap' && o.src !== 'nuke' && o.src !== 'explosion' && o.src !== 'turret') {
      dmg *= g.items.damageMult(p);
      if (o.src === 'attack' && g.bowie) dmg *= 1.5;
      if (o.type === 'magic' && z.curse > 0) dmg += amt * 0.1; // Cursed Touch: 10% as bonus true damage
      if (g.elixir && g.elixir.id === 'elixirSorcery' && (o.src === 'attack' || o.onHit) && g.time > (z.sorceryT || 0)) {
        z.sorceryT = g.time + 5;
        dmg += 25;
      }
    }
    const insta = g.timers.instakill > 0 && o.src !== 'trap';
    if (insta) dmg = Math.max(dmg, z.hp);
    dmg = Math.max(0, dmg);
    const dealt = Math.min(z.hp, dmg);
    z.hp -= dmg;
    z.flash = 0.08;
    z.lastHitT = g.time;
    z.lastSrc = o;
    g.stats.damage += dealt;
    if (settings.numbers && dealt >= 1 && o.src !== 'dot') fx.number(z.x, z.y, z.z, Math.round(dealt), o.type === 'true' ? '#ffffff' : o.type === 'magic' ? '#b08bff' : '#ff9f6a');
    if (o.src !== 'dot' && o.src !== 'item' && Math.random() < 0.6) sfx.zHit(z);
    if (z.hp <= 0) {
      kill(z, o, insta);
      return { killed: true, dealt };
    }
    // +10 for a hit that doesn't kill. Rapid multi-hits (Death Lotus, cleaves) pay at most
    // every 0.35 s per zombie, which keeps the economy near Black Ops' pace.
    if (!o.noHitPoints && o.src !== 'dot' && o.src !== 'trap' && o.src !== 'nuke' && o.src !== 'explosion' && o.src !== 'turret' && g.time - (z.hitPtsT || -9) >= 0.35) {
      z.hitPtsT = g.time;
      g.addPoints(10, 'hit', z);
    }
    return { killed: false, dealt };
  };

  function kill(z, o, insta) {
    z.dead = true;
    z.deadT = 0;
    z.state = 'dead';
    z.targetable = false;
    z.solid = false;
    z.stun = z.knockup = 0;
    z.deathDir = chance(0.5) ? 1 : -1;
    removeFromWindow(z);
    const src = o.src;
    // points by how it died
    let pts = 0;
    if (src === 'attack') {
      pts = 130;
      g.stats.knife++;
    } else if (src === 'ability' || src === 'passive' || src === 'item' || src === 'dot') {
      pts = o.crit || o.skillshot ? 100 : 60;
      if (o.crit || o.skillshot) g.stats.headshots++;
    } else if (src === 'turret') pts = 50;
    if (insta && pts) pts += 10;
    if (pts) g.addPoints(pts, 'kill', z);
    if (src !== 'trap' && src !== 'nuke' && src !== 'explosion') {
      g.stats.kills++;
      const xp = z.kind === 'dog' ? 100 + 6 * g.round : (40 + 4 * g.round) * (z.kind === 'nova' ? 1.2 : 1);
      g.player.gainXp(xp);
      g.player.onKill(z, o);
    } else if (src === 'nuke' || src === 'trap') {
      g.stats.kills++;
    }
    if (z.kind === 'dog') g.stats.dogs++;
    if (z.kind === 'nova') g.stats.crawlers++;
    // effects
    sfx.zDie(z);
    fx.blood(z.x, z.y, z.z, 12);
    fx.decal(z.x + rand(-0.3, 0.3), z.y, z.z + rand(-0.3, 0.3), rand(0.8, 1.5));
    if (insta || (o.crit && chance(0.5))) {
      z.headless = true;
      fx.blood(z.x, z.y + 0.6, z.z, 10);
    }
    // Nova crawlers burst into gas unless killed in melee, by traps, or by explosions
    if (z.kind === 'nova' && src !== 'attack' && src !== 'trap' && src !== 'explosion' && src !== 'nuke') novaBurst(z);
    // power-up drops
    if (src !== 'trap') maybeDrop(z);
    if (z.kind === 'dog' && g.dogRound && g.dogsSpawned >= g.dogsTotal && aliveCount() === 0) {
      spawnPowerup('maxammo', z.x, z.z, true);
    }
  }

  function novaBurst(z) {
    sfx.gasPop(z);
    fx.gas(z.x, z.y, z.z, 3.2, 7);
    fx.ring(z.x, z.y, z.z, 0.4, 2.4, '#a8ff3c', 0.4, 0.8);
    g.gasClouds.push({ x: z.x, z: z.z, r: 3.2, t: 7 });
    // the burst kills zombies within 96 units (about 1.7 m)
    g.queryZombies(z.x, z.z, 1.75, (o) => {
      if (o === z || o.dead) return;
      if (dist(z.x, z.z, o.x, o.z) <= 1.75 + o.r) g.damage(o, o.maxHp * 1.05, { type: 'physical', src: 'explosion' });
    });
    const p = g.player;
    if (dist(p.x, p.z, z.x, z.z) < 1.75 + p.r) {
      g.shake(0.35);
      ui.shellshock(2.5);
    }
  }
  g.gasClouds = [];

  function aliveCount() {
    let n = 0;
    for (const z of g.zombies) if (!z.dead) n++;
    return n;
  }

  // ------------------------------------------------------------------ power-ups
  function refillCycle() {
    const pool = R.POWERUPS.filter((k) => !(g.round <= 1 && (k === 'nuke' || k === 'firesale')));
    g.cycle = shuffle(pool.slice());
  }
  function eligible(kind) {
    if (kind === 'carpenter') return map.windows.filter((w) => w.boards === 0).length >= 5;
    if (kind === 'firesale') return g.box && g.box.moves > 0 && g.timers.firesale <= 0;
    if ((kind === 'nuke' || kind === 'firesale') && g.round <= 1) return false;
    return true;
  }
  function nextPowerup() {
    for (let guard = 0; guard < 20; guard++) {
      if (!g.cycle.length) refillCycle();
      const k = g.cycle.shift();
      if (eligible(k)) return k;
    }
    return 'maxammo';
  }
  function maybeDrop(z) {
    if (!z.inside || g.dropsRound >= R.DROPS_PER_ROUND) return;
    if (g.dogRound && z.kind === 'dog') return;
    const rnd = Math.random() < R.DROP_RANDOM;
    if (!g.dropFlag && !rnd) return;
    if (grid.blockedAt(z.x, z.z) || !map.roomAt(z.x, z.z)) return;
    g.dropFlag = false;
    g.dropsRound++;
    spawnPowerup(nextPowerup(), z.x, z.z);
  }
  function spawnPowerup(kind, x, z, extra = false) {
    const info = POWERUP_INFO[kind];
    const mesh = env.makePowerupMesh(kind, info.color);
    mesh.position.set(x, grid.heightAt(x, z) + 1.0, z);
    scene.add(mesh);
    g.powerups.push({ kind, x, z, age: 0, mesh, extra });
    sfx.powerupSpawn({ x, z });
  }
  g.spawnPowerup = spawnPowerup;
  function updatePowerups(dt) {
    // score-based drop flag
    if (g.earned >= g.dropNext) {
      g.dropFlag = true;
      g.dropStep *= R.DROP_STEP_MULT;
      g.dropNext = g.earned + g.dropStep;
    }
    const p = g.player;
    for (let i = g.powerups.length - 1; i >= 0; i--) {
      const pu = g.powerups[i];
      pu.age += dt;
      pu.mesh.rotation.y += dt * 2;
      pu.mesh.position.y = grid.heightAt(pu.x, pu.z) + 1.0 + Math.sin(g.time * 3 + i) * 0.12;
      pu.mesh.visible = R.powerupVisible(pu.age);
      if (Math.random() < dt * 6) fx.glow.spawn(pu.x + rand(-0.3, 0.3), pu.mesh.position.y, pu.z + rand(-0.3, 0.3), 0, 0.6, 0, 0.8, 0.25, 0.5, 1, 0.4, 0.8);
      if (pu.age >= R.POWERUP_LIFE) {
        scene.remove(pu.mesh);
        g.powerups.splice(i, 1);
        continue;
      }
      if (!p.downed && !g.away && dist(p.x, p.z, pu.x, pu.z) < 1.25 + p.r) {
        scene.remove(pu.mesh);
        g.powerups.splice(i, 1);
        grab(pu.kind);
      }
    }
    for (const k of ['instakill', 'double', 'firesale']) {
      if (g.timers[k] > 0) {
        const before = g.timers[k];
        g.timers[k] = Math.max(0, g.timers[k] - dt);
        if (g.timers[k] < 5 && Math.floor(before) !== Math.floor(g.timers[k])) sfx.tick();
        if (k === 'firesale' && g.timers[k] === 0) endFireSale();
      }
    }
  }
  function grab(kind) {
    const info = POWERUP_INFO[kind];
    sfx.powerupGrab(kind);
    ui.announce(info.name, '', info.color);
    const p = g.player;
    if (kind === 'maxammo') {
      p.refill();
      if (p.trinket) p.trinket.charges = PORO.charges;
      if (g.hasShrooms) g.shroomCharges = 2;
    } else if (kind === 'instakill') g.timers.instakill = R.TIMED_POWERUP;
    else if (kind === 'double') g.timers.double = R.TIMED_POWERUP;
    else if (kind === 'firesale') startFireSale();
    else if (kind === 'carpenter') {
      sfx.hammer();
      for (const w of map.windows) {
        w.boards = 6;
        world.setBoards(w.index, 6);
      }
      setTimeout(() => g.addPoints(200, 'carpenter'), 600);
    } else if (kind === 'nuke') {
      sfx.nuke();
      ui.whiteFlash();
      g.shake(0.5);
      g.addPoints(400, 'nuke');
      const list = g.zombies.filter((z) => !z.dead).sort((a, b) => dist2(a.x, a.z, p.x, p.z) - dist2(b.x, b.z, p.x, p.z));
      let delay = 0.5;
      for (const z of list) {
        const at = delay;
        g.addTask(makeTimer(at, () => {
          if (z.dead) return;
          z.targetable = true;
          g.damage(z, z.hp + 1, { type: 'true', src: 'nuke' });
          if (!z.dead) {
            z.hp = 0;
            kill(z, { src: 'nuke' }, false);
          }
          fx.burst(z.x, z.y + 1, z.z, 6, { color: '#ffb060', speed: 2, life: 0.4, size: 0.25 });
        }));
        delay += rand(0.1, 0.7);
      }
    }
  }
  function makeTimer(at, fn) {
    let t = 0;
    return (dt) => {
      t += dt;
      if (t >= at) {
        fn();
        return false;
      }
      return true;
    };
  }

  // ------------------------------------------------------------------ zones and spawners
  const zoneName = (x, z) => {
    const zi = grid.zoneAt(x, z);
    return zi >= 0 ? map.zones[zi] : null;
  };
  function doorOpen(id) {
    const d = map.doors.find((q) => q.id === id);
    return d ? d.open : false;
  }
  function computeActiveZones() {
    const set = new Set();
    const pz = g.playerZone;
    set.add(pz);
    for (const [a, b, id] of ZONE_DOORS) {
      const open = id === 'power' ? g.power : doorOpen(id);
      if (!open) continue;
      if (a === pz) set.add(b);
      if (b === pz) set.add(a);
    }
    g.activeZones = set;
  }
  function spawnerList() {
    const list = [];
    for (const w of map.windows) if (g.activeZones.has(w.zone) && reachable(w.ix, w.iz)) list.push({ kind: 'window', w });
    if (g.power && g.activeZones.has('theater')) for (const [X, Y] of RISERS) list.push({ kind: 'riser', ...P(X, Y) });
    for (const d of DROPS) if (g.activeZones.has(d.zone)) list.push({ kind: 'drop', ...P(d.X, d.Y) });
    if (g.curtainsDone) {
      for (const q of QUAD_HOLES) {
        if (!g.activeZones.has(q.zone)) continue;
        const roofOpen = q.zone === 'lobby' ? g.roofs.lobby : q.zone === 'dining' ? g.roofs.dining : g.roofs.theater;
        if (roofOpen) list.push({ kind: 'quad', ...P(q.X, q.Y) });
      }
    }
    return list;
  }
  function reachable(x, z) {
    return grid.distAt(x, z, g.field) < 0x3fffffff;
  }

  function spawnZombie() {
    const list = spawnerList();
    if (!list.length) return false;
    // windows with long queues are less attractive
    const sp = pick(list.filter((s) => s.kind !== 'window' || s.w.queue.length < 5).concat([])) || pick(list);
    if (!sp) return false;
    const base = Math.max(1, Math.round(g.zHealth * R.HEALTH_SCALE));
    const hp = sp.kind === 'quad' ? Math.floor(base * 0.75) : base;
    const z = makeZombie(sp.kind === 'quad' ? 'nova' : 'zombie', hp, R.rollSpeed(g.round));
    if (sp.kind === 'window') {
      const w = sp.w;
      z.win = w;
      w.queue.push(z);
      z.slot = Math.min(2, w.queue.length - 1);
      const back = w.queue.length > 3 ? 0.8 * (w.queue.length - 3) : 0;
      z.x = w.ox - w.nx * back + w.tx * rand(-0.4, 0.4);
      z.z = w.oz - w.nz * back + w.tz * rand(-0.4, 0.4);
      z.y = w.y;
      z.state = 'approach';
      z.ang = Math.atan2(w.nz, w.nx);
    } else if (sp.kind === 'riser') {
      const o = grid.nearestOpen(sp.x, sp.z, 2) || sp;
      z.x = o.x;
      z.z = o.z;
      z.y = grid.heightAt(z.x, z.z);
      z.state = 'rise';
      z.yOff = -1.7;
    } else {
      const o = grid.nearestOpen(sp.x + rand(-1, 1), sp.z + rand(-1, 1), 2) || sp;
      z.x = o.x;
      z.z = o.z;
      z.y = grid.heightAt(z.x, z.z);
      z.state = 'drop';
      z.yOff = 6;
      if (sp.kind === 'drop' && chance(0.5)) sfx.windowCrash(z);
    }
    z.t = 0;
    z.spawnT = g.time;
    if (!env.crowd.add(z)) return false;
    g.zombies.push(z);
    return true;
  }

  function spawnDog() {
    // a lightning strike somewhere 7-14 m from you, in an active zone you can be reached from
    const p = g.player;
    for (let tries = 0; tries < 40; tries++) {
      const a = rand(0, TAU), d = rand(7, 14);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (!grid.circleFree(x, z, 0.5)) continue;
      const zn = zoneName(x, z);
      if (!zn || !g.activeZones.has(zn)) continue;
      if (!reachable(x, z)) continue;
      const dog = makeZombie('dog', Math.round(R.dogHealth(g.dogIndex) * R.HEALTH_SCALE), 'dog');
      dog.x = x;
      dog.z = z;
      dog.y = grid.heightAt(x, z);
      dog.state = 'chase';
      dog.targetable = true;
      dog.solid = true;
      dog.inside = true;
      dog.ang = Math.atan2(p.z - z, p.x - x);
      if (!env.crowd.add(dog)) return false;
      g.zombies.push(dog);
      fx.beam(x, dog.y, z, 0.25, 14, '#cfe0ff', 0.35, 0.9);
      fx.burst(x, dog.y + 0.5, z, 30, { color: '#cfe0ff', speed: 5, life: 0.5, size: 0.2 });
      sfx.tpZap();
      g.shake(0.12);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ rounds
  function startRound(n) {
    g.round = n;
    g.phase = 'round';
    g.phaseT = 0;
    g.zHealth = R.zombieHealth(n);
    g.dropsRound = 0;
    g.repairsRound = 0;
    if (g.hasShrooms) g.shroomCharges = Math.max(g.shroomCharges, 2);
    g.dogRound = n === g.nextDog;
    if (g.dogRound) {
      g.dogIndex++;
      g.dogsTotal = R.dogCount(g.dogIndex);
      g.dogsSpawned = 0;
      g.toSpawn = 0;
      g.spawnT = 7; // first dog about 7 s in, after the fog rolls in
      ui.fog(true);
      ui.announce('Fetch me their souls!', '', '#ff5a3a', true);
      sfx.roundStart(true);
    } else {
      g.toSpawn = R.zombieCount(n);
      g.spawnT = 0; // the first zombie of a round spawns immediately
      sfx.roundStart(false);
    }
    ui.round(n, true);
    g.events.emit('round', n);
  }
  function endRound() {
    g.phase = 'intermission';
    g.phaseT = 0;
    if (g.dogRound) {
      ui.fog(false);
      g.nextDog = R.nextDogRound(g.round);
    }
    sfx.roundEnd();
    ui.round(g.round, true);
  }
  function updateRounds(dt) {
    g.phaseT += dt;
    if (g.phase === 'intro') {
      if (g.phaseT >= 10.25) startRound(1);
      return;
    }
    if (g.phase === 'intermission') {
      if (g.phaseT >= 12.5) startRound(g.round + 1);
      return;
    }
    if (g.phase !== 'round') return;
    if (g.dogRound) {
      if (g.dogsSpawned < g.dogsTotal) {
        g.spawnT -= dt;
        const alive = g.zombies.filter((z) => !z.dead && z.kind === 'dog').length;
        if (g.spawnT <= 0 && alive < R.DOGS_ALIVE) {
          if (spawnDog()) {
            g.dogsSpawned++;
            g.spawnT = R.dogSpawnDelay(g.dogIndex, g.dogsSpawned, g.dogsTotal);
          } else g.spawnT = 0.5;
        }
      } else if (aliveCount() === 0) {
        g.roundEndCheck = (g.roundEndCheck || 0) + dt;
        if (g.roundEndCheck >= 1) {
          g.roundEndCheck = 0;
          endRound();
        }
      }
      return;
    }
    // normal round: spawn while below the 24 alive cap
    if (g.toSpawn > 0) {
      g.spawnT -= dt;
      if (g.spawnT <= 0 && aliveCount() < R.MAX_ALIVE) {
        if (spawnZombie()) {
          g.toSpawn--;
          g.spawnT = R.spawnDelay(g.round);
        } else g.spawnT = 0.1;
      }
    }
    // last zombie sprints (rounds 4-9)
    if (g.round >= 4 && g.round <= 9 && g.toSpawn <= 4) {
      const live = g.zombies.filter((z) => !z.dead);
      if (live.length <= 3 && g.toSpawn === 0 && live.length === 1 && !live[0].legless && live[0].kind === 'zombie') live[0].speedClass = 'sprint';
    }
    if (g.toSpawn === 0 && aliveCount() === 0) {
      g.roundEndCheck = (g.roundEndCheck || 0) + dt;
      if (g.roundEndCheck >= 1) {
        g.roundEndCheck = 0;
        endRound();
      }
    } else g.roundEndCheck = 0;
  }

  // stuck zombies: every 30 s, anyone without progress in a long while is respawned
  let stuckTimer = 30;
  function stuckCheck(dt) {
    stuckTimer -= dt;
    if (stuckTimer > 0) return;
    stuckTimer = 30;
    for (const z of g.zombies) {
      if (z.dead || z.kind === 'dog') continue;
      const noTear = g.time - (z.lastTear || 0) > 8;
      if (z.state === 'chase' && noTear && g.time - z.lastMove > 20 && !g.away) {
        // came through a window: back into the queue
        z.dead = true;
        z.deadT = 99;
        z.targetable = false;
        z.solid = false;
        if (g.phase === 'round' && !g.dogRound) g.toSpawn++;
      } else if ((z.state === 'approach' || z.state === 'tear') && g.time - (z.spawnT || 0) > 60 && noTear) {
        z.dead = true;
        z.deadT = 99;
        removeFromWindow(z);
        if (g.phase === 'round' && !g.dogRound) g.toSpawn++;
      }
    }
  }

  // ------------------------------------------------------------------ windows
  function removeFromWindow(z) {
    if (!z.win) return;
    const w = z.win;
    w.queue = w.queue.filter((o) => o !== z);
    w.queue.forEach((o, i) => {
      if (!o.dead && o.state !== 'climb') o.slot = Math.min(2, i);
    });
  }
  g.tearBoard = (w, z) => {
    if (w.boards <= 0) return;
    w.boards--;
    world.setBoards(w.index, w.boards);
    world.flingBoard(w.index, fx);
    sfx.boardTear(w);
  };
  g.biteFromWindow = (z) => g.bitePlayer(z, true);
  g.bitePlayer = (z, window = false) => {
    const p = g.player;
    if (p.downed || g.away) return;
    const raw = BITE[z.kind] || BITE.zombie;
    const dealt = p.takeHit(raw, z);
    if (dealt > 0) {
      sfx.snarl(z);
      sfx.hurt();
      ui.hurt(Math.min(1, dealt / p.maxHp + 0.25));
      g.shake(0.12);
      fx.blood(p.x, p.y, p.z, 6, (p.x - z.x) * 0.5, (p.z - z.z) * 0.5);
    }
  };
  g.onPlayerHurt = () => {};

  function updateWindows(dt) {
    // zombies waiting outside step up when a slot frees
    for (const w of map.windows) {
      w.queue = w.queue.filter((z) => !z.dead && z.win === w);
      w.queue.forEach((z, i) => {
        const slot = Math.min(2, i);
        if (z.state === 'tear' && i > 2) {
          z.state = 'approach';
        }
        if (z.state === 'approach' && i <= 2) z.slot = slot;
      });
    }
  }

  // ------------------------------------------------------------------ the champion going down
  g.playerDown = () => {
    const p = g.player;
    if (p.downed || g.over) return;
    if (g.godMode) {
      p.hp = p.maxHp;
      return;
    }
    p.downed = true;
    p.hp = 0;
    p.onDowned();
    g.stats.downs++;
    sfx.downed();
    const lost = R.downPenalty(g.points);
    g.points = Math.max(0, g.points - lost);
    if (lost) ui.pop(-lost);
    // all perks go
    const hadQR = g.qrLife;
    p.perks.clear();
    if (p.hasItem('mejai')) p.stacks.mejai = Math.max(0, p.stacks.mejai - 10);
    p.recompute();
    ui.perks(p.perks);
    if (hadQR) {
      g.qrLife = false;
      g.downed = { t: 0, dur: 10, refund: lost };
      g.away = 'revive';
      for (const z of g.zombies) z.poi = null;
      ui.downed(true, 'Quick Revive is getting you up');
    } else {
      g.downed = { t: 0, dur: 2.2, final: true };
      ui.downed(true, '');
    }
  };
  function updateDowned(dt) {
    const d = g.downed;
    if (!d) return;
    d.t += dt;
    ui.downedProgress(d.final ? 0 : d.t / d.dur);
    if (d.final) {
      if (d.t >= d.dur) gameOver();
      return;
    }
    if (d.t >= d.dur) {
      const p = g.player;
      p.downed = false;
      p.hp = p.maxHp;
      p.lastHurt = g.time;
      g.downed = null;
      g.away = null;
      g.stats.revives++;
      if (d.refund) {
        g.points += d.refund;
        ui.pop(d.refund);
      }
      sfx.revived();
      ui.downed(false);
      fx.ring(p.x, p.y, p.z, 0.4, 3, '#4fb6ff', 0.6);
      // the machine comes back unless it has flown away
      world.perks.revive.mesh.visible = !world.perks.revive.gone;
    }
  }
  function gameOver() {
    if (g.over) return;
    g.over = true;
    g.phase = 'over';
    sfx.gameOver();
    stopMusic(1);
    g.events.emit('over', { round: g.round, stats: g.stats, champ: g.player.id });
  }
  g.endGame = gameOver;

  // ------------------------------------------------------------------ power on
  function powerOn() {
    if (g.power) return;
    g.power = true;
    world.setPower(true);
    sfx.powerOn(world.power);
    fx.sparks(world.power.x, 2.2, world.power.z, 30, '#ffe080');
    ui.announce('', 'Power is on', '#ffe08a');
    g.shake(0.25);
    // the theatre doors open by themselves
    for (const d of map.doors) if (d.kind === 'power') openDoorObj(d, false);
    // curtains: the clip goes non-solid at once, the cloth animates open
    const cur = map.doors.find((d) => d.kind === 'curtain');
    setDoor(map, cur, true);
    g.curtainT = 0;
    computeActiveZones();
    refreshFields(true);
  }
  function updatePowerSequence(dt) {
    if (g.curtainT < 0) return;
    g.curtainT += dt;
    g.curtain = clamp(g.curtainT / 4, 0, 1);
    if (!g.curtainsDone && g.curtainT >= 4) {
      g.curtainsDone = true;
      // the stage and theatre roof breaks open over about 5 s
      for (let i = 0; i < 10; i++) {
        g.addTask(makeTimer(i * 0.5, () => {
          const q = pick(QUAD_HOLES.filter((h) => h.zone === 'theater' || h.zone === 'stage'));
          const p = P(q.X, q.Y);
          fx.burst(p.x, 5, p.z, 20, { color: '#6a5a48', speed: 3, life: 1.2, size: 0.35, grav: 9, smoke: true, alpha: 0.8 });
          sfx.debris(p);
          g.shake(0.08);
        }));
      }
      g.addTask(makeTimer(5, () => {
        g.roofs.theater = true;
        g.roofs.stage = true;
        ui.toast('Something is crawling in the roof...');
      }));
      g.screenDown = true;
      g.addTask(makeTimer(8, () => (g.screenMode = 'film')));
    }
  }

  // ------------------------------------------------------------------ doors
  function openDoorObj(d, paid = true) {
    setDoor(map, d, true);
    world.openDoor(d.id);
    sfx.door({ x: d.x, z: d.z });
    if (paid) g.stats.doors++;
    computeActiveZones();
    refreshFields(true);
  }

  // ------------------------------------------------------------------ flow fields
  function refreshFields(force) {
    const p = g.player;
    let px = p.x, pz = p.z;
    const cell = Math.floor(pz / CELL) * grid.w + Math.floor(px / CELL);
    if (!force && cell === g.fieldCell) return;
    g.fieldCell = cell;
    grid.flow(px, pz, g.field);
    if (force) refreshPoiFields();
  }

  // ------------------------------------------------------------------ the box
  function initBox() {
    const order = shuffle(world.boxes.map((b) => b.index));
    const starts = world.boxes.filter((b) => !b.noStart);
    const start = pick(starts).index;
    g.box = {
      spot: start,
      order,
      uses: 0,
      moves: 0,
      state: 'idle',
      t: 0,
      item: null,
      offerFor: 0,
      fire: [],
    };
    placeBoxAt(start);
  }
  function placeBoxAt(i) {
    const b = world.boxes[i];
    const m = world.boxMesh;
    m.visible = true;
    m.position.set(b.x, b.y, b.z);
    m.rotation.y = b.yaw;
    m.userData.setLid(0);
    m.userData.setBeam(1);
    for (const bb of world.boxes) bb.rubble.visible = bb.index !== i;
    updateBoxBoards();
  }
  function updateBoxBoards(flash) {
    for (const bb of world.boxes) {
      const l9 = bb.board.userData.lights9;
      l9.forEach((m, i) => (m.material.emissiveIntensity = !g.power ? 0 : flash ? (Math.floor(g.time * 4) % 2 ? 2.5 : 0) : i === g.box.spot ? 2.5 : 0));
    }
  }
  function boxUse(spotIndex) {
    const B = g.box;
    const fire = g.timers.firesale > 0;
    const cost = fire ? R.FIRESALE_COST : R.BOX_COST;
    const isMain = spotIndex === B.spot;
    const state = isMain ? B : B.fire.find((f) => f.spot === spotIndex);
    if (!state || state.state !== 'idle') return;
    if (!g.spend(cost)) return;
    g.stats.boxes++;
    state.state = 'rolling';
    state.t = 0;
    state.paid = cost;
    state.fireRoll = fire;
    if (isMain && !fire) B.uses++;
    // decide now: teddy or item
    const teddy = isMain && !fire && Math.random() < R.teddyChance(B.uses, B.moves > 0);
    state.teddy = teddy;
    state.item = teddy ? null : rollWeighted(g.items.pool(g.player));
    sfx.boxOpen(world.boxes[spotIndex]);
    sfx.boxSpin(world.boxes[spotIndex]);
    state.icon = env.makeItemFloat(state.item);
  }
  function updateBoxState(st, spotIndex, mesh, dt) {
    const b = world.boxes[spotIndex];
    st.t += dt;
    if (st.state === 'rolling') {
      mesh.userData.setLid(Math.min(1, st.t * 3));
      env.spinItemFloat(st, b, st.t);
      if (st.t >= 3.9) {
        if (st.teddy) {
          st.state = 'teddy';
          st.t = 0;
          env.showBear(st, b);
          sfx.bear(b);
          g.points += st.paid;
          ui.pop(st.paid);
          ui.toast('Tibbers took the box. It will turn up somewhere else.');
        } else {
          st.state = 'offer';
          st.t = 0;
          env.landItemFloat(st, b, st.item);
          sfx.boxLand(b);
        }
      }
    } else if (st.state === 'offer') {
      env.bobItemFloat(st, b, st.t);
      if (st.t >= 12) closeBox(st, spotIndex, mesh);
    } else if (st.state === 'closing') {
      mesh.userData.setLid(Math.max(0, 1 - st.t * 2));
      if (st.t >= 3) {
        st.state = 'idle';
        st.t = 0;
        if (st !== g.box && g.timers.firesale <= 0) removeFireBox(st);
      }
    } else if (st.state === 'teddy') {
      // teddy rises (4 s), the box lifts off, flies away, and lands elsewhere
      env.bearRise(st, b, st.t);
      if (st.t > 4) {
        mesh.position.y = b.y + (st.t - 4) * 2.5;
        mesh.rotation.y += dt * (st.t - 4) * 2;
        mesh.userData.setBeam(Math.max(0, 1 - (st.t - 4) / 3));
        if (Math.random() < dt * 20) fx.glow.spawn(mesh.position.x, mesh.position.y, mesh.position.z, rand(-1, 1), -1, rand(-1, 1), 0.8, 0.3, 0.6, 0.85, 1, 0.8);
      }
      if (st.t > 4 && !st.flySound) {
        st.flySound = true;
        sfx.boxFly(b);
      }
      if (st.t > 9 && mesh.visible) {
        mesh.visible = false;
        env.hideBear(st);
        sfx.boxGone(b);
        b.rubble.visible = true;
      }
      if (st.t >= 21) {
        // next spot in the shuffled order (never the same one)
        const B = g.box;
        let idx = B.order.indexOf(B.spot);
        let next = B.order[(idx + 1) % B.order.length];
        if (next === B.spot) next = B.order[(idx + 2) % B.order.length];
        B.spot = next;
        B.uses = 0;
        B.moves++;
        st.state = 'idle';
        st.t = 0;
        placeBoxAt(next);
        sfx.powerupSpawn(world.boxes[next]);
      }
    }
  }
  function closeBox(st, spotIndex, mesh) {
    env.hideItemFloat(st);
    st.state = 'closing';
    st.t = 0;
    st.item = null;
  }
  function takeBoxItem(st, spotIndex) {
    const id = st.item;
    if (!id) return;
    if (id === 'poro') {
      g.player.trinket = { id: 'poro', charges: PORO.charges };
      sfx.item(g.player);
      ui.toast('Poro-Snax! Press 4 to throw one.');
      closeBox(st, spotIndex, null);
      return;
    }
    giveItem(id, () => closeBox(st, spotIndex, null));
  }
  function startFireSale() {
    g.timers.firesale = R.TIMED_POWERUP;
    sfx.fireSale();
    const B = g.box;
    for (const b of world.boxes) {
      if (b.index === B.spot || B.fire.some((f) => f.spot === b.index)) continue;
      const mesh = env.makeExtraBox();
      mesh.position.set(b.x, b.y, b.z);
      mesh.rotation.y = b.yaw;
      scene.add(mesh);
      b.rubble.visible = false;
      B.fire.push({ spot: b.index, mesh, state: 'idle', t: 0 });
    }
  }
  function endFireSale() {
    for (const f of g.box.fire.slice()) if (f.state === 'idle') removeFireBox(f);
  }
  function removeFireBox(f) {
    const B = g.box;
    scene.remove(f.mesh);
    env.hideItemFloat(f);
    const i = B.fire.indexOf(f);
    if (i >= 0) B.fire.splice(i, 1);
    world.boxes[f.spot].rubble.visible = f.spot !== B.spot;
  }

  // ------------------------------------------------------------------ items & inventory
  /** Put an item in the inventory, asking which slot to replace if it's full. onDone runs on success. */
  function giveItem(id, onDone, cost = 0) {
    const p = g.player;
    const def = g.items.def(id);
    if (!def) return;
    // same unique group (e.g. Bami's -> Sunfire): replace in place
    const sameGroup = def.unique ? p.items.findIndex((it) => it && it.def.unique === def.unique) : -1;
    const bootsSlot = id === 'boots' ? p.items.findIndex((it) => it && it.id === 'boots') : -1;
    let slot = sameGroup >= 0 ? sameGroup : bootsSlot >= 0 ? bootsSlot : p.items.indexOf(null);
    const finish = (s) => {
      if (cost && !g.spend(cost)) return;
      p.items[s] = { id, def };
      p.itemCd[s] = 0;
      p.recompute();
      sfx.item(p);
      fx.ring(p.x, p.y, p.z, 0.3, 1.8, '#c8aa6e', 0.5);
      ui.items();
      ui.toast(def.name);
      g.events.emit('item', id);
      if (onDone) onDone();
    };
    if (slot >= 0) return finish(slot);
    // full: choose a slot
    g.swap = { id, def, finish };
    ui.swap(def);
  }
  g.chooseSwap = (slot) => {
    const s = g.swap;
    if (!s) return;
    g.swap = null;
    ui.swap(null);
    if (slot < 0) return;
    s.finish(slot);
  };

  function buyWall(wb) {
    const p = g.player;
    const id = typeof wb.item === 'string' ? wb.item : wb.item[p.id];
    if (id === 'shrooms') {
      if (g.hasShrooms && g.shroomCharges >= 2) return ui.toast('You already carry two Noxious Traps');
      if (!g.spend(wb.cost)) return;
      g.hasShrooms = true;
      g.shroomCharges = 2;
      ui.toast('Noxious Traps: press G to plant one');
      return;
    }
    if (id === 'bowie') {
      if (g.bowie) return;
      if (!g.spend(wb.cost)) return;
      g.bowie = true;
      sfx.blade(p, 0.7);
      ui.toast('Bowie Knife: basic attacks hit 50% harder');
      return;
    }
    if (id.startsWith('elixir')) {
      if (!g.spend(wb.cost)) return;
      applyElixir(id);
      return;
    }
    if (p.items.some((it) => it && it.id === id)) return ui.toast('You already have ' + g.items.def(id).name);
    if (g.points < wb.cost) {
      sfx.deny();
      ui.flashPoints();
      return;
    }
    giveItem(id, null, wb.cost);
  }
  function applyElixir(id) {
    const p = g.player;
    g.elixir = { id, t: 180 };
    const extra = { elixirWrath: { ad: 30, ov: 12 }, elixirSorcery: { ap: 50 }, elixirIron: { hp: 300 } }[id];
    p.elixirStats = extra;
    p.recomputeHook = () => {};
    p.recompute();
    sfx.perkDrink();
    ui.toast(SPECIAL_WALL[id].name + ' for 3 minutes');
  }

  // ------------------------------------------------------------------ perks
  function buyPerk(kind) {
    const p = g.player;
    const info = R.PERKS[kind];
    if (p.drinking > 0) return; // the perk only lands when the bottle is empty: no second sale meanwhile
    if (kind === 'revive') {
      if (world.perks.revive.gone) return;
      if (g.qrLife) return ui.toast('You already have Quick Revive');
    } else if (!g.power) return ui.toast('You must turn on the power first!', true);
    if (p.perks.has(kind)) return;
    if (p.perks.size >= R.PERK_LIMIT) return ui.toast('You can only hold 4 perks', true);
    if (!g.spend(info.cost)) return;
    g.stats.perks++;
    p.drinking = 1.6;
    sfx.perkDrink();
    sfx.jingle(kind, world.perks[kind]);
    g.addTask(makeTimer(1.6, () => {
      if (p.downed) return;
      p.perks.add(kind);
      p.recompute();
      if (kind === 'jugg') p.hp = p.maxHp;
      if (kind === 'revive') {
        g.qrLife = true;
        g.qrBuys++;
        if (g.qrBuys >= R.QR_MAX_BUYS) qrLeaves();
      }
      ui.perks(p.perks);
    }));
  }
  function qrLeaves() {
    const pm = world.perks.revive;
    pm.gone = true;
    // rises, shakes, and vanishes in a puff after the third purchase
    let t = 0;
    g.addTask((dt) => {
      t += dt;
      if (t > 2) {
        pm.mesh.position.y += dt * (0.73 / 3);
        pm.mesh.position.x = pm.x + Math.sin(t * 40) * 0.03;
      }
      if (t > 5) {
        fx.burst(pm.x, 1.2, pm.z, 40, { color: '#cfe8ff', speed: 4, life: 0.8, size: 0.4, smoke: true, alpha: 0.7 });
        pm.mesh.visible = false;
        world.perks.revive.light.on = false;
        world.perks.revive.light.power = false;
        return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------------ traps
  function buyTrap(tr) {
    const st = g.trapState[tr.id] || (g.trapState[tr.id] = { on: 0, cd: 0 });
    if (!g.power) return ui.toast('You must turn on the power first!', true);
    if (st.on > 0 || st.cd > 0) return;
    if (!g.spend(R.TRAP_COST)) return;
    st.on = R.TRAP_ON;
    for (const h of tr.handles) h.mesh.userData.setPulled(1);
    sfx.trap(tr.handles[0]);
  }
  function updateTraps(dt) {
    const trapOn = {};
    for (const tr of world.traps) {
      const st = g.trapState[tr.id] || (g.trapState[tr.id] = { on: 0, cd: 0 });
      if (st.on > 0) {
        st.on -= dt;
        trapOn[tr.id] = true;
        if (Math.random() < dt * 6) sfx.trap({ x: tr.cx, z: tr.cz });
        // zombies in the band die after a short random delay; no points
        for (const z of g.zombies) {
          if (z.dead || z.inTrap) continue;
          if (z.x >= tr.x0 && z.x <= tr.x1 && z.z >= tr.z0 && z.z <= tr.z1 && (z.state === 'chase' || z.state === 'attack' || z.state === 'leap')) {
            z.inTrap = true;
            z.state = 'trapped';
            const delay = Math.random() * 0.99;
            g.addTask(makeTimer(delay, () => {
              z.inTrap = false;
              if (z.dead) return;
              fx.burst(z.x, z.y + 1, z.z, 14, { color: tr.kind === 'fire' ? '#ff8a30' : '#bfe8ff', speed: 3, life: 0.5, size: 0.2 });
              const wasTargetable = z.targetable;
              z.targetable = true;
              g.damage(z, z.hp + 666, { type: 'true', src: 'trap' });
              if (!z.dead) z.targetable = wasTargetable;
            }));
          }
        }
        // the champion: downed without Juggernog, badly hurt with it
        const p = g.player;
        if (!p.downed && !g.away && p.x >= tr.x0 - p.r * 0.5 && p.x <= tr.x1 + p.r * 0.5 && p.z >= tr.z0 - p.r * 0.5 && p.z <= tr.z1 + p.r * 0.5 && p.buffs.untargetable <= 0 && p.buffs.stasis <= 0) {
          if (!p.perks.has('jugg') || p.hp - p.maxHp * 0.4 < 1) {
            p.hp = 0;
            g.playerDown();
          } else if (g.time > (p.trapHitT || 0)) {
            p.trapHitT = g.time + 0.5;
            p.hp -= p.maxHp * 0.2;
            p.lastHurt = g.time;
            ui.hurt(0.8);
            ui.shellshock(1.25);
            sfx.hurt();
          }
        }
        if (st.on <= 0) {
          st.cd = R.TRAP_COOLDOWN;
          for (const h of tr.handles) h.mesh.userData.setPulled(0);
        }
      } else if (st.cd > 0) st.cd -= dt;
      for (const h of tr.handles) h.mesh.userData && h.lamp !== (st.on > 0 || st.cd > 0) && (h.lamp = st.on > 0 || st.cd > 0);
    }
    return trapOn;
  }

  // ------------------------------------------------------------------ turrets (League-style towers)
  function buyTurret(i) {
    const st = g.turretState[i] || (g.turretState[i] = { on: 0, cd: 0, target: null, heat: 0, shotT: 0 });
    if (!g.power) return ui.toast('You must turn on the power first!', true);
    if (st.on > 0) return;
    if (!g.spend(1500)) return;
    st.on = 30;
    sfx.powerupSpawn(world.turrets[i]);
  }
  function updateTurrets(dt) {
    world.turrets.forEach((tu, i) => {
      const st = g.turretState[i];
      const active = st && st.on > 0;
      tu.mesh.userData.setActive(active, g.time);
      if (!active) return;
      st.on -= dt;
      st.shotT -= dt;
      if (st.target && (st.target.dead || !st.target.targetable || dist(tu.x, tu.z, st.target.x, st.target.z) > 9)) {
        st.target = null;
        st.heat = 0;
      }
      if (!st.target) {
        st.target = g.nearestZombie(tu.x, tu.z, 9, (z) => grid.los(tu.x, tu.z, z.x, z.z));
        st.heat = 0;
      }
      if (st.target && st.shotT <= 0) {
        st.shotT = 0.5;
        const z = st.target;
        const dmg = (180 + z.maxHp * 0.06) * (1 + 0.4 * Math.min(st.heat, 3));
        st.heat++;
        fx.streak(tu.x, 1.6, tu.z, z.x, z.y + 0.7, z.z, '#7fd0ff', 0.12, 0.18);
        fx.burst(z.x, z.y + 1, z.z, 8, { color: '#7fd0ff', speed: 2.5, life: 0.3, size: 0.2 });
        sfx.zap(z);
        g.damage(z, dmg, { type: 'magic', src: 'turret' });
      }
    });
  }

  // ------------------------------------------------------------------ teleporter & Pack-a-Punch
  function teleState() {
    const T = g.tele;
    if (!g.power) return 'off';
    if (T.trip && T.trip.phase === 'charge') return 'charging';
    if (T.cooldown > 0) return 'cooldown';
    if (T.linked) return 'linked';
    return 'idle';
  }
  function startTrip() {
    const T = g.tele;
    const p = g.player;
    T.trip = { phase: 'charge', t: 0 };
    sfx.tpCharge(world.teleporter);
    // everything within 300 units (5.4 m) of the pad dies; no points
    for (const z of g.zombies) {
      if (z.dead) continue;
      if (dist(z.x, z.z, world.teleporter.x, world.teleporter.z) < 5.4) {
        g.addTask(makeTimer(rand(0.2, 0.3), () => {
          if (z.dead) return;
          z.headless = true;
          z.targetable = true;
          g.damage(z, z.hp + 100, { type: 'true', src: 'nuke' });
        }));
      }
    }
  }
  const tripRoomSpot = (id) => {
    const r = ROOMS.find((q) => q.id === id).rects[0];
    return P((r[0] + r[2]) / 2, (r[1] + r[3]) / 2 + 40);
  };
  function moveTo(x, z) {
    const p = g.player;
    p.x = x;
    p.z = z;
    p.y = grid.heightAt(x, z);
    p.moveTarget = null;
    p.attackOrder = null;
    env.snapCamera();
    refreshFields(true);
  }
  function updateTrip(dt) {
    const T = g.tele;
    if (T.cooldown > 0 && !T.trip) {
      T.cooldown -= dt;
      if (T.cooldown <= 0) {
        T.cooldown = 0;
        T.linked = false;
        T.coreLinked = false;
      }
    }
    const tr = T.trip;
    if (!tr) return;
    tr.t += dt;
    const p = g.player;
    if (tr.phase === 'charge') {
      if (Math.random() < dt * 30) fx.glow.spawn(world.teleporter.x + rand(-1.4, 1.4), rand(0, 2.5), world.teleporter.z + rand(-1.4, 1.4), 0, 2, 0, 0.5, 0.3, 0.5, 0.85, 1, 0.9);
      if (tr.t >= 1.8) {
        // must still be on the pad to go
        if (dist(p.x, p.z, world.teleporter.x, world.teleporter.z) > 2.2 || p.downed) {
          T.trip = null;
          T.cooldown = R.TELEPORT_COOLDOWN;
          return;
        }
        sfx.tpZap();
        ui.fadeTo(1, 0.15);
        tr.phase = 'black';
        tr.t = 0;
        g.away = 'trip';
        for (const z of g.zombies) z.poi = null;
      }
    } else if (tr.phase === 'black') {
      if (tr.t >= 2) {
        const [X, Y] = pick(PAP_ARRIVE);
        const a = P(X, Y);
        moveTo(a.x, a.z);
        p.ang = -Math.PI / 2;
        ui.fadeTo(0, 0.6);
        tr.phase = 'pap';
        tr.t = 0;
        ui.toast('30 seconds in the projector room');
      }
    } else if (tr.phase === 'pap') {
      g.clock = tr.t;
      if (tr.t >= R.PAP_ROOM_TIME) {
        g.clock = -1;
        tr.phase = 'leave';
        tr.t = 0;
        tr.ee = Math.random() < 0.75;
        sfx.tpCharge(p);
      }
    } else if (tr.phase === 'leave') {
      if (tr.t >= 1.8) {
        sfx.tpZap();
        ui.fadeTo(1, 0.15);
        tr.phase = 'black2';
        tr.t = 0;
      }
    } else if (tr.phase === 'black2') {
      if (tr.t >= 2) {
        if (tr.ee) {
          const room = pick(EE_ROOMS);
          const s = tripRoomSpot(room);
          moveTo(s.x, s.z);
          // 34% chance of a power-up in one of the rooms
          if (Math.random() > 0.65) {
            const s2 = tripRoomSpot(pick(EE_ROOMS));
            spawnPowerup(pick(['nuke', 'instakill', 'double', 'carpenter', 'firesale', 'maxammo']), s2.x + 0.8, s2.z - 1.2, true);
          }
          ui.fadeTo(0, 0.4);
          tr.phase = 'ee';
          tr.t = 0;
        } else {
          returnHome();
        }
      }
    } else if (tr.phase === 'ee') {
      if (tr.t >= 4) {
        tr.phase = 'leave2';
        tr.t = 0;
        sfx.tpCharge(p);
      }
    } else if (tr.phase === 'leave2') {
      if (tr.t >= 1.8) {
        sfx.tpZap();
        ui.fadeTo(1, 0.15);
        tr.phase = 'black3';
        tr.t = 0;
      }
    } else if (tr.phase === 'black3') {
      if (tr.t >= 2) returnHome();
    }
  }
  function returnHome() {
    const T = g.tele;
    const p = g.player;
    // always back to the lobby mainframe, on one of four spots around the pad
    const m = P(MAINFRAME.X, MAINFRAME.Y);
    const a = rand(0, TAU);
    const s = grid.nearestOpen(m.x + Math.cos(a) * 1.0, m.z + Math.sin(a) * 1.0, 2) || m;
    moveTo(s.x, s.z);
    ui.fadeTo(0, 0.5);
    // the teleporter kills anything standing on the arrival spot
    for (const z of g.zombies) if (!z.dead && dist(z.x, z.z, p.x, p.z) < 0.9) {
      z.targetable = true;
      g.damage(z, z.hp + 100, { type: 'true', src: 'nuke' });
    }
    T.trip = null;
    T.cooldown = R.TELEPORT_COOLDOWN;
    T.linked = false;
    T.coreLinked = false;
    g.away = null;
    g.clock = -1;
    ui.aftereffect(randInt(0, 5));
    // a carried film reel stays with you; un-taken Pack-a-Punch is lost
    if (g.papState.state === 'ready' || g.papState.state === 'working') papLost();
  }

  function papOpenMenu() {
    if (!g.power) return ui.toast('You must turn on the power first!', true);
    const ps = g.papState;
    if (ps.state !== 'idle') return;
    g.papMenu = true;
    ui.papMenu(true);
  }
  g.papChoose = (key) => {
    g.papMenu = false;
    ui.papMenu(false);
    if (!key) return;
    const p = g.player;
    if (p.ranks[key] <= 0 || p.pap[key]) return;
    if (!g.spend(R.PAP_COST)) return;
    g.stats.paps++;
    const ps = g.papState;
    ps.state = 'working';
    ps.key = key;
    ps.t = 0;
    p.papBusy = key;
    sfx.pap(world.pap);
  };
  function updatePap(dt) {
    const ps = g.papState;
    if (ps.state === 'idle') return;
    ps.t += dt;
    if (ps.state === 'working' && ps.t >= 4.35) {
      ps.state = 'ready';
      ps.t = 0;
      ui.toast(CHAMPS[g.player.id][ps.key].pap + ' is ready');
    } else if (ps.state === 'ready' && ps.t >= 15) papLost();
  }
  function papLost() {
    const ps = g.papState;
    g.player.papBusy = null;
    ps.state = 'idle';
    ps.key = null;
    ui.toast('The upgrade slid back into the machine. Gone.', true);
  }
  function papTake() {
    const ps = g.papState;
    const p = g.player;
    p.pap[ps.key] = true;
    p.papBusy = null;
    const name = CHAMPS[p.id][ps.key].pap;
    ps.state = 'idle';
    ps.key = null;
    sfx.levelUp();
    ui.announce(name, 'Pack-a-Punched', '#c27cff');
    fx.ring(p.x, p.y, p.z, 0.3, 2.5, '#c27cff', 0.7);
    p.recompute();
    ui.abilities();
  }

  // ------------------------------------------------------------------ Noxious Traps (claymores) and Poro-Snax
  function plantShroom() {
    const p = g.player;
    if (!g.hasShrooms || g.shroomCharges <= 0 || p.downed || g.away) return;
    g.shroomCharges--;
    const mesh = env.makeShroom();
    mesh.position.set(p.x, p.y, p.z);
    scene.add(mesh);
    g.shrooms.push({ x: p.x, z: p.z, arm: g.time + 1, mesh });
    sfx.slap(p);
  }
  function updateShrooms() {
    for (let i = g.shrooms.length - 1; i >= 0; i--) {
      const s = g.shrooms[i];
      if (g.time < s.arm) continue;
      const near = g.nearestZombie(s.x, s.z, 1.5);
      if (!near) continue;
      sfx.gasPop(s);
      fx.burst(s.x, 0.5, s.z, 30, { color: '#a8ff3c', speed: 4, life: 0.7, size: 0.3 });
      fx.gas(s.x, grid.heightAt(s.x, s.z), s.z, 2.5, 2);
      g.queryZombies(s.x, s.z, 2.5, (z) => {
        if (z.dead || !z.targetable || dist(s.x, s.z, z.x, z.z) > 2.5 + z.r) return;
        g.damage(z, 1500, { type: 'magic', src: 'item' });
        if (!z.dead) g.slowZombie(z, 0.4, 2);
      });
      scene.remove(s.mesh);
      g.shrooms.splice(i, 1);
    }
  }
  function throwPoro(intent) {
    const p = g.player;
    if (!p.trinket || p.trinket.charges <= 0 || p.downed || g.away) return;
    p.trinket.charges--;
    const aim = intent.aim || { x: p.x + Math.cos(p.ang) * 5, z: p.z + Math.sin(p.ang) * 5 };
    let dx = aim.x - p.x, dz = aim.z - p.z;
    const l = Math.min(9, Math.hypot(dx, dz)) || 1;
    const L = Math.hypot(dx, dz) || 1;
    const land = grid.castFree(p.x, p.z, dx / L, dz / L, l, 0.35);
    const mesh = env.makePoro();
    scene.add(mesh);
    const poro = { x: land.x, z: land.z, t: 0, mesh, sx: p.x, sz: p.z };
    g.poros.push(poro);
    sfx.whip(p);
  }
  g.poros = [];
  function updatePoros(dt) {
    for (let i = g.poros.length - 1; i >= 0; i--) {
      const po = g.poros[i];
      po.t += dt;
      const fly = Math.min(1, po.t / 0.6);
      const x = po.sx + (po.x - po.sx) * fly, z = po.sz + (po.z - po.sz) * fly;
      po.mesh.position.set(x, grid.heightAt(x, z) + Math.sin(fly * Math.PI) * 1.5, z);
      if (fly >= 1) {
        if (!po.field) {
          po.field = new Int32Array(grid.w * grid.h);
          grid.flow(po.x, po.z, po.field);
        }
        po.mesh.rotation.y += dt * 6;
        po.mesh.position.y += Math.abs(Math.sin(po.t * 8)) * 0.25;
        if (Math.random() < dt * 8) fx.glow.spawn(po.x, 0.8, po.z, rand(-1, 1), 1.5, rand(-1, 1), 0.6, 0.18, 1, 0.6, 0.8, 0.9);
      }
      if (po.t >= 7.6) {
        // the poro pops: a burst of confetti and a shockwave
        sfx.tantrum(po);
        sfx.gasPop(po);
        fx.burst(po.x, 0.8, po.z, 60, { color: '#ffffff', speed: 6, life: 0.9, size: 0.25 });
        fx.ring(po.x, grid.heightAt(po.x, po.z), po.z, 0.3, 4, '#aee8ff', 0.5);
        g.queryZombies(po.x, po.z, 4, (zz) => {
          if (zz.dead || !zz.targetable || dist(po.x, po.z, zz.x, zz.z) > 4 + zz.r) return;
          g.damage(zz, Math.max(1000, zz.maxHp * 0.7), { type: 'magic', src: 'item' });
        });
        scene.remove(po.mesh);
        g.poros.splice(i, 1);
      }
    }
  }
  // zombies prefer a live poro over you
  g.poroTarget = () => {
    for (const po of g.poros) if (po.t > 0.6 && po.t < 7.6) return po;
    return null;
  };

  // ------------------------------------------------------------------ interactions
  function interactables() {
    const p = g.player;
    const list = [];
    // every prompt is ranked by the real distance to its own trigger point, so two
    // triggers that sit side by side (Bowie Knife next to Juggernog) both stay usable.
    // `bias` nudges ties: taking a box item beats everything, info-only text and
    // board repairs lose to anything you can actually buy.
    const add = (x, z, r, bias, o) => {
      const d = dist(p.x, p.z, x, z);
      if (d > r) return;
      o.d = d + bias + (o.bare ? 0.6 : 0);
      list.push(o);
    };
    // doors
    for (const d of map.doors) {
      if (d.kind !== 'door' || d.open) continue;
      const rects = [d.rect].concat(d.also ? [d.also] : []);
      for (const r of rects) {
        const cx = toX((r[0] + r[2]) / 2), cz = toZ((r[1] + r[3]) / 2);
        add(cx, cz, 2.3, 0, { text: `to open the door to ${d.to}`, cost: d.cost, use: () => g.spend(d.cost) && openDoorObj(d) });
      }
    }
    // windows
    if (!g.away) {
      for (const w of map.windows) {
        if (w.boards >= 6) continue;
        add(w.rx, w.rz, 1.6, 0.5, { text: 'to rebuild the barrier', hold: true, repair: w });
      }
    }
    // perks
    for (const [k, pm] of Object.entries(world.perks)) {
      if (pm.gone) continue;
      const info = R.PERKS[k];
      if (k !== 'revive' && !g.power) add(pm.ix, pm.iz, 1.5, 0, { text: 'You must turn on the power first!', bare: true });
      else if (p.perks.has(k) || (k === 'revive' && g.qrLife)) continue;
      else add(pm.ix, pm.iz, 1.5, 0, { text: `to buy ${info.name}`, cost: info.cost, use: () => buyPerk(k) });
    }
    // the box (and fire-sale boxes)
    const B = g.box;
    if (B) {
      const states = [{ st: B, spot: B.spot }].concat(B.fire.map((f) => ({ st: f, spot: f.spot })));
      for (const { st, spot } of states) {
        const b = world.boxes[spot];
        if (st.state === 'idle') add(b.ix, b.iz, 1.7, 0, { text: 'for a Random Item', cost: g.timers.firesale > 0 ? R.FIRESALE_COST : R.BOX_COST, use: () => boxUse(spot) });
        else if (st.state === 'offer' && st.item) {
          const name = st.item === 'poro' ? PORO.name : g.items.def(st.item).name;
          add(b.ix, b.iz, 1.7, -0.5, { text: `to take ${name}`, use: () => takeBoxItem(st, spot) });
        }
      }
    }
    // wall chalk
    for (const wb of world.chalk) {
      const id = typeof wb.item === 'string' ? wb.item : wb.item[p.id];
      const name = SPECIAL_WALL[id] ? SPECIAL_WALL[id].name : g.items.def(id).name;
      if (p.items.some((it) => it && it.id === id) || (id === 'bowie' && g.bowie)) add(wb.ix, wb.iz, 1.4, 0, { text: `You already have ${name}`, bare: true });
      else add(wb.ix, wb.iz, 1.4, 0, { text: `for ${name}`, cost: wb.cost, use: () => buyWall(wb) });
    }
    // power switch
    if (!g.power) add(world.power.x, world.power.z, 1.8, 0, { text: 'to turn on the power', use: powerOn });
    // traps
    for (const tr of world.traps) {
      const st = g.trapState[tr.id] || { on: 0, cd: 0 };
      for (const h of tr.handles) {
        if (!g.power) add(h.x, h.z, 1.4, 0, { text: 'You must turn on the power first!', bare: true });
        else if (st.on > 0) add(h.x, h.z, 1.4, 0, { text: 'Trap is active', bare: true });
        else if (st.cd > 0) add(h.x, h.z, 1.4, 0, { text: 'Trap is cooling down', bare: true });
        else add(h.x, h.z, 1.4, 0, { text: `to activate the ${tr.kind === 'fire' ? 'fire trap' : 'electric trap'}`, cost: R.TRAP_COST, use: () => buyTrap(tr) });
      }
    }
    // turrets
    world.turrets.forEach((tu, i) => {
      const st = g.turretState[i];
      if (!g.power) add(tu.x, tu.z, 1.6, 0, { text: 'You must turn on the power first!', bare: true });
      else if (st && st.on > 0) add(tu.x, tu.z, 1.6, 0, { text: 'Turret is active', bare: true });
      else add(tu.x, tu.z, 1.6, 0, { text: 'to activate the turret', cost: 1500, use: () => buyTurret(i) });
    });
    // teleporter pad and mainframe
    const T = g.tele;
    if (!T.trip) {
      const tx = world.teleporter.x, tz = world.teleporter.z;
      if (!g.power) add(tx, tz, 2.0, 0, { text: 'You must turn on the power first!', bare: true });
      else if (T.cooldown > 0) add(tx, tz, 2.0, 0, { text: 'The teleporter is cooling down', bare: true });
      else if (!T.coreLinked && !T.linked) add(tx, tz, 2.0, 0, { text: 'to initiate link to pad', use: () => { T.coreLinked = true; sfx.link(); ui.toast('Now link it at the mainframe in the Lobby'); } });
      else if (!T.linked) add(tx, tz, 2.0, 0, { text: 'Link not active', bare: true });
      else add(tx, tz, 2.0, 0, { text: 'to use the teleporter', use: startTrip });
      const mx = world.mainframe.x, mz = world.mainframe.z;
      if (!g.power) add(mx, mz, 1.6, 0, { text: 'You must turn on the power first!', bare: true });
      else if (T.cooldown > 0) add(mx, mz, 2.2, 0, { text: 'The teleporter is cooling down', bare: true });
      else if (T.coreLinked && !T.linked) add(mx, mz, 2.2, 0, { text: 'to link pad with core', use: () => { T.linked = true; sfx.link(); ui.toast('Teleporter linked'); } });
      else if (!T.linked) add(mx, mz, 2.2, 0, { text: 'Link not active', bare: true });
    }
    // Pack-a-Punch
    {
      const ps = g.papState;
      if (ps.state === 'idle') add(world.pap.ix, world.pap.iz, 1.8, 0, { text: 'to Pack-a-Punch an ability', cost: R.PAP_COST, use: papOpenMenu });
      else if (ps.state === 'working') add(world.pap.ix, world.pap.iz, 1.8, 0, { text: 'Pack-a-Punch is working...', bare: true });
      else add(world.pap.ix, world.pap.iz, 1.8, -0.5, { text: `to take ${CHAMPS[p.id][ps.key].pap}`, use: papTake });
    }
    // meteors
    for (const m of world.meteors) {
      if (m.done) continue;
      add(m.x, m.z, 1.4, 0, { text: 'to touch the meteor', use: () => touchMeteor(m) });
    }
    // film reels and the projector
    for (const r of g.reels.spots) {
      if (r.taken) continue;
      add(r.x, r.z, 1.3, 0, { text: 'to pick up the film reel', use: () => takeReel(r) });
    }
    if (g.reels.carried) add(world.pap.x, world.pap.z - 6.0, 2.2, 0, { text: 'to load the film reel', use: loadReel });
    list.sort((a, b) => a.d - b.d);
    return list[0] || null;
  }
  function touchMeteor(m) {
    m.done = true;
    g.meteorsDone++;
    sfx.meteorHum(m);
    fx.burst(m.x, 1, m.z, 20, { color: '#8fb8ff', speed: 2, life: 0.8, size: 0.2, lift: 1 });
    if (g.meteorsDone === 3) {
      ui.toast('Something hums in the walls...');
      env.startSong();
    }
  }
  function setupReels() {
    // three reels in three of the four secret rooms
    const rooms = shuffle(EE_ROOMS.slice()).slice(0, 3);
    g.reels.spots = rooms.map((id) => {
      const s = tripRoomSpot(id);
      const p = { x: s.x + rand(-1.4, 1.4), z: s.z + rand(-1.2, 0.4) };
      const mesh = env.makeReel();
      mesh.position.set(p.x, 0.85, p.z);
      scene.add(mesh);
      return { ...p, mesh, taken: false, room: id };
    });
  }
  function takeReel(r) {
    if (g.reels.carried) return ui.toast('You can only carry one reel', true);
    r.taken = true;
    scene.remove(r.mesh);
    g.reels.carried = r;
    sfx.pickup();
    ui.toast('Film reel: load it into the projector in the projector room');
  }
  function loadReel() {
    g.reels.carried = null;
    g.reels.inserted++;
    sfx.pickup();
    g.screenMode = 'film' + g.reels.inserted;
    ui.toast('The film on the theatre screen changes...');
  }

  function handleInteract(intent, dt) {
    const p = g.player;
    if (g.swap || g.papMenu) {
      g.interact = null;
      ui.prompt(null);
      return;
    }
    // hands are full while drinking a perk, like Black Ops
    const it = p.downed || g.over || p.drinking > 0 ? null : interactables();
    g.interact = it;
    ui.prompt(it, g.points);
    if (!it) return;
    if (it.repair) {
      const w = it.repair;
      if (intent.useHeld) {
        w.repairT += dt;
        if (w.repairT >= 1.0) {
          w.repairT = 0;
          if (w.boards < 6) {
            w.boards++;
            world.setBoards(w.index, w.boards);
            sfx.boardPlace(w);
            // points only while under the round's cap (counted at 10 per board)
            if (g.repairsRound + 10 <= R.repairCap(g.round || 1)) {
              g.repairsRound += 10;
              g.addPoints(10, 'repair');
            }
          }
        }
      } else w.repairT = Math.min(w.repairT, 0.6);
      return;
    }
    if (intent.use && it.use) it.use();
  }

  // ------------------------------------------------------------------ main update
  g.start = (champId) => {
    const p = new Champion(champId, g);
    g.player = p;
    const [X, Y] = pick(SPAWNS);
    const s = P(X, Y);
    p.x = s.x;
    p.z = s.z;
    p.y = grid.heightAt(s.x, s.z);
    p.ang = -Math.PI / 2;
    refillCycle();
    computeActiveZones();
    refreshFields(true);
    initBox();
    setupReels();
    world.setPower(false);
    for (const w of map.windows) world.setBoards(w.index, 6);
    // the match opens with a teleport flash at the mainframe
    ui.whiteFlash();
    sfx.tpZap();
    ui.round(0, false);
    ui.perks(p.perks);
    ui.items();
    ui.abilities();
    g.events.emit('start', champId);
  };

  g.update = (dt, intent) => {
    if (g.over) {
      for (const z of g.zombies) updateZombie(z, dt, g);
      return;
    }
    g.time += dt;
    g.stats.time += dt;
    const p = g.player;
    // spatial hash of zombies
    g.hash.clear();
    for (const z of g.zombies) if (!z.dead) g.hash.insert(z);
    // champion
    if (p.drinking > 0) {
      p.drinking -= dt;
      intent.attack = false;
      intent.cast = null;
      intent.attackStart = false;
    }
    if (g.swap) {
      const k = intent.item;
      if (k >= 0) {
        g.chooseSwap(k);
        intent.item = -1;
      }
    }
    if (g.papMenu || g.swap) {
      intent.cast = null;
      intent.item = -1;
    }
    if (g.away === 'trip' && g.tele.trip && g.tele.trip.phase !== 'pap' && g.tele.trip.phase !== 'ee') {
      intent.move = { x: 0, z: 0 };
      intent.moveTo = null;
      intent.cast = null;
      intent.attack = false;
    }
    if (g.tele.trip && g.tele.trip.phase === 'ee') {
      intent.cast = null;
      intent.attack = false;
    }
    p.update(dt, intent);
    if (intent.shroom) plantShroom();
    if (intent.trinket) throwPoro(intent);
    // elixir timer
    if (g.elixir) {
      g.elixir.t -= dt;
      if (g.elixir.t <= 0) {
        g.elixir = null;
        p.elixirStats = null;
        p.recompute();
      }
    }
    // where are we?
    const zn = zoneName(p.x, p.z);
    if (zn && zn !== g.playerZone) {
      g.playerZone = zn;
      computeActiveZones();
    }
    const rm = map.roomAt(p.x, p.z);
    if (rm && rm.name !== g.lastRoomName) {
      g.lastRoomName = rm.name;
      ui.roomName(rm.name);
    }
    // roofs that break the first time you walk in after the curtains open
    if (g.curtainsDone) {
      if (!g.roofs.lobby && zn === 'lobby') {
        g.roofs.lobby = true;
        roofBreak('lobby');
      }
      const [X0, Y0, X1, Y1] = FOYER_ROOF_TRIGGER;
      if (!g.roofs.dining && p.x >= toX(X0) && p.x <= toX(X1) && p.z >= toZ(Y1) && p.z <= toZ(Y0)) {
        g.roofs.dining = true;
        roofBreak('dining');
      }
    }
    // flow field towards the champion
    g.fieldT -= dt;
    if (g.fieldT <= 0) {
      g.fieldT = 0.2;
      refreshFields(false);
    }
    // zombies (count who is already swinging: see MAX_SWINGS)
    g.swinging = 0;
    for (const z of g.zombies) if (!z.dead && (z.state === 'attack' || z.state === 'leap')) g.swinging++;
    const poro = g.poroTarget();
    for (const z of g.zombies) {
      if (poro && !z.dead && z.state === 'chase') {
        z.poroT = poro;
      }
      updateZombie(z, dt, g);
    }
    // remove fully sunk corpses
    for (let i = g.zombies.length - 1; i >= 0; i--) {
      const z = g.zombies[i];
      if (z.dead && z.deadT > 3.2) {
        env.crowd.remove(z);
        g.zombies.splice(i, 1);
      }
    }
    updateWindows(dt);
    stuckCheck(dt);
    // scheduled tasks (projectiles, timers)
    for (let i = g.tasks.length - 1; i >= 0; i--) {
      if (!g.tasks[i](dt)) g.tasks.splice(i, 1);
    }
    for (let i = g.gasClouds.length - 1; i >= 0; i--) {
      const c = g.gasClouds[i];
      c.t -= dt;
      if (c.t <= 0) g.gasClouds.splice(i, 1);
    }
    ui.gas(g.gasClouds.some((c) => dist(c.x, c.z, p.x, p.z) < c.r));
    updateRounds(dt);
    updatePowerups(dt);
    updatePowerSequence(dt);
    updateDowned(dt);
    updatePap(dt);
    updateTrip(dt);
    const trapOn = updateTraps(dt);
    updateTurrets(dt);
    updateShrooms();
    updatePoros(dt);
    // box
    const B = g.box;
    if (B) {
      updateBoxState(B, B.spot, world.boxMesh, dt);
      for (const f of B.fire.slice()) updateBoxState(f, f.spot, f.mesh, dt);
      updateBoxBoards(B.state === 'teddy' || g.timers.firesale > 0);
    }
    handleInteract(intent, dt);
    g.world.state = {
      teleState: teleState(),
      coreLinked: g.tele.coreLinked,
      curtain: g.curtain,
      screenDown: g.screenDown,
      screenMode: g.screenMode,
      clock: g.clock,
      trapOn,
      papSpin: g.papState.state === 'working',
    };
  };

  function roofBreak(zone) {
    const holes = QUAD_HOLES.filter((h) => h.zone === zone);
    holes.forEach((q, i) => {
      g.addTask(makeTimer(i * 0.4, () => {
        const p = P(q.X, q.Y);
        fx.burst(p.x, 5, p.z, 24, { color: '#6a5a48', speed: 3, life: 1.2, size: 0.35, grav: 9, smoke: true, alpha: 0.8 });
        sfx.debris(p);
        g.shake(0.1);
      }));
    });
  }

  g.clock = -1;
  // internal actions, exposed for automated tests (?test)
  g.debug = {
    powerOn, openDoorObj, buyPerk, boxUse, takeBoxItem, startFireSale, grab, spawnPowerup, startTrip, papTake, buyTrap, buyTurret, buyWall,
    giveItem, spawnZombie, spawnDog, startRound, interactables, touchMeteor, refreshFields, computeActiveZones, loadReel, takeReel, plantShroom, throwPoro,
    endRound, kill: (z) => kill(z, { src: 'ability' }, false),
  };
  return g;
}

export { SPECIAL_WALL, EXTRA_ITEMS };
