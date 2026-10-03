// Round rules lifted from Black Ops (2010) zombies scripts (_zombiemode.gsc and the
// zombiemode.csv overrides). Pure functions so they can be checked outside the browser.

/** Zombie health for a round: 150, +100 per round to 9, then +10% (truncated) per round. */
export function zombieHealth(round) {
  let h = 150;
  for (let i = 2; i <= round; i++) {
    if (i >= 10) h += Math.floor(h * 0.1);
    else h += 100;
    if (h > 2147483647) h = 2147483647; // the original overflows at 163; we just cap it
  }
  return h;
}

/** Zombies in a solo round. */
export function zombieCount(round) {
  let max = 24;
  let mult = Math.max(1, round / 5);
  if (round >= 10) mult *= round * 0.15;
  max += Math.floor(0.5 * 6 * mult);
  if (round === 1) return Math.floor(max * 0.25);
  if (round === 2) return Math.floor(max * 0.3);
  if (round === 3) return Math.floor(max * 0.5);
  if (round === 4) return Math.floor(max * 0.7);
  if (round === 5) return Math.floor(max * 0.9);
  return max;
}

/** Seconds between spawns: 2.0 * 0.95 per completed round, floor 0.08, plus the 0.1 s network frame. */
export function spawnDelay(round) {
  let d = 2.0;
  for (let i = 1; i < round; i++) {
    if (d > 0.08) d *= 0.95;
    else if (d < 0.08) d = 0.08;
  }
  return d + 0.1;
}

/** Movement class rolled per zombie: base (round-1)*8 (1 in round 1) .. base+34. */
export function rollSpeed(round, rnd = Math.random) {
  const base = round <= 1 ? 1 : (round - 1) * 8;
  const v = base + Math.floor(rnd() * 35);
  if (v <= 35) return 'walk';
  if (v <= 70) return 'run';
  return 'sprint';
}

export const MAX_ALIVE = 24;
export const START_POINTS = 500;

/** Board repair points cap for a round (counted at 10 per board). */
export const repairCap = (round) => Math.min(50 * round, 500);

/** Point awards are rounded up to a multiple of 5, then doubled under Double Points. */
export function award(base, doublePoints) {
  const v = Math.ceil(base / 5) * 5;
  return doublePoints ? v * 2 : v;
}

/** Points lost when going down: 5% of current points, rounded up to 10. */
export function downPenalty(points) {
  return Math.ceil((points * 0.05) / 10) * 10;
}

// ---- power-ups
export const POWERUPS = ['nuke', 'instakill', 'double', 'maxammo', 'carpenter', 'firesale'];
export const POWERUP_LIFE = 26.5;
/** Blink schedule after 15 s solid: 15 toggles @0.5 s, 10 @0.25 s, 15 @0.1 s. Returns visible? */
export function powerupVisible(age) {
  if (age < 15) return true;
  let t = age - 15;
  const phases = [[15, 0.5], [10, 0.25], [15, 0.1]];
  let toggles = 0;
  for (const [n, step] of phases) {
    if (t < n * step) {
      toggles += Math.floor(t / step);
      return toggles % 2 === 1; // first toggle hides it
    }
    t -= n * step;
    toggles += n;
  }
  return false;
}
export const FIRST_DROP_AT = 2500; // total points earned including the starting 500
export const DROP_STEP_START = 2000;
export const DROP_STEP_MULT = 1.14;
export const DROP_RANDOM = 0.03; // randomint(100) <= 2
export const DROPS_PER_ROUND = 4;
export const TIMED_POWERUP = 30;

// ---- box
export const BOX_COST = 950;
export const FIRESALE_COST = 10;
/** Chance the teddy appears on this pull (pull = 1-based count at the current spot). */
export function teddyChance(pull, boxHasMoved) {
  const accessed = pull - 1;
  if (accessed < 4) return 0;
  if (accessed < 8) return 0.15;
  if (!boxHasMoved && accessed === 8) return 1;
  if (accessed < 13) return 0.3;
  return 0.5;
}

// ---- hellhounds (Kino's special rounds)
export function firstDogRound(rnd = Math.random) {
  return 5 + Math.floor(rnd() * 3); // 5, 6 or 7
}
export function nextDogRound(current, rnd = Math.random) {
  return current + 4 + Math.floor(rnd() * 2); // +4 or +5
}
export const dogCount = (dogRoundIndex) => (dogRoundIndex <= 2 ? 6 : 8);
export const dogHealth = (dogRoundIndex) => [400, 900, 1300, 1600][Math.min(3, dogRoundIndex - 1)];
export const DOGS_ALIVE = 2;
export function dogSpawnDelay(dogRoundIndex, spawned, total) {
  const base = [3.0, 2.5, 2.0, 1.5][Math.min(3, dogRoundIndex - 1)];
  return Math.max(0.1, base - spawned / total);
}

// ---- perks (Kino has exactly these four)
export const PERKS = {
  jugg: { name: 'Juggernog', cost: 2500, color: '#d4202a' },
  speed: { name: 'Speed Cola', cost: 3000, color: '#2fbf4a' },
  tap: { name: 'Double Tap Root Beer', cost: 2000, color: '#d9a21b' },
  revive: { name: 'Quick Revive', cost: 500, color: '#4fb6ff' },
};
export const PERK_LIMIT = 4;
export const QR_MAX_BUYS = 3;
export const PAP_COST = 5000;
export const TRAP_COST = 1000;
export const TRAP_ON = 40;
export const TRAP_COOLDOWN = 60;
export const TELEPORT_COOLDOWN = 90;
export const PAP_ROOM_TIME = 30;

// ---- regen (normal difficulty at 0.75): delays and the low-health threshold
export const REGEN_DELAY = 2.4;
export const REGEN_DELAY_LOW = 5.0;
export const REGEN_LOW = 0.2;
