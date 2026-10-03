// The playable champion: stats, movement, basic attacks, the four abilities of each
// kit, leveling, Pack-a-Punch upgrades, and taking hits by Black Ops rules.

import * as THREE from 'three';
import { CHAMPS, FLASH, KAT_DAGGER_DMG, grow, xpFor } from './champdata.js';
import { clamp, dist, dist2, angDiff, rand, TAU } from './util.js';
import { REGEN_DELAY, REGEN_DELAY_LOW, REGEN_LOW } from './rules.js';
import { sfx } from './audio.js';

const M = 0.01; // League units -> metres

export class Champion {
  constructor(id, g) {
    this.id = id;
    this.def = CHAMPS[id];
    this.g = g;
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.ang = -Math.PI / 2;
    this.r = this.def.radius;
    this.level = 1;
    this.xp = 0;
    this.ranks = { Q: 0, W: 0, E: 0, R: 0 };
    this.skillPoints = 1;
    this.pap = { Q: false, W: false, E: false, R: false };
    this.papBusy = null; // ability currently inside the machine
    this.items = [null, null, null, null, null, null];
    this.trinket = null; // { id, charges }
    this.perks = new Set();
    this.cd = { Q: 0, W: 0, E: 0, R: 0, flash: 0 };
    this.cdMax = { Q: 1, W: 1, E: 1, R: 1, flash: FLASH.cd };
    this.atk = { cd: 0, wind: -1, windMax: 0, target: null, side: 1, anim: -1, animDur: 0.3 };
    this.cast = null; // { kind, t, dur, then }
    this.channel = null;
    this.buffs = { wuju: 0, highlander: 0, prep: 0, untargetable: 0, stasis: 0, medDR: 0, lich: 0, lichCd: 0, shieldT: 0 };
    this.shield = 0;
    this.ds = { stacks: 0, t: 0 };
    this.lastHurt = -99;
    this.lastHit = -99;
    this.downed = false;
    this.dead = false;
    this.speedNow = 0;
    this.moveTarget = null;
    this.attackOrder = null; // classic mode chase target
    this.hitBy = new Map(); // attacker -> last time it damaged us (0.4 s rule)
    this.stacks = { mejai: 0, heartsteel: 0, guinsoo: 0, guinsooT: 0, kraken: 0, shiv: 0, riftT: 0, rift: 0 };
    this.itemCd = [0, 0, 0, 0, 0, 0];
    this.combatT = -99;
    this.kills = 0;
    this.kit = KITS[id](this);
    this.recompute();
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    if (g.settings.autoLevel) this.autoSpend();
  }

  // ------------------------------------------------------------ stats
  itemList() {
    return this.items.filter(Boolean);
  }
  hasItem(key) {
    return this.items.some((it) => it && it.id === key);
  }

  recompute() {
    const d = this.def;
    const L = this.level;
    const s = {};
    const baseAD = grow(d.ad, d.adG, L);
    let ad = 0, ap = 0, asB = grow(0, d.asG, L), crit = 0, critDmg = 2.0, hp = 0, armor = 0, ah = 0, msF = 0, msP = 0, ls = 0, ov = 0, mana = 0, apMult = 1;
    for (const it of this.itemList()) {
      const st = it.def.stats || {};
      ad += st.ad || 0;
      ap += st.ap || 0;
      asB += st.as || 0;
      crit += st.crit || 0;
      critDmg += st.critDmg || 0;
      hp += st.hp || 0;
      armor += st.armor || 0;
      ah += st.ah || 0;
      msF += st.ms || 0;
      msP += st.msPct || 0;
      ls += st.ls || 0;
      ov += st.ov || 0;
      mana += st.mana || 0;
      if (st.apMult) apMult *= st.apMult;
    }
    if (this.hasItem('steraks')) ad += baseAD * 0.5;
    if (this.hasItem('heartsteel')) hp += this.stacks.heartsteel;
    if (this.hasItem('mejai')) {
      ap += this.stacks.mejai * 5;
      if (this.stacks.mejai >= 10) msP += 10;
    }
    if (this.hasItem('warmog')) hp += hp * 0.12;
    if (this.hasItem('guinsoo')) asB += this.stacks.guinsoo * 8;
    if (this.hasItem('riftmaker')) {
      ap += hp * 0.02;
      if (this.stacks.rift >= 4) ov += 10;
    }
    if (this.hasItem('phage') && this.stacks.rage > (this.g.time || 0)) msF += 20;
    const ex = this.elixirStats;
    if (ex) {
      ad += ex.ad || 0;
      ap += ex.ap || 0;
      hp += ex.hp || 0;
      ov += ex.ov || 0;
    }
    ap *= apMult;
    // champion buffs
    if (this.buffs.highlander > 0) {
      const m = this.pap.R ? 1.5 : 1;
      asB += [0, 25, 45, 65][this.ranks.R] * m;
      msP += [0, 40, 50, 60][this.ranks.R] * m;
    }
    if (this.buffs.prep > 0) {
      const bonus = [0, 50, 60, 70, 80, 90][this.ranks.W];
      msP += bonus * (this.buffs.prep / 1.25);
    }
    if (this.buffs.lich > 0) asB += 50;
    if (this.perks.has('speed')) ah += 50;
    s.baseAD = baseAD;
    s.ad = baseAD + ad;
    s.bonusAD = ad;
    s.ap = ap;
    s.bonusAS = asB;
    let as = d.as + d.asRatio * (asB / 100);
    if (this.perks.has('tap')) as /= 0.75; // Double Tap: time between shots x 0.75
    s.as = Math.min(as, this.perks.has('tap') ? 3.33 : 2.5);
    s.crit = Math.min(1, crit);
    s.critDmg = critDmg;
    const jugg = this.perks.has('jugg') ? 2.5 : 1;
    s.maxHp = d.hp * jugg + hp;
    s.bonusHp = hp;
    s.armor = d.armor + armor;
    s.bonusArmor = armor;
    s.ah = ah;
    s.ms = ((d.ms + msF) * M) * (1 + msP / 100);
    s.ls = ls;
    s.ov = ov;
    s.maxMana = d.mana ? grow(d.mana, d.manaG, L) + mana : 0;
    s.manaRegen = d.mana ? grow(d.manaRegen, d.manaRegenG, L) / 5 : 0;
    s.range = d.range * M;
    const oldMax = this.maxHp || s.maxHp;
    this.s = s;
    this.maxHp = s.maxHp;
    this.maxMana = s.maxMana;
    // keep the same health fraction when max health changes (perks, items)
    if (this.hp !== undefined && oldMax !== s.maxHp && !this.downed) this.hp = clamp(this.hp * (s.maxHp / oldMax), 1, s.maxHp);
    if (this.mana !== undefined) this.mana = Math.min(this.mana, this.maxMana);
  }

  /** Cooldown after ability haste. */
  haste(cd) {
    return cd * (100 / (100 + this.s.ah));
  }

  reach(z) {
    return this.s.range + this.r + (z ? z.r : 0.35);
  }

  // ------------------------------------------------------------ xp / levels
  gainXp(n) {
    if (this.level >= 18) return;
    this.xp += n;
    let leveled = false;
    while (this.level < 18 && this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level);
      this.level++;
      this.skillPoints++;
      leveled = true;
    }
    if (this.level >= 18) this.xp = 0;
    if (leveled) {
      const before = this.maxHp;
      this.recompute();
      if (this.maxHp > before) this.hp += this.maxHp - before;
      sfx.levelUp();
      this.g.fx.ring(this.x, this.y, this.z, 0.4, 2.2, '#c8aa6e', 0.7);
      this.g.fx.burst(this.x, this.y + 1, this.z, 24, { color: '#f0e6d2', speed: 3, life: 0.9, size: 0.18, lift: 2 });
      this.g.events.emit('level', this.level);
      if (this.g.settings.autoLevel) this.autoSpend();
    }
  }

  maxRank(key) {
    if (key === 'R') return this.level >= 16 ? 3 : this.level >= 11 ? 2 : this.level >= 6 ? 1 : 0;
    return Math.min(5, Math.ceil(this.level / 2));
  }
  canRank(key) {
    return this.skillPoints > 0 && this.ranks[key] < this.maxRank(key);
  }
  rankUp(key) {
    if (!this.canRank(key)) return false;
    this.ranks[key]++;
    this.skillPoints--;
    if (key === 'Q' && this.id === 'amumu') this.kit.onRankQ();
    sfx.skillUp();
    this.g.events.emit('rank', key);
    return true;
  }
  autoSpend() {
    let guard = 0;
    while (this.skillPoints > 0 && guard++ < 30) {
      const placed = this.def.order.slice(0, this.level);
      const want = { Q: 0, W: 0, E: 0, R: 0 };
      let pickKey = null;
      for (const k of placed) {
        want[k]++;
        if (want[k] > this.ranks[k] && this.canRank(k)) {
          pickKey = k;
          break;
        }
      }
      if (!pickKey) pickKey = ['R', 'Q', 'E', 'W'].find((k) => this.canRank(k));
      if (!pickKey) break;
      this.rankUp(pickKey);
    }
  }

  // ------------------------------------------------------------ damage taken
  /** A bite or hit from a zombie. raw = physical damage before armor. Returns damage applied. */
  takeHit(raw, attacker, opts = {}) {
    if (this.downed || this.dead || this.g.godMode) return 0;
    if (this.buffs.untargetable > 0 || this.buffs.stasis > 0) return 0;
    if (attacker) {
      const last = this.hitBy.get(attacker) || -99;
      if (this.g.time - last < 0.4) return 0; // same zombie can't hit again within 0.4 s
      this.hitBy.set(attacker, this.g.time);
    }
    let dmg = opts.true ? raw : raw * (100 / (100 + Math.max(0, this.s.armor)));
    dmg = this.kit.reduce ? this.kit.reduce(dmg, attacker, opts) : dmg;
    if (this.buffs.medDR > 0) dmg *= 1 - this.kit.meditateDR();
    if (this.shield > 0) {
      const a = Math.min(this.shield, dmg);
      this.shield -= a;
      dmg -= a;
    }
    this.combatT = this.g.time;
    this.lastHurt = this.g.time;
    if (dmg <= 0) return 0;
    this.hp -= dmg;
    this.g.onPlayerHurt(dmg, attacker);
    if (attacker && !opts.noThorns) this.g.items.onHurt(this, attacker, dmg);
    // Sterak's: below 30% health, a shield of 60% bonus health (90 s)
    if (this.hasItem('steraks') && this.hp > 0 && this.hp / this.maxHp < 0.3 && this.g.time > (this.stacks.sterakCd || 0)) {
      this.stacks.sterakCd = this.g.time + 90;
      this.shield += this.s.bonusHp * 0.6 + 120;
      this.buffs.shieldT = 4.5;
      sfx.shield(this);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.g.playerDown();
    }
    return dmg;
  }

  heal(n, src) {
    if (this.downed || n <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    const healed = this.hp - before;
    // Bloodthirster: overheal from life steal becomes a shield
    if (src === 'ls' && this.hasItem('bloodthirster')) {
      const over = n - healed;
      if (over > 0) {
        const cap = 165 + Math.max(0, this.level - 8) * 15;
        this.shield = Math.min(cap, this.shield + over);
        this.buffs.shieldT = Math.max(this.buffs.shieldT, 3);
      }
    }
    return healed;
  }

  /** Life steal / omnivamp from damage dealt. */
  vamp(dealt, isAttack) {
    const pct = (isAttack ? this.s.ls : 0) + this.s.ov;
    if (pct > 0 && dealt > 0) this.heal(dealt * (pct / 100), 'ls');
  }

  regen(dt) {
    if (this.downed) return;
    const since = this.g.time - this.lastHurt;
    const frac = this.hp / this.maxHp;
    if (frac > REGEN_LOW) {
      if (since >= REGEN_DELAY && this.hp < this.maxHp) this.hp = this.maxHp;
    } else if (since >= REGEN_DELAY_LOW) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.1 * (dt / 0.05));
    }
    if (this.maxMana > 0) {
      let r = this.s.manaRegen;
      if (this.buffs.medDR > 0) r *= 1;
      this.mana = Math.min(this.maxMana, this.mana + r * dt);
    }
    if (this.buffs.shieldT > 0) {
      this.buffs.shieldT -= dt;
      if (this.buffs.shieldT <= 0) this.shield = 0;
    }
  }

  // ------------------------------------------------------------ main update
  update(dt, intent) {
    const g = this.g;
    for (const k of ['Q', 'W', 'E', 'R', 'flash']) if (this.cd[k] > 0) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (let i = 0; i < 6; i++) if (this.itemCd[i] > 0) this.itemCd[i] = Math.max(0, this.itemCd[i] - dt);
    const b = this.buffs;
    let statsDirty = false;
    for (const k of Object.keys(b)) {
      if (b[k] > 0) {
        const before = b[k];
        b[k] = Math.max(0, b[k] - dt);
        if ((k === 'highlander' || k === 'prep' || k === 'lich') && (b[k] === 0 || k === 'prep')) statsDirty = true;
        if (k === 'highlander' && before > 0 && b[k] === 0) g.fx.ring(this.x, this.y, this.z, 1, 0.3, '#a5e424', 0.3);
      }
    }
    if (this.ds.t > 0) {
      this.ds.t -= dt;
      if (this.ds.t <= 0) this.ds.stacks = 0;
    }
    if (this.stacks.guinsooT > 0) {
      this.stacks.guinsooT -= dt;
      if (this.stacks.guinsooT <= 0 && this.stacks.guinsoo > 0) {
        this.stacks.guinsoo = 0;
        statsDirty = true;
      }
    }
    const raging = this.stacks.rage > this.g.time;
    if (raging !== !!this.wasRaging) {
      this.wasRaging = raging;
      statsDirty = true;
    }
    if (statsDirty) this.recompute();
    this.regen(dt);
    if (this.atk.cd > 0) this.atk.cd -= dt;
    if (this.atk.anim >= 0) {
      this.atk.anim += dt / this.atk.animDur;
      if (this.atk.anim > 1) this.atk.anim = -1;
    }
    if (this.cast) {
      this.cast.t += dt;
      if (this.cast.then && this.cast.t >= this.cast.at) {
        const fn = this.cast.then;
        this.cast.then = null;
        fn();
      }
      if (this.cast.t >= this.cast.dur) this.cast = null;
    }
    this.kit.update(dt, intent);
    g.items.tick(this, dt);
    if (this.downed) {
      this.speedNow = 0;
      return;
    }

    // level up hotkeys / clicks are handled by the game; casts here
    if (intent.levelUp) this.rankUp(intent.levelUp);
    if (intent.cast) {
      const r = this.tryCast(intent.cast, intent);
      // like League, a cast pressed during another cast's wind-up goes off right after it
      this.queued = r === 'casting' ? { key: intent.cast, aim: intent.aim ? { ...intent.aim } : null, t: 0.45 } : null;
    } else if (this.queued) {
      const q = this.queued;
      q.t -= dt;
      if (q.t <= 0) this.queued = null;
      else if (this.tryCast(q.key, { ...intent, aim: q.aim || intent.aim }) !== 'casting') this.queued = null;
    }
    if (intent.flash) this.tryFlash(intent);
    if (intent.item >= 0) g.items.activate(this, intent.item, intent);

    const busy = b.stasis > 0 || b.untargetable > 0 || (this.cast && this.cast.root && this.cast.t < this.cast.dur);
    // channels: moving cancels
    if (this.channel) {
      const moving = (intent.move && (intent.move.x || intent.move.z)) || intent.moveTo || intent.attackStart;
      if (moving && this.channel.t > this.channel.lock && (this.channel.max - this.channel.t > this.channel.endLock)) this.kit.endChannel('cancel');
    }
    const channelRoot = this.channel && this.channel.root;
    this.updateAttack(dt, intent, busy || channelRoot);
    let mx = 0, mz = 0;
    if (!busy && !channelRoot && this.atk.wind < 0) {
      if (intent.move && (intent.move.x || intent.move.z)) {
        mx = intent.move.x;
        mz = intent.move.z;
        this.moveTarget = null;
        this.attackOrder = null;
      } else if (intent.moveTo) {
        this.moveTarget = { x: intent.moveTo.x, z: intent.moveTo.z };
        this.attackOrder = null;
        g.planPath(this.moveTarget);
      }
      if (intent.stop) {
        this.moveTarget = null;
        this.attackOrder = null;
      }
      if (!mx && !mz && this.attackOrder && !this.attackOrder.dead && this.attackOrder.targetable) {
        const t = this.attackOrder;
        if (dist(this.x, this.z, t.x, t.z) > this.reach(t)) {
          const dir = g.pathDir(this.x, this.z, t.x, t.z);
          if (dir) {
            mx = dir.x;
            mz = dir.z;
          }
        }
      } else if (!mx && !mz && this.moveTarget) {
        const d = dist(this.x, this.z, this.moveTarget.x, this.moveTarget.z);
        if (d < 0.25) this.moveTarget = null;
        else {
          const dir = g.pathDir(this.x, this.z, this.moveTarget.x, this.moveTarget.z, true);
          if (dir) {
            mx = dir.x;
            mz = dir.z;
          } else this.moveTarget = null;
        }
      }
    }
    const sp = this.s.ms;
    const px = this.x, pz = this.z;
    if (mx || mz) {
      this.x += mx * sp * dt;
      this.z += mz * sp * dt;
      if (this.atk.wind < 0 && !this.cast) this.ang = turn(this.ang, Math.atan2(mz, mx), 14 * dt);
    }
    this.collide();
    this.keepSafe();
    const moved = Math.hypot(this.x - px, this.z - pz);
    this.speedNow = moved / Math.max(dt, 1e-4);
    this.y = g.grid.heightAt(this.x, this.z);
  }

  /** Never end a frame inside a wall or outside the building: fall back to the last good spot. */
  keepSafe() {
    const g = this.g;
    const cellOk = !g.grid.blockedAt(this.x, this.z) && !!g.map.roomAt(this.x, this.z);
    if (cellOk) {
      this.safeX = this.x;
      this.safeZ = this.z;
    } else if (this.safeX !== undefined) {
      this.x = this.safeX;
      this.z = this.safeZ;
    }
  }

  /** Validate a blink destination: somewhere you could have walked to. Returns {x,z} or null. */
  landing(x, z, maxR = 1.5) {
    return this.g.grid.nearestReachable(x, z, maxR, this.g.field, this.r);
  }

  collide() {
    const g = this.g;
    const ghost = this.buffs.highlander > 0 || this.buffs.prep > 0 || this.buffs.untargetable > 0;
    if (!ghost) {
      g.queryZombies(this.x, this.z, this.r + 0.6, (z) => {
        if (z.dead || !z.solid) return;
        const dx = this.x - z.x, dz = this.z - z.z;
        const min = this.r + z.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.85;
          this.x += (dx / d) * push;
          this.z += (dz / d) * push;
        }
      });
    }
    g.grid.resolve(this, this.r);
  }

  // ------------------------------------------------------------ basic attacks
  pickAttackTarget(intent) {
    const g = this.g;
    if (intent.attackTarget && !intent.attackTarget.dead) return intent.attackTarget;
    // nearest zombie within reach, preferring the one closest to the cursor
    let best = null, bd = Infinity;
    g.queryZombies(this.x, this.z, this.s.range + this.r + 1, (z) => {
      if (z.dead || !z.targetable) return;
      const d = dist(this.x, this.z, z.x, z.z);
      if (d > this.reach(z)) return;
      const score = intent.aim ? dist(intent.aim.x, intent.aim.z, z.x, z.z) * 0.6 + d : d;
      if (score < bd) {
        bd = score;
        best = z;
      }
    });
    return best;
  }

  updateAttack(dt, intent, blocked) {
    const a = this.atk;
    if (a.wind >= 0) {
      const t = a.target;
      if (blocked || !t || t.dead || !t.targetable || dist(this.x, this.z, t.x, t.z) > this.reach(t) + 0.8) {
        a.wind = -1;
        a.target = null;
        return;
      }
      this.ang = turn(this.ang, Math.atan2(t.z - this.z, t.x - this.x), 20 * dt);
      a.wind -= dt;
      if (a.wind < 0) this.landAttack(t);
      return;
    }
    if (blocked || a.cd > 0) return;
    let target = null;
    if (intent.attack) target = this.pickAttackTarget(intent);
    else if (this.attackOrder && !this.attackOrder.dead && this.attackOrder.targetable) {
      const t = this.attackOrder;
      if (dist(this.x, this.z, t.x, t.z) <= this.reach(t)) target = t;
    }
    if (!target) return;
    if (this.channel) this.kit.endChannel('attack');
    const period = 1 / this.s.as;
    a.windMax = period * this.def.windup;
    a.wind = a.windMax;
    a.target = target;
    a.side = -a.side;
    a.animDur = Math.max(0.16, Math.min(0.45, period * 0.75));
    a.anim = 0;
    a.cd = period;
    sfx.swing(this, this.id === 'yi' ? 0.8 : 1.15);
  }

  landAttack(z) {
    const g = this.g;
    this.lastHit = g.time;
    this.combatT = g.time;
    const strike = (target, mult, second) => {
      if (!target || target.dead) return;
      const crit = Math.random() < this.s.crit;
      let dmg = this.s.ad * mult * (crit ? this.s.critDmg : 1);
      const res = g.damage(target, dmg, { type: 'physical', src: 'attack', crit, onHit: 1, second });
      this.vamp(res.dealt, true);
      if (crit) g.fx.number(target.x, target.y, target.z, Math.round(res.dealt) + '!', '#ffb347', true);
      this.kit.onAttackHit(target, res, second);
      g.items.onHit(this, target, 1, { crit, attack: true });
      return res;
    };
    strike(z, 1, false);
    // Yi's Double Strike
    if (this.id === 'yi') {
      if (this.ds.stacks >= 3) {
        this.ds.stacks = 0;
        this.ds.t = 0;
        const t2 = z.dead ? g.nearestZombie(z.x, z.z, 3, (o) => o !== z) : z;
        if (t2) {
          strike(t2, 0.5, true);
          g.fx.slash(t2.x, t2.y + 1, t2.z, this.ang + Math.PI, 1.2, '#e7f59a', 0.16, true);
        }
      } else {
        this.ds.stacks = Math.min(3, this.ds.stacks + 1);
        this.ds.t = 4;
      }
      // Alpha Strike refund
      if (this.cd.Q > 0) this.cd.Q = Math.max(0, this.cd.Q - 1);
    }
    this.kit.afterAttack && this.kit.afterAttack(z);
    const colors = { yi: '#f7ff9c', katarina: '#ff6b7a', amumu: '#9ff0c8' };
    g.fx.slash(z.x, z.y + 1.0, z.z, this.ang, 1.1, colors[this.id], 0.15, this.atk.side < 0);
    g.items.onAttack(this, z);
  }

  // ------------------------------------------------------------ casting
  abilityReady(key) {
    if (this.ranks[key] <= 0) return 'rank';
    if (this.papBusy === key) return 'pap';
    if (this.downed) return 'down';
    if (this.buffs.stasis > 0) return 'stasis';
    if (this.buffs.untargetable > 0 && !(this.id === 'yi' && (key === 'E' || key === 'R'))) return 'busy';
    if (this.kit.ready) {
      const r = this.kit.ready(key);
      if (r) return r;
    } else if (this.cd[key] > 0) return 'cd';
    const cost = this.kit.cost(key);
    if (cost > this.mana) return 'mana';
    if (this.cast && this.cast.root && this.cast.t < this.cast.dur) return 'casting';
    return null;
  }

  /** Returns true when the ability went off, otherwise why it didn't ('cd', 'mana', 'casting', ...). */
  tryCast(key, intent) {
    const why = this.abilityReady(key);
    if (why) {
      if (why !== 'casting' && why !== 'busy') this.g.events.emit('castFail', key, why);
      return why;
    }
    if (this.channel && !(this.id === 'yi' && key !== 'W' && this.channel.kind === 'meditate' && (key === 'E' || key === 'R'))) {
      // casting something else interrupts a channel (except Yi's E/R during Meditate)
      if (!(this.id === 'amumu')) this.kit.endChannel('cast');
    }
    const ok = this.kit.cast(key, intent);
    if (ok) {
      this.mana -= this.kit.cost(key);
      this.combatT = this.g.time;
      this.g.items.onCast(this, key);
      this.g.events.emit('cast', key);
    } else this.g.events.emit('castFail', key, 'target');
    return ok || 'target';
  }

  tryFlash(intent) {
    if (this.cd.flash > 0 || this.downed || this.buffs.stasis > 0 || this.buffs.untargetable > 0) {
      if (this.cd.flash > 0) this.g.events.emit('castFail', 'flash', 'cd');
      return;
    }
    let aim = intent.aim;
    // cursor on (or right next to) the champion: full Flash the way you're facing
    if (!aim || Math.hypot(aim.x - this.x, aim.z - this.z) < 0.6) aim = { x: this.x + Math.cos(this.ang) * FLASH.range, z: this.z + Math.sin(this.ang) * FLASH.range };
    let dx = aim.x - this.x, dz = aim.z - this.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const range = Math.min(FLASH.range, l);
    const g = this.g;
    // Flash can hop thin walls: take the furthest free spot along the line
    let tx = this.x, tz = this.z;
    for (let d = range; d > 0.2; d -= 0.1) {
      const x = this.x + dx * d, z = this.z + dz * d;
      if (g.grid.circleFree(x, z, this.r) && g.flashAllowed(this.x, this.z, x, z)) {
        tx = x;
        tz = z;
        break;
      }
    }
    if (tx === this.x && tz === this.z) return;
    g.fx.burst(this.x, this.y + 1, this.z, 18, { color: '#fff2a8', speed: 3, life: 0.4, size: 0.2 });
    this.x = tx;
    this.z = tz;
    this.ang = Math.atan2(dz, dx);
    this.cd.flash = FLASH.cd;
    this.atk.wind = -1;
    if (this.channel) this.kit.endChannel('flash');
    g.fx.burst(this.x, this.y + 1, this.z, 22, { color: '#fff2a8', speed: 3.5, life: 0.5, size: 0.22 });
    sfx.flash(this);
    g.events.emit('cast', 'flash');
  }

  setCast(kind, dur, at, then, root = true) {
    this.cast = { kind, t: 0, dur, at, then, root };
  }

  /** Max Ammo: full mana and every ability cooldown refreshed (not Flash). */
  refill() {
    this.mana = this.maxMana;
    for (const k of ['Q', 'W', 'E', 'R']) this.cd[k] = 0;
    if (this.kit.refill) this.kit.refill();
  }

  onKill(z, opts) {
    this.kills++;
    this.kit.onKill(z, opts);
    this.g.items.onKill(this, z, opts);
  }

  isSpecial(z) {
    return z.kind === 'dog' || z.kind === 'nova';
  }

  /** Drop everything that goes when you go down. */
  onDowned() {
    this.channel && this.kit.endChannel('down');
    this.cast = null;
    this.queued = null;
    this.atk.wind = -1;
    this.buffs.highlander = 0;
    this.shield = 0;
    this.kit.onDowned && this.kit.onDowned();
  }

  dispose() {
    this.kit.dispose && this.kit.dispose();
  }
}

function turn(a, b, step) {
  const d = angDiff(b, a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
}

// =================================================================== kits
// Each kit: cost(key), cast(key, intent) -> bool, update(dt, intent), onAttackHit(z, res, second),
// onKill(z), endChannel(why), ready(key)?, reduce(dmg)?, refill()?, dispose()?

const daggerGeo = new THREE.ConeGeometry(0.06, 0.55, 6);
daggerGeo.rotateX(Math.PI / 2);
const bandGeo = new THREE.BoxGeometry(1, 0.06, 0.16);
bandGeo.translate(0.5, 0, 0);

/** Pick the zombie nearest the cursor within `range` of the champion (smart targeting). */
function targetNear(c, intent, range, filter, insideOnly = true) {
  const g = c.g;
  const aim = intent.aim || { x: c.x + Math.cos(c.ang) * 3, z: c.z + Math.sin(c.ang) * 3 };
  let best = null, bd = Infinity;
  g.queryZombies(c.x, c.z, range + 0.6, (z) => {
    if (z.dead || !z.targetable) return;
    if (insideOnly && !z.inside) return; // zombies still at a window can't be blinked to
    if (filter && !filter(z)) return;
    const d = dist(c.x, c.z, z.x, z.z);
    if (d > range + z.r) return;
    if (!g.grid.los(c.x, c.z, z.x, z.z)) return;
    const score = dist(aim.x, aim.z, z.x, z.z);
    if (score < bd) {
      bd = score;
      best = z;
    }
  });
  return best;
}

const KITS = {
  // ----------------------------------------------------------------- Katarina
  katarina(c) {
    const g = c.g;
    const daggers = []; // { x, z, y, land (time it lands), expire, mesh, shadow }
    const lastHitAt = new WeakMap();
    let lotusAcc = 0;
    const qDmg = () => [0, 80, 115, 150, 185, 220][c.ranks.Q] + 0.4 * c.s.ap;
    const daggerMat = new THREE.MeshStandardMaterial({ color: '#d9dde6', metalness: 0.85, roughness: 0.25, emissive: '#5a0010', emissiveIntensity: 0.6 });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ff3048', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
    const ringGeo = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);

    function dropDagger(x, z, airTime) {
      const free = g.grid.nearestOpen(x, z, 3) || { x: c.x, z: c.z };
      const mesh = new THREE.Mesh(daggerGeo, daggerMat);
      const ring = new THREE.Mesh(ringGeo, ringMat.clone());
      ring.scale.set(0.9, 1, 0.9);
      g.scene.add(mesh);
      g.scene.add(ring);
      const d = { x: free.x, z: free.z, y: g.grid.heightAt(free.x, free.z), land: g.time + airTime, expire: g.time + airTime + 4, mesh, ring, spin: rand(0, TAU) };
      daggers.push(d);
      return d;
    }
    function removeDagger(i) {
      const d = daggers[i];
      g.scene.remove(d.mesh);
      g.scene.remove(d.ring);
      d.ring.material.dispose();
      daggers.splice(i, 1);
    }
    function slashDamage() {
      const L = c.level;
      const apR = L >= 16 ? 1 : L >= 11 ? 0.9 : L >= 6 ? 0.8 : 0.7;
      return KAT_DAGGER_DMG[L - 1] + 0.6 * c.s.bonusAD + apR * c.s.ap;
    }
    function pickup(i) {
      const d = daggers[i];
      const dmg = slashDamage();
      g.queryZombies(d.x, d.z, 3.4, (z) => {
        if (z.dead || !z.targetable) return;
        if (dist(d.x, d.z, z.x, z.z) > 3.4 + z.r) return;
        hit(z, dmg, 'P', 1);
      });
      g.fx.ring(d.x, d.y, d.z, 0.5, 3.4, '#ff2848', 0.35, 0.9);
      g.fx.disc(d.x, d.y, d.z, 3.4, '#b0102a', 0.3, 0.3);
      for (let k = 0; k < 3; k++) g.fx.slash(d.x, d.y + 0.9, d.z, (k / 3) * TAU, 2.6, '#ff3a55', 0.22, k % 2 === 1);
      sfx.blade(d, 0.8);
      sfx.dagger(d);
      // Shunpo refund: 78/84/90/96% of its total cooldown
      const L = c.level;
      const pct = L >= 16 ? 0.96 : L >= 11 ? 0.9 : L >= 6 ? 0.84 : 0.78;
      c.cd.E = Math.max(0, c.cd.E - c.cdMax.E * pct);
      c.combatT = g.time;
      removeDagger(i);
    }
    function hit(z, dmg, key, onHit) {
      lastHitAt.set(z, g.time);
      const papMult = key !== 'P' && c.pap[key] ? 2 : 1;
      const res = g.damage(z, dmg * papMult, { type: 'magic', src: key === 'P' ? 'passive' : 'ability', ability: key, onHit });
      c.vamp(res.dealt, false);
      if (onHit > 0) g.items.onHit(c, z, onHit, { ability: true });
      g.items.onAbilityDamage(c, z, res, key);
      return res;
    }

    const kit = {
      daggers,
      cost: () => 0,
      ready(key) {
        return c.cd[key] > 0 ? 'cd' : null;
      },
      cast(key, intent) {
        if (key === 'Q') {
          const t = targetNear(c, intent, 6.25);
          if (!t) return false;
          c.ang = Math.atan2(t.z - c.z, t.x - c.x);
          c.setCast('throw', 0.32, 0.25, () => throwBlade(t), true);
          c.cd.Q = c.cdMax.Q = c.haste([0, 11, 10, 9, 8, 7][c.ranks.Q]);
          return true;
        }
        if (key === 'W') {
          const n = c.pap.W ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + c.ang;
            const off = n > 1 ? 1.4 : 0;
            dropDagger(c.x + Math.cos(a) * off, c.z + Math.sin(a) * off, 1.25);
          }
          c.buffs.prep = 1.25;
          c.recompute();
          c.setCast('toss', 0.3, 0, null, false);
          c.cd.W = c.cdMax.W = c.haste([0, 15, 14, 13, 12, 11][c.ranks.W]);
          sfx.dagger(c);
          g.fx.burst(c.x, c.y + 1.2, c.z, 10, { color: '#ff6b7a', speed: 2, life: 0.4, size: 0.15, lift: 3 });
          return true;
        }
        if (key === 'E') return shunpo(intent);
        if (key === 'R') {
          c.channel = { kind: 'lotus', t: 0, max: 2.5, lock: 0.25, endLock: 0.25, root: true };
          lotusAcc = 0;
          c.cd.R = c.cdMax.R = c.haste([0, 75, 60, 45][c.ranks.R]);
          c.atk.wind = -1;
          sfx.lotus(c);
          return true;
        }
        return false;
      },
      update(dt) {
        // daggers: fall, then wait to be picked up, then fade
        for (let i = daggers.length - 1; i >= 0; i--) {
          const d = daggers[i];
          const air = d.land - g.time;
          d.spin += dt * (air > 0 ? 14 : 0);
          const h = air > 0 ? 0.3 + air * 4.2 : 0.18;
          d.mesh.position.set(d.x, d.y + h, d.z);
          d.mesh.rotation.set(air > 0 ? d.spin : -1.25, d.spin * 0.3, 0);
          d.ring.position.set(d.x, d.y + 0.05, d.z);
          d.ring.material.opacity = air > 0 ? 0.25 + 0.25 * Math.sin(g.time * 20) : 0.55;
          if (air <= 0 && !d.landed) {
            d.landed = true;
            sfx.clink(d);
            g.fx.sparks(d.x, d.y + 0.2, d.z, 6, '#ffb0b8');
          }
          if (g.time >= d.expire) {
            removeDagger(i);
            continue;
          }
          if (air <= 0 && !c.downed && dist(c.x, c.z, d.x, d.z) < 1.0 + c.r) pickup(i);
        }
        // Death Lotus channel
        const ch = c.channel;
        if (ch && ch.kind === 'lotus') {
          ch.t += dt;
          lotusAcc += dt;
          while (lotusAcc >= 0.166) {
            lotusAcc -= 0.166;
            const n = c.pap.R ? 6 : 3;
            const targets = g.nearestZombies(c.x, c.z, 5.5, n);
            for (const z of targets) lotusDagger(z);
          }
          if (ch.t >= ch.max) kit.endChannel('done');
        }
      },
      endChannel() {
        if (c.channel && c.channel.kind === 'lotus') c.channel = null;
      },
      onAttackHit(z) {
        lastHitAt.set(z, g.time);
      },
      onKill(z) {
        const t = lastHitAt.get(z);
        if (t === undefined || g.time - t > 3) return;
        const cut = c.isSpecial(z) ? 15 : 1;
        for (const k of ['Q', 'W', 'E', 'R']) c.cd[k] = Math.max(0, c.cd[k] - cut);
        if (cut >= 15) g.fx.ring(c.x, c.y, c.z, 0.5, 2, '#ff3048', 0.4);
      },
      refill() {},
      onDowned() {},
      dispose() {
        for (let i = daggers.length - 1; i >= 0; i--) removeDagger(i);
        daggerMat.dispose();
        ringMat.dispose();
      },
    };

    function throwBlade(first) {
      if (first.dead) {
        const alt = g.nearestZombie(c.x, c.z, 6.5);
        if (!alt) return;
        first = alt;
      }
      const bounces = c.pap.Q ? 7 : 2;
      const chain = [first];
      let cur = first;
      for (let i = 0; i < bounces; i++) {
        let best = null, bd = Infinity;
        g.queryZombies(cur.x, cur.z, 4.5, (z) => {
          if (z.dead || !z.targetable || chain.includes(z)) return;
          const d = dist(cur.x, cur.z, z.x, z.z);
          if (d < bd && d <= 4.5 + z.r) {
            bd = d;
            best = z;
          }
        });
        if (!best) break;
        chain.push(best);
        cur = best;
      }
      const dmg = qDmg();
      // projectile hops: first flight at 16 m/s, then 0.15 s per bounce
      const fly = dist(c.x, c.z, first.x, first.z) / 16;
      const mesh = new THREE.Mesh(daggerGeo, daggerMat);
      g.scene.add(mesh);
      let from = { x: c.x, y: c.y + 1.1, z: c.z };
      let leg = 0, t = 0;
      const legs = chain.map((z, i) => ({ z, dur: i === 0 ? Math.max(0.05, fly) : 0.15 }));
      sfx.dagger(c);
      g.addTask((dt) => {
        if (leg >= legs.length) {
          g.scene.remove(mesh);
          return false;
        }
        const L = legs[leg];
        t += dt;
        const p = Math.min(1, t / L.dur);
        const tz = L.z;
        mesh.position.set(from.x + (tz.x - from.x) * p, from.y + Math.sin(p * Math.PI) * 0.6, from.z + (tz.z - from.z) * p);
        mesh.rotation.y = -Math.atan2(tz.z - from.z, tz.x - from.x) + Math.PI / 2;
        mesh.rotation.x += dt * 30;
        if (p >= 1) {
          if (!tz.dead) hit(tz, dmg, 'Q', 0);
          g.fx.sparks(tz.x, tz.y + 1, tz.z, 8, '#ff8090');
          sfx.clink(tz);
          from = { x: tz.x, y: tz.y + 1.1, z: tz.z };
          leg++;
          t = 0;
        }
        return true;
      });
      // the blade lands 3.5 m past the first target, 1 s after the first hit
      const ax = first.x - c.x, az = first.z - c.z;
      const al = Math.hypot(ax, az) || 1;
      const lx = first.x + (ax / al) * 3.5 + rand(-0.4, 0.4);
      const lz = first.z + (az / al) * 3.5 + rand(-0.4, 0.4);
      const land = g.grid.castFree(first.x, first.z, ax / al, az / al, 3.5, 0.3);
      const dx = land.x || lx, dz = land.z || lz;
      dropDagger(dx, dz, fly + 1.0);
    }

    function shunpo(intent) {
      const range = 7.25;
      const aim = intent.aim || { x: c.x + Math.cos(c.ang) * 4, z: c.z + Math.sin(c.ang) * 4 };
      // daggers first (closest to the cursor), then zombies
      let tgt = null, bd = Infinity;
      for (const d of daggers) {
        const dc = dist(c.x, c.z, d.x, d.z);
        if (dc > 7.75) continue;
        const s = dist(aim.x, aim.z, d.x, d.z);
        if (s < bd && s < 3) {
          bd = s;
          tgt = { dagger: d, x: d.x, z: d.z };
        }
      }
      if (!tgt) {
        const z = targetNear(c, intent, range);
        if (z) tgt = { zombie: z, x: z.x, z: z.z };
      }
      if (!tgt) return false;
      let tx = tgt.x, tz = tgt.z;
      if (tgt.zombie) {
        // land next to the zombie, on the cursor's side (or the near side if the cursor is on it)
        let ax = aim.x - tgt.x, az = aim.z - tgt.z;
        if (Math.hypot(ax, az) < 0.3) {
          ax = c.x - tgt.x;
          az = c.z - tgt.z;
        }
        const l = Math.hypot(ax, az) || 1;
        const off = tgt.zombie.r + c.r + 0.1;
        tx = tgt.x + (ax / l) * off;
        tz = tgt.z + (az / l) * off;
      }
      const spot = c.landing(tx, tz, 1.5);
      if (!spot) return false;
      tx = spot.x;
      tz = spot.z;
      g.fx.streak(c.x, c.y, c.z, tx, g.grid.heightAt(tx, tz), tz, '#ff3048', 0.3, 0.25);
      g.fx.burst(c.x, c.y + 1, c.z, 12, { color: '#ff3048', speed: 2.5, life: 0.35, size: 0.2 });
      c.x = tx;
      c.z = tz;
      c.y = g.grid.heightAt(tx, tz);
      c.atk.wind = -1;
      c.atk.cd = 0; // resets the basic attack timer
      // the cooldown starts before the hit lands, so a Shunpo kill still gets Voracity's refund
      c.cd.E = c.cdMax.E = c.haste([0, 12, 11, 10, 9, 8][c.ranks.E]);
      sfx.blink(c);
      const eDmg = [0, 20, 30, 40, 50, 60][c.ranks.E] + 0.4 * c.s.ad + 0.25 * c.s.ap;
      if (c.pap.E) {
        g.queryZombies(c.x, c.z, 2.5, (z) => {
          if (!z.dead && z.targetable && dist(c.x, c.z, z.x, z.z) <= 2.5 + z.r) hit(z, eDmg, 'E', 1);
        });
      } else {
        const near = g.nearestZombie(c.x, c.z, 4);
        if (near) {
          hit(near, eDmg, 'E', 1);
          c.ang = Math.atan2(near.z - c.z, near.x - c.x);
        }
      }
      g.fx.slash(c.x, c.y + 1, c.z, c.ang, 1.6, '#ff3048', 0.2);
      c.setCast('dash', 0.15, 0, null, true);
      // arriving on a landed dagger picks it up immediately
      for (let i = daggers.length - 1; i >= 0; i--) {
        const d = daggers[i];
        if (d.land <= g.time && dist(c.x, c.z, d.x, d.z) < 1.0 + c.r) pickup(i);
      }
      return true;
    }

    function lotusDagger(z) {
      const mag = [0, 25, 37.5, 50][c.ranks.R] + 0.19 * c.s.ap;
      const phys = 0.16 * c.s.bonusAD * (1 + 3.125 * (c.s.bonusAS / 100));
      const mult = c.pap.R ? 2 : 1;
      const eff = [0, 0.25, 0.3, 0.35][c.ranks.R];
      lastHitAt.set(z, g.time);
      const r1 = g.damage(z, mag * mult, { type: 'magic', src: 'ability', ability: 'R', onHit: eff });
      if (phys > 0 && !z.dead) g.damage(z, phys * mult, { type: 'physical', src: 'ability', ability: 'R', noHitPoints: true });
      g.items.onHit(c, z, eff, { ability: true });
      g.items.onAbilityDamage(c, z, r1, 'R');
      g.fx.streak(c.x, c.y + 0.4, c.z, z.x, z.y + 0.4, z.z, '#ff2a4a', 0.07, 0.12);
      if (Math.random() < 0.3) sfx.lotus(c);
    }

    return kit;
  },

  // ----------------------------------------------------------------- Master Yi
  yi(c) {
    const g = c.g;
    let alpha = null; // { marks, left, timer, main, hitCount: Map, ox, oz }
    let medTick = 0;
    const kit = {
      cost(key) {
        if (key === 'Q') return [0, 50, 55, 60, 65, 70][c.ranks.Q];
        if (key === 'W') return 40;
        if (key === 'R') return 100;
        return 0;
      },
      ready(key) {
        return c.cd[key] > 0 ? 'cd' : null;
      },
      meditateDR() {
        if (!c.channel || c.channel.kind !== 'meditate') return 0.5 * 0;
        if (c.pap.W) return 0.9;
        return c.channel.t < 0.5 ? 0.7 : [0, 0.45, 0.475, 0.5, 0.525, 0.55][c.ranks.W];
      },
      cast(key, intent) {
        if (key === 'Q') {
          const t = targetNear(c, intent, 6);
          if (!t) return false;
          const marks = c.pap.Q ? 8 : 4;
          alpha = { marks, done: 0, timer: 0, main: t, hits: new Map(), aim: intent.aim ? { ...intent.aim } : null, ox: c.x, oz: c.z };
          c.buffs.untargetable = 0.2 * marks + 0.29;
          c.atk.wind = -1;
          c.cd.Q = c.cdMax.Q = c.haste([0, 20, 19.5, 19, 18.5, 18][c.ranks.Q]);
          g.fx.burst(c.x, c.y + 1, c.z, 20, { color: '#b2ca1d', speed: 3, life: 0.35, size: 0.22 });
          sfx.alpha(c);
          c.vanished = true;
          return true;
        }
        if (key === 'W') {
          c.channel = { kind: 'meditate', t: 0, max: 4, lock: 0.25, endLock: 0, root: true };
          c.buffs.medDR = 4.5;
          medTick = 0;
          c.atk.wind = -1;
          c.atk.cd = 0;
          c.cd.W = c.cdMax.W = c.haste(10);
          sfx.meditate(c);
          return true;
        }
        if (key === 'E') {
          c.buffs.wuju = 5;
          c.cd.E = c.cdMax.E = c.haste(14);
          sfx.wuju(c);
          g.fx.ring(c.x, c.y, c.z, 0.3, 1.6, '#49d6bc', 0.4);
          return true;
        }
        if (key === 'R') {
          c.buffs.highlander = c.pap.R ? 10 : 7;
          c.recompute();
          c.cd.R = c.cdMax.R = c.haste(85);
          sfx.highlander(c);
          g.fx.ring(c.x, c.y, c.z, 0.4, 3, '#a5e424', 0.6);
          g.fx.burst(c.x, c.y + 1, c.z, 30, { color: '#d6ff6a', speed: 4, life: 0.6, size: 0.2, lift: 1 });
          return true;
        }
        return false;
      },
      update(dt) {
        // E and R durations pause during Alpha Strike and Meditate
        if (alpha || (c.channel && c.channel.kind === 'meditate')) {
          if (c.buffs.wuju > 0) c.buffs.wuju += dt;
          if (c.buffs.highlander > 0) c.buffs.highlander += dt;
        }
        if (alpha) stepAlpha(dt);
        const ch = c.channel;
        if (ch && ch.kind === 'meditate') {
          ch.t += dt;
          c.buffs.medDR = 0.5; // lingers 0.5 s after the channel
          // 6% max mana per second
          c.mana = Math.max(0, c.mana - c.maxMana * 0.06 * dt);
          medTick += dt;
          while (medTick >= 0.5) {
            medTick -= 0.5;
            const missing = 1 - c.hp / c.maxHp;
            const amp = 1 + Math.min(1, missing);
            const heal = ([0, 15, 25, 35, 45, 55][c.ranks.W] + 0.125 * c.s.ap) * amp * (c.pap.W ? 2 : 1);
            const h = c.heal(heal);
            if (h > 0) g.fx.number(c.x, c.y, c.z, '+' + Math.round(h), '#7dff9a');
          }
          // a Double Strike stack per second
          if (Math.floor(ch.t) !== Math.floor(ch.t - dt)) {
            c.ds.stacks = Math.min(3, c.ds.stacks + 1);
            c.ds.t = 4;
          }
          if (Math.random() < dt * 8) g.fx.burst(c.x, c.y + 0.8, c.z, 2, { color: '#d6ff6a', speed: 0.6, life: 1, size: 0.18, lift: 1.4 });
          if (ch.t >= ch.max || c.mana <= 0) kit.endChannel('done');
        }
      },
      endChannel(why) {
        if (c.channel && c.channel.kind === 'meditate') {
          c.channel = null;
          c.buffs.medDR = 0.5;
          if (c.pap.W && why !== 'down') {
            // Transcendence: a shockwave when it ends
            g.fx.ring(c.x, c.y, c.z, 0.5, 4, '#d6ff6a', 0.5);
            g.queryZombies(c.x, c.z, 4, (z) => {
              if (z.dead || !z.targetable) return;
              if (dist(c.x, c.z, z.x, z.z) > 4 + z.r) return;
              g.damage(z, 100 + c.s.ad, { type: 'physical', src: 'ability', ability: 'W' });
              g.cc(z, 'stun', 0.75);
            });
          }
        }
      },
      onAttackHit(z, res, second) {
        if (c.buffs.wuju > 0 && !z.dead) {
          const tdmg = ([0, 20, 25, 30, 35, 40][c.ranks.E] + 0.35 * c.s.bonusAD) * (c.pap.E ? 2 : 1);
          g.damage(z, tdmg, { type: 'true', src: 'ability', ability: 'E', noHitPoints: true });
          if (c.pap.E) {
            g.queryZombies(z.x, z.z, 2, (o) => {
              if (o === z || o.dead || !o.targetable) return;
              if (dist(z.x, z.z, o.x, o.z) <= 2 + o.r) g.damage(o, tdmg, { type: 'true', src: 'ability', ability: 'E', noHitPoints: true });
            });
          }
          g.fx.sparks(z.x, z.y + 1, z.z, 5, '#49d6bc');
        }
      },
      onKill(z) {
        if (c.ranks.R <= 0) return;
        if (c.isSpecial(z)) {
          for (const k of ['Q', 'W', 'E']) c.cd[k] *= 0.3;
          if (c.buffs.highlander > 0) c.buffs.highlander += 7;
        } else if (c.buffs.highlander > 0) c.buffs.highlander += 1;
      },
      refill() {},
      onDowned() {
        alpha = null;
        c.vanished = false;
        c.buffs.untargetable = 0;
      },
      dispose() {},
    };

    function stepAlpha(dt) {
      alpha.timer -= dt;
      if (alpha.timer > 0) return;
      if (alpha.done >= alpha.marks) {
        // reappear 0.75 m from the main target, towards the cursor
        const m = alpha.main;
        const mx = m.dead ? alpha.lastX : m.x, mz = m.dead ? alpha.lastZ : m.z;
        let ax = (alpha.aim ? alpha.aim.x : alpha.ox) - mx, az = (alpha.aim ? alpha.aim.z : alpha.oz) - mz;
        const l = Math.hypot(ax, az) || 1;
        let tx = mx + (ax / l) * (0.75 + c.r), tz = mz + (az / l) * (0.75 + c.r);
        const o = c.landing(tx, tz, 2) || { x: alpha.ox, z: alpha.oz };
        tx = o.x;
        tz = o.z;
        c.x = tx;
        c.z = tz;
        c.y = g.grid.heightAt(tx, tz);
        c.vanished = false;
        c.buffs.untargetable = 0;
        g.fx.burst(c.x, c.y + 1, c.z, 20, { color: '#b2ca1d', speed: 3, life: 0.4, size: 0.22 });
        alpha = null;
        return;
      }
      alpha.timer = 0.2;
      // mark the main target first, then the nearest unmarked zombie within 6 m
      let tgt = null;
      if (alpha.done === 0 && !alpha.main.dead) tgt = alpha.main;
      else {
        const cx = alpha.lastX ?? alpha.ox, cz = alpha.lastZ ?? alpha.oz;
        let bd = Infinity;
        g.queryZombies(cx, cz, 6, (z) => {
          if (z.dead || !z.targetable || !z.inside || alpha.hits.has(z)) return;
          const d = dist(cx, cz, z.x, z.z);
          if (d < bd && d <= 6) {
            bd = d;
            tgt = z;
          }
        });
        if (!tgt) {
          // fewer zombies than marks: the spare strikes go round the ones already hit
          let fewest = Infinity;
          for (const [z, n] of alpha.hits) {
            if (z.dead || n >= fewest) continue;
            fewest = n;
            tgt = z;
          }
        }
      }
      alpha.done++;
      if (!tgt) return;
      const again = alpha.hits.has(tgt);
      alpha.hits.set(tgt, (alpha.hits.get(tgt) || 0) + 1);
      alpha.lastX = tgt.x;
      alpha.lastZ = tgt.z;
      const r = c.ranks.Q;
      let dmg = again ? [0, 5, 10, 15, 20, 25][r] + 0.175 * c.s.ad : [0, 20, 40, 60, 80, 100][r] + 0.7 * c.s.ad;
      dmg += [0, 60, 85, 110, 135, 160][r] * (again ? 0.25 : 1); // zombies count as monsters
      if (c.pap.Q) dmg *= 2;
      const crit = Math.random() < c.s.crit;
      if (crit) dmg *= c.s.critDmg;
      const res = g.damage(tgt, dmg, { type: 'physical', src: 'ability', ability: 'Q', crit, onHit: 0.75 });
      c.vamp(res.dealt, false);
      g.items.onHit(c, tgt, 0.75, { ability: true, crit });
      // ghost image + slash at the target (the camera follows Yi between strikes)
      const ghost = c.landing(tgt.x + rand(-0.6, 0.6), tgt.z + rand(-0.6, 0.6), 1.2);
      if (ghost) {
        c.x = ghost.x;
        c.z = ghost.z;
      }
      g.fx.slash(tgt.x, tgt.y + 1, tgt.z, rand(0, TAU), 1.4, '#c8ff40', 0.2);
      g.fx.slash(tgt.x, tgt.y + 1.1, tgt.z, rand(0, TAU), 1.2, '#ffffb0', 0.2, true);
      g.fx.burst(tgt.x, tgt.y + 1, tgt.z, 8, { color: '#d6ff6a', speed: 3, life: 0.3, size: 0.16 });
      sfx.blade(tgt, 1.3);
    }
    return kit;
  },

  // ----------------------------------------------------------------- Amumu
  amumu(c) {
    const g = c.g;
    const q = { n: 2, max: 2, t: 0, lock: 0 };
    let despair = false;
    let despTick = 0;
    let bandage = null; // flying projectile
    let pull = null; // { z, sx, sz, t, dur }
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.2, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#66d4c7', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    aura.renderOrder = 16;
    g.scene.add(aura);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#9fcbaa', roughness: 0.9, emissive: '#1e5c44', emissiveIntensity: 0.5 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.visible = false;
    g.scene.add(band);

    const qCharge = () => [0, 16, 15, 14, 13, 12][c.ranks.Q];
    const qMax = () => (c.pap.Q ? 3 : 2);
    const kit = {
      q,
      get despair() {
        return despair;
      },
      onRankQ() {
        if (c.ranks.Q === 1) {
          q.n = qMax();
          q.t = 0;
        }
      },
      cost(key) {
        if (key === 'Q') return 50;
        if (key === 'W') return 0;
        if (key === 'E') return 35;
        if (key === 'R') return [0, 100, 150, 200][c.ranks.R];
        return 0;
      },
      ready(key) {
        if (key === 'Q') return q.n <= 0 ? 'cd' : q.lock > 0 ? 'cd' : pull || bandage ? 'busy' : null;
        if (key === 'W') return c.cd.W > 0 ? 'cd' : !despair && c.mana < 8 ? 'mana' : null;
        return c.cd[key] > 0 ? 'cd' : null;
      },
      reduce(dmg) {
        if (c.ranks.E <= 0) return dmg;
        let flat = [0, 20, 28, 36, 44, 52][c.ranks.E] + 0.03 * c.s.bonusArmor * 4;
        if (c.pap.E) flat *= 2;
        const cut = Math.min(flat, dmg * 0.5);
        // every bite cuts Tantrum's cooldown by 0.75 s
        c.cd.E = Math.max(0, c.cd.E - 0.75);
        return dmg - cut;
      },
      cast(key, intent) {
        if (key === 'Q') {
          const aim = intent.aim || { x: c.x + Math.cos(c.ang), z: c.z + Math.sin(c.ang) };
          let dx = aim.x - c.x, dz = aim.z - c.z;
          const l = Math.hypot(dx, dz) || 1;
          dx /= l;
          dz /= l;
          c.ang = Math.atan2(dz, dx);
          q.n--;
          q.lock = 3;
          if (q.t <= 0) q.t = c.haste(qCharge());
          c.setCast('throw', 0.3, 0.25, () => {
            bandage = { x: c.x, z: c.z, dx, dz, travelled: 0, width: c.pap.Q ? 2.4 : 1.6 };
            band.visible = true;
            sfx.whip(c);
          });
          return true;
        }
        if (key === 'W') {
          despair = !despair;
          c.cd.W = 1;
          despTick = 0;
          if (despair) sfx.sob(c);
          return true;
        }
        if (key === 'E') {
          c.setCast('slam', 0.3, 0.25, () => {
            const R = c.pap.E ? 5 : 3.5;
            const dmg = ([0, 65, 95, 125, 155, 185][c.ranks.E] + 0.5 * c.s.ap) * (c.pap.E ? 2 : 1);
            g.queryZombies(c.x, c.z, R, (z) => {
              if (z.dead || !z.targetable || dist(c.x, c.z, z.x, z.z) > R + z.r) return;
              const res = g.damage(z, dmg, { type: 'magic', src: 'ability', ability: 'E' });
              g.items.onAbilityDamage(c, z, res, 'E');
              c.vamp(res.dealt, false);
            });
            g.fx.ring(c.x, c.y, c.z, 0.5, R, '#d1a346', 0.35, 0.9);
            g.fx.disc(c.x, c.y, c.z, R, '#cda02a', 0.35, 0.25);
            g.fx.burst(c.x, c.y + 0.3, c.z, 30, { color: '#e8c070', speed: 5, life: 0.5, size: 0.3, up: 0.3, smoke: true, alpha: 0.6 });
            g.shake(0.15);
            sfx.tantrum(c);
          });
          c.cd.E = c.cdMax.E = c.haste([0, 9, 8, 7, 6, 5][c.ranks.E]);
          return true;
        }
        if (key === 'R') {
          c.setCast('spread', 0.45, 0.25, () => {
            const R = c.pap.R ? 8 : 5.5;
            const dmg = ([0, 200, 300, 400][c.ranks.R] + 0.8 * c.s.ap) * (c.pap.R ? 2 : 1);
            const stun = c.pap.R ? 2.5 : 1.5;
            g.queryZombies(c.x, c.z, R, (z) => {
              if (z.dead || !z.targetable || dist(c.x, c.z, z.x, z.z) > R + z.r) return;
              const res = g.damage(z, dmg, { type: 'magic', src: 'ability', ability: 'R' });
              g.items.onAbilityDamage(c, z, res, 'R');
              c.vamp(res.dealt, false);
              if (!z.dead) {
                g.cc(z, 'knock', 0.3);
                g.cc(z, 'stun', stun);
                g.curse(z, 3);
              }
              g.fx.streak(c.x, c.y + 0.4, c.z, z.x, z.y + 0.6, z.z, '#9fcbaa', 0.12, 0.6);
            });
            g.fx.ring(c.x, c.y, c.z, 0.5, R, '#41dbaf', 0.6, 0.9);
            g.fx.ring(c.x, c.y, c.z, 0.5, R * 0.8, '#d1a346', 0.7, 0.6);
            g.fx.disc(c.x, c.y, c.z, R, '#1e5c44', 0.6, 0.35);
            g.fx.burst(c.x, c.y + 0.6, c.z, 50, { color: '#9ff0c8', speed: 7, life: 0.6, size: 0.25, up: 0.2 });
            g.shake(0.3);
            sfx.curse(c);
          });
          c.cd.R = c.cdMax.R = c.haste([0, 150, 125, 100][c.ranks.R]);
          return true;
        }
        return false;
      },
      update(dt) {
        // Q charges
        if (q.lock > 0) q.lock -= dt;
        if (c.ranks.Q > 0 && q.n < qMax()) {
          if (q.t <= 0) q.t = c.haste(qCharge());
          q.t -= dt;
          if (q.t <= 0) {
            q.n++;
            q.t = q.n < qMax() ? c.haste(qCharge()) : 0;
          }
        } else q.t = 0;
        c.cd.Q = q.n > 0 ? Math.max(0, q.lock) : q.t;
        c.cdMax.Q = q.n > 0 ? 3 : c.haste(qCharge());
        // bandage in flight
        if (bandage) {
          const step = 20 * dt;
          const b = bandage;
          let hitZ = null;
          for (let s = 0; s < step && !hitZ; s += 0.25) {
            b.x += b.dx * Math.min(0.25, step - s);
            b.z += b.dz * Math.min(0.25, step - s);
            b.travelled += Math.min(0.25, step - s);
            if (g.grid.blockedAt(b.x, b.z)) {
              b.travelled = 99;
              break;
            }
            g.queryZombies(b.x, b.z, b.width / 2 + 0.5, (z) => {
              if (hitZ || z.dead || !z.targetable) return;
              if (dist(b.x, b.z, z.x, z.z) <= b.width / 2 + z.r) hitZ = z;
            });
          }
          band.position.set(c.x, c.y + 0.8, c.z);
          band.rotation.y = -Math.atan2(b.z - c.z, b.x - c.x);
          band.scale.set(Math.max(0.1, dist(c.x, c.z, b.x, b.z)), 1, b.width / 1.6);
          if (hitZ) {
            const dmg = ([0, 70, 95, 120, 145, 170][c.ranks.Q] + 0.85 * c.s.ap) * (c.pap.Q ? 2 : 1);
            const res = g.damage(hitZ, dmg, { type: 'magic', src: 'ability', ability: 'Q', skillshot: true });
            g.items.onAbilityDamage(c, hitZ, res, 'Q');
            c.vamp(res.dealt, false);
            if (!hitZ.dead) g.cc(hitZ, 'stun', c.pap.Q ? 2 : 1);
            sfx.thud(hitZ);
            g.fx.burst(hitZ.x, hitZ.y + 1, hitZ.z, 12, { color: '#9ff0c8', speed: 3, life: 0.4, size: 0.2 });
            pull = { z: hitZ, sx: c.x, sz: c.z, tx: hitZ.x, tz: hitZ.z, t: 0, dur: Math.max(0.12, dist(c.x, c.z, hitZ.x, hitZ.z) / 18) };
            bandage = null;
          } else if (b.travelled >= 11) {
            bandage = null;
            band.visible = false;
          }
        }
        if (pull) {
          pull.t += dt;
          const p = Math.min(1, pull.t / pull.dur);
          const tz = pull.z;
          const tx = tz.dead ? pull.tx : tz.x, tzz = tz.dead ? pull.tz : tz.z;
          const dx = tx - pull.sx, dz = tzz - pull.sz;
          const l = Math.hypot(dx, dz) || 1;
          const stop = Math.max(0, l - (c.r + tz.r + 0.1));
          c.x = pull.sx + (dx / l) * stop * p;
          c.z = pull.sz + (dz / l) * stop * p;
          c.buffs.untargetable = 0; // dashing, but hittable
          band.visible = true;
          band.position.set(c.x, c.y + 0.8, c.z);
          band.rotation.y = -Math.atan2(tzz - c.z, tx - c.x);
          band.scale.set(Math.max(0.05, dist(c.x, c.z, tx, tzz)), 1, 1);
          if (p >= 1) {
            pull = null;
            band.visible = false;
            c.atk.cd = 0;
            c.atk.wind = -1;
            if (!tz.dead) c.attackOrder = tz;
          }
        }
        // Despair
        if (despair) {
          const cost = 8 * dt;
          if (c.mana < cost || c.downed) {
            despair = false;
          } else {
            c.mana -= cost;
            despTick += dt;
            const R = c.pap.W ? 5 : 3.5;
            while (despTick >= 0.5) {
              despTick -= 0.5;
              const pct = ([0, 0.5, 0.625, 0.75, 0.875, 1][c.ranks.W] + 0.25 * (c.s.ap / 100)) / 100;
              g.queryZombies(c.x, c.z, R, (z) => {
                if (z.dead || !z.targetable || dist(c.x, c.z, z.x, z.z) > R + z.r) return;
                const dmg = (5 + pct * z.maxHp) * (c.pap.W ? 2 : 1);
                if (z.curse > 0) g.curse(z, 3);
                const res = g.damage(z, dmg, { type: 'magic', src: 'dot', ability: 'W' });
                g.items.onAbilityDamage(c, z, res, 'W');
                c.vamp(res.dealt, false);
              });
              c.combatT = g.time;
            }
          }
        }
        aura.position.set(c.x, c.y + 0.07, c.z);
        const R = c.pap.W ? 5 : 3.5;
        aura.scale.set(R, 1, R);
        aura.material.opacity += ((despair ? 0.22 + 0.06 * Math.sin(g.time * 3) : 0) - aura.material.opacity) * Math.min(1, dt * 8);
        aura.visible = aura.material.opacity > 0.01;
        if (despair && Math.random() < dt * 14) {
          const a = rand(0, TAU), d = rand(0.3, R);
          g.fx.smoke.spawn(c.x + Math.cos(a) * d, c.y + 0.2, c.z + Math.sin(a) * d, 0, rand(0.3, 0.8), 0, 1.2, 0.35, 0.4, 0.83, 0.78, 0.35, 0, 0.5, 0.5);
        }
      },
      endChannel() {},
      onAttackHit(z) {
        if (!z.dead) g.curse(z, 3);
      },
      onKill() {},
      refill() {
        q.n = qMax();
        q.t = 0;
        q.lock = 0;
      },
      onDowned() {
        despair = false;
        bandage = null;
        pull = null;
        band.visible = false;
      },
      dispose() {
        g.scene.remove(aura);
        g.scene.remove(band);
        aura.material.dispose();
        bandMat.dispose();
      },
    };
    return kit;
  },
};

export { KITS };
