// Zombie, Nova 6 crawler and Hellhound behaviour. Spawning outside a window, tearing
// boards, climbing in, chasing along the flow field, biting, dying.

import { clamp, dist, dist2, rand, chance, angDiff, TAU } from './util.js';
import { sfx } from './audio.js';

// League-scale bite damage keeps Black Ops' ratios: a 60 bite against 100 health.
export const BITE = { zombie: 320, nova: 240, dog: 213 };
export const SPEED = { walk: 1.05, run: 2.3, sprint: 2.85, nova: 2.45, dog: 3.7, crawl: 0.7 };
// Champions fight in melee, where guns never had to. Only this many zombies may be mid-swing (or
// mid-leap) at once; the rest crowd in and wait their turn, so a horde is dangerous, not instant death.
export const MAX_SWINGS = 2;
const WALK_STRIDE = { walk: 1.25, run: 1.9, sprint: 2.4, nova: 1.0, dog: 1.6, crawl: 0.7 };

let nextId = 1;

export function makeZombie(kind, hp, speedClass) {
  return {
    id: nextId++,
    kind, // 'zombie' | 'nova' | 'dog'
    x: 0, z: 0, y: 0, yOff: 0,
    ang: Math.PI / 2,
    r: kind === 'dog' ? 0.38 : kind === 'nova' ? 0.4 : 0.34,
    hp, maxHp: hp,
    speedClass: kind === 'nova' ? 'nova' : kind === 'dog' ? 'dog' : speedClass,
    state: 'spawn',
    t: 0, // time in state
    actT: 0, // 0..1 progress of attack/tear/climb animations
    win: null,
    slot: 0,
    targetable: false, // can be hit by champions
    solid: false, // blocks the champion
    inside: false, // has entered the play area (eligible for power-up drops)
    dead: false, deadT: 0,
    stun: 0, knockup: 0, slow: 0, slowT: 0, curse: 0, burns: [],
    flash: 0,
    walkPhase: rand(0, TAU), animSpeed: 0,
    atkCd: rand(0, 0.4),
    attackHit: false,
    lastMove: 0, stuckT: 0, lastTear: 0, sx: 0, sz: 0,
    leapCd: 2,
    groanT: rand(1, 6),
    poi: null,
    legless: false, headless: false, noArmL: false, noArmR: false,
    lastHitT: -9, lastHitBy: null,
    vx: 0, vz: 0,
  };
}

/**
 * Per-frame zombie update. ctx is the game: player, grid, field, time, windows, events...
 */
export function updateZombie(z, dt, g) {
  const p = g.player;
  z.flash = Math.max(0, z.flash - dt);
  z.t += dt;
  if (z.dead) {
    z.deadT += dt;
    z.animSpeed = 0;
    if (z.deadT > 1.6) z.yOff = -Math.min(1.2, (z.deadT - 1.6) * 0.8);
    return;
  }
  // status timers
  if (z.stun > 0) z.stun -= dt;
  if (z.knockup > 0) z.knockup -= dt;
  if (z.slowT > 0) {
    z.slowT -= dt;
    if (z.slowT <= 0) z.slow = 0;
  }
  if (z.curse > 0) z.curse -= dt;
  if (z.burns.length) {
    for (let i = z.burns.length - 1; i >= 0; i--) {
      const b = z.burns[i];
      b.t -= dt;
      b.acc += dt;
      while (b.acc >= 0.5 && !z.dead) {
        b.acc -= 0.5;
        g.damage(z, b.dps * 0.5, { type: 'magic', src: 'dot' });
      }
      if (b.t <= 0) z.burns.splice(i, 1);
    }
    if (z.dead) return;
  }
  z.groanT -= dt;
  if (z.groanT <= 0) {
    z.groanT = rand(3, 9);
    if (z.kind === 'nova') sfx.crawlerScreech(z);
    else if (z.kind !== 'dog') sfx.groan(z, z.speedClass === 'sprint' ? 1.15 : 1);
  }
  const disabled = z.stun > 0 || z.knockup > 0;
  z.animSpeed = 0;
  // window states need a window; anyone who lost theirs just hunts (the stuck sweep recycles them)
  if (!z.win && (z.state === 'approach' || z.state === 'tear' || z.state === 'climb')) z.state = 'chase';
  switch (z.state) {
    case 'approach':
      return approach(z, dt, g, disabled);
    case 'tear':
      return tear(z, dt, g, disabled);
    case 'climb':
      return climb(z, dt, g);
    case 'rise':
      return rise(z, dt, g);
    case 'drop':
      return drop(z, dt, g);
    case 'attack':
      return attack(z, dt, g, disabled);
    case 'leap':
      return leap(z, dt, g);
    case 'trapped':
      return;
    default:
      return chase(z, dt, g, disabled, p);
  }
}

function speedOf(z) {
  let s = SPEED[z.legless ? 'crawl' : z.speedClass] || SPEED.walk;
  if (z.slow > 0) s *= 1 - z.slow;
  return s;
}

function stepAnim(z, moved, dt) {
  z.animSpeed = moved / Math.max(dt, 1e-4);
  z.walkPhase += (moved / (WALK_STRIDE[z.legless ? 'crawl' : z.speedClass] || 1.4)) * Math.PI;
}

// ---- outside the window: walk up to it
function approach(z, dt, g, disabled) {
  const w = z.win;
  const tx = w.x - w.nx * 0.75 + w.tx * (z.slot - 1) * 0.55;
  const tz = w.z - w.nz * 0.75 + w.tz * (z.slot - 1) * 0.55;
  const d = dist(z.x, z.z, tx, tz);
  if (disabled) return;
  if (d < 0.08) {
    z.state = 'tear';
    z.t = 0;
    z.actT = 0;
    z.ang = Math.atan2(w.nz, w.nx);
    z.targetable = true; // you can hit them through the window
    return;
  }
  const sp = Math.min(d, speedOf(z) * dt);
  z.ang = Math.atan2(tz - z.z, tx - z.x);
  z.x += ((tx - z.x) / d) * sp;
  z.z += ((tz - z.z) / d) * sp;
  z.y = w.y;
  stepAnim(z, sp, dt);
}

// ---- at the window: pull boards, swipe through, climb when clear
function tear(z, dt, g, disabled) {
  const w = z.win;
  z.ang = Math.atan2(w.nz, w.nx);
  if (disabled) {
    z.actT = 0;
    return;
  }
  if (w.boards <= 0) {
    // first in line climbs; one at a time per window
    if (g.time >= w.climbFree) {
      w.climbFree = g.time + 0.9;
      z.state = 'climb';
      z.t = 0;
      z.actT = 0;
      z.cx = z.x;
      z.cz = z.z;
      sfx.windowCrash(w);
    }
    return;
  }
  // a tear cycle: reach in, grab a board, pull it out (about 1.6 s)
  const cycle = z.speedClass === 'sprint' ? 1.25 : 1.6;
  z.actT = (z.t % cycle) / cycle;
  if (z.t >= cycle) {
    z.t -= cycle;
    if (w.boards > 0) {
      g.tearBoard(w, z);
      z.lastTear = g.time;
    }
    // Black Ops: 50% per cycle to swipe through if you're close
    const p = g.player;
    if (!p.downed && dist(z.x, z.z, p.x, p.z) < 2.3 && chance(0.5)) {
      if (dist(p.x, p.z, w.rx, w.rz) < 1.3 || dist(p.x, p.z, w.x, w.z) < 1.3) {
        g.biteFromWindow(z);
      }
    }
  }
}

function climb(z, dt, g) {
  const w = z.win;
  z.actT = Math.min(1, z.t / 1.0);
  const t = z.actT;
  const ox = w.x - w.nx * 0.75, oz = w.z - w.nz * 0.75;
  z.x = ox + (w.ix - ox) * t;
  z.z = oz + (w.iz - oz) * t;
  z.yOff = Math.sin(t * Math.PI) * 0.6;
  z.y = w.y + (g.grid.heightAt(w.ix, w.iz) - w.y) * t;
  z.ang = Math.atan2(w.nz, w.nx);
  if (t >= 1) enterPlay(z, g, w.ix, w.iz);
}

function rise(z, dt, g) {
  const t = Math.min(1, z.t / 1.6);
  z.actT = t;
  z.yOff = -1.7 * (1 - t);
  if (Math.random() < dt * 10) g.fx.burst(z.x, z.y + 0.05, z.z, 2, { color: '#3b2a1e', speed: 1.5, life: 0.6, size: 0.25, smoke: true, alpha: 0.7, grav: 6 });
  if (t >= 1) enterPlay(z, g, z.x, z.z);
}

function drop(z, dt, g) {
  // Nova crawlers break through the roof and drop in
  const t = Math.min(1, z.t / 0.7);
  z.yOff = 6 * (1 - t * t);
  if (t >= 1) {
    g.fx.burst(z.x, z.y + 0.2, z.z, 16, { color: '#6a5a40', speed: 3, life: 0.8, size: 0.4, smoke: true, alpha: 0.6, up: 0.3 });
    g.shake(0.08);
    enterPlay(z, g, z.x, z.z);
  }
}

export function enterPlay(z, g, x, zz) {
  z.x = x;
  z.z = zz;
  z.yOff = 0;
  z.y = g.grid.heightAt(x, zz);
  z.state = 'chase';
  z.t = 0;
  z.targetable = true;
  z.solid = true;
  z.inside = true;
  z.sx = z.x;
  z.sz = z.z;
  z.lastMove = g.time;
  if (z.win) {
    z.win.queue = z.win.queue.filter((o) => o !== z);
    z.win = null;
  }
  // nudge out of anyone already standing on the spot
  g.grid.resolve(z, z.r);
}

// ---- inside: chase the champion (or a point of interest)
function chase(z, dt, g, disabled, p) {
  if (disabled) return;
  let tx = p.x, tz = p.z;
  let useField = true;
  let field = g.field;
  const away = g.playerAway(); // in the projection room, or downed with Quick Revive
  const poro = g.poroTarget && g.poroTarget();
  if (poro && poro.field && dist(z.x, z.z, poro.x, poro.z) < 22) {
    // Poro-Snax: everyone nearby chases the poro instead
    tx = poro.x;
    tz = poro.z;
    field = poro.field;
    if (dist(z.x, z.z, tx, tz) < z.r + 0.6) {
      z.animSpeed = 0;
      z.ang += 4 * dt;
      return;
    }
  }
  if (away) {
    // walk to a point of interest instead of the champion
    if (!z.poi || g.time > z.poiUntil) {
      z.poi = g.pickPoi(z, away);
      z.poiUntil = g.time + rand(4, 8);
    }
    if (z.poi) {
      tx = z.poi.x;
      tz = z.poi.z;
      useField = false;
    }
  } else z.poi = null;
  const d = dist(z.x, z.z, tx, tz);
  // attack?
  if (!away && !poroLured(z, g) && !p.downed && z.atkCd <= 0 && targetable(p)) {
    const reach = p.r + z.r + (z.kind === 'dog' ? 0.5 : 0.45);
    if (d <= reach && g.swinging < MAX_SWINGS) {
      g.swinging++;
      z.state = 'attack';
      z.t = 0;
      z.actT = 0;
      z.attackHit = false;
      return;
    }
    // Nova crawlers leap from 2.4-3.7 m with a clear line
    if (z.kind === 'nova' && z.leapCd <= 0 && g.swinging < MAX_SWINGS && d > 2.4 && d < 3.7 && Math.abs(p.y - z.y) < 0.8 && g.grid.los(z.x, z.z, p.x, p.z, 0.3)) {
      g.swinging++;
      z.state = 'leap';
      z.t = 0;
      z.lx = z.x;
      z.lz = z.z;
      z.leapCd = 5;
      sfx.crawlerScreech(z);
      return;
    }
  }
  if (z.atkCd > 0) z.atkCd -= dt;
  if (z.leapCd > 0) z.leapCd -= dt;
  // direction: straight at the target with a clear line, else downhill on the flow field
  let dx = 0, dz = 0;
  const close = d < 1.2 * (p.r + z.r + 0.45) && !away;
  if (!close) {
    if (g.grid.los(z.x, z.z, tx, tz, z.r * 0.9)) {
      dx = (tx - z.x) / (d || 1);
      dz = (tz - z.z) / (d || 1);
    } else {
      const dir = useField ? g.grid.downhill(z.x, z.z, field) : g.dirTo(z, tx, tz);
      if (dir) {
        dx = dir.x;
        dz = dir.z;
      }
    }
  }
  // smooth turning and separation from neighbours
  const want = dx || dz ? Math.atan2(dz, dx) : null;
  let sepX = 0, sepZ = 0;
  g.queryZombies(z.x, z.z, z.r * 2.4, (o) => {
    if (o === z || o.dead || !o.solid) return;
    const ox = z.x - o.x, oz = z.z - o.z;
    const dd = ox * ox + oz * oz;
    const min = (z.r + o.r) * 1.05;
    if (dd < min * min && dd > 1e-6) {
      const l = Math.sqrt(dd);
      const push = (min - l) / min;
      sepX += (ox / l) * push;
      sepZ += (oz / l) * push;
    }
  });
  const sp = speedOf(z);
  let mx = 0, mz = 0;
  if (want !== null) {
    const turnRate = z.kind === 'dog' ? 10 : 6;
    const da = angDiff(want, z.ang);
    z.ang += clamp(da, -turnRate * dt, turnRate * dt);
    // move along the wanted direction (not the turned facing) so corners don't snag
    mx = Math.cos(want) * sp * dt;
    mz = Math.sin(want) * sp * dt;
  } else if (!away) {
    z.ang += clamp(angDiff(Math.atan2(p.z - z.z, p.x - z.x), z.ang), -8 * dt, 8 * dt);
  }
  mx += sepX * 1.6 * dt;
  mz += sepZ * 1.6 * dt;
  const ox = z.x, oz = z.z;
  z.x += mx;
  z.z += mz;
  // keep off the champion's body
  if (!away && !p.downed) {
    const ddx = z.x - p.x, ddz = z.z - p.z;
    const min = p.r + z.r;
    const dd = ddx * ddx + ddz * ddz;
    if (dd < min * min && dd > 1e-6) {
      const l = Math.sqrt(dd);
      z.x = p.x + (ddx / l) * min;
      z.z = p.z + (ddz / l) * min;
    }
  }
  g.grid.resolve(z, z.r);
  if (g.grid.blockedAt(z.x, z.z)) {
    z.x = ox;
    z.z = oz;
  }
  z.y = g.grid.heightAt(z.x, z.z);
  const moved = Math.hypot(z.x - ox, z.z - oz);
  stepAnim(z, moved, dt);
  // stuck bookkeeping (Black Ops: no progress for a long while -> respawn)
  if (dist2(z.x, z.z, z.sx, z.sz) > 0.36) {
    z.sx = z.x;
    z.sz = z.z;
    z.lastMove = g.time;
  }
}

function poroLured(z, g) {
  const poro = g.poroTarget && g.poroTarget();
  return !!(poro && poro.field && dist(z.x, z.z, poro.x, poro.z) < 22);
}

function targetable(p) {
  return !(p.buffs.untargetable > 0 || p.buffs.stasis > 0);
}

function attack(z, dt, g, disabled) {
  const p = g.player;
  if (disabled) {
    z.state = 'chase';
    return;
  }
  const dur = z.kind === 'dog' ? 0.6 : 0.95;
  const hitAt = z.kind === 'dog' ? 0.35 : 0.5;
  z.actT = Math.min(1, z.t / dur);
  z.ang += clamp(angDiff(Math.atan2(p.z - z.z, p.x - z.x), z.ang), -6 * dt, 6 * dt);
  if (!z.attackHit && z.actT >= hitAt) {
    z.attackHit = true;
    const reach = p.r + z.r + (z.kind === 'dog' ? 0.8 : 0.75);
    if (!p.downed && targetable(p) && dist(z.x, z.z, p.x, p.z) <= reach && Math.abs(angDiff(Math.atan2(p.z - z.z, p.x - z.x), z.ang)) < 1.6 && g.playerAway() === null) {
      g.bitePlayer(z);
    }
  }
  if (z.actT >= 1) {
    z.state = 'chase';
    z.t = 0;
    z.atkCd = z.kind === 'dog' ? 0.4 : 0.35;
  }
}

function leap(z, dt, g) {
  const p = g.player;
  const dur = 0.55;
  const t = Math.min(1, z.t / dur);
  z.actT = t;
  const tx = p.x - Math.cos(z.ang) * (p.r + z.r), tz = p.z - Math.sin(z.ang) * (p.r + z.r);
  z.ang = Math.atan2(p.z - z.lz, p.x - z.lx);
  z.x = z.lx + (tx - z.lx) * t;
  z.z = z.lz + (tz - z.lz) * t;
  z.yOff = Math.sin(t * Math.PI) * 1.1;
  if (t >= 1) {
    z.yOff = 0;
    g.grid.resolve(z, z.r);
    if (!p.downed && targetable(p) && dist(z.x, z.z, p.x, p.z) < p.r + z.r + 0.9 && g.playerAway() === null) g.bitePlayer(z);
    z.state = 'chase';
    z.t = 0;
    z.atkCd = 0.6;
  }
}
