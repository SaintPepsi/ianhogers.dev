// League items, as the Mystery Box and wall chalk hand them out. Stats are the live
// patch values. Zombies count as monsters where that helps you (Sunfire's bonus, Yi's
// Alpha Strike) and League's damage caps against monsters are switched off.

import { dist, rand, TAU } from './util.js';
import { sfx } from './audio.js';

const ICON = (glyph, a, b, fg) => ({ bg: [a, b], glyph, fg });

export const ITEMS = {
  // ------------------------------------------------------------ Master Yi / on-hit
  infinity: {
    name: 'Infinity Edge', gold: 3500, pool: ['yi'],
    stats: { ad: 75, crit: 0.25, critDmg: 0.3 },
    text: '+75 AD, +25% crit. Crits deal 230% damage.',
    icon: ICON('sword', '#6b5a1e', '#1d1806', '#ffe08a'),
  },
  botrk: {
    name: 'Blade of the Ruined King', gold: 3200, pool: ['yi'],
    stats: { ad: 40, as: 25, ls: 10 },
    text: '+40 AD, +25% AS, +10% life steal. Attacks deal 9% of the zombie\'s current health as bonus physical damage.',
    icon: ICON('sword', '#1f4a3c', '#08140f', '#7dffcb'),
    onHit(c, z, eff, g) {
      if (!z.dead) g.damage(z, z.hp * 0.09 * eff, { type: 'physical', src: 'item', noHitPoints: true });
    },
  },
  kraken: {
    name: 'Kraken Slayer', gold: 3000, pool: ['yi'],
    stats: { ad: 45, as: 40, msPct: 4 },
    text: '+45 AD, +40% AS, +4% MS. Every 3rd attack deals 150-200 (by level) bonus physical damage, up to 75% more against wounded zombies.',
    icon: ICON('claw', '#16405a', '#06121a', '#8fd6ff'),
    onAttack(c, z, g) {
      c.stacks.kraken = (c.stacks.kraken + 1) % 3;
      if (c.stacks.kraken !== 0 || z.dead) return;
      const base = 150 + Math.max(0, c.level - 8) * 5;
      const missing = 1 - z.hp / z.maxHp;
      g.damage(z, base * (1 + 0.75 * missing), { type: 'physical', src: 'item', noHitPoints: true });
      g.fx.burst(z.x, z.y + 1, z.z, 10, { color: '#8fd6ff', speed: 3, life: 0.4, size: 0.2 });
    },
  },
  guinsoo: {
    name: "Guinsoo's Rageblade", gold: 3000, pool: ['yi', 'katarina'],
    stats: { ad: 30, ap: 30, as: 25 },
    text: '+30 AD, +30 AP, +25% AS. Attacks deal 30 magic damage and grant 8% AS for 4s (4 stacks). At full stacks every 3rd attack applies on-hit effects twice.',
    icon: ICON('axe', '#6a2a0f', '#1d0b04', '#ffb070'),
    onHit(c, z, eff, g) {
      if (!z.dead) g.damage(z, 30 * eff, { type: 'magic', src: 'item', noHitPoints: true });
    },
    onAttack(c, z, g) {
      const before = c.stacks.guinsoo;
      c.stacks.guinsoo = Math.min(4, c.stacks.guinsoo + 1);
      c.stacks.guinsooT = 4;
      if (before !== c.stacks.guinsoo) c.recompute();
      if (c.stacks.guinsoo >= 4) {
        c.stacks.gHit = (c.stacks.gHit || 0) + 1;
        if (c.stacks.gHit % 3 === 0 && !z.dead) g.items.onHit(c, z, 1, { phantom: true });
      }
    },
  },
  witsend: {
    name: "Wit's End", gold: 2800, pool: ['yi', 'katarina'],
    stats: { as: 50 },
    text: '+50% AS, +45 MR (no use against zombies). Attacks deal 45 bonus magic damage.',
    icon: ICON('staff', '#3e3a5c', '#11101c', '#c9b8ff'),
    onHit(c, z, eff, g) {
      if (!z.dead) g.damage(z, 45 * eff, { type: 'magic', src: 'item', noHitPoints: true });
    },
  },
  ravenous: {
    name: 'Ravenous Hydra', gold: 3300, pool: ['yi'], unique: 'tiamat',
    stats: { ad: 65, ls: 12, ah: 15 },
    text: '+65 AD, +12% life steal, +15 haste. Attacks cleave 40% AD to zombies within 3.5m of the target. Active: 80% AD to zombies within 4.5m (10s).',
    icon: ICON('axe', '#5a1010', '#180404', '#ff8a8a'),
    onAttack(c, z, g) {
      cleave(c, z, g, 0.4 * c.s.ad, 3.5);
    },
    active: { cd: 10, use: (c, g) => hydraBurst(c, g, 0.8 * c.s.ad, 4.5, '#ff8a8a') },
  },
  titanic: {
    name: 'Titanic Hydra', gold: 3300, pool: ['yi', 'amumu'], unique: 'tiamat',
    stats: { ad: 40, hp: 600 },
    text: '+40 AD, +600 HP. Attacks deal 1% of your max health to the target and 3% to zombies behind it. Active: the next attack deals 4% and 9% instead (10s).',
    icon: ICON('axe', '#3a4a5a', '#0e1318', '#cfe3ff'),
    onAttack(c, z, g) {
      const big = c.stacks.titanicNext > g.time;
      if (big) c.stacks.titanicNext = 0;
      if (!z.dead) g.damage(z, c.maxHp * (big ? 0.04 : 0.01), { type: 'physical', src: 'item', noHitPoints: true });
      const ang = Math.atan2(z.z - c.z, z.x - c.x);
      g.queryZombies(z.x, z.z, 3.5, (o) => {
        if (o === z || o.dead || !o.targetable) return;
        const a = Math.atan2(o.z - c.z, o.x - c.x);
        if (Math.abs(((a - ang + Math.PI * 3) % TAU) - Math.PI) > 0.7) return;
        g.damage(o, c.maxHp * (big ? 0.09 : 0.03), { type: 'physical', src: 'item', noHitPoints: true });
      });
      if (big) g.fx.ring(z.x, z.y, z.z, 0.5, 3, '#cfe3ff', 0.35);
    },
    active: {
      cd: 10,
      use(c, g) {
        c.stacks.titanicNext = g.time + 10;
        c.atk.cd = 0;
        return true;
      },
    },
  },
  stridebreaker: {
    name: 'Stridebreaker', gold: 3300, pool: ['yi'], unique: 'tiamat',
    stats: { ad: 40, as: 25, hp: 450 },
    text: '+40 AD, +25% AS, +450 HP. Attacks cleave 40% AD. Active: 80% AD to zombies within 4.5m and a 35% slow for 3s (15s).',
    icon: ICON('burst', '#5a3a10', '#1a1004', '#ffd28a'),
    onAttack(c, z, g) {
      cleave(c, z, g, 0.4 * c.s.ad, 3.5);
    },
    active: {
      cd: 15,
      use(c, g) {
        hydraBurst(c, g, 0.8 * c.s.ad, 4.5, '#ffd28a', (z) => g.slowZombie(z, 0.35, 3));
        return true;
      },
    },
  },
  bloodthirster: {
    name: 'Bloodthirster', gold: 3400, pool: ['yi'],
    stats: { ad: 80, ls: 15 },
    text: '+80 AD, +15% life steal. Overhealing from life steal becomes a shield of up to 165-315.',
    icon: ICON('potion', '#6a0f1c', '#1c0307', '#ff7a8a'),
  },
  steraks: {
    name: "Sterak's Gage", gold: 3200, pool: ['yi'], unique: 'lifeline',
    stats: { hp: 400 },
    text: '+400 HP, bonus AD equal to 50% of base AD. Dropping below 30% health grants a shield of 60% of your bonus health that decays over 4.5s (90s).',
    icon: ICON('shield', '#5a4a3a', '#17120e', '#ffd9a8'),
  },
  statikk: {
    name: 'Statikk Shiv', gold: 3000, pool: ['yi', 'katarina'],
    stats: { ad: 45, ap: 45, as: 30, msPct: 4 },
    text: '+45 AD, +45 AP, +30% AS, +4% MS. Moving and attacking build Energize; at 100 the next attack fires chain lightning for 90 magic damage that jumps to 4-8 zombies (by level), applying on-hit to each.',
    icon: ICON('bolt', '#1c3a6a', '#060f1e', '#bfe0ff'),
    tick(c, dt) {
      c.stacks.shiv = Math.min(100, c.stacks.shiv + c.speedNow * dt * 4);
    },
    onAttack(c, z, g) {
      c.stacks.shiv = Math.min(100, c.stacks.shiv + 9);
      if (c.stacks.shiv < 100) return;
      c.stacks.shiv = 0;
      const n = c.level >= 13 ? 8 : c.level >= 9 ? 6 : 4;
      let cur = z;
      const hit = new Set();
      for (let i = 0; i < n && cur; i++) {
        hit.add(cur);
        const from = cur;
        if (!cur.dead) {
          g.damage(cur, 90, { type: 'magic', src: 'item', noHitPoints: true });
          g.items.onHit(c, cur, 1, { shiv: true });
        }
        let next = null, bd = 5;
        g.queryZombies(from.x, from.z, 5, (o) => {
          if (o.dead || !o.targetable || hit.has(o)) return;
          const d = dist(from.x, from.z, o.x, o.z);
          if (d < bd) {
            bd = d;
            next = o;
          }
        });
        if (next) g.fx.streak(from.x, from.y + 0.6, from.z, next.x, next.y + 0.6, next.z, '#bfe0ff', 0.08, 0.2);
        cur = next;
      }
      sfx.zap(z);
    },
  },
  // ------------------------------------------------------------ Katarina / AP
  nashor: {
    name: "Nashor's Tooth", gold: 2900, pool: ['katarina'],
    stats: { ap: 80, as: 50, ah: 15 },
    text: '+80 AP, +50% AS, +15 haste. Attacks deal 15 (+15% AP) bonus magic damage.',
    icon: ICON('dagger', '#4a1a5a', '#14061a', '#e6a8ff'),
    onHit(c, z, eff, g) {
      if (!z.dead) g.damage(z, (15 + 0.15 * c.s.ap) * eff, { type: 'magic', src: 'item', noHitPoints: true });
    },
  },
  lichbane: {
    name: 'Lich Bane', gold: 2900, pool: ['katarina'],
    stats: { ap: 100, msPct: 6, ah: 10 },
    text: '+100 AP, +6% MS, +10 haste. After an ability, the next attack gains 50% AS and deals 75% base AD + 45% AP bonus magic damage (1.5s).',
    icon: ICON('staff', '#2a3a6a', '#0a0f1e', '#a8c4ff'),
    onCast(c, key, g) {
      if (c.buffs.lichCd <= 0) {
        c.buffs.lich = 10;
        c.recompute();
      }
    },
    onHit(c, z, eff, g, ctx) {
      if (!ctx.attack || c.buffs.lich <= 0 || z.dead) return;
      c.buffs.lich = 0;
      c.buffs.lichCd = 1.5;
      c.recompute();
      g.damage(z, 0.75 * c.s.baseAD + 0.45 * c.s.ap, { type: 'magic', src: 'item', noHitPoints: true });
      g.fx.burst(z.x, z.y + 1, z.z, 10, { color: '#a8c4ff', speed: 3, life: 0.35, size: 0.2 });
    },
  },
  rabadon: {
    name: "Rabadon's Deathcap", gold: 3500, pool: ['katarina', 'amumu'],
    stats: { ap: 130, apMult: 1.3 },
    text: '+130 AP. Your total AP is increased by 30%.',
    icon: ICON('hat', '#2a2a6a', '#0a0a1e', '#b8b8ff'),
  },
  zhonya: {
    name: "Zhonya's Hourglass", gold: 3250, pool: ['katarina', 'amumu'],
    stats: { ap: 105, armor: 50 },
    text: '+105 AP, +50 armor. Active: become invulnerable and untargetable for 2.5s, but you cannot act (120s).',
    icon: ICON('hourglass', '#6a5a1a', '#1e1906', '#ffe58a'),
    active: {
      cd: 120,
      use(c, g) {
        c.buffs.stasis = 2.5;
        c.atk.wind = -1;
        if (c.channel) c.kit.endChannel('cast');
        sfx.shield(c);
        g.fx.beam(c.x, c.y, c.z, 0.7, 2.4, '#ffe58a', 2.5, 0.35);
        return true;
      },
    },
  },
  liandry: {
    name: "Liandry's Torment", gold: 3000, pool: ['katarina', 'amumu'],
    stats: { ap: 60, hp: 300 },
    text: '+60 AP, +300 HP. Ability damage burns zombies for 2% of their max health per second for 3s.',
    icon: ICON('flame', '#5a1a3a', '#1a0610', '#ff9ad0'),
    onAbilityDamage(c, z, res, key, g) {
      if (!z.dead) g.burn(z, z.maxHp * 0.02, 3, 'liandry');
    },
  },
  riftmaker: {
    name: 'Riftmaker', gold: 3100, pool: ['katarina', 'amumu'],
    stats: { ap: 70, hp: 350, ah: 15 },
    text: '+70 AP, +350 HP, +15 haste. Each second in combat adds 2% damage, up to 8%; at full, gain 10% omnivamp. Gain AP equal to 2% of bonus health.',
    icon: ICON('gem', '#4a1a6a', '#14061e', '#d8a8ff'),
    tick(c, dt, g) {
      const inCombat = g.time - c.combatT < 3;
      const before = c.stacks.rift >= 4;
      c.stacks.rift = inCombat ? Math.min(4, c.stacks.rift + dt) : 0;
      if (before !== c.stacks.rift >= 4) c.recompute();
    },
    damageMult(c) {
      return 1 + Math.floor(c.stacks.rift) * 0.02;
    },
  },
  rocketbelt: {
    name: 'Hextech Rocketbelt', gold: 2650, pool: ['katarina', 'amumu'],
    stats: { ap: 60, hp: 350, ah: 20 },
    text: '+60 AP, +350 HP, +20 haste. Active: dash 2.75m towards the cursor and fire 7 rockets for 100 (+10% AP) magic damage (40s).',
    icon: ICON('blink', '#5a3a10', '#1a1004', '#ffc070'),
    active: {
      cd: 40,
      use(c, g, intent) {
        const aim = intent.aim || { x: c.x + Math.cos(c.ang), z: c.z + Math.sin(c.ang) };
        let dx = aim.x - c.x, dz = aim.z - c.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const p = g.grid.castFree(c.x, c.z, dx, dz, 2.75, c.r);
        g.fx.streak(c.x, c.y, c.z, p.x, c.y, p.z, '#ffc070', 0.25, 0.3);
        c.x = p.x;
        c.z = p.z;
        c.ang = Math.atan2(dz, dx);
        const hit = new Set();
        for (let i = 0; i < 7; i++) {
          const a = c.ang + (i - 3) * 0.16;
          for (let d = 0.5; d < 5; d += 0.5) {
            const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
            if (g.grid.blockedAt(x, z)) break;
            let got = null;
            g.queryZombies(x, z, 0.8, (o) => {
              if (!got && !o.dead && o.targetable && !hit.has(o) && dist(x, z, o.x, o.z) < 0.6 + o.r) got = o;
            });
            if (got) {
              hit.add(got);
              g.damage(got, 100 + 0.1 * c.s.ap, { type: 'magic', src: 'item' });
              break;
            }
          }
          g.fx.streak(c.x, c.y + 0.4, c.z, c.x + Math.cos(a) * 4.5, c.y + 0.4, c.z + Math.sin(a) * 4.5, '#ffc070', 0.08, 0.25);
        }
        sfx.flash(c);
        return true;
      },
    },
  },
  mejai: {
    name: "Mejai's Soulstealer", gold: 1500, pool: ['katarina', 'amumu'], unique: 'glory',
    stats: { ap: 20, hp: 100 },
    text: '+20 AP, +100 HP. Glory: +1 stack per zombie kill (+4 for Hellhounds and Nova crawlers), max 25, 5 AP each; +10% MS at 10 stacks. Going down loses 10.',
    icon: ICON('orb', '#3a1a5a', '#0e061a', '#c890ff'),
    onKill(c, z, g) {
      const before = c.stacks.mejai;
      c.stacks.mejai = Math.min(25, c.stacks.mejai + (c.isSpecial(z) ? 4 : 1));
      if (before !== c.stacks.mejai) c.recompute();
    },
  },
  // ------------------------------------------------------------ Amumu / tank
  sunfire: {
    name: 'Sunfire Aegis', gold: 2800, pool: ['amumu'], unique: 'immolate',
    stats: { hp: 350, armor: 50, ah: 10 },
    text: '+350 HP, +50 armor, +10 haste. Immolate: after dealing or taking damage, burn zombies within 3.25m for 20 (+1% bonus HP) magic damage per second for 3s, doubled because zombies count as monsters.',
    icon: ICON('flame', '#6a3a0a', '#1e1003', '#ffcf6a'),
    tick(c, dt, g) {
      immolate(c, dt, g, 20 + 0.01 * c.s.bonusHp, 2, 3.25, '#ffb040');
    },
  },
  hollow: {
    name: 'Hollow Radiance', gold: 2800, pool: ['amumu'], unique: 'immolate',
    stats: { hp: 400, ah: 10 },
    text: '+400 HP, +40 MR (no use against zombies), +10 haste. Immolate for 15 (+1% bonus HP) per second, 125% against zombies. Kills erupt for 30 (+2% bonus HP) magic damage within 3.5m.',
    icon: ICON('orb', '#1a4a5a', '#06141a', '#9fe8ff'),
    tick(c, dt, g) {
      immolate(c, dt, g, 15 + 0.01 * c.s.bonusHp, 1.25, 3.25, '#7fd8ff');
    },
    onKill(c, z, g) {
      const dmg = 30 + 0.02 * c.s.bonusHp;
      g.queryZombies(z.x, z.z, 3.5, (o) => {
        if (o.dead || !o.targetable || dist(z.x, z.z, o.x, o.z) > 3.5 + o.r) return;
        g.damage(o, dmg, { type: 'magic', src: 'item', noHitPoints: true });
      });
      g.fx.ring(z.x, z.y, z.z, 0.3, 3.5, '#7fd8ff', 0.35, 0.5);
    },
  },
  thornmail: {
    name: 'Thornmail', gold: 2450, pool: ['amumu'],
    stats: { hp: 150, armor: 75 },
    text: '+150 HP, +75 armor. When a zombie bites you it takes 20 (+10% bonus armor) magic damage.',
    icon: ICON('thorns', '#3a4a2a', '#10140b', '#cfe8a8'),
    onHurt(c, att, dmg, g) {
      if (att && !att.dead && att.hp !== undefined) g.damage(att, 20 + 0.1 * c.s.bonusArmor, { type: 'magic', src: 'item', noHitPoints: true });
    },
  },
  warmog: {
    name: "Warmog's Armor", gold: 3100, pool: ['amumu'],
    stats: { hp: 1000 },
    text: '+1000 HP, plus 12% of your item health as bonus health.',
    icon: ICON('heart', '#1a5a2a', '#06180b', '#9cffb0'),
  },
  heartsteel: {
    name: 'Heartsteel', gold: 3000, pool: ['amumu'],
    stats: { hp: 900 },
    text: '+900 HP. Every 8s your next attack deals 70 + 6% of your max health as bonus physical damage and permanently grants 10% of that as max health.',
    icon: ICON('heart', '#5a1a1a', '#180606', '#ff9a9a'),
    onAttack(c, z, g) {
      if (g.time < (c.stacks.hsNext || 0) || z.dead) return;
      c.stacks.hsNext = g.time + 8;
      const dmg = 70 + 0.06 * c.maxHp;
      g.damage(z, dmg, { type: 'physical', src: 'item', noHitPoints: true });
      c.stacks.heartsteel += dmg * 0.1;
      c.recompute();
      g.fx.burst(z.x, z.y + 1, z.z, 14, { color: '#ff7a7a', speed: 3, life: 0.5, size: 0.25 });
    },
  },
  // ------------------------------------------------------------ wonder items
  spatula: {
    name: 'Golden Spatula', gold: 9999, pool: ['amumu', 'katarina', 'yi'], weight: 0.25, wonder: true,
    stats: { ad: 70, ap: 120, as: 50, crit: 0.3, hp: 250, armor: 30, msPct: 10, ls: 10, ah: 20 },
    text: 'The item that does everything. +70 AD, +120 AP, +50% AS, +30% crit, +250 HP, +30 armor, +10% MS, +10% life steal, +20 haste.',
    icon: ICON('spatula', '#8a6a10', '#2a1f04', '#fff0a0'),
  },
};

/** Trinket-slot throwable from the box: Kino's Cymbal Monkey becomes a Poro. */
export const PORO = {
  id: 'poro', name: 'Poro-Snax', charges: 3, weight: 0.8,
  text: 'Throw a snack (key 4). A Poro chases it, and every zombie nearby chases the Poro for 7s until it pops. 3 charges; Max Ammo refills them.',
  icon: ICON('poro', '#5a7a9a', '#16212a', '#ffffff'),
};

// Wall chalk: the guns on Kino's walls, swapped for League starter and mid-tier items.
// Filled in per map location in map.js (same price as the gun it replaces).
export const WALL_ITEMS = {
  doransBlade: {
    name: "Doran's Blade", gold: 450, pool: ['yi'],
    stats: { ad: 10, hp: 80, ov: 2.5 },
    text: '+10 AD, +80 HP, +2.5% omnivamp.',
    icon: ICON('sword', '#4a3a2a', '#14100b', '#e8d0b0'),
  },
  doransRing: {
    name: "Doran's Ring", gold: 400, pool: ['katarina'],
    stats: { ap: 18, hp: 90 },
    text: '+18 AP, +90 HP.',
    icon: ICON('gem', '#3a2a5a', '#0f0b18', '#d0b8ff'),
  },
  doransShield: {
    name: "Doran's Shield", gold: 450, pool: ['amumu'],
    stats: { hp: 110 },
    text: '+110 HP. Enduring Focus: after a bite, regenerate up to 5 health per second for 8s, more the lower you are.',
    icon: ICON('shield', '#3a4a5a', '#0e1218', '#c0d8f0'),
  },
};

// ------------------------------------------------------------ helpers
function cleave(c, z, g, dmg, radius) {
  g.queryZombies(z.x, z.z, radius, (o) => {
    if (o === z || o.dead || !o.targetable || dist(z.x, z.z, o.x, o.z) > radius + o.r) return;
    const r = g.damage(o, dmg, { type: 'physical', src: 'item', noHitPoints: true });
    c.vamp(r.dealt, true);
  });
}

function hydraBurst(c, g, dmg, radius, color, extra) {
  g.queryZombies(c.x, c.z, radius, (o) => {
    if (o.dead || !o.targetable || dist(c.x, c.z, o.x, o.z) > radius + o.r) return;
    const r = g.damage(o, dmg, { type: 'physical', src: 'item' });
    c.vamp(r.dealt, true);
    if (extra && !o.dead) extra(o);
  });
  g.fx.ring(c.x, c.y, c.z, 0.5, radius, color, 0.35, 0.8);
  g.fx.burst(c.x, c.y + 0.6, c.z, 20, { color, speed: 5, life: 0.4, size: 0.2, up: 0.2 });
  sfx.tantrum(c);
  return true;
}

function immolate(c, dt, g, dps, mult, radius, color) {
  if (g.time - c.combatT > 3 || c.downed) return;
  c.stacks.immo = (c.stacks.immo || 0) + dt;
  if (c.stacks.immo < 1) return;
  c.stacks.immo -= 1;
  g.queryZombies(c.x, c.z, radius, (z) => {
    if (z.dead || !z.targetable || dist(c.x, c.z, z.x, z.z) > radius + z.r) return;
    g.damage(z, dps * mult, { type: 'magic', src: 'dot' });
  });
  g.fx.ring(c.x, c.y, c.z, radius * 0.7, radius, color, 0.5, 0.25);
}

/** Item manager: inventory hooks, actives, the box roll pool. */
export function createItemSystem(g) {
  const forEach = (c, fn) => {
    for (const it of c.items) if (it) fn(it.def, it);
  };
  return {
    def(id) {
      return ITEMS[id] || WALL_ITEMS[id] || null;
    },
    onHit(c, z, eff, ctx = {}) {
      forEach(c, (d) => d.onHit && d.onHit(c, z, eff, g, ctx));
    },
    onAttack(c, z) {
      forEach(c, (d) => d.onAttack && d.onAttack(c, z, g));
    },
    onAbilityDamage(c, z, res, key) {
      forEach(c, (d) => d.onAbilityDamage && d.onAbilityDamage(c, z, res, key, g));
    },
    onKill(c, z, opts) {
      forEach(c, (d) => d.onKill && d.onKill(c, z, g, opts));
    },
    onHurt(c, att, dmg) {
      forEach(c, (d) => d.onHurt && d.onHurt(c, att, dmg, g));
      // Doran's Shield: restore some health after a bite
      if (c.hasItem('doransShield')) c.stacks.dShield = 8;
    },
    onCast(c, key) {
      forEach(c, (d) => d.onCast && d.onCast(c, key, g));
    },
    tick(c, dt) {
      forEach(c, (d) => d.tick && d.tick(c, dt, g));
      if (c.stacks.dShield > 0) {
        c.stacks.dShield -= dt;
        c.heal(5 * (1 - c.hp / c.maxHp) * dt);
      }
    },
    damageMult(c) {
      let m = 1;
      forEach(c, (d) => {
        if (d.damageMult) m *= d.damageMult(c);
      });
      return m;
    },
    activate(c, slot, intent) {
      const it = c.items[slot];
      if (!it || !it.def.active) return;
      if (c.itemCd[slot] > 0 || c.downed || c.buffs.stasis > 0) return;
      if (it.def.active.use(c, g, intent)) {
        c.itemCd[slot] = it.def.active.cd * (it.def.id === 'zhonya' ? 1 : 100 / (100 + c.s.ah));
        g.events.emit('itemUsed', slot);
      }
    },
    /** Box pool for a champion: excludes owned items and items sharing a unique group. */
    pool(c) {
      const owned = new Set(c.items.filter(Boolean).map((i) => i.id));
      const groups = new Set(c.items.filter(Boolean).map((i) => i.def.unique).filter(Boolean));
      const list = [];
      for (const [id, d] of Object.entries(ITEMS)) {
        if (!d.pool.includes(c.id) || owned.has(id)) continue;
        if (d.unique && groups.has(d.unique)) continue;
        list.push({ id, w: d.weight ?? 1 });
      }
      if (!c.trinket || c.trinket.charges <= 0) list.push({ id: 'poro', w: PORO.weight });
      return list;
    },
  };
}

for (const [id, d] of Object.entries(ITEMS)) d.id = id;
for (const [id, d] of Object.entries(WALL_ITEMS)) d.id = id;
export const rollWeighted = (list) => {
  let total = 0;
  for (const e of list) total += e.w;
  let r = Math.random() * total;
  for (const e of list) {
    r -= e.w;
    if (r <= 0) return e.id;
  }
  return list.length ? list[list.length - 1].id : null;
};
export { rand };
